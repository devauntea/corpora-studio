import { describe, test, expect } from "vitest";
import {
  newFashion,
  lowerBodySample,
  FashionSchema,
  type DesignId,
} from "../src/fashion-model";
import { draftFashion } from "../src/fashion-draft";
import { designControls, fabricWarnings } from "../src/design-adapters";
import { patternPdf, patternSvg } from "../src/fashion-export";
import { gradeCsv, gradeSvg } from "../src/FashionGrades";
import { blankProject, parseProject } from "../src/domain";
describe("garment catalog and profiles", () => {
  const base = () => ({
    ...newFashion(),
    measurements: {
      ...newFashion().measurements,
      ...lowerBodySample,
      hips: 920,
      waistToHips: 120,
    },
  });
  for (const design of ["brian", "titan", "sarah", "simon"] as DesignId[])
    test(`${design} drafts and exports all visible pieces`, async () => {
      const f = { ...base(), design },
        d = draftFashion(f);
      expect(d.pieces.length).toBeGreaterThanOrEqual(2);
      for (const p of d.pieces) {
        expect(p.width).toBeGreaterThan(5);
        expect(p.height).toBeGreaterThan(5);
        expect(p.seam.length).toBeGreaterThan(3);
        expect(p.cut).not.toContain("according to");
      }
      if (design === "simon") {
        expect(d.pieces.length).toBe(10);
        expect(
          d.pieces.find((p) => p.id === "simon.cuff")?.marks?.length,
        ).toBeGreaterThan(0);
      }
      const svg = patternSvg(d, f, "Catalog <test>");
      expect(svg).not.toMatch(/NaN|Infinity/);
      expect(svg).toContain("Catalog &lt;test&gt;");
      const pdf = await patternPdf(d, f, "Catalog test");
      expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
    });
  test("required measurements and options are checked before the engine", () => {
    const incomplete = {
      ...newFashion(),
      measurements: { ...newFashion().measurements, waistToFloor: undefined },
    };
    expect(() => draftFashion({ ...incomplete, design: "titan" })).toThrow(
      /required measurements/,
    );
    expect(() =>
      draftFashion({
        ...base(),
        design: "titan",
        designOptions: { waistEase: 20 },
      }),
    ).toThrow(/Invalid waistEase/);
    expect(() =>
      draftFashion({
        ...base(),
        design: "simon",
        designOptions: { badOption: 1 },
      }),
    ).toThrow(/Unsupported/);
    expect(
      designControls("simon").find((o) => o.key === "sleeveStyle")?.list,
    ).toContain("short");
  });
  test("grades independently regenerate each profile and survive project roundtrip", async () => {
    const f = base(),
      p1 = {
        id: crypto.randomUUID(),
        name: "First",
        source: "tape" as const,
        note: "measured",
        measurements: f.measurements,
      };
    const p2 = {
      ...p1,
      id: crypto.randomUUID(),
      name: "Second",
      measurements: { ...p1.measurements, chest: 1100 },
    };
    const series = { ...f, profiles: [p1, p2], gradeIds: [p1.id, p2.id] };
    expect(gradeSvg(series)).toContain("independent drafts");
    const csv = gradeCsv(series).split("\r\n");
    expect(csv.length).toBe(9);
    expect(csv[1].split(",")[2]).not.toBe(csv[5].split(",")[2]);
    const project = { ...blankProject(), fashion: series };
    expect(await parseProject(JSON.stringify(project))).toEqual(project);
  });
  test("fabric compares negative ease with extension rather than equating percentages", () => {
    const f = {
      ...base(),
      design: "brian" as const,
      designOptions: { chestEase: -4 },
      fabric: {
        name: "Sample",
        structure: "knit" as const,
        stretchWidth: 4,
        stretchLength: 0,
        recovery: 95,
        gsm: 180,
        fiber: "cotton",
      },
    };
    expect(fabricWarnings(f).join(" ")).toContain("4.2%");
    expect(
      FashionSchema.safeParse({ ...f, fabric: { ...f.fabric, gsm: Infinity } })
        .success,
    ).toBe(false);
  });
});
