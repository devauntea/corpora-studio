import { Teagan } from "@freesewing/teagan";
import {
  FashionSchema,
  type Fashion,
  type PatternDraft,
  type PatternOp,
  type PatternPiece,
  type Point2,
} from "./fashion-model";

const shift = (p: Point2, origin: Point2) => ({
  x: p.x - origin.x,
  y: p.y - origin.y,
});
function normalize(ops: PatternOp[], origin: Point2): PatternOp[] {
  return ops.map((o) =>
    o.type === "close"
      ? { type: "close" }
      : o.type === "curve"
        ? {
            type: o.type,
            to: shift(o.to, origin),
            cp1: shift(o.cp1, origin),
            cp2: shift(o.cp2, origin),
          }
        : { type: o.type, to: shift(o.to, origin) },
  );
}
function rect(x: number, y: number, w: number, h: number): PatternOp[] {
  return [
    { type: "move", to: { x, y } },
    { type: "line", to: { x: x + w, y } },
    { type: "line", to: { x: x + w, y: y + h } },
    { type: "line", to: { x, y: y + h } },
    { type: "close" },
  ];
}
// Numerical integration of the two neckline curves; converges below 0.01 mm
// for the supported adult measurement and neckline ranges.
function curveLength(from: Point2, op: Extract<PatternOp, { type: "curve" }>) {
  let length = 0,
    prev = from;
  for (let i = 1; i <= 256; i++) {
    const t = i / 256,
      u = 1 - t;
    const p = {
      x:
        u * u * u * from.x +
        3 * u * u * t * op.cp1.x +
        3 * u * t * t * op.cp2.x +
        t * t * t * op.to.x,
      y:
        u * u * u * from.y +
        3 * u * u * t * op.cp1.y +
        3 * u * t * t * op.cp2.y +
        t * t * t * op.to.y,
    };
    length += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return length;
}
export function draftFashion(input: Fashion): PatternDraft {
  const f = FashionSchema.parse(input),
    m = f.measurements;
  if (
    m.hpsToBust >= m.hpsToWaistBack ||
    m.waistToArmpit >= m.hpsToWaistBack - 70
  )
    throw new Error(
      "Check the vertical measurements: bust and armpit levels must be above the waist and below the shoulder.",
    );
  if (m.shoulderToShoulder / 2 <= m.neck / 4.8 + 35)
    throw new Error(
      "Check neck circumference and shoulder width; the shoulder seam is too short to draft.",
    );
  const options = Object.fromEntries(
    Object.entries(f.options).map(([k, v]) => [
      k,
      typeof v === "number" ? v / 100 : v,
    ]),
  );
  const engine = new Teagan({
    measurements: m,
    options,
    sa: f.seamAllowance,
    complete: true,
    paperless: false,
  }).draft();
  if (engine.setStores.some((s) => s.logs.error.length))
    throw new Error(
      "These measurements could not produce a complete pattern. Review the profile and fit options.",
    );
  let neckLength = 0;
  const pieces: PatternPiece[] = (["front", "back", "sleeve"] as const).map(
    (id) => {
      const part = engine.parts[0][`teagan.${id}`],
        seam = part?.paths.seam,
        cut = part?.paths.sa ?? seam;
      if (!seam || !cut)
        throw new Error(
          "The drafting engine did not produce every garment piece.",
        );
      const box = cut.bbox(),
        origin = { x: box.topLeft.x, y: box.topLeft.y };
      const width = box.bottomRight.x - origin.x,
        height = box.bottomRight.y - origin.y;
      if (
        ![width, height, origin.x, origin.y].every(Number.isFinite) ||
        width < 20 ||
        height < 20 ||
        width > 2500 ||
        height > 2500
      )
        throw new Error(
          "Pattern dimensions are outside this workspace’s supported range. Check the measurements.",
        );
      const title = shift(part.points.title, origin);
      if (id !== "sleeve") {
        const ops = seam.ops,
          lastCurve =
            ops.length -
            1 -
            [...ops].reverse().findIndex((o) => o.type === "curve"),
          op = ops[lastCurve];
        const prev = ops[lastCurve - 1];
        if (op.type === "curve" && prev.type !== "close")
          neckLength += 2 * curveLength(prev.to, op);
      }
      const midX = id === "sleeve" ? width / 2 : 30;
      const guides = [part.paths.chest, part.paths.waist]
        .filter(Boolean)
        .map((p) => normalize(p.ops, origin));
      const handles: PatternPiece["handles"] =
        id === "front"
          ? [
              { kind: "neck", point: shift(part.points.cfNeck, origin) },
              { kind: "length", point: shift(part.points.hem, origin) },
            ]
          : id === "sleeve"
            ? [{ kind: "sleeve", point: shift(part.points.hemRight, origin) }]
            : [];
      return {
        id,
        name:
          id === "front"
            ? "Front bodice"
            : id === "back"
              ? "Back bodice"
              : "Sleeve",
        cut: id === "sleeve" ? "Cut 2 mirrored" : "Cut 1 on fold",
        width,
        height,
        seam: normalize(seam.ops, origin),
        cutline: normalize(cut.ops, origin),
        guides,
        notches: Object.values(part.snippets)
          .filter((s) => ["notch", "bnotch"].includes(s.def))
          .map((s) => ({
            point: shift(s.anchor, origin),
            double: s.def === "bnotch",
          })),
        grain: [
          { x: midX, y: height * 0.3 },
          { x: midX, y: height * 0.78 },
        ],
        label: title,
        handles,
        origin,
        hemY: part.points.hem?.y ?? part.points.hemRight?.y ?? 0,
        sleeveHalfWidth: part.points.bicepsRight?.x ?? 0,
      };
    },
  );
  const sa = f.seamAllowance,
    w = neckLength * f.bandRatio + 2 * sa,
    h = f.bandWidth * 2 + 2 * sa;
  pieces.push({
    id: "neckband",
    name: "Rib neckband",
    cut: "Cut 1 · stretch along length",
    width: w,
    height: h,
    seam: rect(sa, sa, w - 2 * sa, h - 2 * sa),
    cutline: rect(0, 0, w, h),
    guides: [
      [
        { type: "move", to: { x: 0, y: h / 2 } },
        { type: "line", to: { x: w, y: h / 2 } },
      ],
    ],
    notches: [0.25, 0.5, 0.75].map((t) => ({
      point: { x: sa + (w - 2 * sa) * t, y: 0 },
      double: false,
    })),
    grain: [
      { x: sa + 10, y: h - 5 },
      { x: w - sa - 10, y: h - 5 },
    ],
    label: { x: w / 2, y: h / 2 - 4 },
    handles: [],
    origin: { x: 0, y: 0 },
    hemY: h,
    sleeveHalfWidth: 0,
  });
  // A failed solver can leave NaN control points despite a finite bounding box.
  for (const piece of pieces)
    for (const ops of [piece.seam, piece.cutline, ...piece.guides])
      for (const op of ops)
        if (op.type !== "close")
          for (const p of op.type === "curve"
            ? [op.to, op.cp1, op.cp2]
            : [op.to])
            if (!Number.isFinite(p.x) || !Number.isFinite(p.y))
              throw new Error(
                "The pattern contains an invalid curve. Review the profile.",
              );
  const warnings: string[] = [];
  if (engine.setStores.some((s) => s.logs.warn.length))
    warnings.push(
      "The drafting engine reported a fit warning. Check the armhole, sleeve and waist curves before cutting.",
    );
  return { pieces, neckLength, warnings };
}
