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
      parseProject(JSON.stringify({ ...p, version: 109 })),
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
    expect(p.version).toBe(11);
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
    expect(next).toEqual({ ...old, version: 11 });
    await expect(
      parseProject(
        JSON.stringify({ ...old, body: { ...old.body, kind: "human-v1" } }),
      ),
    ).rejects.toThrow();
  });
  test("current format preserves anatomical settings and nondestructive strokes; budgets reject malformed edits", async () => {
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
      const body = humanBody(section);
      delete body.model;
      const relaxed = humanGeometries(data, body),
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
    const legacyArm = humanBody("full-arm");
    delete legacyArm.model;
    const left = humanGeometries(data, legacyArm)[0].geometry,
      right = humanGeometries(data, {
        ...legacyArm,
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

describe("pose and crop compatibility", () => {
  test("v3 migration retains the prior simultaneous elbow pose and source recipes", async () => {
    const { humanBody, armPose, cleanArtwork } = await import("../src/domain");
    const p = await fixture();
    p.body = { ...humanBody("upper-body"), flex: 73 };
    delete p.body.model;
    p.assets[0].edits = cleanArtwork();
    const old = { ...p, version: 3 };
    const next = await parseProject(JSON.stringify(old));
    expect(next).toEqual({ ...old, version: 11 });
    if (next.body.kind !== "human-v1")
      throw new Error("Expected human surface");
    expect(armPose(next.body, "left")).toEqual({
      flex: 73,
      raise: 0,
      twist: 0,
    });
    expect(armPose(next.body, "right")).toEqual(armPose(next.body, "left"));
    old.assets[0].edits!.crop = { x: 0, y: 0, width: 0.5, height: 1 };
    await expect(parseProject(JSON.stringify(old))).rejects.toThrow("v3");
  });
  test("crop bounds, dimensions and both surface placement paths agree; invalid crops and poses are rejected", async () => {
    const { cleanArtwork, artworkBounds, artworkRatio, humanBody, armPose } =
      await import("../src/domain");
    const p = await fixture();
    const a = p.assets[0];
    a.edits = {
      ...cleanArtwork(),
      crop: { x: 0.25, y: 0.1, width: 0.5, height: 0.8 },
    };
    expect(artworkBounds(a.width, a.height, a.edits.crop)).toEqual({
      x: 25,
      y: 20,
      width: 50,
      height: 160,
    });
    expect(artworkRatio(a)).toBe(3.2);
    expect(placementSize(p.body, p.layers[0], a).v).toBeCloseTo(
      (p.layers[0].width * 3.2) / p.body.length,
    );
    p.body = humanBody("full-arm");
    expect(placementSize(p.body, p.layers[0], a).v).toBeCloseTo(
      (p.layers[0].width * 3.2) / p.body.length,
    );
    p.body.armPose = {
      left: { flex: 45, raise: 75, twist: -90 },
      right: armPose(p.body, "right"),
    };
    expect(await parseProject(JSON.stringify(p))).toEqual(p);
    a.edits.crop!.width = 0.9;
    await expect(parseProject(JSON.stringify(p))).rejects.toThrow();
    a.edits.crop!.width = 0.5;
    p.body.armPose.left.twist = 91;
    await expect(parseProject(JSON.stringify(p))).rejects.toThrow();
    expect(
      artworkBounds(1, 1, { x: 0.99, y: 0.99, width: 0.01, height: 0.01 }),
    ).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });
  test("arm poses keep UVs fixed and the opposite arm unchanged, with finite normals at maximum pose", async () => {
    const { readFile } = await import("node:fs/promises");
    const { humanGeometries } = await import("../src/anatomy");
    const { humanBody, armPose } = await import("../src/domain");
    const data = JSON.parse(
      await readFile(
        new URL("../public/anatomy/human-v1.json", import.meta.url),
        "utf8",
      ),
    );
    const body = humanBody("upper-body");
    delete body.model;
    const a = humanGeometries(data, body),
      b = humanGeometries(data, {
        ...body,
        armPose: {
          left: { flex: 110, raise: 120, twist: 90 },
          right: armPose(body, "right"),
        },
      });
    for (let i = 0; i < a.length; i++) {
      expect([...a[i].geometry.getAttribute("uv").array]).toEqual([
        ...b[i].geometry.getAttribute("uv").array,
      ]);
      expect(
        [...b[i].geometry.getAttribute("normal").array].every(Number.isFinite),
      ).toBe(true);
      expect(
        [...b[i].geometry.getAttribute("position").array].every(
          Number.isFinite,
        ),
      ).toBe(true);
    }
    expect([...a[1].geometry.getAttribute("position").array]).not.toEqual([
      ...b[1].geometry.getAttribute("position").array,
    ]);
    expect([...a[2].geometry.getAttribute("position").array]).toEqual([
      ...b[2].geometry.getAttribute("position").array,
    ]);
    [...a, ...b].forEach((x) => x.geometry.dispose());
  });
});

test("Fit model contains every posed bound in all preset views and narrow viewports", async () => {
  const THREE = await import("three");
  const { frameBounds } = await import("../src/scene");
  const bounds = new THREE.Box3(
    new THREE.Vector3(-900, -450, -150),
    new THREE.Vector3(600, 650, 400),
  );
  for (const view of ["front", "back", "left", "right"] as const)
    for (const aspect of [0.6, 1.2, 2]) {
      const frame = frameBounds(bounds, aspect, 35, view),
        camera = new THREE.PerspectiveCamera(35, aspect, 1, 20000);
      camera.position.copy(frame.position);
      camera.lookAt(frame.target);
      camera.updateMatrixWorld();
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z]) {
            const p = new THREE.Vector3(x, y, z).project(camera);
            expect(Math.abs(p.x)).toBeLessThan(1);
            expect(Math.abs(p.y)).toBeLessThan(1);
          }
    }
});

describe("detailed anatomy assets", () => {
  test("v5 studies retain their exact model revision; new sculpts require v6", async () => {
    const { humanBody } = await import("../src/domain");
    const p = await fixture();
    p.body = humanBody("upper-body");
    p.body.model!.revision = 2;
    const old = { ...p, version: 5 };
    const loaded = await parseProject(JSON.stringify(old));
    expect(loaded).toEqual({ ...old, version: 11 });
    expect(await parseProject(JSON.stringify(loaded))).toEqual(loaded);
    const forged = {
      ...old,
      body: { ...old.body, model: { ...p.body.model, revision: 3 } },
    };
    await expect(parseProject(JSON.stringify(forged))).rejects.toThrow("v5");
    expect(humanBody("upper-body").model!.revision).toBe(5);
  });
  test("v4 migration keeps the original body and never opts into new geometry", async () => {
    const { humanBody } = await import("../src/domain");
    const p = await fixture();
    p.body = humanBody("upper-body");
    delete p.body.model;
    p.body.muscularity = 0.65;
    const old = { ...p, version: 4 };
    const migrated = await parseProject(JSON.stringify(old));
    expect(migrated.body).toEqual(old.body);
    expect(migrated.version).toBe(11);
    const invalidOld = {
      ...old,
      body: {
        ...old.body,
        model: { revision: 2, sex: "male", physique: "fit", anatomyOpacity: 1 },
      },
    };
    await expect(parseProject(JSON.stringify(invalidOld))).rejects.toThrow(
      "v4",
    );
  });
  test("both detailed meshes have complete attributes, finite posed geometry and immutable UV/identity fields", async () => {
    const { readFile } = await import("node:fs/promises");
    const { createHash } = await import("node:crypto");
    const { humanGeometries } = await import("../src/anatomy");
    const { humanBody } = await import("../src/domain");
    for (const revision of [2, 3] as const)
      for (const sex of ["male", "female"] as const) {
        const meta = JSON.parse(
          await readFile(
            new URL(
              `../public/anatomy/human-v${revision}-${sex}.json`,
              import.meta.url,
            ),
            "utf8",
          ),
        );
        const raw = await readFile(
          new URL(
            `../public/anatomy/human-v${revision}-${sex}.bin`,
            import.meta.url,
          ),
        );
        expect(createHash("sha256").update(raw).digest("hex")).toBe(
          meta.sha256,
        );
        const buffer = raw.buffer.slice(
          raw.byteOffset,
          raw.byteOffset + raw.byteLength,
        );
        const values = new Float32Array(buffer, 0, meta.vertexCount * 12);
        const indices = new Uint32Array(buffer, meta.vertexCount * 48);
        const vertices = Array.from({ length: meta.vertexCount }, (_, i) =>
          Array.from(values.subarray(i * 12, i * 12 + 12)),
        );
        let offset = 0;
        const parts: number[][] = meta.partCounts.map((n: number) => {
          const p = Array.from(indices.subarray(offset, offset + n));
          offset += n;
          return p;
        });
        expect(offset).toBe(indices.length);
        expect(indices.every((i) => i < vertices.length)).toBe(true);
        const field = new Uint8Array(
          await readFile(
            new URL(
              `../public/anatomy/muscle-field-v${revision}-${sex}.bin`,
              import.meta.url,
            ),
          ),
        );
        expect(field.length).toBe(meta.vertexCount * (revision === 3 ? 12 : 4));
        const fieldMeta = JSON.parse(
          await readFile(
            new URL(
              `../public/anatomy/muscle-field-v${revision}-${sex}.json`,
              import.meta.url,
            ),
            "utf8",
          ),
        );
        expect(createHash("sha256").update(field).digest("hex")).toBe(
          fieldMeta.sha256,
        );
        expect(fieldMeta.vertexCount).toBe(meta.vertexCount);
        expect(fieldMeta.groups.length).toBe(36);
        expect(
          field
            .subarray(meta.vertexCount * 3, meta.vertexCount * 4)
            .every((id) => id < 36 || id === 255),
        ).toBe(true);
        const edges = new Map<
          string,
          { a: number; b: number; count: number }
        >();
        for (const part of parts.slice(0, 3))
          for (let i = 0; i < part.length; i += 3)
            for (let j = 0; j < 3; j++) {
              const a = part[i + j],
                b = part[i + ((j + 1) % 3)],
                key = a < b ? `${a}:${b}` : `${b}:${a}`;
              const edge = edges.get(key);
              if (edge) edge.count++;
              else edges.set(key, { a, b, count: 1 });
            }
        // The connected upper body is open only at its neck and waist, never at the shoulders.
        for (const edge of edges.values())
          if (edge.count === 1) {
            const a = vertices[edge.a],
              b = vertices[edge.b];
            expect(
              [1.2, 6.9].some(
                (y) => Math.abs(a[1] - y) < 1e-5 && Math.abs(b[1] - y) < 1e-5,
              ),
            ).toBe(true);
            expect(a[4]).toBe(0);
            expect(b[4]).toBe(0);
          }
        const data = {
          vertices,
          parts,
          joints: meta.joints,
          muscleColors: field.subarray(0, meta.vertexCount * 3),
          muscleIds: field.subarray(meta.vertexCount * 3, meta.vertexCount * 4),
          muscleInfluences:
            revision === 3 ? field.subarray(meta.vertexCount * 4) : undefined,
        };
        if (revision === 3) {
          expect(meta.detailLandmarks.fingers).toHaveLength(5);
          expect(meta.detailLandmarks.toes).toHaveLength(5);
          const influences = data.muscleInfluences!;
          let valid = true;
          for (let i = 0; i < meta.vertexCount; i++) {
            const total = [...influences.subarray(i * 8 + 4, i * 8 + 8)].reduce(
              (a, b) => a + b,
              0,
            );
            valid &&=
              [...influences.subarray(i * 8, i * 8 + 4)].every(
                (id) => id <= 36,
              ) &&
              total >= 253 &&
              total <= 257;
          }
          expect(valid).toBe(true);
        }
        const body = humanBody("upper-body");
        body.model!.sex = sex;
        body.model!.revision = revision;
        const a = humanGeometries(data, body);
        const b = humanGeometries(data, {
          ...body,
          anatomy: true,
          muscularity: 0,
          armPose: {
            left: { flex: 90, raise: 75, twist: -45 },
            right: { flex: 20, raise: 0, twist: 30 },
          },
        });
        for (let i = 0; i < a.length; i++) {
          const g = a[i].geometry,
            h = b[i].geometry;
          for (const attr of Object.values(g.attributes))
            expect(attr.count).toBe(g.getAttribute("position").count);
          for (const attr of Object.values(h.attributes))
            expect(Array.from(attr.array).every(Number.isFinite)).toBe(true);
          expect(
            Buffer.from(g.getAttribute("uv").array.buffer).equals(
              Buffer.from(h.getAttribute("uv").array.buffer),
            ),
          ).toBe(true);
          expect(
            Buffer.from(g.getAttribute("muscleId").array.buffer).equals(
              Buffer.from(h.getAttribute("muscleId").array.buffer),
            ),
          ).toBe(true);
          if (revision === 3)
            for (const name of [
              "musclePalette",
              "muscleWeights",
              "restPosition",
            ])
              expect(
                Buffer.from(g.getAttribute(name).array.buffer).equals(
                  Buffer.from(h.getAttribute(name).array.buffer),
                ),
              ).toBe(true);
          expect(
            Buffer.from(g.getAttribute("position").array.buffer).equals(
              Buffer.from(h.getAttribute("position").array.buffer),
            ),
          ).toBe(false);
          g.dispose();
          h.dispose();
        }
      }
  }, 60_000);
});

test("muscle hover resolves the visible region inside a boundary triangle", async () => {
  const THREE = await import("three"),
    { muscleAtHit } = await import("../src/anatomy");
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
  );
  geometry.setAttribute(
    "musclePalette",
    new THREE.Float32BufferAttribute(
      [0, 9, 36, 36, 0, 9, 36, 36, 0, 9, 36, 36],
      4,
    ),
  );
  geometry.setAttribute(
    "muscleWeights",
    new THREE.Float32BufferAttribute([1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0], 4),
  );
  const mesh = new THREE.Mesh(geometry);
  mesh.position.set(3, 4, 5);
  mesh.updateMatrixWorld();
  const hit = (x: number, y: number) => ({
    object: mesh,
    point: mesh.localToWorld(new THREE.Vector3(x, y, 0)),
    distance: 1,
    face: {
      a: 0,
      b: 1,
      c: 2,
      normal: new THREE.Vector3(0, 0, 1),
      materialIndex: 0,
    },
  });
  expect(muscleAtHit(hit(0.1, 0.1))).toBe(0);
  expect(muscleAtHit(hit(0.7, 0.1))).toBe(9);
  geometry.getAttribute("musclePalette").setX(0, 36);
  expect(muscleAtHit(hit(0.1, 0.1))).toBeUndefined();
  geometry.dispose();
});

test("joint blend preserves radial distance through partial weights and keeps legacy bending available", async () => {
  const { blendJoint } = await import("../src/anatomy");
  const { Vector3 } = await import("three");
  const pivot = new Vector3(3, 4, 5),
    axis = new Vector3(0, 0, 1),
    source = new Vector3(7, 4, 5);
  for (const w of [0, 0.25, 0.5, 0.75, 1])
    expect(
      blendJoint(source.clone(), pivot, axis, Math.PI / 2, w, true).distanceTo(
        pivot,
      ),
    ).toBeCloseTo(4, 8);
  expect(
    blendJoint(source.clone(), pivot, axis, Math.PI / 2, 0.5, false).distanceTo(
      pivot,
    ),
  ).toBeCloseTo(Math.sqrt(8), 8);
});
