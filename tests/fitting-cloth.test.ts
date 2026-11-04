import { describe, it, expect } from "vitest";
import {
  fitBody,
  photoFitTargets,
  deformBodyPoint,
  type BodyStudy,
} from "../src/body-fitting";
import { clothDefaults } from "../src/cloth-model";
import { clothMesh } from "../src/cloth-mesh";
import { simulateCloth } from "../src/cloth-solver";
import { draftFashion } from "../src/fashion-draft";
import { newFashion } from "../src/fashion-model";
describe("bounded body fitting", () => {
  it("calibrates two manually confirmed photos and reports missing tape separately", () => {
    const points = {
      top: [0.5, 0.05],
      floor: [0.5, 0.95],
      neck: [0.5, 0.15],
      chestLeft: [0.35, 0.28],
      chestRight: [0.65, 0.28],
      waistLeft: [0.38, 0.4],
      waistRight: [0.62, 0.4],
      hipsLeft: [0.34, 0.49],
      hipsRight: [0.66, 0.49],
    };
    const s: BodyStudy = {
      height: 1750,
      views: [
        { assetId: "a", view: "front", points },
        { assetId: "b", view: "side", points },
      ],
      tape: {},
      notes: "",
    } as BodyStudy;
    const r = photoFitTargets(
      s,
      [
        { id: "a", width: 600, height: 900 },
        { id: "b", width: 600, height: 900 },
      ],
      "male",
    );
    expect(r.targets).toHaveLength(6);
    expect(r.length).toBeCloseTo(1555.556, 2);
    expect(r.levels[0]).toBeGreaterThan(r.levels[1]);
    expect(() =>
      photoFitTargets({ ...s, views: s.views.slice(0, 1) }, [], "male"),
    ).toThrow(/front and a side/);
  });
  it("recovers a known local torso deformation with measured residuals", () => {
    const vertices: number[] = [],
      indices: number[] = [],
      levels: [number, number, number] = [5, 3, 1];
    for (let row = 0; row < 36; row++) {
      const y = -1 + row * 0.2;
      for (let k = 0; k < 64; k++) {
        const a = (k * Math.PI) / 32;
        vertices.push(Math.cos(a) * 1.6, y, Math.sin(a) * 1.1);
      }
    }
    for (let row = 0; row < 35; row++)
      for (let k = 0; k < 64; k++) {
        const a = row * 64 + k,
          b = row * 64 + ((k + 1) % 64);
        indices.push(a, b, a + 64, b, b + 64, a + 64);
      }
    const shape = {
      levels,
      scales: [1.15, 0.9, 0.85, 1.1, 1.2, 1.05] as [
        number,
        number,
        number,
        number,
        number,
        number,
      ],
    };
    const targets = levels.flatMap((y, i) => {
      const x = deformBodyPoint([1.6, y, 0], [], shape)[0] * 200,
        z = deformBodyPoint([0, y, 1.1], [], shape)[2] * 200;
      return [
        {
          level: (["chest", "waist", "hips"] as const)[i],
          kind: "width" as const,
          value: x,
        },
        {
          level: (["chest", "waist", "hips"] as const)[i],
          kind: "depth" as const,
          value: z,
        },
      ];
    });
    const r = fitBody({
      vertices: new Float32Array(vertices),
      indices: new Uint32Array(indices),
      levels,
      scale: 100,
      targets,
    });
    expect(Math.max(...r.residuals.map((r) => Math.abs(r.error)))).toBeLessThan(
      0.3,
    );
  });
});
describe("garment cloth preview", () => {
  it("unfolds a real pattern and preserves pin locations under gravity", () => {
    const draft = draftFashion(newFashion()),
      config = {
        ...clothDefaults(),
        steps: 30,
        spacing: 40,
        panels: [
          {
            id: crypto.randomUUID(),
            pieceId: "front",
            name: "Front",
            unfold: true,
            mirror: false,
            x: 0,
            y: 400,
            z: 200,
            yaw: 0,
            roll: 0,
            pinTop: true,
          },
        ],
      };
    const mesh = clothMesh(draft, config);
    expect(mesh.indices.length).toBeGreaterThan(300);
    expect(mesh.panels[0].count).toBeLessThan(7000);
    const r = simulateCloth({
      mesh,
      config,
      gsm: 180,
      bodyPositions: new Float32Array(),
      bodyIndices: new Uint32Array(),
      floor: -1000,
    });
    for (let i = 0; i < mesh.pins.length; i++)
      if (mesh.pins[i])
        expect(Array.from(r.positions.subarray(i * 3, i * 3 + 3))).toEqual(
          Array.from(mesh.positions.subarray(i * 3, i * 3 + 3)),
        );
    expect(r.positions.every(Number.isFinite)).toBe(true);
    expect(r.p95EdgeStrain).toBeLessThan(0.1);
  });
});

import { bodiceSetup } from "../src/cloth-setup";
import { tapeHull } from "../src/body-fitting";
it("pairs bodice seams by height instead of crossing top and bottom", () => {
  const draft = draftFashion(newFashion()),
    config = bodiceSetup(draft),
    mesh = clothMesh(draft, config);
  expect(config.stitches).toHaveLength(2);
  for (let i = 0; i < mesh.stitches.length; i += 2) {
    const a = mesh.stitches[i],
      b = mesh.stitches[i + 1];
    expect(
      Math.abs(mesh.positions[a * 3 + 1] - mesh.positions[b * 3 + 1]),
    ).toBeLessThan(config.spacing * 1.5);
  }
  const r = simulateCloth({
    mesh,
    config,
    gsm: 180,
    bodyPositions: new Float32Array(),
    bodyIndices: new Uint32Array(),
    floor: -1000,
  });
  expect(r.seamGap).toBeLessThan(10);
  expect(r.p95EdgeStrain).toBeLessThan(0.15);
});
it("closes a taut tape path across partition openings", () => {
  const points: [number, number, number][] = [
    [-1, 2, -1],
    [-1, 2, 1],
    [1, 2, 1],
    [1, 2, -1],
  ];
  const hull = tapeHull([
    { a: points[0], b: points[1] },
    { a: points[2], b: points[3] },
  ]);
  expect(hull).toHaveLength(4);
  expect(
    hull.reduce((n, s) => n + Math.hypot(s.a[0] - s.b[0], s.a[2] - s.b[2]), 0),
  ).toBe(8);
});
