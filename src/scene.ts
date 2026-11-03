import { HumanSurface, loadHuman } from "./anatomy";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  circumference,
  bodyLabel,
  surfacePoint,
  type Body,
  type SurfaceZone,
  type Layer,
  type Project,
} from "./domain";
import { InkCache } from "./ink";

export type View = "front" | "back" | "left" | "right";
export type SceneEvents = {
  begin: () => void;
  move: (u: number, v: number, zone?: SurfaceZone) => void;
  end: () => void;
  stats: (stats: { p95: number; frames: number; triangles: number }) => void;
  error: (message: string) => void;
};
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

const ATLAS = 2048;
export class StudioScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, 1, 1, 7000);
  controls: OrbitControls;
  surface: THREE.Mesh;
  human?: HumanSurface;
  caps = new THREE.Group();
  canvas = document.createElement("canvas");
  texture: THREE.CanvasTexture;
  material: THREE.MeshStandardMaterial;
  resize: ResizeObserver;
  frame = 0;
  frameTimes: number[] = [];
  lastFrame = 0;
  lastStats = 0;
  mode: "orbit" | "place" = "orbit";
  dragging = false;
  project?: Project;
  selected?: string;
  ink = new InkCache();
  paintVersion = 0;
  disposed = false;
  active = true;
  ray = new THREE.Raycaster();
  floor: THREE.Mesh;
  grid: THREE.GridHelper;
  events: SceneEvents;
  host: HTMLElement;
  cleanups: (() => void)[] = [];

  constructor(host: HTMLElement, events: SceneEvents) {
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
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D body surface. Use the Place tool to position artwork, or Orbit to rotate the view.",
    );
    this.renderer.domElement.tabIndex = 0;
    host.appendChild(this.renderer.domElement);
    this.camera.position.set(0, 25, 580);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.minDistance = 180;
    this.controls.maxDistance = 4000;
    this.controls.maxPolarAngle = Math.PI * 0.88;
    this.controls.minPolarAngle = Math.PI * 0.12;
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.scene.add(new THREE.HemisphereLight("#ffffff", "#5b5b5b", 2.0));
    const key = new THREE.DirectionalLight("#ffffff", 3.0);
    key.position.set(-180, 300, 300);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -230;
    key.shadow.camera.right = 230;
    key.shadow.camera.top = 230;
    key.shadow.camera.bottom = -230;
    key.shadow.bias = -0.0008;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight("#ffffff", 1.1);
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
    this.resize = new ResizeObserver(() => this.resizeView());
    this.resize.observe(host);
    this.resizeView();
    const el = this.renderer.domElement;
    const down = (e: PointerEvent) => {
      if (this.mode !== "place" || !this.selected || e.button !== 0) return;
      const hit = this.hit(e);
      if (!hit) return;
      this.dragging = true;
      el.setPointerCapture(e.pointerId);
      this.events.begin();
      this.events.move(hit.x, hit.y, hit.zone);
    };
    const move = (e: PointerEvent) => {
      if (this.dragging) {
        const h = this.hit(e);
        if (h) this.events.move(h.x, h.y, h.zone);
      }
    };
    const up = () => {
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
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("webglcontextlost", lost);
    this.cleanups.push(() => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("webglcontextlost", lost);
    });
    this.frame = requestAnimationFrame(this.animate);
  }
  resizeView() {
    const { width, height } = this.host.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  animate = (time: number) => {
    if (this.disposed) return;
    if (this.lastFrame && document.visibilityState === "visible") {
      const dt = time - this.lastFrame;
      this.frameTimes.push(dt);
      if (this.frameTimes.length > 600) this.frameTimes.shift();
    }
    this.lastFrame = time;
    if (!this.active) {
      this.lastFrame = 0;
      this.frame = requestAnimationFrame(this.animate);
      return;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
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
  hit(e: PointerEvent) {
    const b = this.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - b.left) / b.width) * 2 - 1,
        (-(e.clientY - b.top) / b.height) * 2 + 1,
      ),
      this.camera,
    );
    const hit = this.ray.intersectObject(
      this.human?.group ?? this.surface,
      true,
    )[0];
    return hit?.uv
      ? {
          x: hit.uv.x,
          y: hit.uv.y,
          zone: hit.object.userData.zone as SurfaceZone | undefined,
        }
      : undefined;
  }
  setMode(mode: "orbit" | "place", selected?: string) {
    this.mode = mode;
    this.selected = selected;
    this.controls.enabled = mode === "orbit";
    this.renderer.domElement.style.cursor =
      mode === "place" ? "crosshair" : "grab";
  }
  view(view: View, length = this.project?.body.length ?? 270) {
    const d = length * 2.6;
    const positions: Record<View, [number, number, number]> = {
      front: [0, 25, d],
      back: [0, 25, -d],
      left: [-d, 25, 0],
      right: [d, 25, 0],
    };
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(...positions[view]);
    this.controls.update();
  }
  zoom(factor: number) {
    const d = this.camera.position.clone().sub(this.controls.target);
    d.multiplyScalar(factor);
    d.clampLength(this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(d);
    this.controls.update();
  }
  async update(project: Project) {
    const version = ++this.paintVersion;
    const humanData =
      project.body.kind === "human-v1"
        ? await loadHuman().catch((e) => {
            this.events.error(String(e));
            return null;
          })
        : undefined;
    if (this.disposed || version !== this.paintVersion || humanData === null)
      return false;
    if (
      !this.project ||
      JSON.stringify(this.project.body) !== JSON.stringify(project.body)
    ) {
      if (
        !this.project ||
        this.project.body.kind !== project.body.kind ||
        ("section" in this.project.body &&
          "section" in project.body &&
          this.project.body.section !== project.body.section)
      )
        this.view("front", project.body.length);
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
    }
    this.project = project;
    try {
      const items: { layer: Layer; image: HTMLCanvasElement; ratio: number }[] =
        [];
      for (const layer of project.layers) {
        if (!layer.visible || layer.photoId) continue;
        const asset = project.assets.find((a) => a.id === layer.assetId)!;
        const processed = await this.ink.get(asset, layer);
        if (this.disposed || version !== this.paintVersion) return false;
        items.push({
          layer,
          image: processed,
          ratio: (asset.height / asset.width) * (layer.stretch ?? 1),
        });
      }
      if (this.disposed || version !== this.paintVersion) return false;
      if (project.body.kind === "human-v1" && this.human) {
        this.human.paint(project.body, items);
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
    x.fillText("FORM / STUDIO", 80, 78);
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
      1754,
    );
    return c.toDataURL("image/png");
  }
  dispose() {
    this.disposed = true;
    this.paintVersion++;
    this.human?.dispose();
    if (this.human) this.scene.remove(this.human.group);
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    this.cleanups.forEach((fn) => fn());
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
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
