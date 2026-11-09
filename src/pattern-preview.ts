import { draftFashion } from "./fashion-draft";
import {
  newFashion,
  pathString,
  type DesignId,
  type PatternPiece,
} from "./fashion-model";
import { starterProfile, type StarterId } from "./starter-sizing";
import { patternCatalog } from "./pattern-catalog";
import { xml } from "./fashion-export";

export type PatternPreview = {
  svg: string;
  url: string;
  pieces: number;
  names: string[];
  error?: string;
};

/** Display-only packing. No rotation or per-piece scaling; dimensions remain comparable. */
export function previewLayout(pieces: PatternPiece[]) {
  const ordered = [...pieces].sort(
    (a, b) => b.height - a.height || b.width - a.width,
  );
  const maxWidth = Math.max(1, ...pieces.map((p) => p.width));
  const maxEdge = Math.max(maxWidth, ...pieces.map((p) => p.height));
  const gap = Math.max(12, maxEdge * 0.045);
  const area = pieces.reduce(
    (n, p) => n + (p.width + gap) * (p.height + gap),
    0,
  );
  const desiredWidth = Math.max(maxWidth, Math.sqrt(area * 1.35));
  // Try nearby shelf widths: a fixed 1300 mm print layout wastes thumbnail space on small garments.
  const choices = [0.75, 1, 1.25, 1.6].map((factor) => {
    const limit = Math.max(maxWidth, desiredWidth * factor);
    let x = 0,
      y = 0,
      rowHeight = 0,
      width = 0;
    const entries = ordered.map((piece) => {
      if (x > 0 && x + piece.width > limit) {
        x = 0;
        y += rowHeight + gap;
        rowHeight = 0;
      }
      const entry = { piece, x, y };
      width = Math.max(width, x + piece.width);
      x += piece.width + gap;
      rowHeight = Math.max(rowHeight, piece.height);
      return entry;
    });
    const height = y + rowHeight;
    const score =
      width * height * (1 + Math.abs(Math.log(width / height / 1.35)));
    return { entries, width, height, score };
  });
  const best = choices.sort((a, b) => a.score - b.score)[0];
  const padding = Math.max(best.width, best.height) * 0.06;
  return {
    ...best,
    x: -padding,
    y: -padding,
    width: best.width + 2 * padding,
    height: best.height + 2 * padding,
  };
}

const previews = new Map<string, PatternPreview>();
export function patternPreview(
  design: DesignId,
  size: StarterId,
  construction = false,
): PatternPreview {
  const key = `${design}:${size}:${construction}`;
  const found = previews.get(key);
  if (found) {
    previews.delete(key);
    previews.set(key, found);
    return found;
  }
  try {
    const f = {
      ...newFashion(),
      design,
      measurements: starterProfile(size).measurements,
    };
    const draft = draftFashion(f),
      layout = previewLayout(draft.pieces);
    // Seam boundaries describe the complete pattern shape, including fold edges. Allowance paths
    // can be partial/open (e.g. bound necklines), so show them only as construction detail.
    // Never fill compound open paths: SVG would invent closures and false fabric wedges.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${layout.x} ${layout.y} ${layout.width} ${layout.height}" fill="none" stroke-linejoin="round" stroke-linecap="round"><title>${xml(patternCatalog[design].name)} — actual drafted pieces</title>${layout.entries.map(({ piece: p, x, y }) => `<g transform="translate(${x},${y})"><title>${xml(p.name)}</title><path data-preview="shape" d="${pathString(p.seam)}" fill="none" stroke="#343b36" stroke-width="1.15" vector-effect="non-scaling-stroke"/>${construction ? `<path data-preview="allowance" d="${pathString(p.cutline)}" fill="none" stroke="#6b7972" stroke-width=".7" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>${p.guides.map((g) => `<path data-preview="guide" d="${pathString(g)}" fill="none" stroke="#9a9d91" stroke-width=".6" vector-effect="non-scaling-stroke"/>`).join("")}` : ""}</g>`).join("")}</svg>`;
    const result = {
      svg,
      url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      pieces: draft.pieces.length,
      names: draft.pieces.map((p) => p.name),
    };
    previews.set(key, result);
    if (previews.size > 96) previews.delete(previews.keys().next().value!);
    return result;
  } catch (error) {
    return {
      svg: "",
      url: "",
      pieces: 0,
      names: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
