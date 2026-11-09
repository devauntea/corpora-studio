import { expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { humanBody } from "../src/domain";
import {
  decodeCentersOfRotation,
  decodeRig,
  skeletonPose,
  skinPoint,
  skinPointAboutCentre,
} from "../src/skeleton";

const dir = "public/anatomy";
async function load(sex: "male" | "female") {
  const meta = JSON.parse(await readFile(`${dir}/human-v7-${sex}.json`, "utf8"));
  const n = meta.vertexCount;
  const body = await readFile(`${dir}/${meta.buffer}`);
  const positions = new Float32Array(body.buffer.slice(body.byteOffset, body.byteOffset + n * 48));
  const rigMeta = JSON.parse(await readFile(`${dir}/${meta.rig}`, "utf8"));
  const rigBytes = await readFile(`${dir}/${rigMeta.buffer}`);
  const rig = decodeRig(rigMeta, rigBytes.buffer.slice(rigBytes.byteOffset, rigBytes.byteOffset + rigBytes.byteLength), n);
  const corBytes = await readFile(`${dir}/${meta.centersOfRotation.buffer}`);
  const cor = decodeCentersOfRotation(corBytes.buffer.slice(corBytes.byteOffset, corBytes.byteOffset + corBytes.byteLength), n);
  return { meta, n, positions, rig, cor };
}

for (const sex of ["male", "female"] as const)
  test(`${sex}: elbow/knee centres of rotation keep the bind pose and reduce knee bulge`, async () => {
    const { n, positions, rig, cor } = await load(sex);
    const count = cor.alpha.length;
    expect(count).toBeGreaterThan(5000);
    const body = humanBody("full-leg");
    body.model!.sex = sex;
    body.model!.revision = 7;
    body.muscularity = 1;
    const point = (v: number) =>
      new THREE.Vector3(...[0, 1, 2].map((c) => positions[v * 12 + c] + positions[v * 12 + 3 + c]));
    const centre = (v: number) => {
      const k = cor.slot[v] * 3;
      return new THREE.Vector3(cor.fit[k], cor.fit[k + 1], cor.fit[k + 2]);
    };
    const bind = skeletonPose(rig, body, true);
    body.flex = 135;
    const bent = skeletonPose(rig, body);
    const knee = bent.frames[rig.bones.findIndex((b) => b.name === "lowerleg01.L")].head;
    let checked = 0,
      dqsFront = -Infinity,
      corFront = -Infinity;
    for (let v = 0; v < n; v++) {
      const slot = cor.slot[v];
      if (slot < 0) continue;
      const p = point(v);
      // Bind pose: identical to the rest surface.
      const rest = skinPointAboutCentre(p.clone(), centre(v), cor.alpha[slot], v, rig, bind.duals, bind.transforms);
      expect(rest.distanceTo(p)).toBeLessThan(1e-5);
      const a = skinPoint(p.clone(), v, rig, bent.duals);
      const b = skinPointAboutCentre(p.clone(), centre(v), cor.alpha[slot], v, rig, bent.duals, bent.transforms);
      expect(Number.isFinite(b.x + b.y + b.z)).toBe(true);
      // Displacement relative to DQS stays local and bounded (decimetres).
      expect(b.distanceTo(a)).toBeLessThan(0.6);
      if (p.x > 0 && p.distanceTo(knee) < 1.2) {
        // Furthest extent along the bent knee's anterior-inferior diagonal.
        const dir = new THREE.Vector3(0, -1, 1).normalize();
        dqsFront = Math.max(dqsFront, a.clone().sub(knee).dot(dir));
        corFront = Math.max(corFront, b.clone().sub(knee).dot(dir));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(500);
    expect(corFront).toBeLessThan(dqsFront);
  });

