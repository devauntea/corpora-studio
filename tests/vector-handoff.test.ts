import { test, expect } from "vitest";
import { templatePack } from "../src/vector-templates";
import {
  VectorPackSchema,
  parseVectorPack,
  allContours,
} from "../src/vector-pack";
import {
  groupSelection,
  transformSelection,
  duplicateSelection,
  pruneGroups,
  selectionFor,
} from "../src/vector-selection";
import { vectorPreflight, handoffManifest } from "../src/vector-preflight";
import { blankProject, parseProject, historyReducer } from "../src/domain";
import { newFashion } from "../src/fashion-model";

test("group transformations retain every control handle and contour and form one undo transaction", () => {
  const original = templatePack("Hoodie");
  const ids = original.layers
    .filter((l) => l.view === "front")
    .map((l) => l.id);
  const grouped = groupSelection(original, ids, "Hoodie front");
  expect(selectionFor(grouped, ids[1])).toEqual(ids);
  const moved = transformSelection(grouped, ids, (p) => ({
    x: p.x + 17,
    y: p.y - 3,
  }));
  for (const before of grouped.layers) {
    const after = moved.layers.find((l) => l.id === before.id)!;
    if (!ids.includes(before.id)) expect(after).toBe(before);
    else
      allContours(before)
        .flat()
        .forEach((n, i) => {
          const a = allContours(after).flat()[i];
          expect(a.x).toBe(n.x + 17);
          expect(a.y).toBe(n.y - 3);
          if (n.in) expect(a.in).toEqual({ x: n.in.x + 17, y: n.in.y - 3 });
          if (n.out) expect(a.out).toEqual({ x: n.out.x + 17, y: n.out.y - 3 });
        });
  }
  let h = historyReducer(
    { present: grouped, past: [], future: [] },
    { type: "begin" },
  );
  h = historyReducer(h, { type: "change", value: moved });
  h = historyReducer(h, {
    type: "change",
    value: transformSelection(moved, ids, (p) => ({ x: p.x + 1, y: p.y })),
  });
  h = historyReducer(h, { type: "commit" });
  expect(h.past).toHaveLength(1);
  expect(historyReducer(h, { type: "undo" }).present).toEqual(grouped);
  expect(
    transformSelection(
      {
        ...grouped,
        layers: grouped.layers.map((l, i) =>
          i === 0 ? { ...l, locked: true } : l,
        ),
      },
      ids,
      (p) => ({ x: p.x + 10, y: p.y }),
    ).layers[1],
  ).toEqual(grouped.layers[1]);
});
test("duplicates remap group IDs; removals and forged memberships cannot leave broken references", () => {
  const p = templatePack("Shirt"),
    ids = p.layers.filter((l) => l.view === "front").map((l) => l.id),
    g = groupSelection(p, ids);
  const copy = duplicateSelection(g, ids, "back");
  expect(copy.pack.groups).toHaveLength(2);
  expect(copy.pack.groups[1].layerIds).toEqual(copy.ids);
  expect(copy.ids.some((id) => ids.includes(id))).toBe(false);
  expect(VectorPackSchema.safeParse(copy.pack).success).toBe(true);
  expect(
    pruneGroups({ ...g, layers: g.layers.filter((l) => !ids.includes(l.id)) })
      .groups,
  ).toEqual([]);
  expect(
    VectorPackSchema.safeParse({
      ...g,
      groups: [...g.groups, { ...g.groups[0], id: crypto.randomUUID() }],
    }).success,
  ).toBe(false);
});
test("v12 projects and v2 packs migrate without changing old paths; mislabeled new fields fail", async () => {
  const { groups, sources, ...old } = templatePack("Shirt");
  const pack = { ...old, version: 2 };
  const project = {
    ...blankProject(),
    version: 12,
    fashion: { ...newFashion(), vectorPack: pack },
  };
  const next = await parseProject(JSON.stringify(project));
  expect(next.version).toBe(19);
  expect(next.fashion!.vectorPack!.layers).toEqual(pack.layers);
  expect(next.fashion!.vectorPack!.groups).toEqual([]);
  expect(parseVectorPack(JSON.stringify(pack))).toEqual(
    next.fashion!.vectorPack,
  );
  await expect(
    parseProject(
      JSON.stringify({
        ...project,
        fashion: { ...project.fashion, vectorPack: { ...pack, groups: [] } },
      }),
    ),
  ).rejects.toThrow("version 12");
  expect(() =>
    parseVectorPack(JSON.stringify({ ...pack, sources: [] })),
  ).toThrow();
  expect(await parseProject(JSON.stringify(next))).toEqual(next);
});
test("preflight reports missing dimensions, units, clipped content, unresolved materials and font loss without inventing print acceptance", () => {
  const p = templatePack("T-shirt");
  p.layers[0].nodes[0].x = -20;
  p.layers[0].material = "UNKNOWN";
  p.notes = "日本語";
  const issues = vectorPreflight(p);
  expect(issues.map((i) => i.code)).toEqual(
    expect.arrayContaining([
      "missing-values",
      "clipped",
      "unknown-material",
      "pdf-text",
    ]),
  );
  expect(handoffManifest(p)).toMatchObject({
    intent: "technical-flat",
    specificationUnits: "cm",
    physicalPrintVerified: false,
    recipientAcceptanceVerified: false,
    status: "draft-needs-review",
  });
  expect(vectorPreflight({ ...p, layers: [] })).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: "empty", severity: "error" }),
    ]),
  );
});
