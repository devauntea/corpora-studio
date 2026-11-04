import { processPixels } from "./image-processing";
import { clamp, artworkBounds, type ArtworkEdits } from "./domain";

export function backgroundAlpha(
  r: number,
  g: number,
  b: number,
  edits: ArtworkEdits,
) {
  if (edits.background === "none") return 1;
  const color =
    edits.background === "white"
      ? [255, 255, 255]
      : edits.background === "black"
        ? [0, 0, 0]
        : edits.color
            .slice(1)
            .match(/../g)!
            .map((x) => parseInt(x, 16));
  // Max channel distance preserves saturated light colors better than luminance keying.
  const distance = Math.max(
    Math.abs(r - color[0]),
    Math.abs(g - color[1]),
    Math.abs(b - color[2]),
  );
  return clamp((distance - edits.tolerance) / edits.feather, 0, 1);
}
const baseCache = new WeakMap<
  HTMLImageElement,
  { key: string; canvas: HTMLCanvasElement; mask: HTMLCanvasElement }
>();
export function renderArtwork(
  image: HTMLImageElement,
  edits: ArtworkEdits | undefined,
  maxEdge = 2048,
) {
  const bounds = artworkBounds(image.width, image.height, edits?.crop);
  const c = document.createElement("canvas"),
    scale = Math.min(1, maxEdge / Math.max(bounds.width, bounds.height));
  c.width = Math.max(1, Math.round(bounds.width * scale));
  c.height = Math.max(1, Math.round(bounds.height * scale));
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(
    image,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    0,
    0,
    c.width,
    c.height,
  );
  if (!edits) return c;
  const cacheKey = JSON.stringify([
    maxEdge,
    bounds,
    edits.background,
    edits.color,
    edits.tolerance,
    edits.feather,
    edits.grayscale,
    edits.contrast,
    edits.processing,
  ]);
  let cached = baseCache.get(image);
  if (cached?.key !== cacheKey) {
    const base = document.createElement("canvas");
    base.width = c.width;
    base.height = c.height;
    const bx = base.getContext("2d")!;
    const mask = document.createElement("canvas");
    mask.width = c.width;
    mask.height = c.height;
    const mx = mask.getContext("2d")!;
    const pixels = ctx.getImageData(0, 0, c.width, c.height),
      alpha = mx.createImageData(c.width, c.height),
      p = pixels.data;
    const color =
      edits.background === "white"
        ? [255, 255, 255]
        : edits.background === "black"
          ? [0, 0, 0]
          : edits.color
              .slice(1)
              .match(/../g)!
              .map((x) => parseInt(x, 16));
    for (let i = 0; i < p.length; i += 4) {
      alpha.data[i] = alpha.data[i + 1] = alpha.data[i + 2] = 255;
      const distance = Math.max(
        Math.abs(p[i] - color[0]),
        Math.abs(p[i + 1] - color[1]),
        Math.abs(p[i + 2] - color[2]),
      );
      alpha.data[i + 3] =
        edits.background === "none"
          ? 255
          : Math.round(
              clamp((distance - edits.tolerance) / edits.feather, 0, 1) * 255,
            );
      const lum = 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];
      for (let k = 0; k < 3; k++)
        p[i + k] = clamp(
          ((edits.grayscale ? lum : p[i + k]) - 128) * edits.contrast + 128,
          0,
          255,
        );
    }
    if (edits.processing)
      processPixels(pixels.data, c.width, c.height, edits.processing);
    bx.putImageData(pixels, 0, 0);
    mx.putImageData(alpha, 0, 0);
    cached = { key: cacheKey, canvas: base, mask };
    baseCache.set(image, cached);
  }
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.drawImage(cached.canvas, 0, 0);
  const mask = document.createElement("canvas");
  mask.width = c.width;
  mask.height = c.height;
  const m = mask.getContext("2d")!;
  m.drawImage(cached.mask, 0, 0);
  const px = (x: number) =>
    ((x * image.width - bounds.x) / bounds.width) * c.width;
  const py = (y: number) =>
    ((y * image.height - bounds.y) / bounds.height) * c.height;
  const unit = (image.width / bounds.width) * c.width;
  for (const stroke of edits.strokes) {
    m.globalCompositeOperation =
      stroke.mode === "erase" ? "destination-out" : "source-over";
    m.strokeStyle = m.fillStyle = "#fff";
    m.lineCap = m.lineJoin = "round";
    m.lineWidth = stroke.radius * unit * 2;
    m.beginPath();
    stroke.points.forEach(([x, y], i) =>
      i ? m.lineTo(px(x), py(y)) : m.moveTo(px(x), py(y)),
    );
    m.stroke();
    const [x, y] = stroke.points[0];
    m.beginPath();
    m.arc(px(x), py(y), stroke.radius * unit, 0, Math.PI * 2);
    m.fill();
  }
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  return c;
}
