import type { SurfaceStroke } from "./surface-drawing";
import { sculptById } from "./sculpt-catalog";
import { compositeProject } from "./layer-groups";
import { HumanSurface, loadHuman, muscleAtHit } from "./anatomy";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  circumference,
  layerZone,
  artworkRatio,
  bodyLabel,
  surfacePoint,
  type Body,
  type SurfaceZone,
  type Layer,
  type Project,
} from "./domain";
import { InkCache } from "./ink";
import { PlanningGuides } from "./planning-guides";

export type StudioMode = "orbit" | "pan" | "place" | "draw";
export type View = "front" | "back" | "left" | "right" | "three-quarter";
export type SceneEvents = {
  draw?: (strokes: SurfaceStroke[]) => Promise<void>;
  begin: () => void;
  move: (u: number, v: number, zone?: SurfaceZone, vertex?: number) => void;
  end: () => void;
  stats: (stats: { p95: number; frames: number; triangles: number }) => void;
  error: (message: string) => void;
  inspection?: (stats: import("./surface-decals").SurfaceInspection) => void;
  hoverMuscle?: (id: number | undefined) => void;
};
function geometryKey(body: Body) {
  if (body.kind !== "human-v1" || !body.model) return JSON.stringify(body);
  const { skin: _skin, anatomy: _anatomy, model, ...shape } = body;
  const {
    anatomyOpacity: _opacity,
    sculptAppearance: _appearance,
    sculptRotation: _rotation,
    ...modelShape
  } = model;
  return JSON.stringify({
    ...shape,
    model: modelShape,
    envelope: sculptById(model.sculptId)?.skinEnvelope
      ? _appearance
      : undefined,
  });
}
export function forearmGeometry(body: Body) {
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const cols = 128,
    rows = 96;
  for (let y = 0; y <= rows; y++)
    for (let x = 0; x <= cols; x++) {
      const u = x / cols,
        v = y / rows;
      positions.push(...surfacePoint(body, u, v));
      uvs.push(u, v);
    }
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const a = y * (cols + 1) + x,
        b = a + cols + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // Average seam normals to avoid a visible lighting line at the UV boundary.
  const normals = geometry.getAttribute("normal");
  for (let y = 0; y <= rows; y++) {
    const a = y * (cols + 1),
      b = a + cols;
    const n = new THREE.Vector3()
      .fromBufferAttribute(normals, a)
      .add(new THREE.Vector3().fromBufferAttribute(normals, b))
      .normalize();
    normals.setXYZ(a, n.x, n.y, n.z);
    normals.setXYZ(b, n.x, n.y, n.z);
  }
  return geometry;
}

export function frameBounds(
  bounds: THREE.Box3,
  aspect: number,
  fov: number,
  view: View,
) {
  const size = bounds.getSize(new THREE.Vector3()),
    target = bounds.getCenter(new THREE.Vector3());
  const side = view === "left" || view === "right";
  const tan = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const distance =
    Math.max(
      size.y / (2 * tan),
      (side ? size.z : size.x) / (2 * tan * aspect),
    ) *
      1.32 +
    (side ? size.x : size.z) / 2;
  const direction = new THREE.Vector3(
    view === "left"
      ? -1
      : view === "right"
        ? 1
        : view === "three-quarter"
          ? 0.707
          : 0,
    0,
    view === "back"
      ? -1
      : view === "front"
        ? 1
        : view === "three-quarter"
          ? 0.707
          : 0,
  );
  return {
    target,
    position: target
      .clone()
      .addScaledVector(direction, Math.max(180, distance)),
  };
}
const ATLAS = 2048;
export class StudioScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, 1, 1, 20000);
  controls: OrbitControls;
  surface: THREE.Mesh;
  human?: HumanSurface;
  caps = new THREE.Group();
  planningGuides = new PlanningGuides();
  canvas = document.createElement("canvas");
  texture: THREE.CanvasTexture;
  material: THREE.MeshStandardMaterial;
  resize: ResizeObserver;
  resizeFrame = 0;
  viewWidth = 0;
  viewHeight = 0;
  frame = 0;
  frameTimes: number[] = [];
  lastFrame = 0;
  lastStats = 0;
  mode: StudioMode = "orbit";
  brush = { size: 3, color: "#202020", erase: false };
  strokes: SurfaceStroke[] = [];
  strokeActive = false;
  drawingBusy = false;
  strokeBreak = true;
  lastDrawPoint?: THREE.Vector3;
  drawingPreview = new THREE.Group();
  drawingLine?: THREE.Line;
  dragging = false;
  project?: Project;
  selected?: string;
  inspectionLayer?: string;
  ink = new InkCache();
  paintVersion = 0;
  disposed = false;
  active = true;
  needsRender = true;
  ray = new THREE.Raycaster();
  floor: THREE.Mesh;
  grid: THREE.GridHelper;
  events: SceneEvents;
  host: HTMLElement;
  studioEnvironment: THREE.WebGLRenderTarget;
  cleanups: (() => void)[] = [];

  constructor(
    host: HTMLElement,
    events: SceneEvents,
    public options: { previewSize?: number; planningGuides?: boolean } = {},
  ) {
    this.host = host;
    this.events = events;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor("#e5e5e5");
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.studioEnvironment = pmrem.fromScene(room, 0.055);
    room.dispose();
    pmrem.dispose();
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D body surface. Use the Place tool to position artwork, or Orbit to rotate the view.",
    );
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    host.appendChild(this.renderer.domElement);
    this.camera.position.set(0, 25, 580);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.085;
    this.controls.rotateSpeed = 0.65;
    this.controls.zoomSpeed = 0.7;
    this.controls.panSpeed = 0.8;
    this.controls.zoomToCursor = true;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 12000;
    this.controls.maxPolarAngle = Math.PI;
    this.controls.minPolarAngle = 0;
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    const hemisphere = new THREE.HemisphereLight("#ffffff", "#777777", 1.15);
    hemisphere.name = "studio-hemisphere";
    this.scene.add(hemisphere);
    const key = new THREE.DirectionalLight("#ffffff", 2.2);
    key.name = "studio-key";
    key.position.set(-180, 300, 300);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -230;
    key.shadow.camera.right = 230;
    key.shadow.camera.top = 230;
    key.shadow.camera.bottom = -230;
    key.shadow.bias = -0.0008;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight("#ffffff", 0.75);
    fill.name = "studio-fill";
    fill.position.set(180, 20, -150);
    this.scene.add(fill);
    this.canvas.width = this.canvas.height = ATLAS;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = Math.min(
      8,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    this.texture.wrapS = THREE.RepeatWrapping;
    this.material = new THREE.MeshStandardMaterial({
      map: this.texture,
      roughness: 0.89,
      metalness: 0,
    });
    this.surface = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.surface.castShadow = true;
    this.surface.receiveShadow = true;
    this.scene.add(this.surface, this.caps);
    this.scene.add(this.planningGuides.group);
    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.ShadowMaterial({ opacity: 0.13 }),
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
    this.grid = new THREE.GridHelper(700, 28, "#bfbfbf", "#d1d1d1");
    (this.grid.material as THREE.Material).transparent = true;
    (this.grid.material as THREE.Material).opacity = 0.35;
    this.scene.add(this.grid);
    this.resize = new ResizeObserver(() => {
      // Buffer writes must happen outside the observer's layout delivery.
      // The retained canvas also receives notifications while Fashion hides it.
      if (this.resizeFrame || this.disposed) return;
      this.resizeFrame = requestAnimationFrame(() => {
        this.resizeFrame = 0;
        if (!this.disposed) this.resizeView();
      });
    });
    this.resize.observe(host);
    this.resizeView();
    this.scene.add(this.drawingPreview);
    const el = this.renderer.domElement;
    const down = (e: PointerEvent) => {
      if (!e.isPrimary) {
        if (this.strokeActive) {
          this.strokeActive = false;
          this.strokes = [];
          this.clearDrawingPreview();
        }
        return;
      }
      if (this.mode === "draw" && e.button === 0 && !this.drawingBusy) {
        if (!this.hit(e)) return;
        this.strokeActive = true;
        this.strokes = [];
        this.strokeBreak = true;
        el.setPointerCapture(e.pointerId);
        this.sampleDrawing(e);
        return;
      }
      if (this.mode !== "place" || !this.selected || e.button !== 0) return;
      const hit = this.hit(e);
      if (!hit) return;
      this.dragging = true;
      el.setPointerCapture(e.pointerId);
      this.events.begin();
      this.events.move(hit.x, hit.y, hit.zone, hit.vertex);
    };
    let lastHover = 0;
    const leave = () => this.events.hoverMuscle?.(undefined);
    const move = (e: PointerEvent) => {
      if (this.strokeActive) {
        for (const sample of e.getCoalescedEvents?.().length
          ? e.getCoalescedEvents()
          : [e])
          this.sampleDrawing(sample);
        return;
      }
      if (
        this.project?.body.kind === "human-v1" &&
        this.project.body.model &&
        this.project.body.anatomy &&
        performance.now() - lastHover > 80
      ) {
        lastHover = performance.now();
        this.events.hoverMuscle?.(this.hit(e)?.muscle);
      }
      if (this.dragging) {
        const h = this.hit(e);
        if (h) this.events.move(h.x, h.y, h.zone, h.vertex);
      }
    };
    const up = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      if (el.hasPointerCapture(e.pointerId))
        el.releasePointerCapture(e.pointerId);
      if (this.strokeActive) {
        this.strokeActive = false;
        const strokes = this.strokes;
        this.strokes = [];
        this.drawingBusy = true;
        const commit =
          e.type !== "pointercancel" && strokes.length
            ? this.events.draw?.(strokes)
            : undefined;
        void Promise.resolve(commit)
          .catch((error) => this.events.error(String(error)))
          .finally(() => {
            this.clearDrawingPreview();
            this.drawingBusy = false;
          });
      }
      if (this.dragging) {
        this.dragging = false;
        this.events.end();
      }
    };
    const lost = (e: Event) => {
      e.preventDefault();
      this.events.error(
        "The graphics context was lost. Save your project and reopen the app.",
      );
    };
    const focus = (e: MouseEvent) => {
      if (this.mode === "orbit" || this.mode === "pan") this.focusAt(e);
    };
    el.addEventListener("dblclick", focus);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("webglcontextlost", lost);
    this.cleanups.push(() => {
      el.removeEventListener("dblclick", focus);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("webglcontextlost", lost);
    });
    this.frame = requestAnimationFrame(this.animate);
  }
  resizeView() {
    const { width, height } = this.host.getBoundingClientRect();
    if (!width || !height) return;
    if (width === this.viewWidth && height === this.viewHeight) return;
    this.viewWidth = width;
    this.viewHeight = height;
    // CSS owns the canvas layout; update only its drawing buffer so a resize
    // cannot feed new inline dimensions back into the observed host's layout.
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.needsRender = true;
  }
  animate = (time: number) => {
    if (this.disposed) return;
    if (!this.active || document.visibilityState !== "visible") {
      this.lastFrame = 0;
      this.frame = requestAnimationFrame(this.animate);
      return;
    }
    const cameraChanged = this.controls.update();
    this.host.dataset.camera = JSON.stringify({
      position: this.camera.position.toArray(),
      target: this.controls.target.toArray(),
    });
    if (cameraChanged || this.needsRender) {
      if (cameraChanged && this.lastFrame) {
        this.frameTimes.push(time - this.lastFrame);
        if (this.frameTimes.length > 600) this.frameTimes.shift();
      }
      this.lastFrame = time;
      this.renderer.render(this.scene, this.camera);
      this.needsRender = false;
    } else this.lastFrame = 0;
    if (time - this.lastStats > 1000) {
      const sorted = [...this.frameTimes].sort((a, b) => a - b);
      this.events.stats({
        p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
        frames: sorted.length,
        triangles: this.renderer.info.render.triangles,
      });
      this.lastStats = time;
    }
    this.frame = requestAnimationFrame(this.animate);
  };
  hit(e: { clientX: number; clientY: number }) {
    const b = this.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - b.left) / b.width) * 2 - 1,
        (-(e.clientY - b.top) / b.height) * 2 + 1,
      ),
      this.camera,
    );
    // Only tattoo-bearing surfaces are pickable; section caps and overlays are not skin.
    const hit = this.ray.intersectObjects(
      this.human
        ? [...this.human.charts.values()].map((c) => c.mesh)
        : [this.surface],
      false,
    )[0];
    return hit?.uv
      ? {
          point: hit.point.clone(),
          normal:
            hit.face?.normal
              .clone()
              .transformDirection(hit.object.matrixWorld) ??
            new THREE.Vector3(0, 0, 1),
          vertex: hit.face
            ? (hit.object as THREE.Mesh).geometry
                .getAttribute("sourceIndex")
                ?.getX(hit.face.a)
            : undefined,
          muscle: muscleAtHit(hit),
          x: hit.uv.x,
          y: hit.uv.y,
          zone: hit.object.userData.zone as SurfaceZone | undefined,
        }
      : undefined;
  }
  clearDrawingPreview() {
    for (const child of [...this.drawingPreview.children]) {
      const line = child as THREE.Line;
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
      this.drawingPreview.remove(child);
    }
    this.drawingLine = undefined;
    this.needsRender = true;
  }
  sampleDrawing(e: PointerEvent) {
    const hit = this.hit(e);
    if (!hit) {
      this.strokeBreak = true;
      this.lastDrawPoint = undefined;
      return;
    }
    const zone = hit.zone ?? "left-arm";
    const pressure = e.pointerType === "pen" ? Math.max(0.15, e.pressure) : 1;
    const p = hit.point.clone().addScaledVector(hit.normal, 0.15);
    const jump =
      this.lastDrawPoint &&
      this.lastDrawPoint.distanceTo(p) >
        Math.max(20, (this.project?.body.length ?? 300) * 0.1);
    let stroke = this.strokes.at(-1);
    if (this.strokeBreak || jump || !stroke || stroke.zone !== zone) {
      stroke = { zone, points: [], ...this.brush };
      this.strokes.push(stroke);
      this.strokeBreak = false;
      this.lastDrawPoint = undefined;
      this.drawingLine = undefined;
    }
    if (stroke.points.length >= 4000) return;
    stroke.points.push([hit.x, hit.y, pressure]);
    if (!this.drawingLine) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(4000 * 3), 3),
      );
      this.drawingLine = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({
          color: this.brush.erase ? "#bdbdbd" : this.brush.color,
          depthTest: true,
        }),
      );
      this.drawingLine.frustumCulled = false;
      this.drawingLine.raycast = () => {};
      this.drawingPreview.add(this.drawingLine);
    }
    const attribute = this.drawingLine.geometry.getAttribute("position");
    attribute.setXYZ(stroke.points.length - 1, p.x, p.y, p.z);
    attribute.needsUpdate = true;
    this.drawingLine.geometry.setDrawRange(0, stroke.points.length);
    this.lastDrawPoint = p;
    this.needsRender = true;
  }
  focusAt(e: { clientX: number; clientY: number }) {
    const hit = this.hit(e);
    if (!hit) return;
    const direction = this.camera.position
      .clone()
      .sub(this.controls.target)
      .normalize();
    const distance = Math.max(
      60,
      Math.min(
        this.camera.position.distanceTo(hit.point) * 0.55,
        (this.project?.body.length ?? 300) * 0.7,
      ),
    );
    this.controls.target.copy(hit.point);
    this.camera.position.copy(hit.point).addScaledVector(direction, distance);
    this.controls.update();
    this.needsRender = true;
  }
  setMode(mode: StudioMode, selected?: string) {
    this.mode = mode;
    this.selected = selected;
    this.controls.enabled = true;
    this.controls.mouseButtons.LEFT =
      mode === "orbit"
        ? THREE.MOUSE.ROTATE
        : mode === "pan"
          ? THREE.MOUSE.PAN
          : (null as unknown as THREE.MOUSE);
    this.controls.touches.ONE =
      mode === "orbit"
        ? THREE.TOUCH.ROTATE
        : mode === "pan"
          ? THREE.TOUCH.PAN
          : (null as unknown as THREE.TOUCH);
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    this.renderer.domElement.style.cursor =
      mode === "place" || mode === "draw" ? "crosshair" : "grab";
  }
  view(view: View, length = this.project?.body.length ?? 270) {
    if (this.human) {
      const bounds = new THREE.Box3().setFromObject(this.human.group);
      const frame = frameBounds(
        bounds,
        this.camera.aspect,
        this.camera.fov,
        view,
      );
      this.controls.target.copy(frame.target);
      this.camera.position.copy(frame.position);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      return;
    }
    const d = length * 2.6;
    const positions: Record<View, [number, number, number]> = {
      "three-quarter": [d * 0.707, 25, d * 0.707],
      front: [0, 25, d],
      back: [0, 25, -d],
      left: [-d, 25, 0],
      right: [d, 25, 0],
    };
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(...positions[view]);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  zoom(factor: number) {
    const d = this.camera.position.clone().sub(this.controls.target);
    d.multiplyScalar(factor);
    d.clampLength(this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(d);
    this.controls.update();
    // update() consumes OrbitControls' change flag before the animation loop.
    // Explicit button zoom therefore needs to invalidate the next frame.
    this.needsRender = true;
  }
  async update(project: Project) {
    project = compositeProject(project);
    const version = ++this.paintVersion;
    this.events.hoverMuscle?.(undefined);
    const humanData =
      project.body.kind === "human-v1"
        ? await loadHuman(project.body).catch((e) => {
            this.events.error(String(e));
            return null;
          })
        : undefined;
    if (this.disposed || version !== this.paintVersion || humanData === null)
      return false;
    const referenceBody =
      project.body.kind === "human-v1" &&
      (project.body.model?.revision ?? 0) >= 5;
    this.scene.environment = referenceBody
      ? this.studioEnvironment.texture
      : null;
    this.scene.environmentIntensity = 0.085;
    this.renderer.setClearColor(referenceBody ? "#29292c" : "#e5e5e5");
    (
      this.scene.getObjectByName("studio-hemisphere") as THREE.HemisphereLight
    ).intensity = referenceBody ? 0.48 : 1.15;
    (
      this.scene.getObjectByName("studio-key") as THREE.DirectionalLight
    ).intensity = referenceBody ? 2.0 : 2.2;
    (
      this.scene.getObjectByName("studio-fill") as THREE.DirectionalLight
    ).intensity = referenceBody ? 0.65 : 0.75;
    if (
      !this.project ||
      geometryKey(this.project.body) !== geometryKey(project.body)
    ) {
      const reframe =
        !this.project ||
        this.project.body.kind !== project.body.kind ||
        ("section" in this.project.body &&
          "section" in project.body &&
          this.project.body.section !== project.body.section) ||
        (this.project.body.kind === "human-v1" &&
          project.body.kind === "human-v1" &&
          this.project.body.model?.sculptId !== project.body.model?.sculptId);
      this.surface.geometry.dispose();
      this.human?.dispose();
      if (this.human) this.scene.remove(this.human.group);
      this.human = undefined;
      this.surface.visible = project.body.kind !== "human-v1";
      if (project.body.kind === "human-v1" && humanData) {
        this.human = new HumanSurface(humanData, project.body);
        this.scene.add(this.human.group);
      } else this.surface.geometry = forearmGeometry(project.body);
      for (const child of [...this.caps.children]) {
        const mesh = child as THREE.Mesh;
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.caps.remove(child);
      }
      if (project.body.kind !== "human-v1")
        for (const v of [0, 1]) {
          const points = [
            new THREE.Vector3(0, (v - 0.5) * project.body.length, 0),
          ];
          for (let i = 0; i <= 128; i++)
            points.push(
              new THREE.Vector3(...surfacePoint(project.body, i / 128, v)),
            );
          const g = new THREE.BufferGeometry().setFromPoints(points);
          const idx: number[] = [];
          for (let i = 1; i <= 128; i++) idx.push(0, i, i + 1);
          g.setIndex(idx);
          g.computeVertexNormals();
          const cap = new THREE.Mesh(
            g,
            new THREE.MeshStandardMaterial({
              color: project.body.skin,
              side: THREE.DoubleSide,
              roughness: 1,
            }),
          );
          cap.castShadow = true;
          this.caps.add(cap);
        }
      this.floor.position.y = this.human
        ? new THREE.Box3().setFromObject(this.human.group).min.y - 12
        : -project.body.length / 2 - 12;
      this.grid.position.y = this.floor.position.y - 0.1;
      if (reframe)
        this.view(
          project.body.kind === "region-v1" && project.body.region === "torso"
            ? "back"
            : "front",
          project.body.length,
        );
    }
    if (project.body.kind === "human-v1" && project.body.model)
      this.human?.appearance(project.body);
    if (this.human && project.body.kind === "human-v1") {
      this.planningGuides.group.rotation.copy(this.human.group.rotation);
      this.planningGuides.group.updateMatrixWorld(true);
      this.floor.position.y =
        new THREE.Box3().setFromObject(this.human.group).min.y - 12;
      this.grid.position.y = this.floor.position.y - 0.1;
      this.host.dataset.modelRotation = JSON.stringify(
        this.human.group.rotation.toArray().slice(0, 3),
      );
    }
    this.project = project;
    try {
      const items: { layer: Layer; image: HTMLCanvasElement; ratio: number }[] =
        [];
      let detailPixels = 0;
      for (const layer of project.layers) {
        if (!layer.visible || layer.photoId) continue;
        const asset = project.assets.find((a) => a.id === layer.assetId)!;
        const detail = project.tattooStudy?.detailZone;
        const wantsDetail =
          detail &&
          detail !== "standard" &&
          layerZone(project.body, layer) === detail;
        // At most two 4K square source variants; source pixels are never upscaled.
        const edge =
          this.options.previewSize ??
          (wantsDetail && detailPixels + 4096 * 4096 <= 33_554_432
            ? 4096
            : 2048);
        const processed = await this.ink.get(asset, layer, edge);
        if (edge > 2048) detailPixels += processed.width * processed.height;
        if (this.disposed || version !== this.paintVersion) return false;
        items.push({
          layer,
          image: processed,
          ratio: artworkRatio(asset) * (layer.stretch ?? 1),
        });
      }
      if (this.disposed || version !== this.paintVersion) return false;
      if (project.body.kind === "human-v1" && this.human) {
        const detail =
          this.renderer.capabilities.maxTextureSize >= 4096
            ? project.tattooStudy?.detailZone
            : "standard";
        await this.human.paint(
          project.body,
          items,
          this.inspectionLayer,
          detail,
          this.options.previewSize,
        );
        if (this.disposed || version !== this.paintVersion) return false;
        if (this.options.planningGuides)
          this.planningGuides.update(
            this.human,
            project.body,
            project.tattooStudy?.guides ?? [],
          );
        this.events.inspection?.(this.human.decals.inspection);
        this.renderer.render(this.scene, this.camera);
        this.host.dataset.renderedBody = JSON.stringify(project.body);
        this.host.dataset.rigBones = String(this.human.rigBones);
        this.host.dataset.surfaceInspection = JSON.stringify(
          this.human.decals.inspection,
        );
        this.host.dataset.chartSizes = JSON.stringify(
          Object.fromEntries(
            [...this.human.charts].map(([z, c]) => [z, c.canvas.width]),
          ),
        );
        this.host.dataset.connectedTriangles = String(
          this.human.decals.group.children.reduce(
            (sum, m) =>
              sum +
              (m as THREE.Mesh).geometry.getAttribute("position").count / 3,
            0,
          ),
        );
        this.ink.prune(
          project.assets,
          project.layers.filter((l) => !l.photoId && l.visible),
        );
        return true;
      }
      const ctx = this.canvas.getContext("2d")!;
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = project.body.skin;
      ctx.fillRect(0, 0, ATLAS, ATLAS);
      ctx.globalCompositeOperation = "multiply";
      for (const { layer, image, ratio } of items) {
        const c = circumference(project.body, layer.v);
        // Repeat chart copies at the seam; rotation happens in millimeters before atlas scaling.
        const copies =
          Math.ceil(Math.hypot(layer.width, layer.width * ratio) / c) + 1;
        for (let repeat = -copies; repeat <= copies; repeat++) {
          ctx.save();
          ctx.globalAlpha = layer.opacity;
          ctx.globalCompositeOperation = layer.blend ?? "multiply";
          ctx.translate((layer.u + repeat) * ATLAS, (1 - layer.v) * ATLAS);
          ctx.scale(ATLAS / c, ATLAS / project.body.length);
          ctx.rotate((layer.rotation * Math.PI) / 180);
          ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
          ctx.drawImage(
            image,
            -layer.width / 2,
            (-layer.width * ratio) / 2,
            layer.width,
            layer.width * ratio,
          );
          ctx.restore();
        }
      }
      this.texture.needsUpdate = true;
      this.needsRender = true;
      this.ink.prune(
        project.assets,
        project.layers.filter((l) => !l.photoId && l.visible),
      );
      return true;
    } catch {
      this.events.error(
        "An artwork image could not be decoded. The original project has been preserved.",
      );
      return false;
    }
  }
  exportReview(project: Project) {
    this.renderer.render(this.scene, this.camera);
    const c = document.createElement("canvas");
    c.width = 1800;
    c.height = 1800;
    const x = c.getContext("2d")!;
    x.fillStyle = "#e5e5e5";
    x.fillRect(0, 0, 1800, 1800);
    const source = this.renderer.domElement;
    const fit = Math.min(1700 / source.width, 1480 / source.height);
    x.drawImage(
      source,
      (1800 - source.width * fit) / 2,
      150,
      source.width * fit,
      source.height * fit,
    );
    x.fillStyle = "#242424";
    x.font = "32px sans-serif";
    x.fillText("CORPORA STUDIO", 80, 78);
    x.font = "20px sans-serif";
    x.fillText(project.name.slice(0, 70), 80, 120);
    x.strokeStyle = "#bfbfbf";
    x.beginPath();
    x.moveTo(80, 1660);
    x.lineTo(1720, 1660);
    x.stroke();
    x.font = "24px sans-serif";
    x.fillText(
      `${bodyLabel(project.body)} · ${project.revision} · ${project.body.length} mm length`,
      80,
      1710,
    );
    x.font = "21px sans-serif";
    x.fillText(
      "Approximate model · Visual composition only · Not a validated tattoo stencil",
      80,
      1746,
    );
    if (
      project.body.kind === "human-v1" &&
      project.body.model &&
      project.body.anatomy &&
      project.body.model.anatomyOpacity > 0
    ) {
      x.font = "15px sans-serif";
      x.fillText(
        "Muscle map adapted from Z-Anatomy / BodyParts3D — The Database Center for Life Science · CC BY-SA 4.0",
        80,
        1773,
      );
      x.fillText(
        "github.com/Z-Anatomy/Models-of-human-anatomy · creativecommons.org/licenses/by-sa/4.0/",
        80,
        1793,
      );
    }
    return c.toDataURL("image/png");
  }
  dispose() {
    this.planningGuides.clear();
    this.disposed = true;
    this.paintVersion++;
    this.human?.dispose();
    if (this.human) this.scene.remove(this.human.group);
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.resizeFrame);
    this.resize.disconnect();
    this.cleanups.forEach((fn) => fn());
    this.clearDrawingPreview();
    this.controls.dispose();
    this.scene.traverse((object) => {
      if (
        object instanceof THREE.Mesh ||
        object instanceof THREE.LineSegments
      ) {
        object.geometry.dispose();
        const m = object.material;
        (Array.isArray(m) ? m : [m]).forEach((material) => material.dispose());
      }
    });
    this.ink.clear();
    this.texture.dispose();
    this.studioEnvironment.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
