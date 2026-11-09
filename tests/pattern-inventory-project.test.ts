import { expect, test } from "vitest";
import {
  blankProject,
  parseProject,
  ProjectSchema,
  sha256,
  type Asset,
} from "../src/domain";
import { newFashion } from "../src/fashion-model";
import { newFashion as legacyFashion } from "../src/legacy-fashion-v18";
import { draftFashion } from "../src/fashion-draft";
import {
  newPatternSource,
  outlineToPiece,
  sourcePiecesForDraft,
} from "../src/pattern-source";
import { defaultReview, freezeReviewRevision } from "../src/review-room";
import { rasterPng } from "./raster-fixtures";

async function studyProject() {
  const data = rasterPng(500, 700);
  const asset: Asset = {
    id: crypto.randomUUID(),
    name: "Personal scan",
    role: "garment",
    mime: "image/png",
    data,
    sha256: await sha256(data),
    width: 500,
    height: 700,
  };
  const study = newPatternSource(asset.id, "Panel", "pattern");
  study.calibration = {
    corners: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    widthMm: 200,
    heightMm: 300,
    confirmed: true,
  };
  study.outline = [
    [0.1, 0.1],
    [0.9, 0.1],
    [0.9, 0.9],
    [0.1, 0.9],
  ];
  study.pieces = [outlineToPiece(study)];
  const pieces = sourcePiecesForDraft(study);
  return {
    ...blankProject(),
    assets: [asset],
    fashion: {
      ...newFashion(),
      construction: pieces,
      customDraftIds: Object.keys(pieces),
      patternSources: {
        version: 1 as const,
        selectedId: study.id,
        studies: [study],
      },
    },
  };
}
test("format19 preserves originals, calibrated pieces and active custom board through save/open", async () => {
  const p = await studyProject(),
    loaded = await parseProject(JSON.stringify(p));
  expect(loaded).toEqual(p);
  const draft = draftFashion(loaded.fashion!);
  expect(draft.pieces.map((p) => p.id)).toEqual(p.fashion.customDraftIds);
  expect(draft.pieces[0].width).toBeCloseTo(160, 5);
  expect(draft.pieces[0].height).toBeCloseTo(240, 5);
  expect(draft.warnings.join(" ")).toMatch(/before cutting/);
});
test("missing or edited originals, duplicate active IDs and missing active pieces are rejected", async () => {
  const p = await studyProject();
  expect(ProjectSchema.safeParse({ ...p, assets: [] }).success).toBe(false);
  expect(
    ProjectSchema.safeParse({
      ...p,
      assets: [{ ...p.assets[0], role: "artwork" }],
    }).success,
  ).toBe(false);
  expect(
    ProjectSchema.safeParse({
      ...p,
      fashion: { ...p.fashion, customDraftIds: ["missing"] },
    }).success,
  ).toBe(false);
  expect(
    ProjectSchema.safeParse({
      ...p,
      fashion: {
        ...p.fashion,
        customDraftIds: [
          ...p.fashion.customDraftIds,
          ...p.fashion.customDraftIds,
        ],
      },
    }).success,
  ).toBe(false);
  p.assets[0].data = "data:image/png;base64,Y29ycnVwdA==";
  await expect(parseProject(JSON.stringify(p))).rejects.toThrow(/integrity/);
});
test("format18 migration keeps previous measurements, model and immutable review fingerprints", async () => {
  const p = { ...blankProject(), fashion: legacyFashion() };
  p.fashion.measurements.chest = 931;
  const review = await freezeReviewRevision(
    p,
    defaultReview(),
    "Previous study",
    "fashion",
  );
  const old = { ...p, version: 18, review };
  const loaded = await parseProject(JSON.stringify(old));
  expect(loaded).toEqual({ ...old, version: 19 });
  expect(loaded.review?.revisions[0].hash).toBe(review.revisions[0].hash);
});
test("old formats cannot silently admit new inventory fields", async () => {
  const p = await studyProject();
  for (const version of [15, 16, 17, 18])
    await expect(
      parseProject(JSON.stringify({ ...p, version })),
    ).rejects.toThrow(new RegExp(`version ${version}`));
});
test("returning to a template leaves imported construction and inventory intact", async () => {
  const p = await studyProject(),
    before = structuredClone(p.fashion);
  const restored = { ...p.fashion, customDraftIds: undefined };
  const d = draftFashion(restored);
  expect(d.pieces.some((p) => p.id === "front")).toBe(true);
  expect(restored.construction).toEqual(before.construction);
  expect(restored.patternSources).toEqual(before.patternSources);
});
