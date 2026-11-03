import * as THREE from "three";
import {
  bodyZones,
  armPose,
  humanChartSize,
  layerZone,
  type HumanBody,
  type Layer,
  type SurfaceZone,
} from "./domain";

export type HumanMeshData = {
  vertices: number[][];
  parts: number[][];
  joints: Record<
    "L" | "R",
    Record<"shoulder" | "elbow" | "wrist" | "hip" | "knee" | "ankle", number[]>
  >;
};
let source: Promise<HumanMeshData> | undefined;
export const loadHuman = () =>
  (source ??= fetch("/anatomy/human-v1.json")
    .then((r) => {
      if (!r.ok) throw new Error("The bundled human mesh could not load.");
      return r.json() as Promise<HumanMeshData>;
    })
    .catch((e) => {
      source = undefined;
      throw e;
    }));
const zones: SurfaceZone[] = [
  "trunk",
  "left-arm",
  "right-arm",
  "left-leg",
  "right-leg",
];
const vector = (p: number[]) =>
  new THREE.Vector3(...(p as [number, number, number]));

export function humanGeometries(data: HumanMeshData, body: HumanBody) {
  const scale =
    body.length /
    (body.section === "upper-body"
      ? 5.5
      : body.section === "full-arm"
        ? 7.9
        : 9.0);
  const points: THREE.Vector3[] = [],
    rests: THREE.Vector3[] = [];
  const joints = data.joints;
  for (const v of data.vertices) {
    const rest = vector(v),
      p = rest.clone().addScaledVector(vector(v.slice(3, 6)), body.muscularity);
    rests.push(rest);
    for (const [side, k, sign] of [
      ["L", 6, 1],
      ["R", 9, -1],
    ] as const) {
      const j = joints[side],
        shoulder = vector(j.shoulder),
        elbow = vector(j.elbow),
        knee = vector(j.knee);
      const armAxis = elbow.clone().sub(shoulder).normalize();
      const flexAxis = new THREE.Vector3(armAxis.y, -armAxis.x, 0).normalize();
      const isLeg = body.section === "full-leg";
      const pose = armPose(body, side === "L" ? "left" : "right");
      if (!isLeg && pose.twist) {
        // Rotate the lower arm about its rest axis before elbow and shoulder motion.
        const spun = p
          .clone()
          .sub(elbow)
          .applyAxisAngle(armAxis, THREE.MathUtils.degToRad(sign * pose.twist))
          .add(elbow);
        p.lerp(spun, v[k + 1]);
      }
      const pivot = isLeg ? knee : elbow;
      const weight = isLeg ? v[k + 2] : v[k + 1];
      const q = p
        .clone()
        .sub(pivot)
        .applyAxisAngle(
          isLeg ? new THREE.Vector3(-1, 0, 0) : flexAxis,
          THREE.MathUtils.degToRad(isLeg ? body.flex : pose.flex),
        )
        .add(pivot);
      p.lerp(q, weight);
      // Raise in the frontal plane from the existing relaxed pose. Shoulder weights blend the trunk attachment.
      if (!isLeg) {
        const relaxed = p
          .clone()
          .sub(shoulder)
          .applyAxisAngle(
            new THREE.Vector3(0, 0, 1),
            sign * THREE.MathUtils.degToRad(pose.raise - 20),
          )
          .add(shoulder);
        p.lerp(relaxed, v[k]);
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
    for (const i of data.parts[zones.indexOf(zone)]) {
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
  whole.setIndex(data.parts.flat());
  whole.computeVertexNormals();
  const normals = whole.getAttribute("normal");
  const result = selected.map((zone) => {
    const positions: number[] = [],
      uv: number[] = [],
      ns: number[] = [];
    const indices = data.parts[zones.indexOf(zone)];
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
      if (!arm && !leg)
        return [
          0.5 + Math.atan2(p.x, p.z + 0.15) / (Math.PI * 2),
          (p.y - 1.5) / 5.5,
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
      const seam =
        Math.max(...tex.map((t) => t[0])) - Math.min(...tex.map((t) => t[0])) >
        0.5;
      for (let c = 0; c < 3; c++) {
        const i = ids[c];
        positions.push(...points[i].toArray());
        ns.push(normals.getX(i), normals.getY(i), normals.getZ(i));
        uv.push(tex[c][0] + (seam && tex[c][0] < 0.5 ? 1 : 0), tex[c][1]);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(ns, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
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
  charts = new Map<
    SurfaceZone,
    {
      mesh: THREE.Mesh;
      canvas: HTMLCanvasElement;
      texture: THREE.CanvasTexture;
    }
  >();
  constructor(data: HumanMeshData, body: HumanBody) {
    for (const { zone, geometry } of humanGeometries(data, body)) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 2048;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.anisotropy = 8;
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.78,
          side: THREE.DoubleSide,
        }),
      );
      mesh.userData.zone = zone;
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      this.charts.set(zone, { mesh, canvas, texture });
      this.group.add(mesh);
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
        .map((x) => x.toFixed(2))
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
    const remaining = [...edges.values()].filter((e) => e.count === 1),
      capPositions: number[] = [];
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
      for (let i = 0; i < loop.length - 1; i++)
        capPositions.push(
          ...center.toArray(),
          ...loop[i].toArray(),
          ...loop[i + 1].toArray(),
        );
    }
    const caps = new THREE.BufferGeometry();
    caps.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(capPositions, 3),
    );
    caps.computeVertexNormals();
    const cap = new THREE.Mesh(
      caps,
      new THREE.MeshStandardMaterial({
        color: body.anatomy ? "#aaa" : body.skin,
        roughness: 0.9,
        side: THREE.DoubleSide,
      }),
    );
    cap.name = "section-caps";
    this.group.add(cap);
  }
  paint(
    body: HumanBody,
    items: { layer: Layer; image: HTMLCanvasElement; ratio: number }[],
  ) {
    for (const [zone, { canvas, texture }] of this.charts) {
      const ctx = canvas.getContext("2d")!,
        size = canvas.width;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = body.anatomy ? "#e5e5e5" : body.skin;
      ctx.fillRect(0, 0, size, size);
      if (body.anatomy) drawMuscleGuide(ctx, zone, size);
      const chart = humanChartSize(body, zone);
      for (const { layer: l, image, ratio } of items) {
        if (layerZone(body, l) !== zone) continue;
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
  }
  dispose() {
    for (const { mesh, texture } of this.charts.values()) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
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
