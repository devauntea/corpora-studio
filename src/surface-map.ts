/** Independent implementation of the tangent-vector propagation described by
 * Schmidt, Grimm & Wyvill (2006), section 4.2. No reference implementation copied.
 * Coordinates/edge lengths are millimeters. Maps are local and can fold at large radii. */
export type SurfaceMapInput = {
  positions: Float32Array;
  indices: Uint32Array;
  seed: number;
  radius: number;
};
export type SurfaceMapResult = {
  coordinates: Float32Array;
  distance: Float32Array;
};
type V = [number, number, number];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V, s: number): V => [a[0] * s, a[1] * s, a[2] * s];
const norm = (v: V): V => mul(v, 1 / (Math.hypot(...v) || 1));
class Heap {
  a: [number, number][] = [];
  push(v: [number, number]) {
    let i = this.a.length;
    this.a.push(v);
    while (i) {
      const p = (i - 1) >> 1;
      if (this.a[p][0] <= v[0]) break;
      this.a[i] = this.a[p];
      i = p;
    }
    this.a[i] = v;
  }
  pop() {
    const first = this.a[0],
      v = this.a.pop()!;
    if (this.a.length) {
      let i = 0;
      while (i * 2 + 1 < this.a.length) {
        let c = i * 2 + 1;
        if (c + 1 < this.a.length && this.a[c + 1][0] < this.a[c][0]) c++;
        if (this.a[c][0] >= v[0]) break;
        this.a[i] = this.a[c];
        i = c;
      }
      this.a[i] = v;
    }
    return first;
  }
}
export function exponentialMap(
  input: SurfaceMapInput,
  progress: (n: number) => void = () => {},
): SurfaceMapResult {
  const { positions: p, indices, seed, radius } = input,
    n = p.length / 3;
  if (
    !Number.isInteger(n) ||
    n > 250000 ||
    indices.length > 1500000 ||
    indices.length % 3 ||
    seed < 0 ||
    seed >= n ||
    !Number.isInteger(seed) ||
    !Number.isFinite(radius) ||
    radius <= 0 ||
    radius > 1600 ||
    p.some((x) => !Number.isFinite(x))
  )
    throw new Error("Invalid or excessive surface-map input.");
  const point = (i: number): V => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]],
    ns = new Float32Array(p.length),
    adj = Array.from({ length: n }, () => new Set<number>());
  for (let k = 0; k < indices.length; k += 3) {
    const [a, b, c] = indices.subarray(k, k + 3);
    if (a >= n || b >= n || c >= n)
      throw new Error("Invalid surface topology.");
    const normal = cross(sub(point(b), point(a)), sub(point(c), point(a)));
    for (const i of [a, b, c])
      for (let j = 0; j < 3; j++) ns[i * 3 + j] += normal[j];
    adj[a].add(b).add(c);
    adj[b].add(a).add(c);
    adj[c].add(a).add(b);
  }
  const normal = (i: number): V =>
      norm([ns[i * 3], ns[i * 3 + 1], ns[i * 3 + 2]]),
    n0 = normal(seed),
    up: V = Math.abs(n0[1]) > 0.95 ? [0, 0, -1] : [0, 1, 0],
    y = norm(sub(up, mul(n0, dot(up, n0)))),
    x = cross(y, n0);
  const coordinates = new Float32Array(n * 2).fill(NaN),
    distance = new Float32Array(n).fill(Infinity),
    heap = new Heap();
  distance[seed] = 0;
  coordinates[seed * 2] = coordinates[seed * 2 + 1] = 0;
  heap.push([0, seed]);
  let count = 0;
  while (heap.a.length) {
    const [d, i] = heap.pop();
    if (d > distance[i] + 0.0001) continue;
    if (d > radius) break;
    if (++count > 180000)
      throw new Error("Surface map is too large. Reduce placement size.");
    const ni = normal(i),
      axis = cross(ni, n0),
      s = Math.hypot(...axis),
      co = Math.max(-1, Math.min(1, dot(ni, n0))),
      u = s > 1e-7 ? mul(axis, 1 / s) : x;
    for (const j of adj[i]) {
      const edge = sub(point(j), point(i)),
        length = Math.hypot(...edge),
        next = d + length;
      if (next >= distance[j] - 0.00001 || next > radius) continue;
      // Lift each short edge into its tangent plane, retaining its arc-length estimate.
      let v = mul(norm(sub(edge, mul(ni, dot(edge, ni)))), length);
      // Rotate directly into the seed tangent plane, avoiding accumulated frame rotations.
      if (s > 1e-7 || co < 0) {
        const c = cross(u, v),
          along = dot(u, v);
        v = [
          v[0] * co + c[0] * s + u[0] * along * (1 - co),
          v[1] * co + c[1] * s + u[1] * along * (1 - co),
          v[2] * co + c[2] * s + u[2] * along * (1 - co),
        ];
      }
      coordinates[j * 2] = coordinates[i * 2] + dot(v, x);
      coordinates[j * 2 + 1] = coordinates[i * 2 + 1] + dot(v, y);
      distance[j] = next;
      heap.push([next, j]);
    }
    if (count % 4096 === 0) progress(Math.min(0.95, count / n));
  }
  progress(1);
  return { coordinates, distance };
}
/** Singular values of the 2D-mm → 3D-mm triangle Jacobian; independent of camera/UV scale. */
export function triangleDistortion(
  p: readonly V[],
  q: readonly [number, number][],
) {
  const a = q[1][0] - q[0][0],
    b = q[2][0] - q[0][0],
    c = q[1][1] - q[0][1],
    d = q[2][1] - q[0][1],
    det = a * d - b * c;
  if (!Number.isFinite(det) || det <= 1e-8)
    return { min: 0, max: Infinity, ratio: Infinity, folded: true };
  const e = sub(p[1], p[0]),
    f = sub(p[2], p[0]),
    j1: V = e.map((v, k) => (v * d - f[k] * c) / det) as V,
    j2: V = e.map((v, k) => (f[k] * a - v * b) / det) as V;
  const aa = dot(j1, j1),
    bb = dot(j1, j2),
    dd = dot(j2, j2),
    delta = Math.hypot(aa - dd, 2 * bb),
    max = Math.sqrt(Math.max(0, (aa + dd + delta) / 2)),
    min = Math.sqrt(Math.max(0, (aa + dd - delta) / 2));
  return { min, max, ratio: max / Math.max(min, 1e-9), folded: false };
}
