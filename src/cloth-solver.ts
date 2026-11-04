import {
  BufferGeometry,
  Float32BufferAttribute,
  Vector3,
  Triangle,
} from "three";
import { MeshBVH } from "three-mesh-bvh";
import { ClothSchema, type ClothInput, type ClothResult } from "./cloth-model";
/** Own XPBD distance/sewing constraints, with second-neighbor bending resistance.
 * A bounded visual preview; no claim of calibrated textile mechanics or self-contact. */
export function simulateCloth(
  input: ClothInput,
  progress: (n: number) => void = () => {},
): ClothResult {
  const { mesh, bodyPositions, bodyIndices, gsm, floor } = input,
    c = ClothSchema.parse(input.config),
    n = mesh.positions.length / 3;
  if (
    n > 7000 ||
    !n ||
    mesh.positions.some((x) => !Number.isFinite(x)) ||
    bodyPositions.length > 3000000 ||
    bodyIndices.length > 1500000 ||
    gsm < 10 ||
    gsm > 1500
  )
    throw new Error("Cloth compute budget or inputs invalid.");
  const p = mesh.positions.slice(),
    old = p.slice(),
    velocity = new Float32Array(p.length),
    inverse = new Float32Array(n),
    edges = new Map<string, { a: number; b: number; opposite: number[] }>(),
    constraints: {
      a: number;
      b: number;
      rest: number;
      alpha: number;
      lambda: number;
      seam: boolean;
    }[] = [],
    dt = 1 / 120,
    steps = c.steps;
  const distance = (buffer: Float32Array, a: number, b: number) =>
    Math.hypot(
      buffer[a * 3] - buffer[b * 3],
      buffer[a * 3 + 1] - buffer[b * 3 + 1],
      buffer[a * 3 + 2] - buffer[b * 3 + 2],
    );
  for (let k = 0; k < mesh.indices.length; k += 3) {
    const ids = Array.from(mesh.indices.subarray(k, k + 3)),
      [a, b, d] = ids;
    const area =
      Math.abs(
        (mesh.rest[b * 3] - mesh.rest[a * 3]) *
          (mesh.rest[d * 3 + 1] - mesh.rest[a * 3 + 1]) -
          (mesh.rest[b * 3 + 1] - mesh.rest[a * 3 + 1]) *
            (mesh.rest[d * 3] - mesh.rest[a * 3]),
      ) / 2;
    for (const i of ids) inverse[i] += (area * gsm) / 3e9;
    for (let j = 0; j < 3; j++) {
      const a = ids[j],
        b = ids[(j + 1) % 3],
        id = Math.min(a, b) + ":" + Math.max(a, b),
        e = edges.get(id);
      if (e) e.opposite.push(ids[(j + 2) % 3]);
      else edges.set(id, { a, b, opposite: [ids[(j + 2) % 3]] });
    }
  }
  for (let i = 0; i < n; i++)
    inverse[i] = mesh.pins[i] ? 0 : 1 / Math.max(inverse[i], 1e-6);
  const add = (
    a: number,
    b: number,
    rest: number,
    compliance: number,
    seam = false,
  ) =>
    constraints.push({
      a,
      b,
      rest,
      alpha: compliance / (dt * dt),
      lambda: 0,
      seam,
    });
  for (const e of edges.values()) {
    add(
      e.a,
      e.b,
      distance(mesh.rest, e.a, e.b),
      Math.pow(10, -6 + c.stretch * 0.055),
    );
    if (e.opposite.length === 2)
      add(
        e.opposite[0],
        e.opposite[1],
        distance(mesh.rest, e.opposite[0], e.opposite[1]),
        Math.pow(10, -2 + c.bend * 0.05),
      );
  }
  for (let i = 0; i < mesh.stitches.length; i += 2)
    add(mesh.stitches[i], mesh.stitches[i + 1], 0, 0.000001, true);
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(bodyPositions, 3),
  );
  geometry.setIndex(Array.from(bodyIndices));
  const bvh = bodyIndices.length
      ? new MeshBVH(geometry, { maxLeafSize: 12 })
      : undefined,
    idx = geometry.index,
    point = new Vector3(),
    a = new Vector3(),
    b = new Vector3(),
    d = new Vector3(),
    normal = new Vector3(),
    target = { point: new Vector3(), distance: 0, faceIndex: 0 };
  let contacts = 0;
  for (let frame = 0; frame < steps; frame++) {
    old.set(p);
    for (let i = 0; i < n; i++) {
      if (!inverse[i]) continue;
      velocity[i * 3 + 1] -= 9810 * dt;
      for (let k = 0; k < 3; k++)
        p[i * 3 + k] += Math.max(-4, Math.min(4, velocity[i * 3 + k] * dt));
    }
    constraints.forEach((e) => (e.lambda = 0));
    for (let iteration = 0; iteration < 8; iteration++)
      for (const e of constraints) {
        const ai = e.a * 3,
          bi = e.b * 3,
          dx = p[ai] - p[bi],
          dy = p[ai + 1] - p[bi + 1],
          dz = p[ai + 2] - p[bi + 2],
          length = Math.hypot(dx, dy, dz);
        if (length < 1e-8) continue;
        const w = inverse[e.a] + inverse[e.b];
        if (!w) continue;
        const rest = e.seam
          ? distance(mesh.positions, e.a, e.b) *
            Math.max(0, 1 - (frame + 1) / Math.min(60, steps / 2))
          : e.rest;
        let delta = (-(length - rest) - e.alpha * e.lambda) / (w + e.alpha);
        const maxMove = Math.max(inverse[e.a], inverse[e.b]) * Math.abs(delta);
        if (!e.seam && maxMove > 8) delta *= 8 / maxMove;
        e.lambda += delta;
        const qa = (delta * inverse[e.a]) / length,
          qb = (delta * inverse[e.b]) / length;
        p[ai] += dx * qa;
        p[ai + 1] += dy * qa;
        p[ai + 2] += dz * qa;
        p[bi] -= dx * qb;
        p[bi + 1] -= dy * qb;
        p[bi + 2] -= dz * qb;
      }
    for (let i = 0; i < n; i++) {
      if (!inverse[i]) continue;
      point.fromArray(p, i * 3);
      if (bvh && idx) {
        const hit = bvh.closestPointToPoint(point, target, 0, 80);
        if (hit) {
          a.fromBufferAttribute(
            geometry.attributes.position,
            idx.getX(hit.faceIndex * 3),
          );
          b.fromBufferAttribute(
            geometry.attributes.position,
            idx.getX(hit.faceIndex * 3 + 1),
          );
          d.fromBufferAttribute(
            geometry.attributes.position,
            idx.getX(hit.faceIndex * 3 + 2),
          );
          Triangle.getNormal(a, b, d, normal);
          const signed = point.clone().sub(hit.point).dot(normal);
          if (signed < c.thickness) {
            point.addScaledVector(normal, Math.min(80, c.thickness - signed));
            contacts++;
          }
        }
      }
      point.y = Math.max(floor + c.thickness, point.y);
      point.toArray(p, i * 3);
      for (let k = 0; k < 3; k++) {
        velocity[i * 3 + k] =
          ((p[i * 3 + k] - old[i * 3 + k]) / dt) * (1 - c.damping);
        if (!Number.isFinite(p[i * 3 + k]) || Math.abs(p[i * 3 + k]) > 6000)
          throw new Error(
            "Cloth solve diverged. Check panel placement and stitch pairs.",
          );
      }
    }
    if (frame % 6 === 0) progress((frame + 1) / steps);
  }
  geometry.dispose();
  const strains = [...edges.values()]
    .map((e) =>
      Math.abs(
        distance(p, e.a, e.b) / Math.max(0.001, distance(mesh.rest, e.a, e.b)) -
          1,
      ),
    )
    .sort((a, b) => a - b);
  let seamGap = 0;
  for (let i = 0; i < mesh.stitches.length; i += 2)
    seamGap = Math.max(
      seamGap,
      distance(p, mesh.stitches[i], mesh.stitches[i + 1]),
    );
  progress(1);
  return {
    positions: p,
    maxEdgeStrain: strains.at(-1) ?? 0,
    p95EdgeStrain: strains[Math.floor(strains.length * 0.95)] ?? 0,
    seamGap,
    contacts,
    steps,
  };
}
