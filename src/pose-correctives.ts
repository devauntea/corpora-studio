import { muscleParent } from "./muscles";
import * as THREE from "three";
import { armPose, type HumanBody } from "./domain";
import type { HumanRig } from "./skeleton";
const smooth = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Authored soft-tissue correction on the registered muscle field. This is a
 * bounded visual contraction, not a physiological or skin-strain simulation.
 * Apply in bind space, before skeleton deformation, to keep decals attached. */
export function muscleCorrector(
  rig: HumanRig,
  influences: Uint8Array | undefined,
  body: HumanBody,
) {
  const joints = (["L", "R"] as const).map((side) => {
    const head = (name: string) => {
      const b = rig.bones.find((b) => b.name === `${name}.${side}`)!;
      return new THREE.Vector3(
        ...(b.average.head as [number, number, number]),
      ).lerp(
        new THREE.Vector3(...(b.fit.head as [number, number, number])),
        body.muscularity,
      );
    };
    const shoulder = head("upperarm01"),
      elbow = head("lowerarm01"),
      axis = elbow.clone().sub(shoulder),
      length = axis.length();
    axis.divideScalar(length);
    return {
      shoulder,
      axis,
      length,
      flex: armPose(body, side === "L" ? "left" : "right").flex,
    };
  });
  const armBones = rig.bones.map((_, i) => {
    for (; i >= 0; i = rig.bones[i].parent)
      if (/^upperarm01\.[LR]$/.test(rig.bones[i].name)) return true;
    return false;
  });
  const tensor =
    (body.muscleTension ?? 0.8) * (body.model?.sex === "female" ? 0.66 : 1);
  const physique = 0.35 + 0.65 * body.muscularity;
  const offset = new THREE.Vector3(),
    radial = new THREE.Vector3();
  return (p: THREE.Vector3, vertex: number) => {
    if (!influences) return p;
    let biceps = 0,
      triceps = 0,
      pec = 0,
      lat = 0,
      trap = 0;
    for (let k = 0; k < 4; k++) {
      const id = muscleParent(influences[vertex * 8 + k]),
        w = influences[vertex * 8 + 4 + k] / 255;
      if (id === 9) biceps += w;
      if (id === 10) triceps += w;
      if (id === 0) pec += w;
      if (id === 5) lat += w;
      if (id === 4) trap += w;
    }
    const j = joints[p.x >= 0 ? 0 : 1];
    if (
      body.section !== "upper-body" &&
      body.section !== "full-leg" &&
      j.flex > 0 &&
      (biceps || triceps)
    ) {
      offset.copy(p).sub(j.shoulder);
      const along = offset.dot(j.axis),
        t = along / j.length;
      radial.copy(offset).addScaledVector(j.axis, -along);
      const ends = smooth(0.14, 0.34, t) * (1 - smooth(0.78, 0.99, t));
      let armWeight = 0;
      for (let j = rig.offsets[vertex]; j < rig.offsets[vertex + 1]; j++)
        if (armBones[rig.indices[j]]) armWeight += rig.weights[j];
      const region = smooth(0.15, 0.75, armWeight);
      const bend =
        Math.sin(THREE.MathUtils.degToRad(j.flex) * 0.5) *
        tensor *
        physique *
        ends *
        region;
      // Shorten the biceps along its fibers; expand its section to retain volume.
      const contraction = 0.34 * bend * biceps;
      const extension = 0.06 * bend * triceps;
      const longitudinal = 1 - contraction + extension;
      p.addScaledVector(j.axis, (along - j.length * 0.57) * (longitudinal - 1));
      p.addScaledVector(radial, 1 / Math.sqrt(longitudinal) - 1);
    }
    if (
      ["upper-body", "full-body"].includes(body.section) &&
      body.musclePose &&
      body.musclePose !== "relaxed"
    ) {
      const boundary = smooth(1.2, 2, p.y) * (1 - smooth(5.8, 6.2, p.y));
      const face =
        body.musclePose === "chest-flex"
          ? smooth(0.25, 0.85, p.z)
          : 1 - smooth(-0.85, -0.25, p.z);
      const amount = tensor * physique * boundary * face;
      if (body.musclePose === "chest-flex") {
        p.x *= 1 - 0.035 * pec * amount;
        p.y += 0.045 * pec * amount;
        p.z += 0.095 * pec * amount;
      } else {
        p.x *= 1 + 0.065 * lat * amount;
        p.z -= (0.075 * lat + 0.045 * trap) * amount;
        p.y += 0.025 * trap * amount;
      }
    }
    return p;
  };
}
