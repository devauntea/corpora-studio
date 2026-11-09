import { describe, expect, test } from "vitest";
import { rasterPng } from "./raster-fixtures";
import {
  PatternSourcesSchema,
  newPatternSource,
  detectPatternOutlines,
  calibrationTransform,
  sourcePointMm,
  outlineDimensions,
  outlineToPiece,
  reconstructGarment,
  suggestReconstruction,
  sourcePiecesForDraft,
  validatePatternSourceAssets,
  type SourcePoint,
  type PatternSourceStudy,
} from "../src/pattern-source";
import { homography, projectPoint } from "../src/photo-warp";
import { constructPiece, moveAnchor } from "../src/pattern-geometry";
import {
  blankProject,
  ProjectSchema,
  parseProject,
  sha256,
  type Asset,
} from "../src/domain";
import { newFashion } from "../src/fashion-model";
import { draftFashion } from "../src/fashion-draft";

const id = "861ed1ea-fc92-45af-b007-000000000001";
const corners: SourcePoint[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
function source(kind: "pattern" | "garment" = "pattern"): PatternSourceStudy {
  const s = newPatternSource(id, "Measured source", kind);
  s.calibration = { corners, widthMm: 1000, heightMm: 1000, confirmed: true };
  s.outline = [
    [0.2, 0.15],
    [0.75, 0.15],
    [0.75, 0.8],
    [0.2, 0.8],
  ];
  return s;
}
function raster(width = 200, height = 200) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const black = (x: number, y: number) => {
    const p = (y * width + x) * 4;
    data[p] = data[p + 1] = data[p + 2] = 0;
  };
  const line = (ax: number, ay: number, bx: number, by: number) => {
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let i = 0; i <= n; i++)
      black(
        Math.round(ax + ((bx - ax) * i) / n),
        Math.round(ay + ((by - ay) * i) / n),
      );
  };
  const polygon = (points: number[][]) =>
    points.forEach((p, i) =>
      line(
        p[0],
        p[1],
        points[(i + 1) % points.length][0],
        points[(i + 1) % points.length][1],
      ),
    );
  return { width, height, data, black, line, polygon };
}
const options = {
  kind: "pattern" as const,
  threshold: 145,
  inverse: false,
  tolerancePx: 0.5,
};

describe("measured image conversion", () => {
  test("perspective projection returns millimetres within floating-point precision", () => {
    const q: [SourcePoint, SourcePoint, SourcePoint, SourcePoint] = [
      [0.11, 0.16],
      [0.83, 0.08],
      [0.94, 0.86],
      [0.05, 0.92],
    ];
    const s = source();
    s.calibration = {
      corners: q,
      widthMm: 420,
      heightMm: 594,
      confirmed: true,
    };
    const forward = homography(q);
    for (const [u, v] of [
      [0, 0],
      [1, 1],
      [0.25, 0.6],
      [0.7, 0.15],
    ]) {
      const image = projectPoint(forward, u, v),
        p = sourcePointMm(image, s.calibration);
      expect(p.x).toBeCloseTo(u * 420, 8);
      expect(p.y).toBeCloseTo(v * 594, 8);
    }
    const converted = [
      [0.1, 0.2],
      [0.8, 0.2],
      [0.8, 0.7],
      [0.1, 0.7],
    ].map(([u, v]) => projectPoint(forward, u, v));
    expect(outlineDimensions(converted, s.calibration).width).toBeCloseTo(
      294,
      8,
    );
    expect(outlineDimensions(converted, s.calibration).height).toBeCloseTo(
      297,
      8,
    );
  });
  test("scale must be explicitly confirmed and nondegenerate clockwise corners supplied", () => {
    const s = source();
    expect(() =>
      calibrationTransform({ ...s.calibration, confirmed: false }),
    ).toThrow(/confirm/i);
    expect(() =>
      calibrationTransform({ ...s.calibration, corners: corners.slice(0, 3) }),
    ).toThrow(/four/);
    expect(() =>
      calibrationTransform({
        ...s.calibration,
        corners: [corners[0], corners[3], corners[2], corners[1]],
      }),
    ).toThrow(/clockwise/);
    expect(() =>
      calibrationTransform({
        ...s.calibration,
        corners: [
          [0, 0],
          [0.01, 0],
          [0.01, 0.01],
          [0, 0.01],
        ],
      }),
    ).toThrow(/larger/);
    expect(() =>
      calibrationTransform({
        ...s.calibration,
        corners: [
          [0, 0],
          [1, 1],
          [1, 0],
          [0, 1],
        ],
      }),
    ).toThrow(/convex/);
  });
  test("closed outlined rectangle becomes a true-scale editable polygon within one raster pixel", () => {
    const r = raster();
    r.polygon([
      [20, 30],
      [180, 30],
      [180, 170],
      [20, 170],
    ]);
    const outlines = detectPatternOutlines(r, options);
    expect(outlines).toHaveLength(1);
    expect(outlines[0]).toHaveLength(4);
    const s = source();
    s.calibration = { corners, widthMm: 200, heightMm: 200, confirmed: true };
    s.outline = outlines[0];
    const size = outlineDimensions(s.outline, s.calibration);
    expect(size.width).toBeGreaterThanOrEqual(159);
    expect(size.width).toBeLessThanOrEqual(160);
    expect(size.height).toBeGreaterThanOrEqual(139);
    expect(size.height).toBeLessThanOrEqual(140);
    const p = outlineToPiece(s, s.outline, "detected"),
      result = constructPiece(p.id, p.construction);
    expect(result.name).toContain("Measured source");
    expect(p.construction.notches).toEqual([]);
    expect(p.construction.allowances.every((v) => v === 0)).toBe(true);
    expect(p.unresolved.join(" ")).toMatch(/notches.*grain/);
    expect(p.sourceAssetId).toBe(id);
    expect(p.sourceCalibration).toEqual(s.calibration);
  });
  test("concave boundary remains concave, multiple pieces survive and small text islands are ignored", () => {
    const r = raster(300, 200);
    r.polygon([
      [15, 15],
      [120, 15],
      [120, 65],
      [70, 65],
      [70, 170],
      [15, 170],
    ]);
    r.polygon([
      [180, 30],
      [270, 30],
      [270, 170],
      [180, 170],
    ]);
    r.polygon([
      [190, 50],
      [193, 50],
      [193, 55],
      [190, 55],
    ]);
    const o = detectPatternOutlines(r, options);
    expect(o).toHaveLength(2);
    const concave = o.find((p) => p.length > 4)!;
    expect(concave.length).toBeGreaterThanOrEqual(6);
    const signs = concave.map((p, i) => {
      const b = concave[(i + 1) % concave.length],
        c = concave[(i + 2) % concave.length];
      return Math.sign(
        (b[0] - p[0]) * (c[1] - b[1]) - (b[1] - p[1]) * (c[0] - b[0]),
      );
    });
    expect(signs).toContain(-1);
    expect(signs).toContain(1);
  });
  test("open boundaries fail honestly and oversized processing inputs are bounded", () => {
    const r = raster();
    r.line(20, 20, 180, 20);
    r.line(180, 20, 180, 180);
    r.line(180, 180, 20, 180);
    expect(() => detectPatternOutlines(r, options)).toThrow(
      /No closed pattern outline/,
    );
    expect(() =>
      detectPatternOutlines(
        { width: 1201, height: 200, data: r.data },
        options,
      ),
    ).toThrow(/1200/);
    expect(() =>
      detectPatternOutlines(r, { ...options, tolerancePx: NaN }),
    ).toThrow(/Invalid/);
  });
  test("inverse contrast and solid garment silhouettes are both supported", () => {
    const r = raster();
    for (let y = 30; y < 170; y++) for (let x = 40; x < 160; x++) r.black(x, y);
    const o = detectPatternOutlines(r, { ...options, kind: "garment" });
    expect(o).toHaveLength(1);
    expect(
      Math.max(...o[0].map((p) => p[0])) - Math.min(...o[0].map((p) => p[0])),
    ).toBeCloseTo(0.6, 5);
    for (let i = 0; i < r.data.length; i += 4)
      r.data[i] = r.data[i + 1] = r.data[i + 2] = 255 - r.data[i];
    expect(
      detectPatternOutlines(r, { ...options, kind: "garment", inverse: true }),
    ).toEqual(o);
  });
});

describe("explicitly approximate garment construction", () => {
  test("out-of-range measured suggestions fail without silently changing user dimensions", () => {
    const s = source("garment"),
      before = structuredClone(s.reconstruction);
    s.outline = [
      [0.1, 0.1],
      [0.2, 0.1],
      [0.2, 0.8],
      [0.1, 0.8],
    ];
    expect(() => suggestReconstruction(s)).toThrow(/120–1400 mm/);
    expect(s.reconstruction).toEqual(before);
    s.calibration.heightMm = 2000;
    s.outline = [
      [0.1, 0],
      [0.7, 0],
      [0.7, 0.95],
      [0.1, 0.95],
    ];
    expect(() => suggestReconstruction(s)).toThrow(/150–1800 mm/);
    expect(s.reconstruction).toEqual(before);
  });
  test("box-top front and back are real editable curves driven by confirmed dimensions", () => {
    const s = source("garment");
    s.reconstruction = suggestReconstruction(s);
    expect(s.reconstruction.widthMm).toBe(550);
    expect(s.reconstruction.lengthMm).toBe(650);
    expect(() => reconstructGarment(s)).toThrow(/Confirm/);
    s.reconstruction.measurementsConfirmed = true;
    s.reconstruction.constructionConfirmed = true;
    const pieces = reconstructGarment(s);
    expect(pieces).toHaveLength(2);
    expect(pieces[0].reconstruction).toEqual(s.reconstruction);
    for (const p of pieces) {
      expect(() => constructPiece(p.id, p.construction)).not.toThrow();
      expect(p.origin).toBe("approximate");
      expect(p.sourceAssetId).toBe(id);
      expect(p.unresolved.join(" ")).toMatch(/Hidden back/);
    }
    expect(pieces[0].construction.seam).not.toEqual(
      pieces[1].construction.seam,
    );
    expect(
      pieces[0].construction.seam.filter((o) => o.type === "curve"),
    ).toHaveLength(3);
    s.reconstruction.widthMm = 600;
    expect(reconstructGarment(s)[0].construction.seam).not.toEqual(
      pieces[0].construction.seam,
    );
  });
  test("skirt panels and two-piece casing respect hip clearance and coordinate bounds", () => {
    const s = source("garment");
    s.reconstruction = {
      ...s.reconstruction,
      family: "straight-skirt",
      measurementsConfirmed: true,
      constructionConfirmed: true,
    };
    const pieces = reconstructGarment(s);
    expect(pieces).toHaveLength(3);
    expect(pieces[2].construction.cut).toContain("Cut 2");
    for (const p of pieces)
      expect(() => constructPiece(p.id, p.construction)).not.toThrow();
    s.reconstruction.widthMm = 1400;
    expect(() => reconstructGarment(s)).not.toThrow();
    s.reconstruction.widthMm = 400;
    expect(() => reconstructGarment(s)).toThrow(/hip circumference/);
  });
  test("invalid neckline and unmeasured silhouettes cannot silently become finished drafts", () => {
    const s = source("garment");
    s.reconstruction.measurementsConfirmed = true;
    s.reconstruction.constructionConfirmed = true;
    s.reconstruction.neckWidthMm = 400;
    s.reconstruction.widthMm = 300;
    expect(() => reconstructGarment(s)).toThrow(/neckline/);
    s.outline = [];
    expect(() => reconstructGarment(s)).toThrow(/silhouette/);
  });
});

describe("reference inventory and project persistence", () => {
  test("original bytes and calibration snapshots survive save/open along with manually corrected markings", async () => {
    const data = rasterPng(1, 1);
    const a: Asset = {
      id,
      name: "Original.png",
      mime: "image/png",
      data,
      sha256: await sha256(data),
      width: 1,
      height: 1,
      role: "garment",
    };
    const s = source(),
      piece = outlineToPiece(s);
    piece.construction = moveAnchor(piece.construction, 1, { x: 580, y: 0 });
    piece.construction.notches = [{ edge: 2, t: 0.5, double: true }];
    piece.construction.grain = [
      { x: 200, y: 100 },
      { x: 220, y: 550 },
    ];
    piece.construction.name = "Corrected front";
    s.pieces = [piece];
    const inventory = { version: 1 as const, selectedId: s.id, studies: [s] };
    const p = blankProject();
    p.assets = [a];
    p.fashion = {
      ...newFashion(),
      patternSources: inventory,
      construction: sourcePiecesForDraft(s),
      customDraftIds: [piece.id],
    };
    const parsed = await parseProject(JSON.stringify(ProjectSchema.parse(p)));
    expect(parsed.assets[0]).toEqual(a);
    expect(parsed.fashion?.patternSources).toEqual(inventory);
    const draft = draftFashion(parsed.fashion!);
    expect(draft.pieces).toHaveLength(1);
    expect(draft.pieces[0].name).toBe("Corrected front");
    expect(parsed.fashion?.construction?.[piece.id].notches[0].double).toBe(
      true,
    );
    expect(parsed.fashion?.measurements).toEqual(newFashion().measurements);
    const copy = sourcePiecesForDraft(s);
    copy[piece.id].name = "Detached copy";
    expect(piece.construction.name).toBe("Corrected front");
  });
  test("changing primary reference cannot rewrite a generated piece's evidence", () => {
    const s = source(),
      p = outlineToPiece(s),
      second = crypto.randomUUID();
    s.pieces = [p];
    s.sourceAssetIds.push(second);
    s.primaryAssetId = second;
    s.calibration = { ...s.calibration, corners: [], confirmed: false };
    const saved = PatternSourcesSchema.parse({ version: 1, studies: [s] });
    expect(saved.studies[0].pieces[0].sourceAssetId).toBe(id);
    expect(saved.studies[0].pieces[0].sourceCalibration.confirmed).toBe(true);
    expect(() =>
      validatePatternSourceAssets(saved, [
        { id, mime: "image/png", width: 200, height: 200 },
      ]),
    ).toThrow(/preserved/);
    expect(() =>
      validatePatternSourceAssets(saved, [
        { id, mime: "image/png", width: 200, height: 200 },
        { id: second, mime: "image/jpeg", width: 100, height: 100 },
      ]),
    ).not.toThrow();
    s.sourceAssetIds = [second];
    expect(
      PatternSourcesSchema.safeParse({ version: 1, studies: [s] }).success,
    ).toBe(false);
  });
  test("inventory rejects duplicate IDs, unsupported fields and detached source evidence", () => {
    const s = source();
    s.pieces = [outlineToPiece(s)];
    expect(
      PatternSourcesSchema.safeParse({ version: 1, studies: [s, s] }).success,
    ).toBe(false);
    expect(
      PatternSourcesSchema.safeParse({
        version: 1,
        studies: [{ ...s, pieces: [s.pieces[0], s.pieces[0]] }],
      }).success,
    ).toBe(false);
    expect(
      PatternSourcesSchema.safeParse({
        version: 1,
        studies: [s],
        remoteUrl: "https://example.com",
      }).success,
    ).toBe(false);
    expect(
      PatternSourcesSchema.safeParse({
        version: 1,
        studies: [s],
        selectedId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });
  test("construction selection cannot reference missing geometry or unrelated originals", () => {
    const s = source();
    s.pieces = [outlineToPiece(s)];
    const p = blankProject();
    p.fashion = {
      ...newFashion(),
      patternSources: { version: 1, studies: [s] },
    };
    expect(ProjectSchema.safeParse(p).success).toBe(false);
    p.fashion = { ...newFashion(), customDraftIds: [s.pieces[0].id] };
    expect(ProjectSchema.safeParse(p).success).toBe(false);
  });
});
