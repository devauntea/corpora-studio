import { deformBodyPoint } from "./body-fitting";
import * as THREE from "three";
import { mapSurfaceInWorker } from "./compute-jobs";
import { triangleDistortion, type SurfaceMapResult } from "./surface-map";
import {
  humanScale,
  layerZone,
  type HumanBody,
  type Layer,
  type SurfaceZone,
} from "./domain";
import type { HumanMeshData } from "./anatomy";
export type SurfaceInspection = {
  triangles: number;
  folded: number;
  maxStretch: number;
  maxCompression: number;
  p95Error: number;
};
type Item = { layer: Layer; image: HTMLCanvasElement; ratio: number };
export class SurfaceDecals {
  group = new THREE.Group();
  cache = new Map<string, SurfaceMapResult>();
  controller?: AbortController;
  inspection: SurfaceInspection = {
    triangles: 0,
    folded: 0,
    maxStretch: 1,
    maxCompression: 1,
    p95Error: 0,
  };
  constructor(
    private data: HumanMeshData,
    private body: HumanBody,
    private charts: Map<SurfaceZone, { mesh: THREE.Mesh }>,
  ) {}
  nearestAnchor(layer: Layer) {
    const chart = this.charts.get(layerZone(this.body, layer));
    if (!chart || !this.body.model) return;
    const uv = chart.mesh.geometry.getAttribute("uv"),
      ids = chart.mesh.geometry.getAttribute("sourceIndex");
    let best = Infinity,
      vertex = 0;
    for (let i = 0; i < uv.count; i++) {
      let du = Math.abs(uv.getX(i) - layer.u);
      du = Math.min(du, Math.abs(1 - du));
      const d = du * du + (uv.getY(i) - layer.v) ** 2;
      if (d < best) {
        best = d;
        vertex = ids.getX(i);
      }
    }
    return {
      vertex,
      revision: this.body.model.revision,
      sex: this.body.model.sex,
      ...(this.body.model.sculptId ? { sculptId: this.body.model.sculptId } : {}),
    };
  }
  clear() {
    for (const child of [...this.group.children]) {
      const m = child as THREE.Mesh<
        THREE.BufferGeometry,
        THREE.MeshBasicMaterial
      >;
      m.geometry.dispose();
      m.material.map?.dispose();
      m.material.dispose();
      this.group.remove(m);
    }
  }
  async paint(items: Item[], inspectionLayer?: string) {
    this.controller?.abort();
    const controller = (this.controller = new AbortController());
    const output: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] =
        [],
      stats: SurfaceInspection = {
        triangles: 0,
        folded: 0,
        maxStretch: 1,
        maxCompression: 1,
        p95Error: 0,
      },
      errors: number[] = [];
    try {
      for (const [order, { layer: l, image, ratio }] of items.entries()) {
        if (!l.surface) continue;
        const a = l.surface;
        if (
          a.sex !== this.body.model?.sex ||
          a.revision !== this.body.model?.revision ||
          a.sculptId !== this.body.model?.sculptId
        )
          throw new Error(
            "Connected placement belongs to a different body mesh. Turn connected placement off, then on to re-anchor it.",
          );
        const radius = Math.min(
            1590,
            Math.hypot(l.width, l.width * ratio) * 0.8 + 25,
          ),
          key = [a.vertex, radius].join(":");
        let map = this.cache.get(key);
        if (!map) {
          const scale = humanScale(this.body),
            positions = new Float32Array(this.data.vertices.length * 3);
          for (let i = 0; i < this.data.vertices.length; i++) {
            const v = this.data.vertices[i],
              p = this.data.sculpt ? v.slice(0, 3) : deformBodyPoint(
                v
                  .slice(0, 3)
                  .map((x, k) => x + v[k + 3] * this.body.muscularity),
                v.slice(6),
                this.body.fitting,
              );
            for (let k = 0; k < 3; k++)
              positions[i * 3 + k] =
                p[k] * scale * (this.data.sculpt || k === 1 ? 1 : this.body.build);
          }
          map = await mapSurfaceInWorker(
            {
              positions,
              indices: new Uint32Array(
                this.body.model!.revision >= 5
                  ? [...this.charts.values()].flatMap(({ mesh }) =>
                      Array.from(
                        mesh.geometry.getAttribute("sourceIndex").array,
                      ),
                    )
                  : this.data.parts.flat(),
              ),
              seed: a.vertex,
              radius,
            },
            { signal: controller.signal },
          );
          if (controller.signal.aborted)
            throw new DOMException("Superseded surface map", "AbortError");
          this.cache.set(key, map);
          if (this.cache.size > 8)
            this.cache.delete(this.cache.keys().next().value!);
        }
        const pos: number[] = [],
          chartUv: number[] = [],
          chartZones: number[] = [],
          uv: number[] = [],
          colors: number[] = [],
          angle = (l.rotation * Math.PI) / 180,
          co = Math.cos(angle),
          si = Math.sin(angle);
        for (const [zone, { mesh }] of this.charts) {
          const p = mesh.geometry.getAttribute("position"),
            n = mesh.geometry.getAttribute("normal"),
            ids = mesh.geometry.getAttribute("sourceIndex");
          for (let i = 0; i < p.count; i += 3) {
            const local: [number, number][] = [],
              xyz: [number, number, number][] = [];
            let valid = true;
            for (let k = 0; k < 3; k++) {
              const id = ids.getX(i + k),
                u = map.coordinates[id * 2],
                v = map.coordinates[id * 2 + 1];
              if (!Number.isFinite(u) || !Number.isFinite(v)) {
                valid = false;
                break;
              }
              local.push([u, v]);
              xyz.push([p.getX(i + k), p.getY(i + k), p.getZ(i + k)]);
            }
            if (!valid) continue;
            const tex = local.map(([x, y]) => [
              0.5 + ((x * co - y * si) / l.width) * (l.flipX ? -1 : 1),
              0.5 +
                ((x * si + y * co) / (l.width * ratio)) * (l.flipY ? -1 : 1),
            ]);
            if (
              [0, 1].some(
                (k) =>
                  Math.max(...tex.map((t) => t[k])) < 0 ||
                  Math.min(...tex.map((t) => t[k])) > 1,
              )
            )
              continue;
            const d = triangleDistortion(xyz, local);
            if (d.folded) {
              if (l.id === inspectionLayer) stats.folded++;
              continue;
            }
            const err = Math.max(Math.abs(d.max - 1), Math.abs(d.min - 1)),
              heat = new THREE.Color(
                err > 0.25 ? "#d54338" : err > 0.1 ? "#e2a02f" : "#39a082",
              );
            if (l.id === inspectionLayer) {
              stats.triangles++;
              stats.maxStretch = Math.max(stats.maxStretch, d.max);
              stats.maxCompression = Math.min(stats.maxCompression, d.min);
              errors.push(err);
            }
            for (let k = 0; k < 3; k++) {
              pos.push(
                ...xyz[k].map((v, c) => v + n.getComponent(i + k, c) * 0.08),
              );
              uv.push(...tex[k]);
              const chart = mesh.geometry.getAttribute("uv");
              chartUv.push(chart.getX(i+k),chart.getY(i+k));
              chartZones.push(["trunk","left-arm","right-arm","left-leg","right-leg","neck"].indexOf(zone));
              colors.push(heat.r, heat.g, heat.b);
            }
          }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(pos, 3),
        );
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        geometry.setAttribute("chartUv",new THREE.Float32BufferAttribute(chartUv,2));
        geometry.setAttribute("chartZone",new THREE.Float32BufferAttribute(chartZones,1));
        geometry.setAttribute(
          "color",
          new THREE.Float32BufferAttribute(colors, 3),
        );
        const heat = l.id === inspectionLayer,
          texture = new THREE.CanvasTexture(image);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          vertexColors: heat,
          transparent: true,
          opacity: heat ? 0.88 : l.opacity,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1 - order * 0.1,
          polygonOffsetUnits: -1,
          side: THREE.DoubleSide,
          premultipliedAlpha: !heat && l.blend !== "source-over",
        });
        material.onBeforeCompile = (shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <map_fragment>",
            `#ifdef USE_MAP\nif(any(lessThan(vMapUv,vec2(0.0)))||any(greaterThan(vMapUv,vec2(1.0)))) discard;\n#endif\n${heat ? "" : "#include <map_fragment>"}`,
          );
        };
        material.customProgramCacheKey = () =>
          heat ? "surface-heat-v1" : "surface-ink-v1";
        if (!heat && l.blend !== "source-over") {
          material.blending = THREE.CustomBlending;
          material.blendSrc = THREE.DstColorFactor;
          material.blendDst = THREE.OneMinusSrcAlphaFactor;
        }
        const mesh = new THREE.Mesh(geometry, material);
        mesh.renderOrder = 10 + order;
        mesh.raycast = () => {};
        output.push(mesh);
      }
      if (controller.signal.aborted)
        throw new DOMException("Superseded surface map", "AbortError");
      this.clear();
      if (output.length) this.group.add(...output);
      errors.sort((a, b) => a - b);
      stats.p95Error = errors[Math.floor(errors.length * 0.95)] ?? 0;
      this.inspection = stats;
    } catch (e) {
      for (const m of output) {
        m.geometry.dispose();
        m.material.map?.dispose();
        m.material.dispose();
      }
      if ((e as Error).name !== "AbortError") throw e;
    }
  }
  dispose() {
    this.controller?.abort();
    this.clear();
    this.cache.clear();
  }
}
