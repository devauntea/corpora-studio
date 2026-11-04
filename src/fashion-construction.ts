import { z } from "zod";
const point = z
  .object({
    x: z.number().finite().min(-2500).max(2500),
    y: z.number().finite().min(-2500).max(2500),
  })
  .strict();
export const PatternOpSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("move"), to: point }).strict(),
  z.object({ type: z.literal("line"), to: point }).strict(),
  z
    .object({ type: z.literal("curve"), to: point, cp1: point, cp2: point })
    .strict(),
  z.object({ type: z.literal("close") }).strict(),
]);
const path = z
  .array(PatternOpSchema)
  .min(3)
  .max(256)
  .refine(
    (ops) =>
      ops[0].type === "move" &&
      ops.at(-1)!.type === "close" &&
      ops.slice(1, -1).every((o) => o.type === "line" || o.type === "curve"),
    "A piece must have a single closed boundary",
  );
export const ConstructionSchema = z
  .object({
    formulas: z
      .array(
        z
          .object({
            edge: z.number().int().min(0).max(255),
            point: z.enum(["to", "cp1", "cp2"]),
            axis: z.enum(["x", "y"]),
            expression: z.string().min(1).max(200),
          })
          .strict(),
      )
      .max(256)
      .refine(
        (v) =>
          new Set(v.map((f) => `${f.edge}:${f.point}:${f.axis}`)).size ===
          v.length,
        "Duplicate formula target",
      )
      .optional(),
    name: z.string().min(1).max(80),
    cut: z.string().min(1).max(100),
    seam: path,
    allowances: z.array(z.number().finite().min(0).max(75)).min(3).max(256),
    notches: z
      .array(
        z
          .object({
            edge: z.number().int().min(1).max(255),
            t: z.number().min(0).max(1),
            double: z.boolean(),
          })
          .strict(),
      )
      .max(64),
    darts: z.array(z.tuple([point, point, point])).max(16),
    guides: z.array(z.array(PatternOpSchema).max(256)).max(20),
    grain: z.tuple([point, point]),
    label: point,
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.allowances.length !== v.seam.length)
      ctx.addIssue({
        code: "custom",
        message: "Every boundary segment needs an allowance",
      });
    if (v.notches.some((n) => n.edge >= v.seam.length))
      ctx.addIssue({ code: "custom", message: "Missing notch segment" });
  });
export const ConstructionSetSchema = z
  .record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9.-]{0,59}$/), ConstructionSchema)
  .refine((v) => Object.keys(v).length <= 40, "Too many manual pieces");
export type Construction = z.infer<typeof ConstructionSchema>;
