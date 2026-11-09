// Frozen vector pack 3 schema.
import { z } from "zod";
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
  })
  .strict();
export const VectorPackSchema = z
  .object({
    version: z.literal(3),
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

function allContours(l: { nodes: unknown[]; contours?: unknown[][] }) { return [l.nodes, ...(l.contours ?? [])]; }
