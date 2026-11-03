import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  circumference,
  surfacePoint,
  type Body,
  type Layer,
  type Project,
} from "./domain";
import { loadImage } from "./io";

export type View = "front" | "back" | "left" | "right";
export type SceneEvents = {
  begin: () => void;
  move: (u: number, v: number) => void;
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
  camera = new THREE.PerspectiveCamera(35, 1, 1, 3000);
  controls: OrbitControls;
  surface: THREE.Mesh;
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
  images = new Map<string, Promise<HTMLImageElement>>();
  processed = new Map<string, HTMLCanvasElement>();
  paintVersion = 0;
  disposed = false;
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
    this.renderer.setClearColor("#e8e6de");
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D forearm. Use the Place tool to position artwork, or Orbit to rotate the view.",
    );
    this.renderer.domElement.tabIndex = 0;
    host.appendChild(this.renderer.domElement);
    this.camera.position.set(0, 25, 580);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.minDistance = 180;
    this.controls.maxDistance = 1100;
    this.controls.maxPolarAngle = Math.PI * 0.88;
    this.controls.minPolarAngle = Math.PI * 0.12;
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.scene.add(new THREE.HemisphereLight("#fff6e6", "#797f79", 2.8));
    const key = new THREE.DirectionalLight("#fff8ef", 3.1);
    key.position.set(-180, 300, 300);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -230;
    key.shadow.camera.right = 230;
    key.shadow.camera.top = 230;
    key.shadow.camera.bottom = -230;
    key.shadow.bias = -0.0008;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight("#d6e3e4", 1.2);
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
    this.grid = new THREE.GridHelper(700, 28, "#c7c9c0", "#d7d9d0");
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
      this.events.move(hit.x, hit.y);
    };
    const move = (e: PointerEvent) => {
      if (this.dragging) {
        const h = this.hit(e);
        if (h) this.events.move(h.x, h.y);
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
    return this.ray.intersectObject(this.surface)[0]?.uv;
  }
  setMode(mode: "orbit" | "place", selected?: string) {
    this.mode = mode;
    this.selected = selected;
    this.controls.enabled = mode === "orbit";
    this.renderer.domElement.style.cursor =
      mode === "place" ? "crosshair" : "grab";
  }
  view(view: View, length = this.project?.body.length ?? 270) {
    const d = length * 2.15;
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
    if (
      !this.project ||
      JSON.stringify(this.project.body) !== JSON.stringify(project.body)
    ) {
      this.surface.geometry.dispose();
      this.surface.geometry = forearmGeometry(project.body);
      for (const child of [...this.caps.children]) {
        const mesh = child as THREE.Mesh;
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.caps.remove(child);
      }
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
      this.floor.position.y = -project.body.length / 2 - 12;
      this.grid.position.y = this.floor.position.y - 0.1;
    }
    this.project = project;
    const version = ++this.paintVersion;
    try {
      const items: { layer: Layer; image: HTMLCanvasElement; ratio: number }[] =
        [];
      for (const layer of project.layers) {
        if (!layer.visible) continue;
        const asset = project.assets.find((a) => a.id === layer.assetId)!;
        if (!this.images.has(asset.sha256))
          this.images.set(asset.sha256, loadImage(asset.data));
        const key = `${asset.sha256}:${layer.removePaper}:${layer.monochrome}`;
        let processed = this.processed.get(key);
        if (!processed) {
          const image = await this.images.get(asset.sha256)!;
          if (this.disposed || version !== this.paintVersion) return false;
          processed = document.createElement("canvas");
          const scale = Math.min(1, 2048 / Math.max(image.width, image.height));
          processed.width = Math.max(1, Math.round(image.width * scale));
          processed.height = Math.max(1, Math.round(image.height * scale));
          const ctx = processed.getContext("2d", { willReadFrequently: true })!;
          ctx.drawImage(image, 0, 0, processed.width, processed.height);
          if (layer.removePaper || layer.monochrome) {
            const pixels = ctx.getImageData(
              0,
              0,
              processed.width,
              processed.height,
            );
            for (let i = 0; i < pixels.data.length; i += 4) {
              const p = pixels.data,
                luminance =
                  0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];
              if (layer.removePaper)
                p[i + 3] = Math.round(
                  p[i + 3] * (1 - Math.min(p[i], p[i + 1], p[i + 2]) / 255),
                );
              if (layer.monochrome) {
                const ink = layer.removePaper ? 28 : luminance;
                p[i] = p[i + 1] = p[i + 2] = ink;
              }
            }
            ctx.putImageData(pixels, 0, 0);
          }
          this.processed.set(key, processed);
        }
        items.push({
          layer,
          image: processed,
          ratio: asset.height / asset.width,
        });
      }
      if (this.disposed || version !== this.paintVersion) return false;
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
          ctx.translate((layer.u + repeat) * ATLAS, (1 - layer.v) * ATLAS);
          ctx.scale(ATLAS / c, ATLAS / project.body.length);
          ctx.rotate((layer.rotation * Math.PI) / 180);
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
      // Remove unused cache entries when documents change, keeping memory bounded.
      const active = new Set(project.assets.map((a) => a.sha256));
      for (const key of this.images.keys())
        if (!active.has(key)) this.images.delete(key);
      const visibleVariants = new Set(
        project.layers
          .filter((l) => l.visible)
          .map((l) => {
            const a = project.assets.find((a) => a.id === l.assetId)!;
            return `${a.sha256}:${l.removePaper}:${l.monochrome}`;
          }),
      );
      for (const key of this.processed.keys())
        if (!visibleVariants.has(key)) this.processed.delete(key);
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
    x.fillStyle = "#e8e6de";
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
    x.fillStyle = "#243c31";
    x.font = "32px sans-serif";
    x.fillText("FORM / STUDIO", 80, 78);
    x.font = "20px sans-serif";
    x.fillText(project.name.slice(0, 70), 80, 120);
    x.strokeStyle = "#bfc6ba";
    x.beginPath();
    x.moveTo(80, 1660);
    x.lineTo(1720, 1660);
    x.stroke();
    x.font = "24px sans-serif";
    x.fillText(
      `${project.body.side === "left" ? "Left" : "Right"} forearm · ${project.revision} · ${project.body.length} mm length`,
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
    this.texture.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
