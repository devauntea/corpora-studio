import { newFashion as legacyFashion } from "../src/legacy-fashion-v18";
import { expect, test } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { flatTemplates, templatePack } from "../src/vector-templates";
import {
  VectorPackSchema,
  mapLayer,
  vectorPath,
  parseVectorPack,
  resizeSizes,
  convertPackUnits,
} from "../src/vector-pack";
import {
  vectorArchive,
  vectorPdf,
  vectorSvg,
  specCsv,
  materialsCsv,
} from "../src/vector-export";
import { blankProject, parseProject } from "../src/domain";
import { newFashion } from "../src/fashion-model";
for (const template of flatTemplates)
  test(`${template} includes editable front and back contours`, () => {
    const pack = templatePack(template);
    expect(VectorPackSchema.safeParse(pack).success).toBe(true);
    expect(
      pack.layers.some((l) => l.view === "front" && l.name === "Shell"),
    ).toBe(true);
    expect(
      pack.layers.some((l) => l.view === "back" && l.name === "Shell"),
    ).toBe(true);
    const output = vectorSvg(pack);
    expect(output).not.toMatch(/NaN|Infinity|undefined/);
    expect(output).toContain("<path");
  });
test("manufacturer ZIP preserves editable shapes, specifications and plain-text instructions", () => {
  const p = templatePack("Hoodie");
  p.name = "<script>alert(1)</script>";
  p.measurements[0].values = [48, 51, 54];
  p.materials[0].description = "Heavyweight fleece";
  p.callouts = [
    {
      id: crypto.randomUUID(),
      view: "front",
      anchor: { x: 220, y: 300 },
      label: { x: 330, y: 290 },
      text: "Twin needle pocket stitch",
    },
  ];
  const files = unzipSync(vectorArchive(p));
  expect(Object.keys(files)).toHaveLength(14);
  expect(strFromU8(files["front.svg"])).toContain("&lt;script&gt;");
  expect(strFromU8(files["front.svg"])).not.toContain("<script>");
  expect(strFromU8(files["back.svg"])).not.toContain("Twin needle");
  expect(strFromU8(files["construction.csv"])).toContain(
    "Twin needle pocket stitch",
  );
  expect(strFromU8(files["materials.csv"])).toContain("Heavyweight fleece");
  expect(
    parseVectorPack(strFromU8(files["editable-vector-pack.json"])),
  ).toEqual(p);
  expect(strFromU8(files["tech-pack.pdf"]).startsWith("%PDF-")).toBe(true);
  expect(strFromU8(files["tech-pack.pdf"])).not.toContain("/Subtype /Image");
});
test("numeric unit conversion and resizing preserve measurements by size name", () => {
  const p = templatePack("T-shirt");
  p.measurements[0].values = [25.4, null, 50.8];
  const resized = resizeSizes(p, ["L", "S", "XL"]);
  expect(resized.measurements[0].values).toEqual([50.8, 25.4, null]);
  const converted = convertPackUnits(resized, "in");
  expect(converted.measurements[0].values).toEqual([20, 10, null]);
  expect(convertPackUnits(converted, "cm").measurements[0].values).toEqual([
    50.8,
    25.4,
    null,
  ]);
});
test("path transforms retain bezier handles and do not mutate original", () => {
  const l = templatePack("T-shirt").layers[0],
    before = JSON.stringify(l);
  const shifted = mapLayer(l, (p) => ({ x: p.x + 20, y: p.y - 4 }));
  expect(shifted.nodes[1].in!.x).toBe(l.nodes[1].in!.x + 20);
  expect(JSON.stringify(l)).toBe(before);
  expect(vectorPath(shifted)).toContain("C");
});
test("repeated unit switching retains entered dimensions and clean export precision", () => {
  let p = templatePack("T-shirt");
  p.measurements[0].values = [60, null, 100];
  for (let i = 0; i < 20; i++)
    p = convertPackUnits(convertPackUnits(p, "in"), "cm");
  expect(p.measurements[0].values[0]).toBeCloseTo(60, 6);
  expect(p.measurements[0].tolerance).toBeCloseTo(0.5, 6);
  expect(specCsv(p)).toContain('"0.5","60","","100"');
  expect(new TextDecoder().decode(vectorPdf(p))).toContain("S: 60");
});
test("pack and project round-trip reject damaged geometry, duplicate IDs, and invalid old format fields", async () => {
  const f = { ...newFashion(), vectorPack: templatePack("Jacket") },
    p = { ...blankProject(), fashion: f };
  expect(await parseProject(JSON.stringify(p))).toEqual(p);
  const old = { ...blankProject(), version: 10, fashion: legacyFashion() };
  expect((await parseProject(JSON.stringify(old))).version).toBe(19);
  await expect(
    parseProject(JSON.stringify({ ...old, fashion: f })),
  ).rejects.toThrow("version 10");
  await expect(
    parseProject(
      JSON.stringify({ ...old, fashion: { ...newFashion(), design: "hugo" } }),
    ),
  ).rejects.toThrow("version 10");
  const bad = structuredClone(f.vectorPack);
  bad.layers[0].nodes[0].x = Infinity;
  expect(VectorPackSchema.safeParse(bad).success).toBe(false);
  expect(() =>
    parseVectorPack(
      JSON.stringify({
        ...f.vectorPack,
        layers: [f.vectorPack.layers[0], f.vectorPack.layers[0]],
      }),
    ),
  ).toThrow();
  expect(() =>
    parseVectorPack(JSON.stringify({ ...f.vectorPack, unknown: "field" })),
  ).toThrow();
});
test("CSV quotes multiline text and neutralizes spreadsheet formulas", () => {
  const p = templatePack("Shirt");
  p.measurements[0].name = '=IMPORTXML("x")';
  p.materials[0].description = "@SUM(1)";
  expect(specCsv(p)).toContain('"\'=IMPORTXML(""x"")"');
  expect(materialsCsv(p)).toContain('"\'@SUM(1)"');
});
test("long notes paginate the PDF without rasterizing paths", () => {
  const p = templatePack("Shirt");
  p.notes = "Long construction note with lots of finishing details. ".repeat(
    85,
  );
  p.measurements[0].method = "Measure from HPS to hem";
  const output = new TextDecoder().decode(vectorPdf(p));
  expect(output).toContain("Measure from HPS to hem");
  expect(output).not.toContain("/Subtype /Image");
  expect(output.match(/\/Type \/Page\b/g)!.length).toBeGreaterThanOrEqual(4);
});

test("inserted curve anchor preserves the cubic shape", async () => {
  const { insertVectorAnchor } = await import("../src/vector-pack");
  const l = templatePack("T-shirt").layers[0];
  const next = insertVectorAnchor(l, 0);
  expect(next.nodes.length).toBe(l.nodes.length + 1);
  const point = (
    a: (typeof l.nodes)[number],
    b: (typeof l.nodes)[number],
    t: number,
  ) => {
    const u = 1 - t,
      c = a.out ?? a,
      d = b.in ?? b;
    return {
      x:
        u * u * u * a.x +
        3 * u * u * t * c.x +
        3 * u * t * t * d.x +
        t * t * t * b.x,
      y:
        u * u * u * a.y +
        3 * u * u * t * c.y +
        3 * u * t * t * d.y +
        t * t * t * b.y,
    };
  };
  for (const t of [0.1, 0.35, 0.6, 0.9]) {
    const a = point(l.nodes[0], l.nodes[1], t),
      b =
        t <= 0.5
          ? point(next.nodes[0], next.nodes[1], t * 2)
          : point(next.nodes[1], next.nodes[2], (t - 0.5) * 2);
    expect(b.x).toBeCloseTo(a.x, 8);
    expect(b.y).toBeCloseTo(a.y, 8);
  }
});
