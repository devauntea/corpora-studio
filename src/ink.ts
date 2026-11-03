import { type Asset, type Layer, imageSource, clamp } from "./domain";
import { loadImage } from "./io";

export function inkKey(a: Asset, l: Layer) {
  return JSON.stringify([
    a.sha256,
    l.removePaper,
    l.monochrome,
    l.ink,
    l.inkColor,
    l.contrast,
    l.saturation,
    l.threshold,
  ]);
}
export class InkCache {
  images = new Map<string, Promise<HTMLImageElement>>();
  variants = new Map<string, HTMLCanvasElement>();
  async image(a: Asset) {
    if (!this.images.has(a.sha256))
      this.images.set(a.sha256, loadImage(imageSource(a)));
    return this.images.get(a.sha256)!;
  }
  async get(a: Asset, l: Layer) {
    const key = inkKey(a, l);
    if (this.variants.has(key)) return this.variants.get(key)!;
    const img = await this.image(a),
      c = document.createElement("canvas"),
      scale = Math.min(1, 2048 / Math.max(img.width, img.height));
    c.width = Math.max(1, Math.round(img.width * scale));
    c.height = Math.max(1, Math.round(img.height * scale));
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const pixels = ctx.getImageData(0, 0, c.width, c.height),
      p = pixels.data,
      mode = l.ink ?? "legacy";
    const color = (l.inkColor ?? "#29382e")
      .slice(1)
      .match(/../g)!
      .map((v) => parseInt(v, 16));
    for (let i = 0; i < p.length; i += 4) {
      const original = [p[i], p[i + 1], p[i + 2]],
        lum = 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];
      let rgb = original.map((v) =>
        clamp(
          (lum + (v - lum) * (l.saturation ?? 1) - 128) * (l.contrast ?? 1) +
            128,
          0,
          255,
        ),
      );
      const intensity = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
      if (mode === "stencil") {
        const dark = intensity < (l.threshold ?? 128);
        rgb = [28, 28, 28];
        p[i + 3] = dark ? p[i + 3] : 0;
      } else {
        if (l.removePaper)
          p[i + 3] = Math.round(p[i + 3] * (1 - Math.min(...rgb) / 255));
        if (mode === "legacy" && l.monochrome) {
          const value = l.removePaper ? 28 : intensity;
          rgb = [value, value, value];
        }
        if (mode === "black") rgb = [20, 20, 20];
        if (mode === "gray")
          rgb = [intensity * 0.55, intensity * 0.55, intensity * 0.55];
        if (mode === "soft") {
          rgb = [85, 85, 85];
          p[i + 3] *= 0.65;
        }
        if (mode === "custom") rgb = color;
      }
      [p[i], p[i + 1], p[i + 2]] = rgb;
    }
    ctx.putImageData(pixels, 0, 0);
    this.variants.set(key, c);
    return c;
  }
  prune(assets: Asset[], layers: Layer[]) {
    const keys = new Set(
      layers.map((l) => {
        const a = assets.find((a) => a.id === l.assetId);
        return a ? inkKey(a, l) : "";
      }),
    );
    for (const k of this.variants.keys())
      if (!keys.has(k)) this.variants.delete(k);
    const ids = new Set(assets.map((a) => a.sha256));
    for (const k of this.images.keys()) if (!ids.has(k)) this.images.delete(k);
  }
  clear() {
    this.images.clear();
    this.variants.clear();
  }
}
