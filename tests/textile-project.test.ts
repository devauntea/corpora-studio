import { applyTextileToPack, textileTargetLayers } from "../src/TextileStudio";
import { test, expect } from "vitest";
import { blankProject, parseProject } from "../src/domain";
import { newFashion } from "../src/fashion-model";
import { templatePack } from "../src/vector-templates";
import { defaultTextile } from "../src/textiles";
import { VectorPackSchema, parseVectorPack } from "../src/vector-pack";
import {
  transformSelection,
  duplicateSelection,
} from "../src/vector-selection";
import { drawingSignature } from "../src/style-development";
import { handoffManifest } from "../src/vector-preflight";
test("project round trip, transforms, duplicates and revision signatures retain fabric designs", async () => {
  const p = templatePack("T-shirt"),
    l = p.layers[0];
  const styled = VectorPackSchema.parse({
    ...p,
    layers: p.layers.map((v, i) =>
      i === 0 ? { ...v, textile: defaultTextile("paisley") } : v,
    ),
  });
  const original = blankProject();
  const project = {
    ...original,
    fashion: { ...newFashion(), vectorPack: styled },
  };
  expect(
    (await parseProject(JSON.stringify(project))).fashion?.vectorPack,
  ).toEqual(styled);
  expect(parseVectorPack(JSON.stringify(styled))).toEqual(styled);
  expect(drawingSignature(styled)).not.toBe(drawingSignature(p));
  const moved = transformSelection(styled, [l.id], (v) => ({
    x: v.x + 3,
    y: v.y + 4,
  }));
  expect(moved.layers[0].textile).toEqual(styled.layers[0].textile);
  const dup = duplicateSelection(styled, [l.id], "back");
  expect(dup.pack.layers.find((v) => v.id === dup.ids[0])?.textile).toEqual(
    styled.layers[0].textile,
  );
  expect(handoffManifest(styled).includedSheets).toContain("textiles.csv");
  expect(handoffManifest(styled).includedSheets).toContain(
    `textiles/${l.id}.svg`,
  );
});
test("older plain projects remain valid and unsafe textile data is rejected", () => {
  const p = templatePack("Hoodie");
  expect(parseVectorPack(JSON.stringify(p))).toEqual(p);
  expect(
    VectorPackSchema.safeParse({
      ...p,
      layers: [{ ...p.layers[0], textile: { ...defaultTextile(), scale: 0 } }],
    }).success,
  ).toBe(false);
  expect(
    VectorPackSchema.safeParse({
      ...p,
      layers: [
        {
          ...p.layers[0],
          textile: {
            ...defaultTextile(),
            colors: ["url(https://invalid.test)", "red", "blue", "green"],
          },
        },
      ],
    }).success,
  ).toBe(false);
});

test("fabric targets preserve imported outlines, trims, hidden and locked parts; plain clears prints", () => {
  const p = templatePack("T-shirt");
  const shell = p.layers[0];
  const layers = [
    { ...shell, name: "Imported shirt · Front · Fabric" },
    {
      ...shell,
      id: crypto.randomUUID(),
      name: "Imported shirt · Front · Linework",
      fill: "#181818",
    },
    {
      ...shell,
      id: crypto.randomUUID(),
      name: "Imported shirt · Front · Highlights",
      fill: "#ffffff",
    },
    { ...shell, id: crypto.randomUUID(), name: "Fabric", locked: true },
    { ...shell, id: crypto.randomUUID(), name: "Fabric", visible: false },
    ...p.layers.slice(1),
  ];
  const pack = { ...p, layers };
  const targets = textileTargetLayers(pack, "front", []);
  expect(targets.map((l) => l.id)).toEqual([shell.id]);
  const painted = applyTextileToPack(
    pack,
    defaultTextile("leopard"),
    targets.map((l) => l.id),
  );
  expect(painted.layers[0].textile?.pattern).toBe("leopard");
  expect(painted.layers.slice(1)).toEqual(pack.layers.slice(1));
  expect(
    textileTargetLayers(pack, "selected", [layers[1].id, layers[3].id]).map(
      (l) => l.id,
    ),
  ).toEqual([layers[1].id]);
  const plain = applyTextileToPack(
    painted,
    {
      ...defaultTextile("plain"),
      colors: ["#123456", "#ffffff", "#ffffff", "#ffffff"],
    },
    [shell.id],
  );
  expect(plain.layers[0].textile).toBeUndefined();
  expect(plain.layers[0].fill).toBe("#123456");
});
