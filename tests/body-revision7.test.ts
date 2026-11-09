import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const dir = "public/anatomy";
const load = async (revision: number, sex: string) => {
  const meta = JSON.parse(await readFile(`${dir}/human-v${revision}-${sex}.json`, "utf8"));
  const bytes = await readFile(`${dir}/${meta.buffer}`);
  return { meta, bytes };
};

describe("body revision 7", () => {
  for (const sex of ["male", "female"] as const) {
    test(`${sex}: same topology, rig, charts and atlas as revision 6; bounded relief`, async () => {
      const v6 = await load(6, sex);
      const v7 = await load(7, sex);
      const n = v7.meta.vertexCount;
      expect(n).toBe(v6.meta.vertexCount);
      expect(v7.meta.partCounts).toEqual(v6.meta.partCounts);
      expect(v7.meta.rig).toBe(v6.meta.rig);
      expect(v7.meta.joints).toEqual(v6.meta.joints);
      expect(createHash("sha256").update(v7.bytes).digest("hex")).toBe(v7.meta.sha256);
      // Index buffer is byte-identical, so vertex/barycentric anchors keep their meaning.
      expect(Buffer.compare(v7.bytes.subarray(n * 48), v6.bytes.subarray(n * 48))).toBe(0);
      const a = new Float32Array(v6.bytes.buffer.slice(v6.bytes.byteOffset, v6.bytes.byteOffset + n * 48));
      const b = new Float32Array(v7.bytes.buffer.slice(v7.bytes.byteOffset, v7.bytes.byteOffset + n * 48));
      let maxMove = 0;
      for (let i = 0; i < n; i++) {
        // Rig/cut channels 6-11 are unchanged; only rest position and fit delta move.
        for (let c = 6; c < 12; c++) expect(b[i * 12 + c]).toBe(a[i * 12 + c]);
        for (const t of [0, 1]) {
          let d = 0;
          for (let c = 0; c < 3; c++) {
            const pa = a[i * 12 + c] + t * a[i * 12 + 3 + c];
            const pb = b[i * 12 + c] + t * b[i * 12 + 3 + c];
            d += (pa - pb) ** 2;
          }
          maxMove = Math.max(maxMove, Math.sqrt(d));
        }
      }
      // Decimetres: relief is a few millimetres, never a reshaping of the body.
      expect(maxMove).toBeGreaterThan(0.01);
      expect(maxMove).toBeLessThan(0.035);
      const field6 = await readFile(`${dir}/muscle-field-v6-${sex}.bin`);
      const field7 = await readFile(`${dir}/muscle-field-v7-${sex}.bin`);
      expect(Buffer.compare(field6, field7)).toBe(0);
      const occlusion = await readFile(`${dir}/${v7.meta.occlusion.buffer}`);
      expect(occlusion.length).toBe(n * 2);
    }, 30000);
  }

  test("revision 6 assets are untouched by the revision 7 build", async () => {
    const hashes = JSON.parse(await readFile("assets/anatomy/hashes.json", "utf8"));
    for (const sex of ["male", "female"]) {
      const { meta, bytes } = await load(6, sex);
      const digest = createHash("sha256").update(bytes).digest("hex");
      expect(digest).toBe(meta.sha256);
      expect(hashes[meta.buffer]).toBe(digest);
    }
  });
});
