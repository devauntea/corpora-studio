import type { PatternOp, Point2 } from "./fashion-model";

/** Engine point identities survive redrafting. Anonymous segments are scoped to
 * the entire path's topology, so a changed topology cannot silently rebind them. */
export function engineEdgeIds(
  ops: PatternOp[],
  points: Record<string, Point2>,
) {
  const names = new Map<Point2, string>();
  Object.entries(points)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([k, v]) => {
      if (!names.has(v)) names.set(v, k);
    });
  const topology = ops
    .map((o) =>
      o.type === "close" ? "Z" : `${o.type}:${names.get(o.to) ?? "?"}`,
    )
    .join("|");
  let hash = 2166136261;
  for (const c of topology)
    hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  let start = "start",
    previous = "start";
  const used = new Map<string, number>();
  return ops.map((op, i) => {
    const to =
      op.type === "close"
        ? start
        : (names.get(op.to) ?? `anonymous-${hash.toString(16)}-${i}`);
    if (op.type === "move") start = to;
    const key = `${op.type}:${previous}>${to}`;
    previous = to;
    const count = used.get(key) ?? 0;
    used.set(key, count + 1);
    return `${key}${count ? `#${count}` : ""}`.slice(0, 240);
  });
}
export function fallbackEdgeIds(ops: PatternOp[]) {
  return ops.map(
    (o, i) => `boundary-${ops.map((o) => o.type[0]).join("")}-${i}-${o.type}`,
  );
}
