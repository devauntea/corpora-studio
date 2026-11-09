import { z } from "zod";
const id = z.string().min(1).max(240);
const mm = z.number().finite().min(0).max(15000);
const side = z
  .object({
    pieceId: id,
    edges: z.array(id).min(1).max(64),
    reverse: z.boolean(),
  })
  .strict();
export const SeamPlanSchema = z
  .object({
    design: z.string().min(1).max(60),
    seams: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            name: z.string().min(1).max(100),
            a: side,
            b: side,
            mode: z.enum(["plain", "ease", "gather", "stretch"]),
            ease: z.number().finite().min(-2000).max(2000),
            tolerance: z.number().finite().min(0).max(50),
            notes: z.string().max(1000),
            notches: z
              .array(
                z
                  .object({
                    id: z.string().uuid(),
                    name: z.string().min(1).max(60),
                    a: mm,
                    b: mm,
                    double: z.boolean(),
                  })
                  .strict(),
              )
              .max(24),
          })
          .strict(),
      )
      .max(80),
    steps: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            title: z.string().min(1).max(100),
            instruction: z.string().max(2000),
            seamIds: z.array(z.string().uuid()).max(80),
          })
          .strict(),
      )
      .max(80),
    notes: z.string().max(3000),
  })
  .strict()
  .superRefine((p, c) => {
    const ids = new Set(p.seams.map((s) => s.id));
    if (
      ids.size !== p.seams.length ||
      new Set(p.steps.map((s) => s.id)).size !== p.steps.length
    )
      c.addIssue({
        code: "custom",
        message: "Duplicate construction operation ID",
      });
    for (const s of p.seams) {
      if (new Set(s.notches.map((n) => n.id)).size !== s.notches.length)
        c.addIssue({ code: "custom", message: "Duplicate matching mark" });
      for (const side of [s.a, s.b])
        if (new Set(side.edges).size !== side.edges.length)
          c.addIssue({
            code: "custom",
            message: "A seam cannot repeat the same edge",
          });
    }
    if (p.steps.some((s) => s.seamIds.some((id) => !ids.has(id))))
      c.addIssue({
        code: "custom",
        message: "Assembly step refers to a missing seam",
      });
  });
export type SeamPlan = z.infer<typeof SeamPlanSchema>;
export type Seam = SeamPlan["seams"][number];
export type SeamSide = Seam["a"];
