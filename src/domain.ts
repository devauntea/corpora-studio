import { z } from "zod";

const finite = (min: number, max: number) =>
  z.number().finite().min(min).max(max);
export const BodySchema = z
  .object({
    kind: z.literal("forearm-v1"),
    side: z.enum(["left", "right"]),
    length: finite(160, 400),
    wrist: finite(100, 260),
    elbow: finite(160, 420),
    skin: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })
  .strict();
const AssetSchema = z
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
export const LayerSchema = z
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
export const ProjectSchema = z
  .object({
    format: z.literal("form-studio"),
    version: z.literal(1),
    units: z.literal("mm"),
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    revision: z.string().max(100),
    body: BodySchema,
    assets: z.array(AssetSchema).max(24),
    layers: z.array(LayerSchema).max(24),
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
export type Body = z.infer<typeof BodySchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Asset = Project["assets"][number];

export function blankProject(): Project {
  return {
    format: "form-studio",
    version: 1,
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
    assets: [],
    layers: [],
  };
}
export const wrap = (n: number) => ((n % 1) + 1) % 1;
export const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
export function circumference(body: Body, v: number) {
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
    v: (layer.width * asset.height) / asset.width / body.length,
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
