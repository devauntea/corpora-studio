import * as THREE from "three";
import { armPose, type HumanBody } from "./domain";
import { deformBodyPoint } from "./body-fitting";

type Frame = { head: number[]; tail: number[] };
export type RigBone = {
  name: string;
  parent: number;
  average: Frame;
  fit: Frame;
};
export type HumanRig = {
  bones: RigBone[];
  offsets: Uint32Array;
  indices: Uint8Array;
  weights: Float32Array;
  chartRest: Float32Array;
};
export type RigMetadata = {
  bones: RigBone[];
  vertexCount: number;
  influenceCount: number;
  weightsOffset: number;
  chartRestOffset: number;
  byteLength: number;
  buffer: string;
};
/** The sidecar retains every nonzero source influence, including twist bones. */
export function decodeRig(
  meta: RigMetadata,
  buffer: ArrayBuffer,
  vertexCount: number,
): HumanRig {
  if (meta.vertexCount !== vertexCount || buffer.byteLength !== meta.byteLength)
    throw new Error("The body skeleton does not match this surface.");
  const rig = {
    bones: meta.bones,
    offsets: new Uint32Array(buffer, 0, vertexCount + 1),
    indices: new Uint8Array(buffer, (vertexCount + 1) * 4, meta.influenceCount),
    weights: new Float32Array(buffer, meta.weightsOffset, meta.influenceCount),
    chartRest: new Float32Array(buffer, meta.chartRestOffset, vertexCount * 3),
  };
  if (rig.offsets[vertexCount] !== meta.influenceCount)
    throw new Error("Invalid body skin weights.");
  for (let i = 0; i < vertexCount; i++) {
    let sum = 0;
    if (rig.offsets[i] >= rig.offsets[i + 1])
      throw new Error("Unweighted body vertex.");
    for (let j = rig.offsets[i]; j < rig.offsets[i + 1]; j++) {
      const w = rig.weights[j];
      if (rig.indices[j] >= rig.bones.length || !Number.isFinite(w) || w <= 0)
        throw new Error("Invalid body skin influence.");
      sum += w;
    }
    if (Math.abs(sum - 1) > 0.00001)
      throw new Error("Unnormalized body skin weights.");
  }
  const visited = new Set<number>(),
    active = new Set<number>();
  const visit = (i: number) => {
    if (visited.has(i)) return;
    if (i < 0 || i >= rig.bones.length || active.has(i))
      throw new Error("Invalid body bone hierarchy.");
    active.add(i);
    const b = rig.bones[i];
    if (
      ![
        ...b.average.head,
        ...b.average.tail,
        ...b.fit.head,
        ...b.fit.tail,
      ].every(Number.isFinite)
    )
      throw new Error("Invalid body joint position.");
    if (b.parent !== -1) visit(b.parent);
    active.delete(i);
    visited.add(i);
  };
  rig.bones.forEach((_, i) => visit(i));
  return rig;
}
const radians = THREE.MathUtils.degToRad;
const vector = (p: number[]) => new THREE.Vector3(p[0], p[1], p[2]);

/** Forward kinematics in the normalized mesh's bind frame. Joint helpers follow
 * the average/fit morph and body fitting; all skinning happens before body scale.
 * Rotations use bind-space axes, then inherit the parent's rigid transform. */
export function skeletonPose(rig: HumanRig, body: HumanBody, bindPose = false) {
  const byName = new Map(rig.bones.map((b, i) => [b.name, i]));
  const descendant = (i: number, name: string): boolean => {
    for (; i >= 0; i = rig.bones[i].parent)
      if (rig.bones[i].name === name) return true;
    return false;
  };
  const frames = rig.bones.map((b, i) => {
    const weights = [
      descendant(i, "upperarm01.L") ? 1 : 0,
      0,
      0,
      descendant(i, "upperarm01.R") ? 1 : 0,
      0,
      0,
    ];
    const point = (end: "head" | "tail") =>
      vector(
        deformBodyPoint(
          b.average[end].map(
            (v, k) => v + (b.fit[end][k] - v) * body.muscularity,
          ),
          weights,
          body.fitting,
        ),
      );
    return { head: point("head"), tail: point("tail") };
  });
  const rotations = rig.bones.map(() => new THREE.Quaternion());
  const z = new THREE.Vector3(0, 0, 1);
  const set = (name: string, axis: THREE.Vector3, degrees: number) => {
    const i = byName.get(name);
    if (i !== undefined)
      rotations[i].multiply(
        new THREE.Quaternion().setFromAxisAngle(axis, radians(degrees)),
      );
  };
  if (!bindPose && body.section !== "upper-body")
    for (const [side, sign] of [
      ["L", 1],
      ["R", -1],
    ] as const) {
      if (body.section === "full-leg") {
        // +X sends the shank toward the posterior (-Z), unlike an elbow bend.
        set(`lowerleg01.${side}`, new THREE.Vector3(1, 0, 0), body.flex);
        continue;
      }
      const pose = armPose(body, side === "L" ? "left" : "right");
      const upper = frames[byName.get(`upperarm01.${side}`)!].head;
      const elbow = frames[byName.get(`lowerarm01.${side}`)!].head;
      const arm = elbow.clone().sub(upper).normalize();
      const baseline = THREE.MathUtils.radToDeg(
        Math.atan2(Math.abs(arm.x), -arm.y),
      );
      const clavicle =
        body.section === "full-body" ? Math.max(0, pose.raise - 30) * 0.22 : 0;
      set(`clavicle.${side}`, z, sign * clavicle);
      set(`upperarm01.${side}`, z, sign * (pose.raise - baseline - clavicle));
      const hinge = new THREE.Vector3(arm.y, -arm.x, 0).normalize();
      if (body.musclePose === "double-biceps") {
        // Rotate the humerus and its skin, not just the elbow's hinge axis.
        // Two segments spread external rotation through the upper arm.
        set(`upperarm01.${side}`, arm, -sign * 45);
        set(`upperarm02.${side}`, arm, -sign * 45);
      }
      set(`lowerarm01.${side}`, hinge, pose.flex);
      // Pronation/supination is distributed across the two forearm segments.
      set(`lowerarm01.${side}`, arm, sign * pose.twist * 0.5);
      set(`lowerarm02.${side}`, arm, sign * pose.twist * 0.5);
    }
  const transforms: (THREE.Matrix4 | undefined)[] = new Array(rig.bones.length);
  const resolve = (i: number): THREE.Matrix4 => {
    if (transforms[i]) return transforms[i]!;
    const p = frames[i].head;
    const local = new THREE.Matrix4()
      .makeTranslation(p.x, p.y, p.z)
      .multiply(new THREE.Matrix4().makeRotationFromQuaternion(rotations[i]))
      .multiply(new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z));
    return (transforms[i] =
      rig.bones[i].parent < 0
        ? local
        : resolve(rig.bones[i].parent).clone().multiply(local));
  };
  const duals = new Float64Array(rig.bones.length * 8);
  rig.bones.forEach((_, i) => {
    const m = resolve(i),
      q = new THREE.Quaternion().setFromRotationMatrix(m),
      e = m.elements;
    const d = new THREE.Quaternion(e[12], e[13], e[14], 0).multiply(q);
    duals.set([q.x, q.y, q.z, q.w, d.x / 2, d.y / 2, d.z / 2, d.w / 2], i * 8);
  });
  return { duals, frames, transforms: transforms as THREE.Matrix4[] };
}

/** Normalized, antipodality-correct dual-quaternion blend (Kavan et al. 2007).
 * Preserves rigid rotations at a joint without linear-blend volume collapse. */
export function skinPoint(
  p: THREE.Vector3,
  vertex: number,
  rig: HumanRig,
  duals: Float64Array,
) {
  const start = rig.offsets[vertex],
    end = rig.offsets[vertex + 1],
    ref = rig.indices[start] * 8;
  let x = 0,
    y = 0,
    z = 0,
    w = 0,
    dx = 0,
    dy = 0,
    dz = 0,
    dw = 0;
  for (let j = start; j < end; j++) {
    const b = rig.indices[j] * 8;
    const sign =
      duals[ref] * duals[b] +
        duals[ref + 1] * duals[b + 1] +
        duals[ref + 2] * duals[b + 2] +
        duals[ref + 3] * duals[b + 3] <
      0
        ? -1
        : 1;
    const weight = rig.weights[j] * sign;
    x += duals[b] * weight;
    y += duals[b + 1] * weight;
    z += duals[b + 2] * weight;
    w += duals[b + 3] * weight;
    dx += duals[b + 4] * weight;
    dy += duals[b + 5] * weight;
    dz += duals[b + 6] * weight;
    dw += duals[b + 7] * weight;
  }
  const norm = Math.hypot(x, y, z, w);
  x /= norm;
  y /= norm;
  z /= norm;
  w /= norm;
  dx /= norm;
  dy /= norm;
  dz /= norm;
  dw /= norm;
  const tx = 2 * (y * p.z - z * p.y),
    ty = 2 * (z * p.x - x * p.z),
    tz = 2 * (x * p.y - y * p.x);
  return p.set(
    p.x + w * tx + y * tz - z * ty + 2 * (-dw * x + dx * w - dy * z + dz * y),
    p.y + w * ty + z * tx - x * tz + 2 * (-dw * y + dx * z + dy * w - dz * x),
    p.z + w * tz + x * ty - y * tx + 2 * (-dw * z - dx * y + dy * x + dz * w),
  );
}

/** Centres of rotation for elbow/knee transition vertices (revision 7+). */
export type CentersOfRotation = {
  slot: Int32Array;
  average: Float32Array;
  fit: Float32Array;
  alpha: Float32Array;
};
export function decodeCentersOfRotation(
  buffer: ArrayBuffer,
  vertexCount: number,
): CentersOfRotation {
  const count = new Uint32Array(buffer, 0, 1)[0];
  if (buffer.byteLength !== 4 + count * 32)
    throw new Error("The joint correctives do not match this body.");
  const vertices = new Uint32Array(buffer, 4, count);
  const average = new Float32Array(buffer, 4 + count * 4, count * 3);
  const fit = new Float32Array(buffer, 4 + count * 16, count * 3);
  const alpha = new Float32Array(buffer, 4 + count * 28, count);
  const slot = new Int32Array(vertexCount).fill(-1);
  vertices.forEach((v, k) => {
    if (v >= vertexCount || slot[v] !== -1)
      throw new Error("Invalid joint corrective vertex.");
    slot[v] = k;
  });
  for (let k = 0; k < count; k++)
    if (!(alpha[k] >= 0 && alpha[k] <= 1))
      throw new Error("Invalid joint corrective weight.");
  if (![...average, ...fit].every(Number.isFinite))
    throw new Error("Invalid joint corrective centre.");
  return { slot, average, fit, alpha };
}

const blended = new THREE.Quaternion(),
  lbsCentre = new THREE.Vector3(),
  term = new THREE.Vector3(),
  dqResult = new THREE.Vector3();
/** Optimized-centre-of-rotation skinning (Le & Hodgins 2016): rotate about the
 * vertex's centre with the normalized blended rotation, translate that centre
 * by linear blending. Feathered into DQS by `alpha`. Removes DQS joint bulge
 * without linear-blend collapse. `centre` must be in the same bind space as p. */
export function skinPointAboutCentre(
  p: THREE.Vector3,
  centre: THREE.Vector3,
  alpha: number,
  vertex: number,
  rig: HumanRig,
  duals: Float64Array,
  transforms: THREE.Matrix4[],
) {
  dqResult.copy(p);
  skinPoint(dqResult, vertex, rig, duals);
  if (alpha <= 0) return p.copy(dqResult);
  const start = rig.offsets[vertex],
    end = rig.offsets[vertex + 1],
    ref = rig.indices[start] * 8;
  let x = 0,
    y = 0,
    z = 0,
    w = 0;
  lbsCentre.set(0, 0, 0);
  for (let j = start; j < end; j++) {
    const bone = rig.indices[j],
      b = bone * 8,
      weight = rig.weights[j];
    const sign =
      duals[ref] * duals[b] +
        duals[ref + 1] * duals[b + 1] +
        duals[ref + 2] * duals[b + 2] +
        duals[ref + 3] * duals[b + 3] <
      0
        ? -weight
        : weight;
    x += duals[b] * sign;
    y += duals[b + 1] * sign;
    z += duals[b + 2] * sign;
    w += duals[b + 3] * sign;
    lbsCentre.addScaledVector(
      term.copy(centre).applyMatrix4(transforms[bone]),
      weight,
    );
  }
  blended.set(x, y, z, w).normalize();
  p.sub(centre).applyQuaternion(blended).add(lbsCentre);
  return p.lerpVectors(dqResult, p, alpha);
}
