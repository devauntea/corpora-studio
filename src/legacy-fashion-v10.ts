// Frozen 0.10 fashion schema.
import { ClothSchema } from "./cloth-model";
import { GarmentStudySchema } from "./garment-measure";
import { ConstructionSetSchema } from "./fashion-construction";
import { z } from "zod";

const n = (min: number, max: number) => z.number().finite().min(min).max(max);
export const measurementFields = [
  [
    "chest",
    "Chest / full bust",
    600,
    1600,
    "Around the fullest part, with the tape level.",
  ],
  [
    "waist",
    "Waist",
    500,
    1500,
    "Around the natural waist, without pulling the tape tight.",
  ],
  [
    "hips",
    "High hips",
    650,
    1700,
    "Around the top of the hip bones, usually just below the navel. Full seat is a separate measurement.",
  ],
  ["biceps", "Biceps", 180, 600, "Around the fullest part of the upper arm."],
  ["neck", "Neck", 250, 600, "Around the base of the neck."],
  [
    "shoulderToShoulder",
    "Shoulder width",
    280,
    650,
    "Across the back, between the shoulder tips.",
  ],
  [
    "hpsToBust",
    "High shoulder to bust",
    150,
    450,
    "From the neck–shoulder junction to the chest / bust level.",
  ],
  [
    "hpsToWaistBack",
    "High shoulder to waist",
    300,
    650,
    "From the neck–shoulder junction down the back to the waist.",
  ],
  [
    "waistToArmpit",
    "Waist to armpit",
    120,
    350,
    "Vertically from the waist to the armpit.",
  ],
  [
    "waistToHips",
    "Waist to hips",
    100,
    350,
    "Vertically from the waist to the hip line.",
  ],
  [
    "shoulderToWrist",
    "Shoulder to wrist",
    400,
    850,
    "From shoulder tip to wrist, with the arm slightly bent.",
  ],
  ["wrist", "Wrist", 100, 300, "Around the wrist at its narrowest point."],
  [
    "shoulderSlope",
    "Shoulder slope",
    0,
    35,
    "Shoulder angle below horizontal, in degrees.",
  ],
  [
    "seat",
    "Full seat circumference",
    650,
    1800,
    "Around the fullest seat, below the high hip line.",
  ],
  [
    "seatBack",
    "Back seat arc",
    250,
    1100,
    "Across the back half of the seat, from side seam to side seam.",
  ],
  [
    "waistBack",
    "Back waist arc",
    200,
    950,
    "Across the back half of the natural waist, between side seams.",
  ],
  [
    "crossSeam",
    "Total crotch length",
    450,
    1300,
    "From front waist, between the legs, to back waist.",
  ],
  [
    "crossSeamFront",
    "Front crotch length",
    180,
    650,
    "From front waist to the inseam intersection.",
  ],
  [
    "knee",
    "Knee circumference",
    250,
    650,
    "Around the knee, standing with the leg straight.",
  ],
  [
    "waistToFloor",
    "Waist to floor",
    650,
    1450,
    "Vertically from natural waist to floor, barefoot.",
  ],
  [
    "waistToKnee",
    "Waist to knee",
    350,
    850,
    "Vertically from natural waist to knee center.",
  ],
  [
    "waistToSeat",
    "Waist to seat",
    120,
    400,
    "Vertically from natural waist to fullest seat level.",
  ],
  [
    "waistToUpperLeg",
    "Waist to upper leg",
    200,
    500,
    "Vertically from natural waist to crotch / upper-leg level.",
  ],
] as const;
export type MeasurementKey = (typeof measurementFields)[number][0];
export const MeasurementsSchema = z
  .object({
    chest: n(600, 1600),
    waist: n(500, 1500),
    hips: n(650, 1700),
    biceps: n(180, 600),
    neck: n(250, 600),
    shoulderToShoulder: n(280, 650),
    hpsToBust: n(150, 450),
    hpsToWaistBack: n(300, 650),
    waistToArmpit: n(120, 350),
    waistToHips: n(100, 350),
    shoulderToWrist: n(400, 850),
    wrist: n(100, 300),
    shoulderSlope: n(0, 35),
    seat: n(650, 1800).optional(),
    seatBack: n(250, 1100).optional(),
    waistBack: n(200, 950).optional(),
    crossSeam: n(450, 1300).optional(),
    crossSeamFront: n(180, 650).optional(),
    knee: n(250, 650).optional(),
    waistToFloor: n(650, 1450).optional(),
    waistToKnee: n(350, 850).optional(),
    waistToSeat: n(120, 400).optional(),
    waistToUpperLeg: n(200, 500).optional(),
  })
  .strict();
export const optionFields = [
  [
    "chestEase",
    "Chest ease",
    5,
    25,
    "%",
    "Added circumference as a percentage of chest / bust.",
  ],
  ["hipsEase", "Hip ease", 8, 30, "%", "Added circumference at the hem."],
  [
    "waistEase",
    "Waist ease",
    8,
    40,
    "%",
    "Used when the waist shaping switch is on.",
  ],
  [
    "lengthBonus",
    "Body length adjustment",
    -20,
    60,
    "%",
    "Percentage of shoulder-to-hip length added below the hips.",
  ],
  [
    "sleeveLength",
    "Sleeve length factor",
    20,
    100,
    "%",
    "Sets the length below the sleeve cap relative to sleeve width.",
  ],
  [
    "sleeveEase",
    "Sleeve ease",
    5,
    35,
    "%",
    "Added room around the sleeve opening.",
  ],
  [
    "necklineDepth",
    "Neckline depth",
    20,
    40,
    "%",
    "Front depth as a percentage of high-shoulder-to-waist length.",
  ],
  [
    "necklineWidth",
    "Neckline width",
    10,
    50,
    "%",
    "How far the neckline extends toward the shoulder tip.",
  ],
  [
    "necklineBend",
    "Neckline curve",
    0,
    70,
    "%",
    "Controls the roundness of the front neckline.",
  ],
] as const;
export type OptionKey = (typeof optionFields)[number][0];
export const pieceIds = ["front", "back", "sleeve", "neckband"] as const;
export type PieceId = string;
export const designIds = [
  "teagan",
  "brian",
  "titan",
  "sarah",
  "simon",
] as const;
export type DesignId = (typeof designIds)[number];
export const designNames: Record<DesignId, string> = {
  teagan: "Teagan · knit T-shirt",
  brian: "Brian · bodice block",
  titan: "Titan · trouser block",
  sarah: "Sarah · skirt block",
  simon: "Simon · woven shirt",
};
export const lowerBodySample = {
  seat: 1000,
  seatBack: 520,
  waistBack: 430,
  crossSeam: 760,
  crossSeamFront: 350,
  knee: 390,
  waistToFloor: 1080,
  waistToKnee: 620,
  waistToSeat: 220,
  waistToUpperLeg: 320,
};
export const MeasurementProfileSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(80),
    source: z.enum(["tape", "photo", "sample", "standard"]),
    note: z.string().max(1000),
    measurements: MeasurementsSchema,
  })
  .strict();
export type MeasurementProfile = z.infer<typeof MeasurementProfileSchema>;
export const FabricSchema = z
  .object({
    name: z.string().min(1).max(80),
    structure: z.enum(["woven", "knit"]),
    stretchWidth: n(0, 200),
    stretchLength: n(0, 200),
    recovery: n(0, 100),
    gsm: n(10, 1500),
    fiber: z.string().max(150),
  })
  .strict();
export type Fabric = z.infer<typeof FabricSchema>;
export const sampleFabric = (): Fabric => ({
  name: "Unmeasured knit sample",
  structure: "knit",
  stretchWidth: 20,
  stretchLength: 5,
  recovery: 90,
  gsm: 180,
  fiber: "Enter fiber composition",
});
const Position = z.object({ x: n(-2000, 2000), y: n(-2000, 2000) }).strict();
export const FashionSchema = z
  .object({
    engine: z.literal("teagan-4.10.2-form-1"),
    profile: z.string().min(1).max(80),
    measurements: MeasurementsSchema,
    options: z
      .object({
        chestEase: n(5, 25),
        hipsEase: n(8, 30),
        waistEase: n(8, 40),
        lengthBonus: n(-20, 60),
        sleeveLength: n(20, 100),
        sleeveEase: n(5, 35),
        necklineDepth: n(20, 40),
        necklineWidth: n(10, 50),
        necklineBend: n(0, 70),
        fitWaist: z.boolean(),
      })
      .strict(),
    seamAllowance: n(0, 25),
    bandRatio: n(0.7, 1),
    bandWidth: n(10, 35),
    layout: z
      .record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9.-]{0,59}$/), Position)
      .refine((v) => Object.keys(v).length <= 40, "Too many pieces"),
    design: z.enum(designIds).optional(),
    designOptions: z
      .record(
        z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,59}$/),
        z.union([n(-1000, 1000), z.boolean(), z.string().max(80)]),
      )
      .refine((v) => Object.keys(v).length <= 100)
      .optional(),
    profiles: z
      .array(MeasurementProfileSchema)
      .max(20)
      .refine(
        (v) => new Set(v.map((p) => p.id)).size === v.length,
        "Duplicate profile",
      )
      .optional(),
    gradeIds: z.array(z.string().uuid()).max(8).optional(),
    fabric: FabricSchema.optional(),
    photoStudy: GarmentStudySchema.optional(),
    cloth: ClothSchema.optional(),
    notes: z.string().max(3000),
    paper: z.enum(["a4", "letter"]),
    construction: ConstructionSetSchema.optional(),
  })
  .strict()
  .superRefine((f, c) => {
    const profiles = new Set(f.profiles?.map((p) => p.id));
    if (
      new Set(f.gradeIds).size !== (f.gradeIds?.length ?? 0) ||
      (f.gradeIds ?? []).some((id) => !profiles.has(id))
    )
      c.addIssue({
        code: "custom",
        message: "Size series needs unique project profile IDs",
      });
  });
