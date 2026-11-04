import { describe, it, expect } from "vitest";
import { exponentialMap, triangleDistortion } from "../src/surface-map";
describe("connected surface parameterization", () => {
  it("recovers a planar grid across arbitrary chart boundaries in millimeters", () => {
    const p: number[] = [],
      indices: number[] = [];
    for (let y = 0; y < 9; y++)
      for (let x = 0; x < 9; x++) p.push(x * 10, y * 10, 0);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const i = y * 9 + x;
        indices.push(i, i + 1, i + 9, i + 1, i + 10, i + 9);
      }
    const r = exponentialMap({
      positions: new Float32Array(p),
      indices: new Uint32Array(indices),
      seed: 40,
      radius: 100,
    });
    for (let i = 0; i < 81; i++) {
      expect(r.coordinates[i * 2]).toBeCloseTo(p[i * 3] - 40, 3);
      expect(r.coordinates[i * 2 + 1]).toBeCloseTo(p[i * 3 + 1] - 40, 3);
    }
  });
  it("reports identity, anisotropic scale and foldovers", () => {
    expect(
      triangleDistortion(
        [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
        ],
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
      ),
    ).toEqual({ min: 1, max: 1, ratio: 1, folded: false });
    const stretched = triangleDistortion(
      [
        [0, 0, 0],
        [2, 0, 0],
        [0, 0.5, 0],
      ],
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
    );
    expect(stretched.max).toBe(2);
    expect(stretched.min).toBe(0.5);
    expect(
      triangleDistortion(
        [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
        ],
        [
          [0, 0],
          [0, 1],
          [1, 0],
        ],
      ).folded,
    ).toBe(true);
  });
  it("does not jump between disconnected nearby surfaces", () => {
    const r = exponentialMap({
      positions: new Float32Array([
        0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 0.1, 10, 0, 0.1, 0, 10, 0.1,
      ]),
      indices: new Uint32Array([0, 1, 2, 3, 4, 5]),
      seed: 0,
      radius: 100,
    });
    expect(r.distance[3]).toBe(Infinity);
    expect(Number.isNaN(r.coordinates[6])).toBe(true);
  });
});

it("unwraps a curved periodic mesh through the conventional atlas seam", () => {
  const positions: number[] = [],
    indices: number[] = [],
    columns = 64,
    radius = 60;
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < columns; col++) {
      const a = (col * 2 * Math.PI) / columns;
      positions.push(Math.sin(a) * radius, row * 10, Math.cos(a) * radius);
    }
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < columns; col++) {
      const a = row * columns + col,
        b = row * columns + ((col + 1) % columns);
      indices.push(a, b, a + columns, b, b + columns, a + columns);
    }
  const seed = 2 * columns,
    r = exponentialMap({
      positions: new Float32Array(positions),
      indices: new Uint32Array(indices),
      seed,
      radius: 70,
    });
  for (let k = -8; k <= 8; k++) {
    const id = 2 * columns + ((k + columns) % columns);
    expect(r.coordinates[id * 2]).toBeCloseTo(
      k * 2 * radius * Math.sin(Math.PI / columns),
      2,
    );
    expect(Math.abs(r.coordinates[id * 2 + 1])).toBeLessThan(0.001);
  }
});
