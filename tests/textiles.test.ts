import { describe, expect, test } from "vitest";
import {
  TextileSchema,
  colorPalettes,
  defaultTextile,
  textilePatternId,
  textilePatternIds,
  textilePatternSvg,
  textilePresets,
  textileSummary,
  textileSwatchSvg,
  textileTile,
} from "../src/textiles";

describe("original textile library", () => {
  test("all referenced print families have deterministic bounded vector tiles", () => {
    expect(new Set(textilePresets.map((p) => p.id))).toEqual(
      new Set(textilePatternIds),
    );
    const geometries = new Set<string>();
    for (const preset of textilePresets) {
      const style = defaultTextile(preset.id);
      const before = JSON.stringify(style);
      const tile = textileTile(style);
      expect(tile).toEqual(textileTile(style));
      expect(JSON.stringify(style)).toBe(before);
      expect(tile.size).toBe(100);
      expect(tile.marks.length).toBeGreaterThan(0);
      expect(tile.marks.length).toBeLessThan(400);
      for (const mark of tile.marks) {
        expect(style.colors).toContain(mark.fill);
        expect(mark.opacity ?? 1).toBeGreaterThan(0);
        expect(mark.opacity ?? 1).toBeLessThanOrEqual(1);
        expect(mark.path[0].op).toBe("m");
        expect(mark.path.at(-1)?.op).toBe("h");
        for (const command of mark.path) {
          expect(command.c.length).toBe({ m: 2, l: 2, c: 6, h: 0 }[command.op]);
          for (const n of command.c) {
            expect(Number.isFinite(n)).toBe(true);
            expect(Math.abs(n)).toBeLessThan(250);
          }
        }
      }
      geometries.add(JSON.stringify(tile.marks.map((m) => m.path)));
      const svg = textileSwatchSvg(style);
      expect(svg).toContain('viewBox="0 0 100 100"');
      expect(svg).toContain('fill="url(#textile-swatch)"');
      expect(svg).not.toMatch(/NaN|Infinity|<image|href=|http[^s:]/);
    }
    expect(geometries.size).toBe(textilePresets.length);
  });

  test("palette, rotation and repeat controls change appearance without changing motif geometry", () => {
    const style = defaultTextile("floral");
    const changed = {
      ...style,
      colors: colorPalettes[1].colors,
      scale: 100,
      rotation: 45,
    };
    expect(textileTile(changed).marks.map((m) => m.path)).toEqual(
      textileTile(style).marks.map((m) => m.path),
    );
    expect(textileTile(changed).marks.map((m) => m.fill)).not.toEqual(
      textileTile(style).marks.map((m) => m.fill),
    );
    const svg = textilePatternSvg(changed, "layer-123");
    expect(svg).toContain('id="textile-layer-123"');
    expect(svg).toContain('width="100" height="100"');
    expect(svg).toContain('patternTransform="rotate(45)"');
    expect(textileSummary(changed)).toContain("not physical print scale");
  });

  test("hostile and oversized styles cannot inject SVG or unbounded print settings", () => {
    const style = defaultTextile();
    for (const bad of [
      { ...style, colors: ['red"/><script/>', ...style.colors.slice(1)] },
      { ...style, colors: [...style.colors, "#ffffff"] },
      { ...style, scale: Infinity },
      { ...style, scale: 0 },
      { ...style, scale: 161 },
      { ...style, rotation: 181 },
      { ...style, pattern: "external-image" },
      { ...style, source: "https://example.com/image.svg" },
    ]) {
      expect(TextileSchema.safeParse(bad).success).toBe(false);
      expect(() => textileTile(bad as typeof style)).toThrow();
    }
    const hostileId = '\"><script>alert(1)</script>';
    expect(textilePatternId(hostileId)).toMatch(/^textile-[a-zA-Z0-9_-]+$/);
    expect(textilePatternSvg(style, hostileId)).not.toContain("<script>");
    const copy = defaultTextile("floral");
    copy.colors[0] = "#000000";
    expect(defaultTextile("floral").colors[0]).not.toBe("#000000");
  });
});
