import type {
  Fashion,
  PatternDraft,
  PatternOp,
  PatternPiece,
  Point2,
} from "./fashion-model";
import { fallbackEdgeIds } from "./pattern-edges";
import { flatten } from "./pattern-geometry";
import type { Seam, SeamPlan, SeamSide } from "./seam-model";

export const edgeIds = (p: PatternPiece) =>
  p.edgeIds ?? fallbackEdgeIds(p.seam);
const distance = (a: Point2, b: Point2) => Math.hypot(a.x - b.x, a.y - b.y);
export function edgeSamples(p: PatternPiece, index: number): Point2[] {
  const op = p.seam[index];
  if (!op || op.type === "move") return [];
  const move = p.seam
    .slice(0, index)
    .reverse()
    .find((o) => o.type === "move");
  if (!move || move.type === "close") return [];
  const prev = p.seam[index - 1],
    start = prev.type === "close" ? move.to : prev.to;
  const edge: PatternOp =
    op.type === "close" ? { type: "line", to: move.to } : op;
  return flatten([{ type: "move", to: start }, edge], 0.01).map((v) => v.point);
}
const edgeCache = new WeakMap<
  PatternPiece,
  {
    id: string;
    index: number;
    points: Point2[];
    length: number;
    label: string;
  }[]
>();
export function boundaryEdges(p: PatternPiece) {
  const cached = edgeCache.get(p);
  if (cached) return cached;
  const edges = edgeIds(p).flatMap((id, index) => {
    const points = edgeSamples(p, index),
      length = points.reduce(
        (sum, v, i) => sum + (i ? distance(points[i - 1], v) : 0),
        0,
      );
    return length > 0.001
      ? [
          {
            id,
            index,
            points,
            length,
            label: `Edge ${index} · ${length.toFixed(1)} mm`,
          },
        ]
      : [];
  });
  edgeCache.set(p, edges);
  return edges;
}
export function walkSide(draft: PatternDraft, side: SeamSide) {
  const piece = draft.pieces.find((p) => p.id === side.pieceId);
  if (!piece)
    throw new Error(`Missing piece: ${side.pieceId}. Reconnect this seam.`);
  const available = boundaryEdges(piece),
    points: Point2[] = [],
    indices: number[] = [];
  for (const id of side.edges) {
    const edge = available.find((e) => e.id === id);
    if (!edge)
      throw new Error(
        `${piece.name}: a linked edge changed or was removed. Reconnect this seam.`,
      );
    if (points.length && distance(points.at(-1)!, edge.points[0]) > 0.01)
      throw new Error(
        `${piece.name}: select consecutive edges in boundary order.`,
      );
    points.push(...edge.points.slice(points.length ? 1 : 0));
    indices.push(edge.index);
  }
  if (side.reverse) points.reverse();
  const distances = [0];
  for (let i = 1; i < points.length; i++)
    distances.push(distances[i - 1] + distance(points[i - 1], points[i]));
  const length = distances.at(-1)!;
  if (!(length > 0.001)) throw new Error(`${piece.name}: empty seam.`);
  const at = (mm: number) => {
    if (mm < 0 || mm > length + 0.01)
      throw new Error(`${piece.name}: matching mark is outside the seam.`);
    const k = distances.findIndex((d) => d >= mm);
    if (k <= 0) return k === 0 ? points[0] : points.at(-1)!;
    const t = (mm - distances[k - 1]) / (distances[k] - distances[k - 1]);
    return {
      x: points[k - 1].x + (points[k].x - points[k - 1].x) * t,
      y: points[k - 1].y + (points[k].y - points[k - 1].y) * t,
    };
  };
  return { piece, points, indices, length, at };
}
export type SeamCheck = {
  id: string;
  name: string;
  a?: ReturnType<typeof walkSide>;
  b?: ReturnType<typeof walkSide>;
  difference?: number;
  residual?: number;
  issues: string[];
};
export function checkSeam(draft: PatternDraft, seam: Seam): SeamCheck {
  const result: SeamCheck = { id: seam.id, name: seam.name, issues: [] };
  try {
    const a = walkSide(draft, seam.a),
      b = walkSide(draft, seam.b);
    result.a = a;
    result.b = b;
    result.difference = b.length - a.length;
    result.residual = result.difference - seam.ease;
    if (
      seam.a.pieceId === seam.b.pieceId &&
      seam.a.edges.some((id) => seam.b.edges.includes(id))
    )
      result.issues.push(
        "Both sides include the same edge. Choose distinct edges or duplicate the piece for separate panels.",
      );
    if (seam.mode === "plain" && Math.abs(seam.ease) > 0.001)
      result.issues.push(
        "A plain seam has nonzero intended ease. Choose ease, gather or stretch.",
      );
    if (Math.abs(result.residual) > seam.tolerance + 0.02)
      result.issues.push(
        `B is ${result.difference.toFixed(1)} mm longer than A; intended difference is ${seam.ease.toFixed(1)} mm (${Math.abs(result.residual).toFixed(1)} mm outside the target).`,
      );
    for (const s of [a, b])
      if (
        s.piece.allowances &&
        s.indices.some((i) => s.piece.allowances![i] === 0)
      )
        result.issues.push(
          `${s.piece.name}: a paired edge has zero seam allowance. Verify fold/finish intent.`,
        );
    const marks = [...seam.notches].sort((x, y) => x.a - y.a);
    for (let i = 0; i < marks.length; i++) {
      const n = marks[i];
      if (n.a > a.length + 0.01 || n.b > b.length + 0.01)
        result.issues.push(
          `${n.name}: matching mark is outside the current seam length.`,
        );
      else if (
        Math.abs(n.b - (n.a / a.length) * b.length) >
        seam.tolerance + 0.02
      )
        result.issues.push(
          `${n.name}: marks do not follow proportional ease. Verify intentional local gathering or adjust the distances.`,
        );
      if (i && n.b <= marks[i - 1].b)
        result.issues.push(
          `${n.name}: matching marks cross or overlap in sewing direction.`,
        );
    }
    if (!marks.length)
      result.issues.push(
        "No paired matching marks. Add them if needed for this seam.",
      );
  } catch (e) {
    result.issues.push(e instanceof Error ? e.message : String(e));
  }
  return result;
}
export function constructionChecks(draft: PatternDraft, f: Fashion) {
  if (!f.seamPlan) return [];
  if (f.seamPlan.design !== (f.design ?? "teagan"))
    return [
      {
        id: "design",
        name: "Construction plan",
        issues: [
          "The plan belongs to another design. Replace it or reconnect the seams before exporting.",
        ],
      },
    ] as SeamCheck[];
  return f.seamPlan.seams.map((s) => checkSeam(draft, s));
}
/** Paired marks are derived from the current arc lengths, never baked into the source draft. */
export function withSeamNotches(draft: PatternDraft, f: Fashion): PatternDraft {
  const marks = new Map<string, PatternPiece["notches"]>();
  for (const check of constructionChecks(draft, f)) {
    const seam = f.seamPlan?.seams.find((s) => s.id === check.id);
    if (!seam || !check.a || !check.b) continue;
    for (const key of ["a", "b"] as const) {
      const side = check[key]!;
      for (const n of seam.notches) {
        if (n[key] > side.length + 0.01) continue;
        const list = marks.get(side.piece.id) ?? [];
        list.push({ point: side.at(n[key]), double: n.double });
        marks.set(side.piece.id, list);
      }
    }
  }
  return {
    ...draft,
    pieces: draft.pieces.map((p) => ({
      ...p,
      notches: [...p.notches, ...(marks.get(p.id) ?? [])],
    })),
  };
}
export function newSeam(a: SeamSide, b: SeamSide, name = "New seam"): Seam {
  return {
    id: crypto.randomUUID(),
    name,
    a,
    b,
    mode: "plain",
    ease: 0,
    tolerance: 2,
    notes: "",
    notches: [],
  };
}
export function starterSeams(draft: PatternDraft, design: string): SeamPlan {
  const seams: Seam[] = [];
  const add = (
    name: string,
    aId: string,
    ai: number[],
    bId: string,
    bi: number[],
    reverse = false,
  ) => {
    const a = draft.pieces.find((p) => p.id === aId),
      b = draft.pieces.find((p) => p.id === bId);
    if (!a || !b) return;
    const seam = newSeam(
      { pieceId: aId, edges: ai.map((i) => edgeIds(a)[i]), reverse: false },
      { pieceId: bId, edges: bi.map((i) => edgeIds(b)[i]), reverse },
      name,
    );
    try {
      const left = walkSide(draft, seam.a),
        right = walkSide(draft, seam.b);
      seam.notches = [
        {
          id: crypto.randomUUID(),
          name: "Midpoint",
          a: left.length / 2,
          b: right.length / 2,
          double: false,
        },
      ];
      seams.push(seam);
    } catch {
      /* A changed engine topology must not produce a falsely connected starter. */
    }
  };
  let instructions: string[][] = [];
  if (design === "teagan") {
    add("Side seams", "front", [2], "back", [2]);
    add("Shoulder seams", "front", [5], "back", [5]);
    add("Sleeve underarm", "sleeve", [2], "sleeve", [8], true);
    instructions = [
      [
        "Prepare the knit pieces",
        "Confirm fabric stretch, cut quantities, fold edges and neckband recovery. Transfer marks before sewing.",
      ],
      [
        "Join shoulders",
        "Match the front and back shoulder seams; choose a stretch-compatible stitch and finish.",
      ],
      [
        "Set sleeves and close sides",
        "Review sleeve-cap ease and front/back orientation before attaching sleeves. Close the underarm and side seams, matching marks.",
      ],
      [
        "Finish neckline and hems",
        "Test neckband tension on a fabric sample; attach evenly, then finish sleeve and body hems. Measure the finished sample.",
      ],
    ];
  } else if (design === "simon") {
    add(
      "Right side seam",
      "simon.frontRight",
      [2, 3, 4],
      "simon.back",
      [2, 3, 4],
    );
    add(
      "Left side seam",
      "simon.frontLeft",
      [2, 3, 4],
      "simon.back",
      [2, 3, 4],
    );
    instructions = [
      [
        "Prepare plackets and details",
        "Review the design instructions for plackets, interfacing and pocket placement. Transfer matching marks.",
      ],
      [
        "Assemble yoke and shoulders",
        "Join the back and yoke, then front shoulders. Check the selected construction method and enclosed seams.",
      ],
      [
        "Assemble collar and sleeves",
        "Confirm collar/stand orientation, sleeve plackets and cuff pleats against the design instructions. Check armhole and sleeve-cap ease.",
      ],
      [
        "Close and finish",
        "Join side and underarm seams, attach cuffs and collar assembly, finish hems and closures. Check button placement and finished measurements on the sample.",
      ],
    ];
  } else if (design === "titan") {
    add("Inseam", "titan.front", [4], "titan.back", [1], true);
    add("Outseam", "titan.front", [1, 2], "titan.back", [3], true);
    instructions = [
      [
        "Prepare a fitting toile",
        "Titan is a trouser block. Define the closure and waist finish before production; mark the waist, seat and knee levels.",
      ],
      [
        "Join leg seams",
        "Match inseams and outseams in sewing direction. Review any deliberate ease before basting.",
      ],
      [
        "Join rise and fit",
        "Baste the rise and leave the planned opening. Try the toile, record balance and ease corrections, then revise the pattern.",
      ],
      [
        "Develop finishes",
        "Add the intended waistband, closure, pockets and hem treatment as a separate design-development step. Recheck the revised sample.",
      ],
    ];
  }
  return {
    design,
    seams,
    steps: instructions.map(([title, instruction]) => ({
      id: crypto.randomUUID(),
      title,
      instruction,
      seamIds: [],
    })),
    notes:
      "Starter checklist — edit for your construction method. Only the listed seams are connected; review all other joins and finishes.",
  };
}
