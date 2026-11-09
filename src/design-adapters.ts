import { constructors } from "./pattern-engines";
import { engineEdgeIds } from "./pattern-edges";
import { constructPiece } from "./pattern-geometry";
import {
  designNames,
  type DesignId,
  type Fashion,
  type PatternDraft,
  type PatternOp,
  type PatternPiece,
  type Point2,
} from "./fashion-model";
import type { Teagan } from "@freesewing/teagan";

type Option = {
  pct?: number;
  deg?: number;
  count?: number;
  bool?: boolean;
  list?: string[];
  dflt?: string;
  min?: number;
  max?: number;
  menu?: string;
};
export const designConfig = Object.fromEntries(
  Object.entries(constructors).map(([k, C]) => [k, new C({}).getConfig()]),
) as Record<
  Exclude<DesignId, "teagan">,
  {
    measurements: string[];
    options: Record<string, Option | number | string | boolean>;
  }
>;
export function designControls(design: DesignId) {
  if (design === "teagan") return [];
  return Object.entries(designConfig[design].options)
    .filter(
      ([, o]) =>
        typeof o === "object" &&
        o !== null &&
        (o.pct !== undefined ||
          o.deg !== undefined ||
          o.count !== undefined ||
          o.bool !== undefined ||
          o.list),
    )
    .map(([key, o]) => ({ key, ...(o as Option) }));
}
export function requiredMeasures(design: DesignId) {
  return design === "teagan"
    ? [
        "chest",
        "waist",
        "hips",
        "biceps",
        "neck",
        "shoulderToShoulder",
        "hpsToBust",
        "hpsToWaistBack",
        "waistToArmpit",
        "waistToHips",
        "shoulderToWrist",
        "wrist",
        "shoulderSlope",
      ]
    : designConfig[design].measurements;
}
export function fabricWarnings(f: Fashion) {
  if (!f.fabric) return [];
  const warnings: string[] = [],
    fabric = f.fabric;
  if ((f.design ?? "teagan") === "teagan") {
    if (fabric.structure !== "knit")
      warnings.push(
        "Teagan is a knit T-shirt. A woven fabric needs a different block and closure.",
      );
    const required = (1 / f.bandRatio - 1) * 100;
    if (fabric.stretchWidth < required)
      warnings.push(
        `The neckband needs at least ${required.toFixed(1)}% stretch to reach the opening; entered width stretch is ${fabric.stretchWidth}%. Test the ribbing separately.`,
      );
  }
  for (const key of [
    "chestEase",
    "waistEase",
    "seatEase",
    "extraSeatEase",
    "extraWaistEase",
  ]) {
    const v = f.designOptions?.[key];
    if (typeof v === "number" && v < 0) {
      const stretch = (-v / (100 + v)) * 100;
      if (fabric.stretchWidth < stretch || fabric.structure === "woven")
        warnings.push(
          `${key}: ${v}% negative ease requires ${stretch.toFixed(1)}% stretch. The recorded fabric may not support this.`,
        );
    }
  }
  if (fabric.recovery < 80 && fabric.stretchWidth > 10)
    warnings.push(
      "Low recorded recovery may leave the garment loose after stretching. Check a fabric sample.",
    );
  return warnings;
}
const label = (s: string) =>
  s
    .split(".")
    .at(-1)!
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase());
function translated(ops: PatternOp[], o: Point2): PatternOp[] {
  const p = (v: Point2) => ({ x: v.x - o.x, y: v.y - o.y });
  return ops
    .filter((op) => ["move", "line", "curve", "close"].includes(op.type))
    .map((op) =>
      op.type === "close"
        ? { type: "close" }
        : op.type === "curve"
          ? { type: "curve", to: p(op.to), cp1: p(op.cp1), cp2: p(op.cp2) }
          : { type: op.type, to: p(op.to) },
    );
}
export function draftDesign(f: Fashion): PatternDraft {
  const id = f.design! as Exclude<DesignId, "teagan">,
    config = designConfig[id];
  const missing = config.measurements.filter(
    (k) => !Number.isFinite(f.measurements[k as keyof typeof f.measurements]),
  );
  if (missing.length)
    throw new Error(
      `Enter required measurements: ${missing.map(label).join(", ")}.`,
    );
  const m = f.measurements;
  if (
    id === "titan" &&
    (m.crossSeamFront! >= m.crossSeam! ||
      m.waistBack! >= m.waist ||
      m.seatBack! >= m.seat! ||
      m.waistToKnee! >= m.waistToFloor!)
  )
    throw new Error(
      "Check front/back arcs and vertical leg measurements. Partial measurements must be smaller than their totals.",
    );
  const options: Record<string, unknown> = {};
  const defs = designControls(id);
  for (const [key, value] of Object.entries(f.designOptions ?? {})) {
    const def = defs.find((o) => o.key === key);
    if (!def) throw new Error(`Unsupported ${id} option: ${key}`);
    if (def.bool !== undefined) {
      if (typeof value !== "boolean") throw new Error(`Invalid ${key}`);
    } else if (def.list) {
      if (typeof value !== "string" || !def.list.includes(value))
        throw new Error(`Invalid ${key}`);
    } else if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < (def.min ?? -Infinity) ||
      value > (def.max ?? Infinity) ||
      (def.count !== undefined && !Number.isInteger(value))
    )
      throw new Error(`Invalid ${key}`);
    options[key] = def.pct !== undefined ? Number(value) / 100 : value;
  }
  const engine: Teagan = new constructors[id]({
    measurements: m,
    options,
    sa: f.seamAllowance,
    complete: true,
    paperless: false,
    expand: false,
  }).draft();
  if (engine.setStores.some((s) => s.logs.error.length))
    throw new Error(
      "The design could not be drafted from these measurements. Check the profile.",
    );
  const cutlist = engine.setStores[0].get("cutlist") as Record<
    string,
    {
      materials?: Record<
        string,
        { cut: number; onFold?: boolean; onBias?: boolean }[]
      >;
    }
  >;
  const pieces: PatternPiece[] = [];
  for (const [key, part] of Object.entries(engine.parts[0])) {
    if (part.hidden || Object.keys(part.paths).length === 0) continue;
    let seam = part.paths.seam;
    if (id === "sarah") {
      const front = key.endsWith("front");
      const names = front
        ? ["centerFront", "frontTop", "sideFront", "frontBottom"]
        : ["centerBack", "backBottom", "sideBack", "backTop"];
      seam = part.paths[names[0]].clone();
      for (const name of names.slice(1)) seam = seam.join(part.paths[name]);
      seam = seam.close();
    }
    const klass = (p: typeof seam) =>
      p.attributes?.list?.class?.join(" ") ?? "";
    if (!seam) {
      let boundaries = Object.entries(part.paths)
        .filter(
          ([, p]) =>
            !p.hidden &&
            !/\b(hidden|sa|dashed)\b/.test(klass(p)) &&
            /\b(fabric|lining)\b/.test(klass(p)),
        )
        .map(([, p]) => p);
      if (!boundaries.length && id === "crux")
        boundaries = Object.entries(part.paths)
          .filter(
            ([k, p]) =>
              /(?:Seam|Facing)$/.test(k) && p.ops.at(-1)?.type === "close",
          )
          .map(([, p]) => p);
      if (!boundaries.length && id === "holmes" && part.paths.gore_seam)
        boundaries = [part.paths.gore_seam];
      if (!boundaries.length && id === "percy")
        boundaries = [
          "shortHem",
          "newInseam",
          "newOutseam",
          "crossSeam",
          "waist",
        ]
          .map((k) => part.paths[k])
          .filter(Boolean);
      if (!boundaries.length) throw new Error(`Missing boundary for ${key}`);
      const first = boundaries[0].clone();
      first.ops = boundaries.flatMap((p) => p.ops);
      seam = first;
    }
    const cuts = Object.entries(part.paths)
      .filter(
        ([k, p]) =>
          !p.hidden &&
          !/\bhidden\b/.test(klass(p)) &&
          (/(^|\s)sa(\s|$)/.test(klass(p)) ||
            (id === "sarah" && /^(front|back)(Sa|Hem)$/.test(k))),
      )
      .map(([, p]) => p);
    if (!cuts.length) cuts.push(seam);
    const guideNames =
      /^(chest|waist|dart|helpers|hint|underCollar|saUndercollar|help|frontCenter|placketInnerFold|placketOuterFold|placketFold1|placketFold2|folds|pleats|placketCut|boxPleat|frenchBase|frenchSa)$/;
    const guides = Object.entries(part.paths)
      .filter(
        ([k, p]) =>
          !p.hidden &&
          !/\bhidden\b/.test(klass(p)) &&
          (guideNames.test(k) ||
            (!k.startsWith("__") &&
              /\b(help|mark|dashed|dotted)\b/.test(klass(p)) &&
              !/\bsa\b/.test(klass(p)))),
      )
      .map(([, p]) => p.ops);
    const all = [seam, ...cuts];
    const boxes = all.map((p) => p.bbox());
    const origin = {
      x: Math.min(...boxes.map((b) => b.topLeft.x)),
      y: Math.min(...boxes.map((b) => b.topLeft.y)),
    };
    const width = Math.max(...boxes.map((b) => b.bottomRight.x)) - origin.x,
      height = Math.max(...boxes.map((b) => b.bottomRight.y)) - origin.y;
    if (
      ![width, height, origin.x, origin.y].every(Number.isFinite) ||
      width < 5 ||
      height < 5 ||
      width > 2500 ||
      height > 2500
    )
      throw new Error(`Invalid dimensions for ${key}. Check the measurements.`);
    const grainPath = Object.entries(part.paths).find(([k]) =>
      /^__macro_(grainline|cutonfold)_.*line$/.test(k),
    )?.[1];
    const grainPoints = grainPath?.ops
      .filter((o) => o.type !== "close")
      .map((o) => (o as { to: Point2 }).to);
    const shift = (p: Point2) => ({ x: p.x - origin.x, y: p.y - origin.y });
    const cut = Object.entries(cutlist?.[key]?.materials ?? {})
      .flatMap(([material, entries]) =>
        entries.map(
          (e) =>
            `${e.cut} ${material}${e.onFold ? " on fold" : ""}${e.onBias ? " on bias" : ""}`,
        ),
      )
      .join(" + ");
    const boundary = translated(seam.ops, origin);
    pieces.push({
      id: key,
      name: label(key),
      cut: `Cut ${cut || "according to design instructions"}`,
      width,
      height,
      origin,
      seam: boundary,
      edgeIds: engineEdgeIds(seam.ops, part.points),
      cutline: translated(
        cuts.flatMap((p) => p.ops),
        origin,
      ),
      guides: guides.map((g) => translated(g, origin)),
      notches: Object.values(part.snippets)
        .filter((s) => s.def === "notch" || s.def === "bnotch")
        .map((s) => ({ point: shift(s.anchor), double: s.def === "bnotch" })),
      marks: Object.values(part.snippets)
        .filter((s) => s.def === "button" || s.def === "buttonhole")
        .map((s) => ({
          point: shift(s.anchor),
          kind: s.def as "button" | "buttonhole",
        })),
      grain:
        grainPoints && grainPoints.length >= 2
          ? [shift(grainPoints[0]), shift(grainPoints.at(-1)!)]
          : [
              { x: width / 2, y: height * 0.3 },
              { x: width / 2, y: height * 0.7 },
            ],
      label:
        part.points.title &&
        Number.isFinite(part.points.title.x) &&
        Number.isFinite(part.points.title.y)
          ? shift(part.points.title)
          : { x: width / 2, y: height / 2 },
      handles: [],
      hemY: 0,
      sleeveHalfWidth: 0,
      manualEditable:
        boundary.filter((o) => o.type === "move").length === 1 &&
        boundary.at(-1)?.type === "close",
    });
  }
  if (!pieces.length)
    throw new Error("No visible garment pieces were drafted.");
  for (const p of pieces)
    for (const ops of [p.seam, p.cutline, ...p.guides])
      for (const o of ops)
        if (o.type !== "close")
          for (const v of o.type === "curve" ? [o.to, o.cp1, o.cp2] : [o.to])
            if (!Number.isFinite(v.x) || !Number.isFinite(v.y))
              throw new Error(`Invalid curve in ${p.name}`);
  for (const p of pieces)
    for (const v of [
      p.label,
      ...p.grain,
      ...p.notches.map((n) => n.point),
      ...(p.marks ?? []).map((m) => m.point),
    ]) {
      if (!Number.isFinite(v.x) || !Number.isFinite(v.y))
        throw new Error(
          `Invalid construction mark in ${p.name}. Review the measurements and design options.`,
        );
    }
  const warnings = fabricWarnings(f);
  if (engine.setStores.some((s) => s.logs.warn.length))
    warnings.push(
      "The engine reported a fit warning. Check this draft with a toile before cutting final fabric.",
    );
  if (id === "titan" || id === "brian" || id === "sarah")
    warnings.push(
      `${designNames[id]} is a starting block. Add and verify the closures, facings and finishing required for your garment.`,
    );
  if (f.construction && Object.keys(f.construction).length)
    warnings.push(
      "Manual pieces retain their saved geometry; recheck joining seams after changing measurements.",
    );
  return {
    pieces: pieces.map((p) =>
      f.construction?.[p.id] ? constructPiece(p.id, f.construction[p.id]) : p,
    ),
    neckLength: 0,
    warnings,
  };
}
