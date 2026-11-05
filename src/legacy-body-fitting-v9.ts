// Frozen body-fitting schema for format 9.
import { z } from "zod";
const finite = (min: number, max: number) =>
  z.number().finite().min(min).max(max);
export const fitLevels = ["chest", "waist", "hips"] as const;
export type FitLevel = (typeof fitLevels)[number];
export const FitShapeSchema = z
  .object({
    levels: z.tuple([finite(-0.5, 5.8), finite(-0.5, 5.8), finite(-0.5, 5.8)]),
    scales: z.tuple([
      finite(0.65, 1.5),
      finite(0.65, 1.5),
      finite(0.65, 1.5),
      finite(0.65, 1.5),
      finite(0.65, 1.5),
      finite(0.65, 1.5),
    ]),
  })
  .strict()
  .refine(
    (s) => s.levels[0] > s.levels[1] + 0.4 && s.levels[1] > s.levels[2] + 0.4,
    "Fit levels must descend from chest to waist to seat",
  );
export type FitShape = z.infer<typeof FitShapeSchema>;
export const landmarkKeys = [
  "top",
  "floor",
  "neck",
  "chestLeft",
  "chestRight",
  "waistLeft",
  "waistRight",
  "hipsLeft",
  "hipsRight",
] as const;
export type Landmark = (typeof landmarkKeys)[number];
const ViewSchema = z
  .object({ assetId: z.string().uuid(), view: z.enum(["front", "side"]) })
  .strict();
// Partial record is represented with a strict object so unfinished captures remain saveable.
const pointSchema = z.tuple([finite(0, 1), finite(0, 1)]);
const PointsSchema = z
  .object({
    top: pointSchema.optional(),
    floor: pointSchema.optional(),
    neck: pointSchema.optional(),
    chestLeft: pointSchema.optional(),
    chestRight: pointSchema.optional(),
    waistLeft: pointSchema.optional(),
    waistRight: pointSchema.optional(),
    hipsLeft: pointSchema.optional(),
    hipsRight: pointSchema.optional(),
  })
  .strict();
export const BodyStudySchema = z
  .object({
    height: finite(1000, 2300),
    views: z.array(ViewSchema.extend({ points: PointsSchema })).max(4),
    tape: z
      .object({
        chest: finite(500, 1800).optional(),
        waist: finite(400, 1800).optional(),
        hips: finite(500, 1900).optional(),
      })
      .strict(),
    notes: z.string().max(1500),
    result: z
      .object({
        shape: FitShapeSchema,
        length: finite(700, 2200),
        sex: z.enum(["male", "female"]),
        muscularity: finite(0, 1),
        residuals: z
          .array(
            z
              .object({
                label: z.string().max(100),
                target: finite(0, 3000),
                predicted: finite(0, 3000),
                error: finite(-3000, 3000),
              })
              .strict(),
          )
          .max(16),
      })
      .strict()
      .optional(),
  })
  .strict();
