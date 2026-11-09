import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { bodyZones, humanScale, type HumanBody } from "./domain";
import { sculptById } from "./sculpt-catalog";
import type { HumanMeshData } from "./anatomy";

/** Immutable, fixed-pose sculpt. Coordinates are millimetres in the app. */
export type SculptMesh = {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  sourceIds: Uint32Array;
  restGeometry: THREE.BufferGeometry;
};

/** UV seams may split a GLB vertex. Weld only the tattoo graph, retaining every
 * authored render vertex/normal/UV so connected ink can cross those seams. */
export function sculptMeshData(
  source: THREE.BufferGeometry,
  material: THREE.MeshStandardMaterial,
  matrix = new THREE.Matrix4(),
  envelope = false,
): HumanMeshData {
  const geometry = source.clone().applyMatrix4(matrix).scale(1000, 1000, 1000);
  const restGeometry = geometry.clone();
  if (envelope) {
    const delta = source.morphAttributes.position?.[0];
    if (!delta || delta.count !== source.getAttribute("position").count)
      throw new Error("The skin envelope is missing or incompatible.");
    // Bake the matching morph before applying the GLB's world transform.
    const target = source.getAttribute("position").clone();
    for (let i = 0; i < target.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(delta, i);
      if (source.morphTargetsRelative)
        v.add(
          new THREE.Vector3().fromBufferAttribute(
            source.getAttribute("position"),
            i,
          ),
        );
      v.applyMatrix4(matrix).multiplyScalar(1000);
      target.setXYZ(i, v.x, v.y, v.z);
    }
    geometry.setAttribute("position", target);
    const normalDelta = source.morphAttributes.normal?.[0];
    if (normalDelta) {
      const normals = source.getAttribute("normal").clone();
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
      for (let i = 0; i < normals.count; i++) {
        const n = new THREE.Vector3().fromBufferAttribute(normalDelta, i);
        if (source.morphTargetsRelative)
          n.add(
            new THREE.Vector3().fromBufferAttribute(
              source.getAttribute("normal"),
              i,
            ),
          );
        n.applyMatrix3(normalMatrix).normalize();
        normals.setXYZ(i, n.x, n.y, n.z);
      }
      geometry.setAttribute("normal", normals);
    } else geometry.computeVertexNormals();
  }
  // Baked surfaces must not be morphed again by the renderer.
  geometry.morphAttributes = {};
  const rest = restGeometry.getAttribute("position");
  const position = geometry.getAttribute("position");
  if (!position || position.count > 1_000_000)
    throw new Error("The bundled sculpt has an invalid vertex count.");
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  const vertices: number[][] = [],
    canonical = new Map<string, number>(),
    sourceIds = new Uint32Array(position.count);
  for (let i = 0; i < position.count; i++) {
    const xyz = [position.getX(i), position.getY(i), position.getZ(i)];
    if (xyz.some((v) => !Number.isFinite(v)))
      throw new Error("The bundled sculpt contains invalid coordinates.");
    const key = [rest.getX(i), rest.getY(i), rest.getZ(i)]
      .map((v) => Math.round(v * 10_000))
      .join(":");
    let id = canonical.get(key);
    if (id === undefined) {
      id = vertices.length;
      canonical.set(key, id);
      vertices.push([...xyz, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    }
    sourceIds[i] = id;
  }
  const indices = geometry.index
    ? Array.from(geometry.index.array, (i) => sourceIds[i])
    : Array.from(sourceIds);
  const joints = {
    shoulder: [0, 0, 0],
    elbow: [0, 0, 0],
    wrist: [0, 0, 0],
    hip: [0, 0, 0],
    knee: [0, 0, 0],
    ankle: [0, 0, 0],
  };
  return {
    vertices,
    parts: [indices, [], [], [], [], []],
    joints: { L: joints, R: joints },
    sculpt: { geometry, material, sourceIds, restGeometry },
  };
}

const sources = new Map<string, Promise<HumanMeshData>>();
const textureKeys = [
  "map",
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "aoMap",
  "emissiveMap",
  "bumpMap",
  "alphaMap",
] as const;
function disposeSource(data: HumanMeshData) {
  const sculpt = data.sculpt!;
  sculpt.geometry.dispose();
  sculpt.restGeometry.dispose();
  for (const texture of new Set(textureKeys.map((key) => sculpt.material[key])))
    texture?.dispose();
  sculpt.material.dispose();
  // Active surfaces own cloned textures/materials. Do not invalidate shared
  // HTMLImageElements; they are released when the last active clone is collected.
}
export function loadSculpt(id: string, skin = false): Promise<HumanMeshData> {
  const envelope = skin && !!sculptById(id)?.skinEnvelope;
  const cacheKey = `${id}:${envelope ? "skin" : "original"}`;
  if (!/^[a-z-]+$/.test(id))
    return Promise.reject(new Error("Invalid sculpt ID."));
  const cached = sources.get(cacheKey);
  if (cached) {
    sources.delete(cacheKey);
    sources.set(cacheKey, cached);
    return cached;
  }
  const task = (async () => {
    const loader = new GLTFLoader();
    loader.register((parser) => {
      // Embedded images use img-src blob:, which the desktop CSP permits.
      // ImageBitmapLoader instead fetches blob: via connect-src and also needs
      // manual bitmap lifetime management. HTML images safely share across views.
      parser.textureLoader = new THREE.TextureLoader(
        parser.options.manager,
      ).setCrossOrigin(parser.options.crossOrigin);
      return { name: "FORM_STUDIO_SCULPT_IMAGES" };
    });
    const gltf = await loader.loadAsync(`/sculpts/${id}.glb`);
    gltf.scene.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = [];
    gltf.scene.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh);
    });
    if (meshes.length !== 1 || Array.isArray(meshes[0].material))
      throw new Error("The bundled sculpt must contain one joined surface.");
    const mesh = meshes[0];
    const material = mesh.material as THREE.MeshStandardMaterial;
    if (!material.isMeshStandardMaterial)
      throw new Error("The bundled sculpt material is not supported.");
    const data = sculptMeshData(
      mesh.geometry,
      material,
      mesh.matrixWorld,
      envelope,
    );
    mesh.geometry.dispose();
    return data;
  })().catch((error) => {
    if (sources.get(cacheKey) === task) sources.delete(cacheKey);
    throw error;
  });
  sources.set(cacheKey, task);
  // Seven high-resolution assets should not all remain resident after browsing.
  // Eviction releases only cache ownership; an active SurfaceDecals keeps its data.
  while (sources.size > 3) {
    const oldest = sources.keys().next().value!;
    const evicted = sources.get(oldest)!;
    sources.delete(oldest);
    void evicted.then(disposeSource, () => {});
  }
  return task;
}

/** The tattoo chart is independent of the author's texture atlas. */
export function sculptGeometry(data: HumanMeshData, body: HumanBody) {
  const sculpt = data.sculpt!;
  const source = sculpt.geometry;
  const rest = sculpt.restGeometry;
  rest.computeBoundingBox();
  const bounds = rest.boundingBox!;
  const height = Math.max(1, bounds.max.y - bounds.min.y);
  const center = bounds.getCenter(new THREE.Vector3());
  const p = rest.getAttribute("position");
  const uv = source.getAttribute("uv");
  const indices = source.index
    ? Array.from(source.index.array)
    : Array.from({ length: p.count }, (_, i) => i);
  const g = source.index ? source.toNonIndexed() : source.clone();
  const chart = new Float32Array(indices.length * 2);
  const ids = new Uint32Array(indices.length);
  const sourceUv = new Float32Array(indices.length * 2);
  for (let t = 0; t < indices.length; t += 3) {
    const us = [0, 1, 2].map((k) => {
      const i = indices[t + k];
      return (
        0.5 +
        Math.atan2(p.getX(i) - center.x, p.getZ(i) - center.z) / (Math.PI * 2)
      );
    });
    const seam = Math.max(...us) - Math.min(...us) > 0.5;
    for (let k = 0; k < 3; k++) {
      const at = t + k,
        i = indices[at];
      chart[at * 2] = us[k] + (seam && us[k] < 0.5 ? 1 : 0);
      chart[at * 2 + 1] = (p.getY(i) - bounds.min.y) / height;
      sourceUv[at * 2] = uv?.getX(i) ?? 0;
      sourceUv[at * 2 + 1] = uv?.getY(i) ?? 0;
      ids[at] = sculpt.sourceIds[i];
    }
  }
  g.setAttribute("uv", new THREE.BufferAttribute(chart, 2));
  g.setAttribute("uv1", new THREE.BufferAttribute(sourceUv, 2));
  g.setAttribute("sourceIndex", new THREE.BufferAttribute(ids, 1));
  // Personal fitting, muscularity and joint controls must never deform a static asset.
  const scale = humanScale(body);
  g.scale(scale, scale, scale);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return [{ zone: bodyZones(body)[0], geometry: g }];
}

export function sculptMaterial(
  sculpt: SculptMesh,
  body: HumanBody,
  ink: THREE.CanvasTexture,
) {
  const material = sculpt.material.clone();
  if (
    sculptById(body.model?.sculptId)?.skinEnvelope &&
    body.model?.sculptAppearance === "skin"
  ) {
    for (const key of textureKeys) material[key] = null;
    material.color.set(body.skin);
    material.roughness = 0.65;
    material.metalness = 0;
  }
  const textures: THREE.Texture[] = [];
  for (const key of textureKeys) {
    const original = material[key];
    if (!original) continue;
    const texture = original.clone();
    texture.channel = 1;
    texture.needsUpdate = true;
    material[key] = texture;
    textures.push(texture);
  }
  const nativeColor = Boolean(
    material.map || sculpt.geometry.getAttribute("color"),
  );
  if (!nativeColor) material.color.set(body.skin);
  material.vertexColors = !!sculpt.geometry.getAttribute("color");
  material.side = THREE.DoubleSide;
  material.userData.sculpt = true;
  material.userData.nativeColor = nativeColor;
  material.userData.ownedTextures = textures;
  const appearance = {
    sculptSkin: { value: new THREE.Color(body.skin) },
    sculptRecolor: { value: body.model?.sculptAppearance === "skin" ? 1 : 0 },
  };
  material.userData.sculptAppearanceUniforms = appearance;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, appearance);
    shader.uniforms.sculptInk = { value: ink };
    shader.vertexShader = "varying vec2 vSculptInkUv;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <uv_vertex>",
      "#include <uv_vertex>\nvSculptInkUv = uv;",
    );
    shader.fragmentShader =
      "uniform sampler2D sculptInk; uniform vec3 sculptSkin; uniform float sculptRecolor; varying vec2 vSculptInkUv;\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
      if (sculptRecolor > 0.5) {
        float detail = 1.0;
        #ifdef USE_MAP
          vec3 sourceDetail = texture2D(map, vMapUv).rgb;
          detail = 0.65 + 0.35 * sqrt(clamp(dot(sourceDetail, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0));
        #endif
        diffuseColor.rgb = sculptSkin * detail;
      }
      diffuseColor.rgb *= texture2D(sculptInk, vSculptInkUv).rgb;`,
    );
  };
  material.customProgramCacheKey = () => "sculpt-ink-v2";
  return material;
}

/** Object-space orientation leaves topology, source UVs and connected anchors intact. */
export function sculptRotation(body: HumanBody): THREE.Euler {
  const r = body.model?.sculptId ? body.model.sculptRotation : undefined;
  return new THREE.Euler(
    ...([r?.x ?? 0, r?.y ?? 0, r?.z ?? 0].map(THREE.MathUtils.degToRad) as [
      number,
      number,
      number,
    ]),
    "XYZ",
  );
}
