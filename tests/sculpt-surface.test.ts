import { expect, test } from "vitest";
import * as THREE from "three";
import { humanBody, humanScale } from "../src/domain";
import {
  sculptGeometry,
  sculptMaterial,
  sculptMeshData,
} from "../src/sculpt-surface";
import { exponentialMap } from "../src/surface-map";
import { SurfaceDecals } from "../src/surface-decals";

function body() {
  const b = humanBody("full-arm");
  b.model!.sculptId = "sculpt-arm";
  return b;
}

test("sculpt graph welds native UV seams while preserving render normals and source UVs", () => {
  const source = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 16, 6, true);
  const data = sculptMeshData(source, new THREE.MeshStandardMaterial());
  expect(data.vertices.length).toBe(16 * 7);
  expect(source.getAttribute("position").count).toBe(17 * 7);
  const b = body();
  const [{ geometry, zone }] = sculptGeometry(data, b);
  expect(zone).toBe("left-arm");
  expect(geometry.index).toBeNull();
  expect(geometry.getAttribute("uv1").count).toBe(
    geometry.getAttribute("uv").count,
  );
  const p = geometry.getAttribute("position");
  expect(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y).toBeCloseTo(
    500 * humanScale(b),
    3,
  );
  for (let i = 0; i < p.count; i++) {
    const original = source.index!.getX(i);
    expect(geometry.getAttribute("normal").getX(i)).toBe(
      source.getAttribute("normal").getX(original),
    );
    expect(geometry.getAttribute("uv1").getX(i)).toBe(
      source.getAttribute("uv").getX(original),
    );
  }
  const map = exponentialMap({
    positions: new Float32Array(data.vertices.flatMap((v) => v.slice(0, 3))),
    indices: new Uint32Array(data.parts[0]),
    seed: 16 * 3,
    radius: 1000,
  });
  expect(map.distance.every(Number.isFinite)).toBe(true);
  geometry.dispose();
  source.dispose();
  data.sculpt!.geometry.dispose();
});

test("fixed-pose sculptures ignore saved muscle and joint controls", () => {
  const data = sculptMeshData(
    new THREE.SphereGeometry(0.08, 12, 8),
    new THREE.MeshStandardMaterial(),
  );
  const b = body();
  const before = sculptGeometry(data, b)[0].geometry;
  b.build = 1.3;
  b.muscularity = 0;
  b.flex = 105;
  b.musclePose = "double-biceps";
  b.muscleTension = 1;
  const after = sculptGeometry(data, b)[0].geometry;
  expect(Array.from(after.getAttribute("position").array)).toEqual(
    Array.from(before.getAttribute("position").array),
  );
  before.dispose();
  after.dispose();
  data.sculpt!.geometry.dispose();
});

test("native maps retain their own UV channel and color alongside the tattoo canvas", () => {
  const source = new THREE.MeshStandardMaterial({
    color: "#663399",
    map: new THREE.Texture(),
    normalMap: new THREE.Texture(),
  });
  const data = sculptMeshData(new THREE.BoxGeometry(), source);
  const ink = new THREE.CanvasTexture({} as HTMLCanvasElement);
  const m = sculptMaterial(data.sculpt!, body(), ink);
  expect(m.color.getHex()).toBe(source.color.getHex());
  expect(m.map!.channel).toBe(1);
  expect(m.normalMap!.channel).toBe(1);
  expect(source.map!.channel).toBe(0);
  expect(m.map).not.toBe(source.map);
  expect(m.userData.nativeColor).toBe(true);
  m.dispose();
  ink.dispose();
  data.sculpt!.geometry.dispose();
});

test("connected anchors identify the sculpt and cannot be reused on a different source", async () => {
  const data = sculptMeshData(
    new THREE.SphereGeometry(0.08, 12, 8),
    new THREE.MeshStandardMaterial(),
  );
  const b = body();
  const { geometry, zone } = sculptGeometry(data, b)[0];
  const decals = new SurfaceDecals(
    data,
    b,
    new Map([[zone, { mesh: new THREE.Mesh(geometry) }]]),
  );
  const layer = {
    id: "x",
    assetId: "x",
    name: "test",
    visible: true,
    u: 0.5,
    v: 0.5,
    width: 50,
    rotation: 0,
    opacity: 1,
    removePaper: false,
    monochrome: false,
  };
  const anchor = decals.nearestAnchor(layer)!;
  expect(anchor.sculptId).toBe("sculpt-arm");
  await expect(
    decals.paint([
      {
        layer: { ...layer, surface: { ...anchor, sculptId: "sculpt-leg" } },
        image: {} as HTMLCanvasElement,
        ratio: 1,
      },
    ]),
  ).rejects.toThrow("different body mesh");
  decals.dispose();
  geometry.dispose();
  data.sculpt!.geometry.dispose();
});

test("skin recoloring keeps detail maps and source materials intact and rotates without changing anchors", async () => {
  const { sculptRotation } = await import("../src/sculpt-surface");
  const source = new THREE.MeshStandardMaterial({
    map: new THREE.Texture(),
    normalMap: new THREE.Texture(),
    color: "#663399",
  });
  const data = sculptMeshData(new THREE.BoxGeometry(), source);
  const b = body();
  b.skin = "#ae7552";
  b.model!.sculptAppearance = "skin";
  b.model!.sculptRotation = { x: 90, y: 180, z: 360 };
  const ink = new THREE.CanvasTexture({} as HTMLCanvasElement);
  const material = sculptMaterial(data.sculpt!, b, ink);
  expect(material.userData.sculptAppearanceUniforms.sculptRecolor.value).toBe(
    1,
  );
  expect(
    material.userData.sculptAppearanceUniforms.sculptSkin.value.getHexString(),
  ).toBe("ae7552");
  expect(material.normalMap).not.toBeNull();
  expect(source.color.getHexString()).toBe("663399");
  const rotation = sculptRotation(b);
  expect(rotation.x).toBeCloseTo(Math.PI / 2);
  expect(rotation.y).toBeCloseTo(Math.PI);
  expect(rotation.z).toBeCloseTo(Math.PI * 2);
  const before = sculptGeometry(data, b)[0].geometry;
  b.model!.sculptRotation = { x: 0, y: 0, z: 0 };
  const after = sculptGeometry(data, b)[0].geometry;
  expect([...before.getAttribute("position").array]).toEqual([
    ...after.getAttribute("position").array,
  ]);
  before.dispose();
  after.dispose();
  material.dispose();
  ink.dispose();
  data.sculpt!.geometry.dispose();
});
