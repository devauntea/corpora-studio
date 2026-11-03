// Frozen v2 reader. Never change saved meanings here.
import { z } from "zod";

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
export const BodySchema = z.discriminatedUnion("kind", [
  LegacyBodySchema,
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
  role: z.enum(["artwork", "body"]).optional(),
}).superRefine((a, c) => {
  if ((a.mime === "image/heic") !== Boolean(a.preview && a.previewSha256))
    c.addIssue({ code: "custom", message: "HEIC preview required" });
});
export const LayerSchema = LegacyLayerSchema.extend({
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
    })
    .strict()
    .optional(),
}).superRefine((l, c) => {
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
    version: z.literal(2),
    units: z.literal("mm"),
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    revision: z.string().max(100),
    body: BodySchema,
    assets: z.array(AssetSchema).max(24),
    layers: z.array(LayerSchema).max(24),
    photos: z.array(PhotoSchema).max(8),
  })
  .strict()
  .superRefine((p, c) => {
    const issue = (message: string) => c.addIssue({ code: "custom", message });
    if (
      p.photos.reduce(
        (n, ph) => n + ph.masks.reduce((n, s) => n + s.points.length, 0),
        0,
      ) > 80_000
    )
      issue("Protection mask exceeds 80,000 points");
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
    for (const ph of p.photos)
      if (!p.assets.some((a) => a.id === ph.assetId && a.role === "body"))
        issue("Missing body photo");
    for (const l of p.layers)
      if (
        !p.assets.some((a) => a.id === l.assetId && a.role !== "body") ||
        (l.photoId && !photoIds.has(l.photoId))
      )
        issue("Missing layer source or photo");
  });
