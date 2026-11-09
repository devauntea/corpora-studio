import {
  loadSculpt,
  sculptGeometry,
  sculptMaterial,
  sculptRotation,
  type SculptMesh,
} from "./sculpt-surface";
import { detailedMuscleGroups } from "./muscles";
import { loadSkinMicrodetail } from "./skin-microdetail";
import { deformBodyPoint } from "./body-fitting";
import { flexTorso } from "./muscle-pose";
import { muscleCorrector } from "./pose-correctives";
import { SurfaceDecals } from "./surface-decals";
import {
  decodeCentersOfRotation,
  decodeRig,
  skeletonPose,
  skinPoint,
  skinPointAboutCentre,
  type CentersOfRotation,
  type HumanRig,
} from "./skeleton";
import * as THREE from "three";
import {
  addSculptedSurfaceDetail,
  type DetailLandmarks,
} from "./surface-detail";
import {
  bodyZones,
  armPose,
  humanChartSize,
  humanScale,
  layerZone,
  type HumanBody,
  type Layer,
  type SurfaceZone,
} from "./domain";

export type HumanMeshData = {
  sculpt?: SculptMesh;
  vertices: number[][];
  muscleColors?: Uint8Array;
  muscleIds?: Uint8Array;
  muscleInfluences?: Uint8Array;
  skinOcclusion?: Uint8Array;
  rig?: HumanRig;
  centers?: CentersOfRotation;
  detailLandmarks?: DetailLandmarks;
  parts: number[][];
  sectionLegs?: number[][];
  sectionTorso?: number[];
  joints: Record<
    "L" | "R",
    Record<"shoulder" | "elbow" | "wrist" | "hip" | "knee" | "ankle", number[]>
  >;
};
const sources = new Map<string, Promise<HumanMeshData>>();
export function loadHuman(body?: HumanBody): Promise<HumanMeshData> {
  if (body?.model?.sculptId)
    return loadSculpt(
      body.model.sculptId,
      body.model.sculptAppearance === "skin",
    );
  const name = body?.model
    ? `human-v${body.model.revision}-${body.model.sex}`
    : "human-v1";
  if (!sources.has(name))
    sources.set(
      name,
      (async () => {
        const r = await fetch(`/anatomy/${name}.json`);
        if (!r.ok) throw new Error("The bundled human mesh could not load.");
        const meta = await r.json();
        if (!meta.buffer) return meta as HumanMeshData;
        const response = await fetch(`/anatomy/${meta.buffer}`);
        if (!response.ok)
          throw new Error("The detailed body buffer could not load.");
        const buffer = await response.arrayBuffer();
        const floats = new Float32Array(buffer, 0, meta.vertexCount * 12);
        const indices = new Uint32Array(buffer, meta.vertexCount * 12 * 4);
        const vertices = Array.from({ length: meta.vertexCount }, (_, i) =>
          Array.from(floats.subarray(i * 12, i * 12 + 12)),
        );
        let offset = 0;
        const parts = meta.partCounts.map((n: number) => {
          const p = Array.from(indices.subarray(offset, offset + n));
          offset += n;
          return p;
        });
        const fieldResponse = await fetch(
          `/anatomy/muscle-field-v${body!.model!.revision}-${body!.model!.sex}.bin`,
        );
        if (!fieldResponse.ok)
          throw new Error("The muscle atlas could not load.");
        const field = new Uint8Array(await fieldResponse.arrayBuffer());
        const sculpted = body!.model!.revision >= 3;
        if (field.length !== meta.vertexCount * (sculpted ? 12 : 4))
          throw new Error("The muscle atlas does not match this body.");
        let skinOcclusion: Uint8Array | undefined;
        let rig: HumanRig | undefined;
        let centers: CentersOfRotation | undefined;
        if (body!.model!.revision >= 6) {
          if (!meta.rig) throw new Error("This body is missing its skeleton.");
          const rigMetaResponse = await fetch(`/anatomy/${meta.rig}`);
          if (!rigMetaResponse.ok)
            throw new Error("The body skeleton could not load.");
          const rigMeta = await rigMetaResponse.json();
          const rigResponse = await fetch(`/anatomy/${rigMeta.buffer}`);
          if (!rigResponse.ok)
            throw new Error("The body skin weights could not load.");
          rig = decodeRig(
            rigMeta,
            await rigResponse.arrayBuffer(),
            meta.vertexCount,
          );
          if (meta.centersOfRotation) {
            const corResponse = await fetch(
              `/anatomy/${meta.centersOfRotation.buffer}`,
            );
            if (!corResponse.ok)
              throw new Error("The joint correctives could not load.");
            centers = decodeCentersOfRotation(
              await corResponse.arrayBuffer(),
              meta.vertexCount,
            );
          }
        }
        if (meta.occlusion) {
          const response = await fetch(`/anatomy/${meta.occlusion.buffer}`);
          if (!response.ok)
            throw new Error("The skin detail field could not load.");
          skinOcclusion = new Uint8Array(await response.arrayBuffer());
          if (skinOcclusion.length !== meta.vertexCount * 2)
            throw new Error("The skin detail field does not match this body.");
        }
        if (body!.model!.revision >= 8) await loadSkinMicrodetail();
        return {
          vertices,
          parts: meta.sectionLegParts ? parts.slice(0, 6) : parts,
          sectionLegs: meta.sectionLegParts ? parts.slice(6, 8) : undefined,
          sectionTorso: meta.sectionTorsoPart ? parts[8] : undefined,
          joints: meta.joints,
          muscleColors: field.subarray(0, meta.vertexCount * 3),
          muscleIds: field.subarray(meta.vertexCount * 3, meta.vertexCount * 4),
          muscleInfluences: sculpted
            ? field.subarray(meta.vertexCount * 4)
            : undefined,
          skinOcclusion,
          rig,
          centers,
          detailLandmarks: meta.detailLandmarks,
        };
      })().catch((e) => {
        sources.delete(name);
        throw e;
      }),
    );
  return sources.get(name)!;
}
const zones: SurfaceZone[] = [
  "trunk",
  "left-arm",
  "right-arm",
  "left-leg",
  "right-leg",
  "neck",
];
const vector = (p: number[]) =>
  new THREE.Vector3(...(p as [number, number, number]));

/** Match the categorical muscle selected by the shader at the hit point. */
export function muscleAtHit(hit: THREE.Intersection): number | undefined {
  if (!hit.face) return undefined;
  const mesh = hit.object as THREE.Mesh,
    geometry = mesh.geometry;
  const palette = geometry.getAttribute("musclePalette"),
    weights = geometry.getAttribute("muscleWeights");
  if (!palette || !weights)
    return geometry.getAttribute("muscleId")?.getX(hit.face.a);
  const position = geometry.getAttribute("position"),
    { a, b, c } = hit.face;
  const bary = THREE.Triangle.getBarycoord(
    mesh.worldToLocal(hit.point.clone()),
    new THREE.Vector3().fromBufferAttribute(position, a),
    new THREE.Vector3().fromBufferAttribute(position, b),
    new THREE.Vector3().fromBufferAttribute(position, c),
    new THREE.Vector3(),
  );
  if (!bary) return undefined;
  let best = 0,
    maximum = -1;
  for (let k = 0; k < 4; k++) {
    const weight =
      weights.getComponent(a, k) * bary.x +
      weights.getComponent(b, k) * bary.y +
      weights.getComponent(c, k) * bary.z;
    if (weight > maximum) {
      maximum = weight;
      best = k;
    }
  }
  const group = palette.getComponent(a, best);
  return group !== 36 && detailedMuscleGroups[group] ? group : undefined;
}

export function humanGeometries(data: HumanMeshData, body: HumanBody) {
  if (data.sculpt) return sculptGeometry(data, body);
  const torsoOnly =
    (body.model?.revision ?? 0) >= 5 && body.section === "upper-body";
  const part = (zone: SurfaceZone) =>
    torsoOnly && zone === "trunk" && data.sectionTorso
      ? data.sectionTorso
      : body.section === "full-leg" && data.sectionLegs
        ? data.sectionLegs[zone.startsWith("left") ? 0 : 1]
        : data.parts[zones.indexOf(zone)];
  const scale = humanScale(body);
  const points: THREE.Vector3[] = [],
    rests: THREE.Vector3[] = [];
  const joints = data.joints;
  const isLeg = body.section === "full-leg";
  const rigs = (
    [
      ["L", 6, 1],
      ["R", 9, -1],
    ] as const
  ).map(([side, k, sign]) => {
    const j = joints[side],
      shoulder = vector(j.shoulder),
      elbow = vector(j.elbow),
      knee = vector(j.knee);
    const armAxis = elbow.clone().sub(shoulder).normalize();
    const pose = armPose(body, side === "L" ? "left" : "right");
    return {
      k,
      shoulder,
      elbow,
      knee,
      armAxis,
      upperLength: elbow.distanceTo(shoulder),
      flexAxis: isLeg
        ? new THREE.Vector3(-1, 0, 0)
        : new THREE.Vector3(armAxis.y, -armAxis.x, 0)
            .normalize()
            .applyAxisAngle(
              armAxis,
              (body.model?.revision ?? 0) >= 5 &&
                body.musclePose === "double-biceps"
                ? (-sign * Math.PI) / 2
                : 0,
            ),
      flex: THREE.MathUtils.degToRad(isLeg ? body.flex : pose.flex),
      twist: THREE.MathUtils.degToRad(sign * pose.twist),
      raise: THREE.MathUtils.degToRad(sign * (pose.raise - 20)),
    };
  });
  const zAxis = new THREE.Vector3(0, 0, 1);
  const skeleton =
    data.rig && (body.model?.revision ?? 0) >= 6
      ? skeletonPose(data.rig, body)
      : undefined;
  const centre = new THREE.Vector3();
  const correctMuscle = skeleton
    ? muscleCorrector(data.rig!, data.muscleInfluences, body)
    : undefined;
  for (let vertex = 0; vertex < data.vertices.length; vertex++) {
    const v = data.vertices[vertex];
    const rest = vector(v),
      p = vector(
        deformBodyPoint(
          (skeleton ? (p: number[]) => p : flexTorso)(
            rest
              .clone()
              .addScaledVector(vector(v.slice(3, 6)), body.muscularity)
              .toArray(),
            v.slice(6),
            body,
          ),
          v.slice(6),
          body.fitting,
        ),
      );
    rests.push(
      data.rig && skeleton
        ? new THREE.Vector3().fromArray(data.rig.chartRest, vertex * 3)
        : rest,
    );
    if (skeleton) {
      correctMuscle!(p, vertex);
      const slot = data.centers ? data.centers.slot[vertex] : -1;
      if (slot >= 0) {
        // Same bind space as p: morph, then personal fitting.
        const c = data.centers!,
          k = slot * 3,
          m = body.muscularity;
        centre.fromArray(
          deformBodyPoint(
            [0, 1, 2].map(
              (i) => c.average[k + i] + (c.fit[k + i] - c.average[k + i]) * m,
            ),
            v.slice(6),
            body.fitting,
          ),
        );
        skinPointAboutCentre(
          p,
          centre,
          c.alpha[slot],
          vertex,
          data.rig!,
          skeleton.duals,
          skeleton.transforms,
        );
      } else skinPoint(p, vertex, data.rig!, skeleton.duals);
    } else
      for (const rig of rigs) {
        if (torsoOnly) continue;
        const {
          k,
          shoulder,
          elbow,
          knee,
          armAxis,
          flexAxis,
          flex,
          twist,
          raise,
        } = rig;
        if (body.model && !isLeg && v[k] > 0.1 && flex > 0) {
          // Small artistic pose corrective, not a force/skin-strain simulation.
          const offset = p.clone().sub(shoulder),
            along = offset.dot(armAxis),
            t = along / rig.upperLength;
          const radial = offset.addScaledVector(armAxis, -along);
          if (t > 0 && t < 1 && radial.z > 0)
            p.addScaledVector(
              radial,
              Math.sin(flex) *
                0.055 *
                body.muscularity *
                Math.exp(-(((t - 0.55) / 0.25) ** 2)) *
                v[k],
            );
        }
        if (!isLeg)
          blendJoint(p, elbow, armAxis, twist, v[k + 1], !!body.model);
        blendJoint(
          p,
          isLeg ? knee : elbow,
          flexAxis,
          flex,
          v[k + (isLeg ? 2 : 1)],
          !!body.model,
        );
        if (!isLeg) {
          // A detached arm rotates as a whole at the shoulder. Blending that
          // rotation into an absent torso bends its cut rim and folds the cap.
          const weight =
            (body.model?.revision ?? 0) >= 5 && body.section === "full-arm"
              ? body.side === (k === 6 ? "left" : "right")
                ? 1
                : 0
              : v[k];
          blendJoint(p, shoulder, zAxis, raise, weight, !!body.model);
        }
      }
    p.x *= body.build;
    p.z *= body.build;
    points.push(p.multiplyScalar(scale));
  }
  const selected = bodyZones(body);
  const centerBounds = new THREE.Box3();
  // Framing remains fixed across poses and morphs, so changing flex does not move the whole model.
  for (const zone of selected)
    for (const i of part(zone)) {
      const p = rests[i].clone();
      if (zone.endsWith("arm")) {
        const sign = zone.startsWith("left") ? 1 : -1,
          j = joints[sign === 1 ? "L" : "R"],
          sh = vector(j.shoulder);
        p.sub(sh)
          .applyAxisAngle(new THREE.Vector3(0, 0, 1), (-sign * Math.PI) / 9)
          .add(sh);
      }
      centerBounds.expandByPoint(p.multiplyScalar(scale));
    }
  const center = centerBounds.getCenter(new THREE.Vector3());
  points.forEach((p) => p.sub(center));
  // Shared normals are computed before splitting UV charts; shoulder seams stay smooth.
  const whole = new THREE.BufferGeometry();
  whole.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      points.flatMap((p) => p.toArray()),
      3,
    ),
  );
  whole.setIndex(
    torsoOnly && data.sectionTorso
      ? [...data.sectionTorso, ...data.parts[5]]
      : body.section === "full-leg" && data.sectionLegs
        ? data.sectionLegs.flat()
        : data.parts.flat(),
  );
  whole.computeVertexNormals();
  const normals = whole.getAttribute("normal");
  const result = selected.map((zone) => {
    const positions: number[] = [],
      occlusion: number[] = [],
      uv: number[] = [],
      ns: number[] = [],
      colors: number[] = [],
      restPositions: number[] = [],
      muscleIds: number[] = [],
      musclePalette: number[] = [],
      muscleWeights: number[] = [],
      sourceIds: number[] = [];
    const indices = part(zone);
    const side = zone.startsWith("right") ? "R" : "L",
      j = joints[side];
    const arm = zone.endsWith("arm"),
      leg = zone.endsWith("leg");
    const start = vector(arm ? j.shoulder : j.hip),
      end = vector(arm ? j.wrist : j.ankle);
    const axis = end.clone().sub(start).normalize();
    const front = new THREE.Vector3(0, 0, 1)
      .addScaledVector(axis, -axis.z)
      .normalize();
    const lateral = new THREE.Vector3()
      .crossVectors(axis, front)
      .negate()
      .normalize();
    const chart = (i: number): [number, number] => {
      const p = rests[i];
      if (zone === "neck")
        return [
          0.5 + Math.atan2(p.x, p.z + 0.15) / (Math.PI * 2),
          (p.y - 6) / ((body.model?.revision ?? 0) >= 5 ? 1 : 1.4),
        ];
      if (!arm && !leg)
        return [
          0.5 + Math.atan2(p.x, p.z + 0.15) / (Math.PI * 2),
          (body.model?.revision ?? 0) >= 5
            ? (p.y - 0.6) / 6.4
            : (body.model?.revision ?? 0) >= 4
              ? (p.y - 0.6) / 5.4
              : body.model
                ? (p.y - 1.2) / 5.7
                : (p.y - 1.5) / 5.5,
        ];
      const q = p.clone().sub(start),
        along = q.dot(axis),
        offset = q.addScaledVector(axis, -along);
      return [
        0.5 +
          Math.atan2(offset.dot(lateral), offset.dot(front)) / (Math.PI * 2),
        1 - (along + 0.25) / (arm ? 7.9 : 9),
      ];
    };
    for (let t = 0; t < indices.length; t += 3) {
      const ids = indices.slice(t, t + 3),
        tex = ids.map(chart);
      const influences = data.muscleInfluences;
      const candidates = new Map<number, number>();
      if (influences)
        for (const i of ids)
          for (let k = 0; k < 4; k++) {
            const id = influences[i * 8 + k],
              weight = influences[i * 8 + 4 + k];
            if (weight) candidates.set(id, (candidates.get(id) ?? 0) + weight);
          }
      const palette = [...candidates]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([id]) => id);
      while (palette.length < 4) palette.push(36);
      const seam =
        Math.max(...tex.map((t) => t[0])) - Math.min(...tex.map((t) => t[0])) >
        0.5;
      for (let c = 0; c < 3; c++) {
        const i = ids[c];
        positions.push(...points[i].toArray());
        occlusion.push(
          data.skinOcclusion
            ? (data.skinOcclusion[i * 2] * (1 - body.muscularity) +
                data.skinOcclusion[i * 2 + 1] * body.muscularity) /
                255
            : 1,
        );
        sourceIds.push(i);
        if (data.muscleColors) {
          const color = new THREE.Color().setRGB(
            data.muscleColors[i * 3] / 255,
            data.muscleColors[i * 3 + 1] / 255,
            data.muscleColors[i * 3 + 2] / 255,
            THREE.SRGBColorSpace,
          );
          colors.push(color.r, color.g, color.b);
          restPositions.push(
            ...rests[i]
              .toArray()
              .map(
                (v, c) =>
                  v +
                  ((body.model?.revision ?? 0) >= 3
                    ? data.vertices[i][c + 3] * 0.6
                    : 0),
              ),
          );
          muscleIds.push(data.muscleIds![i]);
          if (influences) {
            const weights = palette.map((id, slot) => {
              if (palette.indexOf(id) !== slot) return 0;
              let weight = 0;
              for (let k = 0; k < 4; k++)
                if (influences[i * 8 + k] === id)
                  weight += influences[i * 8 + 4 + k];
              return weight;
            });
            const total = weights.reduce((sum, w) => sum + w, 0) || 1;
            musclePalette.push(...palette);
            muscleWeights.push(...weights.map((w) => w / total));
          }
        }
        ns.push(normals.getX(i), normals.getY(i), normals.getZ(i));
        uv.push(tex[c][0] + (seam && tex[c][0] < 0.5 ? 1 : 0), tex[c][1]);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(ns, 3));
    g.setAttribute(
      "skinOcclusion",
      new THREE.Float32BufferAttribute(occlusion, 1),
    );
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute(
      "sourceIndex",
      new THREE.Uint32BufferAttribute(sourceIds, 1),
    );
    if (colors.length) {
      g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      g.setAttribute(
        "restPosition",
        new THREE.Float32BufferAttribute(restPositions, 3),
      );
      g.setAttribute(
        "muscleId",
        new THREE.Float32BufferAttribute(muscleIds, 1),
      );
      if (musclePalette.length) {
        g.setAttribute(
          "musclePalette",
          new THREE.Float32BufferAttribute(musclePalette, 4),
        );
        g.setAttribute(
          "muscleWeights",
          new THREE.Float32BufferAttribute(muscleWeights, 4),
        );
      }
    }
    g.computeBoundingSphere();
    return { zone, geometry: g };
  });
  whole.dispose();
  return result;
}

export const muscleGuide: Record<string, [string, string][]> = {
  "full-arm": [
    ["Deltoid", "Fans over the shoulder cap"],
    ["Biceps / triceps", "Long upper-arm flow; front / back"],
    ["Forearm flexors / extensors", "Taper toward the wrist"],
    ["Elbow crease", "Check relaxed and bent views"],
  ],
  "upper-body": [
    ["Pectoralis major", "Fans from sternum toward upper arm"],
    ["Rectus abdominis", "Vertical abdominal columns"],
    ["External oblique", "Diagonal flow along the flank"],
    ["Trapezius / latissimus", "Upper back fan and lower side sweep"],
  ],
  "full-leg": [
    ["Quadriceps", "Long anterior thigh flow"],
    ["Hamstrings", "Long posterior thigh flow"],
    ["Gastrocnemius", "Paired calf bellies taper to Achilles"],
    ["Knee crease", "Check relaxed and bent views"],
  ],
};
// Schematic superficial muscle footprints, authored in each surface chart.
// Guides illustrate direction; they are not segmented medical anatomy or a skin-strain simulation.
export function drawMuscleGuide(
  ctx: CanvasRenderingContext2D,
  zone: SurfaceZone,
  size: number,
) {
  ctx.save();
  ctx.scale(size, size);
  const muscle = (
    u: number,
    v: number,
    w: number,
    h: number,
    label: string,
    tilt = 0,
    shape: "muscle" | "block" = "muscle",
  ) => {
    for (const repeat of [-1, 0, 1]) {
      ctx.save();
      ctx.translate(u + repeat, 1 - v);
      const pectoral = label === "PECTORAL",
        sign = tilt < 0 ? -1 : 1;
      if (!pectoral) ctx.rotate(tilt);
      ctx.beginPath();
      if (shape === "block")
        ctx.roundRect(-w * 0.48, -h * 0.43, w * 0.96, h * 0.86, w * 0.18);
      else if (pectoral) {
        ctx.moveTo(-sign * w * 0.48, -h * 0.4);
        ctx.bezierCurveTo(
          sign * w * 0.05,
          -h * 0.53,
          sign * w * 0.35,
          -h * 0.32,
          sign * w * 0.48,
          -h * 0.16,
        );
        ctx.bezierCurveTo(
          sign * w * 0.3,
          h * 0.25,
          -sign * w * 0.12,
          h * 0.43,
          -sign * w * 0.48,
          h * 0.4,
        );
        ctx.closePath();
      } else {
        ctx.moveTo(0, -h / 2);
        ctx.bezierCurveTo(w * 0.75, -h * 0.32, w * 0.55, h * 0.2, 0, h / 2);
        ctx.bezierCurveTo(-w * 0.55, h * 0.2, -w * 0.75, -h * 0.32, 0, -h / 2);
      }
      ctx.fillStyle = "#acacac";
      ctx.fill();
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 0.0015;
      ctx.stroke();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = "#dadada";
      ctx.lineWidth = 0.0009;
      for (let f = -6; f <= 6; f++) {
        ctx.beginPath();
        if (pectoral) {
          ctx.moveTo(-sign * w * 0.48, (f * h) / 15);
          ctx.quadraticCurveTo(0, (f * h) / 22, sign * w * 0.48, -h * 0.16);
          ctx.stroke();
          continue;
        }
        ctx.moveTo((f * w) / 16, -h * 0.48);
        ctx.bezierCurveTo(
          (f * w) / 10,
          -h * 0.2,
          (f * w) / 14,
          h * 0.2,
          0,
          h * 0.48,
        );
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = "#242424";
      ctx.font = "600 .012px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  };
  if (zone === "trunk") {
    for (const sign of [-1, 1]) {
      muscle(0.5 + sign * 0.075, 0.63, 0.15, 0.3, "PECTORAL", sign * 0.45);
      muscle(0.5 + sign * 0.16, 0.37, 0.09, 0.48, "OBLIQUE", -sign * 0.35);
      for (let row = 0; row < 3; row++)
        muscle(
          0.5 + sign * 0.034,
          0.43 - row * 0.14,
          0.052,
          0.135,
          row === 1 ? "RECTUS" : "",
          0,
          "block",
        );
      muscle(0.0 + sign * 0.075, 0.79, 0.12, 0.36, "TRAPEZIUS", -sign * 0.55);
      muscle(0.0 + sign * 0.15, 0.46, 0.15, 0.5, "LATISSIMUS", sign * 0.3);
    }
  } else if (zone.endsWith("arm")) {
    muscle(0.5, 0.93, 0.43, 0.18, "DELTOID");
    muscle(0.5, 0.78, 0.25, 0.24, "BICEPS");
    muscle(0, 0.78, 0.34, 0.27, "TRICEPS");
    muscle(0.46, 0.46, 0.25, 0.31, "FLEXORS", -0.15);
    muscle(0.02, 0.46, 0.29, 0.31, "EXTENSORS", 0.12);
  } else {
    muscle(0.41, 0.75, 0.22, 0.38, "QUADRICEPS", -0.12);
    muscle(0.64, 0.72, 0.2, 0.37, "VASTUS", 0.12);
    muscle(0.02, 0.75, 0.32, 0.4, "HAMSTRINGS");
    muscle(0.49, 0.28, 0.13, 0.34, "TIBIALIS", -0.1);
    muscle(0.09, 0.31, 0.16, 0.35, "CALF");
    muscle(0.91, 0.32, 0.16, 0.35, "CALF");
  }
  ctx.restore();
}

export class HumanSurface {
  group = new THREE.Group();
  readonly rigBones: number;
  charts = new Map<
    SurfaceZone,
    {
      mesh: THREE.Mesh;
      canvas: HTMLCanvasElement;
      texture: THREE.CanvasTexture;
    }
  >();
  decals: SurfaceDecals;
  constructor(data: HumanMeshData, body: HumanBody) {
    this.rigBones =
      (body.model?.revision ?? 0) >= 6 ? (data.rig?.bones.length ?? 0) : 0;
    for (const { zone, geometry } of humanGeometries(data, body)) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 2048;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.anisotropy = 8;
      const material = data.sculpt
        ? sculptMaterial(data.sculpt, body, texture)
        : (body.model?.revision ?? 0) >= 5
          ? new THREE.MeshPhysicalMaterial({
              map: texture,
              vertexColors: true,
              roughness: 0.49,
              side: THREE.DoubleSide,
              envMapIntensity: 0.45,
              ior: 1.4,
              specularIntensity: 0.6,
            })
          : new THREE.MeshStandardMaterial({
              map: texture,
              vertexColors: !!body.model,
              roughness: (body.model?.revision ?? 0) >= 3 ? 0.66 : 0.78,
              side: THREE.DoubleSide,
            });
      const mesh = new THREE.Mesh(geometry, material);
      if (!data.sculpt && (body.model?.revision ?? 0) >= 3)
        addSculptedSurfaceDetail(
          mesh.material as THREE.MeshStandardMaterial,
          body,
          data.joints.L,
          data.detailLandmarks!,
        );
      else if (!data.sculpt && body.model)
        addSurfaceDetail(
          mesh.material as THREE.MeshStandardMaterial,
          body,
          zone,
        );
      mesh.userData.zone = zone;
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      this.charts.set(zone, { mesh, canvas, texture });
      this.group.add(mesh);
    }
    if (data.sculpt) {
      // Imported sculptures retain their own cut surfaces and native materials.
      this.decals = new SurfaceDecals(data, body, this.charts);
      this.group.add(this.decals.group);
      this.appearance(body);
      return;
    }
    // Close section cuts with neutral caps. Boundary loops are found across all charts,
    // so shared shoulder edges in an upper body are never capped internally.
    const edges = new Map<
      string,
      { a: THREE.Vector3; b: THREE.Vector3; count: number }
    >();
    const key = (p: THREE.Vector3) =>
      p
        .toArray()
        .map((x) => (body.model ? x.toString() : x.toFixed(2)))
        .join(",");
    for (const { mesh } of this.charts.values()) {
      const p = mesh.geometry.getAttribute("position");
      for (let i = 0; i < p.count; i += 3)
        for (let e = 0; e < 3; e++) {
          const a = new THREE.Vector3().fromBufferAttribute(p, i + e),
            b = new THREE.Vector3().fromBufferAttribute(p, i + ((e + 1) % 3));
          const ak = key(a),
            bk = key(b);
          if (ak === bk) continue;
          const id = [ak, bk].sort().join("|");
          const found = edges.get(id);
          if (found) found.count++;
          else edges.set(id, { a, b, count: 1 });
        }
    }
    // Section centroid: caps face away from it, so every cap is lit from outside.
    const sectionCentre = new THREE.Vector3();
    let sectionCount = 0;
    for (const { mesh } of this.charts.values()) {
      const p = mesh.geometry.getAttribute("position");
      for (let i = 0; i < p.count; i += 7) {
        sectionCentre.x += p.getX(i);
        sectionCentre.y += p.getY(i);
        sectionCentre.z += p.getZ(i);
        sectionCount++;
      }
    }
    sectionCentre.divideScalar(Math.max(1, sectionCount));
    const remaining = [...edges.values()].filter((e) => e.count === 1),
      capPositions: number[] = [],
      capNormals: number[] = [];
    while (remaining.length) {
      const first = remaining.pop()!,
        loop = [first.a, first.b];
      while (key(loop.at(-1)!) !== key(loop[0])) {
        const end = key(loop.at(-1)!);
        const i = remaining.findIndex(
          (e) => key(e.a) === end || key(e.b) === end,
        );
        if (i < 0) break;
        const [edge] = remaining.splice(i, 1);
        loop.push(key(edge.a) === end ? edge.b : edge.a);
      }
      if (loop.length < 4 || key(loop.at(-1)!) !== key(loop[0])) continue;
      const center = loop
        .slice(0, -1)
        .reduce((s, p) => s.add(p), new THREE.Vector3())
        .divideScalar(loop.length - 1);
      const normal = new THREE.Vector3();
      for (let i = 0; i < loop.length - 1; i++)
        normal.add(
          new THREE.Vector3().crossVectors(
            loop[i].clone().sub(center),
            loop[i + 1].clone().sub(center),
          ),
        );
      normal.normalize();
      // A stored normal pointing into the body shades the cap as a dark hole.
      if (normal.dot(center.clone().sub(sectionCentre)) < 0) normal.negate();
      if ((body.model?.revision ?? 0) >= 5) {
        // Ear clipping respects a concave axillary rim; a center fan can cross
        // the skin and expose a triangular flap below the shoulder section.
        const u = loop[0].clone().sub(center).normalize();
        const v = new THREE.Vector3().crossVectors(normal, u).normalize();
        const ring = loop.slice(0, -1);
        const flat = ring.map((p) => {
          const d = p.clone().sub(center);
          return new THREE.Vector2(d.dot(u), d.dot(v));
        });
        for (const triangle of THREE.ShapeUtils.triangulateShape(flat, [])) {
          const [a, b, c] = triangle.map((i) => ring[i]);
          // Winding agrees with the outward normal (front faces outside).
          if (
            new THREE.Vector3()
              .crossVectors(b.clone().sub(a), c.clone().sub(a))
              .dot(normal) < 0
          )
            triangle.reverse();
          for (const index of triangle) {
            capPositions.push(...ring[index].toArray());
            capNormals.push(...normal.toArray());
          }
        }
        continue;
      }
      for (let i = 0; i < loop.length - 1; i++) {
        capPositions.push(
          ...center.toArray(),
          ...loop[i].toArray(),
          ...loop[i + 1].toArray(),
        );
        for (let c = 0; c < 3; c++) capNormals.push(...normal.toArray());
      }
    }
    const caps = new THREE.BufferGeometry();
    caps.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(capPositions, 3),
    );
    if (body.model)
      caps.setAttribute(
        "normal",
        new THREE.Float32BufferAttribute(capNormals, 3),
      );
    else caps.computeVertexNormals();
    const cap = new THREE.Mesh(
      caps,
      new THREE.MeshStandardMaterial({
        color: body.anatomy ? "#aaa" : body.skin,
        roughness: 0.95,
        side: THREE.DoubleSide,
        // Sit just behind the rim so the skin edge stays crisp.
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    );
    cap.name = "section-caps";
    this.group.add(cap);
    this.decals = new SurfaceDecals(data, body, this.charts);
    this.group.add(this.decals.group);
  }
  appearance(body: HumanBody) {
    this.group.rotation.copy(sculptRotation(body));
    this.group.updateMatrixWorld(true);
    for (const { mesh } of this.charts.values()) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (material.userData.sculpt && !material.userData.nativeColor)
        material.color.set(body.skin);
      const sculptUniforms = material.userData.sculptAppearanceUniforms;
      if (sculptUniforms) {
        sculptUniforms.sculptSkin.value.set(body.skin);
        sculptUniforms.sculptRecolor.value =
          body.model?.sculptAppearance === "skin" ? 1 : 0;
      }
      const uniforms = (mesh.material as THREE.Material).userData
        .surfaceUniforms;
      if (uniforms) {
        uniforms.anatomyMix.value = body.anatomy
          ? body.model!.anatomyOpacity
          : 0;
        uniforms.skinTint.value.set(body.skin);
      }
    }
    const cap = this.group.getObjectByName("section-caps") as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >;
    if (!cap) return;
    cap.material.color
      .set(body.skin)
      // A slightly deeper, matte cut face reads as a section, not a glued disc.
      .multiplyScalar((body.model?.revision ?? 0) >= 5 ? 0.86 : 1)
      .lerp(
        new THREE.Color("#bdb7a7"),
        body.anatomy ? (body.model?.anatomyOpacity ?? 1) : 0,
      );
    // The skin shader adds wrap lighting the cap lacks; an emissive floor keeps a
    // sideways cut (torso shoulder ends) from reading as a dark hole.
    cap.material.emissive
      .copy(cap.material.color)
      .multiplyScalar((body.model?.revision ?? 0) >= 5 ? 0.42 : 0);
  }
  async paint(
    body: HumanBody,
    items: { layer: Layer; image: HTMLCanvasElement; ratio: number }[],
    inspectionLayer?: string,
    detailZone?: SurfaceZone | "standard",
    previewSize?: number,
  ) {
    for (const [zone, { canvas, texture }] of this.charts) {
      const edge =
        previewSize ??
        (detailZone && detailZone !== "standard"
          ? zone === detailZone
            ? 4096
            : 1024
          : 2048);
      if (canvas.width !== edge) {
        // WebGL texture storage is immutable once uploaded. Recreate it before
        // switching between the main chart and lighter comparison resolutions.
        texture.dispose();
        canvas.width = canvas.height = edge;
      }
      const ctx = canvas.getContext("2d")!,
        size = canvas.width;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = body.model
        ? "#ffffff"
        : body.anatomy
          ? "#e5e5e5"
          : body.skin;
      ctx.fillRect(0, 0, size, size);
      if (body.anatomy && !body.model) drawMuscleGuide(ctx, zone, size);
      const chart = humanChartSize(body, zone);
      for (const { layer: l, image, ratio } of items) {
        if (l.surface || layerZone(body, l) !== zone) continue;
        const copies =
          Math.ceil(Math.hypot(l.width, l.width * ratio) / chart.width) + 1;
        for (let r = -copies; r <= copies; r++) {
          ctx.save();
          ctx.globalAlpha = l.opacity;
          ctx.globalCompositeOperation = l.blend ?? "multiply";
          ctx.translate((l.u + r) * size, (1 - l.v) * size);
          ctx.scale(size / chart.width, size / chart.height);
          ctx.rotate((l.rotation * Math.PI) / 180);
          ctx.scale(l.flipX ? -1 : 1, l.flipY ? -1 : 1);
          ctx.drawImage(
            image,
            -l.width / 2,
            (-l.width * ratio) / 2,
            l.width,
            l.width * ratio,
          );
          ctx.restore();
        }
      }
      texture.needsUpdate = true;
    }
    await this.decals.paint(items, inspectionLayer);
  }
  dispose() {
    this.decals.dispose();
    for (const { mesh, texture } of this.charts.values()) {
      mesh.geometry.dispose();
      const material = mesh.material as THREE.Material;
      for (const owned of material.userData.ownedTextures ?? [])
        (owned as THREE.Texture).dispose();
      material.dispose();
      texture.dispose();
    }
    this.charts.clear();
    const cap = this.group.getObjectByName("section-caps") as
      | THREE.Mesh
      | undefined;
    if (cap) {
      cap.geometry.dispose();
      (cap.material as THREE.Material).dispose();
    }
  }
}

function addSurfaceDetail(
  material: THREE.MeshStandardMaterial,
  body: HumanBody,
  zone: SurfaceZone,
) {
  const uniforms = {
    anatomyMix: { value: body.anatomy ? body.model!.anatomyOpacity : 0 },
    skinTint: { value: new THREE.Color(body.skin) },
  };
  material.userData.surfaceUniforms = uniforms;
  material.customProgramCacheKey = () => `surface-v2-${zone}`;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader =
      "attribute vec3 restPosition; attribute float muscleId; varying vec3 vRest; varying float vMuscle;\n" +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvRest = restPosition; vMuscle = muscleId;",
    );
    shader.fragmentShader =
      `varying vec3 vRest; varying float vMuscle; uniform float anatomyMix; uniform vec3 skinTint;
      float pore(vec3 p) { return sin(p.x*391.0 + sin(p.z*217.0))*sin(p.y*367.0 + sin(p.x*103.0))*0.5; }
      ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `
      diffuseColor.rgb *= mix(skinTint, vColor.rgb, anatomyMix);
      float fiber = vRest.x * 150.0;
      ${zone.endsWith("arm") ? "fiber = atan(vRest.z - 0.18, abs(vRest.x) - (1.9 + (5.8-vRest.y)*.87)) * 85.0;" : ""}
      ${zone.endsWith("leg") ? "fiber = atan(vRest.z - 0.15, abs(vRest.x) - (1.12 + (1.15-vRest.y)*.1)) * 95.0;" : ""}
      if (vMuscle < 0.5) fiber = atan(vRest.y - 5.75, abs(vRest.x) - 2.0) * 220.0;
      if (vMuscle > 1.5 && vMuscle < 2.5) fiber = (abs(vRest.x) + vRest.y*.65)*100.0;
      if (vMuscle > 4.5 && vMuscle < 5.5) fiber = atan(vRest.y-5.6,abs(vRest.x)-2.0)*180.0;
      float striation = pow(0.5+0.5*sin(fiber + 0.12*sin(fiber*.37)), 12.0);
      float resolvedFiber = 1.0 - smoothstep(0.35, 1.1, fwidth(fiber));
      float resolvedPore = 1.0 - smoothstep(0.25, 0.9, length(fwidth(vRest)) * 180.0);
      float detail = 1.0 - anatomyMix * (vMuscle < 200.0 ? striation*.07*resolvedFiber : 0.0);
      detail += pore(vRest) * .018 * resolvedPore;
      diffuseColor.rgb *= detail;
    `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
      float microHeight = anatomyMix * (vMuscle < 200.0 ? striation * 0.10 * resolvedFiber : 0.0);
      microHeight += pore(vRest) * 0.018 * resolvedPore;
      vec3 tangentX = dFdx(-vViewPosition), tangentY = dFdy(-vViewPosition);
      vec3 gradientX = cross(tangentY, normal), gradientY = cross(normal, tangentX);
      float determinant = dot(tangentX, gradientX);
      vec3 detailGradient = (dFdx(microHeight)*gradientX + dFdy(microHeight)*gradientY) * sign(determinant) / max(abs(determinant), 0.000001);
      normal = normalize(normal - detailGradient);
    `,
    );
  };
}

export function blendJoint(
  p: THREE.Vector3,
  pivot: THREE.Vector3,
  axis: THREE.Vector3,
  angle: number,
  weight: number,
  preserveVolume: boolean,
) {
  if (weight <= 0 || angle === 0) return p;
  if (preserveVolume) {
    const half = angle / 2;
    const blended =
      2 *
      Math.atan2(weight * Math.sin(half), 1 - weight + weight * Math.cos(half));
    return p.sub(pivot).applyAxisAngle(axis, blended).add(pivot);
  }
  return p.lerp(
    p.clone().sub(pivot).applyAxisAngle(axis, angle).add(pivot),
    weight,
  );
}
