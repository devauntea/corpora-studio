import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { StudioScene, frameBounds, type View } from "./scene";
import { chartPreview } from "./chart-preview";
import {
  bodyZones,
  humanChartSize,
  type Project,
  type Layer,
  artworkRatio,
  type SurfaceZone,
} from "./domain";
import {
  availableStudyPoses,
  emptyStudy,
  newGuide,
  poseNames,
  studyProject,
  type StudyPose,
  type StudyGuide,
} from "./tattoo-study";
import { effectiveLayer } from "./layer-groups";
import { useDialogReturnFocus } from "./dialog-focus";
import { saveReview } from "./io";
import "./tattoo-planning.css";

export function TattooPlanningStudio({
  project,
  change,
  close,
  undo,
  redo,
  canUndo,
  canRedo,
}: {
  project: Project;
  change: (p: Project) => void;
  close: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}) {
  useDialogReturnFocus();
  const left = useRef<HTMLDivElement>(null),
    right = useRef<HTMLDivElement>(null),
    pair = useRef<StudioScene[]>([]),
    dialog = useRef<HTMLElement>(null);
  const [ready, setReady] = useState(false),
    [working, setWorking] = useState(false),
    [error, setError] = useState("");
  const [view, setView] = useState<View>("front"),
    [overview, setOverview] = useState<string>(),
    [muscles, setMuscles] = useState(false);
  const zones = bodyZones(project.body),
    [zone, setZone] = useState<SurfaceZone>(zones[0] ?? "trunk");
  const [guideId, setGuideId] = useState<string>(),
    [layerId, setLayerId] = useState(
      project.layers.find((l) => !l.photoId)?.id,
    );
  const study = project.tattooStudy ?? emptyStudy();
  const poses =
    project.body.kind === "human-v1"
      ? availableStudyPoses(project.body)
      : (["relaxed"] as StudyPose[]);
  const compare = poses.includes(study.comparePose)
    ? study.comparePose
    : poses.at(-1)!;
  const selectedGuide = study.guides.find((g) => g.id === guideId);
  const layer = project.layers.find((l) => l.id === layerId && !l.photoId);
  const locked = Boolean(layer && effectiveLayer(project, layer).locked);
  const editShared = (patch: Partial<Layer>) => {
    if (!layer || locked) return;
    if (layer.surface && (patch.u !== undefined || patch.v !== undefined)) {
      const anchor = pair.current[0]?.human?.decals.nearestAnchor({
        ...layer,
        ...patch,
      });
      if (!anchor) {
        setError("This location is outside the current body section.");
        return;
      }
      patch = { ...patch, surface: anchor };
    }
    change({
      ...project,
      layers: project.layers.map((l) =>
        l.id === layer.id ? { ...l, ...patch } : l,
      ),
    });
  };
  const writeStudy = (patch: Partial<typeof study>) =>
    change({ ...project, tattooStudy: { ...study, ...patch } });
  const patchGuide = (patch: Partial<StudyGuide>) =>
    writeStudy({
      guides: study.guides.map((g) =>
        g.id === guideId ? { ...g, ...patch } : g,
      ),
    });
  const leftProject = useMemo(
    () => studyProject(project, "relaxed", study.tension),
    [project, study.tension],
  );
  const rightProject = useMemo(
    () => studyProject(project, compare, study.tension),
    [project, compare, study.tension],
  );
  const frame = () => {
    const scenes = pair.current;
    if (scenes.length !== 2 || !scenes.every((s) => s.human)) return;
    const bounds = new THREE.Box3();
    scenes.forEach((s) =>
      bounds.union(new THREE.Box3().setFromObject(s.human!.group)),
    );
    const f = frameBounds(
      bounds,
      Math.min(...scenes.map((s) => s.camera.aspect)),
      35,
      view,
    );
    scenes.forEach((s) => {
      s.controls.target.copy(f.target);
      s.camera.position.copy(f.position);
      s.controls.update();
      s.needsRender = true;
    });
  };
  useEffect(() => {
    dialog.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus();
    const scenes: StudioScene[] = [];
    try {
      for (const host of [left.current!, right.current!]) {
        const s = new StudioScene(
          host,
          { begin() {}, move() {}, end() {}, stats() {}, error: setError },
          { previewSize: 1024, planningGuides: true },
        );
        s.controls.enableDamping = false;
        s.floor.visible = false;
        s.grid.visible = false;
        scenes.push(s);
      }
      pair.current = scenes;
      let syncing = false;
      scenes.forEach((s, i) =>
        s.controls.addEventListener("change", () => {
          if (syncing) return;
          syncing = true;
          const other = scenes[1 - i];
          other.camera.position.copy(s.camera.position);
          other.camera.quaternion.copy(s.camera.quaternion);
          other.controls.target.copy(s.controls.target);
          other.controls.update();
          other.needsRender = true;
          const camera = JSON.stringify({
            position: s.camera.position.toArray(),
            target: s.controls.target.toArray(),
          });
          if (left.current) left.current.dataset.camera = camera;
          if (right.current) right.current.dataset.camera = camera;
          syncing = false;
        }),
      );
      setReady(true);
    } catch (e) {
      setError(String(e));
    }
    return () => {
      scenes.forEach((s) => s.dispose());
      pair.current = [];
    };
  }, []);
  const initialized = useRef(false);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setWorking(true);
    setError("");
    const timer = setTimeout(
      () =>
        void (async () => {
          try {
            const values = [leftProject, rightProject];
            for (let i = 0; i < 2; i++) {
              if (cancelled) return;
              const p = values[i];
              const ok = await pair.current[i]?.update({
                ...p,
                body:
                  p.body.kind === "human-v1"
                    ? { ...p.body, anatomy: muscles }
                    : p.body,
              });
              if (!ok && !cancelled)
                throw new Error(
                  "The pose preview could not finish. Try closing and reopening the study.",
                );
            }
            if (cancelled) return;
            if (!initialized.current) {
              frame();
              initialized.current = true;
            }
            setOverview(chartPreview(pair.current[0], zone));
          } catch (e) {
            if (!cancelled) setError(String(e));
          } finally {
            if (!cancelled) setWorking(false);
          }
        })(),
      100,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [leftProject, rightProject, ready, muscles, zone]);
  useEffect(() => {
    if (ready && initialized.current) frame();
  }, [view, ready]);
  const add = (kind: StudyGuide["kind"]) => {
    const g = newGuide(zone, kind, layer?.u ?? 0.5, layer?.v ?? 0.5);
    writeStudy({ guides: [...study.guides, g] });
    setGuideId(g.id);
  };
  const exportProof = async () => {
    setError("");
    try {
      const c = document.createElement("canvas");
      c.width = 1800;
      c.height = 1100;
      const x = c.getContext("2d")!;
      x.fillStyle = "#202022";
      x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = "white";
      x.font = "26px sans-serif";
      x.fillText(project.name.slice(0, 80), 40, 45);
      pair.current.forEach((s, i) => {
        s.renderer.render(s.scene, s.camera);
        const source = s.renderer.domElement;
        const scale = Math.min(850 / source.width, 880 / source.height);
        x.drawImage(
          source,
          40 + i * 900,
          100,
          source.width * scale,
          source.height * scale,
        );
      });
      x.fillStyle = "white";
      x.font = "20px sans-serif";
      x.fillText("Relaxed", 40, 85);
      x.fillText(poseNames[compare], 940, 85);
      x.font = "16px sans-serif";
      x.fillText(
        `Transfer pose: ${poseNames[study.transferPose]} · Body revision ${project.body.kind === "human-v1" ? project.body.model?.revision : "legacy"} · ${project.revision}`,
        40,
        1030,
      );
      x.fillText(
        "Authored pose study. Guides are separate from ink. Confirm placement and transfer on the actual body.",
        40,
        1060,
      );
      await saveReview(c.toDataURL("image/png"), project.name + "-pose-study");
    } catch (e) {
      setError(String(e));
    }
  };
  const number = (
    label: string,
    value: number,
    min: number,
    max: number,
    onChange: (v: number) => void,
    step = 1,
    disabled = false,
  ) => (
    <label>
      {label}
      <input
        aria-label={label}
        type="number"
        disabled={disabled}
        value={Math.round(value * 1000) / 1000}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = e.target.valueAsNumber;
          if (Number.isFinite(v) && v >= min && v <= max) onChange(v);
        }}
      />
    </label>
  );
  return (
    <div className="modal-backdrop planning-backdrop">
      <section
        className="tattoo-planning"
        ref={dialog}
        role="dialog"
        tabIndex={-1}
        aria-label="Tattoo composition study"
        aria-modal="true"
        onKeyDown={(e) => {
          if (
            (e.metaKey || e.ctrlKey) &&
            e.key.toLowerCase() === "z" &&
            !(e.target instanceof HTMLInputElement)
          ) {
            e.preventDefault();
            e.stopPropagation();
            if (e.shiftKey) {
              if (canRedo) redo();
            } else if (canUndo) undo();
          }
          if (e.key === "Escape") {
            e.stopPropagation();
            close();
          }
          if (e.key === "Tab") {
            const nodes = [
              ...e.currentTarget.querySelectorAll<HTMLElement>(
                'button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]',
              ),
            ];
            if (e.shiftKey && document.activeElement === nodes[0]) {
              e.preventDefault();
              nodes.at(-1)?.focus();
            } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
              e.preventDefault();
              nodes[0]?.focus();
            }
          }
        }}
      >
        <header role="presentation">
          <div>
            <span className="eyebrow">TATTOO / COMPOSITION STUDY</span>
            <h2>One design. Two poses.</h2>
          </div>
          <button disabled={!canUndo} onClick={undo}>
            Undo
          </button>
          <button disabled={!canRedo} onClick={redo}>
            Redo
          </button>
          <button
            disabled={working || !ready}
            onClick={() => void exportProof()}
          >
            Export pose proof
          </button>
          <button onClick={close}>Close study</button>
        </header>
        <div className="planning-layout">
          <div className="planning-main">
            <div className="planning-toolbar">
              <label>
                Comparison pose
                <select
                  aria-label="Comparison pose"
                  value={compare}
                  onChange={(e) =>
                    writeStudy({ comparePose: e.target.value as StudyPose })
                  }
                >
                  {poses.map((p) => (
                    <option key={p} value={p}>
                      {poseNames[p]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Camera
                <select
                  aria-label="Linked camera"
                  value={view}
                  onChange={(e) => setView(e.target.value as View)}
                >
                  {["front", "back", "left", "right", "three-quarter"].map(
                    (v) => (
                      <option key={v}>{v}</option>
                    ),
                  )}
                </select>
              </label>
              <button onClick={frame}>Fit both views</button>
              <label>
                <input
                  type="checkbox"
                  checked={muscles}
                  onChange={(e) => setMuscles(e.target.checked)}
                />
                Muscle guide
              </label>
            </div>
            <div className="pose-pair" aria-busy={working}>
              <figure>
                <figcaption>RELAXED</figcaption>
                <div
                  ref={left}
                  className="pose-canvas"
                  data-testid="rest-view"
                />
              </figure>
              <figure>
                <figcaption>{poseNames[compare].toUpperCase()}</figcaption>
                <div
                  ref={right}
                  className="pose-canvas"
                  data-testid="flex-view"
                />
              </figure>
            </div>
            <p className="planning-status" role="status">
              {working
                ? "Updating both views…"
                : "Orbit or zoom either view; the cameras stay linked."}
            </p>
            <p className="field-note">
              Poses are authored visual studies. The colored guide identifies
              muscle regions; it does not predict skin sliding or physical
              strain.
            </p>
            {error && <p role="alert">{error}</p>}
          </div>
          <aside className="planning-inspector">
            <h3>Transfer intent</h3>
            <label>
              Transfer pose
              <select
                aria-label="Transfer pose"
                value={study.transferPose}
                onChange={(e) =>
                  writeStudy({ transferPose: e.target.value as StudyPose })
                }
              >
                {Array.from(new Set([...poses, study.transferPose])).map(
                  (p) => (
                    <option key={p} value={p}>
                      {poseNames[p]}
                    </option>
                  ),
                )}
              </select>
            </label>
            {number("Study tension (%)", study.tension * 100, 0, 100, (v) =>
              writeStudy({ tension: v / 100 }),
            )}
            <h3>Shared artwork</h3>
            <label>
              Artwork layer
              <select
                aria-label="Study artwork layer"
                value={layer?.id ?? ""}
                onChange={(e) => setLayerId(e.target.value)}
              >
                <option value="" disabled>
                  Select artwork
                </option>
                {project.layers
                  .filter((l) => !l.photoId)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </select>
            </label>
            {layer && (
              <>
                <label>
                  <input
                    type="checkbox"
                    disabled={locked}
                    checked={layer.visible}
                    onChange={(e) =>
                      change({
                        ...project,
                        layers: project.layers.map((l) =>
                          l.id === layer.id
                            ? { ...l, visible: e.target.checked }
                            : l,
                        ),
                      })
                    }
                  />
                  Show in both views
                </label>
                {number(
                  "Study tattoo width (mm)",
                  layer.width,
                  5,
                  400,
                  (v) =>
                    change({
                      ...project,
                      layers: project.layers.map((l) =>
                        l.id === layer.id ? { ...l, width: v } : l,
                      ),
                    }),
                  1,
                  locked,
                )}
                {number(
                  "Study around (%)",
                  layer.u * 100,
                  0,
                  100,
                  (v) => editShared({ u: v / 100 }),
                  0.1,
                  locked || working,
                )}
                {number(
                  "Study height (%)",
                  layer.v * 100,
                  0,
                  100,
                  (v) => editShared({ v: v / 100 }),
                  0.1,
                  locked || working,
                )}
                {number(
                  "Study rotation (degrees)",
                  layer.rotation,
                  -180,
                  180,
                  (v) => editShared({ rotation: v }),
                  1,
                  locked,
                )}
                {number(
                  "Study opacity (%)",
                  layer.opacity * 100,
                  0,
                  100,
                  (v) => editShared({ opacity: v / 100 }),
                  1,
                  locked,
                )}
                <p className="field-note">
                  {Math.round(layer.width)} ×{" "}
                  {Math.round(
                    layer.width *
                      artworkRatio(
                        project.assets.find((a) => a.id === layer.assetId)!,
                      ) *
                      (layer.stretch ?? 1),
                  )}{" "}
                  mm artwork footprint{locked ? " · locked" : ""}
                </p>
                <p className="field-note">
                  {layer.surface
                    ? "Connected surface placement"
                    : "Chart placement"}{" "}
                  · {Math.round(layer.opacity * 100)}% opacity
                </p>
              </>
            )}
            <h3>Sleeve / region overview</h3>
            <label>
              Region
              <select
                aria-label="Planning region"
                value={zone}
                onChange={(e) => setZone(e.target.value as SurfaceZone)}
              >
                {zones.map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </label>
            <div className="chart-overview">
              {overview && (
                <img src={overview} alt="Unwrapped artwork planning overview" />
              )}
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-label="Planning guide overview"
              >
                {study.guides
                  .filter((g) => g.zone === zone && g.visible)
                  .map((g) =>
                    g.kind === "band" ? (
                      <rect
                        key={g.id}
                        x="0"
                        y={
                          (1 - g.v) * 100 -
                          (g.width /
                            (project.body.kind === "human-v1"
                              ? humanChartSize(project.body, zone).height
                              : 600)) *
                            50
                        }
                        width="100"
                        height={
                          (g.width /
                            (project.body.kind === "human-v1"
                              ? humanChartSize(project.body, zone).height
                              : 600)) *
                          100
                        }
                        fill="#d5a23255"
                        stroke="#9c6b00"
                        strokeWidth=".3"
                      />
                    ) : (
                      <circle
                        key={g.id}
                        cx={g.u * 100}
                        cy={(1 - g.v) * 100}
                        r={g.kind === "focal" ? 2 : 1}
                        fill="#9c6b00"
                      />
                    ),
                  )}
              </svg>
            </div>
            <p className="field-note">
              UV overview: seams and scale vary. This is a planning map, not a
              printable stencil. Bands reserve visual breathing room; they do
              not erase ink.
            </p>
            <div className="planning-guide-actions">
              <button
                disabled={study.guides.length >= 24}
                onClick={() => add("landmark")}
              >
                Add landmark
              </button>
              <button
                disabled={study.guides.length >= 24}
                onClick={() => add("focal")}
              >
                Add focal point
              </button>
              <button
                disabled={study.guides.length >= 24}
                onClick={() => add("band")}
              >
                Add space band
              </button>
            </div>
            <label>
              Planning guide
              <select
                aria-label="Planning guide"
                value={guideId ?? ""}
                onChange={(e) => setGuideId(e.target.value)}
              >
                <option value="">Select guide</option>
                {study.guides.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} · {g.zone}
                  </option>
                ))}
              </select>
            </label>
            {selectedGuide && (
              <>
                <label>
                  Name
                  <input
                    aria-label="Guide name"
                    value={selectedGuide.name}
                    maxLength={60}
                    onChange={(e) =>
                      e.target.value.trim() &&
                      patchGuide({ name: e.target.value })
                    }
                  />
                </label>
                {number(
                  "Guide around (%)",
                  selectedGuide.u * 100,
                  0,
                  100,
                  (v) => patchGuide({ u: v / 100 }),
                )}
                {number(
                  "Guide height (%)",
                  selectedGuide.v * 100,
                  0,
                  100,
                  (v) => patchGuide({ v: v / 100 }),
                )}
                {selectedGuide.kind === "band" &&
                  number(
                    "Space band width (mm)",
                    selectedGuide.width,
                    1,
                    100,
                    (v) => patchGuide({ width: v }),
                  )}
                <label>
                  <input
                    type="checkbox"
                    checked={selectedGuide.visible}
                    onChange={(e) => patchGuide({ visible: e.target.checked })}
                  />
                  Show guide
                </label>
                <button
                  onClick={() => {
                    writeStudy({
                      guides: study.guides.filter((g) => g.id !== guideId),
                    });
                    setGuideId(undefined);
                  }}
                >
                  Remove guide
                </button>
              </>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
