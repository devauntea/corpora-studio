import type { ArtworkEdits } from "./domain";
import { processPixels } from "./image-processing";
export function preparePixels(
  p: Uint8ClampedArray,
  w: number,
  h: number,
  edits: ArtworkEdits,
  progress = (n: number) => {
    void n;
  },
) {
  if (
    !Number.isInteger(w) ||
    !Number.isInteger(h) ||
    w < 1 ||
    h < 1 ||
    w * h > 8_400_000 ||
    p.length !== w * h * 4
  )
    throw new Error("Image job exceeds the 8.4 megapixel processing budget.");
  const alpha = new Uint8ClampedArray(p.length);
  const color =
    edits.background === "white"
      ? [255, 255, 255]
      : edits.background === "black"
        ? [0, 0, 0]
        : edits.color
            .slice(1)
            .match(/../g)!
            .map((v) => parseInt(v, 16));
  for (let i = 0; i < p.length; i += 4) {
    alpha[i] = alpha[i + 1] = alpha[i + 2] = 255;
    const distance = Math.max(
      Math.abs(p[i] - color[0]),
      Math.abs(p[i + 1] - color[1]),
      Math.abs(p[i + 2] - color[2]),
    );
    alpha[i + 3] =
      edits.background === "none"
        ? 255
        : Math.round(
            Math.min(
              1,
              Math.max(0, (distance - edits.tolerance) / edits.feather),
            ) * 255,
          );
    const lum = 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];
    for (let k = 0; k < 3; k++)
      p[i + k] = Math.min(
        255,
        Math.max(
          0,
          ((edits.grayscale ? lum : p[i + k]) - 128) * edits.contrast + 128,
        ),
      );
  }
  progress(0.35);
  if (edits.processing) processPixels(p, w, h, edits.processing);
  progress(0.95);
  return { pixels: p, alpha };
}
