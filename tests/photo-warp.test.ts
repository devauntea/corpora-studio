import { describe, expect, it } from "vitest";
import {
  defaultQuad,
  QuadSchema,
  homography,
  inverse,
  projectPoint,
  insideQuad,
  type Quad,
} from "../src/photo-warp";
describe("perspective placement", () => {
  it("maps all corners exactly and inverts interior coordinates including mirrored quads", () => {
    const q: Quad = [
      [10, 20],
      [180, 8],
      [130, 200],
      [30, 150],
    ];
    for (const shape of [q, q.map(([x, y]) => [200 - x, y]) as Quad]) {
      const h = homography(shape),
        inv = inverse(h),
        uv = [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ];
      uv.forEach(([u, v], i) => {
        const p = projectPoint(h, u, v);
        expect(p[0]).toBeCloseTo(shape[i][0], 9);
        expect(p[1]).toBeCloseTo(shape[i][1], 9);
      });
      for (const [u, v] of [
        [0.2, 0.3],
        [0.5, 0.5],
        [0.8, 0.7],
      ]) {
        const p = projectPoint(h, u, v),
          back = projectPoint(inv, ...p);
        expect(back[0]).toBeCloseTo(u, 9);
        expect(back[1]).toBeCloseTo(v, 9);
        expect(insideQuad(p, shape)).toBe(true);
      }
      expect(insideQuad([999, 999], shape)).toBe(false);
    }
  });
  it("rejects crossed, collapsed and out-of-budget stored corners", () => {
    expect(QuadSchema.safeParse(defaultQuad()).success).toBe(true);
    const crossed = defaultQuad();
    [crossed[1], crossed[2]] = [crossed[2], crossed[1]];
    expect(QuadSchema.safeParse(crossed).success).toBe(false);
    const collapsed = defaultQuad();
    collapsed[1] = collapsed[0];
    expect(QuadSchema.safeParse(collapsed).success).toBe(false);
    const excessive = defaultQuad();
    excessive[0] = [-2, -2];
    expect(QuadSchema.safeParse(excessive).success).toBe(false);
  });
});
