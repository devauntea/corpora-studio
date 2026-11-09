import { describe, expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const load = async (revision: number, sex: string) => {
  const meta = JSON.parse(
    await readFile(`public/anatomy/human-v${revision}-${sex}.json`, "utf8"),
  );
  const raw = await readFile(`public/anatomy/${meta.buffer}`);
  const buffer = raw.buffer.slice(
    raw.byteOffset,
    raw.byteOffset + raw.byteLength,
  );
  return {
    meta,
    raw,
    data: new Float32Array(buffer, 0, meta.vertexCount * 12),
    indices: new Uint32Array(buffer, meta.vertexCount * 48),
  };
};

describe("body revision 9 muscle surfaces", () => {
  for (const sex of ["male", "female"]) {
    test(`${sex}: new sculpt keeps all anchor, rim, rig and muscle identities`, async () => {
      const old = await load(8, sex),
        next = await load(9, sex),
        n = next.meta.vertexCount;
      expect(hash(next.raw)).toBe(next.meta.sha256);
      expect(next.meta.parent).toBe(`human-v8-${sex}`);
      expect(next.meta.vertexCount).toBe(old.meta.vertexCount);
      expect(next.meta.partCounts).toEqual(old.meta.partCounts);
      expect(next.meta.rig).toBe(old.meta.rig);
      expect(next.meta.centersOfRotation).toEqual(old.meta.centersOfRotation);
      expect(next.meta.joints).toEqual(old.meta.joints);
      expect(next.raw.subarray(n * 48).equals(old.raw.subarray(n * 48))).toBe(
        true,
      );

      let finite = true,
        exactRig = true,
        exactChest = true,
        chestVertices = 0;
      let changed = 0,
        maxFit = 0,
        maxAverage = 0;
      for (let i = 0; i < n; i++) {
        const at = i * 12;
        for (let k = 0; k < 12; k++)
          finite &&= Number.isFinite(next.data[at + k]);
        for (let k = 6; k < 12; k++)
          exactRig &&= next.data[at + k] === old.data[at + k];
        const fit = [0, 1, 2].map(
          (k) =>
            next.data[at + k] +
            next.data[at + k + 3] -
            old.data[at + k] -
            old.data[at + k + 3],
        );
        const average = [0, 1, 2].map(
          (k) => next.data[at + k] - old.data[at + k],
        );
        maxFit = Math.max(maxFit, Math.hypot(...fit));
        maxAverage = Math.max(maxAverage, Math.hypot(...average));
        if (Math.hypot(...fit) > 0.001) changed++;
        const x = old.data[at] + old.data[at + 3],
          y = old.data[at + 1] + old.data[at + 4],
          z = old.data[at + 2] + old.data[at + 5];
        if (
          Math.abs(x) < 1.2 &&
          y > 4.1 &&
          y < 6.1 &&
          z > 0.4 &&
          Math.max(old.data[at + 6], old.data[at + 9]) < 0.02
        ) {
          chestVertices++;
          for (let k = 0; k < 6; k++)
            exactChest &&= next.data[at + k] === old.data[at + k];
        }
      }
      expect(finite).toBe(true);
      expect(exactRig).toBe(true);
      expect(chestVertices).toBeGreaterThan(100);
      expect(exactChest).toBe(true);
      expect(changed).toBeGreaterThan(15000);
      expect(maxFit).toBeLessThan(sex === "male" ? 0.11 : 0.065);
      expect(maxAverage).toBeLessThan(0.025);
      expect(maxAverage).toBeLessThan(maxFit * 0.4);

      // Even rims that exist only in isolated library sections must retain
      // their exact bytes, or switching section can expose a crack.
      const rim = new Set<number>();
      let off = 0;
      for (const count of next.meta.partCounts as number[]) {
        const edges = new Map<number, number>();
        for (let j = off; j < off + count; j += 3) {
          for (let k = 0; k < 3; k++) {
            const a = next.indices[j + k],
              b = next.indices[j + ((k + 1) % 3)];
            const key = Math.min(a, b) * n + Math.max(a, b);
            edges.set(key, (edges.get(key) || 0) + 1);
          }
        }
        for (const [key, count] of edges)
          if (count === 1) {
            rim.add(Math.floor(key / n));
            rim.add(key % n);
          }
        off += count;
      }
      expect(rim.size).toBeGreaterThan(1700);
      let exactRims = true;
      for (const i of rim)
        for (let k = 0; k < 12; k++)
          exactRims &&= next.data[i * 12 + k] === old.data[i * 12 + k];
      expect(exactRims).toBe(true);

      const field = await readFile(`public/anatomy/muscle-field-v9-${sex}.bin`);
      const oldField = await readFile(
        `public/anatomy/muscle-field-v8-${sex}.bin`,
      );
      const fm = JSON.parse(
        await readFile(`public/anatomy/muscle-field-v9-${sex}.json`, "utf8"),
      );
      expect(field.equals(oldField)).toBe(true);
      expect(hash(field)).toBe(fm.sha256);
      const ao = await readFile(`public/anatomy/${next.meta.occlusion.buffer}`);
      expect(ao.length).toBe(n * 2);
      expect(hash(ao)).toBe(next.meta.occlusion.sha256);
      expect(next.meta.occlusion.buffer).toBe(`skin-occlusion-v9-${sex}.bin`);
    }, 30000);
  }
});
