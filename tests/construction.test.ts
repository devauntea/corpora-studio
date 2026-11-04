import { describe, expect, it } from "vitest";
import {
  allowanceOutline,
  removeAnchor,
  constructPiece,
  detachPiece,
  flatten,
  moveAnchor,
  segmentLength,
  segmentPoint,
  splitSegment,
} from "../src/pattern-geometry";
import { newFashion, pathString, type PatternOp } from "../src/fashion-model";
import { draftFashion } from "../src/fashion-draft";
import { ConstructionSchema } from "../src/fashion-construction";
import { blankProject, parseProject } from "../src/domain";
import { patternSvg, patternPdf } from "../src/fashion-export";
const rect: PatternOp[] = [
  { type: "move", to: { x: 0, y: 0 } },
  { type: "line", to: { x: 100, y: 0 } },
  { type: "line", to: { x: 100, y: 200 } },
  { type: "line", to: { x: 0, y: 200 } },
  { type: "close" },
];
const bounds = (ops: PatternOp[]) => {
  const p = flatten(ops).map((p) => p.point);
  return [
    Math.min(...p.map((p) => p.x)),
    Math.min(...p.map((p) => p.y)),
    Math.max(...p.map((p) => p.x)),
    Math.max(...p.map((p) => p.y)),
  ];
};
describe("manual pattern construction", () => {
  it("removes a boundary anchor and keeps outlying construction marks printable", () => {
    const f = newFashion(),
      c = detachPiece(draftFashion(f).pieces[3], 10);
    const triangle = removeAnchor(c, 1);
    expect(triangle.seam).toHaveLength(4);
    expect(() => constructPiece("neckband", triangle)).not.toThrow();
    const before = constructPiece("neckband", c);
    c.darts = [
      [
        { x: 30, y: 150 },
        { x: 40, y: 100 },
        { x: 50, y: 150 },
      ],
    ];
    expect(constructPiece("neckband", c).height).toBeGreaterThan(before.height);
  });

  it("migrates an unedited v7 project without altering either studio", async () => {
    const p = { ...blankProject(), fashion: newFashion() };
    expect(await parseProject(JSON.stringify({ ...p, version: 7 }))).toEqual(p);
  });

  it("builds outward miters with independent hem and fold allowances", () => {
    expect(bounds(allowanceOutline(rect, [0, 10, 10, 30, 0]))).toEqual([
      0, -10, 110, 230,
    ]);
    expect(bounds(allowanceOutline(rect, [0, 0, 0, 0, 0]))).toEqual([
      0, 0, 100, 200,
    ]);
    const reverse: PatternOp[] = [
      rect[0],
      { type: "line", to: { x: 0, y: 200 } },
      { type: "line", to: { x: 100, y: 200 } },
      { type: "line", to: { x: 100, y: 0 } },
      { type: "close" },
    ];
    expect(bounds(allowanceOutline(reverse, [0, 0, 30, 10, 10]))).toEqual([
      0, -10, 110, 230,
    ]);
  });
  it("rejects crossing boundaries rather than exporting an ambiguous cut", () => {
    const crossed: PatternOp[] = [
      rect[0],
      { type: "line", to: { x: 100, y: 200 } },
      { type: "line", to: { x: 0, y: 200 } },
      { type: "line", to: { x: 100, y: 0 } },
      { type: "close" },
    ];
    expect(() => allowanceOutline(crossed, [0, 10, 10, 10, 10])).toThrow();
  });
  it("detaches all generated pieces with finite cut outlines and keeps manual shape across measurement changes", () => {
    const f = newFashion(),
      d = draftFashion(f);
    f.construction = {};
    for (const p of d.pieces) {
      const c = detachPiece(p, f.seamAllowance);
      expect(ConstructionSchema.safeParse(c).success).toBe(true);
      const out = constructPiece(p.id, c);
      expect(out.width).toBeGreaterThan(10);
      expect(out.height).toBeGreaterThan(10);
      expect(
        pathString(
          out.seam.map((o) =>
            o.type === "close"
              ? o
              : {
                  ...o,
                  to: { x: o.to.x + out.origin.x, y: o.to.y + out.origin.y },
                  ...(o.type === "curve"
                    ? {
                        cp1: {
                          x: o.cp1.x + out.origin.x,
                          y: o.cp1.y + out.origin.y,
                        },
                        cp2: {
                          x: o.cp2.x + out.origin.x,
                          y: o.cp2.y + out.origin.y,
                        },
                      }
                    : {}),
                },
          ),
        ),
      ).toEqual(pathString(p.seam));
      f.construction[p.id] = c;
    }
    const before = draftFashion(f);
    f.measurements.chest = 1100;
    f.options.lengthBonus = 15;
    expect(draftFashion(f).pieces).toEqual(before.pieces);
  });
  it("splits cubic geometry without changing shape, length, allowance, or notch positions", () => {
    const f = newFashion(),
      c = detachPiece(draftFashion(f).pieces[0], 10),
      i = c.seam.findIndex((o) => o.type === "curve");
    c.notches = [{ edge: i, t: 0.8, double: true }];
    const before = segmentPoint(c.seam, i, 0.8),
      length = segmentLength(c.seam, i),
      s = splitSegment(c, i);
    const after = segmentPoint(s.seam, s.notches[0].edge, s.notches[0].t);
    expect(after.x).toBeCloseTo(before.x, 8);
    expect(after.y).toBeCloseTo(before.y, 8);
    expect(segmentLength(s.seam, i) + segmentLength(s.seam, i + 1)).toBeCloseTo(
      length,
      5,
    );
    expect(s.allowances[i]).toBe(c.allowances[i]);
    expect(s.allowances[i + 1]).toBe(c.allowances[i]);
    const op = c.seam[i];
    if (op.type !== "curve") throw Error();
    const changed = moveAnchor(c, i, { x: op.to.x + 5, y: op.to.y + 7 });
    expect(changed.seam[i]).toMatchObject({
      to: { x: op.to.x + 5, y: op.to.y + 7 },
      cp2: { x: op.cp2.x + 5, y: op.cp2.y + 7 },
    });
  });
  it("roundtrips manual geometry, notches and darts in v8; old formats reject new fields", async () => {
    const f = newFashion(),
      c = detachPiece(draftFashion(f).pieces[0], 10);
    c.darts = [
      [
        { x: 50, y: 200 },
        { x: 60, y: 140 },
        { x: 70, y: 200 },
      ],
    ];
    c.name = "Custom <front>";
    f.construction = { front: c };
    const p = { ...blankProject(), fashion: f };
    expect(await parseProject(JSON.stringify(p))).toEqual(p);
    await expect(
      parseProject(JSON.stringify({ ...p, version: 7 })),
    ).rejects.toThrow(/v7/);
    const svg = patternSvg(draftFashion(f), f, "Edited");
    expect(svg).toContain("CUSTOM &lt;FRONT&gt;");
    expect(svg).not.toContain("<front>");
    expect(
      new TextDecoder()
        .decode(await patternPdf(draftFashion(f), f, "Edited"))
        .startsWith("%PDF-"),
    ).toBe(true);
  });
});
