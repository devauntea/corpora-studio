export type Contour = {
  id: number;
  points: [number, number][];
  length: number;
};
/** Zhang-Suen thinning followed by edge-disjoint graph walks. Contours are in source pixels. */
export function traceStencil(
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  threshold = 128,
  progress = (n: number) => {
    void n;
  },
): Contour[] {
  if (w < 3 || h < 3 || w * h > 1_100_000 || pixels.length !== w * h * 4)
    throw new Error("Trace images must be at most 1.1 megapixels.");
  const mask = new Uint8Array(w * h),
    offsets = [-w, 1 - w, 1, w + 1, w, w - 1, -1, -w - 1];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x,
        k = i * 4,
        a = pixels[k + 3] / 255;
      mask[i] =
        (0.2126 * pixels[k] + 0.7152 * pixels[k + 1] + 0.0722 * pixels[k + 2]) *
          a +
          255 * (1 - a) <
        threshold
          ? 1
          : 0;
    }
  let changed = true,
    pass = 0;
  while (changed && pass < 256) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      const remove: number[] = [];
      for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (!mask[i]) continue;
          const ns = offsets.map((o) => mask[i + o]),
            count = ns.reduce((a, b) => a + b, 0);
          if (count < 2 || count > 6) continue;
          let transitions = 0;
          for (let j = 0; j < 8; j++)
            if (!ns[j] && ns[(j + 1) % 8]) transitions++;
          if (transitions !== 1) continue;
          if (
            step === 0
              ? ns[0] * ns[2] * ns[4] || ns[2] * ns[4] * ns[6]
              : ns[0] * ns[2] * ns[6] || ns[0] * ns[4] * ns[6]
          )
            continue;
          remove.push(i);
        }
      for (const i of remove) mask[i] = 0;
      changed ||= remove.length > 0;
    }
    pass++;
    if (pass % 8 === 0) progress(Math.min(0.7, 0.1 + pass / 365));
  }
  if (changed)
    throw new Error(
      "Dense filled regions could not be thinned within the resource limit. Use the Line art preparation mode first.",
    );
  const neighbours = (i: number) =>
    offsets.flatMap((o, d) =>
      mask[i + o] &&
      (d % 2 === 0 ||
        (!mask[i + offsets[(d + 7) % 8]] && !mask[i + offsets[(d + 1) % 8]]))
        ? [d]
        : [],
    );
  const used = new Uint8Array(mask.length),
    degree = new Uint8Array(mask.length);
  for (let i = w; i < mask.length - w; i++)
    if (mask[i]) degree[i] = neighbours(i).length;
  const contours: Contour[] = [];
  let pointCount = 0;
  function walk(start: number, direction: number) {
    let current = start,
      d = direction;
    const points: [number, number][] = [[start % w, Math.floor(start / w)]];
    let length = 0;
    do {
      used[current] |= 1 << d;
      const next = current + offsets[d];
      used[next] |= 1 << ((d + 4) % 8);
      length += d % 2 ? Math.SQRT2 : 1;
      points.push([next % w, Math.floor(next / w)]);
      current = next;
      if (degree[current] !== 2 || current === start) break;
      d = neighbours(current).find((j) => !(used[current] & (1 << j))) ?? -1;
    } while (d >= 0 && points.length <= mask.length);
    if (length >= 2) {
      pointCount += points.length;
      if (pointCount > 250000 || contours.length >= 4000)
        throw new Error(
          "Too many stencil lines. Reduce detail or clean the artwork first.",
        );
      contours.push({ id: contours.length, points, length });
    }
  }
  for (let i = w; i < mask.length - w; i++)
    if (degree[i] && degree[i] !== 2)
      for (const d of neighbours(i)) if (!(used[i] & (1 << d))) walk(i, d);
  for (let i = w; i < mask.length - w; i++)
    if (degree[i])
      for (const d of neighbours(i)) if (!(used[i] & (1 << d))) walk(i, d);
  progress(1);
  return contours;
}
