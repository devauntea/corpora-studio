import { describe, expect, test } from "vitest";
import { patternPreview, previewLayout } from "../src/pattern-preview";
import { designIds } from "../src/pattern-catalog";
import { draftFashion } from "../src/fashion-draft";
import { newFashion, pathString } from "../src/fashion-model";
import { starterProfile } from "../src/starter-sizing";

describe("catalog previews", () => {
  test("all catalog designs use unfilled seam outlines without construction clutter", () => {
    for (const design of designIds) {
      const preview = patternPreview(design, "male-m");
      expect(preview.error, design).toBeUndefined();
      expect(preview.pieces, design).toBeGreaterThan(0);
      expect(preview.svg, design).not.toMatch(
        /NaN|Infinity|stroke-dasharray|data-preview="allowance"|data-preview="guide"/,
      );
      expect(preview.svg.match(/data-preview="shape"/g)?.length, design).toBe(
        preview.pieces,
      );
      expect(preview.svg, design).not.toMatch(/fill="(?!none)[^"]+"/);
      expect(preview.names.length, design).toBe(preview.pieces);
    }
  }, 60000);
  test("construction detail is optional and preserves exact shape geometry", () => {
    const plain = patternPreview("simon", "male-m"),
      detail = patternPreview("simon", "male-m", true);
    const cuts = (svg: string) =>
      [...svg.matchAll(/data-preview="shape" d="([^"]+)"/g)].map((m) => m[1]);
    expect(cuts(detail.svg)).toEqual(cuts(plain.svg));
    expect(detail.svg).toContain('data-preview="allowance"');
    expect(detail.url).not.toBe(plain.url);
    expect(patternPreview("simon", "male-m").url).toBe(plain.url);
  });
  test("display packing has no overlaps, one shared scale and never mutates printable drafts", () => {
    const fashion = {
      ...newFashion(),
      design: "simon" as const,
      measurements: starterProfile("male-m").measurements,
    };
    const draft = draftFashion(fashion),
      original = JSON.stringify(draft);
    const layout = previewLayout(draft.pieces);
    expect(JSON.stringify(draft)).toBe(original);
    for (const [i, a] of layout.entries.entries()) {
      expect(a.piece).toBe(draft.pieces.find((p) => p.id === a.piece.id));
      for (const b of layout.entries.slice(i + 1)) {
        const overlaps =
          a.x < b.x + b.piece.width &&
          a.x + a.piece.width > b.x &&
          a.y < b.y + b.piece.height &&
          a.y + a.piece.height > b.y;
        expect(overlaps).toBe(false);
      }
      expect(a.x).toBeGreaterThan(layout.x);
      expect(a.y).toBeGreaterThan(layout.y);
      expect(a.x + a.piece.width).toBeLessThan(layout.x + layout.width);
      expect(a.y + a.piece.height).toBeLessThan(layout.y + layout.height);
    }
    const preview = patternPreview("simon", "male-m");
    for (const p of draft.pieces)
      expect(preview.svg).toContain(`d="${pathString(p.seam)}"`);
  });
});
