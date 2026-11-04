import { ClothStudio } from "./ClothStudio";
import { GarmentPhotoStudio } from "./GarmentPhotoStudio";
import type { Asset, Body } from "./domain";
import { PatternFormulas } from "./PatternFormulas";
import { resolveConstruction } from "./pattern-formulas";
import { FashionProfiles } from "./FashionProfiles";
import { FashionGrades } from "./FashionGrades";
import { designControls, requiredMeasures } from "./design-adapters";
import {
  designIds,
  designNames,
  lowerBodySample,
  sampleFabric,
  type DesignId,
} from "./fashion-model";
import { ConstructionEditor } from "./ConstructionEditor";
import { detachPiece } from "./pattern-geometry";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import {
  ArrowDownToLine,
  Grid2X2,
  Hand,
  Maximize,
  Minus,
  MousePointer2,
  Plus,
  Ruler,
  Scissors,
  Shirt,
  SlidersHorizontal,
} from "lucide-react";
import {
  defaultLayout,
  layoutBounds,
  layoutPieces,
  measurementFields,
  optionFields,
  tilePlan,
  type Fashion,
  type MeasurementKey,
  type OptionKey,
  type PieceId,
  type Point2,
} from "./fashion-model";
import { draftFashion } from "./fashion-draft";
import { patternPdf, patternSvg, pieceMarkup } from "./fashion-export";
import { savePattern } from "./io";
import "./fashion.css";

function Field({
  label,
  value,
  min,
  max,
  unit = "mm",
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  hint?: string;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(Number.isFinite(value) ? String(value) : "");
  const cancelled = useRef(false);
  useEffect(
    () =>
      setText(
        Number.isFinite(value) ? String(Math.round(value * 100) / 100) : "",
      ),
    [value],
  );
  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const v = Number(text);
    if (text.trim() && Number.isFinite(v)) {
      const next = Math.min(max, Math.max(min, v));
      if (next !== value) onChange(next);
      setText(String(next));
    } else setText(String(value));
  };
  return (
    <label className="fashion-field" title={hint}>
      <span>{label}</span>
      <div>
        <input
          aria-label={label}
          type="number"
          min={min}
          max={max}
          step="0.1"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              cancelled.current = true;
              setText(String(value));
              e.currentTarget.blur();
            }
          }}
        />
        <small>{unit}</small>
      </div>
    </label>
  );
}
type ViewBox = { x: number; y: number; width: number; height: number };
export function FashionWorkspace({
  value,
  assets,
  body,
  onChange,
  onBegin,
  onCommit,
  undo,
  redo,
  canUndo,
  canRedo,
  busy,
  setBusy,
  notify,
  name,
  exporter,
}: {
  value: Fashion;
  assets: Asset[];
  body: Body;
  onChange: (f: Fashion, asset?: Asset) => void;
  onBegin: () => void;
  onCommit: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  busy: boolean;
  setBusy: (b: boolean) => void;
  notify: (s: string, error?: boolean) => void;
  name: string;
  exporter: RefObject<(() => Promise<void>) | null>;
}) {
  const [clothOpen, setClothOpen] = useState(false);
  const [photoStudy, setPhotoStudy] = useState(false);
  const [grades, setGrades] = useState(false);
  const design = value.design ?? "teagan";
  const required = requiredMeasures(design);
  const [left, setLeft] = useState<"measurements" | "pieces">("measurements");
  const [right, setRight] = useState<"design" | "export">("design");
  const [selected, setSelected] = useState<PieceId>("front");
  const [tool, setTool] = useState<"move" | "shape" | "pan">("move");
  const [grid, setGrid] = useState(true);
  const [geometry, setGeometry] = useState<PieceId | null>(null);
  const [view, setView] = useState<ViewBox | null>(null);
  const [exportType, setExportType] = useState<"pdf" | "svg">("pdf");
  const svg = useRef<SVGSVGElement>(null);
  const gesture = useRef<{
    start: Point2;
    base: Fashion;
    box: ViewBox;
    id?: PieceId;
    handle?: "neck" | "length" | "sleeve";
    halfWidth?: number;
  }>(null);
  const outcome = useMemo(() => {
    try {
      return { draft: draftFashion(value), error: "" };
    } catch (e) {
      return { draft: null, error: e instanceof Error ? e.message : String(e) };
    }
    // Layout, notes and paper never trigger the solver.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    value.measurements,
    value.options,
    value.seamAllowance,
    value.bandRatio,
    value.bandWidth,
    value.construction,
    value.design,
    value.designOptions,
    value.fabric,
  ]);
  const draft = outcome.draft;
  const bounds = draft
    ? layoutBounds(draft, value)
    : { x: 0, y: 0, width: 1200, height: 800 };
  const box = view ?? bounds;
  const pieces = draft ? layoutPieces(draft, value) : [];
  const chosen = draft?.pieces.find((p) => p.id === selected);
  const pages = draft
    ? 1 +
      draft.pieces.reduce((n, p) => {
        const t = tilePlan(p, value.paper);
        return n + t.rows * t.columns;
      }, 0)
    : 0;
  const changeMeasure = (key: MeasurementKey, n: number) =>
    onChange({ ...value, measurements: { ...value.measurements, [key]: n } });
  const changeOption = (key: OptionKey, n: number) =>
    onChange({ ...value, options: { ...value.options, [key]: n } });
  const doExport = async () => {
    if (busy) return;
    if (!draft) {
      notify("Review the measurement error before exporting a pattern.", true);
      return;
    }
    setBusy(true);
    try {
      const bytes =
        exportType === "svg"
          ? new TextEncoder().encode(patternSvg(draft, value, name))
          : await patternPdf(draft, value, name);
      if (await savePattern(bytes, name, exportType))
        notify(
          exportType === "pdf"
            ? `Pattern exported: ${pages} pages at actual size.`
            : "Full-size SVG exported in millimeters.",
        );
    } catch (e) {
      notify(`Pattern export failed: ${String(e)}`, true);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    exporter.current = doExport;
    return () => {
      exporter.current = null;
    };
  });
  const local = (e: { clientX: number; clientY: number }) => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      matrix.inverse(),
    );
    return { x: p.x, y: p.y };
  };
  const begin = (
    e: ReactPointerEvent,
    id?: PieceId,
    handle?: "neck" | "length" | "sleeve",
  ) => {
    if (busy || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (id) setSelected(id);
    if (tool === "shape" && !handle && id) return;
    if (tool === "pan") id = undefined;
    setView(box);
    gesture.current = {
      start: local(e),
      base: value,
      box,
      id,
      handle,
      halfWidth: draft?.pieces.find((p) => p.id === id)?.sleeveHalfWidth,
    };
    svg.current?.setPointerCapture(e.pointerId);
    if (id) onBegin();
  };
  const move = (e: ReactPointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const pos = local(e),
      dx = pos.x - g.start.x,
      dy = pos.y - g.start.y;
    if (!g.id) {
      setView({ ...box, x: box.x - dx, y: box.y - dy });
      return;
    }
    if (g.handle) {
      const key =
        g.handle === "neck"
          ? "necklineDepth"
          : g.handle === "length"
            ? "lengthBonus"
            : "sleeveLength";
      const divisor =
        g.handle === "neck"
          ? g.base.measurements.hpsToWaistBack
          : g.handle === "length"
            ? g.base.measurements.hpsToWaistBack +
              g.base.measurements.waistToHips
            : g.halfWidth!;
      const field = optionFields.find((f) => f[0] === key)!;
      const next =
        Math.round(
          Math.max(
            field[2],
            Math.min(field[3], g.base.options[key] + (dy / divisor) * 100),
          ) * 10,
        ) / 10;
      onChange({ ...g.base, options: { ...g.base.options, [key]: next } });
    } else {
      const clamp = (n: number) =>
        Math.round(Math.max(-2000, Math.min(2000, n)));
      onChange({
        ...g.base,
        layout: {
          ...g.base.layout,
          [g.id]: {
            x: clamp((g.base.layout[g.id]?.x ?? 0) + dx),
            y: clamp((g.base.layout[g.id]?.y ?? 0) + dy),
          },
        },
      });
    }
  };
  const end = () => {
    if (gesture.current?.id) onCommit();
    gesture.current = null;
  };
  const zoom = (factor: number) =>
    setView({
      x: box.x + (box.width * (1 - factor)) / 2,
      y: box.y + (box.height * (1 - factor)) / 2,
      width: Math.max(150, Math.min(6000, box.width * factor)),
      height: Math.max(120, Math.min(5000, box.height * factor)),
    });
  useEffect(
    () => () => {
      if (gesture.current?.id) onCommit();
    },
    [onCommit],
  );
  return (
    <main className="fashion-workspace" aria-label="Fashion pattern studio">
      {clothOpen && draft && (
        <ClothStudio
          value={value}
          draft={draft}
          body={body}
          change={onChange}
          close={() => setClothOpen(false)}
        />
      )}
      {photoStudy && (
        <GarmentPhotoStudio
          value={value}
          assets={assets}
          change={onChange}
          close={() => setPhotoStudy(false)}
        />
      )}
      {geometry && draft && value.construction?.[geometry] && (
        <ConstructionEditor
          id={geometry}
          value={value.construction[geometry]!}
          change={(c) =>
            onChange({
              ...value,
              construction: { ...value.construction, [geometry]: c },
            })
          }
          begin={onBegin}
          commit={onCommit}
          undo={undo}
          redo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          close={() => setGeometry(null)}
        />
      )}
      <aside className="fashion-library">
        <div className="fashion-heading">
          <span className="eyebrow">GARMENT LIBRARY</span>
          <Shirt size={20} />
          <h2>{designNames[design].split(" · ")[0]}</h2>
          <p>
            {designNames[design].split(" · ")[1]}
            <br />
            Drafted from your measurements.
          </p>
        </div>
        <label className="fashion-text-field garment-selector">
          Garment design
          <select
            aria-label="Garment design"
            value={design}
            disabled={busy}
            onChange={(e) => {
              const next = e.target.value as DesignId;
              onChange({
                ...value,
                design: next,
                designOptions: {},
                construction: undefined,
                layout: defaultLayout(),
              });
              setSelected(next === "teagan" ? "front" : next + ".front");
              setView(null);
              setGeometry(null);
            }}
          >
            {designIds.map((id) => (
              <option value={id} key={id}>
                {designNames[id]}
              </option>
            ))}
          </select>
        </label>
        <div className="fashion-tabs">
          <button
            className={left === "measurements" ? "active" : ""}
            onClick={() => setLeft("measurements")}
          >
            <Ruler size={14} />
            Measurements
          </button>
          <button
            className={left === "pieces" ? "active" : ""}
            onClick={() => setLeft("pieces")}
          >
            <Scissors size={14} />
            Pieces
          </button>
        </div>
        <fieldset disabled={busy} className="fashion-scroll">
          {left === "measurements" ? (
            <>
              <label className="fashion-text-field">
                PROFILE NAME
                <input
                  aria-label="Measurement profile name"
                  maxLength={80}
                  value={value.profile}
                  onChange={(e) => {
                    if (e.target.value.trim())
                      onChange({ ...value, profile: e.target.value });
                  }}
                />
              </label>
              <p className="fashion-caption">
                Sample values are a starting point. Enter your own measurements
                in millimeters.
              </p>
              <button
                className="wide-button"
                onClick={(e) => {
                  e.currentTarget.focus();
                  setPhotoStudy(true);
                }}
              >
                Measure garment photo
              </button>
              <button
                className="wide-button"
                disabled={!draft}
                onClick={(e) => {
                  e.currentTarget.focus();
                  setClothOpen(true);
                }}
              >
                3D drape studio
              </button>
              <FashionProfiles
                value={value}
                change={onChange}
                notify={notify}
              />
              {required.some(
                (k) => value.measurements[k as MeasurementKey] === undefined,
              ) && (
                <button
                  onClick={() =>
                    onChange({
                      ...value,
                      measurements: {
                        ...lowerBodySample,
                        ...value.measurements,
                      },
                      profile: "Sample measurements · verify before cutting",
                    })
                  }
                >
                  Add missing lower-body sample values
                </button>
              )}
              {measurementFields
                .filter(([k]) => required.includes(k))
                .slice(0, 6)
                .map(([key, label, min, max, hint]) => (
                  <Field
                    key={key}
                    label={label}
                    value={value.measurements[key] ?? NaN}
                    min={min}
                    max={max}
                    hint={hint}
                    onChange={(n) => changeMeasure(key, n)}
                  />
                ))}
              <details className="fashion-details" open>
                <summary>Lengths & shoulder angle</summary>
                {measurementFields
                  .filter(([k]) => required.includes(k))
                  .slice(6)
                  .map(([key, label, min, max, hint]) => (
                    <Field
                      key={key}
                      label={label}
                      value={value.measurements[key] ?? NaN}
                      min={min}
                      max={max}
                      unit={key === "shoulderSlope" ? "°" : "mm"}
                      hint={hint}
                      onChange={(n) => changeMeasure(key, n)}
                    />
                  ))}
              </details>
            </>
          ) : (
            <>
              <p className="fashion-caption">
                Select a piece to inspect it. Drag to arrange the board; print
                tiles use a separate layout.
              </p>
              <button
                className="wide-button"
                onClick={() => {
                  if (Object.keys(value.construction ?? {}).length >= 40) {
                    notify("Up to 40 custom pieces are supported.", true);
                    return;
                  }
                  const id = "custom-" + crypto.randomUUID();
                  const c = {
                    name: "Custom panel",
                    cut: "Cut 1 · verify grain",
                    seam: [
                      { type: "move" as const, to: { x: 0, y: 0 } },
                      { type: "line" as const, to: { x: 250, y: 0 } },
                      { type: "line" as const, to: { x: 250, y: 350 } },
                      { type: "line" as const, to: { x: 0, y: 350 } },
                      { type: "close" as const },
                    ],
                    allowances: [0, 10, 10, 10, 10],
                    notches: [],
                    darts: [],
                    guides: [],
                    grain: [
                      { x: 125, y: 80 },
                      { x: 125, y: 270 },
                    ] as [{ x: number; y: number }, { x: number; y: number }],
                    label: { x: 125, y: 160 },
                  };
                  onChange({
                    ...value,
                    construction: { ...value.construction, [id]: c },
                  });
                  setSelected(id);
                  setView(null);
                }}
              >
                Add custom pattern piece
              </button>
              {draft?.pieces.map((p, i) => (
                <button
                  className={`fashion-piece-row ${selected === p.id ? "selected" : ""}`}
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                >
                  <span className="piece-index">0{i + 1}</span>
                  <span>
                    <b>{p.name}</b>
                    <small>{p.cut}</small>
                    <small>
                      {p.width.toFixed(1)} × {p.height.toFixed(1)} mm
                    </small>
                  </span>
                </button>
              ))}
              <button
                className="fashion-secondary"
                onClick={() => {
                  onChange({ ...value, layout: defaultLayout() });
                  setView(null);
                }}
              >
                Arrange pieces
              </button>
              {chosen && (
                <>
                  <p className="fashion-caption">
                    Edit anchors, Bézier curves, notches and dart markings.
                    Detaching preserves the stitching line and rebuilds
                    allowances with mitered corners.
                  </p>
                  <button
                    className="fashion-secondary"
                    disabled={chosen.manualEditable === false}
                    onClick={() => {
                      if (value.construction?.[selected]?.formulas?.length) {
                        onChange({
                          ...value,
                          construction: {
                            ...value.construction,
                            [selected]: {
                              ...resolveConstruction(
                                value.construction[selected],
                                value.measurements,
                              ),
                              formulas: undefined,
                            },
                          },
                        });
                        notify(
                          "Measurement formulas detached for direct geometry editing. Undo restores them.",
                        );
                      } else if (!value.construction?.[selected])
                        onChange({
                          ...value,
                          construction: {
                            ...value.construction,
                            [selected]: detachPiece(
                              chosen,
                              value.seamAllowance,
                            ),
                          },
                        });
                      setGeometry(selected);
                    }}
                  >
                    Edit points & curves
                  </button>
                  {chosen.manualEditable !== false && (
                    <PatternFormulas
                      key={selected}
                      value={value}
                      piece={chosen}
                      change={onChange}
                      notify={notify}
                    />
                  )}
                  {value.construction?.[selected] && (
                    <>
                      <p className="fashion-caption">
                        Manual piece · only formula-linked coordinates follow
                        measurements.
                      </p>
                      <button
                        className="fashion-secondary"
                        onClick={() => {
                          const construction = { ...value.construction };
                          delete construction[selected];
                          onChange({ ...value, construction });
                        }}
                      >
                        Restore measurement draft
                      </button>
                    </>
                  )}
                </>
              )}
              <label className="fashion-text-field">
                STUDIO NOTES
                <textarea
                  aria-label="Garment notes"
                  value={value.notes}
                  maxLength={3000}
                  placeholder="Fabric, fitting observations, construction…"
                  onChange={(e) =>
                    onChange({ ...value, notes: e.target.value })
                  }
                />
              </label>
            </>
          )}
        </fieldset>
        <div className="fashion-credit">
          Drafting · FreeSewing {designNames[design].split(" · ")[0]}
          <br />
          <span>All measurements stay on this device.</span>
        </div>
      </aside>
      <section className="pattern-board">
        <div className="pattern-title">
          <div>
            <span className="eyebrow">PATTERN BOARD</span>
            <h3>{chosen?.name ?? "Your first fitting draft"}</h3>
          </div>
          <span>
            <button aria-pressed={grades} onClick={() => setGrades(!grades)}>
              {grades ? "Pattern board" : "Compare sizes"}
            </button>{" "}
            {draft?.pieces.length ?? 0} PIECES <i /> MM
          </span>
        </div>
        {grades && <FashionGrades value={value} notify={notify} />}
        <div style={{ display: grades ? "none" : "contents" }}>
          <div className="pattern-toolbar">
            <div className="pattern-tools">
              <button
                aria-label="Arrange pattern pieces"
                aria-pressed={tool === "move"}
                onClick={() => setTool("move")}
              >
                <MousePointer2 size={16} />
              </button>
              <button
                aria-label="Edit pattern shape"
                aria-pressed={tool === "shape"}
                onClick={() => setTool("shape")}
              >
                <SlidersHorizontal size={16} />
              </button>
              <button
                aria-label="Pan pattern board"
                aria-pressed={tool === "pan"}
                onClick={() => setTool("pan")}
              >
                <Hand size={16} />
              </button>
              <span />
              <button
                aria-label="Toggle pattern grid"
                aria-pressed={grid}
                onClick={() => setGrid(!grid)}
              >
                <Grid2X2 size={16} />
              </button>
            </div>
            <div className="pattern-tools">
              <button aria-label="Zoom pattern out" onClick={() => zoom(1.2)}>
                <Minus size={15} />
              </button>
              <span className="pattern-zoom">
                {Math.round((bounds.width / box.width) * 100)}%
              </span>
              <button
                aria-label="Zoom pattern in"
                onClick={() => zoom(1 / 1.2)}
              >
                <Plus size={15} />
              </button>
              <button
                aria-label="Fit all pattern pieces"
                onClick={() => setView(null)}
              >
                <Maximize size={16} />
              </button>
            </div>
          </div>
          <div className={`pattern-canvas ${tool}`}>
            {outcome.error ? (
              <div className="pattern-error" role="alert">
                <Ruler size={26} />
                <h3>Check your measurements</h3>
                <p>{outcome.error}</p>
                <p>
                  Adjust the fields or undo the last change to restore the
                  draft.
                </p>
              </div>
            ) : (
              <svg
                ref={svg}
                aria-label="Sewing pattern canvas"
                role="img"
                viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
                onPointerDown={(e) => begin(e)}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
                onLostPointerCapture={end}
                onWheel={(e) => {
                  if (!gesture.current) zoom(e.deltaY > 0 ? 1.08 : 1 / 1.08);
                }}
              >
                <defs>
                  <pattern
                    id="fashion-grid-small"
                    width="10"
                    height="10"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M10 0H0V10"
                      fill="none"
                      stroke="#dedede"
                      strokeWidth="0.3"
                    />
                  </pattern>
                  <pattern
                    id="fashion-grid"
                    width="50"
                    height="50"
                    patternUnits="userSpaceOnUse"
                  >
                    <rect
                      width="50"
                      height="50"
                      fill="url(#fashion-grid-small)"
                    />
                    <path
                      d="M50 0H0V50"
                      fill="none"
                      stroke="#c9c9c9"
                      strokeWidth="0.5"
                    />
                  </pattern>
                </defs>
                {grid && (
                  <rect
                    x={box.x - 5000}
                    y={box.y - 5000}
                    width={box.width + 10000}
                    height={box.height + 10000}
                    fill="url(#fashion-grid)"
                  />
                )}
                {pieces.map(({ piece: p, x, y }, i) => (
                  <g
                    key={p.id}
                    transform={`translate(${x} ${y})`}
                    className={`pattern-piece ${selected === p.id ? "selected" : ""}`}
                    data-piece={p.id}
                    onPointerDown={(e) => begin(e, p.id)}
                  >
                    <rect
                      className="piece-bounds"
                      x={-6}
                      y={-6}
                      width={p.width + 12}
                      height={p.height + 12}
                      rx="3"
                      fill="transparent"
                      stroke={selected === p.id ? "#999" : "transparent"}
                      strokeWidth="0.5"
                      strokeDasharray="3 4"
                    />
                    <text
                      y={-15}
                      fontSize="14"
                      fill="#666"
                      fontFamily="Arial, sans-serif"
                    >
                      0{i + 1} / {p.name.toUpperCase()}
                    </text>
                    <g
                      dangerouslySetInnerHTML={{
                        __html: pieceMarkup(p, value.seamAllowance),
                      }}
                    />
                    {tool === "shape" &&
                      p.handles.map((h) => (
                        <g
                          key={h.kind}
                          className="pattern-handle"
                          data-handle={h.kind}
                          onPointerDown={(e) => begin(e, p.id, h.kind)}
                        >
                          <circle
                            cx={h.point.x}
                            cy={h.point.y}
                            r={7}
                            fill="#222"
                            stroke="white"
                            strokeWidth={2}
                          />
                          <path
                            d={`M${h.point.x - 2},${h.point.y - 2} l2,-2 l2,2 M${h.point.x - 2},${h.point.y + 2} l2,2 l2,-2`}
                            fill="none"
                            stroke="white"
                            strokeWidth={0.8}
                          />
                          <text
                            x={h.point.x + 12}
                            y={h.point.y + 2}
                            fontSize={6}
                            fill="#333"
                          >
                            {h.kind === "neck"
                              ? "NECK DEPTH"
                              : h.kind === "length"
                                ? "BODY LENGTH"
                                : "SLEEVE LENGTH"}
                          </text>
                        </g>
                      ))}
                  </g>
                ))}
              </svg>
            )}
          </div>
          <div className="pattern-bottom">
            <span>
              {tool === "shape"
                ? "Drag a black handle to reshape the pattern"
                : tool === "pan"
                  ? "Drag to pan · Scroll to zoom"
                  : "Drag pieces to arrange · Scroll to zoom"}
            </span>
            <span>Grid 10 mm / 50 mm</span>
          </div>
        </div>
      </section>
      <aside className="fashion-inspector">
        <div className="fashion-tabs">
          <button
            className={right === "design" ? "active" : ""}
            onClick={() => setRight("design")}
          >
            Design & fit
          </button>
          <button
            className={right === "export" ? "active" : ""}
            onClick={() => setRight("export")}
          >
            Print & export
          </button>
        </div>
        <fieldset disabled={busy} className="fashion-scroll">
          {right === "design" ? (
            <>
              {design === "teagan" ? (
                <>
                  <span className="eyebrow">STARTING SILHOUETTE</span>
                  <div className="fashion-presets">
                    {[
                      { name: "Classic", chest: 12, length: 0, sleeve: 40 },
                      { name: "Relaxed", chest: 24, length: 5, sleeve: 65 },
                      { name: "Longline", chest: 15, length: 20, sleeve: 50 },
                    ].map((p) => (
                      <button
                        key={p.name}
                        onClick={() =>
                          onChange({
                            ...value,
                            options: {
                              ...value.options,
                              chestEase: p.chest,
                              lengthBonus: p.length,
                              sleeveLength: p.sleeve,
                            },
                          })
                        }
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                  <h4>Fit & proportion</h4>
                  {optionFields
                    .slice(0, 6)
                    .map(([key, label, min, max, unit, hint]) => (
                      <Field
                        key={key}
                        label={label}
                        value={value.options[key]}
                        min={min}
                        max={max}
                        unit={unit}
                        hint={hint}
                        onChange={(n) => changeOption(key, n)}
                      />
                    ))}
                  <label className="fashion-check">
                    <input
                      type="checkbox"
                      checked={value.options.fitWaist}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          options: {
                            ...value.options,
                            fitWaist: e.target.checked,
                          },
                        })
                      }
                    />
                    Shape to waist
                  </label>
                  <h4>Neckline</h4>
                  {optionFields
                    .slice(6)
                    .map(([key, label, min, max, unit, hint]) => (
                      <Field
                        key={key}
                        label={label}
                        value={value.options[key]}
                        min={min}
                        max={max}
                        unit={unit}
                        hint={hint}
                        onChange={(n) => changeOption(key, n)}
                      />
                    ))}
                  <Field
                    label="Neckband ratio"
                    min={70}
                    max={100}
                    value={value.bandRatio * 100}
                    unit="%"
                    hint="Test ribbing stretch before cutting. This ratio is not a fabric simulation."
                    onChange={(n) => onChange({ ...value, bandRatio: n / 100 })}
                  />
                  <Field
                    label="Finished neckband width"
                    min={10}
                    max={35}
                    value={value.bandWidth}
                    onChange={(n) => onChange({ ...value, bandWidth: n })}
                  />
                </>
              ) : (
                <>
                  <h4>Design options</h4>
                  {designControls(design).map((o) => {
                    const current =
                      value.designOptions?.[o.key] ??
                      o.pct ??
                      o.deg ??
                      o.count ??
                      o.bool ??
                      o.dflt;
                    const title = o.key
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (c) => c.toUpperCase());
                    const change = (v: number | string | boolean) =>
                      onChange({
                        ...value,
                        designOptions: { ...value.designOptions, [o.key]: v },
                      });
                    return o.bool !== undefined ? (
                      <label className="fashion-check" key={o.key}>
                        <input
                          type="checkbox"
                          checked={Boolean(current)}
                          onChange={(e) => change(e.target.checked)}
                        />
                        {title}
                      </label>
                    ) : o.list ? (
                      <label className="fashion-text-field" key={o.key}>
                        {title}
                        <select
                          aria-label={title}
                          value={String(current)}
                          onChange={(e) => change(e.target.value)}
                        >
                          {o.list.map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <Field
                        key={o.key}
                        label={title}
                        value={Number(current)}
                        min={o.min ?? 0}
                        max={o.max ?? 100}
                        unit={
                          o.pct !== undefined
                            ? "%"
                            : o.deg !== undefined
                              ? "°"
                              : ""
                        }
                        onChange={(v) =>
                          change(o.count !== undefined ? Math.round(v) : v)
                        }
                      />
                    );
                  })}
                </>
              )}
              <details className="fashion-details">
                <summary>Fabric specification</summary>
                {!value.fabric ? (
                  <button
                    onClick={() =>
                      onChange({ ...value, fabric: sampleFabric() })
                    }
                  >
                    Add fabric record
                  </button>
                ) : (
                  <>
                    <label className="fashion-text-field">
                      Fabric name
                      <input
                        aria-label="Fabric name"
                        maxLength={80}
                        value={value.fabric.name}
                        onChange={(e) =>
                          e.target.value &&
                          onChange({
                            ...value,
                            fabric: { ...value.fabric!, name: e.target.value },
                          })
                        }
                      />
                    </label>
                    <label className="fashion-text-field">
                      Structure
                      <select
                        aria-label="Fabric structure"
                        value={value.fabric.structure}
                        onChange={(e) =>
                          onChange({
                            ...value,
                            fabric: {
                              ...value.fabric!,
                              structure: e.target.value as "knit" | "woven",
                            },
                          })
                        }
                      >
                        <option value="knit">Knit</option>
                        <option value="woven">Woven</option>
                      </select>
                    </label>
                    {(
                      [
                        ["stretchWidth", "Width stretch", 200, "%"],
                        ["stretchLength", "Length stretch", 200, "%"],
                        ["recovery", "Recovery", 100, "%"],
                        ["gsm", "Weight", 1500, "GSM"],
                      ] as const
                    ).map(([key, label, max, unit]) => (
                      <Field
                        key={key}
                        label={label}
                        value={value.fabric![key]}
                        min={key === "gsm" ? 10 : 0}
                        max={max}
                        unit={unit}
                        onChange={(v) =>
                          onChange({
                            ...value,
                            fabric: { ...value.fabric!, [key]: v },
                          })
                        }
                      />
                    ))}
                    <label className="fashion-text-field">
                      Fiber composition
                      <input
                        aria-label="Fiber composition"
                        maxLength={150}
                        value={value.fabric.fiber}
                        onChange={(e) =>
                          onChange({
                            ...value,
                            fabric: { ...value.fabric!, fiber: e.target.value },
                          })
                        }
                      />
                    </label>
                    <p className="fashion-caption">
                      Enter measured stretch and recovery. These describe your
                      sample; they are not a cloth simulation.
                    </p>
                  </>
                )}
              </details>
              <h4>Construction</h4>
              <Field
                label="Seam allowance"
                min={0}
                max={25}
                value={value.seamAllowance}
                onChange={(n) => onChange({ ...value, seamAllowance: n })}
              />
              <p className="fashion-caption">
                {design === "teagan"
                  ? `Body and sleeve hem allowances are 3× the seam allowance (${value.seamAllowance * 3} mm). No allowance is added on fold edges.`
                  : "The cut line preserves this design’s hem, fold, and seam rules. Check the design instructions before sewing."}
              </p>
            </>
          ) : (
            <>
              <span className="eyebrow">FULL-SIZE OUTPUT</span>
              <h3>From screen to cutting table.</h3>
              <p className="fashion-caption">
                Vector curves, matching marks, grainlines and seam allowances.
                Export uses the current draft and saved manual pieces.
              </p>
              <label className="fashion-text-field">
                FORMAT
                <select
                  aria-label="Pattern export format"
                  value={exportType}
                  onChange={(e) =>
                    setExportType(e.target.value as "pdf" | "svg")
                  }
                >
                  <option value="pdf">Tiled PDF · home printer</option>
                  <option value="svg">Full-size SVG · millimeters</option>
                </select>
              </label>
              {exportType === "pdf" && (
                <>
                  <label className="fashion-text-field">
                    PAPER
                    <select
                      aria-label="Pattern paper size"
                      value={value.paper}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          paper: e.target.value as "a4" | "letter",
                        })
                      }
                    >
                      <option value="a4">A4 · 210 × 297 mm</option>
                      <option value="letter">US Letter · 8.5 × 11 in</option>
                    </select>
                  </label>
                  <div className="fashion-print-summary">
                    <b>{pages} pages</b>
                    <span>Includes calibration & assembly sheet</span>
                    <span>5 mm overlap · Print at 100%</span>
                  </div>
                </>
              )}
              <button
                className="primary fashion-export-button"
                disabled={!draft}
                onClick={() => void doExport()}
              >
                <ArrowDownToLine size={16} />
                Export {exportType.toUpperCase()}
              </button>
              <div className="fashion-print-note">
                <b>Check scale before cutting</b>
                <p>
                  PDF: the calibration square must measure 100 × 100 mm. SVG: 50
                  × 50 mm. Turn off “fit to page.”
                </p>
              </div>
              <h4>Cut list</h4>
              {draft?.pieces.map((p) => (
                <div className="fashion-cut-row" key={p.id}>
                  <b>{p.name}</b>
                  <span>{p.cut}</span>
                </div>
              ))}
            </>
          )}
          {draft?.warnings.map((w) => (
            <p key={w} className="fashion-warning">
              {w}
            </p>
          ))}
          <div className="fashion-toile">
            <b>First fitting draft</b>
            <p>
              Designed for knit fabric. Sew a toile to check fit, sleeve
              matching and neckband recovery before cutting your final fabric.
            </p>
          </div>
        </fieldset>
      </aside>
    </main>
  );
}
