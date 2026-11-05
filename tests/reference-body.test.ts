import { expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  blankProject,
  humanBody,
  parseProject,
  bodyZones,
} from "../src/domain";
import { humanGeometries, type HumanMeshData } from "../src/anatomy";
import { flexTorso } from "../src/muscle-pose";

async function asset(sex: string) {
  const base = new URL("../public/anatomy/", import.meta.url);
  const meta = JSON.parse(
    await readFile(new URL(`human-v5-${sex}.json`, base), "utf8"),
  );
  const blob = await readFile(new URL(meta.buffer, base));
  const buffer = blob.buffer.slice(
    blob.byteOffset,
    blob.byteOffset + blob.byteLength,
  );
  const values = new Float32Array(buffer, 0, meta.vertexCount * 12);
  const indices = new Uint32Array(buffer, meta.vertexCount * 48);
  let offset = 0;
  const field = new Uint8Array(
    await readFile(new URL(`muscle-field-v5-${sex}.bin`, base)),
  );
  const fieldMeta = JSON.parse(
    await readFile(new URL(`muscle-field-v5-${sex}.json`, base), "utf8"),
  );
  const parts = meta.partCounts.map((n: number) => {
    const p = Array.from(indices.subarray(offset, offset + n));
    offset += n;
    return p;
  });
  const occlusion = await readFile(new URL(meta.occlusion.buffer, base));
  const data: HumanMeshData = {
    vertices: Array.from({ length: meta.vertexCount }, (_, i) =>
      Array.from(values.subarray(i * 12, i * 12 + 12)),
    ),
    parts: parts.slice(0, 6),
    sectionLegs: parts.slice(6, 8),
    sectionTorso: parts[8],
    skinOcclusion: new Uint8Array(occlusion),
    joints: meta.joints,
    detailLandmarks: meta.detailLandmarks,
    muscleColors: field.subarray(0, meta.vertexCount * 3),
    muscleIds: field.subarray(meta.vertexCount * 3, meta.vertexCount * 4),
    muscleInfluences: field.subarray(meta.vertexCount * 4),
  };
  expect(offset).toBe(indices.length);
  expect(createHash("sha256").update(blob).digest("hex")).toBe(meta.sha256);
  expect(createHash("sha256").update(field).digest("hex")).toBe(
    fieldMeta.sha256,
  );
  expect(field.length).toBe(meta.vertexCount * 12);
  expect(fieldMeta.vertexCount).toBe(meta.vertexCount);
  expect(createHash("sha256").update(occlusion).digest("hex")).toBe(
    meta.occlusion.sha256,
  );
  expect(occlusion.length).toBe(meta.vertexCount * 2);
  expect(new Set(occlusion).size).toBeGreaterThan(100);
  return data;
}

test("version 9 preserves its original surface and rejects a forged revision 5", async () => {
  const body = humanBody("upper-body");
  body.model!.revision = 3;
  const old = { ...blankProject(), version: 9, body };
  const next = await parseProject(JSON.stringify(old));
  expect(next).toEqual({ ...old, version: 10 });
  body.model!.revision = 5;
  await expect(parseProject(JSON.stringify(old))).rejects.toThrow("version 9");
  expect(
    await parseProject(JSON.stringify({ ...old, version: 10 })),
  ).toMatchObject({ body });
});

for (const sex of ["male", "female"] as const) {
  test(`${sex} flex correctives change chest/back volume without inverted faces at full tension`, async () => {
    const data = await asset(sex);
    const indices = data.parts.flat();
    const body = humanBody("full-body");
    body.model!.sex = sex;
    const cross = (a: number[], b: number[], c: number[]) => {
      const u = b.map((x, k) => x - a[k]),
        v = c.map((x, k) => x - a[k]);
      return [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ];
    };
    for (const muscularity of [0, 1]) {
      const rest = data.vertices.map((v) =>
        v.slice(0, 3).map((x, k) => x + muscularity * v[k + 3]),
      );
      for (const musclePose of [
        "chest-flex",
        "back-flex",
        "double-biceps",
      ] as const) {
        const posed = rest.map((p, i) =>
          flexTorso(p, data.vertices[i].slice(6), {
            ...body,
            muscularity,
            musclePose,
            muscleTension: 1,
          }),
        );
        let inverted = 0,
          moved = 0;
        for (let i = 0; i < rest.length; i++)
          if (Math.hypot(...posed[i].map((x, k) => x - rest[i][k])) > 0.001)
            moved++;
        for (let i = 0; i < indices.length; i += 3) {
          const [a, b, c] = indices.slice(i, i + 3),
            n = cross(rest[a], rest[b], rest[c]),
            m = cross(posed[a], posed[b], posed[c]);
          if (
            Math.hypot(...n) > 1e-9 &&
            n.reduce((sum, x, k) => sum + x * m[k], 0) <= 0
          )
            inverted++;
        }
        expect(inverted).toBe(0);
        expect(moved).toBeGreaterThan(2000);
        expect(
          flexTorso(rest[0], data.vertices[0].slice(6), {
            ...body,
            musclePose,
            muscleTension: 0,
          }),
        ).toEqual(rest[0]);
      }
    }
    const project = {
      ...blankProject(),
      body: { ...body, musclePose: "back-flex", muscleTension: 0.85 },
    };
    expect(await parseProject(JSON.stringify(project))).toEqual(project);
  }, 60_000);
  test(`${sex} torso ends at four closed rims and ignores hidden arm poses`, async () => {
    const data = await asset(sex);
    const indices = [...data.sectionTorso!, ...data.parts[5]];
    const edges = new Map<string, { a: number; b: number; n: number }>();
    for (let i = 0; i < indices.length; i += 3)
      for (let k = 0; k < 3; k++) {
        const a = indices[i + k],
          b = indices[i + ((k + 1) % 3)];
        const key = [a, b].sort((a, b) => a - b).join(":");
        const edge = edges.get(key);
        if (edge) edge.n++;
        else edges.set(key, { a, b, n: 1 });
      }
    const neighbors = new Map<number, number[]>();
    for (const edge of edges.values()) {
      expect(edge.n).toBeLessThanOrEqual(2);
      if (edge.n !== 1) continue;
      for (const [a, b] of [
        [edge.a, edge.b],
        [edge.b, edge.a],
      ])
        neighbors.set(a, [...(neighbors.get(a) || []), b]);
    }
    for (const adjacent of neighbors.values()) expect(adjacent.length).toBe(2);
    const visited = new Set<number>();
    let loops = 0;
    for (const start of neighbors.keys()) {
      if (visited.has(start)) continue;
      loops++;
      const pending = [start];
      while (pending.length) {
        const index = pending.pop()!;
        if (visited.has(index)) continue;
        visited.add(index);
        pending.push(...neighbors.get(index)!);
      }
    }
    expect(loops).toBe(4); // Neck, waist, left shoulder, right shoulder.
    for (const index of new Set(indices)) {
      const p = data.vertices[index];
      for (const side of ["L", "R"] as const) {
        const wrist = data.joints[side].wrist;
        expect(
          Math.hypot(p[0] - wrist[0], p[1] - wrist[1], p[2] - wrist[2]),
        ).toBeGreaterThan(2);
      }
    }
    const body = humanBody("upper-body");
    body.model!.sex = sex;
    const a = humanGeometries(data, body);
    const b = humanGeometries(data, {
      ...body,
      armPose: {
        left: { flex: 110, raise: 120, twist: 90 },
        right: { flex: 90, raise: 90, twist: -90 },
      },
    });
    expect(a.map((chart) => chart.zone)).toEqual(["trunk", "neck"]);
    for (let i = 0; i < a.length; i++) {
      expect(
        Buffer.from(a[i].geometry.getAttribute("position").array.buffer).equals(
          Buffer.from(b[i].geometry.getAttribute("position").array.buffer),
        ),
      ).toBe(true);
      a[i].geometry.dispose();
      b[i].geometry.dispose();
    }
  }, 60_000);
  test(`${sex} isolated legs have one continuous proximal rim and no stray boundary`, async () => {
    const data = await asset(sex);
    for (const part of data.sectionLegs!) {
      const edges = new Map<string, { a: number; b: number; count: number }>();
      for (let i = 0; i < part.length; i += 3) {
        for (let k = 0; k < 3; k++) {
          const a = part[i + k],
            b = part[i + ((k + 1) % 3)];
          const key = [a, b].sort((a, b) => a - b).join(":");
          const edge = edges.get(key);
          if (edge) edge.count++;
          else edges.set(key, { a, b, count: 1 });
        }
      }
      const neighbors = new Map<number, number[]>();
      for (const edge of edges.values()) {
        expect(edge.count).toBeLessThanOrEqual(2);
        if (edge.count !== 1) continue;
        for (const [a, b] of [
          [edge.a, edge.b],
          [edge.b, edge.a],
        ])
          neighbors.set(a, [...(neighbors.get(a) || []), b]);
      }
      expect(neighbors.size).toBeGreaterThan(100);
      for (const [index, adjacent] of neighbors) {
        expect(adjacent.length).toBe(2);
        // Both builds keep the boundary above the knee, at the proximal thigh.
        const vertex = data.vertices[index];
        expect(vertex[1]).toBeGreaterThan(-1.3);
        expect(vertex[1] + vertex[4]).toBeGreaterThan(-1.3);
      }
      const visited = new Set<number>();
      const pending = [neighbors.keys().next().value!];
      while (pending.length) {
        const vertex = pending.pop()!;
        if (visited.has(vertex)) continue;
        visited.add(vertex);
        pending.push(...neighbors.get(vertex)!);
      }
      expect(visited.size).toBe(neighbors.size);
    }
  }, 60_000);
  test(`${sex} neck and waist rings are planar, continuous, and retain categorical anatomy through pose`, async () => {
    const data = await asset(sex);
    const edges = new Map<string, { a: number; b: number; n: number }>();
    for (const part of [
      data.parts[0],
      data.parts[1],
      data.parts[2],
      data.parts[5],
    ]) {
      for (let i = 0; i < part.length; i += 3)
        for (let k = 0; k < 3; k++) {
          const a = part[i + k],
            b = part[i + ((k + 1) % 3)],
            id = a < b ? `${a}:${b}` : `${b}:${a}`;
          const edge = edges.get(id);
          if (edge) edge.n++;
          else edges.set(id, { a, b, n: 1 });
        }
    }
    const boundary = [...edges.values()].filter((e) => e.n === 1);
    expect(boundary.length).toBeGreaterThan(100);
    for (const e of boundary) {
      const a = data.vertices[e.a],
        b = data.vertices[e.b];
      expect(
        [0.6, 7].some(
          (y) => Math.abs(a[1] - y) < 1e-5 && Math.abs(b[1] - y) < 1e-5,
        ),
      ).toBe(true);
      expect(Math.abs(a[4])).toBeLessThan(1e-6);
      expect(Math.abs(b[4])).toBeLessThan(1e-6);
    }
    const body = humanBody("upper-body");
    body.model!.sex = sex;
    expect(bodyZones(body)).toEqual(["trunk", "neck"]);
    const a = humanGeometries(data, body);
    const b = humanGeometries(data, {
      ...body,
      muscularity: 0,
      anatomy: true,
      musclePose: "back-flex",
      muscleTension: 1,
      armPose: {
        left: { flex: 110, raise: 90, twist: 60 },
        right: { flex: 0, raise: 0, twist: 0 },
      },
    });
    for (let i = 0; i < a.length; i++) {
      for (const attr of Object.values(b[i].geometry.attributes))
        expect(Array.from(attr.array).every(Number.isFinite)).toBe(true);
      for (const key of [
        "uv",
        "musclePalette",
        "muscleWeights",
        "sourceIndex",
      ]) {
        const left = a[i].geometry.getAttribute(key).array,
          right = b[i].geometry.getAttribute(key).array;
        expect(Buffer.from(left.buffer).equals(Buffer.from(right.buffer))).toBe(
          true,
        );
      }
      expect(
        Buffer.from(a[i].geometry.attributes.position.array.buffer).equals(
          Buffer.from(b[i].geometry.attributes.position.array.buffer),
        ),
      ).toBe(false);
      a[i].geometry.dispose();
      b[i].geometry.dispose();
    }
  }, 60_000);
}
