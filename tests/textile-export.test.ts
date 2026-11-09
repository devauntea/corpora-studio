import { expect, test } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { templatePack } from "../src/vector-templates";
import { vectorSvg, vectorPdf, vectorArchive } from "../src/vector-export";
import { defaultTextile, textilePatternId } from "../src/textiles";
import { parseVectorPack } from "../src/vector-pack";
import fs from "node:fs";

function printedPack() {
  const p = templatePack("T-shirt");
  const shell = p.layers.find((l) => l.name === "Shell" && l.view === "front")!;
  shell.textile = { ...defaultTextile("plaid"), scale: 64, rotation: 35 };
  shell.fill = shell.textile.colors[0];
  return p;
}
test("SVG embeds editable repeated fabric and keeps unprinted layers unchanged", () => {
  const p = printedPack(),
    l = p.layers.find((l) => l.textile)!;
  l.name = 'Fabric <script>&"';
  const svg = vectorSvg(p);
  expect(svg).toContain(`<pattern id="${textilePatternId(`export-${l.id}`)}"`);
  expect(svg).toContain(`fill="url(#${textilePatternId(`export-${l.id}`)})"`);
  expect(svg).toContain('patternTransform="rotate(35)"');
  expect(svg).toContain('width="64" height="64"');
  expect(svg).toContain('data-name="Fabric &lt;script&gt;&amp;&quot;"');
  expect(svg).not.toContain("<script>");
  expect(svg).not.toMatch(/<image|href=|NaN|undefined/);
  expect(vectorSvg(p, "back")).not.toContain("<pattern");
  expect(vectorSvg(p, "back")).toContain(
    `fill="${p.layers.find((l) => l.name === "Shell" && l.view === "back")!.fill}"`,
  );
  l.fill = "none";
  expect(vectorSvg(p, "front")).not.toContain("<pattern");
});

test("PDF uses vector pattern resources with scale and rotation, retaining contour holes", () => {
  const p = printedPack(),
    l = p.layers.find((l) => l.textile)!;
  l.nodes = [
    { x: 60, y: 100 },
    { x: 400, y: 100 },
    { x: 400, y: 500 },
    { x: 60, y: 500 },
  ];
  l.contours = [
    [
      { x: 150, y: 200 },
      { x: 310, y: 200 },
      { x: 310, y: 360 },
      { x: 150, y: 360 },
    ],
  ];
  l.fillRule = "evenodd";
  const pdf = vectorPdf(p),
    text = strFromU8(pdf);
  expect(text).toContain("/PatternType 1");
  expect(text).toContain("/Pattern cs");
  expect(text).toContain("/XStep 100");
  expect(text).toContain("B*");
  expect(text).toContain("Fabric prints & color placement");
  expect(text).not.toContain("/Subtype /Image");
  expect(text).not.toMatch(/NaN|Infinity/);
  expect(pdf.byteLength).toBeLessThan(250_000);
  if (process.env.TEXTILE_EXPORT_QA) {
    fs.mkdirSync("qa/textiles", { recursive: true });
    fs.writeFileSync("qa/textiles/printed-hole.pdf", pdf);
    fs.writeFileSync("qa/textiles/printed-hole.svg", vectorSvg(p));
  }
});

test("small repeats remain bounded in PDF size instead of duplicating tiles", () => {
  const p = printedPack(),
    l = p.layers.find((l) => l.textile)!;
  l.textile = { ...defaultTextile("paisley"), scale: 160, rotation: 25 };
  const large = vectorPdf(p).byteLength;
  l.textile.scale = 12;
  const small = vectorPdf(p).byteLength;
  expect(Math.abs(small - large)).toBeLessThan(200);
  expect(small).toBeLessThan(300_000);
});

test("manufacturer archive preserves prints and supplies layer assignments and swatches", () => {
  const p = printedPack(),
    l = p.layers.find((l) => l.textile)!;
  l.material = "=FABRIC";
  const files = unzipSync(vectorArchive(p));
  expect(files[`textiles/${l.id}.svg`]).toBeDefined();
  expect(strFromU8(files["textiles.csv"])).toContain("'=FABRIC");
  expect(strFromU8(files["textiles.csv"])).toContain(
    "Repeat (illustration units)",
  );
  expect(strFromU8(files[`textiles/${l.id}.svg`])).toContain("<pattern");
  expect(
    parseVectorPack(strFromU8(files["editable-vector-pack.json"])),
  ).toEqual(p);
  expect(strFromU8(files["front.svg"])).toContain(
    'patternTransform="rotate(35)"',
  );
  const plain = unzipSync(vectorArchive(templatePack("T-shirt")));
  expect(Object.keys(plain)).toHaveLength(14);
  expect(plain["textiles.csv"]).toBeUndefined();
});

test("untrusted print inputs cannot inject SVG or bypass bounded parameters", () => {
  const p = printedPack(),
    l = p.layers.find((l) => l.textile)!;
  (l.textile!.colors as string[])[1] = "url(https://example.invalid/a.svg)";
  expect(() => vectorSvg(p)).toThrow();
  l.textile = { ...defaultTextile("dots"), scale: 0 };
  expect(() => vectorPdf(p)).toThrow();
});
