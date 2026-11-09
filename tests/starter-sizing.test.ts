import { test, expect } from "vitest";
import { starterProfiles, applyStarterProfile } from "../src/starter-sizing";
import {
  newFashion,
  designIds,
  measurementFields,
  MeasurementsSchema,
} from "../src/fashion-model";
import { requiredMeasures } from "../src/design-adapters";
import { draftFashion } from "../src/fashion-draft";
import { patternSvg } from "../src/fashion-export";
import { detachPiece } from "../src/pattern-geometry";
import { patternPreview } from "../src/pattern-preview";

for (const profile of starterProfiles) {
  test(`${profile.id}: complete measurements with field-by-field evidence`, () => {
    expect(MeasurementsSchema.safeParse(profile.measurements).success).toBe(
      true,
    );
    for (const [key] of measurementFields) {
      expect(profile.measurements[key]).toBeTypeOf("number");
      expect(profile.evidence[key].basis.length).toBeGreaterThan(10);
    }
    expect(profile.measurements.hips).toBeLessThan(profile.measurements.seat);
    expect(profile.measurements.waistToHips).toBeLessThan(
      profile.measurements.waistToSeat,
    );
  });
  for (const design of designIds)
    test(`${design} × ${profile.id}: finite draft`, () => {
      const f = { ...newFashion(), design, measurements: profile.measurements };
      expect(
        requiredMeasures(design).every(
          (key) =>
            profile.measurements[key as keyof typeof profile.measurements] !==
            undefined,
        ),
      ).toBe(true);
      const draft = draftFashion(f);
      expect(draft.pieces.length).toBeGreaterThan(0);
      expect(patternSvg(draft, f, "Starter validation")).not.toMatch(
        /NaN|Infinity|undefined/,
      );
      for (const p of draft.pieces) {
        expect(p.width).toBeGreaterThan(5);
        expect(p.height).toBeGreaterThan(5);
      }
    });
}
test("applying a starter preserves work and keeps current measurements", () => {
  const before = newFashion();
  before.profile = "My measured profile";
  before.layout.front = { x: 14, y: 23 };
  before.notes = "Keep these assembly instructions";
  before.construction = {
    front: detachPiece(draftFashion(before).pieces[0], 10),
  };
  const frozen = JSON.stringify(before);
  const after = applyStarterProfile(before, "female-m");
  expect(JSON.stringify(before)).toBe(frozen);
  expect(after.layout).toEqual(before.layout);
  expect(after.notes).toBe(before.notes);
  expect(after.construction).toEqual(before.construction);
  expect(after.profiles?.[0].measurements).toEqual(before.measurements);
  expect(after.measurements.chest).toBe(920);
  expect(applyStarterProfile(after, "female-m")).toBe(after);
});
test("drafted previews have distinct real geometry for designs and sizes", () => {
  const shirt = patternPreview("teagan", "female-s");
  const trousers = patternPreview("titan", "female-s");
  const large = patternPreview("teagan", "female-l");
  expect(shirt.svg).toContain("actual drafted pieces");
  expect(shirt.svg).toMatch(/<path[^>]* d="M[^"]*C/);
  expect(shirt.pieces).toBe(4);
  expect(shirt.svg).not.toBe(trousers.svg);
  expect(shirt.svg).not.toBe(large.svg);
  expect(patternPreview("teagan", "female-s")).toBe(shirt);
});
test("a full profile library never silently overwrites current measurements", () => {
  const before = newFashion();
  before.profiles = Array.from({ length: 20 }, (_, i) => ({
    id: crypto.randomUUID(),
    name: `Saved ${i}`,
    source: "sample" as const,
    note: "",
    measurements: before.measurements,
  }));
  expect(() => applyStarterProfile(before, "female-s")).toThrow(
    "already holds 20",
  );
  expect(before.profiles).toHaveLength(20);
});
