import Delaunator from "delaunator";
import { flatten } from "./pattern-geometry";
import type { PatternDraft, Point2 } from "./fashion-model";
import { ClothSchema, type ClothConfig, type ClothMesh } from "./cloth-model";
const dist = (a: Point2, b: Point2) => Math.hypot(a.x - b.x, a.y - b.y);
function inside(p: Point2, poly: Point2[]) {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      yes = !yes;
  }
  return yes;
}
export function panelOutline(
  piece: PatternDraft["pieces"][number],
  unfold: boolean,
) {
  let p = flatten(piece.seam, 0.3).map((v) => v.point);
  if (dist(p[0], p.at(-1)!) < 0.001) p.pop();
  if (unfold) {
    const min = Math.min(...p.map((p) => p.x)),
      max = Math.max(...p.map((p) => p.x));
    const left = p.filter((p) => Math.abs(p.x - min) < 0.2).length,
      right = p.filter((p) => Math.abs(p.x - max) < 0.2).length,
      fold = left >= right ? min : max;
    // Follow the non-fold arc, then its reflection. Both ends must lie on the fold line.
    const on = p
      .map((v, i) => (Math.abs(v.x - fold) < 0.2 ? i : -1))
      .filter((i) => i >= 0);
    if (on.length < 2)
      throw new Error(
        `${piece.name}: cannot identify a straight vertical fold. Disable unfold or edit the piece.`,
      );
    let best: Point2[] = [];
    for (let k = 0; k < on.length; k++) {
      const start = on[k],
        end = on[(k + 1) % on.length],
        arc: Point2[] = [];
      let i = start;
      do {
        arc.push(p[i]);
        i = (i + 1) % p.length;
      } while (i !== end && arc.length <= p.length);
      arc.push(p[end]);
      if (arc.length > best.length) best = arc;
    }
    p = [
      ...best,
      ...best
        .slice(1, -1)
        .reverse()
        .map((v) => ({ x: 2 * fold - v.x, y: v.y })),
    ];
  }
  return p;
}
export function clothMesh(draft: PatternDraft, raw: ClothConfig): ClothMesh {
  const config = ClothSchema.parse(raw),
    positions: number[] = [],
    rest: number[] = [],
    indices: number[] = [],
    pins: number[] = [],
    colors: number[] = [],
    panels: ClothMesh["panels"] = [],
    warnings: string[] = [];
  for (const panel of config.panels) {
    const piece = draft.pieces.find((p) => p.id === panel.pieceId);
    if (!piece)
      throw new Error(
        `Missing pattern piece ${panel.pieceId}. Rebuild the drape setup.`,
      );
    const outline = panelOutline(piece, panel.unfold),
      boundary: Point2[] = [],
      fractions: number[] = [];
    let total = 0;
    const lengths = outline.map((p, i) =>
      dist(p, outline[(i + 1) % outline.length]),
    );
    const perimeter = lengths.reduce((a, b) => a + b, 0);
    // Resample by global arc length, preserving sharp corners. Flattened Beziers
    // may contain sub-millimeter edges; retaining every one makes sewing unstable.
    const starts = lengths.map((length) => {
      const at = total;
      total += length;
      return at;
    });
    const corners = outline
      .map((p, i) => {
        const before = outline[(i + outline.length - 1) % outline.length],
          after = outline[(i + 1) % outline.length];
        const cosine =
          ((p.x - before.x) * (after.x - p.x) +
            (p.y - before.y) * (after.y - p.y)) /
          Math.max(1e-9, dist(before, p) * dist(p, after));
        return cosine < 0.9 ? starts[i] : -1;
      })
      .filter((v) => v >= 0);
    const count = Math.max(8, Math.ceil(perimeter / config.spacing)),
      samples = [...corners];
    for (let i = 0; i < count; i++) {
      const at = (i * perimeter) / count;
      if (
        corners.every(
          (c) =>
            Math.min(Math.abs(c - at), perimeter - Math.abs(c - at)) >
            config.spacing * 0.25,
        )
      )
        samples.push(at);
    }
    samples.sort((a, b) => a - b);
    for (const at of samples) {
      let edge = lengths.length - 1;
      while (edge > 0 && starts[edge] > at) edge--;
      const a = outline[edge],
        b = outline[(edge + 1) % outline.length],
        t = (at - starts[edge]) / Math.max(lengths[edge], 1e-9);
      boundary.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      fractions.push(at / perimeter);
    }
    const minX = Math.min(...outline.map((p) => p.x)),
      maxX = Math.max(...outline.map((p) => p.x)),
      minY = Math.min(...outline.map((p) => p.y)),
      maxY = Math.max(...outline.map((p) => p.y)),
      points = [...boundary];
    for (
      let row = 0, y = minY + config.spacing * 0.75;
      y < maxY;
      y += config.spacing * 0.866, row++
    )
      for (
        let x = minX + config.spacing * (row % 2 ? 0.75 : 0.25);
        x < maxX;
        x += config.spacing
      ) {
        const p = { x, y };
        if (
          inside(p, boundary) &&
          boundary.every((b) => dist(p, b) > config.spacing * 0.4)
        )
          points.push(p);
      }
    if (points.length + positions.length / 3 > 7000)
      throw new Error(
        "Cloth preview is limited to 7,000 vertices. Increase mesh spacing or use fewer panels.",
      );
    const start = positions.length / 3,
      tri = Delaunator.from(
        points,
        (p) => p.x,
        (p) => p.y,
      ).triangles,
      theta = (panel.yaw * Math.PI) / 180,
      roll = (panel.roll * Math.PI) / 180;
    for (let i = 0; i < tri.length; i += 3) {
      const ids = [tri[i], tri[i + 1], tri[i + 2]],
        pts = ids.map((i) => points[i]);
      const mid = {
        x: pts.reduce((s, p) => s + p.x, 0) / 3,
        y: pts.reduce((s, p) => s + p.y, 0) / 3,
      };
      if (!inside(mid, boundary)) continue;
      // Reject diagonals through a concavity; neighboring boundary edges remain exact.
      if (
        ids.some((a, k) => {
          const b = ids[(k + 1) % 3];
          if (
            a < boundary.length &&
            b < boundary.length &&
            (Math.abs(a - b) === 1 || Math.abs(a - b) === boundary.length - 1)
          )
            return false;
          return ![0.25, 0.5, 0.75].every((t) =>
            inside(
              {
                x: points[a].x + (points[b].x - points[a].x) * t,
                y: points[a].y + (points[b].y - points[a].y) * t,
              },
              boundary,
            ),
          );
        })
      )
        continue;
      indices.push(...ids.map((i) => i + start));
    }
    for (const p of points) {
      let x = (p.x - (minX + maxX) / 2) * (panel.mirror ? -1 : 1),
        y = (minY + maxY) / 2 - p.y;
      const xx = x * Math.cos(roll) - y * Math.sin(roll),
        yy = x * Math.sin(roll) + y * Math.cos(roll);
      x = xx;
      y = yy;
      const pitch = ((panel.pitch ?? 0) * Math.PI) / 180,
        yp = y * Math.cos(pitch),
        zp = y * Math.sin(pitch);
      positions.push(
        panel.x + x * Math.cos(theta) + zp * Math.sin(theta),
        panel.y + yp,
        panel.z - x * Math.sin(theta) + zp * Math.cos(theta),
      );
      rest.push(p.x, p.y, 0);
      pins.push(panel.pinTop && p.y < minY + config.spacing * 0.6 ? 1 : 0);
      const c = panels.length % 3;
      colors.push(
        c === 0 ? 0.75 : 0.55,
        c === 1 ? 0.7 : 0.58,
        c === 2 ? 0.7 : 0.5,
      );
    }
    panels.push({
      id: panel.id,
      start,
      count: points.length,
      boundary: boundary.map((_, i) => start + i),
      fractions,
    });
  }
  const stitches: number[] = [];
  for (const s of config.stitches) {
    const a = panels.find((p) => p.id === s.a.panel)!,
      b = panels.find((p) => p.id === s.b.panel)!;
    const closest = (p: typeof a, t: number) => {
      let best = Infinity,
        id = p.boundary[0];
      p.fractions.forEach((f, i) => {
        const d = Math.abs(f - t);
        if (d < best) {
          best = d;
          id = p.boundary[i];
        }
      });
      return id;
    };
    const selected = (p: typeof a, r: typeof s.a) =>
      p.fractions.filter(
        (f) =>
          f >= Math.min(r.from, r.to) - 1e-8 &&
          f <= Math.max(r.from, r.to) + 1e-8,
      ).length;
    const count = Math.max(1, Math.min(selected(a, s.a), selected(b, s.b)) - 1);
    const usedA = new Set<number>(),
      usedB = new Set<number>();
    for (let i = 0; i <= count; i++) {
      const t = i / count,
        ai = closest(a, s.a.from + (s.a.to - s.a.from) * t),
        bi = closest(
          b,
          s.b.from + (s.b.to - s.b.from) * (s.reverse ? 1 - t : t),
        );
      if (!usedA.has(ai) && !usedB.has(bi)) {
        usedA.add(ai);
        usedB.add(bi);
        stitches.push(ai, bi);
      }
    }
  }
  if (!indices.length) throw new Error("Add at least one nonempty panel.");
  if (!stitches.length && panels.length > 1)
    warnings.push(
      "Panels are not stitched together. Add stitch pairs or use a prepared assembly.",
    );
  return {
    positions: new Float32Array(positions),
    rest: new Float32Array(rest),
    indices: new Uint32Array(indices),
    pins: new Uint8Array(pins),
    stitches: new Uint32Array(stitches),
    colors: new Float32Array(colors),
    panels,
    warnings,
  };
}
