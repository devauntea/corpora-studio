import type { ArmPose, HumanBody } from "./domain";

export type MusclePose = NonNullable<HumanBody["musclePose"]>;
const bell = (value: number, radius: number) =>
  Math.exp(-Math.min(80, (value / radius) ** 2));
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Artist-authored contraction correctives in rest-space decimeters.
 * UVs and atlas identities are unchanged. These are visual pose studies,
 * not a force-driven muscle or skin-strain simulation. */
export function flexTorso(
  point: number[],
  weights: number[],
  body: HumanBody,
): number[] {
  const pose = body.musclePose;
  if (
    (body.model?.revision ?? 0) < 5 ||
    !pose ||
    pose === "relaxed" ||
    !["upper-body", "full-body"].includes(body.section)
  )
    return point;
  const [x, y, z] = point,
    ax = Math.abs(x),
    sign = Math.sign(x);
  const arm = Math.max(weights[0], weights[3]);
  const trunk =
    (1 - smooth(0.08, 0.55, arm)) *
    smooth(0.75, 1.4, y) *
    (1 - smooth(6.25, 6.85, y));
  const amount =
    (body.muscleTension ?? 0.8) *
    (0.32 + 0.68 * body.muscularity) *
    (body.model!.sex === "female" ? 0.66 : 1) *
    trunk;
  if (!amount) return point;
  const front = smooth(0.25, 0.85, z),
    back = 1 - smooth(-0.65, -0.15, z);
  let dx = 0,
    dy = 0,
    dz = 0;
  if (pose === "chest-flex") {
    const pec = bell(ax - 0.9, 0.7) * bell(y - 5.13, 0.55);
    dz += 0.15 * pec * front;
    dy += 0.045 * pec * front;
    dx -= sign * 0.032 * bell(ax - 1.3, 0.45) * bell(y - 5.05, 0.54) * front;
    dz += 0.035 * bell(ax - 0.39, 0.33) * bell(y - 3.3, 1.12) * front;
    // Retraction changes the back and upper rib-cage silhouette too.
    dz -= 0.03 * bell(ax - 0.77, 0.52) * bell(y - 5.25, 0.65) * back;
  } else {
    const lat = bell(y - 4.1, 1.05) * bell(ax - 1.2, 0.53);
    dx += sign * 0.11 * bell(y - 4.25, 0.95) * smooth(0.65, 1.6, ax) * back;
    dz -=
      (0.13 * lat +
        0.08 * bell(ax - 0.43, 0.36) * bell(y - 5.45, 0.85) +
        0.06 * bell(ax - 1.05, 0.33) * bell(y - 5.0, 0.46) +
        0.04 * bell(ax - 0.28, 0.15) * bell(y - 3.45, 1.3)) *
      back;
    dy += 0.03 * bell(ax - 0.85, 0.75) * bell(y - 5.35, 0.75) * back;
    dz += 0.025 * bell(ax - 0.85, 0.75) * bell(y - 5.2, 0.6) * front;
  }
  return [x + dx * amount, y + dy * amount, z + dz * amount];
}

export function musclePoseArms(pose: MusclePose): {
  left: ArmPose;
  right: ArmPose;
} {
  const arm =
    pose === "double-biceps"
      ? { flex: 105, raise: 78, twist: 0 }
      : pose === "chest-flex"
        ? { flex: 65, raise: 22, twist: 30 }
        : pose === "back-flex"
          ? { flex: 70, raise: 50, twist: -20 }
          : { flex: 0, raise: 0, twist: 0 };
  return { left: { ...arm }, right: { ...arm } };
}
