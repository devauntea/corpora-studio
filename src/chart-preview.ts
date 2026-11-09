import * as THREE from "three";
import type { StudioScene } from "./scene";
import type { SurfaceZone } from "./domain";

/** Render the actual chart and connected ink in UV space. A planning overview,
 * never a distortion-free or physically scaled cutting/transfer pattern. */
export function chartPreview(
  studio: StudioScene,
  zone: SurfaceZone,
): string | undefined {
  const surface = studio.human,
    chart = surface?.charts.get(zone);
  if (!surface || !chart) return;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("white");
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0.01, 10);
  camera.position.z = 2;
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: chart.texture }),
  );
  base.position.set(0.5, 0.5, -0.1);
  scene.add(base);
  const temporary: THREE.Mesh[] = [base];
  const zoneId = [
    "trunk",
    "left-arm",
    "right-arm",
    "left-leg",
    "right-leg",
    "neck",
  ].indexOf(zone);
  for (const child of surface.decals.group.children) {
    const source = child as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshBasicMaterial
    >;
    const chartUv = source.geometry.getAttribute("chartUv"),
      zones = source.geometry.getAttribute("chartZone"),
      uv = source.geometry.getAttribute("uv");
    if (!chartUv || !zones) continue;
    const positions: number[] = [],
      tex: number[] = [];
    for (let i = 0; i < uv.count; i += 3) {
      if (zones.getX(i) !== zoneId) continue;
      for (const shift of [-1, 0, 1]) {
        const xs = [0, 1, 2].map((k) => chartUv.getX(i + k) + shift);
        if (Math.max(...xs) < 0 || Math.min(...xs) > 1) continue;
        for (let k = 0; k < 3; k++) {
          positions.push(xs[k], chartUv.getY(i + k), 0);
          tex.push(uv.getX(i + k), uv.getY(i + k));
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(tex, 2));
    const material = source.material.clone();
    material.depthTest = false;
    material.depthWrite = false;
    material.vertexColors = false;
    material.onBeforeCompile = source.material.onBeforeCompile;
    material.customProgramCacheKey = source.material.customProgramCacheKey;
    const mesh = new THREE.Mesh(g, material);
    mesh.renderOrder = source.renderOrder;
    scene.add(mesh);
    temporary.push(mesh);
  }
  const target = new THREE.WebGLRenderTarget(768, 1024);
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const oldTarget = studio.renderer.getRenderTarget();
  try {
    studio.renderer.setRenderTarget(target);
    studio.renderer.render(scene, camera);
    const pixels = new Uint8Array(768 * 1024 * 4);
    studio.renderer.readRenderTargetPixels(target, 0, 0, 768, 1024, pixels);
    const c = document.createElement("canvas");
    c.width = 768;
    c.height = 1024;
    const ctx = c.getContext("2d")!,
      data = ctx.createImageData(c.width, c.height);
    for (let y = 0; y < 1024; y++)
      data.data.set(
        pixels.subarray((1023 - y) * 768 * 4, (1024 - y) * 768 * 4),
        y * 768 * 4,
      );
    ctx.putImageData(data, 0, 0);
    return c.toDataURL("image/png");
  } finally {
    studio.renderer.setRenderTarget(oldTarget);
    target.dispose();
    temporary.forEach((m) => {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    });
    studio.needsRender = true;
  }
}
