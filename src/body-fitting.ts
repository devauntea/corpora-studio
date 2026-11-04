import { z } from "zod";
const finite = (min: number, max: number) =>
  z.number().finite().min(min).max(max);
export const fitLevels = ["chest", "waist", "hips"] as const;
export type FitLevel = (typeof fitLevels)[number];
export const FitShapeSchema = z
  .object({
    levels: z.tuple([finite(-0.5, 5.8), finite(-0.5, 5.8), finite(-0.5, 5.8)]),
    scales: z.tuple([
      finite(0.65, 1.5),
      finite(0.65, 1.5),
      finite(0.65, 1.5),
      finite(0.65, 1.5),
      finite(0.65, 1.5),
      finite(0.65, 1.5),
    ]),
  })
  .strict()
  .refine(
    (s) => s.levels[0] > s.levels[1] + 0.4 && s.levels[1] > s.levels[2] + 0.4,
    "Fit levels must descend from chest to waist to seat",
  );
export type FitShape = z.infer<typeof FitShapeSchema>;
export const landmarkKeys = [
  "top",
  "floor",
  "neck",
  "chestLeft",
  "chestRight",
  "waistLeft",
  "waistRight",
  "hipsLeft",
  "hipsRight",
] as const;
export type Landmark = (typeof landmarkKeys)[number];
const ViewSchema = z
  .object({ assetId: z.string().uuid(), view: z.enum(["front", "side"]) })
  .strict();
// Partial record is represented with a strict object so unfinished captures remain saveable.
const pointSchema = z.tuple([finite(0, 1), finite(0, 1)]);
const PointsSchema = z
  .object({
    top: pointSchema.optional(),
    floor: pointSchema.optional(),
    neck: pointSchema.optional(),
    chestLeft: pointSchema.optional(),
    chestRight: pointSchema.optional(),
    waistLeft: pointSchema.optional(),
    waistRight: pointSchema.optional(),
    hipsLeft: pointSchema.optional(),
    hipsRight: pointSchema.optional(),
  })
  .strict();
export const BodyStudySchema = z
  .object({
    height: finite(1000, 2300),
    views: z.array(ViewSchema.extend({ points: PointsSchema })).max(4),
    tape: z
      .object({
        chest: finite(500, 1800).optional(),
        waist: finite(400, 1800).optional(),
        hips: finite(500, 1900).optional(),
      })
      .strict(),
    notes: z.string().max(1500),
    result: z
      .object({
        shape: FitShapeSchema,
        length: finite(700, 2200),
        sex: z.enum(["male", "female"]),
        muscularity: finite(0, 1),
        residuals: z
          .array(
            z
              .object({
                label: z.string().max(100),
                target: finite(0, 3000),
                predicted: finite(0, 3000),
                error: finite(-3000, 3000),
              })
              .strict(),
          )
          .max(16),
      })
      .strict()
      .optional(),
  })
  .strict();
export type BodyStudy = z.infer<typeof BodyStudySchema>;
export function fitWeights(y: number, levels: readonly number[]) {
  const w = levels.map((level, i) =>
      Math.exp(-(((y - level) / (i === 2 ? 1.1 : 0.9)) ** 2)),
    ),
    sum = Math.max(
      1,
      w.reduce((a, b) => a + b, 0),
    );
  return w.map((v) => v / sum);
}
export function deformBodyPoint(
  p: readonly number[],
  weights: readonly number[],
  shape?: FitShape,
): [number, number, number] {
  if (!shape) return [p[0], p[1], p[2]];
  const w = fitWeights(p[1], shape.levels),
    gate = 1 - Math.min(1, Math.max(weights[0] ?? 0, weights[3] ?? 0) * 2),
    sx = 1 + w.reduce((s, v, i) => s + v * (shape.scales[i * 2] - 1), 0) * gate,
    sz =
      1 +
      w.reduce((s, v, i) => s + v * (shape.scales[i * 2 + 1] - 1), 0) * gate;
  return [p[0] * sx, p[1], p[2] * sz];
}
export type FitTarget = {
  level: FitLevel;
  kind: "width" | "depth" | "circumference";
  value: number;
};
export function photoFitTargets(
  study: BodyStudy,
  assets: { id: string; width: number; height: number }[],
  sex: "male" | "female",
) {
  const front = study.views.find((v) => v.view === "front"),
    side = study.views.find((v) => v.view === "side");
  if (!front || !side)
    throw new Error("Confirm a front and a side photograph first.");
  const targets: FitTarget[] = [],
    ys: number[][] = [[], [], []],
    neckLengths: number[] = [];
  for (const view of [front, side]) {
    const asset = assets.find((a) => a.id === view.assetId);
    if (!asset) throw new Error("Missing fitting photograph.");
    for (const key of landmarkKeys)
      if (!view.points[key])
        throw new Error(`Mark ${key} on the ${view.view} photograph.`);
    const p = view.points as Record<Landmark, [number, number]>,
      span = p.floor[1] - p.top[1];
    if (span < 0.3 || p.neck[1] <= p.top[1] || p.neck[1] >= p.floor[1] - 0.4)
      throw new Error(
        "Head, under-jaw and floor landmarks must be ordered vertically.",
      );
    if (
      Math.abs(p.floor[0] - p.top[0]) * asset.width >
      span * asset.height * 0.12
    )
      throw new Error("Use an upright photograph with the head over the feet.");
    const mmPerY = study.height / span;
    neckLengths.push((p.floor[1] - p.neck[1]) * mmPerY);
    for (const [i, level] of fitLevels.entries()) {
      const a = p[`${level}Left`],
        b = p[`${level}Right`];
      if (Math.abs(a[1] - b[1]) > 0.025)
        throw new Error(
          `${level} endpoints must lie on the same horizontal level.`,
        );
      const width =
        ((Math.abs(a[0] - b[0]) * asset.width) / asset.height) * mmPerY;
      if (width < 80 || width > 850)
        throw new Error(
          `${level} photo span is outside the supported adult range.`,
        );
      targets.push({
        level,
        kind: view.view === "front" ? "width" : "depth",
        value: width,
      });
      ys[i].push((p.floor[1] - (a[1] + b[1]) / 2) * mmPerY);
    }
  }
  const length = neckLengths.reduce((a, b) => a + b) / 2;
  if (Math.abs(neckLengths[0] - neckLengths[1]) > length * 0.05)
    throw new Error(
      "Front and side neck-to-floor scales differ by more than 5%. Recheck landmarks and perspective.",
    );
  const extent = sex === "male" ? 15.5738158226 : 15.5677456856,
    bottom = 7.4 - extent,
    scale = length / extent;
  const levels = ys.map(
    (v) => bottom + (v[0] + v[1]) / 2 / scale,
  ) as FitShape["levels"];
  if (
    levels.some((y) => y < -0.5 || y > 5.8) ||
    !(levels[0] > levels[1] + 0.4 && levels[1] > levels[2] + 0.4)
  )
    throw new Error(
      "Chest, waist and seat levels must be ordered on the torso.",
    );
  for (const level of fitLevels) {
    const value = study.tape[level];
    if (value !== undefined)
      targets.push({ level, kind: "circumference", value });
  }
  return { length, levels, scale, targets };
}
export type FitInput = {
  vertices: Float32Array;
  armGates?: Float32Array;
  indices: Uint32Array;
  levels: FitShape["levels"];
  scale: number;
  targets: FitTarget[];
};
type Segment = {
  a: [number, number, number, number?];
  b: [number, number, number, number?];
};
/** Convex tape path around a torso cross-section. Closes the arm partition
 * openings and bridges skin creases as a taut tape would; not a geodesic measure. */
export function tapeHull(segments: Segment[]): Segment[] {
  const points = [
    ...new Map(
      segments
        .flatMap((s) => [s.a, s.b])
        .map((p) => [`${p[0].toFixed(6)},${p[2].toFixed(6)}`, p]),
    ).values(),
  ].sort((a, b) => a[0] - b[0] || a[2] - b[2]);
  const turn = (a: Segment["a"], b: Segment["a"], c: Segment["a"]) =>
    (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
  const half = (ps: typeof points) => {
    const out: typeof points = [];
    for (const p of ps) {
      while (out.length >= 2 && turn(out.at(-2)!, out.at(-1)!, p) <= 0)
        out.pop();
      out.push(p);
    }
    return out;
  };
  const hull = [
    ...half(points).slice(0, -1),
    ...half([...points].reverse()).slice(0, -1),
  ];
  if (hull.length < 3)
    throw new Error("Measurement cross-section has no area.");
  return hull.map((a, i) => ({ a, b: hull[(i + 1) % hull.length] }));
}
export function fitBody(
  input: FitInput,
  progress: (v: number) => void = () => {},
) {
  const { vertices, indices, levels, scale, targets } = input;
  if (
    (input.armGates &&
      (input.armGates.length !== vertices.length / 3 ||
        input.armGates.some((v) => !Number.isFinite(v) || v < 0 || v > 1))) ||
    vertices.length % 3 ||
    vertices.length > 750000 ||
    indices.length % 3 ||
    indices.length > 1500000 ||
    !Number.isFinite(scale) ||
    scale < 30 ||
    scale > 180
  )
    throw new Error("Invalid fitting input.");
  const slices = levels.map((y) => {
    const segments: Segment[] = [];
    for (let i = 0; i < indices.length; i += 3) {
      const hits: [number, number, number, number?][] = [];
      for (let k = 0; k < 3; k++) {
        const a = indices[i + k] * 3,
          b = indices[i + ((k + 1) % 3)] * 3,
          ay = vertices[a + 1],
          by = vertices[b + 1];
        if ((ay <= y && by > y) || (by <= y && ay > y)) {
          const t = (y - ay) / (by - ay);
          hits.push([
            vertices[a] + (vertices[b] - vertices[a]) * t,
            y,
            vertices[a + 2] + (vertices[b + 2] - vertices[a + 2]) * t,
            input.armGates
              ? input.armGates[a / 3] +
                (input.armGates[b / 3] - input.armGates[a / 3]) * t
              : 1,
          ]);
        }
      }
      if (hits.length === 2) segments.push({ a: hits[0], b: hits[1] });
    }
    if (segments.length < 8)
      throw new Error(
        "A measurement plane does not intersect enough of the body.",
      );
    return tapeHull(segments);
  });
  const predict = (scales: FitShape["scales"]) =>
    slices.map((segments) => {
      const shape = { levels, scales };
      let minX = Infinity,
        maxX = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity,
        circumference = 0;
      for (const s of segments) {
        const a = deformBodyPoint(
            s.a.slice(0, 3) as [number, number, number],
            [(1 - (s.a[3] ?? 1)) / 2],
            shape,
          ),
          b = deformBodyPoint(
            s.b.slice(0, 3) as [number, number, number],
            [(1 - (s.b[3] ?? 1)) / 2],
            shape,
          );
        for (const p of [a, b]) {
          minX = Math.min(minX, p[0]);
          maxX = Math.max(maxX, p[0]);
          minZ = Math.min(minZ, p[2]);
          maxZ = Math.max(maxZ, p[2]);
        }
        circumference += Math.hypot(a[0] - b[0], a[2] - b[2]) * scale;
      }
      return {
        width: (maxX - minX) * scale,
        depth: (maxZ - minZ) * scale,
        circumference,
      };
    });
  const loss = (scales: FitShape["scales"]) => {
    const p = predict(scales);
    return (
      targets.reduce(
        (sum, t) =>
          sum +
          ((p[fitLevels.indexOf(t.level)][t.kind] - t.value) /
            (t.kind === "circumference" ? 12 : 8)) **
            2,
        0,
      ) + scales.reduce((s, v) => s + (v - 1) ** 2 * 0.08, 0)
    );
  };
  const scales: FitShape["scales"] = [1, 1, 1, 1, 1, 1];
  let score = loss(scales);
  for (let pass = 0; pass < 42; pass++) {
    const step = 0.14 * Math.pow(0.84, pass);
    for (let j = 0; j < 6; j++) {
      const old = scales[j];
      let best = old;
      for (const sign of [-1, 1]) {
        scales[j] = Math.max(0.65, Math.min(1.5, old + sign * step));
        const next = loss(scales);
        if (next < score) {
          score = next;
          best = scales[j];
        }
      }
      scales[j] = best;
    }
    progress((pass + 1) / 42);
  }
  const p = predict(scales),
    residuals = targets.map((t) => ({
      label: `${t.level} ${t.kind}`,
      target: t.value,
      predicted: p[fitLevels.indexOf(t.level)][t.kind],
      error: p[fitLevels.indexOf(t.level)][t.kind] - t.value,
    }));
  return { shape: { levels, scales }, residuals };
}
