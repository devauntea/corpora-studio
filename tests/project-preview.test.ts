import { test, expect } from "vitest";
import { blankProject, type Project } from "../src/domain";
import { newFashion } from "../src/fashion-model";
import { draftFashion } from "../src/fashion-draft";
import { starterSeams } from "../src/seam-checks";
import { projectPreview } from "../src/project-preview";

async function patternPreview(project: Project) {
  const url = await projectPreview(project, "pattern");
  try {
    return await (await fetch(url)).text();
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Matching crosses are distinct SVG paths, with a second vertical stroke for a double notch.
const matchingCrosses = (svg: string): string[] =>
  svg.match(/<path d="[^"]* h6 M[^"]* v6[^"]*"/g) ?? [];

test("review/checkpoint pattern previews include both sides of seam-plan matching marks without changing source geometry", async () => {
  const project = blankProject();
  project.fashion = newFashion();
  const base = await patternPreview(project);
  const plan = starterSeams(draftFashion(project.fashion), "teagan");
  for (const seam of plan.seams) seam.notches = [];
  plan.seams[0].notches = [
    {
      id: crypto.randomUUID(),
      name: "Sleeve alignment",
      a: 45,
      b: 45,
      double: true,
    },
  ];
  project.fashion.seamPlan = plan;
  const original = JSON.stringify(project);
  const preview = await patternPreview(project);
  expect(matchingCrosses(preview)).toHaveLength(
    matchingCrosses(base).length + 2,
  );
  const extra = matchingCrosses(preview).filter(
    (path) => !matchingCrosses(base).includes(path),
  );
  expect(extra).toHaveLength(2);
  for (const mark of extra) expect(mark.match(/ v6/g)).toHaveLength(2);
  expect(JSON.stringify(project)).toBe(original);

  // Removing a mark must remove it from the next capture rather than leaving stale geometry.
  plan.seams[0].notches = [];
  expect(await patternPreview(project)).toBe(base);
});
