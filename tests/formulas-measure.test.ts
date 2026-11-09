import { test, expect } from "vitest";
import { evaluateFormula, resolveConstruction } from "../src/pattern-formulas";
import {
  calibratedDistance,
  studyCsv,
  type GarmentStudy,
} from "../src/garment-measure";
import { draftFashion } from "../src/fashion-draft";
import { newFashion } from "../src/fashion-model";
import { detachPiece } from "../src/pattern-geometry";
test("formula parser respects precedence, references, cycles and rejects executable syntax", () => {
  expect(evaluateFormula("waist / 4 + (5 * 2)", () => 800)).toBe(210);
  for (const x of ["alert(1)", "globalThis.secret", "1/0", "2 ** 3", "1; 2"])
    expect(() =>
      evaluateFormula(x, () => {
        throw new Error("Unknown");
      }),
    ).toThrow();
  const f = {
      ...newFashion(),
      measurements: { ...newFashion().measurements, waist: 850 },
    },
    c = detachPiece(draftFashion(f).pieces[0], 10);
  c.formulas = [
    { edge: 0, point: "to", axis: "x", expression: "p1.x + 10" },
    { edge: 1, point: "to", axis: "x", expression: "waist / 4" },
  ];
  expect(resolveConstruction(c, f.measurements).seam[0]).toMatchObject({
    to: { x: 222.5 },
  });
  c.formulas[1].expression = "p0.x";
  expect(() => resolveConstruction(c, f.measurements)).toThrow(/Circular/);
});
test("calibration uses the projective plane and rejects degenerate reference cards", () => {
  const s: GarmentStudy = {
    assetId: crypto.randomUUID(),
    referenceWidth: 100,
    referenceHeight: 50,
    corners: [
      [0.1, 0.1],
      [0.3, 0.1],
      [0.3, 0.2],
      [0.1, 0.2],
    ],
    lines: [],
    assumptions: "",
  };
  expect(
    calibratedDistance(
      s,
      [
        [0.1, 0.3],
        [0.5, 0.3],
      ],
      1000,
      1000,
    ),
  ).toBeCloseTo(200);
  const l = {
    id: crypto.randomUUID(),
    name: "Width",
    points: [
      [0.1, 0.3],
      [0.5, 0.3],
    ] as [[number, number], [number, number]],
    target: "waist",
    multiplier: 2,
    ease: 10,
    tape: 198,
  };
  s.lines = [l];
  expect(studyCsv(s, 1000, 1000)).toContain("200.00,198,2.00");
  expect(() =>
    calibratedDistance(
      {
        ...s,
        corners: [
          [0, 0],
          [0.1, 0],
          [0.2, 0],
          [0.3, 0],
        ],
      },
      l.points,
      1000,
      1000,
    ),
  ).toThrow(/convex/);
});
