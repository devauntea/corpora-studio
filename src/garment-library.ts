import { groupSelection, pruneGroups } from "./vector-selection";
import { z } from "zod";
import {
  VectorNodeSchema,
  VectorPackSchema,
  type VectorLayer,
  type VectorPack,
  type VectorView,
} from "./vector-pack";
export type GarmentAsset = {
  id: string;
  name: string;
  category: string;
  source: string;
  sourceSize: number[];
  sha256: string;
  views: {
    label: string;
    file: string;
    preview: string;
    width: number;
    height: number;
    nodes: number;
  }[];
};
// Garment flats are installed locally with scripts/import-garment-assets.py
// and are not part of the repository, so the catalog is optional at build time.
const installed = import.meta.glob<GarmentAsset[]>(
  "../public/garment-assets/catalog.json",
  { eager: true, import: "default" },
);
export const garmentAssets: GarmentAsset[] = Object.values(installed)[0] ?? [];
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
  let next = pruneGroups({
    ...pack,
    layers: [
      ...pack.layers.filter((l) => !replace || !views.has(l.view)),
      ...layers,
    ],
    callouts: pack.callouts.filter((c) => !replace || !views.has(c.view)),
  });
  for (const view of views) {
    const members = layers.filter((l) => l.view === view);
    if (members.length >= 2)
      next = groupSelection(
        next,
        members.map((l) => l.id),
        members[0].name.split(" · ").slice(0, 2).join(" · ").slice(0, 80),
      );
  }
  return VectorPackSchema.parse(next);
}
