// Frozen fashion format from release 0.7.
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
  ["hips", "Hips", 650, 1700, "Around the fullest part of the seat."],
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
] as const;
export type MeasurementKey = (typeof measurementFields)[number][0];
const MeasurementsSchema = z
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
export type PieceId = (typeof pieceIds)[number];
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
      .object({
        front: Position,
        back: Position,
        sleeve: Position,
        neckband: Position,
      })
      .strict(),
    notes: z.string().max(3000),
    paper: z.enum(["a4", "letter"]),
  })
  .strict();
