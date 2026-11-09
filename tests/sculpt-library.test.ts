import { describe, expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import {
  blankProject,
  humanBody,
  sculptBody,
  bodyZones,
  humanChartSize,
  humanScale,
  parseProject,
  ProjectSchema,
  bodyLabel,
} from "../src/domain";
import { sculptCatalog, sculptIds, sculptGroups } from "../src/sculpt-catalog";
import { availableStudyPoses, studyProject } from "../src/tattoo-study";

describe("imported sculpt library", () => {
  test("all selectable parts have self-contained GLBs, real dimensions and attribution", async () => {
    expect(sculptCatalog.map((e) => e.id)).toEqual([...sculptIds]);
    for (const entry of sculptCatalog) {
      const raw = await readFile(`public${entry.file}`);
      expect(raw.toString("ascii", 0, 4)).toBe("glTF");
      const jsonLength = raw.readUInt32LE(12);
      const gltf = JSON.parse(raw.toString("utf8", 20, 20 + jsonLength));
      expect(gltf.meshes).toHaveLength(1);
      expect(gltf.meshes[0].primitives).toHaveLength(1);
      expect(gltf.buffers.every((b: { uri?: string }) => !b.uri)).toBe(true);
      expect(gltf.images?.every((i: { uri?: string }) => !i.uri)).toBe(true);
      if (!entry.id.startsWith("tripo-") && !entry.id.startsWith("derived-"))
        expect(entry.source).toMatch(/^https:\/\/sketchfab.com\//);
      expect(entry.author.length).toBeGreaterThan(3);
      const body = sculptBody(entry.id);
      expect(humanScale(body)).toBe(1);
      expect(humanChartSize(body).height).toBe(entry.chartHeightMm);
      expect(bodyZones(body)).toHaveLength(1);
      expect(bodyLabel(body)).toBe(entry.name);
      expect(ProjectSchema.safeParse({ ...blankProject(), body }).success).toBe(
        true,
      );
    }
  });

  test("current format round trips sculptures; format 16 preserves old bodies and rejects new meshes", async () => {
    for (const id of sculptIds) {
      const project = { ...blankProject(), body: sculptBody(id) };
      expect(await parseProject(JSON.stringify(project))).toEqual(project);
      await expect(
        parseProject(JSON.stringify({ ...project, version: 16 })),
      ).rejects.toThrow("version 16");
    }
    const old = {
      ...blankProject(),
      version: 16,
      body: humanBody("upper-body"),
    };
    old.body.model!.revision = 8;
    expect(await parseProject(JSON.stringify(old))).toEqual({
      ...old,
      version: 19,
    });
    old.body.model!.revision = 9;
    await expect(parseProject(JSON.stringify(old))).rejects.toThrow(
      "version 16",
    );
  });

  test("static assets cannot acquire fictional rig poses, fitting or muscle maps", () => {
    const body = sculptBody("sculpt-hand"),
      p = { ...blankProject(), body };
    expect(availableStudyPoses(body)).toEqual(["relaxed"]);
    expect(studyProject(p, "arm-bend", 1)).toBe(p);
    for (const patch of [
      { flex: 90 },
      { anatomy: true },
      { muscularity: 1 },
      { build: 1.1 },
      { side: "right" },
      { section: "full-body" },
    ])
      expect(
        ProjectSchema.safeParse({ ...p, body: { ...body, ...patch } }).success,
      ).toBe(false);
    const builtin = humanBody("full-body", body);
    expect(builtin.model?.sculptId).toBeUndefined();
    expect(builtin.model?.revision).toBe(9);
    expect(builtin.muscularity).toBe(1);
  });
});

test("six independent leg poses occupy one parent collection and full bodies use a trunk chart", () => {
  expect(sculptGroups).toHaveLength(14);
  const legs = sculptGroups.filter((g) => g.name === "Muscular leg");
  expect(legs).toHaveLength(1);
  expect(legs[0].entries).toHaveLength(6);
  expect(new Set(legs[0].entries.map((e) => e.file)).size).toBe(6);
  for (const entry of sculptCatalog.filter((e) => e.section === "full-body")) {
    expect(bodyZones(sculptBody(entry.id))).toEqual(["trunk"]);
  }
});

test("retired anatomy collection stays readable but is absent from pickers", () => {
  expect(
    sculptCatalog.filter((e) => e.groupId === "derived-anatomy"),
  ).toHaveLength(10);
  expect(sculptGroups.some((g) => g.name === "Anatomy-derived body")).toBe(
    false,
  );
});
