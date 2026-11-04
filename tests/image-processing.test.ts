import { describe, expect, it } from "vitest";
import {
  defaultProcessing,
  edgeMask,
  processPixels,
} from "../src/image-processing";
import { ArtworkEditsSchema, cleanArtwork } from "../src/domain";
describe("local image preparation", () => {
  it("leaves original pixels byte-for-byte unchanged with processing off", () => {
    const p = new Uint8ClampedArray([50, 100, 230, 80, 255, 120, 2, 0]),
      original = p.slice();
    processPixels(p, 2, 1, defaultProcessing());
    expect(p).toEqual(original);
  });
  it("makes a solid stencil while retaining source transparency", () => {
    const p = new Uint8ClampedArray([
      0, 0, 0, 255, 80, 80, 80, 255, 240, 240, 240, 255, 0, 0, 0, 0,
    ]);
    processPixels(p, 4, 1, {
      ...defaultProcessing(),
      mode: "stencil",
      smoothing: 0,
    });
    expect([...p]).toEqual([
      0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 0, 255, 255, 255, 0,
    ]);
    const white = new Uint8ClampedArray([255, 255, 255, 255]);
    processPixels(white, 1, 1, {
      ...defaultProcessing(),
      mode: "stencil",
      transparent: false,
    });
    expect(white[3]).toBe(255);
  });
  it("finds a clean vertical boundary without inventing edges on uniform paper", () => {
    const w = 20,
      h = 20,
      gray = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) gray[y * w + x] = x < 10 ? 0 : 255;
    const mask = edgeMask(gray, w, h, 100);
    expect(mask.filter((v) => v > 0).length).toBe(18);
    expect(
      edgeMask(new Float32Array(400).fill(128), 20, 20, 10).some(Boolean),
    ).toBe(false);
  });
  it("rejects damaged processing recipes and does not alter alpha during sharpening", () => {
    expect(
      ArtworkEditsSchema.safeParse({
        ...cleanArtwork(),
        processing: { ...defaultProcessing(), sharpen: Infinity },
      }).success,
    ).toBe(false);
    const p = new Uint8ClampedArray([
      0, 0, 0, 0, 100, 100, 100, 123, 250, 250, 250, 255,
    ]);
    processPixels(p, 3, 1, { ...defaultProcessing(), sharpen: 2 });
    expect([p[3], p[7], p[11]]).toEqual([0, 123, 255]);
  });
});
