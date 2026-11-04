import { z } from "zod";

export const ProcessingSchema = z
  .object({
    mode: z.enum(["original", "stencil", "line-art"]),
    threshold: z.number().int().min(1).max(254),
    adaptive: z.boolean(),
    detail: z.number().min(10).max(200),
    smoothing: z.number().int().min(0).max(4),
    sharpen: z.number().min(0).max(2),
    transparent: z.boolean(),
  })
  .strict();
export type Processing = z.infer<typeof ProcessingSchema>;
export const defaultProcessing = (): Processing => ({
  mode: "original",
  threshold: 128,
  adaptive: false,
  detail: 70,
  smoothing: 1,
  sharpen: 0,
  transparent: true,
});
const limit = (v: number, max: number) => Math.min(max, Math.max(0, v));

// Separable, clamped Gaussian [1, 4, 6, 4, 1]. No external service or image model.
function gaussian(input: Float32Array, w: number, h: number, passes: number) {
  let source = input;
  const weights = [1, 4, 6, 4, 1];
  for (let pass = 0; pass < passes; pass++) {
    const tmp = new Float32Array(source.length),
      out = new Float32Array(source.length);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let k = -2; k <= 2; k++)
          sum += source[y * w + limit(x + k, w - 1)] * weights[k + 2];
        tmp[y * w + x] = sum / 16;
      }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let k = -2; k <= 2; k++)
          sum += tmp[limit(y + k, h - 1) * w + x] * weights[k + 2];
        out[y * w + x] = sum / 16;
      }
    source = out;
  }
  return source;
}

// Canny-style edges: Sobel magnitude, directional nonmaximum suppression,
// and 8-connected hysteresis. Low threshold = 40% of the user-selected high.
export function edgeMask(
  gray: Float32Array,
  w: number,
  h: number,
  high: number,
) {
  const magnitude = new Float32Array(gray.length),
    direction = new Uint8Array(gray.length);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] +
        gray[i - w + 1] -
        2 * gray[i - 1] +
        2 * gray[i + 1] -
        gray[i + w - 1] +
        gray[i + w + 1];
      const gy =
        -gray[i - w - 1] -
        2 * gray[i - w] -
        gray[i - w + 1] +
        gray[i + w - 1] +
        2 * gray[i + w] +
        gray[i + w + 1];
      magnitude[i] = Math.hypot(gx, gy) / 4;
      direction[i] =
        Math.round(((Math.atan2(gy, gx) + Math.PI) * 4) / Math.PI) % 4;
    }
  const state = new Uint8Array(gray.length),
    stack = new Int32Array(gray.length);
  let top = 0;
  const offsets = [1, w + 1, w, w - 1];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x,
        m = magnitude[i],
        d = offsets[direction[i]];
      if (m < high * 0.4 || m < magnitude[i - d] || m <= magnitude[i + d])
        continue;
      if (m >= high) {
        state[i] = 2;
        stack[top++] = i;
      } else state[i] = 1;
    }
  while (top) {
    const i = stack[--top];
    for (const d of [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1]) {
      const j = i + d;
      if (state[j] === 1) {
        state[j] = 2;
        stack[top++] = j;
      }
    }
  }
  return state.map((v) => (v === 2 ? 255 : 0));
}

/** Mutates only the supplied derived pixels. Source files and alpha are preserved. */
export function processPixels(
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  settings: Processing,
) {
  if (pixels.length !== w * h * 4 || w < 1 || h < 1)
    throw new Error("Invalid image dimensions");
  const p = ProcessingSchema.parse(settings);
  if (p.mode === "original" && p.sharpen === 0) return;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < gray.length; i++) {
    const k = i * 4,
      a = pixels[k + 3] / 255;
    // Composite transparent pixels over paper for stable edge detection.
    gray[i] =
      (0.2126 * pixels[k] + 0.7152 * pixels[k + 1] + 0.0722 * pixels[k + 2]) *
        a +
      255 * (1 - a);
  }
  const smooth = gaussian(gray, w, h, p.mode === "original" ? 1 : p.smoothing);
  if (p.mode === "original") {
    for (let i = 0; i < gray.length; i++) {
      const delta = (gray[i] - smooth[i]) * p.sharpen;
      for (let c = 0; c < 3; c++) pixels[i * 4 + c] += delta;
    }
    return;
  }
  if (p.sharpen)
    for (let i = 0; i < gray.length; i++)
      smooth[i] = limit(smooth[i] + p.sharpen * (gray[i] - smooth[i]), 255);
  const edges =
    p.mode === "line-art" ? edgeMask(smooth, w, h, (210 - p.detail) / 2) : null;
  // Local mean reduces uneven illumination; threshold 128 maps to mean minus 8.
  const local = p.adaptive && !edges ? gaussian(smooth, w, h, 4) : null;
  for (let i = 0; i < gray.length; i++) {
    const ink = edges
      ? edges[i] > 0
      : smooth[i] <
        (local ? local[i] + (p.threshold - 128) * 0.5 - 8 : p.threshold);
    pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = ink ? 0 : 255;
    if (!ink && p.transparent) pixels[i * 4 + 3] = 0;
  }
}
