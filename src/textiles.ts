import { z } from "zod";

export const textilePatternIds = [
  "plain",
  "stripes",
  "pinstripe",
  "checked",
  "gingham",
  "plaid",
  "argyle",
  "dots",
  "floral",
  "paisley",
  "camo",
  "leopard",
  "zebra",
  "tiger",
  "herringbone",
  "tie-dye",
] as const;
export type TextilePatternId = (typeof textilePatternIds)[number];
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const TextileSchema = z
  .object({
    pattern: z.enum(textilePatternIds),
    colors: z.tuple([hex, hex, hex, hex]),
    scale: z.number().finite().min(12).max(160),
    rotation: z.number().finite().min(-180).max(180),
  })
  .strict();
export type Textile = z.infer<typeof TextileSchema>;
export type TextileMark = {
  fill: string;
  opacity?: number;
  path: { op: "m" | "l" | "c" | "h"; c: number[] }[];
};
type Colors = Textile["colors"];
export const textilePresets: {
  id: TextilePatternId;
  name: string;
  family: string;
  colors: Colors;
}[] = [
  {
    id: "plain",
    name: "Plain",
    family: "Solid",
    colors: ["#d9cbb6", "#403e3a", "#b08c70", "#f7f2e8"],
  },
  {
    id: "stripes",
    name: "Striped",
    family: "Geometric",
    colors: ["#f6f0e3", "#22495d", "#ac583c", "#d5a462"],
  },
  {
    id: "pinstripe",
    name: "Pinstripe",
    family: "Geometric",
    colors: ["#263238", "#d5d7ce", "#87989c", "#eee8db"],
  },
  {
    id: "checked",
    name: "Checked",
    family: "Geometric",
    colors: ["#eee6d8", "#58624c", "#9fa986", "#d4c5a6"],
  },
  {
    id: "gingham",
    name: "Gingham",
    family: "Geometric",
    colors: ["#fbf5e9", "#8b323f", "#dc9293", "#bf606d"],
  },
  {
    id: "plaid",
    name: "Plaid",
    family: "Geometric",
    colors: ["#234742", "#162e3d", "#ceac72", "#e6ddc7"],
  },
  {
    id: "argyle",
    name: "Argyle",
    family: "Geometric",
    colors: ["#eee4d2", "#733c49", "#405368", "#c59d62"],
  },
  {
    id: "dots",
    name: "Polka dot",
    family: "Geometric",
    colors: ["#6c3941", "#f7eede", "#dcaa93", "#a76b67"],
  },
  {
    id: "floral",
    name: "Floral",
    family: "Botanical",
    colors: ["#f7efdf", "#bf6556", "#617e62", "#dda266"],
  },
  {
    id: "paisley",
    name: "Paisley",
    family: "Botanical",
    colors: ["#192f3a", "#c29769", "#e2c9a1", "#637e7a"],
  },
  {
    id: "camo",
    name: "Camouflage",
    family: "Organic",
    colors: ["#a59e76", "#667149", "#3e4c37", "#30372d"],
  },
  {
    id: "leopard",
    name: "Leopard",
    family: "Animal",
    colors: ["#d2ab71", "#302824", "#8d5d35", "#b98047"],
  },
  {
    id: "zebra",
    name: "Zebra",
    family: "Animal",
    colors: ["#eee9de", "#282a27", "#8d9184", "#c0bba9"],
  },
  {
    id: "tiger",
    name: "Tiger",
    family: "Animal",
    colors: ["#c7833e", "#302b27", "#ecd4a1", "#a7552c"],
  },
  {
    id: "herringbone",
    name: "Herringbone",
    family: "Geometric",
    colors: ["#d1c5b1", "#5a6053", "#b0aa94", "#efe7d8"],
  },
  {
    id: "tie-dye",
    name: "Tie-dye",
    family: "Organic",
    colors: ["#f0ebd8", "#5c9c9d", "#86749d", "#d3b677"],
  },
];
export const colorPalettes: { name: string; colors: Colors }[] = [
  { name: "Ink & paper", colors: ["#f2eee4", "#262b2b", "#83877f", "#cbc9bc"] },
  { name: "Indigo", colors: ["#e8e8df", "#233e61", "#4d7293", "#a5bac4"] },
  { name: "Clay", colors: ["#f1e4d2", "#9f5140", "#ce9771", "#5b7162"] },
  { name: "Forest", colors: ["#e4e0c9", "#354d3c", "#809267", "#b2b487"] },
  { name: "Rose", colors: ["#f7e7dc", "#8b425c", "#cf8793", "#baab85"] },
  { name: "Cobalt", colors: ["#f8f3e5", "#2455a5", "#eaa24b", "#8eabd2"] },
  { name: "Golden hour", colors: ["#f7edcd", "#b87532", "#dfae5a", "#6f543e"] },
  {
    name: "Night garden",
    colors: ["#212d37", "#a67b9b", "#608e82", "#d9b47f"],
  },
  { name: "Sorbet", colors: ["#fff0d4", "#db8291", "#88bbb2", "#b0a0d0"] },
  { name: "Signal", colors: ["#f3eee4", "#d2493c", "#21536a", "#e1b23f"] },
];
export function defaultTextile(pattern: TextilePatternId = "plain"): Textile {
  const preset = textilePresets.find((p) => p.id === pattern)!;
  return {
    pattern,
    colors: [...preset.colors],
    scale: pattern === "paisley" || pattern === "floral" ? 72 : 48,
    rotation: 0,
  };
}
const round = (n: number) => Math.round(n * 1000) / 1000;
const rect = (
  x: number,
  y: number,
  w: number,
  h: number,
): TextileMark["path"] => [
  { op: "m", c: [x, y] },
  { op: "l", c: [x + w, y] },
  { op: "l", c: [x + w, y + h] },
  { op: "l", c: [x, y + h] },
  { op: "h", c: [] },
];
const polygon = (points: number[][]): TextileMark["path"] => [
  ...points.map((c, i) => ({ op: (i ? "l" : "m") as "l" | "m", c })),
  { op: "h", c: [] },
];
const ellipse = (
  x: number,
  y: number,
  rx: number,
  ry = rx,
): TextileMark["path"] => {
  const k = 0.55228475;
  return [
    { op: "m", c: [x + rx, y] },
    { op: "c", c: [x + rx, y + ry * k, x + rx * k, y + ry, x, y + ry] },
    { op: "c", c: [x - rx * k, y + ry, x - rx, y + ry * k, x - rx, y] },
    { op: "c", c: [x - rx, y - ry * k, x - rx * k, y - ry, x, y - ry] },
    { op: "c", c: [x + rx * k, y - ry, x + rx, y - ry * k, x + rx, y] },
    { op: "h", c: [] },
  ];
};
function transform(
  path: TextileMark["path"],
  x: number,
  y: number,
  angle = 0,
  sx = 1,
  sy = sx,
) {
  const a = (angle * Math.PI) / 180,
    cos = Math.cos(a),
    sin = Math.sin(a);
  return path.map((p) => ({
    op: p.op,
    c: p.c.map((_, i, c) =>
      i % 2 === 0
        ? x + c[i] * sx * cos - c[i + 1] * sy * sin
        : y + c[i - 1] * sx * sin + c[i] * sy * cos,
    ),
  }));
}
// Closed Catmull–Rom splines create smooth original organic marks without external artwork.
function blob(
  x: number,
  y: number,
  radius: number,
  seed: number,
  points = 12,
  soft = false,
): TextileMark["path"] {
  const ring = Array.from({ length: points }, (_, i) => {
    const a = (i / points) * Math.PI * 2;
    const r =
      radius *
      (soft
        ? 0.94 +
          0.055 * Math.sin(a * 3 + seed) +
          0.045 * Math.cos(a * 5 + seed * 1.2) +
          0.012 * Math.sin(a * 11)
        : 0.8 +
          0.17 * Math.sin(i * 2.31 + seed) +
          0.14 * Math.cos(i * 1.17 + seed * 2));
    return [x + Math.cos(a) * r, y + Math.sin(a) * r];
  });
  const path: TextileMark["path"] = [{ op: "m", c: ring[0] }];
  for (let i = 0; i < points; i++) {
    const p0 = ring[(i - 1 + points) % points],
      p1 = ring[i],
      p2 = ring[(i + 1) % points],
      p3 = ring[(i + 2) % points];
    path.push({
      op: "c",
      c: [
        p1[0] + (p2[0] - p0[0]) / 6,
        p1[1] + (p2[1] - p0[1]) / 6,
        p2[0] - (p3[0] - p1[0]) / 6,
        p2[1] - (p3[1] - p1[1]) / 6,
        ...p2,
      ],
    });
  }
  path.push({ op: "h", c: [] });
  return path;
}
const leaf: TextileMark["path"] = [
  { op: "m", c: [0, 0] },
  { op: "c", c: [-10, -4, -8, -14, 0, -20] },
  { op: "c", c: [8, -14, 10, -4, 0, 0] },
  { op: "h", c: [] },
];
const paisley: TextileMark["path"] = [
  { op: "m", c: [0, -30] },
  { op: "c", c: [22, -14, 21, 11, 4, 20] },
  { op: "c", c: [-16, 30, -30, 8, -20, -4] },
  { op: "c", c: [-12, -15, 1, -5, 4, -12] },
  { op: "c", c: [7, -18, 2, -25, 0, -30] },
  { op: "h", c: [] },
];

/** A 100-unit repeat. Consumers must clip each tile to [0,100] before repeating. */
export function textileTile(input: Textile): {
  size: number;
  marks: TextileMark[];
} {
  const s = TextileSchema.parse(input),
    [base, ink, accent, detail] = s.colors;
  const marks: TextileMark[] = [];
  const add = (fill: string, path: TextileMark["path"], opacity?: number) =>
    marks.push({ fill, path, ...(opacity === undefined ? {} : { opacity }) });
  const wrapped = (
    fill: string,
    path: TextileMark["path"],
    opacity?: number,
  ) => {
    const coords = path.flatMap((p) => p.c),
      xs = coords.filter((_, i) => i % 2 === 0),
      ys = coords.filter((_, i) => i % 2 !== 0);
    for (const dx of [-100, 0, 100])
      for (const dy of [-100, 0, 100]) {
        if (
          Math.max(...xs) + dx < 0 ||
          Math.min(...xs) + dx > 100 ||
          Math.max(...ys) + dy < 0 ||
          Math.min(...ys) + dy > 100
        )
          continue;
        add(fill, transform(path, dx, dy), opacity);
      }
  };
  add(base, rect(0, 0, 100, 100));
  switch (s.pattern) {
    case "plain":
      break;
    case "stripes":
      [0, 50].forEach((x) => {
        add(ink, rect(x, 0, 18, 100));
        add(accent, rect(x + 23, 0, 5, 100));
      });
      break;
    case "pinstripe":
      [0, 25, 50, 75].forEach((x) => {
        add(ink, rect(x + 6, 0, 0.9, 100));
        add(accent, rect(x + 8.5, 0, 0.4, 100));
      });
      break;
    case "checked":
      add(ink, rect(0, 0, 50, 50));
      add(ink, rect(50, 50, 50, 50));
      break;
    case "gingham":
      add(accent, rect(0, 0, 50, 100));
      add(accent, rect(0, 0, 100, 50));
      add(ink, rect(0, 0, 50, 50));
      break;
    case "plaid":
      add(ink, rect(20, 0, 25, 100));
      add(ink, rect(0, 20, 100, 25));
      add(accent, rect(68, 0, 7, 100));
      add(accent, rect(0, 68, 100, 7));
      for (const p of [14, 48, 80, 85]) {
        add(detail, rect(p, 0, 1.3, 100));
        add(detail, rect(0, p, 100, 1.3));
      }
      for (let i = 0; i < 9; i++)
        add(
          base,
          polygon([
            [20, 20 + i * 3],
            [20, 21.2 + i * 3],
            [45, 21.2 + i * 3],
            [45, 20 + i * 3],
          ]),
          0.13,
        );
      break;
    case "argyle":
      wrapped(
        ink,
        polygon([
          [25, -25],
          [50, 0],
          [25, 25],
          [0, 0],
        ]),
      );
      wrapped(
        ink,
        polygon([
          [75, 25],
          [100, 50],
          [75, 75],
          [50, 50],
        ]),
      );
      wrapped(
        accent,
        polygon([
          [25, 25],
          [50, 50],
          [25, 75],
          [0, 50],
        ]),
      );
      wrapped(
        accent,
        polygon([
          [75, 75],
          [100, 100],
          [75, 125],
          [50, 100],
        ]),
      );
      for (let i = -10; i <= 20; i++) {
        const t = i * 5;
        for (const offset of [0, 50]) {
          wrapped(
            detail,
            polygon([
              [t, t + offset],
              [t + 2.4, t + offset + 2.4],
              [t + 3, t + offset + 1.8],
              [t + 0.6, t + offset - 0.6],
            ]),
          );
          wrapped(
            detail,
            polygon([
              [t, 100 - t + offset],
              [t + 2.4, 97.6 - t + offset],
              [t + 3, 98.2 - t + offset],
              [t + 0.6, 100.6 - t + offset],
            ]),
          );
        }
      }
      break;
    case "dots":
      [
        [25, 25],
        [75, 75],
      ].forEach(([x, y]) => add(ink, ellipse(x, y, 10)));
      break;
    case "herringbone":
      for (let x = 0; x < 100; x += 25)
        for (let y = -20; y < 120; y += 20) {
          const flip = x % 50 === 0 ? 1 : -1;
          wrapped(
            ink,
            polygon([
              [x, y],
              [x + 25, y + flip * 16],
              [x + 25, y + 9 + flip * 16],
              [x, y + 9],
            ]),
          );
          wrapped(
            accent,
            polygon([
              [x, y + 11],
              [x + 25, y + 11 + flip * 16],
              [x + 25, y + 13 + flip * 16],
              [x, y + 13],
            ]),
          );
        }
      break;
    case "floral":
      [
        [18, 22, 20],
        [72, 67, -32],
        [80, 14, 70],
        [26, 78, -80],
      ].forEach(([x, y, a], i) => {
        const r = i < 2 ? 1 : 0.57;
        wrapped(accent, transform(leaf, x + 5, y + 20, a + 70, r));
        wrapped(accent, transform(leaf, x - 7, y + 17, a - 70, r * 0.75));
        wrapped(detail, transform(leaf, x + 13, y - 7, a + 130, r * 0.47));
        for (let j = 0; j < 7; j++)
          wrapped(
            ink,
            transform(ellipse(0, -9, 5.5, 9), x, y, a + (j * 360) / 7, r),
          );
        for (let j = 0; j < 6; j++)
          wrapped(
            detail,
            transform(ellipse(0, -4, 2.5, 5), x, y, a + j * 60, r),
          );
        wrapped(accent, ellipse(x, y, 2.5 * r));
      });
      break;
    case "paisley":
      [
        [27, 31, -28],
        [78, 81, 152],
      ].forEach(([x, y, a]) => {
        wrapped(ink, transform(paisley, x, y, a));
        wrapped(accent, transform(paisley, x - 0.3, y + 0.6, a, 0.85));
        wrapped(base, transform(paisley, x - 0.3, y + 0.6, a, 0.73));
        wrapped(detail, transform(paisley, x - 0.3, y + 0.6, a, 0.52));
        wrapped(ink, transform(leaf, x, y + 8, a - 15, 0.6));
        for (let j = 0; j < 10; j++) {
          const theta = (j / 10) * Math.PI * 2;
          wrapped(
            accent,
            transform(
              ellipse(-6 + Math.cos(theta) * 10, 7 + Math.sin(theta) * 8, 1),
              x,
              y,
              a,
            ),
          );
        }
      });
      [
        [73, 30],
        [25, 80],
      ].forEach(([x, y]) => {
        for (let j = 0; j < 5; j++)
          wrapped(detail, transform(ellipse(0, -3.7, 1.8, 3.4), x, y, j * 72));
        wrapped(accent, ellipse(x, y, 1.5));
      });
      break;
    case "camo":
      [
        [4, 14, 27],
        [45, 4, 24],
        [83, 30, 32],
        [22, 62, 35],
        [65, 85, 29],
      ].forEach(([x, y, r], i) =>
        wrapped(
          ink,
          transform(blob(0, 0, r, i * 4 + 1), x, y, i * 30, 1.25, 0.8),
        ),
      );
      [
        [18, 16, 19],
        [67, 10, 21],
        [97, 64, 23],
        [51, 54, 27],
        [22, 91, 17],
      ].forEach(([x, y, r], i) =>
        wrapped(
          accent,
          transform(blob(0, 0, r, i * 3 + 2), x, y, i * 46, 1.4, 0.6),
        ),
      );
      [
        [2, 36],
        [43, 25],
        [82, 88],
        [38, 76],
      ].forEach(([x, y], i) =>
        wrapped(
          detail,
          transform(blob(0, 0, 14, i + 11), x, y, i * 25, 1.6, 0.55),
        ),
      );
      break;
    case "leopard":
      [
        [15, 13, 11],
        [57, 7, 9],
        [86, 29, 13],
        [39, 40, 12],
        [6, 59, 10],
        [64, 63, 12],
        [31, 83, 10],
        [92, 94, 11],
      ].forEach(([x, y, r], i) => {
        wrapped(
          ink,
          transform(blob(0, 0, r, i * 2 + 1, 9), x, y, i * 31, 1.15, 0.85),
        );
        wrapped(
          accent,
          transform(
            blob(0, 0, r * 0.66, i * 2 + 1, 9),
            x,
            y,
            i * 31,
            1.15,
            0.85,
          ),
        );
        const a = i * 2.3;
        wrapped(
          base,
          ellipse(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.7, 2.2),
        );
      });
      [
        [33, 12],
        [64, 34],
        [86, 53],
        [16, 35],
        [45, 65],
        [8, 88],
        [64, 92],
      ].forEach(([x, y], i) => wrapped(ink, blob(x, y, 2.2, i + 4, 6)));
      break;
    case "zebra":
      for (let i = 0; i < 4; i++) {
        const x = i * 25;
        wrapped(ink, [
          { op: "m", c: [x, 0] },
          { op: "c", c: [x + 15, 20, x - 6, 33, x + 3, 50] },
          { op: "c", c: [x + 14, 70, x + 12, 82, x, 100] },
          { op: "l", c: [x + 8, 100] },
          { op: "c", c: [x + 24, 76, x + 20, 68, x + 11, 49] },
          { op: "c", c: [x + 2, 32, x + 27, 18, x + 8, 0] },
          { op: "h", c: [] },
        ]);
      }
      break;
    case "tiger":
      for (const y of [0, 25, 50, 75]) {
        const stripe: TextileMark["path"] = [
          { op: "m", c: [-43, 12] },
          { op: "c", c: [-20, 15, -20, 1, 0, 0] },
          { op: "c", c: [20, -1, 20, 13, 43, 9] },
          { op: "c", c: [23, 23, 18, 7, 0, 8] },
          { op: "c", c: [-18, 7, -21, 21, -43, 12] },
          { op: "h", c: [] },
        ];
        wrapped(ink, transform(stripe, 0, y));
        wrapped(ink, transform(stripe, 50, y + 13, 0, 0.75, 0.55));
      }
      break;
    case "tie-dye":
      // Soft translucent, irregular concentric pigment bands; flat vector shapes remain editable.
      [
        [24, 27],
        [78, 80],
      ].forEach(([x, y], group) => {
        const pigments = [ink, accent, detail, base];
        for (let ring = 10; ring >= 0; ring--) {
          const r = 9 + ring * 4.1;
          wrapped(
            pigments[(ring + group) % 4],
            blob(x, y, r, 7 + group * 11, 28, true),
            0.47,
          );
          wrapped(
            pigments[(ring + group) % 4],
            blob(x, y, r - 1.4, 7.3 + group * 11, 28, true),
            0.27,
          );
        }
      });
      break;
  }
  return {
    size: 100,
    marks: marks.map((m) => ({
      ...m,
      path: m.path.map((p) => ({ ...p, c: p.c.map(round) })),
    })),
  };
}
const pathData = (path: TextileMark["path"]) =>
  path
    .map((p) => `${{ m: "M", l: "L", c: "C", h: "Z" }[p.op]}${p.c.join(" ")}`)
    .join(" ");
/** Safe ID used by both the SVG definition and its fill URL. */
export const textilePatternId = (id: string) =>
  `textile-${id.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 100) || "swatch"}`;
export function textilePatternSvg(input: Textile, id: string): string {
  const s = TextileSchema.parse(input),
    tile = textileTile(s),
    safeId = textilePatternId(id);
  return `<pattern id="${safeId}" patternUnits="userSpaceOnUse" width="${s.scale}" height="${s.scale}" patternTransform="rotate(${s.rotation})" viewBox="0 0 100 100"><g>${tile.marks.map((m) => `<path d="${pathData(m.path)}" fill="${m.fill}"${m.opacity === undefined ? "" : ` fill-opacity="${m.opacity}"`}/>`).join("")}</g></pattern>`;
}
export function textileSwatchSvg(input: Textile): string {
  const s = TextileSchema.parse(input);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><title>${textilePresets.find((p) => p.id === s.pattern)!.name} fabric swatch</title><defs>${textilePatternSvg(s, "swatch")}</defs><rect width="100" height="100" fill="url(#${textilePatternId("swatch")})"/></svg>`;
}
export function textileSummary(input: Textile): string {
  const s = TextileSchema.parse(input);
  return `${textilePresets.find((p) => p.id === s.pattern)!.name} · ${s.colors.join(" / ")} · repeat ${s.scale} illustration units · rotation ${s.rotation}° (not physical print scale)`;
}
