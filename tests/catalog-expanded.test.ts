import { test, expect } from "vitest";
import {
  designIds,
  newFashion,
  lowerBodySample,
  catalogSample,
  measurementFields,
  FashionSchema,
} from "../src/fashion-model";
import { draftFashion } from "../src/fashion-draft";
import { requiredMeasures } from "../src/design-adapters";
import { patternSvg } from "../src/fashion-export";
for (const design of designIds)
  test(`${design}: complete finite draft and supported measurement fields`, () => {
    const f = {
      ...newFashion(),
      design,
      measurements: {
        ...newFashion().measurements,
        ...lowerBodySample,
        ...catalogSample,
        hips: 920,
        waistToHips: 120,
      },
    };
    expect(
      requiredMeasures(design).every((k) =>
        measurementFields.some((m) => m[0] === k),
      ),
    ).toBe(true);
    const draft = draftFashion(f);
    expect(draft.pieces.length).toBeGreaterThan(0);
    const output = patternSvg(draft, f, "Catalog validation");
    expect(output).not.toMatch(/NaN|Infinity|undefined/);
    for (const p of draft.pieces) {
      expect(p.width).toBeGreaterThan(5);
      expect(p.height).toBeGreaterThan(5);
      expect(p.cutline.length).toBeGreaterThan(1);
    }
  });

test("Otis supports infant waist measurements", () => {
  const sample = newFashion();
  const f = FashionSchema.parse({
    ...sample,
    design: "otis",
    measurements: { ...sample.measurements, waist: 400 },
  });
  const draft = draftFashion(f);
  expect(draft.pieces.length).toBeGreaterThan(0);
  expect(patternSvg(draft, f, "Infant romper")).not.toMatch(
    /NaN|Infinity|undefined/,
  );
});
