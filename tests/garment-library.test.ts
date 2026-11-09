import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  garmentAssets,
  parseGarmentTrace,
  garmentLayers,
  placeGarment,
} from "../src/garment-library";
import {
  allContours,
  newVectorPack,
  mapLayer,
  layerBounds,
  vectorPath,
  parseVectorPack,
} from "../src/vector-pack";
import { vectorArchive, vectorPdf } from "../src/vector-export";
import { blankProject, parseProject } from "../src/domain";
import { newFashion } from "../src/fashion-model";
import { templatePack } from "../src/vector-templates";
import { unzipSync, strFromU8 } from "fflate";
// Garment flats are installed locally and are not in the public repository.
const installed = garmentAssets.length > 0;
const read = (id: string, file: string) =>
  readFileSync(
    new URL(`../public/garment-assets/${id}/${file}`, import.meta.url),
    "utf8",
  );
test.skipIf(!installed)("all 112 source sheets retain their exact bytes and every split view produces bounded editable geometry", () => {
  expect(garmentAssets).toHaveLength(112);
  expect(new Set(garmentAssets.map((a) => a.id)).size).toBe(112);
  for (const a of garmentAssets) {
    const bytes = readFileSync(
      new URL(`../public/garment-assets/${a.id}/original.png`, import.meta.url),
    );
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(a.sha256);
    expect(bytes.readUInt32BE(16)).toBe(a.sourceSize[0]);
    expect(bytes.readUInt32BE(20)).toBe(a.sourceSize[1]);
    expect(a.views.length).toBeGreaterThan(0);
    expect(a.views.length).toBeLessThanOrEqual(4);
    for (const [i, v] of a.views.entries()) {
      const trace = parseGarmentTrace(JSON.parse(read(a.id, v.file)));
      const layers = garmentLayers(a, i, trace, "front");
      expect(
        placeGarment(newVectorPack(), layers, false).layers.length,
      ).toBeGreaterThan(0);
      for (const l of layers) {
        const b = layerBounds(l);
        expect(b.x).toBeGreaterThan(0);
        expect(b.y).toBeGreaterThan(0);
        expect(b.x + b.width).toBeLessThan(480);
        expect(b.y + b.height).toBeLessThan(640);
        expect(vectorPath(l)).not.toMatch(/NaN|Infinity/);
      }
    }
  }
}, 30000);
test.skipIf(!installed)("compound contours retain holes and curve handles through transform, exports and project round trip", async () => {
  const a = garmentAssets.find((a) => a.id === "hat-trucker")!;
  const trace = parseGarmentTrace(JSON.parse(read(a.id, a.views[0].file)));
  const layers = garmentLayers(a, 0, trace, "front");
  const p = placeGarment(newVectorPack(), layers, false);
  const source = p.layers[0];
  const moved = mapLayer(source, (q) => ({ x: q.x + 5, y: q.y - 2 }));
  expect(allContours(moved).length).toBe(allContours(source).length);
  expect(allContours(moved)[1][0].x).toBeCloseTo(
    allContours(source)[1][0].x + 5,
  );
  const zip = unzipSync(vectorArchive(p));
  expect(strFromU8(zip["front.svg"])).toContain('fill-rule="evenodd"');
  expect(strFromU8(zip["front.svg"])).not.toContain("<image");
  expect(parseVectorPack(strFromU8(zip["editable-vector-pack.json"]))).toEqual(
    p,
  );
  const pdf = new TextDecoder().decode(vectorPdf(p));
  expect(pdf).toContain("f*");
  expect(pdf).not.toContain("/Subtype /Image");
  const project = {
    ...blankProject(),
    fashion: { ...newFashion(), vectorPack: p },
  };
  expect(await parseProject(JSON.stringify(project))).toEqual(project);
});
test.skipIf(!installed)("replacing one view keeps the other view, sizes and materials; old v11 packs migrate", async () => {
  const p = templatePack("Hoodie"),
    a = garmentAssets.find((a) => a.id === "tee")!;
  const layers = garmentLayers(
    a,
    0,
    parseGarmentTrace(JSON.parse(read(a.id, a.views[0].file))),
    "front",
  );
  const next = placeGarment(p, layers, true);
  expect(next.layers.filter((l) => l.view === "back")).toEqual(
    p.layers.filter((l) => l.view === "back"),
  );
  expect(next.materials).toEqual(p.materials);
  expect(next.measurements).toEqual(p.measurements);
  const {groups, sources, ...legacyPack} = templatePack("T-shirt");
  const old = {
    ...blankProject(),
    version: 11,
    fashion: {
      ...newFashion(),
      vectorPack: { ...legacyPack, version: 1 },
    },
  };
  const migrated = await parseProject(JSON.stringify(old));
  expect(migrated.version).toBe(19);
  expect(migrated.fashion!.vectorPack!.version).toBe(4);
  expect(parseVectorPack(JSON.stringify(old.fashion.vectorPack)).version).toBe(
    4,
  );
  await expect(
    parseProject(
      JSON.stringify({ ...old, fashion: { ...old.fashion, vectorPack: p } }),
    ),
  ).rejects.toThrow("version 11");
});
