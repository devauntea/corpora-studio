import { expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { humanBody } from "../src/domain";
import { decodeRig, skeletonPose, skinPoint } from "../src/skeleton";

async function fixture(sex: "male" | "female") {
  const meta = JSON.parse(
    await readFile(`public/anatomy/rig-v6-${sex}.json`, "utf8"),
  );
  const bytes = await readFile(`public/anatomy/${meta.buffer}`);
  const rig = decodeRig(
    meta,
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    meta.vertexCount,
  );
  return rig;
}
for (const sex of ["male", "female"] as const)
  test(`${sex}: complete rig, neutral identity, backward knee and inherited hand movement`, async () => {
    const rig = await fixture(sex);
    expect(rig.bones.length).toBe(163);
    const i = (name: string) => rig.bones.findIndex((b) => b.name === name);
    const body = humanBody("full-leg");
    body.model!.sex = sex;
    for (const muscularity of [0, 0.5, 1]) {
      body.muscularity = muscularity;
      const neutral = skeletonPose(rig, body, true);
      for (let v = 0; v < rig.offsets.length - 1; v += 137) {
        const p = new THREE.Vector3().fromArray(rig.chartRest, v * 3);
        expect(
          skinPoint(p.clone(), v, rig, neutral.duals).distanceTo(p),
        ).toBeLessThan(1e-10);
      }
      body.flex = 90;
      const bent = skeletonPose(rig, body);
      for (const side of ["L", "R"]) {
        const knee = bent.frames[i(`lowerleg01.${side}`)].head;
        const ankle = bent.frames[i(`foot.${side}`)].head;
        const moved = ankle
          .clone()
          .applyMatrix4(bent.transforms[i(`foot.${side}`)]);
        expect(moved.z).toBeLessThan(knee.z - 3.8);
        expect(Math.abs(moved.y - knee.y)).toBeLessThan(0.3);
        expect(moved.distanceTo(knee)).toBeCloseTo(ankle.distanceTo(knee), 10);
      }
      body.section = "full-arm";
      body.armPose = {
        left: { raise: 78, flex: 105, twist: 0 },
        right: { raise: 78, flex: 105, twist: 0 },
      };
      body.musclePose = "double-biceps";
      const pose = skeletonPose(rig, body);
      for (const side of ["L", "R"]) {
        const elbow = pose.frames[i(`lowerarm01.${side}`)].head
          .clone()
          .applyMatrix4(pose.transforms[i(`lowerarm01.${side}`)]);
        const wrist = pose.frames[i(`wrist.${side}`)].head
          .clone()
          .applyMatrix4(pose.transforms[i(`wrist.${side}`)]);
        expect(wrist.y).toBeGreaterThan(elbow.y + 2);
      }
      body.section = "full-leg";
    }
  });
test("dual-quaternion blending retains radius while twisting, including opposite quaternion signs", () => {
  const rig = {
    bones: [],
    offsets: new Uint32Array([0, 2]),
    indices: new Uint8Array([0, 1]),
    weights: new Float32Array([0.5, 0.5]),
    chartRest: new Float32Array(),
  };
  const q = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    Math.PI / 2,
  );
  const duals = new Float64Array([
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    q.x,
    q.y,
    q.z,
    q.w,
    0,
    0,
    0,
    0,
  ]);
  const p = skinPoint(new THREE.Vector3(1, 0, 0), 0, rig, duals);
  expect(p.length()).toBeCloseTo(1, 12);
  expect(p.x).toBeCloseTo(Math.SQRT1_2, 12);
  for (let k = 8; k < 16; k++) duals[k] *= -1;
  expect(
    skinPoint(new THREE.Vector3(1, 0, 0), 0, rig, duals).distanceTo(p),
  ).toBeLessThan(1e-12);
});
test("malformed hierarchy and unnormalized weights are rejected", async () => {
  const meta = JSON.parse(
    await readFile("public/anatomy/rig-v6-male.json", "utf8"),
  );
  const bytes = await readFile(`public/anatomy/${meta.buffer}`);
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  const damaged = structuredClone(meta);
  damaged.bones[0].parent = 0;
  expect(() => decodeRig(damaged, buffer, meta.vertexCount)).toThrow(
    "hierarchy",
  );
  new Float32Array(buffer, meta.weightsOffset, 1)[0] = 0.1;
  expect(() => decodeRig(meta, buffer, meta.vertexCount)).toThrow("weights");
});
