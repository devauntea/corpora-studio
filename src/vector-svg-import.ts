import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import {
  Color,
  SRGBColorSpace,
  type Curve,
  type Vector2,
  CubicBezierCurve,
  QuadraticBezierCurve,
  LineCurve,
  EllipseCurve,
} from "three";
import {
  type VectorLayer,
  type VectorNode,
  type VectorPack,
  type VectorView,
  mapLayer,
  VectorPackSchema,
  newVectorPack,
} from "./vector-pack";
import { selectionBounds, groupSelection } from "./vector-selection";

export type SvgImport = {
  layers: VectorLayer[];
  source: VectorPack["sources"][number];
  warnings: string[];
};
const tags = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "line",
  "polyline",
  "polygon",
  "circle",
  "ellipse",
  "title",
  "desc",
]);
const attrs = new Set([
  "xmlns",
  "version",
  "id",
  "viewBox",
  "width",
  "height",
  "x",
  "y",
  "d",
  "points",
  "rx",
  "ry",
  "cx",
  "cy",
  "r",
  "x1",
  "x2",
  "y1",
  "y2",
  "transform",
  "fill",
  "stroke",
  "stroke-width",
  "fill-rule",
  "stroke-linecap",
  "stroke-linejoin",
  "style",
]);
const styles = new Set([
  "fill",
  "stroke",
  "stroke-width",
  "fill-rule",
  "stroke-linecap",
  "stroke-linejoin",
]);
const point = (p: { x: number; y: number }) => ({ x: p.x, y: p.y });
function nodesFor(curves: Curve<Vector2>[], closed: boolean) {
  const nodes: VectorNode[] = [];
  for (const curve of curves) {
    if (!nodes.length) nodes.push(point(curve.getPoint(0)));
    const previous = nodes.at(-1)!;
    const end: VectorNode = point(curve.getPoint(1));
    if (curve instanceof CubicBezierCurve) {
      previous.out = point(curve.v1);
      end.in = point(curve.v2);
    } else if (curve instanceof QuadraticBezierCurve) {
      previous.out = {
        x: previous.x + ((curve.v1.x - previous.x) * 2) / 3,
        y: previous.y + ((curve.v1.y - previous.y) * 2) / 3,
      };
      end.in = {
        x: end.x + ((curve.v1.x - end.x) * 2) / 3,
        y: end.y + ((curve.v1.y - end.y) * 2) / 3,
      };
    } else if (curve instanceof EllipseCurve) {
      // Bounded flattening is disclosed in the preview. Ordinary Beziers remain exact.
      const count = 96;
      for (let i = 1; i <= count; i++)
        nodes.push(point(curve.getPoint(i / count)));
      continue;
    } else if (!(curve instanceof LineCurve))
      throw new Error("Unsupported curve. Convert it to cubic paths first.");
    nodes.push(end);
  }
  if (
    closed &&
    nodes.length > 2 &&
    Math.hypot(nodes[0].x - nodes.at(-1)!.x, nodes[0].y - nodes.at(-1)!.y) <
      1e-7
  ) {
    const last = nodes.pop()!;
    if (last.in) nodes[0].in = last.in;
  }
  return nodes;
}
const numericToken = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
function validatePath(data: string) {
  const tokens =
    data.match(/[a-df-zA-DF-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ??
    [];
  if (
    data.replace(
      /[a-df-zA-DF-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?|[\s,]+/g,
      "",
    )
  )
    throw new Error("Invalid SVG path syntax.");
  const arity: Record<string, number> = {
    M: 2,
    L: 2,
    H: 1,
    V: 1,
    C: 6,
    S: 4,
    Q: 4,
    T: 2,
    A: 7,
    Z: 0,
  };
  if (tokens.length && tokens[0]!.toUpperCase() !== "M")
    throw new Error("SVG paths must start with a move command.");
  let i = 0;
  while (i < tokens.length) {
    const command = tokens[i++].toUpperCase(),
      count = arity[command];
    if (count === undefined)
      throw new Error(`Unsupported SVG path command: ${command}.`);
    const values: number[] = [];
    while (i < tokens.length && !/^[a-z]$/i.test(tokens[i]))
      values.push(Number(tokens[i++]));
    if (
      values.some((n) => !Number.isFinite(n) || Math.abs(n) > 1e7) ||
      (count === 0
        ? values.length !== 0
        : !values.length || values.length % count !== 0)
    )
      throw new Error("Invalid SVG path coordinates.");
    if (command === "A")
      for (let j = 0; j < values.length; j += 7)
        if (
          values[j] < 0 ||
          values[j + 1] < 0 ||
          ![0, 1].includes(values[j + 3]) ||
          ![0, 1].includes(values[j + 4])
        )
          throw new Error("Invalid SVG arc parameters.");
  }
}
function validateTransform(data: string) {
  const matches = [...data.matchAll(/([a-z]+)\s*\(([^)]*)\)/gi)];
  if (data.replace(/([a-z]+)\s*\(([^)]*)\)/gi, "").replace(/[\s,]/g, ""))
    throw new Error("Invalid SVG transform.");
  const arity: Record<string, number[]> = {
    matrix: [6],
    translate: [1, 2],
    scale: [1, 2],
    rotate: [1, 3],
    skewX: [1],
    skewY: [1],
  };
  for (const match of matches) {
    const values = match[2].match(numericToken)?.map(Number) ?? [];
    if (
      !arity[match[1]]?.includes(values.length) ||
      values.some((n) => !Number.isFinite(n) || Math.abs(n) > 1e7) ||
      match[2].replace(numericToken, "").replace(/[\s,]/g, "")
    )
      throw new Error("Unsupported or invalid SVG transform.");
  }
}
/** Parse only inert, bounded SVG drawing data. Never insert the original markup into the DOM. */
export async function importSvg(
  original: string,
  name: string,
  view: VectorView,
): Promise<SvgImport> {
  if (new TextEncoder().encode(original).length > 500000)
    throw new Error("SVG limit is 500 KB. Simplify or split the drawing.");
  if (
    /<!DOCTYPE|<!ENTITY|<\?/i.test(original.replace(/^\s*<\?xml[^?]*\?>/, ""))
  )
    throw new Error(
      "SVG entities, processing instructions and document types are not supported.",
    );
  const xml = new DOMParser().parseFromString(original, "image/svg+xml");
  if (
    xml.querySelector("parsererror") ||
    xml.documentElement.localName !== "svg"
  )
    throw new Error("This is not a valid SVG document.");
  const root = xml.documentElement,
    elements = [root, ...root.querySelectorAll("*")];
  if (elements.length > 1000) throw new Error("SVG limit is 1,000 elements.");
  let numbers = 0;
  for (const element of elements) {
    if (
      !tags.has(element.localName) ||
      element.namespaceURI !== "http://www.w3.org/2000/svg" ||
      (element.localName === "svg" && element !== root)
    )
      throw new Error(
        `Unsupported SVG element: ${element.localName}. Use paths with solid fills and strokes; outline text and expand effects first.`,
      );
    let depth = 0;
    for (
      let parent = element.parentElement;
      parent;
      parent = parent.parentElement
    )
      depth++;
    if (depth > 24) throw new Error("SVG nesting exceeds 24 groups.");
    for (const attribute of element.attributes) {
      if (!attrs.has(attribute.name))
        throw new Error(
          `Unsupported SVG attribute: ${attribute.name}. Remove effects, links and CSS classes first.`,
        );
      if (/url\s*\(|var\s*\(/i.test(attribute.value))
        throw new Error(
          "SVG references, gradients and external resources are not supported.",
        );
      if (attribute.name === "d") validatePath(attribute.value);
      if (attribute.name === "transform") validateTransform(attribute.value);
      if (attribute.name === "points") {
        const values = attribute.value.match(numericToken)?.map(Number) ?? [];
        if (
          values.length % 2 ||
          values.some((n) => !Number.isFinite(n)) ||
          attribute.value.replace(numericToken, "").replace(/[\s,]/g, "")
        )
          throw new Error("Invalid SVG polygon points.");
      }
      if (attribute.name === "style")
        for (const declaration of attribute.value
          .split(";")
          .filter((s) => s.trim())) {
          const [key, value, extra] = declaration.split(":");
          if (!styles.has(key.trim()) || !value || extra)
            throw new Error(`Unsupported SVG style: ${key.trim()}.`);
          element.setAttribute(key.trim(), value.trim());
        }
      if (["d", "points", "transform"].includes(attribute.name))
        numbers += (
          attribute.value.match(/[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi) ?? []
        ).length;
    }
    // Three accepts broader CSS than the editor. Require explicit portable colors and finite widths.
    for (const property of ["fill", "stroke"]) {
      const value = element.getAttribute(property);
      if (
        value &&
        !/^(?:none|#[\da-f]{3}|#[\da-f]{6}|black|white)$/i.test(value.trim())
      )
        throw new Error(
          `Use hex colors for ${property}; “${value.slice(0, 40)}” is not supported.`,
        );
    }
    const width = element.getAttribute("stroke-width");
    if (width && !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(width))
      throw new Error("Stroke widths must be nonnegative SVG user units.");
    for (const [property, allowed] of [
      ["fill-rule", ["evenodd", "nonzero"]],
      ["stroke-linecap", ["butt", "round", "square"]],
      ["stroke-linejoin", ["miter", "round", "bevel"]],
    ] as const) {
      const value = element.getAttribute(property);
      if (value && !(allowed as readonly string[]).includes(value))
        throw new Error(`Unsupported ${property}: ${value}`);
    }
    element.removeAttribute("style");
  }
  if (numbers > 24000)
    throw new Error("SVG coordinate budget exceeded. Simplify the paths.");
  const rawViewBox = root.getAttribute("viewBox") ?? "";
  if (rawViewBox) {
    const box = rawViewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (
      box.length !== 4 ||
      box.some((n) => !Number.isFinite(n)) ||
      box[2] <= 0 ||
      box[3] <= 0
    )
      throw new Error(
        "SVG viewBox must have four finite numbers and a positive size.",
      );
  }
  // Fit the drawing bounds (not the source page) explicitly; no implied cutting scale.
  const parsed = new SVGLoader().parse(
    new XMLSerializer().serializeToString(root),
  );
  if (parsed.paths.length > 200)
    throw new Error("SVG limit is 200 painted paths.");
  const warnings = [
    "Fitted to the artboard using drawing bounds. This is a technical flat, not a scale cutting pattern.",
  ];
  let curvedArcs = false;
  let layers: VectorLayer[] = parsed.paths.flatMap((path, index) => {
    const style = path.userData?.style ?? {};
    if (style.fill === "none" && (!style.stroke || style.stroke === "none"))
      return [];
    const contours = path.subPaths
      .filter((p) => p.curves.length)
      .map((p) => {
        if (p.curves.some((c) => c instanceof EllipseCurve)) curvedArcs = true;
        return { nodes: nodesFor(p.curves, p.autoClose), closed: p.autoClose };
      });
    if (!contours.length) return [];
    if (contours.some((c) => c.closed !== contours[0].closed))
      throw new Error(
        "Mixed open and closed contours in one path are unsupported. Separate them before import.",
      );
    const transform = path.userData?.transform?.elements as
      | number[]
      | undefined;
    if (style.stroke && style.stroke !== "none" && transform) {
      const sx = Math.hypot(transform[0], transform[1]),
        sy = Math.hypot(transform[3], transform[4]);
      if (
        Math.abs(sx - sy) > 1e-6 ||
        Math.abs(transform[0] * transform[3] + transform[1] * transform[4]) >
          1e-6
      )
        throw new Error(
          "Non-uniform transformed strokes must be outlined before import.",
        );
    }
    const hex = (v: string) =>
      "#" +
      new Color().setStyle(v, SRGBColorSpace).getHexString(SRGBColorSpace);
    return [
      {
        id: crypto.randomUUID(),
        name: (
          path.userData?.node?.id ||
          `${name.replace(/\.svg$/i, "")} ${index + 1}`
        ).slice(0, 80),
        view,
        nodes: contours[0].nodes,
        contours:
          contours.length > 1
            ? contours.slice(1).map((c) => c.nodes)
            : undefined,
        closed: contours[0].closed,
        fill: style.fill === "none" ? "none" : hex(style.fill || "#000000"),
        stroke: hex(
          style.stroke && style.stroke !== "none" ? style.stroke : "#000000",
        ),
        strokeWidth:
          style.stroke && style.stroke !== "none"
            ? (style.strokeWidth ?? 1)
            : 0,
        dashed: false,
        visible: true,
        locked: false,
        material: "",
        fillRule: style.fillRule ?? "nonzero",
        lineCap: style.strokeLineCap ?? "butt",
        lineJoin: style.strokeLineJoin ?? "miter",
      },
    ];
  });
  if (!layers.length)
    throw new Error("SVG contains no visible supported paths.");
  const count = layers.reduce(
    (n, l) =>
      n + l.nodes.length + (l.contours ?? []).reduce((n, c) => n + c.length, 0),
    0,
  );
  if (
    count > 12000 ||
    layers.some((l) =>
      [l.nodes, ...(l.contours ?? [])].some((c) => c.length > 2000),
    )
  )
    throw new Error("SVG exceeds 12,000 anchors or 2,000 anchors per contour.");
  const bounds = selectionBounds(layers)!;
  if (
    ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) ||
    Math.max(bounds.width, bounds.height) <= 0
  )
    throw new Error("SVG has invalid or empty drawing bounds.");
  const scale = Math.min(
    420 / Math.max(bounds.width, 1),
    510 / Math.max(bounds.height, 1),
  );
  layers = layers.map((l) => ({
    ...mapLayer(l, (p) => ({
      x: 30 + (420 - bounds.width * scale) / 2 + (p.x - bounds.x) * scale,
      y: 65 + (510 - bounds.height * scale) / 2 + (p.y - bounds.y) * scale,
    })),
    strokeWidth: l.strokeWidth * scale,
  }));
  if (curvedArcs)
    warnings.push(
      "Elliptical arcs were converted to 96 straight segments per arc. Cubic and quadratic curves retain editable handles.",
    );
  if (layers.some((l) => l.strokeWidth > 12))
    throw new Error(
      "A fitted stroke exceeds 12 artboard units. Outline thick strokes before import.",
    );
  VectorPackSchema.parse({ ...newVectorPack(), layers });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(original),
  );
  const source = {
    id: crypto.randomUUID(),
    name: name.slice(0, 180),
    original,
    width: (root.getAttribute("width") ?? "unspecified").slice(0, 80),
    height: (root.getAttribute("height") ?? "unspecified").slice(0, 80),
    viewBox: rawViewBox.slice(0, 200),
    sha256: Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join(""),
    conversion: warnings.join(" ").slice(0, 400),
  };
  return { layers, source, warnings };
}
export function placeSvg(pack: VectorPack, incoming: SvgImport): VectorPack {
  let next = {
    ...pack,
    layers: [...pack.layers, ...incoming.layers],
    sources: [...pack.sources, incoming.source],
  };
  if (incoming.layers.length > 1)
    next = groupSelection(
      next,
      incoming.layers.map((l) => l.id),
      incoming.source.name.slice(0, 80),
    );
  return VectorPackSchema.parse(next);
}
