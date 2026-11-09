import * as THREE from "three";
import type { HumanSurface } from "./anatomy";
import { humanChartSize, type HumanBody, type SurfaceZone } from "./domain";
import type { StudyGuide } from "./tattoo-study";

// Geometry-keyed UV bins keep bands responsive even with many visible guides.
const uvBins = new WeakMap<THREE.BufferGeometry, number[][]>();
const cells = 64;
const wrap = (x: number) => ((x % 1) + 1) % 1;
export function chartPoint(
  surface: HumanSurface,
  zone: SurfaceZone,
  u: number,
  v: number,
) {
  const geometry = surface.charts.get(zone)?.mesh.geometry;
  if (!geometry) return;
  const uv = geometry.getAttribute("uv"),
    p = geometry.getAttribute("position"),
    n = geometry.getAttribute("normal");
  if (!uv.count) return;
  let bins = uvBins.get(geometry);
  if (!bins) {
    bins = Array.from({ length: cells * cells }, () => []);
    for (let i = 0; i < uv.count; i++)
      bins[
        Math.min(cells - 1, Math.max(0, Math.floor(uv.getY(i) * cells))) *
          cells +
          Math.floor(wrap(uv.getX(i)) * cells)
      ].push(i);
    uvBins.set(geometry, bins);
  }
  u = wrap(u);
  const cx = Math.floor(u * cells),
    cy = Math.min(cells - 1, Math.max(0, Math.floor(v * cells)));
  let nearest = 0,
    distance = Infinity;
  for (let radius = 0; radius <= cells; radius++) {
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        if (radius && Math.abs(dx) !== radius && Math.abs(dy) !== radius)
          continue;
        const y = cy + dy;
        if (y < 0 || y >= cells) continue;
        const x = (((cx + dx) % cells) + cells) % cells;
        for (const i of bins[y * cells + x]) {
          const delta = Math.abs(wrap(uv.getX(i)) - u),
            du = Math.min(delta, 1 - delta),
            d = du * du + (uv.getY(i) - v) ** 2;
          if (d < distance) {
            distance = d;
            nearest = i;
          }
        }
      }
    if (distance <= (radius / cells) ** 2) break;
  }
  return new THREE.Vector3()
    .fromBufferAttribute(p, nearest)
    .addScaledVector(new THREE.Vector3().fromBufferAttribute(n, nearest), 0.5);
}
export class PlanningGuides {
  group = new THREE.Group();
  clear() {
    for (const child of [...this.group.children]) {
      const m = child as THREE.Mesh;
      m.geometry?.dispose();
      if (Array.isArray(m.material)) m.material.forEach((v) => v.dispose());
      else m.material?.dispose();
      this.group.remove(child);
    }
  }
  update(surface: HumanSurface, body: HumanBody, guides: StudyGuide[]) {
    this.clear();
    for (const guide of guides.filter((g) => g.visible)) {
      if (guide.kind === "band") {
        const half = guide.width / humanChartSize(body, guide.zone).height / 2;
        for (const v of [guide.v - half, guide.v + half]) {
          if (v < 0 || v > 1) continue;
          const points = Array.from({ length: 97 }, (_, i) =>
            chartPoint(surface, guide.zone, i / 96, v),
          ).filter((p): p is THREE.Vector3 => !!p);
          const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineDashedMaterial({
              color: "#ffe4a1",
              dashSize: 3,
              gapSize: 2,
              depthWrite: false,
            }),
          );
          line.computeLineDistances();
          line.raycast = () => {};
          this.group.add(line);
        }
      } else {
        const p = chartPoint(surface, guide.zone, guide.u, guide.v);
        if (!p) continue;
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(guide.kind === "focal" ? 3 : 1.8, 12, 8),
          new THREE.MeshBasicMaterial({
            color: guide.kind === "focal" ? "#ffe4a1" : "#ffffff",
            depthWrite: false,
          }),
        );
        marker.position.copy(p);
        marker.raycast = () => {};
        this.group.add(marker);
      }
    }
  }
}
