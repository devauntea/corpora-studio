import type { Construction } from "./fashion-construction";
import type { Fashion, Point2 } from "./fashion-model";
/** Bounded arithmetic parser. No eval, functions, property traversal, or JavaScript execution. */
export function evaluateFormula(
  expression: string,
  resolve: (key: string) => number,
) {
  if (expression.length > 200)
    throw new Error("Formulas are limited to 200 characters.");
  const tokens =
    expression.match(
      /(?:\d+(?:\.\d*)?|\.\d+)|[a-zA-Z][a-zA-Z0-9]*(?:\.(?:x|y))?|[()+\-*/]/g,
    ) ?? [];
  if (tokens.join("") !== expression.replace(/\s+/g, "") || tokens.length > 100)
    throw new Error(
      "Use numbers, measurement names, point coordinates, + − * / and parentheses.",
    );
  let cursor = 0,
    depth = 0;
  const sum = (): number => {
    let v = product();
    while (tokens[cursor] === "+" || tokens[cursor] === "-") {
      const op = tokens[cursor++],
        b = product();
      v = op === "+" ? v + b : v - b;
    }
    return v;
  };
  const product = (): number => {
    let v = atom();
    while (tokens[cursor] === "*" || tokens[cursor] === "/") {
      const op = tokens[cursor++],
        b = atom();
      if (op === "/" && Math.abs(b) < 1e-9)
        throw new Error("Division by zero in formula.");
      v = op === "*" ? v * b : v / b;
    }
    return v;
  };
  const atom = (): number => {
    if (++depth > 30) throw new Error("Formula nesting is too deep.");
    const token = tokens[cursor++];
    let value: number;
    if (token === "(") {
      value = sum();
      if (tokens[cursor++] !== ")")
        throw new Error("Missing closing parenthesis.");
    } else if (token === "+" || token === "-")
      value = (token === "-" ? -1 : 1) * atom();
    else if (token && /^\d|^\./.test(token)) value = Number(token);
    else if (token && /^[a-z]/i.test(token)) value = resolve(token);
    else throw new Error("Incomplete formula.");
    depth--;
    if (!Number.isFinite(value) || Math.abs(value) > 100000)
      throw new Error("Formula result is not finite or exceeds limits.");
    return value;
  };
  const value = sum();
  if (cursor !== tokens.length) throw new Error("Unexpected formula token.");
  return value;
}
export function resolveConstruction(
  c: Construction,
  measurements: Fashion["measurements"],
): Construction {
  if (!c.formulas?.length) return c;
  const result = structuredClone(c),
    cache = new Map<string, number>(),
    visiting = new Set<string>();
  const key = (edge: number, point: string, axis: string) =>
    `${edge}:${point}:${axis}`;
  const read = (
    edge: number,
    slot: "to" | "cp1" | "cp2",
    axis: "x" | "y",
  ): number => {
    const k = key(edge, slot, axis);
    if (cache.has(k)) return cache.get(k)!;
    if (visiting.has(k)) throw new Error("Circular point formula.");
    const op = result.seam[edge];
    if (!op || op.type === "close" || (slot !== "to" && op.type !== "curve"))
      throw new Error("Formula references a missing point.");
    const formula = c.formulas!.find((f) => key(f.edge, f.point, f.axis) === k);
    visiting.add(k);
    const value = formula
      ? evaluateFormula(formula.expression, (name) => {
          const ref = /^p(\d+)\.(x|y)$/.exec(name);
          if (ref) return read(Number(ref[1]), "to", ref[2] as "x" | "y");
          const v = measurements[name as keyof typeof measurements];
          if (v === undefined) throw new Error(`Unknown measurement: ${name}`);
          return v;
        })
      : (op as unknown as Record<string, Point2>)[slot][axis];
    if (Math.abs(value) > 2500)
      throw new Error("Point coordinates must stay within ±2500 mm.");
    (op as unknown as Record<string, Point2>)[slot][axis] = value;
    visiting.delete(k);
    cache.set(k, value);
    return value;
  };
  for (const f of c.formulas) read(f.edge, f.point, f.axis);
  return result;
}
