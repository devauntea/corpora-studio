import { VectorPackSchema as LegacyVectorPackSchema } from "./legacy-vector-v1";
import { VectorPackSchema as V2Schema } from "./legacy-vector-v2";
import { VectorPackSchema as V3Schema } from "./legacy-vector-v3";
import { z } from "zod";
import { TextileSchema } from "./textiles";
const number = (min: number, max: number) =>
  z.number().finite().min(min).max(max);
const text = (max: number) => z.string().max(max);
const point = z
  .object({ x: number(-1000, 2000), y: number(-1000, 2000) })
  .strict();
export const VectorNodeSchema = point.extend({
  in: point.optional(),
  out: point.optional(),
});
export const VectorLayerSchema = z
  .object({
    id: z.string().uuid(),
    name: text(80),
    view: z.enum(["front", "back"]),
    nodes: z.array(VectorNodeSchema).min(2).max(2000),
    contours: z
      .array(z.array(VectorNodeSchema).min(2).max(2000))
      .max(5000)
      .optional(),
    closed: z.boolean(),
    fill: z.union([z.literal("none"), z.string().regex(/^#[0-9a-fA-F]{6}$/)]),
    stroke: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    strokeWidth: number(0, 12),
    dashed: z.boolean(),
    visible: z.boolean(),
    locked: z.boolean(),
    material: text(80),
    textile: TextileSchema.optional(),
    fillRule: z.enum(["nonzero", "evenodd"]).optional(),
    lineCap: z.enum(["butt", "round", "square"]).optional(),
    lineJoin: z.enum(["miter", "round", "bevel"]).optional(),
  })
  .strict();
const CalloutSchema = z
  .object({
    id: z.string().uuid(),
    view: z.enum(["front", "back"]),
    anchor: point,
    label: point,
    text: text(240),
    layerId: z.string().uuid().optional(),
    materialId: z.string().uuid().optional(),
    measurementId: z.string().uuid().optional(),
  })
  .strict();
const PackBaseSchema = z
  .object({
    version: z.literal(4),
    name: text(100),
    style: text(80),
    revision: text(60),
    season: text(80),
    manufacturer: text(120),
    notes: text(5000),
    units: z.enum(["cm", "in"]),
    sizes: z.array(z.string().min(1).max(20)).min(1).max(8),
    layers: z.array(VectorLayerSchema).max(200),
    callouts: z.array(CalloutSchema).max(40),
    groups: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            name: text(80),
            layerIds: z.array(z.string().uuid()).min(2).max(200),
          })
          .strict(),
      )
      .max(100),
    sources: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            name: text(180),
            original: text(500000),
            width: text(80),
            height: text(80),
            viewBox: text(200),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            conversion: text(400),
          })
          .strict(),
      )
      .max(8),
    measurements: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            name: text(100),
            method: text(240),
            tolerance: number(0, 100),
            toleranceConfirmed: z.boolean().optional(),
            values: z.array(number(0, 1000).nullable()).max(8),
          })
          .strict(),
      )
      .max(60),
    materials: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            code: text(80),
            kind: z.enum(["Fabric", "Trim", "Label", "Packaging"]),
            description: text(240),
            composition: text(120),
            color: text(100),
            quantity: number(0, 10000),
            unit: text(30),
            supplier: text(150),
          })
          .strict(),
      )
      .max(60),
  })
  .strict();
const RevisionSpecSchema = PackBaseSchema.pick({
  name: true,
  style: true,
  revision: true,
  season: true,
  manufacturer: true,
  notes: true,
  units: true,
  sizes: true,
  measurements: true,
  materials: true,
  callouts: true,
});
export const DevelopmentSchema = z
  .object({
    revisions: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            name: z.string().min(1).max(100),
            createdAt: z.string().datetime(),
            summary: z.string().max(2000),
            spec: RevisionSpecSchema,
            drawingHash: z.string().regex(/^[a-f0-9]{64}$/),
            drawingSignature: z
              .string()
              .regex(/^\d+:[a-f0-9]+:[a-f0-9]+$/)
              .max(40),
          })
          .strict(),
      )
      .max(20),
    samples: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            name: z.string().min(1).max(100),
            revisionId: z.string().uuid(),
            size: z.string().min(1).max(20),
            recordedAt: z.string().datetime(),
            notes: z.string().max(3000),
            measurements: z
              .array(
                z
                  .object({
                    measurementId: z.string().uuid(),
                    value: number(0, 1000).nullable(),
                    notes: z.string().max(500),
                  })
                  .strict(),
              )
              .max(60),
          })
          .strict(),
      )
      .max(40),
    colorways: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            name: z.string().min(1).max(100),
            materials: z
              .array(
                z
                  .object({
                    materialId: z.string().uuid(),
                    color: z.string().max(100),
                    reference: z.string().max(150),
                  })
                  .strict(),
              )
              .max(60),
          })
          .strict(),
      )
      .max(20),
  })
  .strict()
  .superRefine((d, c) => {
    for (const rows of [d.revisions, d.samples, d.colorways])
      if (new Set(rows.map((r) => r.id)).size !== rows.length)
        c.addIssue({
          code: "custom",
          message: "Duplicate development record ID",
        });
    if (
      new Set(d.revisions.map((r) => r.spec.revision)).size !==
      d.revisions.length
    )
      c.addIssue({
        code: "custom",
        message: "Recorded revision labels must be unique",
      });
    for (const r of d.revisions) {
      if (
        new Set(r.spec.sizes).size !== r.spec.sizes.length ||
        r.spec.measurements.some((m) => m.values.length !== r.spec.sizes.length)
      )
        c.addIssue({ code: "custom", message: "Invalid revision size table" });
      for (const rows of [
        r.spec.measurements,
        r.spec.materials,
        r.spec.callouts,
      ])
        if (new Set(rows.map((v) => v.id)).size !== rows.length)
          c.addIssue({
            code: "custom",
            message: "Duplicate revision specification ID",
          });
    }
    for (const s of d.samples) {
      const r = d.revisions.find((r) => r.id === s.revisionId);
      if (
        !r ||
        s.measurements.length !== r.spec.measurements.length ||
        !r.spec.sizes.includes(s.size) ||
        s.measurements.some(
          (m) => !r.spec.measurements.some((p) => p.id === m.measurementId),
        ) ||
        new Set(s.measurements.map((m) => m.measurementId)).size !==
          s.measurements.length
      )
        c.addIssue({
          code: "custom",
          message:
            "Sample must refer to an existing revision, size and points of measure",
        });
    }
    for (const w of d.colorways)
      if (
        new Set(w.materials.map((m) => m.materialId)).size !==
        w.materials.length
      )
        c.addIssue({ code: "custom", message: "Duplicate colorway material" });
  });
export const VectorPackSchema = PackBaseSchema.extend({
  development: DevelopmentSchema.optional(),
})
  .strict()
  .superRefine((p, c) => {
    const members = p.groups.flatMap((g) => g.layerIds);
    if (
      new Set(p.groups.map((g) => g.id)).size !== p.groups.length ||
      new Set(members).size !== members.length ||
      members.some((id) => !p.layers.some((l) => l.id === id))
    )
      c.addIssue({
        code: "custom",
        message: "Groups must have unique, existing layer members",
      });
    if (new Set(p.sources.map((s) => s.id)).size !== p.sources.length)
      c.addIssue({ code: "custom", message: "Duplicate SVG source ID" });
    if (new Set(p.sizes).size !== p.sizes.length)
      c.addIssue({ code: "custom", message: "Size names must be unique" });
    for (const rows of [p.layers, p.callouts, p.measurements, p.materials])
      if (new Set(rows.map((r) => r.id)).size !== rows.length)
        c.addIssue({ code: "custom", message: "Duplicate vector pack ID" });
    if (p.measurements.some((m) => m.values.length !== p.sizes.length))
      c.addIssue({
        code: "custom",
        message: "Each measurement needs a value slot for every size",
      });
    if (
      p.layers.reduce(
        (n, l) => n + allContours(l).reduce((n, c) => n + c.length, 0),
        0,
      ) > 60000
    )
      c.addIssue({
        code: "custom",
        message: "Vector pack exceeds 60,000 anchors",
      });
  });
export type VectorPack = z.infer<typeof VectorPackSchema>;
export type VectorLayer = z.infer<typeof VectorLayerSchema>;
export type VectorNode = z.infer<typeof VectorNodeSchema>;
export type VectorView = VectorLayer["view"];
export function allContours(l: Pick<VectorLayer, "nodes" | "contours">) {
  return [l.nodes, ...(l.contours ?? [])];
}
export function setContour(l: VectorLayer, index: number, nodes: VectorNode[]) {
  if (index === 0) return { ...l, nodes };
  return {
    ...l,
    contours: l.contours?.map((c, i) => (i === index - 1 ? nodes : c)),
  };
}
export function vectorPath(
  l: Pick<VectorLayer, "nodes" | "closed" | "contours">,
): string {
  if (l.contours?.length)
    return allContours(l)
      .map((nodes) => vectorPath({ nodes, closed: l.closed }))
      .join(" ");
  const p = (v: { x: number; y: number }) =>
    `${v.x.toFixed(2)} ${v.y.toFixed(2)}`;
  const segment = (a: VectorNode, b: VectorNode) =>
    a.out || b.in ? `C${p(a.out ?? a)} ${p(b.in ?? b)} ${p(b)}` : `L${p(b)}`;
  return (
    `M${p(l.nodes[0])} ` +
    l.nodes
      .slice(1)
      .map((n, i) => segment(l.nodes[i], n))
      .join(" ") +
    (l.closed ? ` ${segment(l.nodes.at(-1)!, l.nodes[0])} Z` : "")
  );
}
export function mapLayer(
  l: VectorLayer,
  fn: (p: { x: number; y: number }) => { x: number; y: number },
): VectorLayer {
  return {
    ...l,
    nodes: l.nodes.map((n) => ({
      ...fn(n),
      ...(n.in ? { in: fn(n.in) } : {}),
      ...(n.out ? { out: fn(n.out) } : {}),
    })),
    ...(l.contours
      ? {
          contours: l.contours.map(
            (nodes) => mapLayer({ ...l, nodes, contours: undefined }, fn).nodes,
          ),
        }
      : {}),
  };
}
export function layerBounds(l: VectorLayer) {
  const pts = allContours(l)
    .flat()
    .flatMap((n) => [n, ...(n.in ? [n.in] : []), ...(n.out ? [n.out] : [])]);
  const x = pts.reduce((a, p) => Math.min(a, p.x), Infinity),
    y = pts.reduce((a, p) => Math.min(a, p.y), Infinity);
  return {
    x,
    y,
    width: pts.reduce((a, p) => Math.max(a, p.x), -Infinity) - x,
    height: pts.reduce((a, p) => Math.max(a, p.y), -Infinity) - y,
  };
}
export function newVectorPack(): VectorPack {
  return {
    version: 4,
    groups: [],
    sources: [],
    name: "Untitled garment",
    style: "STYLE-001",
    revision: "A",
    season: "",
    manufacturer: "",
    notes: "",
    units: "cm",
    sizes: ["S", "M", "L"],
    layers: [],
    callouts: [],
    materials: [],
    measurements: [],
  };
}
export function parseVectorPack(raw: string) {
  if (raw.length > 15000000) throw new Error("Vector pack exceeds 15 MB.");
  return VectorPackSchema.parse(migrateVectorPack(JSON.parse(raw)));
}
export function migrateVectorPack(raw: unknown) {
  if (raw && typeof raw === "object" && "version" in raw && raw.version === 1)
    raw = { ...LegacyVectorPackSchema.parse(raw), version: 2 };
  if (raw && typeof raw === "object" && "version" in raw && raw.version === 2)
    raw = { ...V2Schema.parse(raw), version: 3, groups: [], sources: [] };
  if (raw && typeof raw === "object" && "version" in raw && raw.version === 3)
    return { ...V3Schema.parse(raw), version: 4 };
  return raw;
}
export function resizeSizes(pack: VectorPack, sizes: string[]): VectorPack {
  return {
    ...pack,
    sizes,
    measurements: pack.measurements.map((m) => ({
      ...m,
      values: sizes.map((size) => {
        const i = pack.sizes.indexOf(size);
        return i < 0 ? null : m.values[i];
      }),
    })),
  };
}
export function convertPackUnits(
  pack: VectorPack,
  units: VectorPack["units"],
): VectorPack {
  if (pack.units === units) return pack;
  const factor = units === "in" ? 1 / 2.54 : 2.54;
  return {
    ...pack,
    units,
    measurements: pack.measurements.map((m) => ({
      ...m,
      tolerance: Math.round(m.tolerance * factor * 1e8) / 1e8,
      values: m.values.map((v) =>
        v === null ? null : Math.round(v * factor * 1e8) / 1e8,
      ),
    })),
  };
}

// Split a cubic at t=0.5 without changing its contour (De Casteljau).
export function insertVectorAnchor(
  layer: VectorLayer,
  index: number,
): VectorLayer {
  if (
    index < 0 ||
    index >= layer.nodes.length ||
    (!layer.closed && index === layer.nodes.length - 1) ||
    layer.nodes.length >= 2000
  )
    return layer;
  const nodes = structuredClone(layer.nodes),
    next = (index + 1) % nodes.length,
    a = nodes[index],
    b = nodes[next];
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });
  let inserted: VectorNode;
  if (a.out || b.in) {
    const q0 = mid(a, a.out ?? a),
      q1 = mid(a.out ?? a, b.in ?? b),
      q2 = mid(b.in ?? b, b),
      r0 = mid(q0, q1),
      r1 = mid(q1, q2);
    inserted = { ...mid(r0, r1), in: r0, out: r1 };
    a.out = q0;
    b.in = q2;
  } else inserted = mid(a, b);
  nodes.splice(index + 1, 0, inserted);
  return { ...layer, nodes };
}
