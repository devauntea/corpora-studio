import { z } from "zod";
import {
  homography,
  projectPoint,
  defaultQuad,
  type Quad,
  type Vec,
} from "./photo-warp";
export type Lattice = Vec[];
export const latticeTriangles = () =>
  Array.from({ length: 4 }, (_, k) => {
    const r = Math.floor(k / 2),
      c = k % 2,
      a = r * 3 + c;
    return [
      [a, a + 1, a + 4],
      [a, a + 4, a + 3],
    ];
  }).flat();
const cross = (a: Vec, b: Vec, c: Vec) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
export function validLattice(q: Lattice) {
  if (
    q.length !== 9 ||
    q.some(
      (p) =>
        p.length !== 2 ||
        p.some((v) => !Number.isFinite(v) || Math.abs(v) > 1.5),
    )
  )
    return false;
  const triangles = latticeTriangles();
  if (triangles.some(([a, b, c]) => cross(q[a], q[b], q[c]) < 0.004))
    return false;
  const edges = triangles.flatMap(([a, b, c]) => [
    [a, b],
    [b, c],
    [c, a],
  ]);
  for (let i = 0; i < edges.length; i++)
    for (let j = i + 1; j < edges.length; j++) {
      const [a, b] = edges[i],
        [c, d] = edges[j];
      if (a === c || a === d || b === c || b === d) continue;
      if (
        cross(q[a], q[b], q[c]) * cross(q[a], q[b], q[d]) < 0 &&
        cross(q[c], q[d], q[a]) * cross(q[c], q[d], q[b]) < 0
      )
        return false;
    }
  return true;
}
export const LatticeSchema = z
  .array(
    z.tuple([
      z.number().finite().min(-1.5).max(1.5),
      z.number().finite().min(-1.5).max(1.5),
    ]),
  )
  .length(9)
  .refine(validLattice, "Lattice cells must not fold or overlap");
export function makeLattice(q: Quad = defaultQuad()): Lattice {
  const h = homography(q);
  return Array.from({ length: 9 }, (_, i) =>
    projectPoint(h, (i % 3) / 2, Math.floor(i / 3) / 2),
  );
}
export function drawLattice(
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  target: Lattice,
) {
  for (const indices of latticeTriangles()) {
    const src = indices.map(
        (i) =>
          [
            ((i % 3) / 2) * image.width,
            (Math.floor(i / 3) / 2) * image.height,
          ] as Vec,
      ),
      dst = indices.map((i) => target[i]);
    const [a, b, c] = src,
      [p, q, r] = dst,
      det = cross(a, b, c);
    if (Math.abs(det) < 1e-8) continue;
    const m11 =
        ((q[0] - p[0]) * (c[1] - a[1]) - (r[0] - p[0]) * (b[1] - a[1])) / det,
      m12 =
        ((q[1] - p[1]) * (c[1] - a[1]) - (r[1] - p[1]) * (b[1] - a[1])) / det;
    const m21 =
        ((r[0] - p[0]) * (b[0] - a[0]) - (q[0] - p[0]) * (c[0] - a[0])) / det,
      m22 =
        ((r[1] - p[1]) * (b[0] - a[0]) - (q[1] - p[1]) * (c[0] - a[0])) / det;
    ctx.save();
    ctx.beginPath();
    dst.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.clip();
    ctx.setTransform(
      m11,
      m12,
      m21,
      m22,
      p[0] - m11 * a[0] - m21 * a[1],
      p[1] - m12 * a[0] - m22 * a[1],
    );
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  }
}
