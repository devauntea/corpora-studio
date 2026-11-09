import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { sculptCatalog } from "../src/sculpt-catalog";
import { sculptBody, bodyZones } from "../src/domain";
import { sculptMeshData, sculptGeometry } from "../src/sculpt-surface";

for (const entry of sculptCatalog.filter((e) => e.skinEnvelope)) {
  test(`${entry.id}: skin and muscle retain identical tattoo anchors and charts`, () => {
    const file = readFileSync(`public${entry.file}`);
    const size = file.readUInt32LE(12);
    const gltf = JSON.parse(file.toString("utf8", 20, 20 + size));
    const bin = file.subarray(28 + size);
    const primitive = gltf.meshes[0].primitives[0];
    const attribute = (id: number) => {
      const a = gltf.accessors[id],
        v = gltf.bufferViews[a.bufferView];
      const width = { VEC3: 3, VEC2: 2, SCALAR: 1 }[a.type as string]!;
      const data = bin.subarray((v.byteOffset ?? 0) + (a.byteOffset ?? 0));
      const values = Array.from({ length: a.count * width }, (_, i) =>
        a.componentType === 5126
          ? data.readFloatLE(i * 4)
          : a.componentType === 5123
            ? data.readUInt16LE(i * 2)
            : data.readUInt32LE(i * 4),
      );
      return new THREE.BufferAttribute(
        a.componentType === 5126
          ? new Float32Array(values)
          : new Uint32Array(values),
        width,
      );
    };
    expect(primitive.targets).toHaveLength(1);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", attribute(primitive.attributes.POSITION));
    g.setAttribute("normal", attribute(primitive.attributes.NORMAL));
    g.setAttribute("uv", attribute(primitive.attributes.TEXCOORD_0));
    g.setIndex(attribute(primitive.indices));
    g.morphTargetsRelative = true;
    g.morphAttributes.position = [attribute(primitive.targets[0].POSITION)];
    if (primitive.targets[0].NORMAL !== undefined)
      g.morphAttributes.normal = [attribute(primitive.targets[0].NORMAL)];
    const delta = g.morphAttributes.position[0];
    expect(delta.count).toBe(g.getAttribute("position").count);
    let maxDelta = 0;
    for (let i = 0; i < delta.count; i++)
      maxDelta = Math.max(
        maxDelta,
        Math.hypot(delta.getX(i), delta.getY(i), delta.getZ(i)),
      );
    expect(maxDelta).toBeGreaterThan(0.001);
    expect(maxDelta).toBeLessThan(0.06);
    const muscle = sculptMeshData(g, new THREE.MeshStandardMaterial());
    const skin = sculptMeshData(
      g,
      new THREE.MeshStandardMaterial(),
      new THREE.Matrix4(),
      true,
    );
    expect(skin.parts).toEqual(muscle.parts);
    expect(skin.sculpt!.sourceIds).toEqual(muscle.sculpt!.sourceIds);
    expect(skin.vertices.length).toBe(muscle.vertices.length);
    expect(skin.vertices.every((v) => v.every(Number.isFinite))).toBe(true);
    const body = sculptBody(entry.id);
    const a = sculptGeometry(muscle, body)[0].geometry;
    const b = sculptGeometry(skin, body)[0].geometry;
    expect(b.getAttribute("uv").array).toEqual(a.getAttribute("uv").array);
    expect(b.getAttribute("uv1").array).toEqual(a.getAttribute("uv1").array);
    expect(b.getAttribute("position").array).not.toEqual(
      a.getAttribute("position").array,
    );
    expect(body.model!.sculptAppearance).toBe("skin");
    if (entry.section === "neck") expect(bodyZones(body)).toEqual(["neck"]);
  });
}
