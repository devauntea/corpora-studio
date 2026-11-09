import { z } from "zod";
import type { HumanBody, Project, SurfaceZone } from "./domain";
import { musclePoseArms } from "./muscle-pose";
import { StencilSettingsSchema } from "./stencil-export";

const n = (min: number, max: number) => z.number().finite().min(min).max(max);
export const studyPoses = [
  "relaxed",
  "arm-bend",
  "knee-bend",
  "chest-flex",
  "back-flex",
  "double-biceps",
] as const;
export const poseNames: Record<StudyPose, string> = {
  relaxed: "Relaxed",
  "arm-bend": "Arm bent 90°",
  "knee-bend": "Knee bent 90°",
  "chest-flex": "Chest flex",
  "back-flex": "Back flex",
  "double-biceps": "Double biceps",
};
export type StudyPose = (typeof studyPoses)[number];
export const GuideSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(60),
    kind: z.enum(["landmark", "focal", "band"]),
    zone: z.enum([
      "trunk",
      "left-arm",
      "right-arm",
      "left-leg",
      "right-leg",
      "neck",
    ]),
    u: n(0, 1),
    v: n(0, 1),
    width: n(1, 100),
    visible: z.boolean(),
  })
  .strict();
export const TransferPlanSchema = z
  .object({
    sections: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            name: z.string().min(1).max(40),
            x: n(0, 0.99),
            y: n(0, 0.99),
            width: n(0.01, 1),
            height: n(0.01, 1),
          })
          .strict()
          .refine(
            (s) => s.x + s.width <= 1.000001 && s.y + s.height <= 1.000001,
            "Section must stay within artwork",
          ),
      )
      .max(12),
    marks: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            name: z.string().min(1).max(24),
            x: n(0, 1),
            y: n(0, 1),
          })
          .strict(),
      )
      .max(24),
    overlap: n(0, 20),
    pose: z.enum(studyPoses),
    notes: z.string().max(1000),
    output: StencilSettingsSchema.optional(),
  })
  .strict()
  .superRefine((p, c) => {
    const ids = [...p.sections, ...p.marks].map((v) => v.id);
    if (new Set(ids).size !== ids.length)
      c.addIssue({ code: "custom", message: "Duplicate transfer ID" });
  });
export type TransferPlan = z.infer<typeof TransferPlanSchema>;
export type StudyGuide = z.infer<typeof GuideSchema>;
export const TattooStudySchema = z
  .object({
    comparePose: z.enum(studyPoses),
    transferPose: z.enum(studyPoses),
    tension: n(0, 1),
    detailZone: z.enum([
      "standard",
      "trunk",
      "left-arm",
      "right-arm",
      "left-leg",
      "right-leg",
      "neck",
    ]),
    guides: z.array(GuideSchema).max(24),
    stencils: z
      .array(
        z
          .object({ assetId: z.string().uuid(), plan: TransferPlanSchema })
          .strict(),
      )
      .max(24),
  })
  .strict()
  .superRefine((p, c) => {
    if (
      new Set(p.guides.map((g) => g.id)).size !== p.guides.length ||
      new Set(p.stencils.map((s) => s.assetId)).size !== p.stencils.length
    )
      c.addIssue({
        code: "custom",
        message: "Duplicate study guide or stencil artwork",
      });
  });
export type TattooStudy = z.infer<typeof TattooStudySchema>;
export const emptyStudy = (): TattooStudy => ({
  comparePose: "arm-bend",
  transferPose: "relaxed",
  tension: 0.8,
  detailZone: "standard",
  guides: [],
  stencils: [],
});
export const emptyTransferPlan = (
  pose: StudyPose = "relaxed",
): TransferPlan => ({ sections: [], marks: [], overlap: 5, pose, notes: "" });

export function availableStudyPoses(body: HumanBody): StudyPose[] {
  if (body.model?.sculptId) return ["relaxed"];
  if (body.section === "full-leg" && (body.model?.revision ?? 0) >= 6)
    return ["relaxed", "knee-bend"];
  if (body.section === "full-arm") return ["relaxed", "arm-bend"];
  if (body.section === "upper-body" && (body.model?.revision ?? 0) >= 5)
    return ["relaxed", "chest-flex", "back-flex"];
  if (body.section === "full-body" && (body.model?.revision ?? 0) >= 5)
    return studyPoses.filter((p) => p !== "knee-bend");
  if (body.section === "full-body") return ["relaxed", "arm-bend"];
  return ["relaxed"];
}
/** Derive a view; artwork/anchors stay authoritative in the original project. */
export function studyProject(
  project: Project,
  pose: StudyPose,
  tension: number,
): Project {
  if (project.body.kind !== "human-v1" || project.body.model?.sculptId)
    return project;
  const body = project.body;
  if (!availableStudyPoses(body).includes(pose)) pose = "relaxed";
  const musclePose =
    pose === "arm-bend" || pose === "knee-bend" ? "relaxed" : pose;
  const arms = musclePoseArms(musclePose);
  if (pose === "arm-bend") arms[body.side] = { flex: 90, raise: 0, twist: 0 };
  return {
    ...project,
    body: {
      ...body,
      flex: pose === "knee-bend" ? 90 : 0,
      armPose: arms,
      musclePose,
      muscleTension: tension,
    },
  };
}
export function newGuide(
  zone: SurfaceZone,
  kind: StudyGuide["kind"],
  u = 0.5,
  v = 0.5,
): StudyGuide {
  return {
    id: crypto.randomUUID(),
    name:
      kind === "band"
        ? "Breathing room"
        : kind === "focal"
          ? "Focal point"
          : "Landmark",
    kind,
    zone,
    u,
    v,
    width: 12,
    visible: true,
  };
}
