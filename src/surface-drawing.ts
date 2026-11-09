import {
  circumference,
  humanChartSize,
  newLayer,
  sha256,
  ProjectSchema,
  type Project,
  type SurfaceZone,
} from "./domain";
import { loadImage } from "./io";
export type SurfaceStroke = {
  zone: SurfaceZone;
  points: [number, number, number][];
  color: string;
  size: number;
  erase: boolean;
};
export type DrawingTargets = Map<string, string>;
export function drawingKey(p: Project, zone: SurfaceZone) {
  const b = p.body;
  return JSON.stringify([
    b.kind,
    b.kind === "human-v1"
      ? [b.section, b.side, b.model?.revision, b.model?.sex, b.model?.sculptId]
      : b.kind,
    zone,
  ]);
}
/** Unwrap only the cylindrical seam; never connect across an off-model gap. */
export function unwrapStroke(points: SurfaceStroke["points"]) {
  return points.reduce<SurfaceStroke["points"]>((out, [u, v, pressure]) => {
    u = ((u % 1) + 1) % 1;
    if (out.length) u += Math.round(out.at(-1)![0] - u);
    out.push([u, v, pressure]);
    return out;
  }, []);
}
export function paintSurfaceStroke(
  ctx: CanvasRenderingContext2D,
  stroke: SurfaceStroke,
  chart: { width: number; height: number },
) {
  const points = unwrapStroke(stroke.points);
  ctx.save();
  ctx.scale(ctx.canvas.width / chart.width, ctx.canvas.height / chart.height);
  ctx.globalCompositeOperation = stroke.erase
    ? "destination-out"
    : "source-over";
  ctx.strokeStyle = ctx.fillStyle = stroke.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)],
      b = points[i];
    const radius = (stroke.size * Math.max(0.2, (a[2] + b[2]) / 2)) / 2;
    // Draw only copies which intersect the chart, even after several seam crossings.
    for (
      let shift = Math.floor(-Math.max(a[0], b[0])) - 1;
      shift <= Math.ceil(1 - Math.min(a[0], b[0])) + 1;
      shift++
    ) {
      const x = (b[0] + shift) * chart.width,
        y = (1 - b[1]) * chart.height;
      ctx.lineWidth = radius * 2;
      ctx.beginPath();
      ctx.moveTo((a[0] + shift) * chart.width, (1 - a[1]) * chart.height);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
/** A stroke is one undoable project edit; generated PNGs remain ordinary editable artwork. */
export async function applySurfaceDrawing(
  project: Project,
  strokes: SurfaceStroke[],
  targets: DrawingTargets,
) {
  let result = project;
  let selected: string | undefined;
  const updatedTargets = new Map(targets);
  for (const zone of new Set(strokes.map((s) => s.zone))) {
    const chart =
      project.body.kind === "human-v1"
        ? humanChartSize(project.body, zone)
        : {
            width: circumference(project.body, 0.5),
            height: project.body.length,
          };
    const key = drawingKey(project, zone),
      id =
        targets.get(key) ??
        result.layers.find((l) => l.surfaceDrawing === key)?.id;
    const existing = result.layers.find(
      (l) =>
        l.id === id &&
        !l.locked &&
        l.visible &&
        !l.groupId &&
        !l.surface &&
        !l.photoId &&
        l.u === 0.5 &&
        l.v === 0.5 &&
        l.width === chart.width &&
        l.rotation === 0 &&
        !l.flipX &&
        !l.flipY &&
        (!l.stretch || l.stretch === 1),
    );
    const previous =
      existing &&
      result.assets.find((a) => a.id === existing.assetId && !a.edits);
    const ink = strokes.filter((s) => s.zone === zone);
    if (!previous && ink.every((s) => s.erase)) continue;
    if (!previous && (result.assets.length >= 24 || result.layers.length >= 24))
      throw new Error(
        "This project has reached its 24-layer artwork limit. Remove a layer before drawing on another surface.",
      );
    const canvas = document.createElement("canvas");
    const scale = 2048 / Math.max(chart.width, chart.height);
    canvas.width = Math.max(1, Math.round(chart.width * scale));
    canvas.height = Math.max(1, Math.round(chart.height * scale));
    const ctx = canvas.getContext("2d")!;
    if (previous)
      ctx.drawImage(
        await loadImage(previous.data),
        0,
        0,
        canvas.width,
        canvas.height,
      );
    for (const stroke of ink) paintSurfaceStroke(ctx, stroke, chart);
    const data = canvas.toDataURL("image/png");
    const asset = {
      id: previous?.id ?? crypto.randomUUID(),
      name: `Drawn ink · ${zone}`,
      mime: "image/png" as const,
      data,
      sha256: await sha256(data),
      width: canvas.width,
      height: canvas.height,
    };
    const layer =
      previous && existing
        ? existing
        : {
            ...newLayer(asset),
            surfaceDrawing: key,
            zone,
            u: 0.5,
            v: 0.5,
            width: chart.width,
            opacity: 1,
            removePaper: false,
            monochrome: false,
          };
    result = {
      ...result,
      assets: previous
        ? result.assets.map((a) => (a.id === asset.id ? asset : a))
        : [...result.assets, asset],
      layers: previous ? result.layers : [...result.layers, layer],
    };
    selected = layer.id;
    updatedTargets.set(key, layer.id);
  }
  if (result !== project) ProjectSchema.parse(result);
  return { project: result, targets: updatedTargets, selected };
}
