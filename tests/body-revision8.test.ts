import { describe, expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { blankProject, humanBody, parseProject } from "../src/domain";
import {
  detailedMuscleGroups,
  muscleParent,
  muscleLegend,
} from "../src/muscles";

const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const load = async (revision: number, sex: string) => {
  const meta = JSON.parse(
    await readFile(`public/anatomy/human-v${revision}-${sex}.json`, "utf8"),
  );
  const raw = await readFile(`public/anatomy/${meta.buffer}`);
  return {
    meta,
    raw,
    data: new Float32Array(
      raw.buffer.slice(raw.byteOffset, raw.byteOffset + meta.vertexCount * 48),
    ),
  };
};

describe("body revision 8", () => {
  for (const sex of ["male", "female"])
    test(`${sex}: atlas heads keep topology, rig, exact rims and normalized categorical weights`, async () => {
      const old = await load(7, sex),
        next = await load(8, sex),
        n = next.meta.vertexCount;
      expect(next.meta.vertexCount).toBe(old.meta.vertexCount);
      expect(hash(next.raw)).toBe(next.meta.sha256);
      expect(next.meta.rig).toBe(old.meta.rig);
      expect(next.meta.centersOfRotation).toEqual(old.meta.centersOfRotation);
      expect(next.meta.joints).toEqual(old.meta.joints);
      expect(
        Buffer.compare(old.raw.subarray(n * 48), next.raw.subarray(n * 48)),
      ).toBe(0);
      let maximum = 0;
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < 12; k++) {
          expect(Number.isFinite(next.data[i * 12 + k])).toBe(true);
          if (k >= 6) expect(next.data[i * 12 + k]).toBe(old.data[i * 12 + k]);
        }
        for (const t of [0, 1])
          maximum = Math.max(
            maximum,
            Math.hypot(
              ...[0, 1, 2].map(
                (c) =>
                  next.data[i * 12 + c] +
                  t * next.data[i * 12 + c + 3] -
                  old.data[i * 12 + c] -
                  t * old.data[i * 12 + c + 3],
              ),
            ),
          );
      }
      expect(maximum).toBeLessThan(sex === "male" ? 0.45 : 0.025);
      const field = await readFile(`public/anatomy/muscle-field-v8-${sex}.bin`);
      const info = JSON.parse(
        await readFile(`public/anatomy/muscle-field-v8-${sex}.json`, "utf8"),
      );
      expect(hash(field)).toBe(info.sha256);
      expect(field.length).toBe(n * 12);
      const ids = new Set<number>();
      for (let i = 0; i < n; i++) {
        ids.add(field[n * 3 + i]);
        const at = n * 4 + i * 8;
        expect(
          field[at + 4] + field[at + 5] + field[at + 6] + field[at + 7],
        ).toBe(255);
        for (let k = 0; k < 4; k++)
          expect(field[at + k]).toBeLessThan(detailedMuscleGroups.length);
      }
      expect([...ids].filter((id) => id >= 37)).toHaveLength(28);
      // All section boundary vertices retain their exact average and fit bytes.
      const indices = new Uint32Array(
        next.raw.buffer.slice(
          next.raw.byteOffset + n * 48,
          next.raw.byteOffset + next.raw.byteLength,
        ),
      );
      let offset = 0;
      for (const count of next.meta.partCounts) {
        const edges = new Map<string, number>();
        for (let t = offset; t < offset + count; t += 3)
          for (let k = 0; k < 3; k++) {
            const a = indices[t + k],
              b = indices[t + ((k + 1) % 3)],
              key = a < b ? `${a}:${b}` : `${b}:${a}`;
            edges.set(key, (edges.get(key) || 0) + 1);
          }
        for (const [key, count] of edges)
          if (count === 1)
            for (const i of key.split(":").map(Number))
              for (let k = 0; k < 6; k++)
                expect(next.data[i * 12 + k]).toBe(old.data[i * 12 + k]);
        offset += count;
      }
      const occlusion = await readFile(
        `public/anatomy/${next.meta.occlusion.buffer}`,
      );
      expect(hash(occlusion)).toBe(next.meta.occlusion.sha256);
      expect(occlusion.length).toBe(n * 2);
    }, 60000);

  test("format 15 stays on its exact body; format 16 is required for revision 8", async () => {
    const body = humanBody("upper-body");
    body.model!.revision = 7;
    const old = { ...blankProject(), version: 15, body };
    expect(await parseProject(JSON.stringify(old))).toEqual({
      ...old,
      version: 19,
    });
    body.model!.revision = 8;
    await expect(parseProject(JSON.stringify(old))).rejects.toThrow(
      "version 15",
    );
    const project = { ...old, version: 19 };
    expect(await parseProject(JSON.stringify(project))).toEqual(project);
    expect(humanBody("full-arm").model!.revision).toBe(9);
  });
  test("head identities retain their parent muscle and skin tile has declared provenance", async () => {
    expect(muscleParent(37)).toBe(8);
    expect(muscleParent(42)).toBe(10);
    expect(muscleLegend(7)).toHaveLength(36);
    expect(muscleLegend(8).some((g) => g.name === "Deltoid · anterior")).toBe(
      true,
    );
    expect(muscleLegend(8).some((g) => g.name === "Deltoid")).toBe(false);
    const meta = JSON.parse(
      await readFile("public/anatomy/skin-detail-v8.json", "utf8"),
    );
    const raw = await readFile("public/anatomy/skin-detail-v8.png");
    expect(hash(raw)).toBe(meta.sha256);
    expect(meta.license).toBe("CC0-1.0");
    expect(raw.readUInt32BE(16)).toBe(1024);
    expect(raw.readUInt32BE(20)).toBe(1024);
  });
});
