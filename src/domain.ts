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
const LegacyProjectSchema = z
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
export type Photo = z.infer<typeof PhotoSchema>;
export type Body = z.infer<typeof BodySchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Asset = Project["assets"][number];

export function blankProject(): Project {
  return {
    format: "form-studio",
    version: 2,
    units: "mm",
    id: crypto.randomUUID(),
    name: "Untitled composition",
    revision: "Study 01",
    body: {
      kind: "forearm-v1",
      side: "left",
      length: 270,
      wrist: 165,
      elbow: 265,
      skin: "#c49b7d",
    },
    photos: [],
    assets: [],
    layers: [],
  };
}
export const wrap = (n: number) => ((n % 1) + 1) % 1;
export const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
export function circumference(body: Body, v: number) {
  if (body.kind === "region-v1")
    return (
      body.distal +
      (body.proximal - body.distal) * v +
      (body.region === "torso" ? -30 : 35) *
        Math.sin(Math.PI * v) *
        (0.4 + body.muscularity)
    );
  // The two entered circumferences remain exact at the boundaries.
  return (
    body.wrist + (body.elbow - body.wrist) * v + 18 * Math.sin(Math.PI * v)
  );
}
// A fixed ellipse ratio lets every cross-section share an arc-length lookup.
// This makes u a perimeter fraction, rather than an angle fraction.
const ELLIPSE_RATIO = 1.13;
const ARC_STEPS = 8192;
const arc = new Float64Array(ARC_STEPS + 1);
for (let i = 1; i <= ARC_STEPS; i++) {
  const a = ((i - 1) / ARC_STEPS - 0.5) * Math.PI * 2,
    b = (i / ARC_STEPS - 0.5) * Math.PI * 2;
  arc[i] =
    arc[i - 1] +
    Math.hypot(
      ELLIPSE_RATIO * (Math.sin(b) - Math.sin(a)),
      Math.cos(b) - Math.cos(a),
    );
}
const ellipsePerimeter = arc[ARC_STEPS];
for (let i = 0; i <= ARC_STEPS; i++) arc[i] /= ellipsePerimeter;
function surfaceAngle(u: number) {
  let lo = 0,
    hi = ARC_STEPS;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (arc[mid] < u) lo = mid;
    else hi = mid;
  }
  const t = (u - arc[lo]) / (arc[hi] - arc[lo]);
  return ((lo + t) / ARC_STEPS - 0.5) * Math.PI * 2;
}
export function surfacePoint(
  body: Body,
  u: number,
  v: number,
): [number, number, number] {
  if (body.kind === "region-v1") return regionPoint(body, u, v);
  const theta = surfaceAngle(u);
  const b = circumference(body, v) / ellipsePerimeter;
  const lean = (body.side === "left" ? -1 : 1) * 8 * Math.sin(Math.PI * v);
  return [
    Math.sin(theta) * b * ELLIPSE_RATIO + lean,
    (v - 0.5) * body.length,
    Math.cos(theta) * b,
  ];
}
export function placementSize(body: Body, layer: Layer, asset: Asset) {
  return {
    u: layer.width / circumference(body, layer.v),
    v:
      (layer.width * asset.height * (layer.stretch ?? 1)) /
      asset.width /
      body.length,
  };
}
export function newLayer(asset: Asset): Layer {
  return {
    id: crypto.randomUUID(),
    assetId: asset.id,
    name: asset.name.replace(/\.[^.]+$/, ""),
    visible: true,
    u: 0.5,
    v: 0.52,
    width: 90,
    rotation: 0,
    opacity: 0.9,
    removePaper: true,
    monochrome: true,
  };
}
export async function sha256(dataUrl: string) {
  const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (c) =>
    c.charCodeAt(0),
  );
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function parseProject(text: string): Promise<Project> {
  if (text.length > 80_000_000)
    throw new Error("Project exceeds the 80 MB limit.");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("This file is not a valid Form Studio project.");
  }
  // Validate the old schema BEFORE migration: no new meanings are assigned to old fields.
  if ((json as { version?: number })?.version === 1) {
    const old = LegacyProjectSchema.safeParse(json);
    if (!old.success) throw new Error("Unsupported or damaged legacy project.");
    json = { ...old.data, version: 2, photos: [] };
  }
  const result = ProjectSchema.safeParse(json);
  if (!result.success)
    throw new Error(
      "Unsupported or damaged project. Check the file version and measurements.",
    );
  for (const asset of result.data.assets) {
    if (
      !asset.data.startsWith(`data:${asset.mime};base64,`) ||
      (await sha256(asset.data)) !== asset.sha256
    )
      throw new Error(`Artwork integrity check failed: ${asset.name}`);
  }
  for (const asset of result.data.assets) {
    if (asset.preview && (await sha256(asset.preview)) !== asset.previewSha256)
      throw new Error(`Photo preview integrity check failed: ${asset.name}`);
  }
  return result.data;
}

export type History<T> = {
  present: T;
  past: T[];
  future: T[];
  transaction?: T;
};
export type HistoryAction<T> =
  | { type: "change"; value: T }
  | { type: "reset"; value: T }
  | { type: "begin" | "commit" | "undo" | "redo" };
export function historyReducer<T>(
  state: History<T>,
  action: HistoryAction<T>,
): History<T> {
  const finish = (s: History<T>): History<T> =>
    s.transaction === undefined
      ? s
      : {
          ...s,
          transaction: undefined,
          past:
            s.transaction === s.present
              ? s.past
              : [...s.past.slice(-99), s.transaction],
          future: s.transaction === s.present ? s.future : [],
        };
  switch (action.type) {
    case "reset":
      return { present: action.value, past: [], future: [] };
    case "begin":
      return state.transaction === undefined
        ? { ...state, transaction: state.present }
        : state;
    case "commit":
      return finish(state);
    case "change":
      return action.value === state.present
        ? state
        : state.transaction !== undefined
          ? { ...state, present: action.value }
          : {
              present: action.value,
              past: [...state.past.slice(-99), state.present],
              future: [],
            };
    case "undo": {
      const s = finish(state);
      if (!s.past.length) return s;
      return {
        present: s.past.at(-1)!,
        past: s.past.slice(0, -1),
        future: [s.present, ...s.future],
      };
    }
    case "redo": {
      const s = finish(state);
      if (!s.future.length) return s;
      return {
        present: s.future[0],
        past: [...s.past, s.present],
        future: s.future.slice(1),
      };
    }
  }
}

export function bodyLabel(body: Body) {
  return body.kind === "forearm-v1"
    ? `${body.side === "left" ? "Left" : "Right"} forearm`
    : body.region === "torso"
      ? "Torso · chest / abdomen / back"
      : `${body.side === "left" ? "Left" : "Right"} ${body.region.replace("-", " ")}`;
}
export function regionBody(
  region: (typeof regions)[number],
  previous: Body,
): Body {
  const dimensions = {
    "upper-arm": [310, 265, 340, 0.9],
    calf: [400, 220, 360, 0.85],
    thigh: [430, 380, 570, 0.9],
    torso: [550, 850, 1050, 0.62],
  }[region];
  return {
    kind: "region-v1",
    region,
    side: previous.side,
    skin: previous.skin,
    length: dimensions[0],
    distal: dimensions[1],
    proximal: dimensions[2],
    depth: dimensions[3],
    muscularity: 0.4,
  };
}
// Closed, arc-length parameterized cross sections; measurements set their circumference.
// This is a controllable planning template, not a biomechanical or scanned body model.
const sections = new Map<
  string,
  { points: [number, number][]; arc: number[]; length: number }
>();
function regionPoint(
  body: Extract<Body, { kind: "region-v1" }>,
  u: number,
  v: number,
): [number, number, number] {
  const key = JSON.stringify(body) + ":" + v;
  let section = sections.get(key);
  if (!section) {
    const points: [number, number][] = [],
      arc = [0];
    let length = 0;
    for (let i = 0; i <= 1024; i++) {
      const t = (i / 1024 - 0.5) * Math.PI * 2,
        taper = Math.sin(Math.PI * v);
      let shape =
        1 +
        0.14 *
          body.muscularity *
          taper *
          Math.cos(t * 3 + (body.region === "torso" ? 0 : v * 1.3));
      if (body.region === "torso") {
        const gaussian = (x: number, c: number, s: number) =>
          Math.exp(-(((x - c) / s) ** 2));
        const upper = gaussian(v, 0.75, 0.2),
          lower = gaussian(v, 0.38, 0.27);
        // Paired shoulder-blade masses and a spinal groove; paired anterior masses.
        const blades = gaussian(Math.abs(t), 2.45, 0.3) * upper;
        const spine =
          gaussian(Math.abs(t), Math.PI, 0.16) * Math.sin(Math.PI * v);
        const pecs = gaussian(Math.abs(t), 0.55, 0.33) * upper;
        const abdomen = gaussian(Math.abs(t), 0.28, 0.2) * lower;
        shape =
          1 +
          (0.25 + body.muscularity * 0.75) *
            (0.25 * blades - 0.18 * spine + 0.18 * pecs + 0.1 * abdomen);
      }
      const width =
        body.region === "torso" ? 1 + 0.13 * Math.sin((v * Math.PI) / 2) : 1;
      const point: [number, number] = [
        Math.sin(t) * width * shape,
        Math.cos(t) * body.depth * shape,
      ];
      if (i) {
        length += Math.hypot(
          point[0] - points[i - 1][0],
          point[1] - points[i - 1][1],
        );
        arc.push(length);
      }
      points.push(point);
    }
    section = { points, arc, length };
    if (sections.size >= 300) sections.clear();
    sections.set(key, section);
  }
  const target = clamp(u, 0, 1) * section.length;
  let lo = 0,
    hi = 1024;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (section.arc[mid] < target) lo = mid;
    else hi = mid;
  }
  const f = (target - section.arc[lo]) / (section.arc[hi] - section.arc[lo]),
    a = section.points[lo],
    b = section.points[hi],
    scale = circumference(body, v) / section.length;
  const lean =
    body.region === "torso"
      ? 0
      : (body.side === "left" ? -1 : 1) * 9 * Math.sin(Math.PI * v);
  return [
    (a[0] + (b[0] - a[0]) * f) * scale + lean,
    (v - 0.5) * body.length,
    (a[1] + (b[1] - a[1]) * f) * scale,
  ];
}
export const imageSource = (a: Asset) => a.preview ?? a.data;
export const artworkAssets = (p: Project) =>
  p.assets.filter((a) => a.role !== "body");
export function layerForPhoto(asset: Asset, photoId?: string): Layer {
  return {
    ...newLayer(asset),
    ...(photoId
      ? { photoId, photo: { x: 0.5, y: 0.5, width: 0.25, skew: 0 } }
      : {}),
  };
}
