import Clipper from "clipper-lib";
import { ConstructionSchema, type Construction } from "./fashion-construction";
import type { PatternOp, PatternPiece, Point2 } from "./fashion-model";
const sub = (a: Point2, b: Point2): Point2 => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Point2, b: Point2): Point2 => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Point2, s: number): Point2 => ({ x: a.x * s, y: a.y * s });
const cross = (a: Point2, b: Point2) => a.x * b.y - a.y * b.x;
const distance = (a: Point2, b: Point2) => Math.hypot(a.x - b.x, a.y - b.y);
export function segmentStart(ops: PatternOp[], index: number): Point2 {
  const prev = ops[index - 1];
  return prev && prev.type !== "close"
    ? prev.to
    : (ops[0] as { to: Point2 }).to;
}
export function segmentPoint(
  ops: PatternOp[],
  index: number,
  t: number,
): Point2 {
  const a = segmentStart(ops, index),
    op = ops[index];
  const b = op.type === "close" ? (ops[0] as { to: Point2 }).to : op.to;
  if (op.type !== "curve") return add(mul(a, 1 - t), mul(b, t));
  const u = 1 - t;
  return add(
    add(mul(a, u * u * u), mul(op.cp1, 3 * u * u * t)),
    add(mul(op.cp2, 3 * u * t * t), mul(b, t * t * t)),
  );
}
export function flatten(ops: PatternOp[], tolerance = 0.1) {
  const points: { point: Point2; edge: number; t: number }[] = [];
  if (ops[0]?.type !== "move")
    throw new Error("A boundary needs a starting point.");
  points.push({ point: ops[0].to, edge: 0, t: 0 });
  for (let i = 1; i < ops.length; i++) {
    const a = segmentStart(ops, i),
      b = segmentPoint(ops, i, 1),
      op = ops[i];
    if (op.type !== "curve") {
      if (distance(a, b) > 0.00001) points.push({ point: b, edge: i, t: 1 });
      continue;
    }
    const split = (
      p0: Point2,
      p1: Point2,
      p2: Point2,
      p3: Point2,
      t0: number,
      t1: number,
      depth: number,
    ) => {
      const chord = sub(p3, p0),
        len = distance(p0, p3);
      const flat =
        len < 1e-8
          ? Math.max(distance(p0, p1), distance(p0, p2))
          : Math.max(
              Math.abs(cross(sub(p1, p0), chord)),
              Math.abs(cross(sub(p2, p0), chord)),
            ) / len;
      // Control polygon length catches collinear curves that double back.
      if (
        depth >= 12 ||
        (flat <= tolerance &&
          distance(p0, p1) + distance(p1, p2) + distance(p2, p3) - len <=
            tolerance)
      ) {
        points.push({ point: p3, edge: i, t: t1 });
        return;
      }
      const a = mul(add(p0, p1), 0.5),
        b = mul(add(p1, p2), 0.5),
        c = mul(add(p2, p3), 0.5),
        d = mul(add(a, b), 0.5),
        e = mul(add(b, c), 0.5),
        m = mul(add(d, e), 0.5),
        tm = (t0 + t1) / 2;
      split(p0, a, d, m, t0, tm, depth + 1);
      split(m, e, c, p3, tm, t1, depth + 1);
    };
    split(a, op.cp1, op.cp2, b, 0, 1, 0);
  }
  return points;
}
export function segmentLength(ops: PatternOp[], index: number) {
  return flatten(ops).reduce(
    (total, p, i, all) =>
      total + (i && p.edge === index ? distance(all[i - 1].point, p.point) : 0),
    0,
  );
}
function signedArea(p: Point2[]) {
  return p.reduce((a, v, i) => a + cross(v, p[(i + 1) % p.length]), 0) / 2;
}
function intersections(a: Point2, b: Point2, c: Point2, d: Point2) {
  const ab = sub(b, a),
    cd = sub(d, c),
    det = cross(ab, cd),
    ca = sub(c, a);
  if (Math.abs(det) < 1e-9) {
    if (Math.abs(cross(ca, ab)) > 1e-7) return false;
    const len = ab.x * ab.x + ab.y * ab.y;
    const t = (ca.x * ab.x + ca.y * ab.y) / len,
      u = ((d.x - a.x) * ab.x + (d.y - a.y) * ab.y) / len;
    return Math.max(Math.min(t, u), 0) <= Math.min(Math.max(t, u), 1) + 1e-9;
  }
  const t = cross(ca, cd) / det,
    u = cross(ca, ab) / det;
  return t >= -1e-9 && t <= 1 + 1e-9 && u >= -1e-9 && u <= 1 + 1e-9;
}
/** Closed polygon + outward edge strips + bounded miter joins; integer union
 * resolves concave joins. Cubics flatten to <=0.1 mm; union precision 0.001 mm. */
export function allowanceOutline(
  seam: PatternOp[],
  allowances: number[],
): PatternOp[] {
  const samples = flatten(seam),
    edges = samples.slice(1).map((p, i) => ({
      a: samples[i].point,
      b: p.point,
      sa: allowances[p.edge],
    }));
  if (!edges.length || edges.length > 4096)
    throw new Error("Boundary is too complex.");
  const polygon = edges.map((e) => e.a),
    area = signedArea(polygon);
  if (Math.abs(area) < 100)
    throw new Error("Pattern area must be at least 100 square millimeters.");
  for (let i = 0; i < edges.length; i++)
    for (let j = i + 2; j < edges.length; j++) {
      if (i === 0 && j === edges.length - 1) continue;
      if (intersections(edges[i].a, edges[i].b, edges[j].a, edges[j].b))
        throw new Error(
          "Boundary crosses itself. Move the point back or undo.",
        );
    }
  const sign = area > 0 ? 1 : -1;
  const contours: Point2[][] = [polygon];
  const offset = edges.map((e) => {
    const dir = sub(e.b, e.a),
      len = distance(e.a, e.b),
      normal = {
        x: ((sign * dir.y) / len) * e.sa,
        y: ((-sign * dir.x) / len) * e.sa,
      };
    const a = add(e.a, normal),
      b = add(e.b, normal);
    if (e.sa > 0) contours.push([e.a, e.b, b, a]);
    return { a, b, dir };
  });
  for (let i = 0; i < edges.length; i++) {
    const prev = (i + edges.length - 1) % edges.length,
      a = offset[prev],
      b = offset[i],
      vertex = edges[i].a;
    // Convex exterior joins only. Concave strips overlap and union trims them.
    const det = cross(a.dir, b.dir);
    if (det * sign <= 1e-9) continue;
    const t = cross(sub(b.a, a.b), b.dir) / det,
      m = add(a.b, mul(a.dir, t));
    const max = Math.max(edges[prev].sa, edges[i].sa);
    contours.push(
      distance(m, vertex) <= max * 8 + 1e-6
        ? [vertex, a.b, m, b.a]
        : [vertex, a.b, b.a],
    );
  }
  const paths = contours
    .filter((p) => Math.abs(signedArea(p)) > 0.0001)
    .map((p) => {
      const q = p.map((v) => ({
        X: Math.round(v.x * 1000),
        Y: Math.round(v.y * 1000),
      }));
      if (Clipper.Clipper.Area(q) < 0) q.reverse();
      return q;
    });
  const c = new Clipper.Clipper(),
    solution: { X: number; Y: number }[][] = [];
  c.AddPaths(paths, Clipper.PolyType.ptSubject, true);
  c.Execute(
    Clipper.ClipType.ctUnion,
    solution,
    Clipper.PolyFillType.pftNonZero,
    Clipper.PolyFillType.pftNonZero,
  );
  if (solution.length !== 1)
    throw new Error("The seam allowance does not form one cutting boundary.");
  return [
    ...solution[0].map(
      (v, i) =>
        ({
          type: i ? "line" : "move",
          to: { x: v.X / 1000, y: v.Y / 1000 },
        }) as PatternOp,
    ),
    { type: "close" },
  ];
}
export function detachPiece(piece: PatternPiece, sa: number): Construction {
  const seam = structuredClone(piece.seam),
    samples = flatten(seam);
  const allowances = seam.map((op, i) => {
    if (i === 0) return 0;
    const a = segmentStart(seam, i),
      b = segmentPoint(seam, i, 1);
    if (
      piece.id !== "sleeve" &&
      piece.id !== "neckband" &&
      Math.abs(a.x - b.x) < 0.01 &&
      Math.abs(a.x) < 0.01
    )
      return 0;
    if (
      piece.id !== "neckband" &&
      op.type !== "curve" &&
      Math.abs(a.y - b.y) < 0.01 &&
      a.y > piece.height * 0.8
    )
      return sa * 3;
    return sa;
  });
  const notches = piece.notches.map((n) => {
    let best = { edge: 1, t: 0, double: n.double },
      gap = Infinity;
    samples.slice(1).forEach((p, i) => {
      const a = samples[i],
        d = sub(p.point, a.point),
        len = d.x * d.x + d.y * d.y;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((n.point.x - a.point.x) * d.x + (n.point.y - a.point.y) * d.y) / len,
        ),
      );
      const dist = distance(n.point, add(a.point, mul(d, t)));
      if (dist < gap) {
        gap = dist;
        best = {
          edge: p.edge,
          t: (a.edge === p.edge ? a.t : 0) * (1 - t) + p.t * t,
          double: n.double,
        };
      }
    });
    return best;
  });
  return {
    name: piece.name,
    cut: piece.cut,
    seam,
    allowances,
    notches,
    darts: [],
    guides: structuredClone(piece.guides),
    grain: structuredClone(piece.grain),
    label: { ...piece.label },
  };
}
export function constructPiece(
  id: PatternPiece["id"],
  input: Construction,
): PatternPiece {
  const c = ConstructionSchema.parse(input),
    cutline = allowanceOutline(c.seam, c.allowances);
  // Include editable construction marks in the print bounds so moving a dart
  // or grainline cannot silently clip it from the tiled export.
  const pts = [
    ...cutline.flatMap((o) => (o.type === "close" ? [] : [o.to])),
    ...c.darts.flat(),
    ...c.grain,
    c.label,
    ...c.guides.flatMap((ops) =>
      ops.flatMap((o) =>
        o.type === "close"
          ? []
          : o.type === "curve"
            ? [o.to, o.cp1, o.cp2]
            : [o.to],
      ),
    ),
  ];
  const origin = {
    x: Math.min(...pts.map((p) => p.x)),
    y: Math.min(...pts.map((p) => p.y)),
  };
  const width = Math.max(...pts.map((p) => p.x)) - origin.x,
    height = Math.max(...pts.map((p) => p.y)) - origin.y;
  if (width < 10 || height < 10 || width > 2500 || height > 2500)
    throw new Error("Piece dimensions must be between 10 and 2500 mm.");
  const p = (v: Point2) => sub(v, origin);
  const path = (ops: PatternOp[]): PatternOp[] =>
    ops.map((o) =>
      o.type === "close"
        ? o
        : o.type === "curve"
          ? { ...o, to: p(o.to), cp1: p(o.cp1), cp2: p(o.cp2) }
          : { ...o, to: p(o.to) },
    );
  return {
    id,
    name: c.name,
    cut: c.cut,
    allowances: c.allowances,
    width,
    height,
    seam: path(c.seam),
    cutline: path(cutline),
    guides: [
      ...c.guides.map(path),
      ...c.darts.map((d) =>
        path([
          { type: "move", to: d[0] },
          { type: "line", to: d[1] },
          { type: "line", to: d[2] },
        ]),
      ),
    ],
    notches: c.notches.map((n) => ({
      point: p(segmentPoint(c.seam, n.edge, n.t)),
      double: n.double,
    })),
    grain: [p(c.grain[0]), p(c.grain[1])],
    label: p(c.label),
    handles: [],
    origin,
    hemY: height,
    sleeveHalfWidth: 0,
  };
}
export function moveAnchor(
  c: Construction,
  index: number,
  target: Point2,
): Construction {
  const next = structuredClone(c),
    op = next.seam[index];
  if (op.type === "close") return next;
  const delta = sub(target, op.to);
  op.to = target;
  if (op.type === "curve") op.cp2 = add(op.cp2, delta);
  const after = next.seam[index + 1];
  if (after?.type === "curve") after.cp1 = add(after.cp1, delta);
  // Explicit closure anchors follow the starting node (and vice versa).
  const last = next.seam.at(-2)!;
  if (
    index === 0 &&
    last.type !== "close" &&
    distance(last.to, c.seam[0].type !== "close" ? c.seam[0].to : target) < 1e-6
  ) {
    last.to = { ...target };
    if (last.type === "curve") last.cp2 = add(last.cp2, delta);
  }
  return next;
}
export function splitSegment(c: Construction, index: number): Construction {
  const next = structuredClone(c),
    op = next.seam[index],
    a = segmentStart(next.seam, index),
    mid = segmentPoint(next.seam, index, 0.5);
  if (op.type === "curve") {
    const p = mul(add(a, op.cp1), 0.5),
      q = mul(add(op.cp1, op.cp2), 0.5),
      r = mul(add(op.cp2, op.to), 0.5),
      s = mul(add(p, q), 0.5),
      t = mul(add(q, r), 0.5);
    next.seam.splice(
      index,
      1,
      { type: "curve", cp1: p, cp2: s, to: mid },
      { type: "curve", cp1: t, cp2: r, to: op.to },
    );
  } else next.seam.splice(index, 0, { type: "line", to: mid });
  next.allowances.splice(index, 0, c.allowances[index]);
  next.notches = next.notches.map((n) =>
    n.edge < index
      ? n
      : n.edge > index
        ? { ...n, edge: n.edge + 1 }
        : n.t <= 0.5
          ? { ...n, t: n.t * 2 }
          : { ...n, edge: index + 1, t: (n.t - 0.5) * 2 },
  );
  return next;
}

export function removeAnchor(c: Construction, index: number): Construction {
  if (index <= 0 || index >= c.seam.length - 1 || c.seam.length <= 4)
    throw new Error("Keep at least three boundary anchors.");
  const next = structuredClone(c);
  next.seam.splice(index, 1);
  next.allowances.splice(index, 1);
  next.notches = next.notches
    .filter((n) => n.edge !== index)
    .map((n) => (n.edge > index ? { ...n, edge: n.edge - 1 } : n));
  return next;
}
