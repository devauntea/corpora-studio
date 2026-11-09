import { z } from "zod";
import { ConstructionSchema, type Construction } from "./fashion-construction";
import { homography, inverse, projectPoint, type Quad } from "./photo-warp";
import { constructPiece } from "./pattern-geometry";
import type { Asset } from "./domain";

export const PATTERN_SOURCE_LIMITS = {
  studies: 8,
  references: 6,
  pieces: 12,
  points: 128,
  rasterEdge: 1200,
  rasterPixels: 1_440_000,
} as const;
const normalizedPoint = z.tuple([
  z.number().finite().min(0).max(1),
  z.number().finite().min(0).max(1),
]);
export type SourcePoint = z.infer<typeof normalizedPoint>;
const pieceId = z.string().regex(/^[a-zA-Z][a-zA-Z0-9.-]{0,59}$/);
export const SourceCalibrationSchema = z
  .object({
    corners: z.array(normalizedPoint).max(4),
    widthMm: z.number().finite().min(10).max(2000),
    heightMm: z.number().finite().min(10).max(2000),
    confirmed: z.boolean(),
  })
  .strict();
export type SourceCalibration = z.infer<typeof SourceCalibrationSchema>;
const ReconstructionSchema = z
  .object({
    family: z.enum(["box-top", "straight-skirt"]),
    widthMm: z.number().finite().min(120).max(1400),
    lengthMm: z.number().finite().min(150).max(1800),
    neckWidthMm: z.number().finite().min(60).max(400),
    frontNeckDepthMm: z.number().finite().min(20).max(300),
    backNeckDepthMm: z.number().finite().min(10).max(100),
    armholeDepthMm: z.number().finite().min(80).max(500),
    hipCircumferenceMm: z.number().finite().min(500).max(2000),
    casingWidthMm: z.number().finite().min(15).max(100),
    allowanceMm: z.number().finite().min(0).max(30),
    measurementsConfirmed: z.boolean(),
    constructionConfirmed: z.boolean(),
    assumptions: z.string().max(2000),
  })
  .strict();
export type ReconstructionRecipe = z.infer<typeof ReconstructionSchema>;
export const SourcePieceSchema = z
  .object({
    id: pieceId,
    construction: ConstructionSchema,
    sourceAssetId: z.string().uuid(),
    sourceCalibration: SourceCalibrationSchema,
    reconstruction: ReconstructionSchema.optional(),
    origin: z.enum(["detected", "manual", "approximate"]),
    unresolved: z.array(z.string().min(1).max(300)).max(12),
    sourceOutline: z
      .array(normalizedPoint)
      .min(3)
      .max(PATTERN_SOURCE_LIMITS.points)
      .optional(),
  })
  .strict()
  .superRefine((piece, context) => {
    try {
      calibrationTransform(piece.sourceCalibration);
    } catch {
      context.addIssue({
        code: "custom",
        message: "An imported piece needs its confirmed source calibration.",
      });
    }
    if (
      piece.origin === "approximate" &&
      (!piece.reconstruction?.measurementsConfirmed ||
        !piece.reconstruction?.constructionConfirmed)
    )
      context.addIssue({
        code: "custom",
        message:
          "An approximate piece needs its confirmed construction recipe.",
      });
  });
export type SourcePiece = z.infer<typeof SourcePieceSchema>;
export const PatternSourceStudySchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().max(100),
    kind: z.enum(["pattern", "garment"]),
    sourceAssetIds: z
      .array(z.string().uuid())
      .min(1)
      .max(PATTERN_SOURCE_LIMITS.references),
    primaryAssetId: z.string().uuid(),
    sourceNote: z.string().max(1500),
    permission: z.enum(["unknown", "own", "licensed", "permission"]),
    permissionNote: z.string().max(1500),
    calibration: SourceCalibrationSchema,
    detector: z
      .object({
        threshold: z.number().int().min(20).max(240),
        inverse: z.boolean(),
        tolerancePx: z.number().finite().min(0.25).max(5),
      })
      .strict(),
    outline: z.array(normalizedPoint).max(PATTERN_SOURCE_LIMITS.points),
    pieces: z.array(SourcePieceSchema).max(PATTERN_SOURCE_LIMITS.pieces),
    reconstruction: ReconstructionSchema,
    createdAt: z.string().datetime(),
    modifiedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((s, c) => {
    if (
      new Set(s.sourceAssetIds).size !== s.sourceAssetIds.length ||
      !s.sourceAssetIds.includes(s.primaryAssetId)
    )
      c.addIssue({
        code: "custom",
        message: "Reference IDs must be unique and include the primary image.",
      });
    if (s.pieces.some((p) => !s.sourceAssetIds.includes(p.sourceAssetId)))
      c.addIssue({
        code: "custom",
        message: "Piece reference is missing from this study.",
      });
    if (new Set(s.pieces.map((p) => p.id)).size !== s.pieces.length)
      c.addIssue({ code: "custom", message: "Duplicate imported piece ID." });
  });
export type PatternSourceStudy = z.infer<typeof PatternSourceStudySchema>;
export const PatternSourcesSchema = z
  .object({
    version: z.literal(1),
    selectedId: z.string().uuid().optional(),
    studies: z
      .array(PatternSourceStudySchema)
      .max(PATTERN_SOURCE_LIMITS.studies),
  })
  .strict()
  .superRefine((s, c) => {
    if (
      new Set(s.studies.map((x) => x.id)).size !== s.studies.length ||
      (s.selectedId && !s.studies.some((x) => x.id === s.selectedId))
    )
      c.addIssue({
        code: "custom",
        message: "Invalid pattern inventory selection or duplicate study.",
      });
    const ids = s.studies.flatMap((x) => x.pieces.map((p) => p.id));
    if (new Set(ids).size !== ids.length)
      c.addIssue({
        code: "custom",
        message: "Pattern inventory piece IDs must be unique.",
      });
    if (ids.length > 40)
      c.addIssue({
        code: "custom",
        message: "Keep at most 40 imported pieces across this inventory.",
      });
  });
export type PatternSources = z.infer<typeof PatternSourcesSchema>;
export const emptyPatternSources = (): PatternSources => ({
  version: 1,
  studies: [],
});
export function newPatternSource(
  assetId: string,
  name: string,
  kind: "pattern" | "garment",
): PatternSourceStudy {
  return PatternSourceStudySchema.parse({
    id: crypto.randomUUID(),
    name: name.slice(0, 100),
    kind,
    sourceAssetIds: [assetId],
    primaryAssetId: assetId,
    sourceNote: "",
    permission: "unknown",
    permissionNote: "",
    calibration: { corners: [], widthMm: 210, heightMm: 297, confirmed: false },
    detector: { threshold: 145, inverse: false, tolerancePx: 1 },
    outline: [],
    pieces: [],
    reconstruction: {
      family: "box-top",
      widthMm: 550,
      lengthMm: 650,
      neckWidthMm: 190,
      frontNeckDepthMm: 90,
      backNeckDepthMm: 30,
      armholeDepthMm: 220,
      hipCircumferenceMm: 980,
      casingWidthMm: 35,
      allowanceMm: 10,
      measurementsConfirmed: false,
      constructionConfirmed: false,
      assumptions:
        "Front-facing flat lay. Hidden back, darts, closures and fabric behavior cannot be recovered from a photograph. Make a toile and review seams before cutting final fabric.",
    },
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
  });
}
export function validatePatternSourceAssets(
  data: PatternSources,
  assets: Pick<Asset, "id" | "mime" | "width" | "height">[],
): void {
  PatternSourcesSchema.parse(data);
  for (const study of data.studies)
    for (const id of study.sourceAssetIds) {
      const asset = assets.find((a) => a.id === id);
      if (!asset || !["image/png", "image/jpeg"].includes(asset.mime))
        throw new Error(
          "A pattern reference must point to a preserved PNG or JPEG original.",
        );
    }
}
export function calibrationTransform(calibration: SourceCalibration): number[] {
  SourceCalibrationSchema.parse(calibration);
  if (calibration.corners.length !== 4 || !calibration.confirmed)
    throw new Error(
      "Mark four reference corners and confirm its measured width and height first.",
    );
  const q = calibration.corners as Quad;
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i],
      b = q[(i + 1) % 4],
      c = q[(i + 2) % 4];
    if (
      (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) <=
      0.00001
    )
      throw new Error(
        "Reference corners must be convex, clockwise from top-left.",
      );
    area += a[0] * b[1] - b[0] * a[1];
  }
  if (area / 2 < 0.002)
    throw new Error("Use a larger reference rectangle for reliable scale.");
  return inverse(homography(q));
}
export function sourcePointMm(
  point: SourcePoint,
  calibration: SourceCalibration,
): { x: number; y: number } {
  const mapped = projectPoint(
    calibrationTransform(calibration),
    point[0],
    point[1],
  );
  const x = mapped[0] * calibration.widthMm,
    y = mapped[1] * calibration.heightMm;
  if (!Number.isFinite(x + y) || Math.abs(x) > 5000 || Math.abs(y) > 5000)
    throw new Error("This point lies outside the stable calibrated plane.");
  return { x, y };
}
export function outlineDimensions(
  outline: SourcePoint[],
  calibration: SourceCalibration,
) {
  if (outline.length < 3)
    throw new Error("Trace or detect at least three outline points.");
  const points = outline.map((p) => sourcePointMm(p, calibration));
  const minX = Math.min(...points.map((p) => p.x)),
    maxX = Math.max(...points.map((p) => p.x)),
    minY = Math.min(...points.map((p) => p.y)),
    maxY = Math.max(...points.map((p) => p.y));
  const width = maxX - minX,
    height = maxY - minY;
  if (width < 5 || height < 5 || width > 2200 || height > 2200)
    throw new Error(
      "The measured outline must span 5–2200 mm in each direction. Check the reference scale.",
    );
  return {
    width,
    height,
    points: points.map((p) => ({ x: p.x - minX, y: p.y - minY })),
  };
}
function freshPieceId(studyId: string) {
  return `ps-${studyId.slice(0, 8)}-${crypto.randomUUID().slice(0, 8)}`;
}
const unknownMarks = [
  "Labels, cut quantity, notches and grain direction require manual checking.",
  "Seam versus cutting line is not recognized. Confirm the boundary before adding allowance.",
  "Scale assumes the image and reference rectangle share a flat plane. Validate a printed test length.",
];
export function outlineToPiece(
  study: PatternSourceStudy,
  outline = study.outline,
  origin: "detected" | "manual" = "manual",
): SourcePiece {
  if (outline.length > PATTERN_SOURCE_LIMITS.points)
    throw new Error("Use at most 128 editable outline points.");
  const { width, height, points } = outlineDimensions(
      outline,
      study.calibration,
    ),
    id = freshPieceId(study.id);
  const seam: Construction["seam"] = [
    { type: "move", to: points[0] },
    ...points.slice(1).map((to) => ({ type: "line" as const, to })),
    { type: "close" },
  ];
  const construction: Construction = {
    name: `${study.name || "Imported pattern"} ${study.pieces.length + 1}`.slice(
      0,
      80,
    ),
    cut: "Confirm cut quantity and boundary",
    seam,
    allowances: seam.map(() => 0),
    notches: [],
    darts: [],
    guides: [],
    grain: [
      { x: width * 0.5, y: height * 0.25 },
      { x: width * 0.5, y: height * 0.75 },
    ],
    label: { x: width * 0.5, y: height * 0.5 },
  };
  constructPiece(id, construction);
  return SourcePieceSchema.parse({
    id,
    construction,
    sourceAssetId: study.primaryAssetId,
    sourceCalibration: structuredClone(study.calibration),
    origin,
    sourceOutline: outline,
    unresolved: unknownMarks,
  });
}
function pointLineDistance(p: SourcePoint, a: SourcePoint, b: SourcePoint) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    t = Math.max(
      0,
      Math.min(
        1,
        ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function simplifyLine(points: SourcePoint[], epsilon: number): SourcePoint[] {
  if (points.length <= 2) return points;
  let max = epsilon,
    index = -1;
  for (let i = 1; i < points.length - 1; i++) {
    const d = pointLineDistance(points[i], points[0], points.at(-1)!);
    if (d > max) {
      max = d;
      index = i;
    }
  }
  if (index < 0) return [points[0], points.at(-1)!];
  return [
    ...simplifyLine(points.slice(0, index + 1), epsilon).slice(0, -1),
    ...simplifyLine(points.slice(index), epsilon),
  ];
}
function simplifyClosed(points: SourcePoint[], epsilon: number): SourcePoint[] {
  let far = 1;
  for (let i = 2; i < points.length; i++)
    if (
      Math.hypot(points[i][0] - points[0][0], points[i][1] - points[0][1]) >
      Math.hypot(points[far][0] - points[0][0], points[far][1] - points[0][1])
    )
      far = i;
  return [
    ...simplifyLine(points.slice(0, far + 1), epsilon).slice(0, -1),
    ...simplifyLine([...points.slice(far), points[0]], epsilon).slice(0, -1),
  ];
}
/** Detect enclosed light interiors for scans, or solid dark silhouettes for
 * photos. Bounded connected-component tracing preserves concave outlines;
 * labels/markings are deliberately not inferred. No ML or network is used. */
export function detectPatternOutlines(
  raster: { width: number; height: number; data: ArrayLike<number> },
  options: {
    kind: "pattern" | "garment";
    threshold: number;
    inverse: boolean;
    tolerancePx: number;
  },
): SourcePoint[][] {
  const { width, height, data } = raster;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 8 ||
    height < 8 ||
    width > PATTERN_SOURCE_LIMITS.rasterEdge ||
    height > PATTERN_SOURCE_LIMITS.rasterEdge ||
    width * height > PATTERN_SOURCE_LIMITS.rasterPixels ||
    data.length !== width * height * 4
  )
    throw new Error("Detection raster must be 8–1200 pixels per side.");
  if (
    !Number.isFinite(options.threshold) ||
    options.threshold < 20 ||
    options.threshold > 240 ||
    !Number.isFinite(options.tolerancePx) ||
    options.tolerancePx < 0.25 ||
    options.tolerancePx > 5
  )
    throw new Error("Invalid outline detection settings.");
  const size = width * height,
    mask = new Uint8Array(size),
    labels = new Uint32Array(size),
    queue = new Uint32Array(size);
  for (let i = 0; i < size; i++) {
    const a = data[i * 4 + 3] / 255,
      l =
        (0.2126 * data[i * 4] +
          0.7152 * data[i * 4 + 1] +
          0.0722 * data[i * 4 + 2]) *
          a +
        255 * (1 - a),
      dark = options.inverse ? l > options.threshold : l < options.threshold;
    mask[i] = Number(options.kind === "pattern" ? !dark : dark);
  }
  const components: {
    id: number;
    area: number;
    edge: boolean;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }[] = [];
  let next = 0;
  for (let start = 0; start < size; start++) {
    if (!mask[start] || labels[start]) continue;
    next++;
    let read = 0,
      write = 1;
    queue[0] = start;
    labels[start] = next;
    const c = {
      id: next,
      area: 0,
      edge: false,
      minX: width,
      minY: height,
      maxX: 0,
      maxY: 0,
    };
    while (read < write) {
      const p = queue[read++],
        x = p % width,
        y = Math.floor(p / width);
      c.area++;
      c.minX = Math.min(c.minX, x);
      c.maxX = Math.max(c.maxX, x);
      c.minY = Math.min(c.minY, y);
      c.maxY = Math.max(c.maxY, y);
      if (!x || !y || x === width - 1 || y === height - 1) c.edge = true;
      for (const n of [
        x ? p - 1 : -1,
        x < width - 1 ? p + 1 : -1,
        y ? p - width : -1,
        y < height - 1 ? p + width : -1,
      ])
        if (n >= 0 && mask[n] && !labels[n]) {
          labels[n] = next;
          queue[write++] = n;
        }
    }
    if (
      !c.edge &&
      c.area > Math.max(64, size * 0.003) &&
      c.maxX - c.minX > 8 &&
      c.maxY - c.minY > 8
    )
      components.push(c);
  }
  components.sort((a, b) => b.area - a.area);
  const result: SourcePoint[][] = [];
  for (const c of components.slice(0, 12)) {
    const stride = width + 1,
      edges = new Map<number, number[]>();
    const add = (a: number, b: number) => {
      const list = edges.get(a) ?? [];
      list.push(b);
      edges.set(a, list);
    };
    for (let y = c.minY; y <= c.maxY; y++)
      for (let x = c.minX; x <= c.maxX; x++) {
        const p = y * width + x;
        if (labels[p] !== c.id) continue;
        const a = y * stride + x,
          b = a + 1,
          d = a + stride,
          e = d + 1;
        if (!y || labels[p - width] !== c.id) add(a, b);
        if (x === width - 1 || labels[p + 1] !== c.id) add(b, e);
        if (y === height - 1 || labels[p + width] !== c.id) add(e, d);
        if (!x || labels[p - 1] !== c.id) add(d, a);
      }
    let best: SourcePoint[] = [],
      bestArea = 0;
    while (edges.size) {
      const start = edges.keys().next().value as number;
      let current = start;
      const loop: SourcePoint[] = [];
      let steps = 0;
      do {
        loop.push([current % stride, Math.floor(current / stride)]);
        const list = edges.get(current);
        if (!list?.length) break;
        const end = list.pop()!;
        if (!list.length) edges.delete(current);
        current = end;
      } while (current !== start && ++steps < size * 4);
      if (current !== start || loop.length < 4) continue;
      const area = Math.abs(
        loop.reduce(
          (n, p, i) =>
            n +
            p[0] * loop[(i + 1) % loop.length][1] -
            loop[(i + 1) % loop.length][0] * p[1],
          0,
        ),
      );
      if (area > bestArea) {
        bestArea = area;
        best = loop;
      }
    }
    if (best.length < 4) continue;
    let epsilon = options.tolerancePx,
      simplified = simplifyClosed(best, epsilon);
    while (simplified.length > PATTERN_SOURCE_LIMITS.points) {
      epsilon *= 1.3;
      simplified = simplifyClosed(best, epsilon);
    }
    if (simplified.length >= 3)
      result.push(
        simplified.map(([x, y]) => [
          Math.min(1, x / width),
          Math.min(1, y / height),
        ]),
      );
  }
  if (!result.length)
    throw new Error(
      options.kind === "pattern"
        ? "No closed pattern outline found. Use a clear, unbroken outline on a plain background, adjust the threshold, or trace it manually."
        : "No isolated garment silhouette found. Use a contrasting plain flat-lay background, reverse contrast, or trace the silhouette manually.",
    );
  return result;
}
export function suggestReconstruction(
  study: PatternSourceStudy,
): ReconstructionRecipe {
  const { width, height } = outlineDimensions(study.outline, study.calibration);
  if (width < 120 || width > 1400 || height < 150 || height > 1800)
    throw new Error(
      "The measured silhouette is outside the supported draft range: panel width 120–1400 mm and garment length 150–1800 mm. Check the reference scale or enter independently measured supported dimensions; no values have been changed.",
    );
  return ReconstructionSchema.parse({
    ...study.reconstruction,
    widthMm: Math.round(width),
    lengthMm: Math.round(height),
    measurementsConfirmed: false,
    constructionConfirmed: false,
  });
}
/** Bounded manual-assumption drafts, not hidden-seam recovery. Geometry is
 * ordinary editable Construction data, identical to manually authored pieces. */
export function reconstructGarment(study: PatternSourceStudy): SourcePiece[] {
  const r = ReconstructionSchema.parse(study.reconstruction);
  if (!r.measurementsConfirmed || !r.constructionConfirmed)
    throw new Error(
      "Confirm the garment measurements and construction assumptions before generating an approximate draft.",
    );
  if (study.outline.length < 3)
    throw new Error("Trace a measured garment silhouette first.");
  outlineDimensions(study.outline, study.calibration);
  const unresolved = [
    "Approximate draft from visible silhouette and user-confirmed assumptions; not a recovered production pattern.",
    "Hidden back, shaping, closures, material stretch and seam construction remain uncertain. Make a toile and check fit.",
  ];
  const make = (
    name: string,
    seam: Construction["seam"],
    width: number,
    height: number,
  ): SourcePiece => {
    const id = freshPieceId(study.id),
      construction: Construction = {
        name,
        cut: name.includes("casing")
          ? "Cut 2; join short ends; elastic length requires fitting"
          : "Cut 1; confirm fabric and assembly",
        seam,
        allowances: seam.map(() => r.allowanceMm),
        notches: [],
        darts: [],
        guides: [],
        grain: [
          { x: width / 2, y: height * 0.25 },
          { x: width / 2, y: height * 0.75 },
        ],
        label: { x: width / 2, y: height * 0.55 },
      };
    constructPiece(id, construction);
    return {
      id,
      construction,
      sourceAssetId: study.primaryAssetId,
      sourceCalibration: structuredClone(study.calibration),
      sourceOutline: structuredClone(study.outline),
      reconstruction: structuredClone(r),
      origin: "approximate",
      unresolved,
    };
  };
  const rect = (w: number, h: number): Construction["seam"] => [
    { type: "move", to: { x: 0, y: 0 } },
    { type: "line", to: { x: w, y: 0 } },
    { type: "line", to: { x: w, y: h } },
    { type: "line", to: { x: 0, y: h } },
    { type: "close" },
  ];
  if (r.family === "straight-skirt") {
    if (r.widthMm * 2 < r.hipCircumferenceMm + 40)
      throw new Error(
        "For this pull-on skirt, the two panels must clear the confirmed hip circumference by at least 40 mm. Increase panel width or use a different construction method.",
      );
    return [
      make(
        "Approximate skirt · front",
        rect(r.widthMm, r.lengthMm),
        r.widthMm,
        r.lengthMm,
      ),
      make(
        "Approximate skirt · back",
        rect(r.widthMm, r.lengthMm),
        r.widthMm,
        r.lengthMm,
      ),
      make(
        "Approximate skirt · elastic casing",
        rect(r.widthMm, r.casingWidthMm * 2),
        r.widthMm,
        r.casingWidthMm * 2,
      ),
    ];
  }
  if (
    r.neckWidthMm >= r.widthMm * 0.8 ||
    r.armholeDepthMm >= r.lengthMm * 0.7 ||
    r.frontNeckDepthMm >= r.armholeDepthMm
  )
    throw new Error(
      "Keep neckline inside the shoulder width and above the armhole; armholes must leave usable side seams.",
    );
  const outline = (depth: number): Construction["seam"] => {
    const w = r.widthMm,
      h = r.lengthMm,
      n = r.neckWidthMm,
      a = r.armholeDepthMm,
      shoulderDrop = 25;
    return [
      { type: "move", to: { x: (w - n) / 2, y: 0 } },
      {
        type: "curve",
        cp1: { x: (w - n) / 2, y: depth * 1.33 },
        cp2: { x: (w + n) / 2, y: depth * 1.33 },
        to: { x: (w + n) / 2, y: 0 },
      },
      { type: "line", to: { x: w, y: shoulderDrop } },
      {
        type: "curve",
        cp1: { x: w - 30, y: a * 0.45 },
        cp2: { x: w - 20, y: a * 0.8 },
        to: { x: w, y: a },
      },
      { type: "line", to: { x: w, y: h } },
      { type: "line", to: { x: 0, y: h } },
      { type: "line", to: { x: 0, y: a } },
      {
        type: "curve",
        cp1: { x: 20, y: a * 0.8 },
        cp2: { x: 30, y: a * 0.45 },
        to: { x: 0, y: shoulderDrop },
      },
      { type: "close" },
    ];
  };
  return [
    make(
      "Approximate box top · front",
      outline(r.frontNeckDepthMm),
      r.widthMm,
      r.lengthMm,
    ),
    make(
      "Approximate box top · back",
      outline(r.backNeckDepthMm),
      r.widthMm,
      r.lengthMm,
    ),
  ];
}
export function sourcePiecesForDraft(
  study: PatternSourceStudy,
): Record<string, Construction> {
  PatternSourceStudySchema.parse(study);
  if (!study.pieces.length)
    throw new Error("Create at least one editable piece first.");
  const pieces: Record<string, Construction> = {};
  for (const piece of study.pieces) {
    constructPiece(piece.id, piece.construction);
    pieces[piece.id] = structuredClone(piece.construction);
  }
  return pieces;
}
