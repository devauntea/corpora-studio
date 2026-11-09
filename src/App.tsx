import { CorporaMark } from "./CorporaMark";
import { AppearanceControl } from "./appearance";
import { applySurfaceDrawing, type DrawingTargets } from "./surface-drawing";
import "./surface-drawing.css";
import { TripoConnection } from "./TripoConnection";
import { stepRotation } from "./rotation";
import "./rotation.css";
import { StudioHome, type StartTask } from "./StudioHome";
import { BodyLibrary } from "./BodyLibrary";
import { ReviewRoom } from "./ReviewRoom";
import { rasterReviewPreview } from "./review-capture";
import { SculptLibrary, SculptPosePicker } from "./SculptLibrary";
import {
  sculptById,
  sculptIds,
  sculptGroups,
  sculptGroupFor,
  type SculptId,
} from "./sculpt-catalog";
import { TattooPlanningStudio } from "./TattooPlanningStudio";
import { emptyTransferPlan, emptyStudy } from "./tattoo-study";
import { CommandMenu } from "./CommandMenu";
import { skinTones } from "./skin-tones";
import { musclePoseArms, type MusclePose } from "./muscle-pose";
import { PortfolioStudio } from "./PortfolioStudio";
import { BodyFitStudio } from "./BodyFitStudio";
import { LayerGroups } from "./LayerGroups";
import { effectiveLayer } from "./layer-groups";
import { ProjectLibrary } from "./ProjectLibrary";
import { listWorkspace, putWorkspace } from "./workspace-store";
import { newFashion } from "./fashion-model";
import type { Fashion } from "./fashion-model";
import { lazy, Suspense } from "react";
const FashionWorkspace = lazy(() =>
  import("./FashionWorkspace").then((m) => ({ default: m.FashionWorkspace })),
);
const PatternSourceStudio = lazy(() =>
  import("./PatternSourceStudio").then((m) => ({
    default: m.PatternSourceStudio,
  })),
);
const initialFashion = newFashion();
import { detailedMuscleGroups, muscleLegend } from "./muscles";
import { ArtworkStudio } from "./ArtworkStudio";
import { muscleGuide } from "./anatomy";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDown,
  Home,
  MessageSquare,
  ArrowRight,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Scissors,
  PenTool,
  Palette,
  LayoutGrid,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  EyeOff,
  FilePlus2,
  FolderOpen,
  Grip,
  HelpCircle,
  ImagePlus,
  Layers3,
  Maximize,
  Minus,
  MousePointer2,
  Move,
  Plus,
  Redo2,
  Rotate3D,
  Save,
  Settings2,
  ShieldCheck,
  Sun,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import {
  blankProject,
  artworkRatio,
  bodyLabel,
  regionBody,
  regions,
  humanBody,
  sculptBody,
  armPose,
  type ArmPose,
  humanChartSize,
  humanSections,
  bodyZones,
  layerZone,
  type SurfaceZone,
  imageSource,
  artworkAssets,
  ProjectSchema,
  layerForPhoto,
  type Photo,
  clamp,
  historyReducer,
  parseProject,
  wrap,
  LATEST_BODY_REVISION,
  type Asset,
  type Body,
  type History,
  type Layer,
  type Project,
} from "./domain";
import {
  assetFromFile,
  native,
  openProject,
  saveProject,
  saveReview,
} from "./io";
import { StudioScene, type View, type StudioMode } from "./scene";
import { PhotoStage, exportPhoto } from "./photo";
import { starterProject } from "./starter";

function IconButton({
  label,
  children,
  onClick,
  disabled,
  active,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      className={`icon-button ${active ? "active" : ""}`}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
function NumberField({
  label,
  value,
  min,
  max,
  unit = "mm",
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  step?: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(Math.round(value * 10) / 10));
  const focused = useRef(false);
  const cancelled = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(String(Math.round(value * 10) / 10));
  }, [value]);
  const commit = () => {
    focused.current = false;
    if (cancelled.current) {
      cancelled.current = false;
      setText(String(Math.round(value * 10) / 10));
      return;
    }
    const n = text.trim() === "" ? NaN : Number(text);
    const v = Number.isFinite(n) ? clamp(n, min, max) : value;
    setText(String(Math.round(v * 10) / 10));
    if (v !== value) onChange(v);
  };
  return (
    <label className="number-field">
      <span>{label}</span>
      <div>
        <input
          aria-label={label}
          type="number"
          min={min}
          max={max}
          step={step}
          value={text}
          onFocus={() => {
            focused.current = true;
          }}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              cancelled.current = true;
              setText(String(value));
              focused.current = false;
              e.currentTarget.blur();
            }
          }}
        />
        <span>{unit}</span>
      </div>
    </label>
  );
}
function RotationField({
  label,
  value,
  min,
  max,
  onChange,
  begin,
  commit,
  wrap = true,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  begin: () => void;
  commit: () => void;
  wrap?: boolean;
  hint?: string;
}) {
  const dragTo = (input: HTMLInputElement, clientX: number) => {
    const bounds = input.getBoundingClientRect();
    const fraction = Math.max(
      0,
      Math.min(
        1,
        (clientX - bounds.left - 10) / Math.max(1, bounds.width - 20),
      ),
    );
    onChange(Math.round(min + fraction * (max - min)));
  };
  return (
    <div
      className="rotation-control"
      role="group"
      aria-label={`${label} controls`}
    >
      <NumberField
        label={label}
        value={value}
        min={min}
        max={max}
        unit="°"
        onChange={onChange}
      />
      {hint && <small>{hint}</small>}
      <input
        type="range"
        aria-label={`${label} slider`}
        aria-valuetext={`${Math.round(value)} degrees`}
        min={min}
        max={max}
        step={1}
        value={value}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          begin();
          dragTo(event.currentTarget, event.clientX);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.preventDefault();
            dragTo(event.currentTarget, event.clientX);
          }
        }}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId);
          commit();
        }}
        onPointerCancel={commit}
        onBlur={commit}
        onKeyDown={(event) => {
          if (
            [
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "Home",
              "End",
              "PageUp",
              "PageDown",
            ].includes(event.key)
          )
            begin();
        }}
        onKeyUp={commit}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="rotation-steps">
        {[-90, -15, 0, 15, 90].map((delta) => (
          <button
            key={delta}
            type="button"
            aria-label={
              delta === 0
                ? `${label} reset`
                : `${label} ${delta < 0 ? "decrease" : "increase"} ${Math.abs(delta)} degrees`
            }
            onClick={() =>
              onChange(
                delta === 0 ? 0 : stepRotation(value, delta, min, max, wrap),
              )
            }
          >
            {delta > 0 ? "+" : ""}
            {delta}°
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  description?: string;
}) {
  return (
    <button
      className="toggle-row"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
    >
      <span>
        {label}
        {description && <small>{description}</small>}
      </span>
      <span className={`switch ${checked ? "on" : ""}`} />
    </button>
  );
}

export function App() {
  const [history, dispatch] = useReducer(
    historyReducer<Project>,
    undefined,
    () =>
      ({ present: blankProject(), past: [], future: [] }) as History<Project>,
  );
  const project = history.present;
  const sculpt =
    project.body.kind === "human-v1"
      ? sculptById(project.body.model?.sculptId)
      : undefined;
  const [fashionMode, setFashionMode] = useState<
    "patterns" | "vectors" | "assets" | "textiles"
  >("patterns");
  const [studio, setStudio] = useState<"tattoo" | "fashion">("tattoo");
  const patternExporter = useRef<(() => Promise<void>) | null>(null);
  const [workspace, setWorkspace] = useState<"surface" | "photo">("surface");
  const [photoId, setPhotoId] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const [saved, setSaved] = useState<Project | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<StudioMode>("orbit");
  const [brush, setBrush] = useState({
    size: 3,
    color: "#202020",
    erase: false,
  });
  const drawingTargets = useRef<DrawingTargets>(new Map());
  const [inspector, setInspector] = useState<"artwork" | "model">("artwork");
  const [view, setView] = useState<View>("front");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [homeOpen, setHomeOpen] = useState(false);
  const [bodyLibraryOpen, setBodyLibraryOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [patternSourcesOpen, setPatternSourcesOpen] = useState(false);
  const [layerSearch, setLayerSearch] = useState("");
  const [stencilFirst, setStencilFirst] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [planningOpen, setPlanningOpen] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (
          document.querySelector('[role="dialog"]') &&
          !document.querySelector(".command-menu")
        )
          return;
        e.preventDefault();
        setCommandsOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const [help, setHelp] = useState(false);
  const [library, setLibrary] = useState(false);
  const [recovery, setRecovery] = useState("Checking local copies…");
  const storedProjects = useRef(new Set<string>());
  const recoveryQueue = useRef<Promise<void>>(Promise.resolve());
  const recoveryWritten = useRef<Project | null>(null);
  const [editingAsset, setEditingAsset] = useState<string>();
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [stats, setStats] = useState({ p95: 0, frames: 0, triangles: 0 });
  const [showStats, setShowStats] = useState(false);
  const [dragover, setDragover] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const scene = useRef<StudioScene | null>(null);
  const pendingCamera = useRef<View | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);
  const live = useRef({
    project,
    selected,
    saved,
    path,
    busy,
    workspace,
    studio,
    photoId,
  });
  live.current = {
    project,
    selected,
    saved,
    path,
    busy,
    workspace,
    studio,
    photoId,
  };
  const updateScene = useCallback(async (current: Project) => {
    const renderer = scene.current;
    if (!renderer || !(await renderer.update(current))) return false;
    if (live.current.project !== current) return false;
    if (pendingCamera.current) {
      renderer.view(pendingCamera.current, current.body.length);
      setView(pendingCamera.current);
      pendingCamera.current = null;
    }
    return true;
  }, []);
  const dirty = project !== saved;
  // Which tattoo step the person is in: an open step dialog wins over the
  // placement mode underneath it.
  const tattooStep = bodyLibraryOpen
    ? "body"
    : editingAsset
      ? stencilFirst
        ? "stencil"
        : "artwork"
      : mode === "place"
        ? "place"
        : undefined;
  // Opening Fashion supplies a default pattern draft. That default is not a
  // user edit, so it must not add an undo step or mark a clean study unsaved.
  const seedFashion = () => {
    if (project.fashion) return;
    const next = { ...project, fashion: newFashion() };
    dispatch({ type: "seed", value: next });
    if (project === saved) setSaved(next);
  };
  useEffect(() => {
    void listWorkspace()
      .then((entries) => {
        entries
          .filter((e) => e.kind === "recovery")
          .forEach((e) => storedProjects.current.add(e.projectId));
        setRecovery(
          entries.length ? "Local copies available" : "Recovery ready",
        );
      })
      .catch(() => setRecovery("Local recovery unavailable"));
  }, []);
  useEffect(() => {
    if (!ready || !dirty || recoveryWritten.current === project) return;
    setRecovery("Saving local copy…");
    const timer = setTimeout(() => {
      const current = project;
      recoveryQueue.current = recoveryQueue.current
        .catch(() => {})
        .then(async () => {
          try {
            const content = JSON.stringify(current);
            await putWorkspace(
              {
                id: `recovery-${current.id}`,
                projectId: current.id,
                name: current.name,
                label: "Autosaved workspace",
                kind: "recovery",
                updated: Date.now(),
                bytes: content.length * 2,
                studio,
              },
              content,
            );
            storedProjects.current.add(current.id);
            recoveryWritten.current = current;
            if (live.current.project === current)
              setRecovery("Local copy up to date");
          } catch (e) {
            setRecovery("Recovery needs attention");
            setNotice({ text: String(e), error: true });
          }
        });
    }, 1200);
    return () => clearTimeout(timer);
  }, [project, ready, studio]);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [bodyFitOpen, setBodyFitOpen] = useState(false);
  const [inspectSurface, setInspectSurface] = useState(false);
  const [inspection, setInspection] =
    useState<import("./surface-decals").SurfaceInspection>();
  useEffect(() => {
    if (scene.current) {
      scene.current.inspectionLayer = inspectSurface ? selected : undefined;
      void updateScene(project);
    }
  }, [inspectSurface, selected]);
  const layer = project.layers.find((l) => l.id === selected);
  const groupLocked = Boolean(layer && effectiveLayer(project, layer).locked);
  const photo = project.photos.find((p) => p.id === photoId);
  const visibleLayers = project.layers.filter((l) =>
    workspace === "photo"
      ? Boolean(photoId) && l.photoId === photoId
      : !l.photoId,
  );
  const asset = project.assets.find((a) => a.id === layer?.assetId);
  const placementHeight =
    project.body.kind === "human-v1" && layer
      ? humanChartSize(project.body, layerZone(project.body, layer)).height
      : project.body.length;
  const alert = useCallback(
    (text: string, error = false) => setNotice({ text, error }),
    [],
  );
  const change = useCallback(
    (next: Project) => dispatch({ type: "change", value: next }),
    [],
  );
  const editFashion = useCallback(
    (fashion: Fashion, asset?: Asset) => {
      const p = live.current.project;
      const next = {
        ...p,
        fashion,
        ...(asset
          ? {
              assets: [
                ...p.assets.filter(
                  (a) =>
                    a.id !== p.fashion?.photoStudy?.assetId ||
                    Boolean(
                      p.fashion?.patternSources?.studies.some((study) =>
                        study.sourceAssetIds.includes(a.id),
                      ),
                    ),
                ),
                asset,
              ],
            }
          : {}),
      };
      const result = ProjectSchema.safeParse(next);
      if (result.success) change(next);
      else alert(result.error.issues.map((i) => i.message).join("; "), true);
    },
    [change],
  );
  const beginFashion = useCallback(() => dispatch({ type: "begin" }), []);
  const commitFashion = useCallback(() => dispatch({ type: "commit" }), []);
  const undoFashion = useCallback(() => dispatch({ type: "undo" }), []);
  const redoFashion = useCallback(() => dispatch({ type: "redo" }), []);
  const editLayer = useCallback(
    (patch: Partial<Layer>) => {
      const p = live.current.project,
        id = live.current.selected;
      if (
        (p.layers.find((l) => l.id === id)?.locked ||
          p.groups?.some(
            (g) =>
              g.locked && g.id === p.layers.find((l) => l.id === id)?.groupId,
          )) &&
        (patch.locked === undefined ||
          p.groups?.some(
            (g) =>
              g.locked && g.id === p.layers.find((l) => l.id === id)?.groupId,
          ))
      )
        return;
      const current = p.layers.find((l) => l.id === id);
      if (
        current?.surface &&
        !Object.hasOwn(patch, "surface") &&
        (patch.u !== undefined ||
          patch.v !== undefined ||
          patch.zone !== undefined)
      ) {
        patch = {
          ...patch,
          surface: scene.current?.human?.decals.nearestAnchor({
            ...current,
            ...patch,
          }),
        };
      }
      change({
        ...p,
        layers: p.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      });
    },
    [change],
  );
  const [hoveredMuscle, setHoveredMuscle] = useState<number | undefined>();
  const editBody = (patch: Partial<Body>, replace = false) => {
    const body = (replace ? patch : { ...project.body, ...patch }) as Body;
    const changedMesh =
      body.kind !== project.body.kind ||
      (body.kind === "human-v1" &&
        project.body.kind === "human-v1" &&
        (body.model?.sculptId !== project.body.model?.sculptId ||
          body.model?.sex !== project.body.model?.sex ||
          body.model?.revision !== project.body.model?.revision));
    if (
      body.kind === "human-v1" &&
      project.body.kind === "human-v1" &&
      (changedMesh || body.muscularity !== project.body.muscularity)
    )
      body.fitting = undefined;
    change({
      ...project,
      body,
      layers: changedMesh
        ? project.layers.map((l) => ({ ...l, surface: undefined }))
        : project.layers,
    });
    if (changedMesh && project.layers.some((l) => l.surface))
      alert(
        "Body mesh changed. Connected placements returned to chart positions; re-anchor them on this model.",
      );
  };

  useEffect(() => {
    let active = true;
    starterProject()
      .then((p) => {
        if (active) {
          dispatch({ type: "reset", value: p });
          setSelected(p.layers[0].id);
          setSaved(p);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setReady(true);
          alert(
            "Could not load the starter artwork. You can import your own image.",
            true,
          );
        }
      });
    return () => {
      active = false;
    };
  }, [alert]);

  useEffect(() => {
    if (!stage.current) return;
    try {
      scene.current = new StudioScene(stage.current, {
        draw: async (strokes) => {
          const before = live.current.project;
          try {
            const result = await applySurfaceDrawing(
              before,
              strokes,
              drawingTargets.current,
            );
            if (live.current.project !== before) {
              alert("The project changed during the stroke. Draw it again.");
              return;
            }
            if (result.project === before) return;
            drawingTargets.current = result.targets;
            change(result.project);
            if (result.selected) {
              setSelected(result.selected);
              setInspector("artwork");
            }
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve()),
            );
            await updateScene(result.project);
          } catch (error) {
            alert(
              error instanceof Error
                ? error.message
                : "The drawing could not be saved.",
              true,
            );
          }
        },
        begin: () => dispatch({ type: "begin" }),
        move: (u, v, zone, vertex) =>
          editLayer({
            u: wrap(u),
            v: clamp(v, 0, 1),
            ...(zone ? { zone } : {}),
            ...(live.current.project.layers.find(
              (l) => l.id === live.current.selected,
            )?.surface &&
            vertex !== undefined &&
            live.current.project.body.kind === "human-v1" &&
            live.current.project.body.model
              ? {
                  surface: {
                    vertex,
                    revision: live.current.project.body.model.revision,
                    sex: live.current.project.body.model.sex,
                    ...(live.current.project.body.model.sculptId
                      ? { sculptId: live.current.project.body.model.sculptId }
                      : {}),
                  },
                }
              : {}),
          }),
        end: () => dispatch({ type: "commit" }),
        stats: setStats,
        inspection: setInspection,
        hoverMuscle: setHoveredMuscle,
        error: (message) => alert(message, true),
      });
      return () => {
        scene.current?.dispose();
        scene.current = null;
      };
    } catch {
      alert(
        "3D rendering is unavailable. This workspace requires WebGL 2. Your saved files are safe.",
        true,
      );
    }
  }, [alert, editLayer, change, updateScene]);
  useEffect(() => {
    if (workspace === "surface" && studio === "tattoo" && !planningOpen)
      void updateScene(project);
  }, [project, workspace, studio, planningOpen]);
  useEffect(() => {
    if (scene.current) scene.current.brush = brush;
  }, [brush]);
  useEffect(() => {
    scene.current?.setMode(
      mode,
      groupLocked || layer?.photoId ? undefined : selected,
    );
    if (scene.current)
      scene.current.active =
        workspace === "surface" && studio === "tattoo" && !planningOpen;
  }, [
    mode,
    selected,
    groupLocked,
    layer?.photoId,
    workspace,
    studio,
    planningOpen,
  ]);
  useEffect(() => {
    if (notice && !notice.error) {
      const t = setTimeout(() => setNotice(null), 5000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  useEffect(() => {
    if (workspace === "photo" && !project.photos.some((p) => p.id === photoId))
      setPhotoId(project.photos[0]?.id);
    const candidates = project.layers.filter((l) =>
      workspace === "photo"
        ? Boolean(photoId) && l.photoId === photoId
        : !l.photoId,
    );
    if (selected && !candidates.some((l) => l.id === selected))
      setSelected(candidates.at(-1)?.id);
  }, [project, selected, workspace, photoId]);
  useEffect(() => {
    if (!help && !pending && !editingAsset) return;
    const previous = document.activeElement as HTMLElement | null;
    const modal = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () => [
      ...(modal?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
      ) ?? []),
    ];
    focusable()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable(),
        first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [help, pending, editingAsset]);

  const save = useCallback(
    async (as = false) => {
      if (live.current.busy) return false;
      const current = live.current.project;
      setBusy(true);
      try {
        const result = await saveProject(
          JSON.stringify(current),
          as ? null : live.current.path,
          current.name,
        );
        if (!result) return false;
        if (!native) {
          alert(
            "Download requested. Verify the file in your downloads; this browser cannot confirm it was saved. Original images are included.",
          );
          return false;
        }
        setPath(result);
        setSaved(current);
        alert(
          "Project saved with its original images. Use portfolio or review export to share finished views.",
        );
        return true;
      } catch (error) {
        alert(String(error), true);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [alert],
  );
  const guard = useCallback((action: () => void) => {
    if (live.current.busy) return;
    if (live.current.project !== live.current.saved) setPending(() => action);
    else action();
  }, []);
  const load = useCallback(
    async (text: string, filePath: string | null) => {
      setBusy(true);
      try {
        const p = await parseProject(text);
        // parseProject verifies each image's dimensions, budget and decode.
        // Avoid decoding every retained original a second time here.
        dispatch({ type: "reset", value: p });
        setSaved(p);
        setStudio(p.fashion ? "fashion" : "tattoo");
        setPath(JSON.parse(text).version < 19 ? null : filePath);
        setPhotoId(p.photos[0]?.id);
        setWorkspace(p.photos.length ? "photo" : "surface");
        setSelected(
          p.layers
            .filter((l) =>
              p.photos.length ? l.photoId === p.photos[0].id : !l.photoId,
            )
            .at(-1)?.id,
        );
        pendingCamera.current = "front";
        setView("front");
        alert(
          JSON.parse(text).version < 19
            ? "Legacy project opened without changing placement. Save creates a new v19 copy."
            : "Project opened. All original image integrity checks passed.",
        );
      } catch (error) {
        alert(error instanceof Error ? error.message : String(error), true);
      } finally {
        setBusy(false);
      }
    },
    [alert],
  );
  const open = useCallback(
    () =>
      guard(() => {
        if (!native) {
          projectInput.current?.click();
          return;
        }
        void openProject()
          .then((result) => {
            if (result) void load(result.content, result.path);
          })
          .catch((error) => alert(String(error), true));
      }),
    [guard, load, alert],
  );
  const create = () =>
    guard(() => {
      const p = blankProject();
      p.body = humanBody("full-arm");
      if (studio === "fashion") {
        p.fashion = newFashion();
        p.name = "Untitled garment";
      }
      dispatch({ type: "reset", value: p });
      setSaved(p);
      setPath(null);
      setSelected(undefined);
      setPhotoId(undefined);
      setWorkspace("surface");
      setInspector("model");
      pendingCamera.current = "front";
      setView("front");
    });
  const startTask = (task: StartTask) => {
    setHomeOpen(false);
    guard(() => {
      const next = blankProject();
      next.body = humanBody("full-arm");
      if (task !== "tattoo") {
        next.fashion = newFashion();
        next.name =
          task === "vectors" ? "Untitled technical flat" : "Untitled garment";
      }
      dispatch({ type: "reset", value: next });
      setSaved(next);
      setPath(null);
      setSelected(undefined);
      setPhotoId(undefined);
      setStudio(task === "tattoo" ? "tattoo" : "fashion");
      setFashionMode(task === "vectors" ? "vectors" : "patterns");
      setWorkspace("surface");
      setInspector("model");
      setFocusMode(false);
      setLayerSearch("");
      setView("front");
      pendingCamera.current = "front";
      if (task === "tattoo") setBodyLibraryOpen(true);
    });
  };
  const prepareArtwork = (stencil = false) => {
    const id = asset?.id ?? artworkAssets(project)[0]?.id;
    if (!id) {
      imageInput.current?.click();
      return;
    }
    setStencilFirst(stencil);
    setEditingAsset(id);
  };
  const captureReview = async () => {
    if (studio === "tattoo") {
      if (workspace === "photo") {
        if (!photo)
          throw new Error(
            "Import a body photograph before capturing this view.",
          );
        return rasterReviewPreview(await exportPhoto(project, photo));
      }
      if (!(await updateScene(project)) || !scene.current)
        throw new Error(
          "Wait for the current view to finish loading, then capture again.",
        );
      return rasterReviewPreview(scene.current.exportReview(project));
    }
    if (fashionMode === "assets")
      throw new Error(
        "Open Patterns or Vector packs to capture a design view.",
      );
    if (fashionMode === "vectors" || fashionMode === "textiles") {
      if (!project.fashion?.vectorPack)
        throw new Error("Create a technical flat before capturing it.");
      const { vectorSvg } = await import("./vector-export");
      const source = URL.createObjectURL(
        new Blob([vectorSvg(project.fashion.vectorPack)], {
          type: "image/svg+xml",
        }),
      );
      try {
        return await rasterReviewPreview(source);
      } finally {
        URL.revokeObjectURL(source);
      }
    }
    const { projectPreview } = await import("./project-preview");
    const source = await projectPreview(project, "pattern");
    try {
      return await rasterReviewPreview(source);
    } finally {
      URL.revokeObjectURL(source);
    }
  };
  const importImage = async (files: FileList | File[]) => {
    if (busy || !files.length) return;
    if (workspace === "photo" && !photoId) {
      alert("Add a body photograph before placing artwork.");
      return;
    }
    if (
      project.layers.length + files.length > 24 ||
      project.assets.length + files.length > 24
    ) {
      alert(
        "This build supports up to 24 artwork assets and layers per project.",
        true,
      );
      return;
    }
    setBusy(true);
    try {
      const assets: Asset[] = [];
      for (const file of Array.from(files))
        assets.push(await assetFromFile(file));
      const p = live.current.project;
      const total = [...p.assets, ...assets].reduce(
        (sum, a) => sum + a.data.length + (a.preview?.length ?? 0),
        0,
      );
      if (total > 70_000_000)
        throw new Error(
          "The combined artwork exceeds this build’s 70 MB budget. Use smaller images.",
        );
      if (
        [...p.assets, ...assets].reduce(
          (sum, a) => sum + a.width * a.height,
          0,
        ) > 64_000_000
      )
        throw new Error(
          "The combined artwork exceeds the 64 megapixel project budget. Resize the source images before importing.",
        );
      const layers = assets.map((a) =>
        layerForPhoto(
          a,
          live.current.workspace === "photo" ? live.current.photoId : undefined,
        ),
      );
      change({
        ...p,
        assets: [...p.assets, ...assets],
        layers: [...p.layers, ...layers],
      });
      setSelected(layers.at(-1)!.id);
      setInspector("artwork");
      setMode("place");
      alert(
        `${assets.length === 1 ? assets[0].name : `${assets.length} images`} imported locally.`,
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error), true);
    } finally {
      setBusy(false);
    }
  };
  const exportImage = useCallback(async () => {
    if (live.current.busy) return;
    setBusy(true);
    try {
      const current = live.current.project;
      if (live.current.workspace === "photo") {
        const ph = current.photos.find((p) => p.id === live.current.photoId);
        if (!ph) throw new Error("Import a body photograph first.");
        if (await saveReview(await exportPhoto(current, ph), current.name))
          alert("Photo review exported with its artistic-preview label.");
        return;
      }
      if (!(await updateScene(current)) || !scene.current)
        throw new Error(
          "The current artwork is not ready to export. Try again after the preview finishes.",
        );
      const result = await saveReview(
        scene.current.exportReview(current),
        current.name,
      );
      if (result)
        alert("Review image exported with the approximate-model label.");
    } catch (error) {
      alert(String(error), true);
    } finally {
      setBusy(false);
    }
  }, [alert]);
  const removeLayer = useCallback(() => {
    const p = live.current.project;
    const selectedLayer = p.layers.find((l) => l.id === live.current.selected);
    if (selectedLayer && effectiveLayer(p, selectedLayer).locked) return;
    change({
      ...p,
      layers: p.layers.filter(
        (l) => l.id !== live.current.selected || effectiveLayer(p, l).locked,
      ),
    });
  }, [change]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) {
        if (e.key === "Escape") {
          setHelp(false);
          setPending(null);
        }
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && ["s", "o", "z", "e"].includes(e.key.toLowerCase())) {
        if (
          e.key.toLowerCase() === "z" &&
          /INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName)
        )
          return;
        e.preventDefault();
        if (live.current.busy) return;
        switch (e.key.toLowerCase()) {
          case "s":
            void save(e.shiftKey);
            break;
          case "o":
            open();
            break;
          case "z":
            dispatch({ type: e.shiftKey ? "redo" : "undo" });
            break;
          case "e":
            if (live.current.studio === "fashion")
              void patternExporter.current?.();
            else void exportImage();
            break;
        }
      } else if (
        !mod &&
        !/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)
      ) {
        if (live.current.studio === "fashion") return;
        if (e.key.startsWith("Arrow")) {
          const l = live.current.project.layers.find(
            (l) => l.id === live.current.selected,
          );
          if (!l || effectiveLayer(live.current.project, l).locked) return;
          e.preventDefault();
          const step = e.shiftKey ? 0.01 : 0.001,
            dx =
              e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0,
            dy = e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0;
          editLayer(
            l.photo
              ? {
                  photo: {
                    ...l.photo,
                    x: clamp(l.photo.x + dx, 0, 1),
                    y: clamp(l.photo.y + dy, 0, 1),
                  },
                }
              : { u: wrap(l.u + dx), v: clamp(l.v - dy, 0, 1) },
          );
        }
        if (e.key === "v") setMode("orbit");
        if (e.key === "b") setMode("draw");
        if (e.key === "h") setMode("pan");
        if (e.key === "g") setMode("place");
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          removeLayer();
        }
        if (e.key === "Escape") {
          setHelp(false);
          setPending(null);
          setMode("orbit");
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [save, open, exportImage, removeLayer, editLayer]);
  useEffect(() => {
    if (!native) return;
    let unlisten: (() => void)[] = [],
      cancelled = false;
    const requestClose = () => {
      if (document.querySelector('[aria-label="Tattoo image studio"]')) {
        window.dispatchEvent(new Event("artwork-close-request"));
        return;
      }
      guard(() => {
        void invoke("close_app");
      });
    };
    Promise.all([
      getCurrentWindow().onCloseRequested((event) => {
        event.preventDefault();
        requestClose();
      }),
      listen("app-quit-requested", requestClose),
      listen<"undo" | "redo">("editor-history", ({ payload }) => {
        if (live.current.busy || document.querySelector('[role="dialog"]'))
          return;
        if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName ?? ""))
          document.execCommand(payload);
        else dispatch({ type: payload });
      }),
    ])
      .then((functions) => {
        if (cancelled) functions.forEach((fn) => fn());
        else unlisten = functions;
      })
      .catch(() =>
        alert(
          "Close protection could not start. Save your project before closing.",
          true,
        ),
      );
    return () => {
      cancelled = true;
      unlisten.forEach((fn) => fn());
    };
  }, [guard, alert]);

  const duplicate = () => {
    if (!layer || project.layers.length >= 24) return;
    const copy = {
      ...layer,
      id: crypto.randomUUID(),
      locked: false,
      ...(layer.photo
        ? { photo: { ...layer.photo, x: clamp(layer.photo.x + 0.04, 0, 1) } }
        : {}),
      name: `${layer.name.slice(0, 170)} copy`,
      u: wrap(layer.u + 0.08),
    };
    change({ ...project, layers: [...project.layers, copy] });
    setSelected(copy.id);
  };
  const reorder = (direction: number) => {
    if (!layer) return;
    const list = [...project.layers],
      index = list.findIndex((l) => l.id === layer.id),
      nextId =
        visibleLayers[
          visibleLayers.findIndex((l) => l.id === layer.id) + direction
        ]?.id,
      next = list.findIndex((l) => l.id === nextId);
    if (next < 0 || next >= list.length) return;
    [list[index], list[next]] = [list[next], list[index]];
    change({ ...project, layers: list });
  };
  const chooseView = (v: View) => {
    if (pendingCamera.current) pendingCamera.current = v;
    scene.current?.view(v);
    setView(v);
  };
  const switchWorkspace = (next: "surface" | "photo", id = photoId) => {
    setWorkspace(next);
    setPhotoId(id);
    setSelected(
      project.layers
        .filter((l) =>
          next === "photo" ? Boolean(id) && l.photoId === id : !l.photoId,
        )
        .at(-1)?.id,
    );
  };
  const editPhoto = (ph: Photo) =>
    change({
      ...live.current.project,
      photos: live.current.project.photos.map((p) => (p.id === ph.id ? ph : p)),
    });
  const importPhotos = async (files: FileList) => {
    if (busy || !files.length) return;
    setBusy(true);
    try {
      const added: Asset[] = [];
      for (const file of Array.from(files))
        added.push({ ...(await assetFromFile(file)), role: "body" });
      const p = live.current.project,
        photos = added.map((a) => ({
          id: crypto.randomUUID(),
          assetId: a.id,
          masks: [],
        }));
      const next = await parseProject(
        JSON.stringify({
          ...p,
          assets: [...p.assets, ...added],
          photos: [...p.photos, ...photos],
        }),
      );
      change(next);
      setPhotoId(photos[0].id);
      setWorkspace("photo");
      setSelected(undefined);
      setInspector("artwork");
      alert(
        "Body photographs imported locally. Originals are embedded unchanged.",
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  };
  const editPose = (patch: Partial<ArmPose>) => {
    const body = project.body;
    if (body.kind !== "human-v1") return;
    if (body.section === "full-leg") {
      editBody({ flex: patch.flex ?? body.flex });
      return;
    }
    const poses = {
      left: armPose(body, "left"),
      right: armPose(body, "right"),
    };
    editBody({
      armPose: { ...poses, [body.side]: { ...poses[body.side], ...patch } },
    });
  };
  const truncated =
    layer && asset
      ? layer.width * artworkRatio(asset) * (layer.stretch ?? 1) >
        placementHeight
        ? "Artwork extends beyond the model. Scale it down to see the full composition."
        : null
      : null;

  return (
    <div className={`app-shell ${focusMode ? "focus-workspace" : ""}`}>
      <input
        className="file-input"
        ref={photoInput}
        type="file"
        accept="image/png,image/jpeg,image/heic,.heic,.HEIC"
        multiple
        aria-label="Import body photos"
        onChange={(e) => {
          if (e.target.files) void importPhotos(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        className="file-input"
        ref={imageInput}
        type="file"
        aria-label="Artwork file"
        accept="image/png,image/jpeg"
        multiple
        onChange={(e) => {
          if (e.target.files) void importImage(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        className="file-input"
        ref={projectInput}
        type="file"
        aria-label="Project file"
        accept=".formstudio"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            if (file.size > 80_000_000) alert("Project exceeds 80 MB.", true);
            else await load(await file.text(), null);
          }
          e.target.value = "";
        }}
      />
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <CorporaMark size={26} />
          </span>
          <span>
            CORPORA<span className="brand-slash"> / </span>STUDIO
          </span>
          <span className="build-badge">LOCAL WORKSPACE</span>
        </div>
        <button
          className="studio-home-trigger"
          aria-label="Studio home"
          onClick={(e) => {
            e.currentTarget.focus();
            setHomeOpen(true);
          }}
        >
          <Home size={16} />
          <span>Home</span>
        </button>
        <nav className="studio-switch" aria-label="Studio section">
          <button
            className={studio === "tattoo" ? "active" : ""}
            aria-pressed={studio === "tattoo"}
            onClick={() => setStudio("tattoo")}
          >
            Tattoo
          </button>
          <button
            className={studio === "fashion" ? "active" : ""}
            aria-pressed={studio === "fashion"}
            disabled={!ready || busy}
            onClick={() => {
              setStudio("fashion");
              seedFashion();
            }}
          >
            Fashion
          </button>
        </nav>
        <div className="topbar-actions">
          <AppearanceControl />
          <button
            className="quick-actions-trigger"
            aria-label="Quick actions (⌘K)"
            onClick={(e) => {
              e.currentTarget.focus();
              setCommandsOpen(true);
            }}
          >
            <Search size={15} />
            <span>Quick actions</span>
            <kbd>⌘ K</kbd>
          </button>
          <button
            className="local-library-button"
            aria-label="Open project library"
            onClick={() => setLibrary(true)}
          >
            <FolderOpen size={14} /> Project library
          </button>
          <IconButton
            label="Help and keyboard shortcuts"
            onClick={() => setHelp(true)}
          >
            <HelpCircle size={18} />
          </IconButton>
        </div>
      </header>
      <div className="projectbar">
        <div className="project-name">
          <span className="workspace-symbol">
            <Sun size={20} />
          </span>
          <div>
            <div className="breadcrumb">
              {studio === "fashion" ? "FASHION STUDIO" : "TATTOO STUDIO"}{" "}
              <span>/</span>{" "}
              {studio === "fashion"
                ? fashionMode === "assets"
                  ? "ASSET LIBRARY"
                  : fashionMode === "textiles"
                    ? "FABRIC & COLOR"
                    : fashionMode !== "patterns"
                      ? "VECTOR PACKS"
                      : "PATTERN DESIGN"
                : "COMPOSITION"}
            </div>
            <input
              aria-label="Project name"
              value={project.name}
              maxLength={100}
              onChange={(e) => {
                if (e.target.value.trim())
                  change({ ...project, name: e.target.value });
              }}
            />
          </div>
          <span
            className={`save-state ${dirty ? "dirty" : ""}`}
            title={recovery}
          >
            <i />
            {dirty ? "Unsaved changes" : path ? "Saved" : "New study"}
          </span>
        </div>
        <div className="project-actions">
          <button
            className="review-room-trigger"
            disabled={busy || !ready}
            onClick={(e) => {
              e.currentTarget.focus();
              setReviewOpen(true);
            }}
          >
            <MessageSquare size={15} /> Review room
          </button>
          <button
            onClick={(e) => {
              e.currentTarget.focus();
              setPortfolioOpen(true);
            }}
            disabled={busy || !ready}
          >
            Portfolio
          </button>
          <IconButton label="New project" onClick={create} disabled={busy}>
            <FilePlus2 size={17} />
          </IconButton>
          <IconButton label="Open project (⌘O)" onClick={open} disabled={busy}>
            <FolderOpen size={18} />
          </IconButton>
          <div className="divider" />
          <IconButton
            label="Undo (⌘Z)"
            onClick={() => dispatch({ type: "undo" })}
            disabled={!history.past.length || busy}
          >
            <Undo2 size={18} />
          </IconButton>
          <IconButton
            label="Redo (⇧⌘Z)"
            onClick={() => dispatch({ type: "redo" })}
            disabled={!history.future.length || busy}
          >
            <Redo2 size={18} />
          </IconButton>
          <div className="divider" />
          <div className="split-button">
            <button onClick={() => void save()} disabled={busy}>
              <Save size={15} /> Save
            </button>
            <button
              aria-label="Save project as (⇧⌘S)"
              title="Save As"
              onClick={() => void save(true)}
              disabled={busy}
            >
              <ChevronDown size={13} />
            </button>
          </div>
          {!(
            studio === "fashion" &&
            (fashionMode === "vectors" || fashionMode === "textiles")
          ) && (
            <button
              className="primary"
              onClick={() =>
                studio === "fashion"
                  ? void patternExporter.current?.()
                  : void exportImage()
              }
              disabled={busy || !ready}
            >
              <Download size={15} />{" "}
              {studio === "fashion"
                ? fashionMode !== "patterns"
                  ? "Export pack"
                  : "Export pattern"
                : "Export review"}
            </button>
          )}
        </div>
      </div>
      <div className="workspace-nav">
        <span className="workspace-nav-label">
          {studio === "fashion" ? "FASHION WORKSPACE" : "TATTOO WORKSPACE"}
        </span>
        {studio === "fashion" ? (
          <nav aria-label="Fashion workspaces">
            <button
              aria-label="Open pattern workspace"
              className={fashionMode === "patterns" ? "active" : ""}
              aria-pressed={fashionMode === "patterns"}
              onClick={() => setFashionMode("patterns")}
            >
              <Scissors size={15} />
              Patterns<span>65</span>
            </button>
            <button
              aria-label="Open vector workspace"
              className={fashionMode === "vectors" ? "active" : ""}
              aria-pressed={fashionMode === "vectors"}
              onClick={() => setFashionMode("vectors")}
            >
              <PenTool size={15} />
              Vector packs
            </button>
            <button
              aria-label="Open fabric and color workspace"
              className={fashionMode === "textiles" ? "active" : ""}
              aria-pressed={fashionMode === "textiles"}
              onClick={() => setFashionMode("textiles")}
            >
              <Palette size={15} />
              Fabric & color
            </button>
            <button
              aria-label="Browse garment library"
              className={fashionMode === "assets" ? "active" : ""}
              aria-pressed={fashionMode === "assets"}
              onClick={() => {
                setFashionMode("assets");
                setFocusMode(false);
              }}
            >
              <LayoutGrid size={15} />
              Asset library<span>112</span>
            </button>
            <button
              onClick={() => setPatternSourcesOpen(true)}
              aria-label="Open pattern image inventory"
            >
              <ImagePlus size={15} />
              Image inventory
            </button>
          </nav>
        ) : (
          <nav className="task-path" aria-label="Tattoo workflow">
            <button
              className={tattooStep === "body" ? "active" : ""}
              aria-current={tattooStep === "body" ? "step" : undefined}
              onClick={(e) => {
                e.currentTarget.focus();
                setBodyLibraryOpen(true);
              }}
            >
              <span>01</span> Choose body
            </button>
            <button
              className={tattooStep === "artwork" ? "active" : ""}
              aria-current={tattooStep === "artwork" ? "step" : undefined}
              onClick={() => prepareArtwork()}
              disabled={busy}
            >
              <span>02</span> Prepare artwork
            </button>
            <button
              className={tattooStep === "place" ? "active" : ""}
              aria-current={tattooStep === "place" ? "step" : undefined}
              disabled={!layer}
              onClick={() => {
                setInspector("artwork");
                setMode("place");
              }}
            >
              <span>03</span> Place & adjust
            </button>
            <button
              className={tattooStep === "stencil" ? "active" : ""}
              aria-current={tattooStep === "stencil" ? "step" : undefined}
              onClick={() => prepareArtwork(true)}
              disabled={busy || !artworkAssets(project).length}
            >
              <span>04</span> Make stencil
            </button>
          </nav>
        )}
        {studio === "tattoo" &&
          workspace === "surface" &&
          project.body.kind === "human-v1" &&
          !sculpt && (
            <button
              className={`task-extra ${planningOpen ? "active" : ""}`}
              onClick={() => setPlanningOpen(true)}
            >
              Pose & sleeve study
            </button>
          )}
        {!(studio === "fashion" && fashionMode === "assets") && (
          <button
            className="focus-toggle"
            aria-label={
              focusMode ? "Show workspace panels" : "Hide panels for focus mode"
            }
            aria-pressed={focusMode}
            onClick={() => setFocusMode((v) => !v)}
          >
            {focusMode ? (
              <PanelLeftOpen size={15} />
            ) : (
              <PanelLeftClose size={15} />
            )}
            <span>{focusMode ? "Show panels" : "Focus mode"}</span>
          </button>
        )}
      </div>
      {studio === "fashion" && (
        <Suspense
          fallback={
            <div className="fashion-loading">Loading pattern studio…</div>
          }
        >
          <FashionWorkspace
            key={project.id}
            value={project.fashion ?? initialFashion}
            onModeChange={setFashionMode}
            mode={fashionMode}
            assets={project.assets}
            body={project.body}
            onChange={editFashion}
            onBegin={beginFashion}
            onCommit={commitFashion}
            undo={undoFashion}
            redo={redoFashion}
            canUndo={history.past.length > 0}
            canRedo={history.future.length > 0}
            busy={busy}
            setBusy={setBusy}
            notify={alert}
            name={project.name}
            exporter={patternExporter}
          />
        </Suspense>
      )}
      <main
        className={`workspace ${studio === "fashion" ? "studio-hidden" : ""}`}
      >
        <aside className="library">
          <div className="panel-title">
            <span>COMPOSITION</span>
            <span className="count">
              {visibleLayers.length.toString().padStart(2, "0")}
            </span>
          </div>
          <div className="workspace-switch" aria-label="Visualization mode">
            <button
              className={workspace === "surface" ? "active" : ""}
              onClick={() => switchWorkspace("surface")}
            >
              3D surface
            </button>
            <button
              className={workspace === "photo" ? "active" : ""}
              onClick={() => switchWorkspace("photo")}
            >
              Photograph
            </button>
          </div>
          {workspace === "photo" && (
            <div className="photo-library">
              <button
                className="wide-button"
                disabled={busy}
                onClick={() => photoInput.current?.click()}
              >
                <ImagePlus size={15} /> Add body photos
              </button>
              <div className="photo-list">
                {project.photos.map((ph) => {
                  const a = project.assets.find((a) => a.id === ph.assetId)!;
                  return (
                    <button
                      className={ph.id === photoId ? "active" : ""}
                      key={ph.id}
                      onClick={() => switchWorkspace("photo", ph.id)}
                      title={a.name}
                    >
                      <img src={imageSource(a)} alt={a.name} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <button
            className={`body-card ${inspector === "model" ? "chosen" : ""}`}
            onClick={(e) => {
              e.currentTarget.focus();
              setInspector("model");
              setBodyLibraryOpen(true);
            }}
          >
            <span className="body-glyph">◒</span>
            <span>
              <strong>{bodyLabel(project.body)}</strong>
              <small>
                {sculpt
                  ? "Fixed pose · change model"
                  : "Adjustable · change model"}
              </small>
            </span>
            <Settings2 size={15} />
          </button>
          <div className="section-label">
            <span>
              <Layers3 size={13} /> ARTWORK LAYERS
            </span>
            <IconButton
              label="Import artwork"
              onClick={() => imageInput.current?.click()}
              disabled={busy}
            >
              <Plus size={16} />
            </IconButton>
          </div>
          <label className="layer-search">
            <Search size={14} />
            <input
              aria-label="Find artwork layers"
              placeholder="Find a layer…"
              value={layerSearch}
              onChange={(e) => setLayerSearch(e.target.value)}
            />
            {layerSearch && (
              <button
                aria-label="Clear layer search"
                onClick={() => setLayerSearch("")}
              >
                <X size={13} />
              </button>
            )}
          </label>
          <LayerGroups project={project} change={change} selected={selected} />
          <div className="layer-list">
            {[...visibleLayers]
              .reverse()
              .filter((l) =>
                l.name.toLowerCase().includes(layerSearch.toLowerCase()),
              )
              .map((l, i) => (
                <div
                  className={`layer-row ${l.id === selected && inspector === "artwork" ? "selected" : ""}`}
                  key={l.id}
                >
                  <button
                    className="layer-select"
                    onClick={() => {
                      setSelected(l.id);
                      setInspector("artwork");
                    }}
                  >
                    <div className="thumb">
                      <img
                        src={imageSource(
                          project.assets.find((a) => a.id === l.assetId)!,
                        )}
                        alt=""
                      />
                    </div>
                    <span>
                      <strong>{l.name}</strong>
                      <small>
                        {l.groupId
                          ? `${project.groups?.find((g) => g.id === l.groupId)?.name} · `
                          : ""}
                        {effectiveLayer(project, l).locked ? "Locked · " : ""}
                        {l.photo
                          ? `${Math.round(l.photo.width * 100)}% photo`
                          : `${l.width.toFixed(0)} mm`}{" "}
                        · {Math.round(l.opacity * 100)}% ink
                      </small>
                    </span>
                  </button>
                  <IconButton
                    label={`${l.visible ? "Hide" : "Show"} ${l.name}`}
                    onClick={() =>
                      change({
                        ...project,
                        layers: project.layers.map((item) =>
                          item.id === l.id
                            ? { ...item, visible: !item.visible }
                            : item,
                        ),
                      })
                    }
                  >
                    {l.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </IconButton>
                  <span className="layer-index">
                    {(visibleLayers.length - i).toString().padStart(2, "0")}
                  </span>
                </div>
              ))}
            {visibleLayers.length > 0 &&
              !visibleLayers.some((l) =>
                l.name.toLowerCase().includes(layerSearch.toLowerCase()),
              ) && (
                <div className="empty-layers">
                  <p>No matching artwork.</p>
                  <button onClick={() => setLayerSearch("")}>
                    Clear search
                  </button>
                </div>
              )}
            {!visibleLayers.length && (
              <div className="empty-layers">
                <Layers3 size={23} />
                <p>Your composition starts here.</p>
                <small>Import artwork, then place it on the surface.</small>
              </div>
            )}
          </div>
          <button
            className="import-button"
            onClick={() => imageInput.current?.click()}
            disabled={busy}
          >
            <ImagePlus size={17} />
            <span>
              Import artwork<small>PNG or JPEG · up to 15 MB each</small>
            </span>
            <Plus size={16} />
          </button>
          <button
            className="image-studio-entry"
            disabled={!artworkAssets(project).length || busy}
            onClick={() =>
              setEditingAsset(asset?.id ?? artworkAssets(project)[0]?.id)
            }
          >
            <ImagePlus size={17} />
            <span>
              Tattoo image studio
              <small>Remove background · erase · restore</small>
            </span>
          </button>
          <div className="library-bottom">
            <div className="section-label">
              <span>SOURCE LIBRARY</span>
              <span>{artworkAssets(project).length}</span>
            </div>
            <div className="asset-grid">
              {artworkAssets(project).map((a) => (
                <button
                  title={`Add another layer of ${a.name}`}
                  aria-label={`Add ${a.name} from library`}
                  key={a.id}
                  disabled={workspace === "photo" && !photoId}
                  onClick={() => {
                    if (project.layers.length >= 24) return;
                    const l = layerForPhoto(
                      a,
                      workspace === "photo" ? photoId : undefined,
                    );
                    change({ ...project, layers: [...project.layers, l] });
                    setSelected(l.id);
                    setInspector("artwork");
                  }}
                >
                  <img src={imageSource(a)} alt={a.name} />
                </button>
              ))}
            </div>
            <p>
              Original artwork stays intact.
              <br />
              Every edit is reversible.
            </p>
            <div className="next-studio">
              <Grip size={19} />
              <span>
                One creative practice.
                <small>Tattoo & fashion, in one studio.</small>
              </span>
            </div>
          </div>
        </aside>

        <section
          className={`viewport ${workspace === "photo" ? "photo-mode" : project.body.kind === "human-v1" && (project.body.model?.revision ?? 0) >= 5 ? "reference-stage" : ""} ${dragover ? "drag-over" : ""}`}
          aria-label="Tattoo workspace"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) {
              e.preventDefault();
              setDragover(true);
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node))
              setDragover(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragover(false);
            void importImage(e.dataTransfer.files);
          }}
        >
          <div
            ref={stage}
            className="canvas-host"
            style={{
              visibility: workspace === "surface" ? "visible" : "hidden",
            }}
          />
          {workspace === "photo" &&
            (photo ? (
              <PhotoStage
                key={photo.id}
                project={project}
                photo={photo}
                selected={selected}
                onSelect={(id) => {
                  setSelected(id);
                  live.current.selected = id;
                  setInspector("artwork");
                }}
                onLayer={editLayer}
                onPhoto={editPhoto}
                begin={() => dispatch({ type: "begin" })}
                end={() => dispatch({ type: "commit" })}
                onError={alert}
              />
            ) : (
              <div className="photo-empty">
                <ImagePlus size={38} />
                <h1>Start with your own canvas.</h1>
                <p>Add body photos to compose around existing tattoos.</p>
                <button
                  className="primary"
                  onClick={() => photoInput.current?.click()}
                >
                  Import body photographs
                </button>
                <small>PNG / JPEG / HEIC on macOS · Kept on this device</small>
              </div>
            ))}
          {workspace === "surface" &&
            project.body.kind === "human-v1" &&
            project.body.model &&
            project.body.anatomy &&
            hoveredMuscle !== undefined &&
            detailedMuscleGroups[hoveredMuscle] && (
              <div className="anatomy-caption">
                <span
                  className="muscle-dot"
                  style={{
                    background:
                      hoveredMuscle !== undefined &&
                      detailedMuscleGroups[hoveredMuscle]
                        ? detailedMuscleGroups[hoveredMuscle].color
                        : "#c4b7a4",
                  }}
                />
                <div>
                  <strong>
                    {hoveredMuscle !== undefined &&
                    detailedMuscleGroups[hoveredMuscle]
                      ? detailedMuscleGroups[hoveredMuscle].name
                      : "Muscle anatomy"}
                  </strong>
                  <small>
                    {hoveredMuscle !== undefined &&
                    detailedMuscleGroups[hoveredMuscle]
                      ? detailedMuscleGroups[hoveredMuscle].flow
                      : "Point at a muscle to identify its group and flow."}
                  </small>
                </div>
              </div>
            )}
          <div className="viewport-heading">
            <div>
              <span className="eyebrow">
                {sculpt ? "SCULPT STUDY" : "BODY COMPOSITION"}
              </span>
              <h1>{bodyLabel(project.body)}</h1>
              <p>
                {project.body.length} mm <span>·</span>{" "}
                {sculpt ? "Fixed sculpt pose" : "Editable surface"}
              </p>
            </div>
            <span className="approx-badge">
              <i /> Approximate model
            </span>
          </div>
          <div className="canvas-context" aria-label="Active canvas tool">
            <span>
              {mode === "place" ? <Move size={14} /> : <Rotate3D size={14} />}{" "}
              {mode === "place"
                ? "Place artwork"
                : mode === "draw"
                  ? "Draw on model"
                  : mode === "pan"
                    ? "Pan view"
                    : "Orbit view"}
            </span>
            {layer && (
              <>
                <i />
                <strong>{layer.name}</strong>
                <small>{Math.round(layer.width)} mm</small>
              </>
            )}
          </div>
          <div className="view-tools">
            <IconButton
              label="Orbit view (V)"
              active={mode === "orbit"}
              onClick={() => setMode("orbit")}
            >
              <Rotate3D size={20} />
            </IconButton>
            <IconButton
              label="Pan view (H)"
              active={mode === "pan"}
              onClick={() => setMode("pan")}
            >
              <Move size={20} />
            </IconButton>
            <IconButton
              label="Draw on model (B)"
              active={mode === "draw"}
              onClick={() => setMode("draw")}
            >
              <PenTool size={20} />
            </IconButton>
            <IconButton
              label="Place artwork (G)"
              active={mode === "place"}
              onClick={() => setMode("place")}
              disabled={!layer}
            >
              <Move size={20} />
            </IconButton>
            <span />
            <IconButton
              label="Zoom in"
              onClick={() => scene.current?.zoom(0.85)}
            >
              <Plus size={19} />
            </IconButton>
            <IconButton
              label="Zoom out"
              onClick={() => scene.current?.zoom(1.18)}
            >
              <Minus size={19} />
            </IconButton>
            <IconButton
              label="Inspect tattoo fit"
              active={inspectSurface}
              disabled={
                !layer ||
                groupLocked ||
                project.body.kind !== "human-v1" ||
                !!layer.surfaceDrawing
              }
              onClick={() => {
                if (!layer) return;
                setInspector("artwork");
                if (!layer.surface)
                  editLayer({
                    surface: scene.current?.human?.decals.nearestAnchor(layer),
                  });
                setInspectSurface((v) => !v);
              }}
            >
              <Eye size={19} />
            </IconButton>
            <IconButton label="Fit model" onClick={() => chooseView(view)}>
              <Maximize size={18} />
            </IconButton>
          </div>
          {workspace === "surface" && mode === "draw" && (
            <div
              className="surface-brush"
              role="group"
              aria-label="Surface drawing tools"
            >
              <button
                aria-pressed={!brush.erase}
                onClick={() => setBrush({ ...brush, erase: false })}
              >
                Brush
              </button>
              <button
                aria-pressed={brush.erase}
                onClick={() => setBrush({ ...brush, erase: true })}
              >
                Eraser
              </button>
              <label>
                Ink
                <input
                  type="color"
                  aria-label="Drawing ink color"
                  value={brush.color}
                  onChange={(e) =>
                    setBrush({ ...brush, color: e.target.value })
                  }
                />
              </label>
              <label>
                Size
                <input
                  type="range"
                  aria-label="Drawing brush size"
                  min="1"
                  max="15"
                  step=".5"
                  value={brush.size}
                  onChange={(e) =>
                    setBrush({ ...brush, size: Number(e.target.value) })
                  }
                />
                <output>{brush.size} mm</output>
              </label>
              <button onClick={() => setMode("orbit")}>Done</button>
            </div>
          )}
          {workspace === "surface" &&
            project.body.kind === "human-v1" &&
            project.body.model &&
            !sculpt && (
              <div
                className="surface-filter segmented"
                aria-label="Surface filter"
              >
                <button
                  aria-pressed={!project.body.anatomy}
                  className={!project.body.anatomy ? "active" : ""}
                  onClick={() => editBody({ anatomy: false })}
                >
                  Skin
                </button>
                <button
                  aria-pressed={project.body.anatomy}
                  className={project.body.anatomy ? "active" : ""}
                  onClick={() => editBody({ anatomy: true })}
                >
                  Muscles
                </button>
              </div>
            )}
          <div className="axis-indicator">
            <span className="axis-y">Y</span>
            <span className="axis-z">Z</span>
            <span className="axis-x">X</span>
          </div>
          <div className="view-bottom">
            <div className="camera-tabs" aria-label="Camera views">
              {(
                ["front", "left", "back", "right", "three-quarter"] as View[]
              ).map((v) => (
                <button
                  className={v === view ? "selected" : ""}
                  onClick={() => chooseView(v)}
                  key={v}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="interaction-hint">
              {mode === "orbit" ? (
                <>
                  <MousePointer2 size={13} /> Drag to orbit <span>·</span>{" "}
                  Scroll to zoom <span>·</span> Right-drag to pan <span>·</span>{" "}
                  Double-click to inspect
                </>
              ) : (
                <>
                  <Move size={13} />{" "}
                  {mode === "draw"
                    ? "Draw on skin · B brush · V orbit · Scroll zoom · Right-drag pan"
                    : mode === "pan"
                      ? "Drag to pan · Scroll zoom · Double-click to inspect"
                      : "Drag to place · Scroll zoom · Right-drag pan"}
                </>
              )}
            </div>
          </div>
          {dragover && (
            <div className="drop-message">
              <ImagePlus size={34} />
              <strong>Drop artwork onto your workspace</strong>
              <span>Your files stay on this device.</span>
            </div>
          )}
          {!ready && <div className="loading">Preparing your workspace…</div>}
        </section>

        <aside className="inspector">
          <div className="inspector-tabs">
            <button
              className={inspector === "artwork" ? "active" : ""}
              onClick={() => setInspector("artwork")}
            >
              Artwork
            </button>
            <button
              className={inspector === "model" ? "active" : ""}
              onClick={() => setInspector("model")}
            >
              Body model
            </button>
          </div>
          <div className="inspector-scroll">
            {inspector === "artwork" ? (
              layer && asset ? (
                <>
                  <div className="inspector-heading">
                    <span className="eyebrow">SELECTED ARTWORK</span>
                    <h2>{layer.name}</h2>
                    <p>
                      {layer.photo
                        ? "Placed on the selected photograph"
                        : "Bound to the 3D surface"}
                    </p>
                  </div>
                  <div className="artwork-preview">
                    <img
                      src={imageSource(asset)}
                      alt={`${layer.name} original artwork`}
                    />
                    <span>ORIGINAL</span>
                  </div>
                  <button
                    className="wide-button edit-source-button"
                    onClick={() => setEditingAsset(asset.id)}
                  >
                    <ImagePlus size={15} />
                    Edit source in image studio{asset.edits ? " · edited" : ""}
                  </button>
                  <label className="select-field">
                    Layer group
                    <select
                      aria-label="Layer group"
                      disabled={groupLocked}
                      value={layer.groupId ?? ""}
                      onChange={(e) =>
                        editLayer({ groupId: e.target.value || undefined })
                      }
                    >
                      <option value="">Ungrouped</option>
                      {project.groups?.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Toggle
                    label="Lock layer"
                    checked={layer.locked ?? false}
                    onChange={() => editLayer({ locked: !layer.locked })}
                  />
                  <fieldset
                    disabled={groupLocked}
                    className="inspector-section editable-group"
                  >
                    <div className="section-label">
                      <span>PLACEMENT</span>
                      <Move size={14} />
                    </div>
                    {!layer.photo && project.body.kind === "human-v1" && (
                      <label className="select-field">
                        Placement surface
                        <select
                          aria-label="Placement surface"
                          value={layerZone(project.body, layer)}
                          onChange={(e) =>
                            editLayer({ zone: e.target.value as SurfaceZone })
                          }
                        >
                          {bodyZones(project.body).map((z) => (
                            <option key={z} value={z}>
                              {sculpt
                                ? sculpt.name
                                : z === "trunk"
                                  ? "Chest / abdomen / back"
                                  : z.replace("-", " ")}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {!layer.photo &&
                      project.body.kind === "human-v1" &&
                      project.body.model && (
                        <>
                          {layer.surfaceDrawing && (
                            <p className="field-note">
                              Drawn directly on this surface. Use Brush or
                              Eraser to continue; marks follow the model pose.
                            </p>
                          )}
                          {!layer.surfaceDrawing && (
                            <Toggle
                              label="Connected surface placement"
                              checked={!!layer.surface}
                              onChange={() => {
                                const surface = layer.surface
                                  ? undefined
                                  : scene.current?.human?.decals.nearestAnchor(
                                      layer,
                                    );
                                editLayer({ surface });
                              }}
                            />
                          )}
                          {layer.surface && (
                            <>
                              <Toggle
                                label="Inspect surface distortion"
                                checked={inspectSurface}
                                onChange={() => setInspectSurface((v) => !v)}
                              />
                              <p className="field-note">
                                Follows the connected mesh across chart seams.
                                Drag on the body to position. Width is in local
                                surface millimeters.
                              </p>
                              {inspectSurface &&
                                inspection &&
                                (inspection.p95Error > 0.25 ||
                                  inspection.folded > 0) && (
                                  <div className="fit-attention">
                                    <strong>
                                      This placement needs adjustment
                                    </strong>
                                    <p>
                                      The mapping stretches or folds here. Try a
                                      smaller design or move it away from the
                                      joint or sharp curvature.
                                    </p>
                                    <button
                                      onClick={() =>
                                        editLayer({
                                          width: Math.max(5, layer.width * 0.8),
                                        })
                                      }
                                    >
                                      Reduce size 20%
                                    </button>
                                    <button onClick={() => setMode("place")}>
                                      Move on skin
                                    </button>
                                  </div>
                                )}
                              {inspectSurface && inspection && (
                                <p className="field-note" role="status">
                                  {inspection.triangles.toLocaleString()} mapped
                                  triangles. 95th percentile scale error{" "}
                                  {(inspection.p95Error * 100).toFixed(1)}%. Max
                                  stretch {inspection.maxStretch.toFixed(2)}×;
                                  min scale{" "}
                                  {inspection.maxCompression.toFixed(2)}×.{" "}
                                  {inspection.folded} folded triangles omitted.
                                  Green ≤10%, amber ≤25%, red &gt;25%. This is
                                  mapping distortion, not a skin-strain
                                  prediction.
                                </p>
                              )}
                            </>
                          )}
                        </>
                      )}
                    <div className="field-grid">
                      {layer.photo ? (
                        <>
                          <NumberField
                            label="Photo X"
                            value={layer.photo.x * 100}
                            min={0}
                            max={100}
                            unit="%"
                            step={0.1}
                            onChange={(v) =>
                              editLayer({
                                photo: { ...layer.photo!, x: v / 100 },
                              })
                            }
                          />
                          <NumberField
                            label="Photo Y"
                            value={layer.photo.y * 100}
                            min={0}
                            max={100}
                            unit="%"
                            step={0.1}
                            onChange={(v) =>
                              editLayer({
                                photo: { ...layer.photo!, y: v / 100 },
                              })
                            }
                          />
                          <NumberField
                            label="Photo width"
                            value={layer.photo.width * 100}
                            min={1}
                            max={200}
                            unit="%"
                            onChange={(v) =>
                              editLayer({
                                photo: { ...layer.photo!, width: v / 100 },
                              })
                            }
                          />
                          <NumberField
                            label="Shear warp"
                            value={layer.photo.skew * 100}
                            min={-70}
                            max={70}
                            unit="%"
                            onChange={(v) =>
                              editLayer({
                                photo: { ...layer.photo!, skew: v / 100 },
                              })
                            }
                          />
                        </>
                      ) : (
                        <>
                          <NumberField
                            label={
                              project.body.kind === "forearm-v1"
                                ? "Around arm"
                                : "Around surface"
                            }
                            value={(layer.u - 0.5) * 360}
                            min={-180}
                            max={180}
                            unit="°"
                            onChange={(v) =>
                              editLayer({ u: wrap(v / 360 + 0.5) })
                            }
                          />
                          <NumberField
                            label={
                              project.body.kind === "forearm-v1"
                                ? "From wrist"
                                : "From lower edge"
                            }
                            value={layer.v * placementHeight}
                            min={0}
                            max={placementHeight}
                            onChange={(v) =>
                              editLayer({ v: v / placementHeight })
                            }
                          />
                          <NumberField
                            label="Width"
                            value={layer.width}
                            min={5}
                            max={2400}
                            onChange={(v) => editLayer({ width: v })}
                          />
                        </>
                      )}
                      <RotationField
                        begin={beginFashion}
                        commit={commitFashion}
                        hint="Drag to turn the tattoo. Use ±15° for small adjustments."
                        label="Rotation"
                        value={layer.rotation}
                        min={-180}
                        max={180}
                        onChange={(v) => editLayer({ rotation: v })}
                      />
                    </div>
                    <NumberField
                      label="Height stretch"
                      value={(layer.stretch ?? 1) * 100}
                      min={20}
                      max={500}
                      unit="%"
                      onChange={(v) => editLayer({ stretch: v / 100 })}
                    />
                    <div className="transform-actions">
                      <button
                        onClick={() => editLayer({ flipX: !layer.flipX })}
                      >
                        Flip horizontal
                      </button>
                      <button
                        onClick={() => editLayer({ flipY: !layer.flipY })}
                      >
                        Flip vertical
                      </button>
                      <button
                        onClick={() =>
                          editLayer(
                            layer.photo
                              ? { photo: { ...layer.photo, x: 0.5 } }
                              : { u: 0.5 },
                          )
                        }
                      >
                        Center X
                      </button>
                      <button
                        onClick={() =>
                          editLayer(
                            layer.photo
                              ? { photo: { ...layer.photo, y: 0.5 } }
                              : { v: 0.5 },
                          )
                        }
                      >
                        Center Y
                      </button>
                    </div>
                    <p className="field-note">
                      Arrow keys nudge placement. Shift moves 10× further.
                    </p>
                    {workspace === "surface" && (
                      <button
                        className={`wide-button ${mode === "place" ? "enabled" : ""}`}
                        onClick={() =>
                          setMode(mode === "place" ? "orbit" : "place")
                        }
                      >
                        <Move size={14} />
                        {mode === "place"
                          ? "Placement tool active"
                          : "Place on surface"}
                        <kbd>G</kbd>
                      </button>
                    )}
                    {workspace === "surface" && truncated && (
                      <p className="field-note">{truncated}</p>
                    )}
                  </fieldset>
                  <fieldset
                    disabled={groupLocked}
                    className="inspector-section editable-group"
                  >
                    <div className="section-label">
                      <span>INK & APPEARANCE</span>
                      <Sun size={14} />
                    </div>
                    <label className="slider-label">
                      <span>Ink opacity</span>
                      <output>{Math.round(layer.opacity * 100)}%</output>
                    </label>
                    <input
                      aria-label="Ink opacity"
                      className="range"
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(layer.opacity * 100)}
                      onPointerDown={() => dispatch({ type: "begin" })}
                      onPointerUp={() => dispatch({ type: "commit" })}
                      onPointerCancel={() => dispatch({ type: "commit" })}
                      onKeyDown={() => dispatch({ type: "begin" })}
                      onKeyUp={() => dispatch({ type: "commit" })}
                      onBlur={() => dispatch({ type: "commit" })}
                      onChange={(e) =>
                        editLayer({ opacity: +e.target.value / 100 })
                      }
                    />
                    <label className="select-field">
                      Ink preview
                      <select
                        aria-label="Ink preview"
                        value={layer.ink ?? "legacy"}
                        onChange={(e) =>
                          editLayer({ ink: e.target.value as Layer["ink"] })
                        }
                      >
                        {[
                          ["legacy", "Original controls"],
                          ["black", "Solid black"],
                          ["gray", "Black & gray"],
                          ["soft", "Soft gray"],
                          ["color", "Full color"],
                          ["custom", "Custom ink"],
                          ["stencil", "Threshold study"],
                        ].map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {layer.ink === "custom" && (
                      <label className="select-field">
                        Ink color
                        <input
                          type="color"
                          aria-label="Custom ink color"
                          value={layer.inkColor ?? "#29382e"}
                          onChange={(e) =>
                            editLayer({ inkColor: e.target.value })
                          }
                        />
                      </label>
                    )}
                    {layer.ink === "custom" && (
                      <div
                        className="ink-palette"
                        role="group"
                        aria-label="Ink palette"
                      >
                        {[
                          ["Carbon", "#202020"],
                          ["Indigo", "#27324c"],
                          ["Oxide", "#733a32"],
                          ["Forest", "#344b3f"],
                          ["Sepia", "#705541"],
                          ["Violet", "#57415d"],
                        ].map(([name, color]) => (
                          <button
                            key={name}
                            aria-label={`${name} ink`}
                            aria-pressed={layer.inkColor === color}
                            title={name}
                            style={{ background: color }}
                            onClick={() => editLayer({ inkColor: color })}
                          />
                        ))}
                      </div>
                    )}
                    <div className="field-grid">
                      <NumberField
                        label="Contrast"
                        value={(layer.contrast ?? 1) * 100}
                        min={25}
                        max={300}
                        unit="%"
                        onChange={(v) => editLayer({ contrast: v / 100 })}
                      />
                      <NumberField
                        label="Saturation"
                        value={(layer.saturation ?? 1) * 100}
                        min={0}
                        max={200}
                        unit="%"
                        onChange={(v) => editLayer({ saturation: v / 100 })}
                      />
                    </div>
                    {layer.ink === "stencil" && (
                      <NumberField
                        label="Threshold"
                        value={layer.threshold ?? 128}
                        min={0}
                        max={255}
                        unit=""
                        onChange={(v) => editLayer({ threshold: v })}
                      />
                    )}
                    <label className="select-field">
                      Blend
                      <select
                        aria-label="Blend"
                        value={layer.blend ?? "multiply"}
                        onChange={(e) =>
                          editLayer({ blend: e.target.value as Layer["blend"] })
                        }
                      >
                        <option value="multiply">Multiply into surface</option>
                        <option value="source-over">Normal</option>
                      </select>
                    </label>
                    <p className="field-note">
                      Ink is an artistic approximation. Threshold studies are
                      not validated transfer stencils.
                    </p>
                    {(!layer.ink || layer.ink === "legacy") && (
                      <Toggle
                        label="Black ink"
                        checked={layer.monochrome}
                        onChange={() =>
                          editLayer({ monochrome: !layer.monochrome })
                        }
                      />
                    )}
                    <Toggle
                      label="Remove light paper"
                      description="Hide white and near-white areas"
                      checked={layer.removePaper}
                      onChange={() =>
                        editLayer({ removePaper: !layer.removePaper })
                      }
                    />
                  </fieldset>
                  <div className="layer-actions">
                    <button
                      onClick={duplicate}
                      disabled={project.layers.length >= 24}
                    >
                      <Copy size={14} /> Duplicate
                    </button>
                    <IconButton
                      label="Move layer forward"
                      onClick={() => reorder(1)}
                      disabled={visibleLayers.at(-1)?.id === layer.id}
                    >
                      <ArrowUp size={15} />
                    </IconButton>
                    <IconButton
                      label="Move layer backward"
                      onClick={() => reorder(-1)}
                      disabled={visibleLayers[0]?.id === layer.id}
                    >
                      <ArrowDown size={15} />
                    </IconButton>
                    <IconButton
                      label="Delete selected layer"
                      onClick={removeLayer}
                      disabled={groupLocked}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </div>
                </>
              ) : (
                <div className="empty-inspector">
                  <ImagePlus size={28} />
                  <h2>Make your first mark.</h2>
                  <p>Import a design to begin composing in this view.</p>
                  <button
                    className="primary"
                    onClick={() => imageInput.current?.click()}
                  >
                    Import artwork
                  </button>
                </div>
              )
            ) : (
              <>
                <div className="inspector-heading">
                  <span className="eyebrow">ADJUSTABLE FORM</span>
                  <h2>{bodyLabel(project.body)}</h2>
                  <p>Shape, movement and surface settings.</p>
                  <button
                    className="browse-models-button"
                    onClick={(e) => {
                      e.currentTarget.focus();
                      setBodyLibraryOpen(true);
                    }}
                  >
                    <LayoutGrid size={15} /> Browse model library{" "}
                    <ArrowRight size={15} />
                  </button>
                </div>
                <div className="model-explainer">
                  {project.body.kind === "human-v1" ? (
                    <svg
                      className="section-glyph"
                      viewBox="0 0 80 80"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      aria-hidden="true"
                    >
                      {project.body.section === "upper-body" ? (
                        <path d="M33 8v7L17 22l-6 9 12 8 5-5 1 15-4 18h30l-4-18 1-15 5 5 12-8-6-9-16-7V8M28 29l12 4 12-4M40 33v26" />
                      ) : project.body.section === "full-arm" ? (
                        <path d="M33 8c-10 4-12 15-8 26l8 17 3 18 4 5 2-2-1-12 4 8 3-1-3-18-6-18c2-10 2-20-6-23ZM29 31l8 4M34 49l8-2" />
                      ) : (
                        <path d="M28 7h23c1 11-3 21-7 29l-2 10 3 19 8 6c0 4-21 4-23 0l4-8-3-18-4-12c-3-8-3-18 1-26ZM30 35l11 2M35 62l7 1" />
                      )}
                    </svg>
                  ) : (
                    <span className="model-line" />
                  )}
                  <span>
                    {project.body.kind === "forearm-v1"
                      ? "FOREARM / V1"
                      : project.body.kind === "human-v1"
                        ? sculpt
                          ? "SCULPTED SURFACE"
                          : "ANATOMICAL SURFACE"
                        : "LEGACY REGION / V1"}
                  </span>
                </div>
                <div className="inspector-section">
                  <div className="section-label">
                    <span>BODY REGION</span>
                  </div>
                  {!sculpt && (
                    <button
                      className="wide-button"
                      onClick={(e) => {
                        e.currentTarget.focus();
                        setBodyFitOpen(true);
                      }}
                    >
                      Personal body fitting
                    </button>
                  )}
                  <SculptLibrary
                    selected={sculpt?.id}
                    choose={(id) => {
                      pendingCamera.current = "front";
                      editBody(sculptBody(id, project.body), true);
                      setView("front");
                    }}
                  />
                  <TripoConnection />
                  <SculptPosePicker
                    selected={sculpt?.id}
                    choose={(id) => {
                      pendingCamera.current = "front";
                      editBody(sculptBody(id, project.body), true);
                      setView("front");
                    }}
                  />
                  <label className="select-field">
                    Template
                    <select
                      aria-label="Body region"
                      value={
                        project.body.kind === "forearm-v1"
                          ? "forearm"
                          : project.body.kind === "human-v1"
                            ? (sculptGroupFor(project.body.model?.sculptId)
                                ?.id ?? project.body.section)
                            : project.body.region
                      }
                      onChange={(e) => {
                        const body = sculptIds.includes(
                          e.target.value as SculptId,
                        )
                          ? sculptBody(e.target.value as SculptId, project.body)
                          : humanSections.includes(
                                e.target
                                  .value as (typeof humanSections)[number],
                              )
                            ? humanBody(
                                e.target
                                  .value as (typeof humanSections)[number],
                                project.body,
                              )
                            : e.target.value === "forearm"
                              ? {
                                  ...blankProject().body,
                                  side: project.body.side,
                                  skin: project.body.skin,
                                }
                              : regionBody(
                                  e.target.value as (typeof regions)[number],
                                  project.body,
                                );
                        if (
                          body.kind === "human-v1" &&
                          body.model &&
                          e.target.value === "upper-body"
                        )
                          body.model.revision = Math.max(
                            5,
                            body.model.revision,
                          ) as 5 | 6;
                        change({
                          ...project,
                          body,
                          layers: project.layers.map((l) => ({
                            ...l,
                            surface: undefined,
                          })),
                        });
                        pendingCamera.current =
                          e.target.value === "torso" ? "back" : "front";
                        setView(e.target.value === "torso" ? "back" : "front");
                      }}
                    >
                      <optgroup label="Complete anatomical sections">
                        <option value="full-body">
                          Full body · neck to feet
                        </option>
                        <option value="neck">Neck & clavicles</option>
                        <option value="full-arm">
                          Full arm · shoulder to fingertips
                        </option>
                        <option value="upper-body">
                          {project.body.kind === "human-v1" &&
                          project.body.section === "upper-body" &&
                          (project.body.model?.revision ?? 0) < 5
                            ? "Upper body · with arms (legacy)"
                            : "Upper body · torso only"}
                        </option>
                        <option value="full-leg">
                          Full leg · thigh to toes
                        </option>
                      </optgroup>
                      <optgroup label="Imported sculpts · fixed pose">
                        {sculptGroups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Legacy surfaces · existing studies">
                        <option value="forearm">Forearm · original</option>
                        {regions.map((r) => (
                          <option key={r} value={r}>
                            {r === "torso"
                              ? "Torso / back"
                              : r.replace("-", " ")}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </label>
                  {!sculpt &&
                    !(
                      (project.body.kind === "region-v1" &&
                        project.body.region === "torso") ||
                      (project.body.kind === "human-v1" &&
                        ["upper-body", "full-body", "neck"].includes(
                          project.body.section,
                        ))
                    ) && (
                      <div className="segmented" aria-label="Body side">
                        {(["left", "right"] as const).map((side) => (
                          <button
                            className={
                              project.body.side === side ? "active" : ""
                            }
                            key={side}
                            onClick={() => editBody({ side })}
                          >
                            {project.body.kind === "forearm-v1"
                              ? side === "left"
                                ? "Left forearm"
                                : "Right forearm"
                              : side}
                          </button>
                        ))}
                      </div>
                    )}
                  <div
                    className="body-fields"
                    key={
                      project.body.kind +
                      ("region" in project.body ? project.body.region : "")
                    }
                  >
                    <NumberField
                      label={
                        project.body.kind === "forearm-v1"
                          ? "Forearm length"
                          : project.body.kind === "human-v1"
                            ? sculpt
                              ? "Model height"
                              : project.body.section === "upper-body"
                                ? "Neck to waist length"
                                : "Section length"
                            : "Region length"
                      }
                      value={project.body.length}
                      min={
                        project.body.kind === "human-v1"
                          ? sculpt || project.body.section === "neck"
                            ? 80
                            : 350
                          : 160
                      }
                      max={
                        project.body.kind === "forearm-v1"
                          ? 400
                          : project.body.kind === "human-v1"
                            ? project.body.section === "full-body"
                              ? 2200
                              : 1300
                            : 800
                      }
                      onChange={(length) => editBody({ length })}
                    />
                    {sculpt ? (
                      <>
                        {project.body.kind === "human-v1" && (
                          <>
                            {sculpt.skinEnvelope ? (
                              <>
                                <Toggle
                                  label="Muscle display"
                                  checked={
                                    project.body.model?.sculptAppearance !==
                                    "skin"
                                  }
                                  onChange={() => {
                                    if (project.body.kind === "human-v1")
                                      editBody({
                                        model: {
                                          ...project.body.model!,
                                          sculptAppearance:
                                            project.body.model
                                              ?.sculptAppearance === "skin"
                                              ? "original"
                                              : "skin",
                                        },
                                      });
                                  }}
                                />
                                <p className="field-note">
                                  Switch between muscle anatomy and the preview
                                  skin envelope. Artwork stays attached. Fixed
                                  pose.
                                </p>
                              </>
                            ) : (
                              <label className="select-field">
                                {sculpt.skinEnvelope
                                  ? "Surface view"
                                  : "Surface colors"}
                                <select
                                  aria-label="Imported surface colors"
                                  value={
                                    project.body.model?.sculptAppearance ??
                                    "original"
                                  }
                                  onChange={(e) => {
                                    if (project.body.kind === "human-v1")
                                      editBody({
                                        model: {
                                          ...project.body.model!,
                                          sculptAppearance: e.target.value as
                                            | "original"
                                            | "skin",
                                        },
                                      });
                                  }}
                                >
                                  <option value="original">
                                    {sculpt.skinEnvelope
                                      ? "Muscle anatomy"
                                      : "Original colors"}
                                  </option>
                                  <option value="skin">
                                    {sculpt.skinEnvelope
                                      ? "Skin envelope"
                                      : "Skin tone"}
                                  </option>
                                </select>
                              </label>
                            )}
                            <div className="section-label">
                              <span>MODEL ROTATION · 360°</span>
                            </div>
                            {(["x", "y", "z"] as const).map((axis) => (
                              <RotationField
                                begin={beginFashion}
                                commit={commitFashion}
                                hint={
                                  axis === "x"
                                    ? "Tilt forward / back"
                                    : axis === "y"
                                      ? "Turn left / right"
                                      : "Roll sideways"
                                }
                                key={axis}
                                label={`Rotate ${axis.toUpperCase()}`}
                                min={0}
                                max={360}
                                value={
                                  project.body.kind === "human-v1"
                                    ? (project.body.model?.sculptRotation?.[
                                        axis
                                      ] ?? 0)
                                    : 0
                                }
                                onChange={(value) => {
                                  if (project.body.kind === "human-v1")
                                    editBody({
                                      model: {
                                        ...project.body.model!,
                                        sculptRotation: {
                                          x: 0,
                                          y: 0,
                                          z: 0,
                                          ...project.body.model?.sculptRotation,
                                          [axis]: value,
                                        },
                                      },
                                    });
                                }}
                              />
                            ))}
                            <button
                              className="wide-button"
                              onClick={() => {
                                pendingCamera.current = view;
                                if (project.body.kind === "human-v1")
                                  editBody({
                                    model: {
                                      ...project.body.model!,
                                      sculptRotation: { x: 0, y: 0, z: 0 },
                                    },
                                  });
                              }}
                            >
                              Reset model rotation
                            </button>
                            <button
                              className="wide-button"
                              onClick={() => {
                                pendingCamera.current = view;
                                if (project.body.kind === "human-v1")
                                  editBody({
                                    model: {
                                      ...project.body.model!,
                                      sculptRotation: { x: 0, y: 0, z: 90 },
                                    },
                                  });
                              }}
                            >
                              Lay model horizontal
                            </button>
                            <p className="field-note">
                              Rotate the model and artwork together. Drag in
                              Orbit mode to look around it; use Fit model after
                              turning a long part sideways.
                            </p>
                          </>
                        )}
                        <img
                          className="sculpt-selection"
                          src={sculpt.thumbnail}
                          alt={sculpt.name}
                        />
                        <p className="field-note">
                          <strong>{sculpt.name}</strong>
                          <br />
                          {sculpt.description}
                        </p>
                        <p className="field-note">
                          Fixed sculpt pose. Rotate the view, adjust size and
                          place artwork directly on the surface. Use a body from
                          the anatomical library for posing and muscle filters.
                        </p>
                        <p className="field-note">
                          Size is an approximate starting scale; confirm
                          dimensions on the actual body.
                        </p>
                        <label className="select-field">
                          Artwork detail
                          <select
                            aria-label="Body artwork detail"
                            value={
                              project.tattooStudy?.detailZone ?? "standard"
                            }
                            onChange={(e) =>
                              change({
                                ...project,
                                tattooStudy: {
                                  ...(project.tattooStudy ?? emptyStudy()),
                                  detailZone: e.target.value as ReturnType<
                                    typeof emptyStudy
                                  >["detailZone"],
                                },
                              })
                            }
                          >
                            <option value="standard">
                              Standard · 2K chart
                            </option>
                            {bodyZones(project.body).map((zone) => (
                              <option key={zone} value={zone}>
                                4K · sculpture surface
                              </option>
                            ))}
                          </select>
                        </label>
                        <p className="field-note sculpt-credit">
                          {sculpt.source ? (
                            <>
                              <a
                                href={sculpt.source}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {sculpt.name}
                              </a>{" "}
                              by {sculpt.author}. {sculpt.license}.
                            </>
                          ) : (
                            <>Created by {sculpt.author} using Tripo.</>
                          )}{" "}
                          Oriented and prepared for Corpora Studio.
                        </p>
                      </>
                    ) : project.body.kind === "human-v1" ? (
                      <>
                        <div className="section-label">
                          <span>BODY LIBRARY</span>
                        </div>
                        {(project.body.model?.revision ?? 0) < 5 && (
                          <p className="field-note">
                            Saved surface preserved. Choose a body preset below
                            to use the latest sculpt.
                          </p>
                        )}
                        <div className="segmented" aria-label="Body type">
                          {(["male", "female"] as const).map((sex) => (
                            <button
                              key={sex}
                              className={
                                project.body.kind === "human-v1" &&
                                project.body.model?.sex === sex
                                  ? "active"
                                  : ""
                              }
                              onClick={() => {
                                if (project.body.kind !== "human-v1") return;
                                editBody({
                                  model: {
                                    revision: LATEST_BODY_REVISION,
                                    sex,
                                    physique:
                                      project.body.model?.physique ?? "fit",
                                    anatomyOpacity:
                                      project.body.model?.anatomyOpacity ??
                                      0.85,
                                  },
                                });
                              }}
                            >
                              {sex === "male" ? "Male" : "Female"}
                            </button>
                          ))}
                        </div>
                        <div
                          className="segmented"
                          aria-label="Body build preset"
                        >
                          {(["fit", "average"] as const).map((physique) => (
                            <button
                              key={physique}
                              className={
                                project.body.kind === "human-v1" &&
                                project.body.model?.physique === physique
                                  ? "active"
                                  : ""
                              }
                              onClick={() => {
                                if (project.body.kind !== "human-v1") return;
                                editBody({
                                  muscularity: physique === "fit" ? 1 : 0,
                                  build: 1,
                                  model: {
                                    revision: LATEST_BODY_REVISION,
                                    sex: project.body.model?.sex ?? "male",
                                    physique,
                                    anatomyOpacity:
                                      project.body.model?.anatomyOpacity ??
                                      0.85,
                                  },
                                });
                              }}
                            >
                              {physique === "fit" ? "Fit" : "Average"}
                            </button>
                          ))}
                        </div>
                        {project.body.model &&
                          project.body.model.revision >= 5 &&
                          project.body.model.revision <
                            LATEST_BODY_REVISION && (
                            <button
                              className="wide-button"
                              onClick={() => {
                                if (
                                  project.body.kind !== "human-v1" ||
                                  !project.body.model
                                )
                                  return;
                                const sex = project.body.model.sex,
                                  from = project.body.model.revision;
                                change({
                                  ...project,
                                  body: {
                                    ...project.body,
                                    model: {
                                      ...project.body.model,
                                      revision: LATEST_BODY_REVISION,
                                    },
                                  },
                                  layers: project.layers.map((l) =>
                                    l.surface?.revision === from &&
                                    l.surface.sex === sex
                                      ? {
                                          ...l,
                                          surface: {
                                            ...l.surface,
                                            revision: LATEST_BODY_REVISION,
                                          },
                                        }
                                      : l,
                                  ),
                                });
                                alert(
                                  `Body updated. Compatible tattoo anchors retained; undo restores revision ${from}.`,
                                );
                              }}
                            >
                              Use refined body · retain placements
                            </button>
                          )}
                        <label className="select-field">
                          Artwork detail
                          <select
                            aria-label="Body artwork detail"
                            value={
                              project.tattooStudy?.detailZone ?? "standard"
                            }
                            onChange={(e) =>
                              change({
                                ...project,
                                tattooStudy: {
                                  ...(project.tattooStudy ?? emptyStudy()),
                                  detailZone: e.target.value as ReturnType<
                                    typeof emptyStudy
                                  >["detailZone"],
                                },
                              })
                            }
                          >
                            <option value="standard">
                              Standard · 2K charts
                            </option>
                            {bodyZones(project.body).map((zone) => (
                              <option key={zone} value={zone}>
                                4K · {zone}
                              </option>
                            ))}
                          </select>
                        </label>
                        <p className="field-note">
                          4K detail focuses one region. Pose studies use lighter
                          previews; original artwork stays intact.
                        </p>
                        <NumberField
                          label="Build"
                          value={project.body.build * 100}
                          min={75}
                          max={135}
                          unit="%"
                          onChange={(v) => editBody({ build: v / 100 })}
                        />
                        <NumberField
                          label="Muscle definition"
                          value={project.body.muscularity * 100}
                          min={0}
                          max={100}
                          unit="%"
                          onChange={(v) => editBody({ muscularity: v / 100 })}
                        />
                        <p className="field-note">
                          {project.body.section === "full-body"
                            ? "Continuous neck, torso, pelvis and all four limbs. No head is included."
                            : project.body.section === "neck"
                              ? "Neck and clavicular region, continuous with the full-body template."
                              : project.body.section === "full-arm"
                                ? "Includes shoulder cap, upper arm, elbow, forearm and hand."
                                : project.body.section === "full-leg"
                                  ? "Includes thigh, knee, calf, ankle and foot."
                                  : (project.body.model?.revision ?? 0) >= 5
                                    ? "Torso only: neck, shoulders, chest, abdomen and back. Full arms are a separate template."
                                    : "Connected chest, abdomen, back and both complete arms."}{" "}
                          Scale is approximate; local chart distortion varies.
                        </p>
                        <div className="section-label">
                          <span>ANATOMY & MOVEMENT</span>
                        </div>
                        {(project.body.model?.revision ?? 0) >= 5 &&
                          ["upper-body", "full-body"].includes(
                            project.body.section,
                          ) && (
                            <>
                              <label className="select-field">
                                Muscle pose
                                <select
                                  aria-label="Muscle pose"
                                  value={project.body.musclePose ?? "relaxed"}
                                  onChange={(e) => {
                                    const body = project.body;
                                    if (body.kind !== "human-v1") return;
                                    const musclePose = e.target
                                      .value as MusclePose;
                                    editBody({
                                      musclePose,
                                      muscleTension: body.muscleTension ?? 0.8,
                                      ...(body.section === "full-body"
                                        ? {
                                            armPose: musclePoseArms(musclePose),
                                          }
                                        : {}),
                                    });
                                  }}
                                >
                                  <option value="relaxed">Relaxed</option>
                                  <option value="chest-flex">Chest flex</option>
                                  <option value="back-flex">Back flex</option>
                                  {project.body.section === "full-body" && (
                                    <option value="double-biceps">
                                      Double biceps
                                    </option>
                                  )}
                                </select>
                              </label>
                              {project.body.musclePose &&
                                project.body.musclePose !== "relaxed" && (
                                  <NumberField
                                    label="Muscle tension"
                                    value={
                                      (project.body.muscleTension ?? 0.8) * 100
                                    }
                                    min={0}
                                    max={100}
                                    unit="%"
                                    onChange={(value) =>
                                      editBody({ muscleTension: value / 100 })
                                    }
                                  />
                                )}
                              <p className="field-note">
                                Compare relaxed and flexed shapes. Your tattoo
                                follows the surface. Flex is an artistic
                                preview.
                              </p>
                            </>
                          )}
                        <Toggle
                          label="Muscle anatomy guide"
                          checked={project.body.anatomy}
                          onChange={() =>
                            editBody({
                              anatomy:
                                project.body.kind === "human-v1" &&
                                !project.body.anatomy,
                            })
                          }
                        />
                        {project.body.model && project.body.anatomy && (
                          <NumberField
                            label="Anatomy filter opacity"
                            value={project.body.model.anatomyOpacity * 100}
                            min={0}
                            max={100}
                            unit="%"
                            onChange={(v) => {
                              if (
                                project.body.kind === "human-v1" &&
                                project.body.model
                              )
                                editBody({
                                  model: {
                                    ...project.body.model,
                                    anatomyOpacity: v / 100,
                                  },
                                });
                            }}
                          />
                        )}
                        {project.body.section !== "neck" &&
                          !(
                            project.body.section === "upper-body" &&
                            (project.body.model?.revision ?? 0) >= 5
                          ) && (
                            <>
                              {["upper-body", "full-body"].includes(
                                project.body.section,
                              ) && (
                                <div
                                  className="segmented"
                                  aria-label="Arm to pose"
                                >
                                  {(["left", "right"] as const).map((side) => (
                                    <button
                                      key={side}
                                      className={
                                        project.body.side === side
                                          ? "active"
                                          : ""
                                      }
                                      onClick={() => editBody({ side })}
                                    >
                                      {side === "left"
                                        ? "Pose left arm"
                                        : "Pose right arm"}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <NumberField
                                label={
                                  project.body.section === "full-leg"
                                    ? "Knee flex"
                                    : "Elbow flex"
                                }
                                value={
                                  project.body.section === "full-leg"
                                    ? project.body.flex
                                    : armPose(project.body).flex
                                }
                                min={0}
                                max={110}
                                unit="°"
                                onChange={(flex) => editPose({ flex })}
                              />
                              {project.body.section !== "full-leg" && (
                                <>
                                  <NumberField
                                    label="Shoulder elevation"
                                    value={armPose(project.body).raise}
                                    min={0}
                                    max={120}
                                    unit="°"
                                    onChange={(raise) => editPose({ raise })}
                                  />
                                  <RotationField
                                    begin={beginFashion}
                                    commit={commitFashion}
                                    wrap={false}
                                    label="Forearm rotation"
                                    value={armPose(project.body).twist}
                                    min={-90}
                                    max={90}
                                    onChange={(twist) => editPose({ twist })}
                                  />
                                </>
                              )}
                              <div className="segmented">
                                <button
                                  onClick={() =>
                                    editPose({ flex: 0, raise: 0, twist: 0 })
                                  }
                                >
                                  Relaxed
                                </button>
                                <button onClick={() => editPose({ flex: 90 })}>
                                  Bent 90°
                                </button>
                              </div>
                            </>
                          )}
                        {project.body.anatomy && (
                          <div className="muscle-legend">
                            {project.body.model
                              ? muscleLegend(project.body.model.revision)
                                  .filter(
                                    (g) =>
                                      project.body.kind === "human-v1" &&
                                      (project.body.section === "full-arm"
                                        ? g.parent >= 8 && g.parent <= 21
                                        : project.body.section === "full-leg"
                                          ? g.parent >= 22 && g.parent <= 33
                                          : project.body.section ===
                                                "upper-body" &&
                                              (project.body.model?.revision ??
                                                0) >= 5
                                            ? g.parent <= 8 || g.parent >= 34
                                            : g.parent <= 21 || g.parent >= 34),
                                  )
                                  .map((g) => (
                                    <div key={g.name}>
                                      <strong>
                                        <span
                                          className="muscle-dot"
                                          style={{ background: g.color }}
                                        />
                                        {g.name}
                                      </strong>
                                      <small>{g.flow}</small>
                                    </div>
                                  ))
                              : muscleGuide[project.body.section].map(
                                  ([name, flow]) => (
                                    <div key={name}>
                                      <strong>{name}</strong>
                                      <small>{flow}</small>
                                    </div>
                                  ),
                                )}
                          </div>
                        )}
                        <p className="field-note">
                          {project.body.section === "upper-body" &&
                            (project.body.model?.revision ?? 0) < 5 &&
                            "Pose each arm independently. Use Fit model to frame a raised pose. "}
                          {project.body.section === "upper-body" &&
                            (project.body.model?.revision ?? 0) >= 5 &&
                            "Torso only, with closed shoulder ends. Choose Full arm to design a sleeve. "}
                          {project.body.model
                            ? "Registered superficial muscle map. Colors identify muscle groups; point at the model for names and flow. "
                            : "Schematic superficial muscle guide. "}
                          Posing shows the surface and ink moving together. It
                          does not simulate individual muscle contraction or
                          skin strain.
                        </p>
                      </>
                    ) : project.body.kind === "forearm-v1" ? (
                      <>
                        <NumberField
                          label="Wrist circumference"
                          value={project.body.wrist}
                          min={100}
                          max={260}
                          onChange={(wrist) => editBody({ wrist })}
                        />
                        <NumberField
                          label="Elbow circumference"
                          value={project.body.elbow}
                          min={160}
                          max={420}
                          onChange={(elbow) => editBody({ elbow })}
                        />
                      </>
                    ) : (
                      <>
                        <NumberField
                          label={
                            project.body.region === "torso"
                              ? "Waist circumference"
                              : "Lower circumference"
                          }
                          value={project.body.distal}
                          min={100}
                          max={1600}
                          onChange={(distal) => editBody({ distal })}
                        />
                        <NumberField
                          label={
                            project.body.region === "torso"
                              ? "Upper chest circumference"
                              : "Upper circumference"
                          }
                          value={project.body.proximal}
                          min={100}
                          max={1600}
                          onChange={(proximal) => editBody({ proximal })}
                        />
                        <NumberField
                          label="Depth proportion"
                          value={project.body.depth * 100}
                          min={40}
                          max={120}
                          unit="%"
                          onChange={(v) => editBody({ depth: v / 100 })}
                        />
                        <NumberField
                          label="Muscle contour"
                          value={project.body.muscularity * 100}
                          min={0}
                          max={100}
                          unit="%"
                          onChange={(v) => editBody({ muscularity: v / 100 })}
                        />
                        <p className="field-note">
                          Simplified continuous surface. No articulated joints
                          or shoulder attachments. Measurements constrain ring
                          circumferences.
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <div className="inspector-section">
                  <div className="section-label">
                    <span>SURFACE TONE</span>
                  </div>
                  <div className="skin-swatches">
                    {skinTones.map((skin) => (
                      <button
                        aria-label={`Skin tone ${skin}`}
                        aria-pressed={project.body.skin === skin}
                        style={{ background: skin }}
                        className={project.body.skin === skin ? "active" : ""}
                        key={skin}
                        onClick={() =>
                          editBody({
                            skin,
                            ...(sculpt && project.body.kind === "human-v1"
                              ? {
                                  model: {
                                    ...project.body.model!,
                                    sculptAppearance: "skin" as const,
                                  },
                                }
                              : {}),
                          })
                        }
                      >
                        {project.body.skin === skin && <Check size={16} />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="accuracy-note">
                  <span>
                    <ShieldCheck size={17} /> Approximate model
                  </span>
                  <p>
                    This is an adjustable planning surface, not a body scan.
                    Shape, ink color, and physical fit require review with your
                    tattoo artist.
                  </p>
                  <p>
                    Changing proportions keeps artwork attached. Local
                    stretching varies around the model.
                  </p>
                </div>
              </>
            )}
            <div className="revision">
              <label htmlFor="revision">STUDY LABEL</label>
              <input
                id="revision"
                value={project.revision}
                maxLength={100}
                onChange={(e) =>
                  change({ ...project, revision: e.target.value })
                }
              />
            </div>
          </div>
        </aside>
      </main>
      <footer className="statusbar">
        <span>
          <span className="status-dot" />
          <span role="status" aria-label="Local recovery status">
            {busy ? "Working locally…" : recovery}
          </span>
          <span className="status-separator">/</span>
          {studio === "fashion"
            ? fashionMode !== "patterns"
              ? "Technical flats · specification units in pack"
              : "Pattern units · millimeters"
            : workspace === "photo"
              ? "Photo coordinates · uncalibrated"
              : "Millimeters"}
        </span>
        <span>
          <button
            onClick={() => setShowStats(!showStats)}
            title="Toggle rendering diagnostics"
          >
            {studio === "fashion"
              ? fashionMode !== "patterns"
                ? "Editable garment flats"
                : "Parametric pattern drafting"
              : showStats
                ? `Orbit p95 ${stats.p95.toFixed(1)} ms · ${stats.frames} frames · ${stats.triangles.toLocaleString()} triangles`
                : "WebGL 2 · Surface mapping"}
          </button>
          <span className="status-separator">/</span>CORPORA STUDIO 0.23
        </span>
      </footer>
      {notice && (
        <div
          className={`toast ${notice.error ? "error" : ""}`}
          role={notice.error ? "alert" : "status"}
        >
          {notice.error ? <HelpCircle size={17} /> : <Check size={17} />}
          <span>{notice.text}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {homeOpen && (
        <StudioHome
          name={project.name}
          resume={() => setHomeOpen(false)}
          start={startTask}
          openFile={() => {
            setHomeOpen(false);
            open();
          }}
          openLocal={(content) => {
            setHomeOpen(false);
            guard(() => {
              void load(content, null);
            });
          }}
          library={() => {
            setHomeOpen(false);
            setLibrary(true);
          }}
        />
      )}
      {bodyLibraryOpen && (
        <BodyLibrary
          current={project.body}
          choose={(body) => {
            pendingCamera.current = "front";
            editBody(body, true);
            setView("front");
            setInspector("model");
            setBodyLibraryOpen(false);
          }}
          close={() => setBodyLibraryOpen(false)}
        />
      )}
      {patternSourcesOpen && (
        <Suspense
          fallback={
            <div className="modal-backdrop">
              <p role="status">Opening pattern inventory…</p>
            </div>
          }
        >
          <PatternSourceStudio
            value={project.fashion?.patternSources}
            assets={project.assets}
            onChange={(data, addedAssets = []) => {
              const p = live.current.project;
              const next = {
                ...p,
                assets: [...p.assets, ...addedAssets],
                fashion: {
                  ...(p.fashion ?? newFashion()),
                  patternSources: data,
                },
              };
              const result = ProjectSchema.safeParse(next);
              if (!result.success)
                throw new Error(
                  result.error.issues.map((i) => i.message).join("; "),
                );
              change(result.data);
            }}
            onUsePieces={(pieces) => {
              const p = live.current.project;
              const f = p.fashion ?? newFashion();
              const next = {
                ...p,
                fashion: {
                  ...f,
                  construction: { ...f.construction, ...pieces },
                  customDraftIds: Object.keys(pieces),
                },
              };
              const result = ProjectSchema.safeParse(next);
              if (!result.success)
                throw new Error(
                  result.error.issues.map((i) => i.message).join("; "),
                );
              change(result.data);
              setFashionMode("patterns");
              setPatternSourcesOpen(false);
              alert(
                "Custom pieces opened. Review scale, joining seams and fit before cutting.",
              );
            }}
            close={() => setPatternSourcesOpen(false)}
          />
        </Suspense>
      )}
      {reviewOpen && (
        <ReviewRoom
          project={project}
          studio={studio}
          onChange={(review) => change({ ...project, review })}
          capture={captureReview}
          close={() => setReviewOpen(false)}
        />
      )}
      {portfolioOpen && (
        <PortfolioStudio
          project={project}
          close={() => setPortfolioOpen(false)}
        />
      )}
      {bodyFitOpen && (
        <BodyFitStudio
          project={project}
          close={() => setBodyFitOpen(false)}
          change={(bodyStudy, asset, body) => {
            const next = {
              ...project,
              bodyStudy,
              ...(body
                ? {
                    body,
                    layers: project.layers.map((l) => ({
                      ...l,
                      surface: undefined,
                    })),
                  }
                : {}),
              ...(asset
                ? {
                    assets: [
                      ...project.assets.filter(
                        (a) =>
                          !project.bodyStudy?.views.some(
                            (v) => v.assetId === a.id,
                          ) ||
                          bodyStudy.views.some((v) => v.assetId === a.id) ||
                          project.photos.some((p) => p.assetId === a.id),
                      ),
                      asset,
                    ],
                  }
                : {}),
            };
            const parsed = ProjectSchema.safeParse(next);
            if (parsed.success) change(next);
            else
              alert(parsed.error.issues.map((i) => i.message).join("; "), true);
          }}
        />
      )}
      {planningOpen && (
        <TattooPlanningStudio
          project={project}
          change={change}
          close={() => setPlanningOpen(false)}
          undo={undoFashion}
          redo={redoFashion}
          canUndo={history.past.length > 0}
          canRedo={history.future.length > 0}
        />
      )}
      {editingAsset && project.assets.find((a) => a.id === editingAsset) && (
        <ArtworkStudio
          key={editingAsset}
          initialStencil={stencilFirst}
          asset={project.assets.find((a) => a.id === editingAsset)!}
          transferPlan={
            project.tattooStudy?.stencils.find(
              (s) => s.assetId === editingAsset,
            )?.plan ?? emptyTransferPlan(project.tattooStudy?.transferPose)
          }
          pointBudget={
            80000 -
            project.assets
              .filter((a) => a.id !== editingAsset)
              .reduce(
                (n, a) =>
                  n +
                  (a.edits?.strokes.reduce((n, s) => n + s.points.length, 0) ??
                    0) +
                  (a.edits?.drawing?.reduce((n, s) => n + s.points.length, 0) ??
                    0),
                0,
              )
          }
          close={() => {
            setEditingAsset(undefined);
            setStencilFirst(false);
          }}
          apply={(edits, plan) => {
            change({
              ...project,
              ...(plan
                ? {
                    tattooStudy: {
                      ...(project.tattooStudy ?? emptyStudy()),
                      stencils: [
                        ...(project.tattooStudy?.stencils.filter(
                          (s) => s.assetId !== editingAsset,
                        ) ?? []),
                        { assetId: editingAsset, plan },
                      ],
                    },
                  }
                : {}),
              assets: project.assets.map((a) =>
                a.id === editingAsset ? { ...a, edits } : a,
              ),
              layers:
                edits.background === "none"
                  ? project.layers
                  : project.layers.map((l) =>
                      l.assetId === editingAsset
                        ? { ...l, removePaper: false }
                        : l,
                    ),
            });
            setEditingAsset(undefined);
            setStencilFirst(false);
            alert(
              "Source edits applied to every instance. Original artwork preserved.",
            );
          }}
        />
      )}
      {library && (
        <ProjectLibrary
          project={project}
          studio={studio}
          close={() => setLibrary(false)}
          open={(content) => {
            setLibrary(false);
            guard(() => {
              void load(content, null);
            });
          }}
        />
      )}
      {commandsOpen && (
        <CommandMenu
          close={() => setCommandsOpen(false)}
          commands={[
            {
              id: "home",
              label: "Studio home",
              description: "Start a tattoo, garment or technical flat",
              run: () => setHomeOpen(true),
            },
            {
              id: "models",
              label: "Browse body models",
              description: "Compare anatomical bodies and imported sculpts",
              run: () => {
                setStudio("tattoo");
                setBodyLibraryOpen(true);
              },
            },
            {
              id: "review-room",
              label: "Review room",
              description:
                "Freeze a revision, collect notes and export a review package",
              run: () => setReviewOpen(true),
              disabled: busy || !ready,
            },
            {
              id: "tattoo",
              label: "Tattoo studio",
              description: "Body placement, anatomy and artwork",
              run: () => setStudio("tattoo"),
            },
            ...(["patterns", "vectors", "assets", "textiles"] as const).map(
              (mode) => ({
                id: mode,
                label:
                  mode === "patterns"
                    ? "Sewing patterns"
                    : mode === "vectors"
                      ? "Vector packs"
                      : mode === "textiles"
                        ? "Fabric & color"
                        : "Garment asset library",
                description:
                  mode === "patterns"
                    ? "65 measurement-driven sewing designs"
                    : mode === "vectors"
                      ? "Editable garment flats and manufacturer handoff"
                      : mode === "textiles"
                        ? "Prints, palettes and garment color studies"
                        : "112 imported sheets · search, preview and place",
                disabled: busy || !ready,
                run: () => {
                  setStudio("fashion");
                  setFashionMode(mode);
                  setFocusMode(false);
                  seedFashion();
                },
              }),
            ),
            {
              id: "library",
              label: "Project library",
              description: "Recovery copies, saved projects and checkpoints",
              run: () => setLibrary(true),
            },
            {
              id: "save",
              label: "Save project",
              description: "Save a local .formstudio file",
              keys: "⌘ S",
              disabled: busy,
              run: () => void save(),
            },
            {
              id: "open",
              label: "Open project",
              description: "Continue an existing project",
              keys: "⌘ O",
              disabled: busy,
              run: open,
            },
            {
              id: "new",
              label: "New project",
              description: "Start a fresh composition",
              disabled: busy,
              run: create,
            },
            {
              id: "portfolio",
              label: "Portfolio export",
              description: "Share finished work in a standalone gallery",
              disabled: busy || !ready,
              run: () => setPortfolioOpen(true),
            },
            {
              id: "focus",
              label: focusMode ? "Show workspace panels" : "Focus mode",
              description: "Expand the canvas and hide side panels",
              disabled: studio === "fashion" && fashionMode === "assets",
              run: () => setFocusMode((v) => !v),
            },
            {
              id: "help",
              label: "Help & shortcuts",
              description: "Navigation, editing and export controls",
              run: () => setHelp(true),
            },
          ]}
        />
      )}
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="modal"
            role="dialog"
            tabIndex={-1}
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-top">
              <span className="eyebrow">A FEW GOOD SHORTCUTS</span>
              <IconButton label="Close help" onClick={() => setHelp(false)}>
                <X size={18} />
              </IconButton>
            </div>
            <h2 id="help-title">Your studio, in two workspaces.</h2>
            <p className="product-owner">
              Corpora Studio 0.23 · Product owner: Devauntae Norman
            </p>
            <p>
              Import artwork, choose a complete body section, then compose from
              every angle. In Fashion, enter measurements, adjust the pattern
              and export at actual size. Use Vector packs for garment drawings
              and manufacturer handoff, or browse the Asset library to start
              from your imported designs.
            </p>
            <div className="shortcut-list">
              {[
                ["Orbit the model", "V"],
                ["Place artwork on the surface", "G"],
                ["Save / Save As", "⌘S / ⇧⌘S"],
                ["Open a project", "⌘O"],
                ["Quick actions & workspace search", "⌘K"],
                ["Undo / Redo", "⌘Z / ⇧⌘Z"],
                ["Export current workspace", "⌘E"],
              ].map(([label, key]) => (
                <div key={key}>
                  <span>{label}</span>
                  <kbd>{key}</kbd>
                </div>
              ))}
            </div>
            <p className="field-note">
              Project files include original images and may retain embedded
              photo metadata. Share selected finished views with Portfolio or
              Review room when originals should stay private. Use Ctrl in place
              of ⌘ on Windows. Numeric fields commit on Enter or when you leave
              the field. Scroll to zoom; right-drag to pan.
            </p>
            <div className="accuracy-note">
              <span>
                <ShieldCheck size={16} /> In this build
              </span>
              <p>
                Full body and neck views, colored muscle guidance, connected
                tattoo placement, personal fitting with residuals, pressure
                drawing and calibrated stencil output are available. Fashion
                includes 65 garment patterns, six chart-based starter sizes,
                size comparisons, photo measurements, formula construction and a
                visual drape preview. Image inventory supports calibrated
                pattern tracing and approximate measured garment drafts. Named
                checkpoints and portfolio export cover both workspaces.
              </p>
              <p>
                The companion website will showcase finished work exported from
                the desktop application.
              </p>
            </div>
            <details className="model-credits">
              <summary>Body and anatomy credits</summary>
              <p>
                Body surfaces adapt MakeHuman core graphical assets (CC0), with
                additional surface detail. The muscle map adapts Z-Anatomy /
                BodyParts3D — The Database Center for Life Science, with
                registration, color and connective-tissue changes (CC BY-SA
                4.0). Original BodyParts3D model: Kousaku Okubo; Z-Anatomy:
                Gauthier Kervyn and contributors.
              </p>
              <p>
                Source: github.com/Z-Anatomy/Models-of-human-anatomy. License:
                creativecommons.org/licenses/by-sa/4.0/. Full notices are
                bundled with the app. Reviews exported with the muscle filter
                include attribution.
              </p>
            </details>
            <button
              className="primary"
              autoFocus
              onClick={() => setHelp(false)}
            >
              Back to the studio <ArrowLeft size={15} />
            </button>
          </section>
        </div>
      )}
      {pending && (
        <div className="modal-backdrop">
          <section
            className="modal small"
            role="dialog"
            tabIndex={-1}
            aria-modal="true"
            aria-labelledby="unsaved-title"
          >
            <span className="eyebrow">UNSAVED COMPOSITION</span>
            <h2 id="unsaved-title">Keep your latest changes?</h2>
            <p>
              {native
                ? "Save this study before leaving. Your original saved file stays intact if you discard these edits."
                : "Download a copy and verify that it arrived before choosing Discard to continue. This browser cannot confirm a completed download."}
            </p>
            <div className="confirm-actions">
              <button autoFocus onClick={() => setPending(null)}>
                Cancel
              </button>
              <button
                onClick={() => {
                  const fn = pending;
                  setPending(null);
                  fn();
                }}
              >
                Discard
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  if (await save()) {
                    const fn = pending;
                    setPending(null);
                    fn();
                  }
                }}
              >
                {native ? "Save & continue" : "Download a copy"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
