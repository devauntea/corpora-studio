import { z } from "zod";
import { homography, inverse, projectPoint, type Quad } from "./photo-warp";
const point = z.tuple([
  z.number().finite().min(0).max(1),
  z.number().finite().min(0).max(1),
]);
export const GarmentStudySchema = z
  .object({
    assetId: z.string().uuid(),
    referenceWidth: z.number().min(10).max(500),
    referenceHeight: z.number().min(10).max(500),
    corners: z.array(point).max(4),
    lines: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            name: z.string().min(1).max(80),
            points: z.tuple([point, point]),
            target: z.string().max(60),
            multiplier: z.number().finite().min(0.1).max(4),
            ease: z.number().finite().min(-300).max(500),
            tape: z.number().finite().min(0).max(3000).optional(),
          })
          .strict(),
      )
      .max(32),
    assumptions: z.string().max(1500),
  })
  .strict();
export type GarmentStudy = z.infer<typeof GarmentStudySchema>;
export function calibratedDistance(
  study: GarmentStudy,
  points: [[number, number], [number, number]],
  imageWidth: number,
  imageHeight: number,
) {
  if (study.corners.length !== 4)
    throw new Error(
      "Mark all four scale-reference corners clockwise, starting at the top left.",
    );
  const corners = study.corners.map(([x, y]) => [
    x * imageWidth,
    y * imageHeight,
  ]) as Quad;
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = corners[i],
      b = corners[(i + 1) % 4],
      c = corners[(i + 2) % 4];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cross <= 4)
      throw new Error("Reference corners must form a clockwise convex card.");
    area += a[0] * b[1] - b[0] * a[1];
  }
  if (area / 2 < imageWidth * imageHeight * 0.0005)
    throw new Error(
      "The scale reference is too small for a useful measurement. Move closer.",
    );
  const inv = inverse(homography(corners));
  const mapped = points.map(([x, y]) =>
    projectPoint(inv, x * imageWidth, y * imageHeight),
  );
  if (
    mapped.some((p) => p.some((v) => !Number.isFinite(v) || Math.abs(v) > 100))
  )
    throw new Error("Measurement falls outside the stable calibrated plane.");
  const distance = Math.hypot(
    (mapped[1][0] - mapped[0][0]) * study.referenceWidth,
    (mapped[1][1] - mapped[0][1]) * study.referenceHeight,
  );
  if (!Number.isFinite(distance) || distance > 3000)
    throw new Error(
      "Calibrated measurement exceeds 3000 mm. Check the reference.",
    );
  return distance;
}
export function studyCsv(study: GarmentStudy, w: number, h: number) {
  const cell = (s: string) => '"' + s.replace(/"/g, '""') + '"';
  return (
    "Measurement,Photo mm,Tape mm,Error mm,Target,Multiplier,Ease mm\r\n" +
    study.lines
      .map((l) => {
        const mm = calibratedDistance(study, l.points, w, h);
        return [
          cell(l.name),
          mm.toFixed(2),
          l.tape ?? "",
          l.tape === undefined ? "" : (mm - l.tape).toFixed(2),
          cell(l.target),
          l.multiplier,
          l.ease,
        ].join(",");
      })
      .join("\r\n")
  );
}
