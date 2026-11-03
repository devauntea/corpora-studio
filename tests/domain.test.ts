import { describe, expect, test } from "vitest";
import {
  blankProject,
  circumference,
  historyReducer,
  newLayer,
  parseProject,
  placementSize,
  sha256,
  surfacePoint,
  wrap,
  type Asset,
  type History,
} from "../src/domain";
import { forearmGeometry } from "../src/scene";

async function fixture() {
  const p = blankProject();
  const data = "data:image/png;base64,aW1hZ2UtZml4dHVyZQ==";
  const a: Asset = {
    id: crypto.randomUUID(),
    name: "Fixture.png",
    mime: "image/png",
    data,
    sha256: await sha256(data),
    width: 100,
    height: 200,
  };
  p.assets = [a];
  p.layers = [newLayer(a)];
  return p;
}

describe("project integrity", () => {
  test("preserves millimeters, transforms, source bytes, and named study on round trip", async () => {
    const p = await fixture();
    p.revision = "Sleeve study B";
    p.layers[0] = {
      ...p.layers[0],
      u: 0.999,
      width: 123.4,
      rotation: -37,
      v: 0.33,
      opacity: 0.63,
    };
    expect(await parseProject(JSON.stringify(p))).toEqual(p);
  });
  test("rejects corrupt bytes, missing assets, unsupported schemas, duplicates, invalid ranges", async () => {
    const p = await fixture();
    await expect(parseProject("{")).rejects.toThrow("valid");
    await expect(
      parseProject(JSON.stringify({ ...p, version: 2 })),
    ).rejects.toThrow("Unsupported");
    await expect(
      parseProject(JSON.stringify({ ...p, assets: [] })),
    ).rejects.toThrow("damaged");
    await expect(
      parseProject(
        JSON.stringify({ ...p, layers: [p.layers[0], p.layers[0]] }),
      ),
    ).rejects.toThrow("damaged");
    await expect(
      parseProject(JSON.stringify({ ...p, body: { ...p.body, length: -1 } })),
    ).rejects.toThrow("damaged");
    p.assets[0].data = "data:image/png;base64,Y29ycnVwdA==";
    await expect(parseProject(JSON.stringify(p))).rejects.toThrow("integrity");
  });
});
describe("surface geometry", () => {
  test("wrap seam positions and normals are continuous at every height", () => {
    const body = blankProject().body,
      g = forearmGeometry(body),
      p = g.getAttribute("position"),
      n = g.getAttribute("normal");
    for (let y = 0; y <= 96; y++) {
      const a = y * 129,
        b = a + 128;
      for (let axis = 0; axis < 3; axis++) {
        expect(p.getComponent(a, axis)).toBeCloseTo(p.getComponent(b, axis), 5);
        expect(n.getComponent(a, axis)).toBeCloseTo(n.getComponent(b, axis), 5);
      }
    }
    expect(p.count).toBe(12513);
    g.dispose();
  });
  test("end measurements match model circumference within 0.02 mm", () => {
    const body = blankProject().body;
    for (const v of [0, 1]) {
      let perimeter = 0,
        previous = surfacePoint(body, 0, v);
      for (let i = 1; i <= 4096; i++) {
        const next = surfacePoint(body, i / 4096, v);
        perimeter += Math.hypot(...next.map((c, j) => c - previous[j]));
        previous = next;
      }
      expect(Math.abs(perimeter - (v ? body.elbow : body.wrist))).toBeLessThan(
        0.02,
      );
    }
  });
  test("chart height and wrap width use physical millimeter dimensions", async () => {
    const p = await fixture(),
      layer = p.layers[0],
      asset = p.assets[0];
    const size = placementSize(p.body, layer, asset);
    expect(size.u * circumference(p.body, layer.v)).toBeCloseTo(90, 8);
    expect(size.v * p.body.length).toBeCloseTo(180, 8);
    expect(wrap(-0.01)).toBeCloseTo(0.99);
    expect(wrap(1.01)).toBeCloseTo(0.01);
  });
});
describe("command history", () => {
  test("twenty mixed edits undo to initial and redo to final across a save marker", async () => {
    const p = await fixture();
    let state: History<typeof p> = { present: p, past: [], future: [] };
    let saved = p;
    for (let i = 0; i < 20; i++) {
      const v = state.present;
      state = historyReducer(state, {
        type: "change",
        value:
          i % 2
            ? { ...v, body: { ...v.body, length: 270 + i } }
            : {
                ...v,
                layers: v.layers.map((l) => ({ ...l, rotation: i * 3 })),
              },
      });
      if (i === 9) saved = state.present;
    }
    const final = state.present;
    for (let i = 0; i < 10; i++)
      state = historyReducer(state, { type: "undo" });
    expect(state.present).toBe(saved);
    for (let i = 0; i < 10; i++)
      state = historyReducer(state, { type: "undo" });
    expect(state.present).toBe(p);
    for (let i = 0; i < 20; i++)
      state = historyReducer(state, { type: "redo" });
    expect(state.present).toBe(final);
  });
  test("drag is one undo step and a fresh edit invalidates redo", () => {
    let s: History<number> = { present: 0, past: [], future: [] };
    s = historyReducer(s, { type: "begin" });
    for (let n = 1; n <= 50; n++)
      s = historyReducer(s, { type: "change", value: n });
    s = historyReducer(s, { type: "commit" });
    expect(s.past).toEqual([0]);
    s = historyReducer(s, { type: "undo" });
    expect(s.present).toBe(0);
    s = historyReducer(s, { type: "change", value: 99 });
    expect(s.future).toEqual([]);
  });
});
