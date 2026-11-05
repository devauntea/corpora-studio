import catalog from "../public/garment-assets/catalog.json";
import { z } from "zod";
import {
  VectorNodeSchema,
  VectorPackSchema,
  type VectorLayer,
  type VectorPack,
  type VectorView,
} from "./vector-pack";
export const garmentAssets = catalog;
export type GarmentAsset = (typeof catalog)[number];
export const assetUrl = (id: string, file: string) =>
  `${import.meta.env.BASE_URL}garment-assets/${encodeURIComponent(id)}/${encodeURIComponent(file)}`;
const TraceSchema = z
  .object({
    width: z.number().positive().max(1800),
    height: z.number().positive().max(1800),
    shapes: z
      .array(
        z
          .object({
            fill: z.string().regex(/^#[0-9a-f]{6}$/),
            contours: z
              .array(z.array(VectorNodeSchema).min(2).max(2000))
              .min(1)
              .max(5000),
          })
          .strict(),
      )
      .max(3),
  })
  .strict();
export type GarmentTrace = z.infer<typeof TraceSchema>;
export function parseGarmentTrace(raw: unknown): GarmentTrace {
  const trace = TraceSchema.parse(raw);
  if (
    trace.shapes.reduce(
      (n, s) => n + s.contours.reduce((n, c) => n + c.length, 0),
      0,
    ) > 60000
  )
    throw new Error("Garment exceeds the anchor limit.");
  return trace;
}
export async function loadGarmentTrace(
  asset: GarmentAsset,
  index: number,
  signal?: AbortSignal,
) {
  const view = asset.views[index];
  if (!view) throw new Error("Choose a garment view.");
  const response = await fetch(assetUrl(asset.id, view.file), { signal });
  if (!response.ok)
    throw new Error("The local garment asset could not be loaded.");
  const raw = await response.text();
  if (raw.length > 15_000_000) throw new Error("Garment asset exceeds 15 MB.");
  return parseGarmentTrace(JSON.parse(raw));
}
export function garmentLayers(
  asset: GarmentAsset,
  index: number,
  trace: GarmentTrace,
  view: VectorView,
  scale?: number,
): VectorLayer[] {
  trace = parseGarmentTrace(trace);
  const ratio = scale ?? Math.min(420 / trace.width, 510 / trace.height);
  const x = (480 - trace.width * ratio) / 2,
    y = 70 + (510 - trace.height * ratio) / 2;
  const point = (p: { x: number; y: number }) => ({
    x: Math.round((x + p.x * ratio) * 1000) / 1000,
    y: Math.round((y + p.y * ratio) * 1000) / 1000,
  });
  return trace.shapes.map((s) => {
    const contours = s.contours.map((c) =>
      c.map((n) => ({
        ...point(n),
        ...(n.in ? { in: point(n.in) } : {}),
        ...(n.out ? { out: point(n.out) } : {}),
      })),
    );
    const label =
      s.fill === "#181818"
        ? "Linework"
        : s.fill === "#ffffff"
          ? "Highlights"
          : "Fabric";
    return {
      id: crypto.randomUUID(),
      name: `${asset.name} · ${asset.views[index].label} · ${label}`.slice(
        0,
        80,
      ),
      view,
      nodes: contours[0],
      contours: contours.slice(1),
      closed: true,
      fill: s.fill,
      stroke: s.fill,
      strokeWidth: 0,
      dashed: false,
      visible: true,
      locked: false,
      material: "",
    };
  });
}
export function placeGarment(
  pack: VectorPack,
  layers: VectorLayer[],
  replace: boolean,
) {
  const views = new Set(layers.map((l) => l.view));
  return VectorPackSchema.parse({
    ...pack,
    layers: [
      ...pack.layers.filter((l) => !replace || !views.has(l.view)),
      ...layers,
    ],
    callouts: pack.callouts.filter((c) => !replace || !views.has(c.view)),
  });
}
