import { test, expect } from "vitest";
import { unwrapStroke, drawingKey } from "../src/surface-drawing";
import { blankProject, humanBody, sculptBody } from "../src/domain";
test("surface strokes cross the UV seam locally rather than drawing across the body", () => {
  const p = unwrapStroke([
    [0.98, 0.5, 1],
    [0.01, 0.51, 0.5],
    [0.03, 0.52, 1],
  ]);
  expect(p[1][0]).toBeCloseTo(1.01);
  expect(p[2][0]).toBeCloseTo(1.03);
  expect(Math.abs(p[1][0] - p[0][0])).toBeLessThan(0.04);
});
test("drawing target identity survives flex but cannot leak into another mesh", () => {
  const p = { ...blankProject(), body: humanBody("full-arm") };
  const before = drawingKey(p, "left-arm");
  p.body.flex = 90;
  expect(drawingKey(p, "left-arm")).toBe(before);
  p.body.model!.sex = "female";
  expect(drawingKey(p, "left-arm")).not.toBe(before);
  expect(
    drawingKey({ ...p, body: sculptBody("sculpt-arm") }, "left-arm"),
  ).not.toBe(before);
});
