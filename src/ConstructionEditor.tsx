import { listen } from "@tauri-apps/api/event";
import { native } from "./io";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { X, Maximize, Plus, Minus, Hand, MousePointer2 } from "lucide-react";
import {
  constructPiece,
  moveAnchor,
  removeAnchor,
  segmentPoint,
  segmentStart,
  segmentLength,
  splitSegment,
} from "./pattern-geometry";
import { pathString, type PieceId, type Point2 } from "./fashion-model";
import type { Construction } from "./fashion-construction";
import { pieceMarkup } from "./fashion-export";

type Selection =
  | { kind: "anchor" | "cp1" | "cp2"; index: number }
  | { kind: "dart"; index: number; vertex: number }
  | { kind: "grain"; index: number };
function NumberField({
  label,
  value,
  min = -2500,
  max = 2500,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const skip = useRef(false);
  return (
    <label className="fashion-field">
      <span>{label}</span>
      <div>
        <input
          aria-label={label}
          type="number"
          step=".1"
          min={min}
          max={max}
          value={draft ?? Math.round(value * 100) / 100}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (skip.current) {
              skip.current = false;
              return;
            }
            const n = Number(draft);
            if (draft !== null && draft.trim() && Number.isFinite(n))
              onChange(Math.max(min, Math.min(max, n)));
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              skip.current = true;
              setDraft(null);
              e.currentTarget.blur();
              e.stopPropagation();
            }
          }}
        />
        <small>mm</small>
      </div>
    </label>
  );
}
function selectionPoint(c: Construction, s: Selection): Point2 {
  if (s.kind === "grain") return c.grain[s.index];
  if (s.kind === "dart") return c.darts[s.index][s.vertex];
  const o = c.seam[s.index];
  return o.type === "close"
    ? segmentPoint(c.seam, s.index, 1)
    : s.kind === "anchor"
      ? o.to
      : o.type === "curve"
        ? o[s.kind]
        : o.to;
}
function setPoint(c: Construction, s: Selection, p: Point2): Construction {
  if (s.kind === "anchor") return moveAnchor(c, s.index, p);
  const n = structuredClone(c);
  if (s.kind === "grain") n.grain[s.index] = p;
  else if (s.kind === "dart") n.darts[s.index][s.vertex] = p;
  else {
    const op = n.seam[s.index];
    if (op.type === "curve") op[s.kind] = p;
  }
  return n;
}
export function ConstructionEditor({
  id,
  value,
  change,
  begin,
  commit,
  close,
  undo,
  redo,
  canUndo,
  canRedo,
}: {
  id: PieceId;
  value: Construction;
  change: (v: Construction) => void;
  begin: () => void;
  commit: () => void;
  close: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}) {
  const piece = useMemo(() => constructPiece(id, value), [id, value]);
  const [edge, setEdge] = useState(1),
    [selection, setSelection] = useState<Selection | null>(null),
    [error, setError] = useState(""),
    [pan, setPan] = useState(false);
  const initial = {
    x: piece.origin.x - 35,
    y: piece.origin.y - 35,
    width: piece.width + 70,
    height: piece.height + 70,
  };
  const [view, setView] = useState(initial);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    start: Point2;
    base: Construction;
    selection: Selection | null;
    view: typeof view;
  }>(null);
  const activeEdge = Math.min(edge, value.seam.length - 1),
    op = value.seam[activeEdge];
  const validSelection =
    selection &&
    (selection.kind === "dart"
      ? value.darts[selection.index]
      : selection.kind === "grain"
        ? value.grain[selection.index]
        : value.seam[selection.index])
      ? selection
      : null;
  const point = validSelection ? selectionPoint(value, validSelection) : null;
  const safeChange = (n: Construction) => {
    try {
      constructPiece(id, n);
      change(n);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const local = (e: { clientX: number; clientY: number }) => {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      svg.current!.getScreenCTM()!.inverse(),
    );
    return { x: p.x, y: p.y };
  };
  const down = (e: ReactPointerEvent, s: Selection | null = null) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    if (s && !pan) {
      setSelection(s);
      if (s.kind === "anchor" || s.kind === "cp1" || s.kind === "cp2")
        setEdge(Math.max(1, s.index));
    }
    drag.current = {
      start: local(e),
      base: value,
      selection: pan ? null : s,
      view,
    };
    svg.current!.setPointerCapture(e.pointerId);
    if (s && !pan) begin();
  };
  const finish = () => {
    if (drag.current?.selection) commit();
    drag.current = null;
  };
  const zoom = (f: number) =>
    setView((v) => ({
      ...v,
      x: v.x + (v.width * (1 - f)) / 2,
      y: v.y + (v.height * (1 - f)) / 2,
      width: Math.min(5000, Math.max(50, v.width * f)),
      height: Math.min(5000, Math.max(50, v.height * f)),
    }));
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const modal = document.querySelector<HTMLElement>(
      '[aria-label="Pattern geometry editor"]',
    );
    const nodes = () => [
      ...(modal?.querySelectorAll<HTMLElement>(
        "button:not(:disabled),input:not(:disabled),select:not(:disabled)",
      ) ?? []),
    ];
    nodes()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "z" &&
        !/INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        if (!drag.current) e.shiftKey ? redo() : undo();
      }
      if (e.key === "Tab") {
        const a = nodes(),
          first = a[0],
          last = a.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    let dispose: (() => void) | undefined,
      cancelled = false;
    if (native)
      void listen<"undo" | "redo">("editor-history", ({ payload }) => {
        if (drag.current) return;
        if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName ?? ""))
          document.execCommand(payload);
        else payload === "undo" ? undo() : redo();
      }).then((fn) => {
        if (cancelled) fn();
        else dispose = fn;
      });
    return () => {
      cancelled = true;
      dispose?.();
      window.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [undo, redo]);
  const endPoint = segmentPoint(value.seam, activeEdge, 1),
    startPoint = segmentStart(value.seam, activeEdge);
  const previousDuplicate = value.seam.at(-2)!;
  const isDuplicate =
    previousDuplicate.type !== "close" &&
    value.seam[0].type !== "close" &&
    Math.hypot(
      previousDuplicate.to.x - value.seam[0].to.x,
      previousDuplicate.to.y - value.seam[0].to.y,
    ) < 0.0001;
  return (
    <div className="construction-backdrop">
      <section
        className="construction-editor"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-label="Pattern geometry editor"
      >
        <header>
          <div>
            <span className="eyebrow">MANUAL PATTERN / MILLIMETERS</span>
            <h2>{value.name}</h2>
          </div>
          <button
            aria-label="Close pattern geometry editor"
            onClick={() => {
              finish();
              close();
            }}
          >
            <X size={18} /> Done
          </button>
        </header>
        <div className="construction-body">
          <div className="construction-board">
            <div className="pattern-toolbar">
              <div className="pattern-tools">
                <button
                  aria-label="Undo pattern edit"
                  disabled={!canUndo}
                  onClick={undo}
                >
                  ↶
                </button>
                <button
                  aria-label="Redo pattern edit"
                  disabled={!canRedo}
                  onClick={redo}
                >
                  ↷
                </button>
                <button
                  aria-label="Select pattern points"
                  aria-pressed={!pan}
                  onClick={() => setPan(false)}
                >
                  <MousePointer2 size={16} />
                </button>
                <button
                  aria-label="Pan geometry"
                  aria-pressed={pan}
                  onClick={() => setPan(true)}
                >
                  <Hand size={16} />
                </button>
              </div>
              <div className="pattern-tools">
                <button
                  aria-label="Zoom geometry out"
                  onClick={() => zoom(1.2)}
                >
                  <Minus size={16} />
                </button>
                <button
                  aria-label="Zoom geometry in"
                  onClick={() => zoom(1 / 1.2)}
                >
                  <Plus size={16} />
                </button>
                <button
                  aria-label="Fit pattern geometry"
                  onClick={() => setView(initial)}
                >
                  <Maximize size={16} />
                </button>
              </div>
            </div>
            <svg
              ref={svg}
              aria-label="Editable pattern geometry"
              viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
              onPointerDown={(e) => down(e)}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d) return;
                const p = local(e),
                  dx = p.x - d.start.x,
                  dy = p.y - d.start.y;
                if (!d.selection) {
                  setView((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
                  return;
                }
                const a = selectionPoint(d.base, d.selection);
                safeChange(
                  setPoint(d.base, d.selection, {
                    x: Math.round((a.x + dx) * 10) / 10,
                    y: Math.round((a.y + dy) * 10) / 10,
                  }),
                );
              }}
              onPointerUp={finish}
              onPointerCancel={finish}
              onLostPointerCapture={finish}
              onWheel={(e) => {
                if (!drag.current) zoom(e.deltaY > 0 ? 1.1 : 1 / 1.1);
              }}
            >
              <defs>
                <pattern
                  id="construction-grid"
                  width="10"
                  height="10"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M10 0H0V10"
                    fill="none"
                    stroke="#ddd"
                    strokeWidth=".3"
                  />
                </pattern>
              </defs>
              <rect
                x={-5000}
                y={-5000}
                width={10000}
                height={10000}
                fill="url(#construction-grid)"
              />
              <g
                transform={`translate(${piece.origin.x} ${piece.origin.y})`}
                dangerouslySetInnerHTML={{
                  __html: pieceMarkup(
                    piece,
                    value.allowances.some((v) => v > 0) ? 1 : 0,
                  ),
                }}
              />
              {value.seam.slice(1).map((o, i) => (
                <path
                  key={i}
                  data-edge={i + 1}
                  d={pathString([
                    { type: "move", to: segmentStart(value.seam, i + 1) },
                    o.type === "close"
                      ? { type: "line", to: segmentPoint(value.seam, i + 1, 1) }
                      : o,
                  ])}
                  fill="none"
                  stroke={activeEdge === i + 1 ? "#333" : "transparent"}
                  strokeWidth={activeEdge === i + 1 ? 1 : 8}
                  style={{ cursor: "pointer" }}
                  onPointerDown={(e) => {
                    if (pan) return;
                    e.stopPropagation();
                    setEdge(i + 1);
                    setSelection(null);
                  }}
                />
              ))}
              {op.type === "curve" && (
                <g stroke="#888" fill="white" strokeWidth=".5">
                  <path
                    d={`M${startPoint.x} ${startPoint.y} L${op.cp1.x} ${op.cp1.y} M${endPoint.x} ${endPoint.y} L${op.cp2.x} ${op.cp2.y}`}
                    fill="none"
                  />
                  {(["cp1", "cp2"] as const).map((k) => (
                    <circle
                      key={k}
                      data-control={k}
                      cx={op[k].x}
                      cy={op[k].y}
                      r={5}
                      onPointerDown={(e) =>
                        down(e, { kind: k, index: activeEdge })
                      }
                      style={{ cursor: "move" }}
                    />
                  ))}
                </g>
              )}
              {value.seam.map((o, i) =>
                o.type === "close" ||
                (isDuplicate && i === value.seam.length - 2) ? null : (
                  <rect
                    key={i}
                    data-anchor={i}
                    x={o.to.x - 4}
                    y={o.to.y - 4}
                    width={8}
                    height={8}
                    fill={
                      selection?.kind === "anchor" && selection.index === i
                        ? "#222"
                        : "white"
                    }
                    stroke="#222"
                    strokeWidth=".8"
                    style={{ cursor: "move" }}
                    onPointerDown={(e) => down(e, { kind: "anchor", index: i })}
                  />
                ),
              )}
              {value.darts.map((d, i) =>
                d.map((p, k) => (
                  <circle
                    key={`${i}-${k}`}
                    data-dart={`${i}-${k}`}
                    cx={p.x}
                    cy={p.y}
                    r={2.5}
                    fill="#555"
                    stroke="white"
                    strokeWidth=".5"
                    onPointerDown={(e) =>
                      down(e, { kind: "dart", index: i, vertex: k })
                    }
                  />
                )),
              )}
              {value.grain.map((p, i) => (
                <circle
                  key={i}
                  data-grain={i}
                  cx={p.x}
                  cy={p.y}
                  r={2.5}
                  fill="white"
                  stroke="#555"
                  strokeWidth=".7"
                  onPointerDown={(e) => down(e, { kind: "grain", index: i })}
                />
              ))}
            </svg>
            <div className="pattern-bottom">
              Drag square anchors or round curve handles · Grid 10 mm · Each
              drag is one undo step
            </div>
          </div>
          <aside className="fashion-scroll construction-controls">
            <p className="fashion-caption">
              This piece is independent of the measurement draft. Your changes,
              matching marks and allowances are saved with the project.
            </p>
            <label className="fashion-text-field">
              PIECE NAME
              <input
                aria-label="Manual piece name"
                maxLength={80}
                value={value.name}
                onChange={(e) => {
                  if (e.target.value.trim())
                    safeChange({ ...value, name: e.target.value });
                }}
              />
            </label>
            <label className="fashion-text-field">
              CUT INSTRUCTION
              <input
                aria-label="Piece cut instruction"
                maxLength={100}
                value={value.cut}
                onChange={(e) => {
                  if (e.target.value.trim())
                    safeChange({ ...value, cut: e.target.value });
                }}
              />
            </label>
            <h4>Boundary segment {activeEdge}</h4>
            <label className="fashion-text-field">
              SELECT SEGMENT
              <select
                aria-label="Boundary segment"
                value={activeEdge}
                onChange={(e) => {
                  setEdge(+e.target.value);
                  setSelection(null);
                }}
              >
                {value.seam.slice(1).map((o, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1} · {o.type === "curve" ? "Curve" : "Line"} ·{" "}
                    {segmentLength(value.seam, i + 1).toFixed(1)} mm
                  </option>
                ))}
              </select>
            </label>
            <NumberField
              label="Segment allowance"
              min={0}
              max={75}
              value={value.allowances[activeEdge]}
              onChange={(n) => {
                const allowances = [...value.allowances];
                allowances[activeEdge] = n;
                safeChange({ ...value, allowances });
              }}
            />
            <p className="fashion-caption">
              Use 0 mm for fold edges. Allowances update around the edited
              stitching line.
            </p>
            <div className="construction-actions">
              <button
                disabled={
                  value.seam.length >= 255 ||
                  segmentLength(value.seam, activeEdge) < 0.01
                }
                onClick={() => {
                  safeChange(splitSegment(value, activeEdge));
                  setSelection(null);
                }}
              >
                Insert midpoint
              </button>
              <button
                disabled={
                  value.seam.length >= 255 ||
                  segmentLength(value.seam, activeEdge) < 0.01
                }
                onClick={() => {
                  const n = structuredClone(value);
                  n.seam[activeEdge] =
                    op.type === "curve"
                      ? { type: "line", to: endPoint }
                      : {
                          type: "curve",
                          to: endPoint,
                          cp1: segmentPoint(value.seam, activeEdge, 1 / 3),
                          cp2: segmentPoint(value.seam, activeEdge, 2 / 3),
                        };
                  if (op.type === "close")
                    (n.seam.push({ type: "close" }), n.allowances.push(0));
                  safeChange(n);
                  setSelection(null);
                }}
              >
                {op.type === "curve" ? "Straighten" : "Make curve"}
              </button>
            </div>
            {selection && point && (
              <>
                <h4>
                  {selection.kind === "anchor"
                    ? "Anchor"
                    : selection.kind === "dart"
                      ? "Dart point"
                      : selection.kind === "grain"
                        ? "Grainline"
                        : "Curve control"}
                </h4>
                <NumberField
                  label="Point X"
                  value={point.x}
                  onChange={(x) =>
                    safeChange(setPoint(value, selection, { ...point, x }))
                  }
                />
                <NumberField
                  label="Point Y"
                  value={point.y}
                  onChange={(y) =>
                    safeChange(setPoint(value, selection, { ...point, y }))
                  }
                />
              </>
            )}
            {validSelection?.kind === "anchor" &&
              validSelection.index > 0 &&
              validSelection.index < value.seam.length - 1 &&
              value.seam.length > 4 && (
                <button
                  className="fashion-secondary"
                  onClick={() => {
                    safeChange(removeAnchor(value, validSelection.index));
                    setSelection(null);
                    setEdge(1);
                  }}
                >
                  Remove selected anchor
                </button>
              )}
            <h4>Matching marks</h4>
            <div className="construction-actions">
              <button
                disabled={value.notches.length >= 64}
                onClick={() =>
                  safeChange({
                    ...value,
                    notches: [
                      ...value.notches,
                      { edge: activeEdge, t: 0.5, double: false },
                    ],
                  })
                }
              >
                Add notch
              </button>
              <button
                disabled={value.notches.length >= 64}
                onClick={() =>
                  safeChange({
                    ...value,
                    notches: [
                      ...value.notches,
                      { edge: activeEdge, t: 0.5, double: true },
                    ],
                  })
                }
              >
                Double notch
              </button>
            </div>
            {value.notches.map((n, i) =>
              n.edge === activeEdge ? (
                <div className="construction-mark" key={i}>
                  <label>
                    {n.double ? "Double" : "Single"} · {Math.round(n.t * 100)}%
                    <input
                      aria-label={`Notch ${i + 1} position`}
                      type="range"
                      min={0}
                      max={100}
                      value={n.t * 100}
                      onPointerDown={begin}
                      onPointerUp={commit}
                      onKeyDown={begin}
                      onKeyUp={commit}
                      onBlur={commit}
                      onChange={(e) => {
                        const notches = [...value.notches];
                        notches[i] = { ...n, t: +e.target.value / 100 };
                        safeChange({ ...value, notches });
                      }}
                    />
                  </label>
                  <button
                    aria-label={`Delete notch ${i + 1}`}
                    onClick={() =>
                      safeChange({
                        ...value,
                        notches: value.notches.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : null,
            )}
            <h4>Dart markings</h4>
            <button
              className="fashion-secondary"
              disabled={value.darts.length >= 16}
              onClick={() => {
                const x = piece.origin.x + piece.width * 0.5,
                  y = piece.origin.y + piece.height * 0.45;
                safeChange({
                  ...value,
                  darts: [
                    ...value.darts,
                    [
                      { x: x - 10, y: y + 60 },
                      { x, y },
                      { x: x + 10, y: y + 60 },
                    ],
                  ],
                });
              }}
            >
              Add dart marking
            </button>
            <p className="fashion-caption">
              Drag the apex and legs to mark intake. These are construction
              guides; adjoining seams are not automatically rebalanced.
            </p>
            {value.darts.map((_, i) => (
              <button
                className="fashion-secondary"
                key={i}
                onClick={() => {
                  safeChange({
                    ...value,
                    darts: value.darts.filter((_, j) => j !== i),
                  });
                  setSelection(null);
                }}
              >
                Remove dart {i + 1}
              </button>
            ))}
            {error && (
              <p className="fashion-warning" role="alert">
                {error} The last valid shape is preserved.
              </p>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
