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
      parseProject(JSON.stringify({ ...p, version: 99 })),
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
    if (body.kind !== "forearm-v1") throw new Error("Expected legacy forearm");
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

describe("expanded project compatibility", () => {
  test("opens a real v1 saved project without changing sources, body, or layer transforms", async () => {
    const { readFile } = await import("node:fs/promises");
    const old = JSON.parse(
      await readFile(
        new URL("./fixtures/legacy-v1.json", import.meta.url),
        "utf8",
      ),
    );
    const p = await parseProject(JSON.stringify(old));
    expect(p.version).toBe(3);
    expect(p.photos).toEqual([]);
    expect(p.assets).toEqual(old.assets);
    expect(p.body).toEqual(old.body);
    expect(p.layers).toEqual(old.layers);
    expect(await parseProject(JSON.stringify(p))).toEqual(p);
  });
  test("photo transforms, protection and image sources survive round trip; dangling references and excess budgets fail", async () => {
    const { layerForPhoto } = await import("../src/domain");
    const p = await fixture();
    const body = {
      ...p.assets[0],
      id: crypto.randomUUID(),
      role: "body" as const,
    };
    p.assets.push(body);
    const photo = {
      id: crypto.randomUUID(),
      assetId: body.id,
      masks: [
        {
          radius: 0.02,
          points: [
            [0.2, 0.3],
            [0.4, 0.5],
          ] as [number, number][],
        },
      ],
    };
    p.photos.push(photo);
    p.layers.push({
      ...layerForPhoto(p.assets[0], photo.id),
      stretch: 1.4,
      flipX: true,
      ink: "custom",
      inkColor: "#246125",
      locked: true,
    });
    expect(await parseProject(JSON.stringify(p))).toEqual(p);
    await expect(
      parseProject(JSON.stringify({ ...p, photos: [] })),
    ).rejects.toThrow();
    await expect(
      parseProject(
        JSON.stringify({
          ...p,
          assets: p.assets.map((a) => ({ ...a, width: 8192, height: 8192 })),
        }),
      ),
    ).rejects.toThrow();
    p.photos[0].masks[0].points[0] = [2, 0];
    await expect(parseProject(JSON.stringify(p))).rejects.toThrow();
  });
  test("HEIC preview is required and hash checked separately from original bytes", async () => {
    const p = await fixture();
    const a = p.assets[0];
    a.preview = a.data;
    a.previewSha256 = a.sha256;
    a.mime = "image/heic";
    a.data = "data:image/heic;base64,aGVpYw==";
    a.sha256 = await sha256(a.data);
    expect((await parseProject(JSON.stringify(p))).assets[0].data).toBe(a.data);
    a.previewSha256 = "0".repeat(64);
    await expect(parseProject(JSON.stringify(p))).rejects.toThrow(
      "preview integrity",
    );
    delete a.preview;
    await expect(parseProject(JSON.stringify(p))).rejects.toThrow();
  });
});
describe("region templates", () => {
  test("all region measurements, seams, deformation and placements remain coherent", async () => {
    const { regions, regionBody } = await import("../src/domain");
    const p = await fixture();
    for (const region of regions) {
      const body = regionBody(region, p.body);
      if (body.kind !== "region-v1") throw new Error("template");
      for (const v of [0, 0.5, 1]) {
        let total = 0,
          prev = surfacePoint(body, 0, v);
        for (let i = 1; i <= 2048; i++) {
          const next = surfacePoint(body, i / 2048, v);
          total += Math.hypot(...next.map((x, j) => x - prev[j]));
          prev = next;
        }
        expect(Math.abs(total - circumference(body, v))).toBeLessThan(0.05);
        const a = surfacePoint(body, 0, v),
          b = surfacePoint(body, 1, v);
        a.forEach((x, j) => expect(x).toBeCloseTo(b[j], 8));
      }
      const smooth = surfacePoint({ ...body, muscularity: 0 }, 0.31, 0.5),
        muscle = surfacePoint({ ...body, muscularity: 1 }, 0.31, 0.5);
      expect(
        Math.hypot(...smooth.map((x, i) => x - muscle[i])),
      ).toBeGreaterThan(1);
      p.body = body;
      expect(await parseProject(JSON.stringify(p))).toEqual(p);
      const g = forearmGeometry(body);
      expect([...g.getAttribute("normal").array].every(Number.isFinite)).toBe(
        true,
      );
      g.dispose();
    }
  });
});

describe("anatomical sections and image recipes", () => {
  test("v2 migrates without changing existing geometry, masks, placements or source bytes", async () => {
    const p = await fixture();
    const old = { ...p, version: 2 };
    const next = await parseProject(JSON.stringify(old));
    expect(next).toEqual({ ...old, version: 3 });
    await expect(
      parseProject(
        JSON.stringify({ ...old, body: { ...old.body, kind: "human-v1" } }),
      ),
    ).rejects.toThrow();
  });
  test("v3 preserves anatomical settings and nondestructive strokes; budgets reject malformed edits", async () => {
    const { humanBody, cleanArtwork } = await import("../src/domain");
    const p = await fixture();
    p.body = { ...humanBody("upper-body"), flex: 90, anatomy: true };
    p.layers[0].zone = "left-arm";
    p.assets[0].edits = {
      ...cleanArtwork(),
      background: "white",
      strokes: [
        {
          mode: "erase",
          radius: 0.02,
          points: [
            [0.2, 0.3],
            [0.3, 0.4],
          ],
        },
        { mode: "restore", radius: 0.03, points: [[0.22, 0.32]] },
      ],
    };
    expect(await parseProject(JSON.stringify(p))).toEqual(p);
    p.assets[0].edits.strokes[0].points[0] = [-0.1, 0.2];
    await expect(parseProject(JSON.stringify(p))).rejects.toThrow();
    p.assets[0].edits.strokes[0].points[0] = [0.1, 0.2];
    p.assets[0].role = "body";
    await expect(parseProject(JSON.stringify(p))).rejects.toThrow();
  });
  test("background keying keeps saturated detail, provides feathered alpha, and supports arbitrary colors", async () => {
    const { backgroundAlpha } = await import("../src/artwork");
    const { cleanArtwork } = await import("../src/domain");
    const e = {
      ...cleanArtwork(),
      background: "white" as const,
      tolerance: 20,
      feather: 20,
    };
    expect(backgroundAlpha(255, 255, 255, e)).toBe(0);
    expect(backgroundAlpha(0, 0, 0, e)).toBe(1);
    expect(backgroundAlpha(255, 255, 0, e)).toBe(1);
    expect(backgroundAlpha(225, 225, 225, e)).toBe(0.5);
    expect(
      backgroundAlpha(18, 52, 86, {
        ...e,
        background: "color",
        color: "#123456",
      }),
    ).toBe(0);
  });
  test("complete sections have stable UVs under flex and build changes; matching left/right silhouettes", async () => {
    const { readFile } = await import("node:fs/promises");
    const { humanGeometries } = await import("../src/anatomy");
    const { humanBody } = await import("../src/domain");
    const data = JSON.parse(
      await readFile(
        new URL("../public/anatomy/human-v1.json", import.meta.url),
        "utf8",
      ),
    );
    for (const section of ["full-arm", "upper-body", "full-leg"] as const) {
      const body = humanBody(section),
        relaxed = humanGeometries(data, body),
        bent = humanGeometries(data, { ...body, flex: 90, build: 1.2 });
      expect(relaxed.length).toBe(section === "upper-body" ? 3 : 1);
      for (let i = 0; i < relaxed.length; i++) {
        const a = relaxed[i].geometry,
          b = bent[i].geometry;
        expect(a.getAttribute("position").count).toBeGreaterThan(20_000);
        expect([...a.getAttribute("uv").array]).toEqual([
          ...b.getAttribute("uv").array,
        ]);
        expect([...a.getAttribute("position").array]).not.toEqual([
          ...b.getAttribute("position").array,
        ]);
        expect([...b.getAttribute("normal").array].every(Number.isFinite)).toBe(
          true,
        );
        a.dispose();
        b.dispose();
      }
    }
    const left = humanGeometries(data, humanBody("full-arm"))[0].geometry,
      right = humanGeometries(data, {
        ...humanBody("full-arm"),
        side: "right",
      })[0].geometry;
    left.computeBoundingBox();
    right.computeBoundingBox();
    expect(left.boundingBox!.max.y - left.boundingBox!.min.y).toBeCloseTo(
      right.boundingBox!.max.y - right.boundingBox!.min.y,
      1,
    );
    left.dispose();
    right.dispose();
  });
});
