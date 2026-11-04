import { z } from "zod";
export type Vec = [number, number];
export type Quad = [Vec, Vec, Vec, Vec];
export const defaultQuad = (): Quad => [
  [-0.5, -0.5],
  [0.5, -0.5],
  [0.5, 0.5],
  [-0.5, 0.5],
];
export function validQuad(q: Quad) {
  if (q.some((p) => p.some((v) => !Number.isFinite(v)))) return false;
  for (let i = 0; i < 4; i++) {
    const a = q[i],
      b = q[(i + 1) % 4],
      c = q[(i + 2) % 4];
    if (
      (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) < 0.015 ||
      Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.05
    )
      return false;
  }
  return true;
}
const point = z.tuple([
  z.number().finite().min(-1.5).max(1.5),
  z.number().finite().min(-1.5).max(1.5),
]);
export const QuadSchema = z
  .tuple([point, point, point, point])
  .refine(
    validQuad,
    "Warp corners must form a convex boundary without foldover",
  );
export function homography(q: Quad): number[] {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1[0] - p2[0],
    dx2 = p3[0] - p2[0],
    dx3 = p0[0] - p1[0] + p2[0] - p3[0];
  const dy1 = p1[1] - p2[1],
    dy2 = p3[1] - p2[1],
    dy3 = p0[1] - p1[1] + p2[1] - p3[1];
  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < 1e-12) throw new Error("Degenerate warp");
  const g = (dx3 * dy2 - dx2 * dy3) / det,
    h = (dx1 * dy3 - dx3 * dy1) / det;
  return [
    p1[0] - p0[0] + g * p1[0],
    p3[0] - p0[0] + h * p3[0],
    p0[0],
    p1[1] - p0[1] + g * p1[1],
    p3[1] - p0[1] + h * p3[1],
    p0[1],
    g,
    h,
    1,
  ];
}
export function inverse(m: number[]): number[] {
  const [a, b, c, d, e, f, g, h, i] = m;
  const cof = [
    e * i - f * h,
    c * h - b * i,
    b * f - c * e,
    f * g - d * i,
    a * i - c * g,
    c * d - a * f,
    d * h - e * g,
    b * g - a * h,
    a * e - b * d,
  ];
  const det = a * cof[0] + b * cof[3] + c * cof[6];
  if (Math.abs(det) < 1e-12) throw new Error("Singular warp");
  return cof.map((v) => v / det);
}
export function projectPoint(m: number[], u: number, v: number): Vec {
  const d = m[6] * u + m[7] * v + m[8];
  return [(m[0] * u + m[1] * v + m[2]) / d, (m[3] * u + m[4] * v + m[5]) / d];
}
export function insideQuad(point: Vec, q: Quad) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i],
      b = q[(i + 1) % 4],
      cross =
        (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]);
    if (Math.abs(cross) < 1e-8) continue;
    const s = Math.sign(cross);
    if (sign && s !== sign) return false;
    sign = s;
  }
  return true;
}
const pixels = new WeakMap<HTMLCanvasElement, ImageData>();
/** Inverse mapping avoids gaps between triangles. Bilinear samples interpolate
 * premultiplied alpha, preserving transparent artwork edges without dark halos. */
export function drawWarp(
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  q: Quad,
) {
  const inv = inverse(homography(q));
  const x0 = Math.max(0, Math.floor(Math.min(...q.map((p) => p[0])))),
    y0 = Math.max(0, Math.floor(Math.min(...q.map((p) => p[1]))));
  const x1 = Math.min(
      ctx.canvas.width,
      Math.ceil(Math.max(...q.map((p) => p[0]))),
    ),
    y1 = Math.min(
      ctx.canvas.height,
      Math.ceil(Math.max(...q.map((p) => p[1]))),
    );
  const w = x1 - x0,
    h = y1 - y0;
  if (w <= 0 || h <= 0) return;
  let source = pixels.get(image);
  if (!source) {
    source = image
      .getContext("2d")!
      .getImageData(0, 0, image.width, image.height);
    pixels.set(image, source);
  }
  const output = ctx.createImageData(w, h),
    s = source.data,
    d = output.data,
    sw = image.width,
    sh = image.height;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const px = x + x0 + 0.5,
        py = y + y0 + 0.5,
        den = inv[6] * px + inv[7] * py + inv[8];
      const u = (inv[0] * px + inv[1] * py + inv[2]) / den,
        v = (inv[3] * px + inv[4] * py + inv[5]) / den;
      if (u < 0 || v < 0 || u > 1 || v > 1) continue;
      const sx = Math.max(0, Math.min(sw - 1, u * sw - 0.5)),
        sy = Math.max(0, Math.min(sh - 1, v * sh - 0.5)),
        ix = Math.floor(sx),
        iy = Math.floor(sy),
        fx = sx - ix,
        fy = sy - iy;
      let a = 0,
        r = 0,
        g = 0,
        b = 0;
      for (let j = 0; j < 4; j++) {
        const right = j % 2,
          bottom = j > 1;
        const k =
            (Math.min(iy + Number(bottom), sh - 1) * sw +
              Math.min(ix + right, sw - 1)) *
            4,
          alpha = s[k + 3] * (right ? fx : 1 - fx) * (bottom ? fy : 1 - fy);
        a += alpha;
        r += s[k] * alpha;
        g += s[k + 1] * alpha;
        b += s[k + 2] * alpha;
      }
      const k = (y * w + x) * 4;
      if (a) {
        d[k] = r / a;
        d[k + 1] = g / a;
        d[k + 2] = b / a;
        d[k + 3] = a;
      }
    }
  ctx.putImageData(output, x0, y0);
}
