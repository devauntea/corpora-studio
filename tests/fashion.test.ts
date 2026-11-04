import { inflateSync } from "node:zlib";
import { describe, expect, test } from "vitest";
import { createRequire } from "node:module";
import { draftFashion } from "../src/fashion-draft";
import {
  FashionSchema,
  newFashion,
  pathString,
  tilePlan,
} from "../src/fashion-model";
import { patternSvg, patternPdf } from "../src/fashion-export";
import { blankProject, parseProject } from "../src/domain";

describe("measured garment drafting", () => {
  test("drafts four finite pieces and sizes the neckband from the seamline", () => {
    const f = newFashion(),
      d = draftFashion(f);
    expect(d.pieces.map((p) => p.id)).toEqual([
      "front",
      "back",
      "sleeve",
      "neckband",
    ]);
    expect(d.warnings).toEqual([]);
    expect(d.pieces[0].width).toBeCloseTo(305, 2);
    expect(d.pieces[0].height).toBeGreaterThan(600);
    expect(d.pieces[3].width).toBeCloseTo(
      d.neckLength * f.bandRatio + 2 * f.seamAllowance,
      5,
    );
    expect(d.pieces[3].height).toBe(60);
    for (const p of d.pieces) {
      expect(pathString(p.seam)).not.toMatch(/NaN|Infinity/);
      expect(p.cutline.length).toBeGreaterThan(3);
    }
  });
  test("hem allowance is 3x SA, fold edges stay at x=0, and no-SA export has no extra width", () => {
    const f = newFashion(),
      withSa = draftFashion(f),
      without = draftFashion({ ...f, seamAllowance: 0 });
    for (let i = 0; i < 2; i++) {
      expect(withSa.pieces[i].width - without.pieces[i].width).toBeCloseTo(
        10,
        3,
      );
      const points = withSa.pieces[i].cutline.flatMap((o) =>
        o.type === "close" ? [] : [o.to],
      );
      expect(Math.min(...points.map((p) => p.x))).toBeCloseTo(0, 5);
      expect(
        Math.max(...points.map((p) => p.y)) -
          withSa.pieces[i].hemY +
          withSa.pieces[i].origin.y,
      ).toBeCloseTo(30, 3);
    }
  });
  test("measurements and shape controls regenerate geometry deterministically", () => {
    const f = newFashion(),
      original = draftFashion(f);
    const longer = draftFashion({
      ...f,
      options: { ...f.options, lengthBonus: 20 },
    });
    expect(longer.pieces[0].height - original.pieces[0].height).toBeCloseTo(
      132,
      2,
    );
    expect(longer.pieces[1].height - original.pieces[1].height).toBeCloseTo(
      132,
      2,
    );
    const neck = draftFashion({
      ...f,
      options: { ...f.options, necklineDepth: 40 },
    });
    expect(neck.neckLength).toBeGreaterThan(original.neckLength);
    const wider = draftFashion({
      ...f,
      measurements: { ...f.measurements, hips: 1200 },
    });
    expect(wider.pieces[0].width).toBeGreaterThan(original.pieces[0].width);
    expect(draftFashion(f)).toEqual(original);
  });
  test("rejects impossible, nonfinite, unknown and out-of-range inputs", () => {
    const f = newFashion();
    expect(() =>
      draftFashion({
        ...f,
        measurements: {
          ...f.measurements,
          hpsToBust: 450,
          hpsToWaistBack: 350,
        },
      }),
    ).toThrow(/vertical/);
    expect(() =>
      draftFashion({ ...f, measurements: { ...f.measurements, chest: NaN } }),
    ).toThrow();
    expect(FashionSchema.safeParse({ ...f, engine: "future" }).success).toBe(
      false,
    );
    expect(
      FashionSchema.safeParse({
        ...f,
        options: { ...f.options, unsafe: "__proto__" },
      }).success,
    ).toBe(false);
  });
  test("pattern settings round-trip with tattoo data; v6 files migrate without changing geometry", async () => {
    const p = { ...blankProject(), fashion: newFashion() };
    expect(await parseProject(JSON.stringify(p))).toEqual(p);
    const { fashion: _, ...legacy } = p;
    expect(
      await parseProject(JSON.stringify({ ...legacy, version: 6 })),
    ).toEqual(legacy);
    await expect(
      parseProject(JSON.stringify({ ...p, version: 6 })),
    ).rejects.toThrow(/v6/);
  });
  test("SVG has physical mm units, escaped user text and a 50 mm calibration square", () => {
    const f = newFashion(),
      d = draftFashion(f),
      svg = patternSvg(d, f, 'Study <test> & "one"');
    expect(svg).toContain('width="50" height="50"');
    expect(svg).toMatch(/width="[\d.]+mm" height="[\d.]+mm"/);
    expect(svg).toContain("Study &lt;test&gt; &amp; &quot;one&quot;");
    expect((svg.match(/id="piece-/g) || []).length).toBe(4);
  });
  test("A4 and Letter tiles cover every boundary with exactly 5 mm overlaps", async () => {
    for (const paper of ["a4", "letter"] as const) {
      const f = { ...newFashion(), paper },
        d = draftFashion(f);
      for (const piece of d.pieces) {
        const t = tilePlan(piece, paper);
        expect(
          t.width + (t.columns - 1) * (t.width - 5),
        ).toBeGreaterThanOrEqual(piece.width + 12 - 0.001);
        expect(t.height + (t.rows - 1) * (t.height - 5)).toBeGreaterThanOrEqual(
          piece.height + 12 - 0.001,
        );
      }
      const pdf = await patternPdf(d, f, "Pattern test");
      expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
      const streams = [
        ...Buffer.from(pdf)
          .toString("latin1")
          .matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g),
      ].map((m) => inflateSync(Buffer.from(m[1], "latin1")).toString());
      expect(streams.length).toBe(
        1 +
          d.pieces.reduce((n, p) => {
            const t = tilePlan(p, paper);
            return n + t.rows * t.columns;
          }, 0),
      );
      // A painted rectangle would consume the path before W and silently disable clipping.
      expect(streams[1]).toMatch(/re\s+W\s+n/);
      const calibration = [
        ...streams[0].matchAll(/([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) re/g),
      ];
      expect(
        calibration.some(
          (r) =>
            Math.abs((Number(r[3]) * 25.4) / 72 - 100) < 0.001 &&
            Math.abs((Math.abs(Number(r[4])) * 25.4) / 72 - 100) < 0.001,
        ),
      ).toBe(true);
    }
  });
  test("compatibility shims block pollution through strings and array paths", () => {
    const require = createRequire(import.meta.url),
      set = require("lodash.set"),
      unset = require("lodash.unset");
    const object = {};
    set(object, "safe.nested", 42);
    expect(object).toEqual({ safe: { nested: 42 } });
    set({}, "__proto__.polluted", "yes");
    set({}, ["constructor", "prototype", "polluted"], "yes");
    expect(({} as { polluted?: string }).polluted).toBeUndefined();
    const target = { keep: true };
    unset({}, ["__proto__", "toString"]);
    expect(target.toString).toBeTypeOf("function");
  });
});
