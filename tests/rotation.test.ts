import { test, expect } from "vitest";
import { stepRotation } from "../src/rotation";
test("rotation steps wrap whole turns and keep anatomical joints bounded", () => {
  expect(stepRotation(350, 15, 0, 360)).toBe(5);
  expect(stepRotation(5, -15, 0, 360)).toBe(350);
  expect(stepRotation(170, 15, -180, 180)).toBe(-175);
  expect(stepRotation(-175, -15, -180, 180)).toBe(170);
  expect(stepRotation(90, 15, -90, 90, false)).toBe(90);
  expect(stepRotation(-80, -90, -90, 90, false)).toBe(-90);
  expect(stepRotation(270, 90, 0, 360)).toBe(360);
});
