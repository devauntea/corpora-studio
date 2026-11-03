import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDown,
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
  Leaf,
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
  bodyLabel,
  regionBody,
  regions,
  imageSource,
  artworkAssets,
  layerForPhoto,
  type Photo,
  clamp,
  historyReducer,
  parseProject,
  wrap,
  type Asset,
  type Body,
  type History,
  type Layer,
  type Project,
} from "./domain";
import {
  assetFromFile,
  loadImage,
  native,
  openProject,
  saveProject,
  saveReview,
} from "./io";
import { StudioScene, type View } from "./scene";
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
  const [workspace, setWorkspace] = useState<"surface" | "photo">("surface");
  const [photoId, setPhotoId] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const [saved, setSaved] = useState<Project | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"orbit" | "place">("orbit");
  const [inspector, setInspector] = useState<"artwork" | "model">("artwork");
  const [view, setView] = useState<View>("front");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const [help, setHelp] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [stats, setStats] = useState({ p95: 0, frames: 0, triangles: 0 });
  const [showStats, setShowStats] = useState(false);
  const [dragover, setDragover] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const scene = useRef<StudioScene | null>(null);
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
    photoId,
  });
  live.current = { project, selected, saved, path, busy, workspace, photoId };
  const dirty = project !== saved;
  const layer = project.layers.find((l) => l.id === selected);
  const photo = project.photos.find((p) => p.id === photoId);
  const visibleLayers = project.layers.filter((l) =>
    workspace === "photo"
      ? Boolean(photoId) && l.photoId === photoId
      : !l.photoId,
  );
  const asset = project.assets.find((a) => a.id === layer?.assetId);
  const alert = useCallback(
    (text: string, error = false) => setNotice({ text, error }),
    [],
  );
  const change = useCallback(
    (next: Project) => dispatch({ type: "change", value: next }),
    [],
  );
  const editLayer = useCallback(
    (patch: Partial<Layer>) => {
      const p = live.current.project,
        id = live.current.selected;
      if (
        p.layers.find((l) => l.id === id)?.locked &&
        patch.locked === undefined
      )
        return;
      change({
        ...p,
        layers: p.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      });
    },
    [change],
  );
  const editBody = (patch: Partial<Body>) =>
    change({ ...project, body: { ...project.body, ...patch } as Body });

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
        begin: () => dispatch({ type: "begin" }),
        move: (u, v) => editLayer({ u: wrap(u), v: clamp(v, 0, 1) }),
        end: () => dispatch({ type: "commit" }),
        stats: setStats,
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
  }, [alert, editLayer]);
  useEffect(() => {
    if (workspace === "surface") void scene.current?.update(project);
  }, [project, workspace]);
  useEffect(() => {
    scene.current?.setMode(
      mode,
      layer?.locked || layer?.photoId ? undefined : selected,
    );
    if (scene.current) scene.current.active = workspace === "surface";
  }, [mode, selected, layer?.locked, layer?.photoId, workspace]);
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
    if (!help && !pending) return;
    const previous = document.activeElement as HTMLElement | null;
    const modal = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () => [
      ...(modal?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input, [tabindex="0"]',
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
  }, [help, pending]);

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
        setPath(result);
        setSaved(current);
        alert("Project saved. Original artwork is included.");
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
        for (const a of p.assets) {
          const img = await loadImage(imageSource(a));
          if (
            img.width !== a.width ||
            img.height !== a.height ||
            img.width * img.height > 32_000_000
          )
            throw new Error(`Invalid artwork dimensions: ${a.name}`);
        }
        dispatch({ type: "reset", value: p });
        setSaved(p);
        setPath(JSON.parse(text).version === 1 ? null : filePath);
        setPhotoId(p.photos[0]?.id);
        setWorkspace(p.photos.length ? "photo" : "surface");
        setSelected(
          p.layers
            .filter((l) =>
              p.photos.length ? l.photoId === p.photos[0].id : !l.photoId,
            )
            .at(-1)?.id,
        );
        scene.current?.view("front", p.body.length);
        setView("front");
        alert(
          JSON.parse(text).version === 1
            ? "Legacy project opened without changing placement. Save creates a new v2 copy."
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
      dispatch({ type: "reset", value: p });
      setSaved(p);
      setPath(null);
      setSelected(undefined);
      setPhotoId(undefined);
      setWorkspace("surface");
      setInspector("model");
      scene.current?.view("front", p.body.length);
    });
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
      if (!scene.current || !(await scene.current.update(current)))
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
    if (p.layers.find((l) => l.id === live.current.selected)?.locked) return;
    change({
      ...p,
      layers: p.layers.filter(
        (l) => l.id !== live.current.selected || l.locked,
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
            void exportImage();
            break;
        }
      } else if (
        !mod &&
        !/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)
      ) {
        if (e.key.startsWith("Arrow")) {
          const l = live.current.project.layers.find(
            (l) => l.id === live.current.selected,
          );
          if (!l || l.locked) return;
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
    const requestClose = () =>
      guard(() => {
        void invoke("close_app");
      });
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
  const truncated =
    layer && asset
      ? (layer.width * asset.height) / asset.width > project.body.length
        ? "Artwork extends beyond the model. Scale it down to see the full composition."
        : null
      : null;

  return (
    <div className="app-shell">
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
            <Leaf size={23} strokeWidth={1.5} />
          </span>
          <span>
            FORM<span className="brand-slash"> / </span>STUDIO
          </span>
          <span className="build-badge">EARLY BUILD</span>
        </div>
        <div className="topbar-actions">
          <span className="local-label">
            <ShieldCheck size={14} /> Local workspace
          </span>
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
              TATTOO STUDIO <span>/</span> COMPOSITION
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
          <span className={`save-state ${dirty ? "dirty" : ""}`}>
            <i />
            {dirty ? "Unsaved changes" : path ? "Saved" : "New study"}
          </span>
        </div>
        <div className="project-actions">
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
          <button
            className="primary"
            onClick={() => void exportImage()}
            disabled={busy || !ready}
          >
            <Download size={15} /> Export review
          </button>
        </div>
      </div>
      <main className="workspace">
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
            onClick={() => setInspector("model")}
          >
            <span className="body-glyph">◒</span>
            <span>
              <strong>{bodyLabel(project.body)}</strong>
              <small>Adjustable · approximate</small>
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
          <div className="layer-list">
            {[...visibleLayers].reverse().map((l, i) => (
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
                      {l.locked ? "Locked · " : ""}
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
                <small>Tattoo now. Fashion is next.</small>
              </span>
            </div>
          </div>
        </aside>

        <section
          className={`viewport ${workspace === "photo" ? "photo-mode" : ""} ${dragover ? "drag-over" : ""}`}
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
          <div className="viewport-heading">
            <div>
              <span className="eyebrow">SURFACE STUDY / 001</span>
              <h1>Made to follow form.</h1>
              <p>
                {bodyLabel(project.body)} <span>·</span> {project.body.length}{" "}
                mm
              </p>
            </div>
            <span className="approx-badge">
              <i /> Approximate model
            </span>
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
            <IconButton label="Fit model" onClick={() => chooseView("front")}>
              <Maximize size={18} />
            </IconButton>
          </div>
          <div className="axis-indicator">
            <span className="axis-y">Y</span>
            <span className="axis-z">Z</span>
            <span className="axis-x">X</span>
          </div>
          <div className="view-bottom">
            <div className="camera-tabs" aria-label="Camera views">
              {(["front", "left", "back", "right"] as View[]).map((v) => (
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
                  Scroll to zoom <span>·</span> Right-drag to pan
                </>
              ) : (
                <>
                  <Move size={13} /> Click or drag on the surface to place
                  artwork
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
                  <Toggle
                    label="Lock layer"
                    checked={layer.locked ?? false}
                    onChange={() => editLayer({ locked: !layer.locked })}
                  />
                  <fieldset
                    disabled={layer.locked}
                    className="inspector-section editable-group"
                  >
                    <div className="section-label">
                      <span>PLACEMENT</span>
                      <Move size={14} />
                    </div>
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
                            value={layer.v * project.body.length}
                            min={0}
                            max={project.body.length}
                            onChange={(v) =>
                              editLayer({ v: v / project.body.length })
                            }
                          />
                          <NumberField
                            label="Width"
                            value={layer.width}
                            min={5}
                            max={400}
                            onChange={(v) => editLayer({ width: v })}
                          />
                        </>
                      )}
                      <NumberField
                        label="Rotation"
                        value={layer.rotation}
                        min={-180}
                        max={180}
                        unit="°"
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
                    disabled={layer.locked}
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
                      disabled={layer.locked}
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
                  <h2>Your starting surface.</h2>
                  <p>Set proportions in millimeters.</p>
                </div>
                <div className="model-explainer">
                  <span className="model-line" />
                  <span>
                    {project.body.kind === "forearm-v1"
                      ? "FOREARM / V1"
                      : "REGION TEMPLATE / V1"}
                  </span>
                </div>
                <div className="inspector-section">
                  <div className="section-label">
                    <span>BODY REGION</span>
                  </div>
                  <label className="select-field">
                    Template
                    <select
                      aria-label="Body region"
                      value={
                        project.body.kind === "forearm-v1"
                          ? "forearm"
                          : project.body.region
                      }
                      onChange={(e) => {
                        const body =
                          e.target.value === "forearm"
                            ? {
                                ...blankProject().body,
                                side: project.body.side,
                                skin: project.body.skin,
                              }
                            : regionBody(
                                e.target.value as (typeof regions)[number],
                                project.body,
                              );
                        change({ ...project, body });
                        scene.current?.view(
                          e.target.value === "torso" ? "back" : "front",
                          body.length,
                        );
                        setView(e.target.value === "torso" ? "back" : "front");
                      }}
                    >
                      <option value="forearm">Forearm · original</option>
                      {regions.map((r) => (
                        <option key={r} value={r}>
                          {r === "torso" ? "Torso / back" : r.replace("-", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!(
                    project.body.kind === "region-v1" &&
                    project.body.region === "torso"
                  ) && (
                    <div className="segmented">
                      {(["left", "right"] as const).map((side) => (
                        <button
                          className={project.body.side === side ? "active" : ""}
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
                          : "Region length"
                      }
                      value={project.body.length}
                      min={160}
                      max={project.body.kind === "forearm-v1" ? 400 : 800}
                      onChange={(length) => editBody({ length })}
                    />
                    {project.body.kind === "forearm-v1" ? (
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
                    {[
                      "#e0bfa5",
                      "#c49b7d",
                      "#af805e",
                      "#8c5f43",
                      "#654532",
                      "#453328",
                    ].map((skin) => (
                      <button
                        aria-label={`Skin tone ${skin}`}
                        style={{ background: skin }}
                        className={project.body.skin === skin ? "active" : ""}
                        key={skin}
                        onClick={() => editBody({ skin })}
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
          {busy ? "Working locally…" : "All processing on this device"}
          <span className="status-separator">/</span>
          {workspace === "photo"
            ? "Photo coordinates · uncalibrated"
            : "Millimeters"}
        </span>
        <span>
          <button
            onClick={() => setShowStats(!showStats)}
            title="Toggle rendering diagnostics"
          >
            {showStats
              ? `p95 ${stats.p95.toFixed(1)} ms · ${stats.frames} frames · ${stats.triangles.toLocaleString()} triangles`
              : "WebGL 2 · Surface mapping"}
          </button>
          <span className="status-separator">/</span>FORM STUDIO 0.2
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
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="modal"
            role="dialog"
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
            <h2 id="help-title">Your first surface study.</h2>
            <p>
              Import PNG or JPEG artwork, adjust the forearm measurements, then
              compose from every angle.
            </p>
            <div className="shortcut-list">
              {[
                ["Orbit the model", "V"],
                ["Place artwork on the surface", "G"],
                ["Save / Save As", "⌘S / ⇧⌘S"],
                ["Open a project", "⌘O"],
                ["Undo / Redo", "⌘Z / ⇧⌘Z"],
                ["Export review image", "⌘E"],
              ].map(([label, key]) => (
                <div key={key}>
                  <span>{label}</span>
                  <kbd>{key}</kbd>
                </div>
              ))}
            </div>
            <p className="field-note">
              Use Ctrl in place of ⌘ on Windows. Numeric fields commit on Enter
              or when you leave the field. Scroll to zoom; right-drag to pan.
            </p>
            <div className="accuracy-note">
              <span>
                <ShieldCheck size={16} /> This first build
              </span>
              <p>
                Photo overlays, protection masks, and five 3D templates are
                available. Connected bodies, photo reconstruction, and fashion
                drafting remain later phases.
              </p>
              <p>
                The companion website will showcase finished work exported from
                the desktop application.
              </p>
            </div>
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
            aria-modal="true"
            aria-labelledby="unsaved-title"
          >
            <span className="eyebrow">UNSAVED COMPOSITION</span>
            <h2 id="unsaved-title">Keep your latest changes?</h2>
            <p>
              Save this study before leaving. Your original saved file stays
              intact if you discard these edits.
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
                Save & continue
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
