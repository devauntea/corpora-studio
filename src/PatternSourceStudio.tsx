import {
  useCallback,
  createContext,
  useContext,
  useId,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import {
  X,
  Plus,
  ImagePlus,
  ScanLine,
  PenLine,
  FolderOpen,
  ArrowUpRight,
} from "lucide-react";
import { imageSource, type Asset } from "./domain";
import { assetFromFile, loadImage } from "./io";
import { useDialogReturnFocus } from "./dialog-focus";
import { PointInputs } from "./PointInputs";
import { ConstructionEditor } from "./ConstructionEditor";
import type { Construction } from "./fashion-construction";
import { pathString } from "./fashion-model";
import { constructPiece } from "./pattern-geometry";
import {
  PATTERN_SOURCE_LIMITS,
  PatternSourcesSchema,
  emptyPatternSources,
  newPatternSource,
  detectPatternOutlines,
  outlineDimensions,
  calibrationTransform,
  outlineToPiece,
  suggestReconstruction,
  reconstructGarment,
  sourcePiecesForDraft,
  type PatternSources,
  type PatternSourceStudy,
  type SourcePoint,
  type SourcePiece,
  type ReconstructionRecipe,
} from "./pattern-source";
import "./pattern-source.css";

type PointKind = "corners" | "outline";
type Editing = {
  studyId: string;
  pieceId: string;
  value: Construction;
  past: Construction[];
  future: Construction[];
};
const FieldValidity = createContext<(name: string, valid: boolean) => void>(
  () => {},
);
function NumberField({
  label,
  value,
  min,
  max,
  change,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  change: (n: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState("");
  const errorId = useId(),
    validity = useContext(FieldValidity);
  useEffect(() => () => validity(label, true), [label, validity]);
  return (
    <label className="ps-field">
      <span>
        {label} <small>mm</small>
      </span>
      <input
        type="number"
        min={min}
        max={max}
        step="1"
        aria-label={`${label} (mm)`}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number(draft);
          if (draft === null) return;
          if (!draft.trim() || !Number.isFinite(n) || n < min || n > max) {
            setError(
              `Enter ${min}–${max} mm. Your entry has not been applied.`,
            );
            validity(label, false);
            return;
          }
          change(n);
          setError("");
          validity(label, true);
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            e.stopPropagation();
            setDraft(null);
            setError("");
            validity(label, true);
          }
        }}
      />
      {error && (
        <span className="ps-field-error" role="alert" id={errorId}>
          {error}
        </span>
      )}
    </label>
  );
}
function PiecePreview({ piece }: { piece: SourcePiece }) {
  const p = constructPiece(piece.id, piece.construction);
  const points = piece.construction.seam.flatMap((o) =>
    o.type === "close"
      ? []
      : [o.to, ...(o.type === "curve" ? [o.cp1, o.cp2] : [])],
  );
  const x = Math.min(...points.map((p) => p.x)),
    y = Math.min(...points.map((p) => p.y));
  const w = Math.max(...points.map((p) => p.x)) - x,
    h = Math.max(...points.map((p) => p.y)) - y;
  return (
    <svg
      role="img"
      aria-label={`${p.name} editable outline`}
      viewBox={`${x - 20} ${y - 20} ${w + 40} ${h + 40}`}
    >
      <path
        d={pathString(piece.construction.seam)}
        fill="#e5e5e2"
        stroke="#202020"
        strokeWidth={Math.max(w, h) / 180}
      />
      <line
        x1={piece.construction.grain[0].x}
        y1={piece.construction.grain[0].y}
        x2={piece.construction.grain[1].x}
        y2={piece.construction.grain[1].y}
        stroke="#555"
        strokeDasharray="7 4"
        strokeWidth={Math.max(w, h) / 220}
      />
    </svg>
  );
}

/** Local reference originals live in project.assets. This inventory contains the
 * reproducible calibration, assumptions and ordinary editable construction. */
export function PatternSourceStudio({
  value,
  assets,
  onChange,
  onUsePieces,
  close,
}: {
  value: PatternSources | undefined;
  assets: Asset[];
  onChange: (data: PatternSources, addedAssets?: Asset[]) => void;
  onUsePieces: (pieces: Record<string, Construction>) => void;
  close: () => void;
}) {
  useDialogReturnFocus();
  const data = value ?? emptyPatternSources();
  const latest = useRef({ data, assets });
  latest.current = { data, assets };
  const study =
    data.studies.find((s) => s.id === data.selectedId) ?? data.studies[0];
  const asset = assets.find((a) => a.id === study?.primaryAssetId);
  const dialog = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null),
    svg = useRef<SVGSVGElement>(null);
  const importTarget = useRef<"pattern" | "garment" | { studyId: string }>(
    "pattern",
  );
  const [mode, setMode] = useState<PointKind>("corners"),
    [pointIndex, setPointIndex] = useState(0),
    [keyboardPoint, setKeyboardPoint] = useState<SourcePoint>([0.5, 0.5]);
  const [drag, setDrag] = useState<{
    kind: PointKind;
    index: number;
    point: SourcePoint;
  } | null>(null);
  const [candidates, setCandidates] = useState<SourcePoint[][]>([]),
    [candidateIndex, setCandidateIndex] = useState(0);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const [invalidFields, setInvalidFields] = useState<Set<string>>(
    () => new Set(),
  );
  const markValidity = useCallback(
    (name: string, valid: boolean) =>
      setInvalidFields((previous) => {
        if (previous.has(name) === !valid) return previous;
        const next = new Set(previous);
        if (valid) next.delete(name);
        else next.add(name);
        return next;
      }),
    [],
  );
  const [editing, setEditing] = useState<Editing | null>(null),
    dragBase = useRef<Construction | null>(null);
  // ConstructionEditor binds its focus trap to these callbacks. Stable
  // identities keep numeric edits from moving focus to its Done button.
  const editorUndo = useCallback(
    () =>
      setEditing((e) =>
        e && e.past.length
          ? {
              ...e,
              value: e.past.at(-1)!,
              past: e.past.slice(0, -1),
              future: [e.value, ...e.future],
            }
          : e,
      ),
    [],
  );
  const editorRedo = useCallback(
    () =>
      setEditing((e) =>
        e && e.future.length
          ? {
              ...e,
              value: e.future[0],
              past: [...e.past, e.value],
              future: e.future.slice(1),
            }
          : e,
      ),
    [],
  );
  useEffect(() => {
    if (!editing && dialog.current && !dialog.current.open)
      dialog.current.showModal();
  }, [editing]);
  useEffect(() => {
    setCandidates([]);
    setCandidateIndex(0);
    setPointIndex(0);
    setMode("corners");
    setError("");
    setStatus("");
  }, [study?.id, study?.primaryAssetId]);
  const attempt = (fn: () => void) => {
    setError("");
    try {
      fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const save = (next: PatternSources, added?: Asset[]) => {
    PatternSourcesSchema.parse(next);
    onChange(next, added);
  };
  const update = (patch: Partial<PatternSourceStudy>, id = study?.id) => {
    if (!id) return;
    save({
      ...latest.current.data,
      studies: latest.current.data.studies.map((s) =>
        s.id === id
          ? { ...s, ...patch, modifiedAt: new Date().toISOString() }
          : s,
      ),
    });
  };
  const recipe = (patch: Partial<ReconstructionRecipe>) =>
    study && update({ reconstruction: { ...study.reconstruction, ...patch } });
  const chooseImport = (target: typeof importTarget.current) => {
    importTarget.current = target;
    if (input.current) {
      input.current.multiple = typeof target === "object";
      input.current.click();
    }
  };
  const importFiles = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    setError("");
    setStatus("Preserving original images…");
    const target = importTarget.current;
    try {
      const limit =
        typeof target === "object" ? PATTERN_SOURCE_LIMITS.references : 1;
      if (files.length > limit)
        throw new Error(
          `Choose at most ${limit} image${limit === 1 ? "" : "s"}.`,
        );
      if (files.some((f) => !["image/png", "image/jpeg"].includes(f.type)))
        throw new Error("Choose PNG or JPEG originals for this workflow.");
      const current = latest.current;
      const added: Asset[] = [],
        references: string[] = [];
      for (const file of files) {
        const inventory = [...current.assets, ...added];
        if (inventory.length >= 24)
          throw new Error(
            "This project already has 24 images. Start another project before importing additional originals.",
          );
        if (
          inventory.reduce(
            (n, a) => n + a.data.length + (a.preview?.length ?? 0),
            0,
          ) +
            4 * Math.ceil(file.size / 3) +
            32 >
          70_000_000
        )
          throw new Error(
            "These originals would exceed the 70 MB project image budget. Choose smaller references or a separate project.",
          );
        // Decode one reference at a time, so a six-photo import does not hold
        // six large decoded bitmaps concurrently.
        const remainingPixels =
          64_000_000 - inventory.reduce((n, p) => n + p.width * p.height, 0);
        const a = await assetFromFile(file, remainingPixels);
        if (
          inventory.reduce((n, p) => n + p.width * p.height, 0) +
            a.width * a.height >
          64_000_000
        )
          throw new Error(
            "These originals would exceed the 64 megapixel project budget. Choose smaller references or a separate project.",
          );
        const previous = [...current.assets, ...added].find(
          (p) => p.sha256 === a.sha256 && p.role === "garment",
        );
        if (previous) references.push(previous.id);
        else {
          added.push({ ...a, role: "garment" });
          references.push(a.id);
        }
      }
      if (typeof target === "object") {
        const old = current.data.studies.find((s) => s.id === target.studyId);
        if (!old) throw new Error("This source study is no longer available.");
        const ids = [...new Set([...old.sourceAssetIds, ...references])];
        if (ids.length > PATTERN_SOURCE_LIMITS.references)
          throw new Error(
            "A source study can preserve up to six reference images.",
          );
        save(
          {
            ...current.data,
            studies: current.data.studies.map((s) =>
              s.id === old.id
                ? {
                    ...old,
                    sourceAssetIds: ids,
                    modifiedAt: new Date().toISOString(),
                  }
                : s,
            ),
          },
          added,
        );
      } else {
        const next = newPatternSource(
          references[0],
          files[0].name.replace(/\.[^.]+$/, ""),
          target,
        );
        save(
          {
            ...current.data,
            selectedId: next.id,
            studies: [...current.data.studies, next],
          },
          added,
        );
      }
      setStatus(
        "Original image preserved. Mark a measured reference rectangle to establish scale.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const coordinates = (e: PointerEvent<SVGSVGElement>): SourcePoint => {
    const r = svg.current!.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    ];
  };
  const points = study
    ? mode === "corners"
      ? study.calibration.corners
      : study.outline
    : [];
  const changePoints = (kind: PointKind, next: SourcePoint[]) => {
    if (!study) return;
    update(
      kind === "corners"
        ? {
            calibration: {
              ...study.calibration,
              corners: next,
              confirmed: false,
            },
          }
        : { outline: next },
    );
  };
  const place = (q: SourcePoint) => {
    if (!study || busy) return;
    if (
      points.length >= (mode === "corners" ? 4 : PATTERN_SOURCE_LIMITS.points)
    ) {
      setError(
        mode === "corners"
          ? "Four corners are already placed. Select a corner to correct it, or reset the rectangle."
          : "Use at most 128 outline points.",
      );
      return;
    }
    changePoints(mode, [...points, q]);
    setPointIndex(points.length);
  };
  const detect = async () => {
    if (!study || !asset) return;
    setBusy(true);
    setError("");
    setStatus("Finding closed shapes locally…");
    const captured = study;
    try {
      const image = await loadImage(imageSource(asset)),
        scale = Math.min(
          1,
          PATTERN_SOURCE_LIMITS.rasterEdge /
            Math.max(image.width, image.height),
        );
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Image processing is unavailable.");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      const found = detectPatternOutlines(
        ctx.getImageData(0, 0, canvas.width, canvas.height),
        { ...captured.detector, kind: captured.kind },
      );
      setCandidates(found);
      setCandidateIndex(0);
      setMode("outline");
      setPointIndex(0);
      update({ outline: found[0] }, captured.id);
      setStatus(
        `${found.length} closed shape${found.length === 1 ? "" : "s"} found. Check the boundary before creating a piece. Text, grainlines and notches require manual checking.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("");
    } finally {
      setBusy(false);
    }
  };
  const addPieces = (next: SourcePiece[]) => {
    if (!study) return;
    update({ pieces: [...study.pieces, ...next] });
    setStatus(
      `${next.length} editable piece${next.length === 1 ? "" : "s"} saved in this source study. Review markings and allowances before use.`,
    );
  };
  let dimensions: { width: number; height: number } | null = null;
  let calibrationError = "";
  if (study?.calibration.confirmed) {
    try {
      calibrationTransform(study.calibration);
    } catch (e) {
      calibrationError = e instanceof Error ? e.message : String(e);
    }
  }
  if (study)
    try {
      dimensions = outlineDimensions(study.outline, study.calibration);
    } catch {
      /* Not calibrated yet. */
    }
  const openEdit = (p: SourcePiece) =>
    setEditing({
      studyId: study!.id,
      pieceId: p.id,
      value: structuredClone(p.construction),
      past: [],
      future: [],
    });
  const editChange = (v: Construction) =>
    setEditing((e) =>
      e
        ? {
            ...e,
            value: v,
            past: dragBase.current ? e.past : [...e.past, e.value].slice(-20),
            future: [],
          }
        : e,
    );
  if (editing)
    return (
      <ConstructionEditor
        id={editing.pieceId}
        value={editing.value}
        change={editChange}
        begin={() => {
          dragBase.current = editing.value;
        }}
        commit={() => {
          const base = dragBase.current;
          dragBase.current = null;
          if (base)
            setEditing((e) =>
              e ? { ...e, past: [...e.past, base].slice(-20), future: [] } : e,
            );
        }}
        canUndo={!!editing.past.length}
        canRedo={!!editing.future.length}
        undo={editorUndo}
        redo={editorRedo}
        close={() => {
          const s = latest.current.data.studies.find(
            (s) => s.id === editing.studyId,
          );
          if (s)
            update(
              {
                pieces: s.pieces.map((p) =>
                  p.id === editing.pieceId
                    ? { ...p, construction: editing.value }
                    : p,
                ),
              },
              s.id,
            );
          dragBase.current = null;
          setEditing(null);
        }}
      />
    );
  return (
    <FieldValidity.Provider value={markValidity}>
      <dialog
        ref={dialog}
        className="pattern-source-studio"
        aria-labelledby="ps-title"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        <header className="ps-header">
          <div>
            <p className="ps-eyebrow">FASHION / PERSONAL INVENTORY</p>
            <h2 id="ps-title">From reference to pattern</h2>
          </div>
          <button
            type="button"
            className="ps-close"
            aria-label="Close pattern source studio"
            onClick={close}
          >
            <X size={20} />
          </button>
        </header>
        <input
          ref={input}
          hidden
          type="file"
          accept="image/png,image/jpeg"
          aria-label="Import source images"
          onChange={(e) => void importFiles(Array.from(e.target.files ?? []))}
        />
        <div className="ps-body">
          <aside className="ps-inventory">
            <h3>Your source studies</h3>
            <p>
              Originals, calibration and editable pieces stay together in this
              project.
            </p>
            <div className="ps-import-actions">
              <button
                disabled={
                  busy || data.studies.length >= PATTERN_SOURCE_LIMITS.studies
                }
                onClick={() => chooseImport("pattern")}
              >
                <Plus size={16} />
                Import pattern image
              </button>
              <button
                disabled={
                  busy || data.studies.length >= PATTERN_SOURCE_LIMITS.studies
                }
                onClick={() => chooseImport("garment")}
              >
                <ImagePlus size={16} />
                Reconstruct garment
              </button>
            </div>
            <div className="ps-study-list">
              {data.studies.map((s) => {
                const a = assets.find((a) => a.id === s.primaryAssetId);
                return (
                  <button
                    key={s.id}
                    disabled={busy}
                    className={study?.id === s.id ? "selected" : ""}
                    aria-pressed={study?.id === s.id}
                    onClick={() => save({ ...data, selectedId: s.id })}
                  >
                    {a && <img src={imageSource(a)} alt="" />}
                    <span>
                      <strong>{s.name || "Untitled source"}</strong>
                      <small>
                        {s.kind === "pattern"
                          ? "Pattern image"
                          : "Garment reference"}{" "}
                        · {s.pieces.length} pieces
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="ps-muted">
              Local processing · PNG / JPEG
              <br />
              Up to 8 studies and 40 pieces.
            </p>
          </aside>
          <main
            className="ps-main"
            key={`${study?.id}-${study?.primaryAssetId}`}
          >
            {!study || !asset ? (
              <div className="ps-empty">
                <FolderOpen size={38} />
                <h3>Start with a reference you can measure</h3>
                <p>
                  Import a clear, closed pattern outline on a plain background,
                  or a front-facing garment flat lay. Include a flat rectangle
                  of known size in the same plane.
                </p>
                <p>
                  Pattern outlines become editable geometry. Garment photos
                  support approximate box tops and pull-on straight skirts with
                  measurements you confirm.
                </p>
                <p>
                  Lettering, grainlines, notches and hidden construction are
                  reviewed manually.
                </p>
              </div>
            ) : (
              <>
                <div className="ps-study-heading">
                  <label className="ps-field">
                    <span>Study name</span>
                    <input
                      aria-label="Source study name"
                      value={study.name}
                      maxLength={100}
                      onChange={(e) => update({ name: e.target.value })}
                    />
                  </label>
                  <span className="ps-badge">
                    {study.kind === "garment"
                      ? "Approximate reconstruction"
                      : "Outline conversion"}
                  </span>
                </div>
                <div className="ps-reference-strip">
                  {study.sourceAssetIds.map((id) => {
                    const a = assets.find((a) => a.id === id);
                    return (
                      a && (
                        <button
                          key={id}
                          disabled={busy}
                          aria-label={`Analyze reference ${a.name}`}
                          aria-pressed={id === study.primaryAssetId}
                          onClick={() => {
                            if (id !== study.primaryAssetId)
                              update({
                                primaryAssetId: id,
                                outline: [],
                                calibration: {
                                  ...study.calibration,
                                  corners: [],
                                  confirmed: false,
                                },
                              });
                          }}
                        >
                          <img src={imageSource(a)} alt="" />
                          <span>{a.name}</span>
                        </button>
                      )
                    );
                  })}
                  <button
                    disabled={busy || study.sourceAssetIds.length >= 6}
                    onClick={() => chooseImport({ studyId: study.id })}
                  >
                    <ImagePlus size={16} />
                    Add references
                  </button>
                </div>
                <p className="ps-muted">
                  Analyze one reference at a time. Switching keeps existing
                  pieces and their calibration. Additional photos support your
                  manual construction review.
                </p>
                <div className="ps-workbench">
                  <section
                    className="ps-image-panel"
                    aria-label="Source image and outline"
                  >
                    <div className="ps-toolrow">
                      <button
                        disabled={busy}
                        aria-pressed={mode === "corners"}
                        onClick={() => {
                          setMode("corners");
                          setPointIndex(0);
                        }}
                      >
                        <ScanLine size={16} />
                        Reference corners
                      </button>
                      <button
                        disabled={busy}
                        aria-pressed={mode === "outline"}
                        onClick={() => {
                          setMode("outline");
                          setPointIndex(0);
                        }}
                      >
                        <PenLine size={16} />
                        Trace / correct outline
                      </button>
                    </div>
                    <div className="ps-image-stage">
                      <svg
                        ref={svg}
                        viewBox={`0 0 ${asset.width} ${asset.height}`}
                        style={{
                          aspectRatio: `${asset.width}/${asset.height}`,
                          maxWidth: `min(100%, calc(58dvh * ${asset.width / asset.height}))`,
                        }}
                        aria-label="Pattern reference canvas"
                        role="img"
                        onPointerDown={(e) => {
                          if (e.button === 0 && !busy) {
                            place(coordinates(e));
                            e.preventDefault();
                          }
                        }}
                        onPointerMove={(e) => {
                          if (drag) setDrag({ ...drag, point: coordinates(e) });
                        }}
                        onPointerUp={(e) => {
                          if (!drag) return;
                          const old =
                            drag.kind === "corners"
                              ? study.calibration.corners
                              : study.outline;
                          changePoints(
                            drag.kind,
                            old.map((p, i) =>
                              i === drag.index ? coordinates(e) : p,
                            ),
                          );
                          setDrag(null);
                        }}
                        onPointerCancel={() => setDrag(null)}
                      >
                        <image
                          href={imageSource(asset)}
                          width={asset.width}
                          height={asset.height}
                        />
                        {(["corners", "outline"] as PointKind[]).map((kind) => {
                          const ps = (
                            kind === "corners"
                              ? study.calibration.corners
                              : study.outline
                          ).map((p, i) =>
                            drag?.kind === kind && drag.index === i
                              ? drag.point
                              : p,
                          );
                          const radius =
                            Math.max(asset.width, asset.height) * 0.007;
                          return (
                            <g key={kind} className={`ps-overlay-${kind}`}>
                              <polyline
                                points={[
                                  ...ps,
                                  ...(ps.length > 2 ? [ps[0]] : []),
                                ]
                                  .map(
                                    (p) =>
                                      `${p[0] * asset.width},${p[1] * asset.height}`,
                                  )
                                  .join(" ")}
                                fill="none"
                                strokeWidth={radius * 0.5}
                                strokeDasharray={
                                  kind === "corners"
                                    ? `${radius * 2} ${radius}`
                                    : undefined
                                }
                              />
                              {ps.map((p, i) => (
                                <g key={i}>
                                  <circle
                                    cx={p[0] * asset.width}
                                    cy={p[1] * asset.height}
                                    r={radius * (kind === mode ? 1 : 0.7)}
                                    strokeWidth={radius * 0.3}
                                    onPointerDown={(e) => {
                                      e.stopPropagation();
                                      if (busy) return;
                                      setMode(kind);
                                      setPointIndex(i);
                                      setDrag({ kind, index: i, point: p });
                                      svg.current?.setPointerCapture(
                                        e.pointerId,
                                      );
                                    }}
                                  />
                                  {kind === "corners" && (
                                    <text
                                      x={p[0] * asset.width + radius * 1.4}
                                      y={p[1] * asset.height - radius * 1.4}
                                      fontSize={radius * 2.8}
                                    >
                                      {i + 1}
                                    </text>
                                  )}
                                </g>
                              ))}
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                    <p className="ps-muted">
                      {mode === "corners"
                        ? "Click four corners clockwise: top-left, top-right, bottom-right, bottom-left. Drag handles to correct them."
                        : "Click successive boundary points, or drag detected points. The final edge closes automatically."}
                    </p>
                    <div className="ps-point-tools">
                      <label className="ps-field">
                        <span>
                          Selected{" "}
                          {mode === "corners" ? "corner" : "outline point"}
                        </span>
                        <select
                          aria-label="Selected source point"
                          value={Math.min(
                            pointIndex,
                            Math.max(0, points.length - 1),
                          )}
                          disabled={!points.length}
                          onChange={(e) => setPointIndex(+e.target.value)}
                        >
                          {points.length ? (
                            points.map((_, i) => (
                              <option key={i} value={i}>
                                {i + 1}
                              </option>
                            ))
                          ) : (
                            <option>No points yet</option>
                          )}
                        </select>
                      </label>
                      {points.length > 0 && (
                        <PointInputs
                          label="Selected source point"
                          point={
                            points[Math.min(pointIndex, points.length - 1)]
                          }
                          disabled={busy}
                          change={(q) =>
                            changePoints(
                              mode,
                              points.map((p, i) =>
                                i === Math.min(pointIndex, points.length - 1)
                                  ? q
                                  : p,
                              ),
                            )
                          }
                        />
                      )}
                      <button
                        disabled={!points.length || busy}
                        onClick={() => {
                          changePoints(
                            mode,
                            points.filter(
                              (_, i) =>
                                i !== Math.min(pointIndex, points.length - 1),
                            ),
                          );
                          setPointIndex(0);
                        }}
                      >
                        Remove point
                      </button>
                    </div>
                    <details>
                      <summary>Add a point with keyboard coordinates</summary>
                      <PointInputs
                        label="New source point"
                        point={keyboardPoint}
                        change={setKeyboardPoint}
                      />
                      <button
                        disabled={busy}
                        onClick={() => place(keyboardPoint)}
                      >
                        Add{" "}
                        {mode === "corners"
                          ? "reference corner"
                          : "outline point"}
                      </button>
                    </details>
                  </section>
                  <section
                    className="ps-settings"
                    aria-label="Calibration and conversion"
                  >
                    <h3>
                      <span>01</span>Correct perspective & scale
                    </h3>
                    <p>
                      The reference must share the pattern’s flat plane. A
                      garment worn on a body cannot be flattened accurately from
                      a single photograph.
                    </p>
                    <div className="ps-field-grid">
                      <NumberField
                        label="Reference width"
                        value={study.calibration.widthMm}
                        min={10}
                        max={2000}
                        change={(widthMm) =>
                          update({
                            calibration: {
                              ...study.calibration,
                              widthMm,
                              confirmed: false,
                            },
                          })
                        }
                      />
                      <NumberField
                        label="Reference height"
                        value={study.calibration.heightMm}
                        min={10}
                        max={2000}
                        change={(heightMm) =>
                          update({
                            calibration: {
                              ...study.calibration,
                              heightMm,
                              confirmed: false,
                            },
                          })
                        }
                      />
                    </div>
                    <label className="ps-check">
                      <input
                        type="checkbox"
                        checked={study.calibration.confirmed}
                        disabled={
                          study.calibration.corners.length !== 4 || busy
                        }
                        onChange={(e) =>
                          update({
                            calibration: {
                              ...study.calibration,
                              confirmed: e.target.checked,
                            },
                          })
                        }
                      />
                      <span>
                        I measured this rectangle and checked all four corners.
                        The initial 210 × 297 mm values are examples.
                      </span>
                    </label>
                    <button
                      disabled={busy || !study.calibration.corners.length}
                      onClick={() =>
                        update({
                          calibration: {
                            ...study.calibration,
                            corners: [],
                            confirmed: false,
                          },
                        })
                      }
                    >
                      Reset reference corners
                    </button>
                    <h3>
                      <span>02</span>
                      {study.kind === "pattern"
                        ? "Find a closed outline"
                        : "Measure the visible silhouette"}
                    </h3>
                    <p>
                      {study.kind === "pattern"
                        ? "Best with a dark, continuous outline on a plain light background. Interior text may create extra shapes; choose the correct boundary."
                        : "Best with a single dark garment laid flat on a plain light background. Use manual tracing if the fabric and background blend."}
                    </p>
                    <label className="ps-field">
                      <span>
                        Contrast threshold{" "}
                        <small>{study.detector.threshold}</small>
                      </span>
                      <input
                        aria-label="Outline contrast threshold"
                        type="range"
                        min={20}
                        max={240}
                        value={study.detector.threshold}
                        onChange={(e) =>
                          update({
                            detector: {
                              ...study.detector,
                              threshold: +e.target.value,
                            },
                          })
                        }
                      />
                    </label>
                    <label className="ps-check">
                      <input
                        type="checkbox"
                        checked={study.detector.inverse}
                        onChange={(e) =>
                          update({
                            detector: {
                              ...study.detector,
                              inverse: e.target.checked,
                            },
                          })
                        }
                      />
                      <span>Reverse light / dark background</span>
                    </label>
                    <button
                      className="ps-primary"
                      disabled={busy}
                      onClick={() => void detect()}
                    >
                      <ScanLine size={16} />
                      {busy ? "Processing…" : "Detect closed outlines"}
                    </button>
                    {!!candidates.length && (
                      <label className="ps-field">
                        <span>Detected shape</span>
                        <select
                          aria-label="Detected source shape"
                          value={candidateIndex}
                          onChange={(e) => {
                            const i = +e.target.value;
                            setCandidateIndex(i);
                            update({ outline: candidates[i] });
                            setMode("outline");
                            setPointIndex(0);
                          }}
                        >
                          {candidates.map((p, i) => (
                            <option key={i} value={i}>
                              Shape {i + 1} · {p.length} points
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <p className="ps-dimensions">
                      {dimensions
                        ? `${dimensions.width.toFixed(1)} × ${dimensions.height.toFixed(1)} mm`
                        : `${study.outline.length} outline points · scale unconfirmed`}
                    </p>
                    {calibrationError && (
                      <p className="ps-notice" role="alert">
                        {calibrationError}
                      </p>
                    )}
                    <p className="ps-muted">
                      Image perspective is corrected in the resulting geometry.
                      Your original image stays unchanged.
                    </p>
                    {study.kind === "pattern" ? (
                      <>
                        <button
                          className="ps-primary"
                          disabled={busy || !dimensions || !!invalidFields.size}
                          onClick={() =>
                            attempt(() =>
                              addPieces([
                                outlineToPiece(
                                  study,
                                  study.outline,
                                  candidates.length ? "detected" : "manual",
                                ),
                              ]),
                            )
                          }
                        >
                          Create editable pattern piece
                        </button>
                        <p className="ps-notice">
                          Grain, notches, labels and measurements inside the
                          drawing are not automatically read. New pieces start
                          with zero allowance and a provisional grainline for
                          your review.
                        </p>
                      </>
                    ) : (
                      <>
                        <h3>
                          <span>03</span>Confirm an approximate draft
                        </h3>
                        <p className="ps-notice">
                          Confidence: low for hidden construction. Measurements
                          are reliable only to your calibration and flat-lay
                          accuracy. No seam or material recognition is
                          performed.
                        </p>
                        <label className="ps-field">
                          <span>Supported construction</span>
                          <select
                            aria-label="Reconstruction family"
                            value={study.reconstruction.family}
                            onChange={(e) =>
                              recipe({
                                family: e.target
                                  .value as ReconstructionRecipe["family"],
                                constructionConfirmed: false,
                              })
                            }
                          >
                            <option value="box-top">
                              Sleeveless box top · front + back
                            </option>
                            <option value="straight-skirt">
                              Pull-on straight skirt · front + back + casing
                            </option>
                          </select>
                        </label>
                        <button
                          disabled={!dimensions || busy}
                          onClick={() =>
                            attempt(() =>
                              update({
                                reconstruction: suggestReconstruction(study),
                              }),
                            )
                          }
                        >
                          Use measured silhouette dimensions
                        </button>
                        <p className="ps-muted">
                          Silhouette width can include sleeves or perspective
                          distortion. Confirm the actual flat panel width below.
                        </p>
                        <div className="ps-field-grid">
                          <NumberField
                            label="Flat panel width"
                            value={study.reconstruction.widthMm}
                            min={120}
                            max={1400}
                            change={(widthMm) =>
                              recipe({ widthMm, measurementsConfirmed: false })
                            }
                          />
                          <NumberField
                            label="Garment length"
                            value={study.reconstruction.lengthMm}
                            min={150}
                            max={1800}
                            change={(lengthMm) =>
                              recipe({ lengthMm, measurementsConfirmed: false })
                            }
                          />
                          {study.reconstruction.family === "box-top" ? (
                            <>
                              <NumberField
                                label="Neck width"
                                value={study.reconstruction.neckWidthMm}
                                min={60}
                                max={400}
                                change={(neckWidthMm) =>
                                  recipe({
                                    neckWidthMm,
                                    measurementsConfirmed: false,
                                  })
                                }
                              />
                              <NumberField
                                label="Front neck depth"
                                value={study.reconstruction.frontNeckDepthMm}
                                min={20}
                                max={300}
                                change={(frontNeckDepthMm) =>
                                  recipe({
                                    frontNeckDepthMm,
                                    measurementsConfirmed: false,
                                  })
                                }
                              />
                              <NumberField
                                label="Back neck depth"
                                value={study.reconstruction.backNeckDepthMm}
                                min={10}
                                max={100}
                                change={(backNeckDepthMm) =>
                                  recipe({
                                    backNeckDepthMm,
                                    measurementsConfirmed: false,
                                  })
                                }
                              />
                              <NumberField
                                label="Armhole depth"
                                value={study.reconstruction.armholeDepthMm}
                                min={80}
                                max={500}
                                change={(armholeDepthMm) =>
                                  recipe({
                                    armholeDepthMm,
                                    measurementsConfirmed: false,
                                  })
                                }
                              />
                            </>
                          ) : (
                            <>
                              <NumberField
                                label="Hip circumference"
                                value={study.reconstruction.hipCircumferenceMm}
                                min={500}
                                max={2000}
                                change={(hipCircumferenceMm) =>
                                  recipe({
                                    hipCircumferenceMm,
                                    measurementsConfirmed: false,
                                  })
                                }
                              />
                              <NumberField
                                label="Finished casing width"
                                value={study.reconstruction.casingWidthMm}
                                min={15}
                                max={100}
                                change={(casingWidthMm) =>
                                  recipe({
                                    casingWidthMm,
                                    measurementsConfirmed: false,
                                  })
                                }
                              />
                            </>
                          )}
                          <NumberField
                            label="Seam allowance"
                            value={study.reconstruction.allowanceMm}
                            min={0}
                            max={30}
                            change={(allowanceMm) =>
                              recipe({
                                allowanceMm,
                                constructionConfirmed: false,
                              })
                            }
                          />
                        </div>
                        <label className="ps-field">
                          <span>
                            Construction assumptions / uncertain details
                          </span>
                          <textarea
                            aria-label="Reconstruction assumptions"
                            value={study.reconstruction.assumptions}
                            maxLength={2000}
                            onChange={(e) =>
                              recipe({
                                assumptions: e.target.value,
                                constructionConfirmed: false,
                              })
                            }
                          />
                        </label>
                        <label className="ps-check">
                          <input
                            type="checkbox"
                            checked={study.reconstruction.measurementsConfirmed}
                            onChange={(e) =>
                              recipe({
                                measurementsConfirmed: e.target.checked,
                              })
                            }
                          />
                          <span>
                            I checked these garment and body measurements.
                          </span>
                        </label>
                        <label className="ps-check">
                          <input
                            type="checkbox"
                            checked={study.reconstruction.constructionConfirmed}
                            onChange={(e) =>
                              recipe({
                                constructionConfirmed: e.target.checked,
                              })
                            }
                          />
                          <span>
                            I accept the{" "}
                            {study.reconstruction.family === "box-top"
                              ? "unshaped sleeveless shell with assumed back and no closures"
                              : "two straight panels with an elastic casing"}
                            ; I will review construction and make a toile.
                          </span>
                        </label>
                        <button
                          className="ps-primary"
                          disabled={
                            busy ||
                            !dimensions ||
                            !!invalidFields.size ||
                            !study.reconstruction.measurementsConfirmed ||
                            !study.reconstruction.constructionConfirmed
                          }
                          onClick={() =>
                            attempt(() => addPieces(reconstructGarment(study)))
                          }
                        >
                          Generate approximate pieces
                        </button>
                      </>
                    )}
                  </section>
                </div>
                <section className="ps-pieces">
                  <div className="ps-section-title">
                    <div>
                      <h3>Editable pieces</h3>
                      <p>
                        Correct points, curves, grain, notches, labels and seam
                        allowances in the construction editor.
                      </p>
                    </div>
                    <button
                      className="ps-primary"
                      disabled={
                        !study.pieces.length || busy || !!invalidFields.size
                      }
                      onClick={() =>
                        attempt(() => {
                          onUsePieces(sourcePiecesForDraft(study));
                          close();
                        })
                      }
                    >
                      Use these pieces in draft <ArrowUpRight size={16} />
                    </button>
                  </div>
                  {!study.pieces.length ? (
                    <p className="ps-muted">
                      No pieces yet. Calibrate, trace or detect, then create
                      your first editable result.
                    </p>
                  ) : (
                    <div className="ps-piece-grid">
                      {study.pieces.map((p) => (
                        <article key={p.id} className="ps-piece">
                          <PiecePreview piece={p} />
                          <div>
                            <span className="ps-badge">
                              {p.origin === "approximate"
                                ? "Approximate · review required"
                                : "Imported · markings unverified"}
                            </span>
                            <h4>{p.construction.name}</h4>
                            <p>{p.construction.cut}</p>
                            <details>
                              <summary>Details to check</summary>
                              <ul>
                                {p.unresolved.map((s) => (
                                  <li key={s}>{s}</li>
                                ))}
                              </ul>
                            </details>
                            <div className="ps-toolrow">
                              <button onClick={() => openEdit(p)}>
                                Edit geometry & markings
                              </button>
                              <button
                                aria-label={`Remove ${p.construction.name}`}
                                onClick={() =>
                                  update({
                                    pieces: study.pieces.filter(
                                      (q) => q.id !== p.id,
                                    ),
                                  })
                                }
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
                <section className="ps-provenance">
                  <h3>Source & permission</h3>
                  <p>
                    Preserved original: {asset.name} · {asset.width} ×{" "}
                    {asset.height} px · SHA-256 {asset.sha256.slice(0, 16)}…
                  </p>
                  <div className="ps-field-grid">
                    <label className="ps-field">
                      <span>Source / URL / author</span>
                      <textarea
                        aria-label="Source provenance"
                        maxLength={1500}
                        value={study.sourceNote}
                        onChange={(e) => update({ sourceNote: e.target.value })}
                      />
                    </label>
                    <div>
                      <label className="ps-field">
                        <span>Permission status</span>
                        <select
                          aria-label="Source permission status"
                          value={study.permission}
                          onChange={(e) =>
                            update({
                              permission: e.target
                                .value as PatternSourceStudy["permission"],
                            })
                          }
                        >
                          <option value="unknown">
                            Unverified · private reference
                          </option>
                          <option value="own">My own work</option>
                          <option value="licensed">
                            Licensed for this use
                          </option>
                          <option value="permission">
                            Author permission obtained
                          </option>
                        </select>
                      </label>
                      <label className="ps-field">
                        <span>License / permission notes</span>
                        <textarea
                          aria-label="Source permission notes"
                          maxLength={1500}
                          value={study.permissionNote}
                          onChange={(e) =>
                            update({ permissionNote: e.target.value })
                          }
                        />
                      </label>
                    </div>
                  </div>
                  <p className="ps-muted">
                    A source note records your review; it does not verify
                    rights. Check permission before sharing a derived pattern.
                  </p>
                </section>
              </>
            )}
          </main>
        </div>
        <footer className="ps-footer">
          <div>
            {error && <p role="alert">{error}</p>}
            <p role="status">
              {status ||
                "Changes are included when you save the project. Originals are retained alongside the editable results."}
            </p>
          </div>
          <button onClick={close}>Done</button>
        </footer>
      </dialog>
    </FieldValidity.Provider>
  );
}
