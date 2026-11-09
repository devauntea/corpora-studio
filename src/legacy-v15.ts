// Frozen project 15 schema, including unreleased body revision 7.
import { TattooStudySchema } from "./tattoo-study";
import {
  BodyStudySchema as CurrentBodyStudySchema,
  FitShapeSchema,
} from "./body-fitting";
import { LatticeSchema } from "./lattice-warp";
import { QuadSchema } from "./photo-warp";
import { ProcessingSchema } from "./image-processing";
import { FashionSchema } from "./legacy-fashion-v18";
import { z } from "zod";

const BodyStudySchema = CurrentBodyStudySchema.superRefine((study, ctx) => {
  if ((study.result?.modelRevision ?? 4) > 7)
    ctx.addIssue({
      code: "custom",
      message: "Version 15 does not support revision 8 fitting",
    });
});

const finite = (min: number, max: number) =>
  z.number().finite().min(min).max(max);
const LegacyBodySchema = z
  .object({
    kind: z.literal("forearm-v1"),
    side: z.enum(["left", "right"]),
    length: finite(160, 400),
    wrist: finite(100, 260),
    elbow: finite(160, 420),
    skin: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })
  .strict();
const LegacyAssetSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(180),
    mime: z.enum(["image/png", "image/jpeg"]),
    data: z
      .string()
      .max(22_000_000)
      .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    width: finite(1, 8192).int(),
    height: finite(1, 8192).int(),
  })
  .strict();
const LegacyLayerSchema = z
  .object({
    id: z.string().uuid(),
    assetId: z.string().uuid(),
    name: z.string().min(1).max(180),
    visible: z.boolean(),
    u: finite(0, 1),
    v: finite(0, 1),
    width: finite(5, 400),
    rotation: finite(-180, 180),
    opacity: finite(0, 1),
    removePaper: z.boolean(),
    monochrome: z.boolean(),
  })
  .strict();
export const LegacyProjectSchema = z
  .object({
    format: z.literal("form-studio"),
    version: z.literal(1),
    units: z.literal("mm"),
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    revision: z.string().max(100),
    body: LegacyBodySchema,
    assets: z.array(LegacyAssetSchema).max(24),
    layers: z.array(LegacyLayerSchema).max(24),
  })
  .strict()
  .superRefine((p, ctx) => {
    const ids = new Set(p.assets.map((a) => a.id));
    if (p.assets.reduce((sum, a) => sum + a.width * a.height, 0) > 64_000_000)
      ctx.addIssue({
        code: "custom",
        message: "Artwork exceeds the 64 megapixel project budget",
      });
    if (
      ids.size !== p.assets.length ||
      new Set(p.layers.map((l) => l.id)).size !== p.layers.length
    )
      ctx.addIssue({ code: "custom", message: "Duplicate asset or layer ID" });
    for (const layer of p.layers)
      if (!ids.has(layer.assetId))
        ctx.addIssue({
          code: "custom",
          message: `Missing artwork for ${layer.name}`,
        });
  });
export const regions = ["upper-arm", "calf", "thigh", "torso"] as const;
export const humanSections = [
  "full-arm",
  "upper-body",
  "full-leg",
  "full-body",
  "neck",
] as const;
export const surfaceZones = [
  "trunk",
  "left-arm",
  "right-arm",
  "left-leg",
  "right-leg",
  "neck",
] as const;
export type SurfaceZone = (typeof surfaceZones)[number];
const ArmPoseSchema = z
  .object({
    flex: finite(0, 110),
    raise: finite(0, 120),
    twist: finite(-90, 90),
  })
  .strict();
export type ArmPose = z.infer<typeof ArmPoseSchema>;
const HumanBodySchema = z
  .object({
    kind: z.literal("human-v1"),
    section: z.enum(humanSections),
    side: z.enum(["left", "right"]),
    length: finite(80, 2200),
    build: finite(0.75, 1.35),
    fitting: FitShapeSchema.optional(),
    muscularity: finite(0, 1),
    musclePose: z
      .enum(["relaxed", "chest-flex", "back-flex", "double-biceps"])
      .optional(),
    muscleTension: finite(0, 1).optional(),
    flex: finite(0, 110),
    armPose: z
      .object({ left: ArmPoseSchema, right: ArmPoseSchema })
      .strict()
      .optional(),
    anatomy: z.boolean(),
    model: z
      .object({
        revision: z.union([
          z.literal(2),
          z.literal(3),
          z.literal(4),
          z.literal(5),
          z.literal(6),
          z.literal(7),
        ]),
        sex: z.enum(["male", "female"]),
        physique: z.enum(["fit", "average"]),
        anatomyOpacity: finite(0, 1),
      })
      .strict()
      .optional(),
    skin: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })
  .strict();
const CropSchema = z
  .object({
    x: finite(0, 0.99),
    y: finite(0, 0.99),
    width: finite(0.01, 1),
    height: finite(0.01, 1),
  })
  .strict()
  .refine(
    (c) => c.x + c.width <= 1 + 1e-9 && c.y + c.height <= 1 + 1e-9,
    "Crop must stay inside the source image",
  );
export type ArtworkCrop = z.infer<typeof CropSchema>;
export const fullCrop = (): ArtworkCrop => ({
  x: 0,
  y: 0,
  width: 1,
  height: 1,
});
export const ArtworkEditsSchema = z
  .object({
    crop: CropSchema.optional(),
    background: z.enum(["none", "white", "black", "color"]),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    tolerance: finite(0, 180),
    feather: finite(1, 100),
    grayscale: z.boolean(),
    contrast: finite(0.25, 3),
    processing: ProcessingSchema.optional(),
    drawing: z
      .array(
        z
          .object({
            mode: z.enum(["draw", "erase"]),
            color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
            radius: finite(0.000001, 0.2),
            points: z
              .array(z.tuple([finite(0, 1), finite(0, 1), finite(0, 1)]))
              .min(1)
              .max(2000),
          })
          .strict(),
      )
      .max(200)
      .optional(),
    strokes: z
      .array(
        z
          .object({
            mode: z.enum(["erase", "restore"]),
            radius: finite(0.000001, 0.2),
            points: z
              .array(z.tuple([finite(0, 1), finite(0, 1)]))
              .min(1)
              .max(2000),
          })
          .strict(),
      )
      .max(200),
  })
  .strict();
export type ArtworkEdits = z.infer<typeof ArtworkEditsSchema>;
export const cleanArtwork = (): ArtworkEdits => ({
  background: "none",
  color: "#ffffff",
  tolerance: 30,
  feather: 20,
  grayscale: false,
  contrast: 1,
  strokes: [],
});
export const BodySchema = z.discriminatedUnion("kind", [
  LegacyBodySchema,
  HumanBodySchema,
  z
    .object({
      kind: z.literal("region-v1"),
      region: z.enum(regions),
      side: z.enum(["left", "right"]),
      length: finite(160, 800),
      distal: finite(100, 1600),
      proximal: finite(100, 1600),
      depth: finite(0.4, 1.2),
      muscularity: finite(0, 1),
      skin: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    })
    .strict(),
]);
const AssetSchema = LegacyAssetSchema.extend({
  mime: z.enum(["image/png", "image/jpeg", "image/heic"]),
  data: z
    .string()
    .max(22_000_000)
    .regex(/^data:image\/(png|jpeg|heic);base64,[A-Za-z0-9+/=]+$/),
  preview: z
    .string()
    .max(22_000_000)
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/)
    .optional(),
  previewSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  role: z.enum(["artwork", "body", "garment"]).optional(),
  edits: ArtworkEditsSchema.optional(),
}).superRefine((a, c) => {
  if ((a.mime === "image/heic") !== Boolean(a.preview && a.previewSha256))
    c.addIssue({ code: "custom", message: "HEIC preview required" });
});
/** Newest immutable body asset revision offered for new and re-selected bodies. */
export const LATEST_BODY_REVISION = 7 as const;
export const LayerSchema = LegacyLayerSchema.extend({
  groupId: z.string().uuid().optional(),
  surface: z
    .object({
      vertex: finite(0, 249999).int(),
      revision: z.union([
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
        z.literal(6),
        z.literal(7),
      ]),
      sex: z.enum(["male", "female"]),
    })
    .strict()
    .optional(),
  zone: z.enum(surfaceZones).optional(),
  locked: z.boolean().optional(),
  flipX: z.boolean().optional(),
  flipY: z.boolean().optional(),
  stretch: finite(0.2, 5).optional(),
  ink: z
    .enum(["legacy", "black", "gray", "soft", "color", "custom", "stencil"])
    .optional(),
  inkColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  contrast: finite(0.25, 3).optional(),
  saturation: finite(0, 2).optional(),
  threshold: finite(0, 255).optional(),
  blend: z.enum(["multiply", "source-over"]).optional(),
  photoId: z.string().uuid().optional(),
  photo: z
    .object({
      x: finite(0, 1),
      y: finite(0, 1),
      width: finite(0.01, 2),
      skew: finite(-0.7, 0.7),
      warp: QuadSchema.optional(),
      lattice: LatticeSchema.optional(),
    })
    .strict()
    .optional(),
}).superRefine((l, c) => {
  if (l.surface && l.photoId)
    c.addIssue({
      code: "custom",
      message: "A surface placement cannot belong to a photograph",
    });
  if (Boolean(l.photoId) !== Boolean(l.photo))
    c.addIssue({ code: "custom", message: "Incomplete photo placement" });
});
const StrokeSchema = z
  .object({
    radius: finite(0.001, 0.15),
    points: z
      .array(z.tuple([finite(0, 1), finite(0, 1)]))
      .min(1)
      .max(2000),
  })
  .strict();
export const PhotoSchema = z
  .object({
    id: z.string().uuid(),
    assetId: z.string().uuid(),
    masks: z.array(StrokeSchema).max(200),
  })
  .strict();
export const ProjectSchema = z
  .object({
    format: z.literal("form-studio"),
    version: z.literal(15),
    units: z.literal("mm"),
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    revision: z.string().max(100),
    body: BodySchema,
    assets: z.array(AssetSchema).max(24),
    layers: z.array(LayerSchema).max(24),
    photos: z.array(PhotoSchema).max(8),
    fashion: FashionSchema.optional(),
    bodyStudy: BodyStudySchema.optional(),
    tattooStudy: TattooStudySchema.optional(),
    groups: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            name: z.string().min(1).max(60),
            visible: z.boolean(),
            locked: z.boolean(),
            opacity: finite(0, 1),
          })
          .strict(),
      )
      .max(12)
      .optional(),
  })
  .strict()
  .superRefine((p, c) => {
    if (
      p.body.kind === "human-v1" &&
      (p.body.section === "full-body" || p.body.section === "neck") &&
      (p.body.model?.revision ?? 0) < 4
    )
      c.addIssue({
        code: "custom",
        message:
          "Full body and neck require the continuous revision 4 or later surface",
      });
    const issue = (message: string) => c.addIssue({ code: "custom", message });
    if (
      p.photos.reduce(
        (n, ph) => n + ph.masks.reduce((n, s) => n + s.points.length, 0),
        0,
      ) > 80_000
    )
      issue("Protection mask exceeds 80,000 points");
    if (
      p.assets.some(
        (a) => (a.role === "body" || a.role === "garment") && a.edits,
      )
    )
      issue("Artwork edits cannot be applied to body photographs");
    if (
      p.assets.reduce(
        (n, a) =>
          n +
          (a.edits?.strokes.reduce((n, s) => n + s.points.length, 0) ?? 0) +
          (a.edits?.drawing?.reduce((n, s) => n + s.points.length, 0) ?? 0),
        0,
      ) > 80_000
    )
      issue("Artwork masks exceed 80,000 points");
    const groupIds = new Set(p.groups?.map((g) => g.id));
    if (groupIds.size !== (p.groups?.length ?? 0))
      issue("Duplicate layer group");
    if (p.layers.some((l) => l.groupId && !groupIds.has(l.groupId)))
      issue("Missing layer group");
    if (
      p.tattooStudy?.stencils.some(
        (s) =>
          !p.assets.some(
            (a) =>
              a.id === s.assetId && a.role !== "body" && a.role !== "garment",
          ),
      )
    )
      issue("Missing stencil artwork");
    const ids = new Set(p.assets.map((a) => a.id)),
      photoIds = new Set(p.photos.map((a) => a.id));
    if (
      ids.size !== p.assets.length ||
      photoIds.size !== p.photos.length ||
      new Set(p.layers.map((l) => l.id)).size !== p.layers.length
    )
      issue("Duplicate ID");
    if (p.assets.reduce((n, a) => n + a.width * a.height, 0) > 64_000_000)
      issue("64 megapixel budget exceeded");
    if (
      p.assets.reduce(
        (n, a) => n + a.data.length + (a.preview?.length ?? 0),
        0,
      ) > 70_000_000
    )
      issue("70 MB image budget exceeded");
    for (const a of p.assets)
      if (
        a.width * a.height > 32_000_000 ||
        Math.floor((a.data.split(",")[1].length * 3) / 4) > 15_000_002
      )
        issue("Source image budget exceeded");
    for (const view of p.bodyStudy?.views ?? [])
      if (!p.assets.some((a) => a.id === view.assetId && a.role === "body"))
        issue("Missing fitting photograph");
    if (
      p.fashion?.photoStudy &&
      !p.assets.some(
        (a) => a.id === p.fashion!.photoStudy!.assetId && a.role === "garment",
      )
    )
      issue("Missing garment study photograph");
    for (const ph of p.photos)
      if (!p.assets.some((a) => a.id === ph.assetId && a.role === "body"))
        issue("Missing body photo");
    for (const l of p.layers)
      if (
        !p.assets.some(
          (a) =>
            a.id === l.assetId && a.role !== "body" && a.role !== "garment",
        ) ||
        (l.photoId && !photoIds.has(l.photoId))
      )
        issue("Missing layer source or photo");
  });
