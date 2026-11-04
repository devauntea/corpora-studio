import { z } from "zod";
const n = (a: number, b: number) => z.number().finite().min(a).max(b);
const panel = z
  .object({
    id: z.string().uuid(),
    pieceId: z.string().min(1).max(60),
    name: z.string().min(1).max(80),
    unfold: z.boolean(),
    mirror: z.boolean(),
    x: n(-1500, 1500),
    y: n(-1500, 1500),
    z: n(-1500, 1500),
    yaw: n(-180, 180),
    roll: n(-180, 180),
    pitch: n(-180, 180).optional(),
    pinTop: z.boolean(),
  })
  .strict();
const edge = z
  .object({ panel: z.string().uuid(), from: n(0, 1), to: n(0, 1) })
  .strict();
export const ClothSchema = z
  .object({
    mode: z.enum(["garment", "cylinder"]).optional(),
    panels: z.array(panel).max(16),
    stitches: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            a: edge,
            b: edge,
            reverse: z.boolean(),
          })
          .strict(),
      )
      .max(40),
    spacing: n(12, 60),
    steps: n(30, 360).int(),
    stretch: n(0, 100),
    bend: n(0, 100),
    thickness: n(0.1, 8),
    damping: n(0, 0.5),
    benchmark: z
      .object({
        physicalDrop: n(0, 600).optional(),
        notes: z.string().max(1500),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((c, ctx) => {
    const ids = new Set(c.panels.map((p) => p.id));
    if (ids.size !== c.panels.length)
      ctx.addIssue({ code: "custom", message: "Duplicate cloth panel" });
    for (const s of c.stitches)
      if (
        !ids.has(s.a.panel) ||
        !ids.has(s.b.panel) ||
        s.a.panel === s.b.panel ||
        s.a.from === s.a.to ||
        s.b.from === s.b.to
      )
        ctx.addIssue({
          code: "custom",
          message:
            "Stitches need two distinct panels and nonempty boundary ranges",
        });
  });
export type ClothConfig = z.infer<typeof ClothSchema>;
export type ClothPanel = ClothConfig["panels"][number];
export const clothDefaults = (): ClothConfig => ({
  panels: [],
  stitches: [],
  spacing: 30,
  steps: 180,
  stretch: 20,
  bend: 65,
  thickness: 1,
  damping: 0.04,
});
export type ClothMesh = {
  positions: Float32Array;
  rest: Float32Array;
  indices: Uint32Array;
  pins: Uint8Array;
  stitches: Uint32Array;
  colors: Float32Array;
  panels: {
    id: string;
    start: number;
    count: number;
    boundary: number[];
    fractions: number[];
  }[];
  warnings: string[];
};
export type ClothInput = {
  mesh: ClothMesh;
  config: ClothConfig;
  gsm: number;
  bodyPositions: Float32Array;
  bodyIndices: Uint32Array;
  floor: number;
};
export type ClothResult = {
  positions: Float32Array;
  maxEdgeStrain: number;
  p95EdgeStrain: number;
  seamGap: number;
  contacts: number;
  steps: number;
};
