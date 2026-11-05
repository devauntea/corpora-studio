import { GarmentAssetLibrary } from "./GarmentAssetLibrary";
import { placeGarment } from "./garment-library";
import {
  useEffect,
  useRef,
  useState,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowLeft,
  Download,
  Layers,
  PenTool,
  Plus,
  Copy,
  Trash2,
  Undo2,
  Redo2,
} from "lucide-react";
import type { Fashion } from "./fashion-model";
import {
  VectorPackSchema,
  allContours,
  setContour,
  insertVectorAnchor,
  mapLayer,
  layerBounds,
  vectorPath,
  resizeSizes,
  convertPackUnits,
  parseVectorPack,
  type VectorPack,
  type VectorLayer,
  type VectorNode,
  type VectorView,
} from "./vector-pack";
import {
  flatTemplates,
  templatePack,
  templateLayers,
  vectorComponent,
  componentNames,
  vectorLayer,
  type FlatTemplate,
} from "./vector-templates";
import { vectorArchive, vectorPdf, vectorSvg } from "./vector-export";
import { saveVectorPack } from "./io";
import "./vector-pack.css";
function Num({
  label,
  value,
  onChange,
  min = -1000,
  max = 2000,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [raw, setRaw] = useState(String(value));
  useEffect(() => setRaw(String(Math.round(value * 100) / 100)), [value]);
  const commit = () => {
    const n = Number(raw);
    if (raw.trim() && Number.isFinite(n)) {
      const v = Math.min(max, Math.max(min, n));
      setRaw(String(v));
      if (v !== value) onChange(v);
    } else setRaw(String(value));
  };
  return (
    <label>
      {label}
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setRaw(String(value));
        }}
      />
    </label>
  );
}
type Props = {
  openLibrary: boolean;
  onLibraryChange: (open: boolean) => void;
  value: Fashion;
  onChange: (f: Fashion) => void;
  begin: () => void;
  commit: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  busy: boolean;
  setBusy: (b: boolean) => void;
  notify: (s: string, error?: boolean) => void;
  exporter: RefObject<(() => Promise<void>) | null>;
  close: () => void;
};
export function VectorPackStudio({
  openLibrary,
  onLibraryChange,
  value,
  onChange,
  begin,
  commit,
  undo,
  redo,
  canUndo,
  canRedo,
  busy,
  setBusy,
  notify,
  exporter,
  close,
}: Props) {
  const fallback = useRef(templatePack("T-shirt"));
  const pack = value.vectorPack ?? fallback.current;
  const [contour, setContourIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null),
    [node, setNode] = useState<number | null>(null),
    [view, setView] = useState<VectorView>("front");
  const [tab, setTab] = useState<
      "drawing" | "assets" | "specs" | "materials" | "notes"
    >("drawing"),
    [tool, setTool] = useState<"select" | "nodes" | "pen" | "callout">(
      "select",
    );
  useEffect(() => {
    setTab((t) => (openLibrary ? "assets" : t === "assets" ? "drawing" : t));
  }, [openLibrary]);
  const [template, setTemplate] = useState<FlatTemplate>("T-shirt"),
    [component, setComponent] =
      useState<(typeof componentNames)[number]>("Patch pocket");
  const [pen, setPen] = useState<VectorNode[]>([]),
    [penClosed, setPenClosed] = useState(true),
    [format, setFormat] = useState<"zip" | "pdf" | "svg" | "json">("zip");
  const [sizes, setSizes] = useState(pack.sizes.join(", ")),
    [zoom, setZoom] = useState(1),
    [callout, setCallout] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null),
    file = useRef<HTMLInputElement>(null);
  const drag = useRef<{
    start: { x: number; y: number };
    pack: VectorPack;
    layer?: string;
    node?: number;
    contour?: number;
    handle?: "in" | "out";
    callout?: string;
    label?: boolean;
  } | null>(null);
  useEffect(() => {
    if (!value.vectorPack) onChange({ ...value, vectorPack: fallback.current });
  }, []);
  useEffect(() => setSizes(pack.sizes.join(", ")), [pack.sizes.join("|")]);
  const change = (p: VectorPack) => {
    const checked = VectorPackSchema.safeParse(p);
    if (!checked.success) {
      notify(checked.error.issues[0]?.message ?? "Invalid vector pack", true);
      return;
    }
    onChange({ ...value, vectorPack: checked.data });
  };
  useEffect(() => {
    setContourIndex(0);
    setNode(null);
  }, [selected]);
  const layer = pack.layers.find((l) => l.id === selected),
    activeNodes = layer ? (allContours(layer)[contour] ?? layer.nodes) : [],
    currentNode = node === null ? undefined : activeNodes[node],
    call = pack.callouts.find((c) => c.id === callout);
  const updateLayer = (patch: Partial<VectorLayer>) => {
    if (layer)
      change({
        ...pack,
        layers: pack.layers.map((l) =>
          l.id === layer.id ? { ...l, ...patch } : l,
        ),
      });
  };
  const updateNode = (n: VectorNode) => {
    if (layer && node !== null)
      updateLayer(
        setContour(
          layer,
          contour,
          activeNodes.map((p, i) => (i === node ? n : p)),
        ),
      );
  };
  const addLayer = (l: VectorLayer) => {
    change({ ...pack, layers: [...pack.layers, l] });
    setSelected(l.id);
    setView(l.view);
    setNode(null);
    setTool("select");
  };
  const exportPack = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const bytes =
        format === "zip"
          ? vectorArchive(pack)
          : format === "pdf"
            ? vectorPdf(pack)
            : new TextEncoder().encode(
                format === "svg"
                  ? vectorSvg(pack)
                  : JSON.stringify(pack, null, 2),
              );
      if (await saveVectorPack(bytes, pack.style || pack.name, format))
        notify(`Vector pack exported as ${format.toUpperCase()}.`);
    } catch (e) {
      notify(`Export failed: ${String(e)}`, true);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    exporter.current = exportPack;
    return () => {
      exporter.current = null;
    };
  });
  const local = (
    e: { clientX: number; clientY: number },
    v: VectorView = view,
  ) => {
    const m = svg.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return {
      x: Math.max(5, Math.min(475, p.x - (v === "back" ? 480 : 0))),
      y: Math.max(35, Math.min(610, p.y)),
    };
  };
  const start = (
    e: ReactPointerEvent,
    v: VectorView,
    id?: string,
    ni?: number,
    handle?: "in" | "out",
    ci?: string,
    label?: boolean,
  ) => {
    if (busy || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (tool === "pen" && pen.length && v !== view) {
      notify(
        "Finish or cancel the current path before drawing in the other view.",
      );
      return;
    }
    setView(v);
    if (tool === "pen") {
      setPen([...pen, local(e, v)]);
      return;
    }
    if (tool === "callout") {
      const anchor = local(e, v),
        id = crypto.randomUUID();
      change({
        ...pack,
        callouts: [
          ...pack.callouts,
          {
            id,
            view: v,
            anchor,
            label: {
              x: Math.min(455, anchor.x + 55),
              y: Math.max(45, anchor.y - 35),
            },
            text: "Describe construction or finishing",
          },
        ],
      });
      setCallout(id);
      setSelected(null);
      setTool("select");
      return;
    }
    if (!id && !ci) {
      setSelected(null);
      setNode(null);
      setCallout(null);
      return;
    }
    if (id) {
      setSelected(id);
      setNode(ni ?? null);
      setCallout(null);
      if (pack.layers.find((l) => l.id === id)?.locked) return;
    }
    if (ci) {
      setCallout(ci);
      setSelected(null);
    }
    begin();
    drag.current = {
      start: local(e, v),
      pack,
      layer: id,
      node: ni,
      contour,
      handle,
      callout: ci,
      label,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent) => {
    const g = drag.current;
    if (!g) return;
    const p = local(e),
      dx = p.x - g.start.x,
      dy = p.y - g.start.y;
    const shift = (p: { x: number; y: number }) => ({
      x: Math.max(-500, Math.min(1500, p.x + dx)),
      y: Math.max(-500, Math.min(1500, p.y + dy)),
    });
    if (g.callout)
      change({
        ...g.pack,
        callouts: g.pack.callouts.map((c) =>
          c.id === g.callout
            ? {
                ...c,
                [g.label ? "label" : "anchor"]: shift(
                  g.label ? c.label : c.anchor,
                ),
              }
            : c,
        ),
      });
    else
      change({
        ...g.pack,
        layers: g.pack.layers.map((l) => {
          if (l.id !== g.layer) return l;
          if (g.node === undefined) return mapLayer(l, shift);
          return setContour(
            l,
            g.contour ?? 0,
            (allContours(l)[g.contour ?? 0] ?? l.nodes).map((n, i) =>
              i !== g.node
                ? n
                : g.handle
                  ? { ...n, [g.handle]: shift(n[g.handle] ?? n) }
                  : {
                      ...shift(n),
                      ...(n.in ? { in: shift(n.in) } : {}),
                      ...(n.out ? { out: shift(n.out) } : {}),
                    },
            ),
          );
        }),
      });
  };
  const finish = () => {
    if (drag.current) {
      drag.current = null;
      commit();
    }
  };
  const finishPen = () => {
    if (pen.length >= 2)
      addLayer({
        ...vectorLayer(
          "Custom path",
          view,
          pen.map((p) => [p.x, p.y]),
          penClosed,
          penClosed ? "#f0eee9" : "none",
        ),
      });
    setPen([]);
    setTool("select");
  };
  const transform = (
    fn: (p: { x: number; y: number }) => { x: number; y: number },
  ) => {
    if (layer && !layer.locked) updateLayer(mapLayer(layer, fn));
  };
  const bounds = layer ? layerBounds(layer) : null;
  const remove = () => {
    if (layer && !layer.locked) {
      change({ ...pack, layers: pack.layers.filter((l) => l.id !== layer.id) });
      setSelected(null);
    } else if (call) {
      change({
        ...pack,
        callouts: pack.callouts.filter((c) => c.id !== call.id),
      });
      setCallout(null);
    }
  };
  return (
    <main
      className={`vector-studio ${tab === "assets" ? "assets-open" : ""}`}
      aria-label="Vector pack studio"
    >
      <header className="vector-top">
        <button onClick={close}>
          <ArrowLeft size={15} /> Pattern studio
        </button>
        <div>
          <span className="eyebrow">FASHION / VECTOR PACKS</span>
          <h2>{pack.name || "Untitled garment"}</h2>
        </div>
        <div className="vector-history">
          <button
            title="Undo vector edit"
            aria-label="Undo vector edit"
            disabled={!canUndo || busy}
            onClick={undo}
          >
            <Undo2 size={16} />
          </button>
          <button
            title="Redo vector edit"
            aria-label="Redo vector edit"
            disabled={!canRedo || busy}
            onClick={redo}
          >
            <Redo2 size={16} />
          </button>
        </div>
        <select
          aria-label="Vector export format"
          value={format}
          onChange={(e) => setFormat(e.target.value as typeof format)}
        >
          <option value="zip">Manufacturer pack · ZIP</option>
          <option value="pdf">Tech pack · PDF</option>
          <option value="svg">Editable flats · SVG</option>
          <option value="json">Editable project · JSON</option>
        </select>
        <button className="primary" disabled={busy} onClick={exportPack}>
          <Download size={15} /> Export vector pack
        </button>
      </header>
      <nav className="vector-tabs" aria-label="Vector pack pages">
        {(["drawing", "specs", "materials", "notes"] as const).map((t) => (
          <button
            key={t}
            aria-pressed={tab === t}
            className={tab === t ? "active" : ""}
            onClick={() => {
              setTab(t);
              onLibraryChange(false);
            }}
          >
            {
              {
                drawing: "Technical flats",
                assets: "Asset library",
                specs: "Size specification",
                materials: "Materials & trims",
                notes: "Style & instructions",
              }[t]
            }
          </button>
        ))}
        <span>
          STYLE {pack.style} / REV {pack.revision}
        </span>
      </nav>
      {tab === "assets" ? (
        <GarmentAssetLibrary
          busy={busy}
          notify={notify}
          onPlace={(layers, replace, name) => {
            const next = placeGarment(pack, layers, replace);
            if (
              (replace || !pack.layers.length) &&
              (flatTemplates.includes(pack.name as FlatTemplate) ||
                pack.name === "Untitled garment")
            )
              next.name = name;
            change(next);
            setTab("drawing");
            onLibraryChange(false);
            setSelected(layers[0]?.id ?? null);
            setView(layers[0]?.view ?? "front");
            setCallout(null);
            setPen([]);
            setTool("select");
            notify(
              "Garment paths added. Select a layer to recolor or reshape it.",
            );
          }}
        />
      ) : tab === "drawing" ? (
        <div className="vector-drawing">
          <aside className="vector-sidebar">
            <button
              className="asset-library-entry"
              onClick={() => {
                setTab("assets");
                onLibraryChange(true);
              }}
            >
              <Layers size={18} />
              <span>
                <strong>Browse garment assets</strong>
                <small>112 imported designs →</small>
              </span>
            </button>
            <span className="eyebrow">STARTER FLATS</span>
            <label>
              Garment template
              <select
                aria-label="Garment flat template"
                value={template}
                onChange={(e) => setTemplate(e.target.value as FlatTemplate)}
              >
                {flatTemplates.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <button
              disabled={busy || pack.layers.length > 160}
              onClick={() => {
                change({
                  ...pack,
                  layers: [...pack.layers, ...templateLayers(template)],
                });
                setSelected(null);
              }}
            >
              <Plus size={14} /> Add front & back
            </button>
            <div className="vector-pair">
              <button
                disabled={busy}
                onClick={() => {
                  change({
                    ...pack,
                    layers: templateLayers(template),
                    callouts: [],
                  });
                  setSelected(null);
                  setCallout(null);
                  setPen([]);
                }}
              >
                Replace flats
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  change({ ...pack, layers: [], callouts: [] });
                  setSelected(null);
                  setCallout(null);
                  setPen([]);
                }}
              >
                Blank canvas
              </button>
            </div>
            <p className="vector-hint">
              Editable design drawings. Export cutting patterns from the pattern
              studio.
            </p>
            <label>
              Add details to
              <select
                aria-label="Active garment view"
                value={view}
                onChange={(e) => {
                  setView(e.target.value as VectorView);
                  setPen([]);
                }}
              >
                <option value="front">Front</option>
                <option value="back">Back</option>
              </select>
            </label>
            <label>
              Detail
              <select
                aria-label="Garment detail"
                value={component}
                onChange={(e) =>
                  setComponent(e.target.value as typeof component)
                }
              >
                {componentNames.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <button
              disabled={busy || pack.layers.length >= 200}
              onClick={() => addLayer(vectorComponent(component, view))}
            >
              <Plus size={14} /> Add detail
            </button>
            <div className="vector-layer-title">
              <Layers size={15} />
              <strong>Layers</strong>
              <small>{pack.layers.filter((l) => l.view === view).length}</small>
            </div>
            <div className="vector-layer-list">
              {pack.layers
                .filter((l) => l.view === view)
                .slice()
                .reverse()
                .map((l) => (
                  <div
                    key={l.id}
                    className={selected === l.id ? "selected" : ""}
                  >
                    <button
                      onClick={() => {
                        setSelected(l.id);
                        setNode(null);
                        setCallout(null);
                      }}
                    >
                      {l.name || "Unnamed path"}
                      {l.locked ? " 🔒" : ""}
                    </button>
                    <input
                      type="checkbox"
                      aria-label={`Show ${l.name} ${l.id}`}
                      checked={l.visible}
                      onChange={(e) =>
                        change({
                          ...pack,
                          layers: pack.layers.map((a) =>
                            a.id === l.id
                              ? { ...a, visible: e.target.checked }
                              : a,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
            </div>
            <button
              className="vector-import"
              onClick={() => file.current?.click()}
            >
              Import vector pack JSON
            </button>
            <input
              ref={file}
              hidden
              type="file"
              accept=".json"
              aria-label="Import vector pack file"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  if (f.size > 15000000) throw new Error("Maximum 15 MB");
                  const imported = parseVectorPack(await f.text());
                  change(imported);
                  setSelected(null);
                  setCallout(null);
                  setPen([]);
                  notify(
                    "Vector pack imported. Undo restores the previous pack.",
                  );
                } catch (err) {
                  notify(`Import failed: ${String(err)}`, true);
                }
              }}
            />
          </aside>
          <section className="vector-canvas-area">
            <div className="vector-toolbar">
              {(["select", "nodes", "pen", "callout"] as const).map((t) => (
                <button
                  key={t}
                  aria-pressed={tool === t}
                  className={tool === t ? "active" : ""}
                  onClick={() => {
                    setTool(t);
                    setPen([]);
                    if (t !== "nodes") setNode(null);
                  }}
                >
                  {t === "pen" ? <PenTool size={14} /> : null}
                  {
                    {
                      select: "Select / move",
                      nodes: "Edit points",
                      pen: "Draw path",
                      callout: "Add callout",
                    }[t]
                  }
                </button>
              ))}
              <label className="vector-zoom">
                Zoom
                <select
                  aria-label="Flat canvas zoom"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                >
                  <option value={1}>Fit</option>
                  <option value={1.5}>150%</option>
                  <option value={2}>200%</option>
                </select>
              </label>
            </div>
            {tool === "pen" && (
              <div className="vector-penbar">
                <span>Click to add points in the {view} view.</span>
                <label>
                  <input
                    type="checkbox"
                    checked={penClosed}
                    onChange={(e) => setPenClosed(e.target.checked)}
                  />{" "}
                  Closed shape
                </label>
                <button disabled={pen.length < 2} onClick={finishPen}>
                  Finish path
                </button>
                <button
                  onClick={() => {
                    setPen([]);
                    setTool("select");
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
            <div className="vector-canvas-scroll">
              <svg
                ref={svg}
                className={`vector-canvas tool-${tool}`}
                style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
                viewBox="0 0 960 640"
                aria-label="Front and back garment flats"
                role="group"
                onPointerMove={move}
                onPointerUp={finish}
                onPointerCancel={finish}
                onLostPointerCapture={finish}
              >
                <defs>
                  <clipPath id="vector-artboard">
                    <rect width="480" height="640" />
                  </clipPath>
                </defs>
                {(["front", "back"] as const).map((v) => (
                  <g
                    key={v}
                    transform={`translate(${v === "back" ? 480 : 0} 0)`}
                    clipPath="url(#vector-artboard)"
                  >
                    <rect
                      x="6"
                      y="6"
                      width="468"
                      height="628"
                      rx="4"
                      fill="white"
                      stroke={view === v ? "#9b9b9b" : "#dadada"}
                      onPointerDown={(e) => start(e, v)}
                    />
                    <text
                      x="220"
                      y="30"
                      textAnchor="middle"
                      fontSize="10"
                      fill="#777"
                      letterSpacing="2"
                    >
                      {v.toUpperCase()}
                    </text>
                    <path
                      d="M220 48V604"
                      stroke="#e4e4e4"
                      strokeDasharray="3 7"
                      pointerEvents="none"
                    />
                    {pack.layers
                      .filter((l) => l.view === v && l.visible)
                      .map((l) => (
                        <g key={l.id} data-vector-layer={l.id}>
                          <path
                            d={vectorPath(l)}
                            fill={l.fill}
                            fillRule={l.contours ? "evenodd" : "nonzero"}
                            stroke={l.stroke}
                            strokeWidth={l.strokeWidth}
                            strokeDasharray={l.dashed ? "5 4" : undefined}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            onPointerDown={(e) => start(e, v, l.id)}
                            tabIndex={0}
                            role="button"
                            aria-label={`Select ${v} ${l.name}`}
                            onFocus={() => {
                              setSelected(l.id);
                              setView(v);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                setSelected(l.id);
                                setView(v);
                              }
                              if (
                                !l.locked &&
                                [
                                  "ArrowUp",
                                  "ArrowDown",
                                  "ArrowLeft",
                                  "ArrowRight",
                                ].includes(e.key)
                              ) {
                                e.preventDefault();
                                const d = e.shiftKey ? 10 : 1;
                                updateLayer(
                                  mapLayer(l, (p) => ({
                                    x:
                                      p.x +
                                      (e.key === "ArrowLeft"
                                        ? -d
                                        : e.key === "ArrowRight"
                                          ? d
                                          : 0),
                                    y:
                                      p.y +
                                      (e.key === "ArrowUp"
                                        ? -d
                                        : e.key === "ArrowDown"
                                          ? d
                                          : 0),
                                  })),
                                );
                              }
                            }}
                          />
                          {l.id === selected && (
                            <path
                              d={vectorPath(l)}
                              fill="none"
                              stroke="#28759b"
                              strokeWidth="1"
                              strokeDasharray="3 4"
                              pointerEvents="none"
                            />
                          )}
                          {l.id === selected &&
                            tool === "nodes" &&
                            !l.locked &&
                            activeNodes.map((n, i) => (
                              <g key={i}>
                                {i === node &&
                                  (["in", "out"] as const).map(
                                    (h) =>
                                      n[h] && (
                                        <g key={h}>
                                          <line
                                            x1={n.x}
                                            y1={n.y}
                                            x2={n[h]!.x}
                                            y2={n[h]!.y}
                                            stroke="#28759b"
                                          />
                                          <circle
                                            cx={n[h]!.x}
                                            cy={n[h]!.y}
                                            r="3"
                                            fill="white"
                                            stroke="#28759b"
                                            onPointerDown={(e) =>
                                              start(e, v, l.id, i, h)
                                            }
                                          />
                                        </g>
                                      ),
                                  )}
                                <circle
                                  cx={n.x}
                                  cy={n.y}
                                  r={i === node ? 4 : 3}
                                  fill={i === node ? "#28759b" : "white"}
                                  stroke="#28759b"
                                  data-vector-node={i}
                                  onPointerDown={(e) => start(e, v, l.id, i)}
                                />
                              </g>
                            ))}
                        </g>
                      ))}
                    {pack.callouts
                      .filter((c) => c.view === v)
                      .map((c) => (
                        <g key={c.id}>
                          <line
                            x1={c.anchor.x}
                            y1={c.anchor.y}
                            x2={c.label.x}
                            y2={c.label.y}
                            stroke="#555"
                          />
                          <circle
                            cx={c.anchor.x}
                            cy={c.anchor.y}
                            r="3"
                            fill="#555"
                            onPointerDown={(e) =>
                              start(
                                e,
                                v,
                                undefined,
                                undefined,
                                undefined,
                                c.id,
                                false,
                              )
                            }
                          />
                          <g
                            onPointerDown={(e) =>
                              start(
                                e,
                                v,
                                undefined,
                                undefined,
                                undefined,
                                c.id,
                                true,
                              )
                            }
                          >
                            <circle
                              cx={c.label.x}
                              cy={c.label.y}
                              r="10"
                              fill={callout === c.id ? "#e1f0f7" : "white"}
                              stroke="#555"
                            />
                            <text
                              x={c.label.x}
                              y={c.label.y + 3}
                              textAnchor="middle"
                              fontSize="10"
                            >
                              {pack.callouts.indexOf(c) + 1}
                            </text>
                          </g>
                        </g>
                      ))}
                    {pen.length > 0 && view === v && (
                      <>
                        <path
                          d={
                            pen.length > 1
                              ? vectorPath({ nodes: pen, closed: false })
                              : ""
                          }
                          fill="none"
                          stroke="#28759b"
                          strokeWidth="1.5"
                          pointerEvents="none"
                        />
                        {pen.map((p, i) => (
                          <circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r="3"
                            fill="#28759b"
                            pointerEvents="none"
                          />
                        ))}
                      </>
                    )}
                  </g>
                ))}
              </svg>
            </div>
            <footer className="vector-canvas-status">
              {tool === "nodes"
                ? "Select an anchor; drag it or its curve handles."
                : "Select a path to move, recolor or reshape it."}
              <span>
                {pack.layers.length} paths / {pack.callouts.length} callouts
              </span>
            </footer>
          </section>
          <aside className="vector-inspector">
            <span className="eyebrow">
              {call ? "CONSTRUCTION CALLOUT" : "PATH PROPERTIES"}
            </span>
            {layer && bounds ? (
              <>
                <label>
                  Layer name
                  <input
                    aria-label="Vector layer name"
                    maxLength={80}
                    value={layer.name}
                    onChange={(e) => updateLayer({ name: e.target.value })}
                  />
                </label>
                <label className="vector-inline">
                  <input
                    type="checkbox"
                    checked={layer.locked}
                    onChange={(e) => updateLayer({ locked: e.target.checked })}
                  />{" "}
                  Lock path
                </label>
                <fieldset disabled={layer.locked || busy}>
                  <div className="vector-pair">
                    <label>
                      Fill
                      <input
                        aria-label="Path fill"
                        type="color"
                        value={layer.fill === "none" ? "#ffffff" : layer.fill}
                        onChange={(e) => updateLayer({ fill: e.target.value })}
                      />
                    </label>
                    <label>
                      Stroke
                      <input
                        aria-label="Path stroke"
                        type="color"
                        value={layer.stroke}
                        onChange={(e) =>
                          updateLayer({ stroke: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <label className="vector-inline">
                    <input
                      type="checkbox"
                      checked={layer.fill === "none"}
                      onChange={(e) =>
                        updateLayer({
                          fill: e.target.checked ? "none" : "#f0eee9",
                        })
                      }
                    />{" "}
                    No fill
                  </label>
                  <label className="vector-inline">
                    <input
                      type="checkbox"
                      checked={layer.dashed}
                      onChange={(e) =>
                        updateLayer({ dashed: e.target.checked })
                      }
                    />{" "}
                    Stitch / dashed line
                  </label>
                  <Num
                    label="Stroke width"
                    value={layer.strokeWidth}
                    min={0}
                    max={12}
                    step={0.2}
                    onChange={(n) => updateLayer({ strokeWidth: n })}
                  />
                  <label>
                    Material code
                    <input
                      aria-label="Path material code"
                      maxLength={80}
                      placeholder="FAB-01"
                      value={layer.material}
                      onChange={(e) =>
                        updateLayer({ material: e.target.value })
                      }
                    />
                  </label>
                  <div className="vector-pair">
                    <Num
                      label="Path X"
                      value={bounds.x}
                      onChange={(n) =>
                        transform((p) => ({ ...p, x: p.x + n - bounds.x }))
                      }
                    />
                    <Num
                      label="Path Y"
                      value={bounds.y}
                      onChange={(n) =>
                        transform((p) => ({ ...p, y: p.y + n - bounds.y }))
                      }
                    />
                    <Num
                      label="Path width"
                      value={bounds.width}
                      min={1}
                      max={800}
                      onChange={(n) =>
                        transform((p) => ({
                          ...p,
                          x:
                            bounds.x +
                            ((p.x - bounds.x) * n) / Math.max(1, bounds.width),
                        }))
                      }
                    />
                    <Num
                      label="Path height"
                      value={bounds.height}
                      min={1}
                      max={800}
                      onChange={(n) =>
                        transform((p) => ({
                          ...p,
                          y:
                            bounds.y +
                            ((p.y - bounds.y) * n) / Math.max(1, bounds.height),
                        }))
                      }
                    />
                  </div>
                  <button
                    onClick={() =>
                      transform((p) => ({
                        ...p,
                        x: 2 * bounds.x + bounds.width - p.x,
                      }))
                    }
                  >
                    Mirror horizontally
                  </button>
                  <div className="vector-pair">
                    <button
                      onClick={() =>
                        addLayer({
                          ...mapLayer(layer, (p) => ({
                            x: p.x + 12,
                            y: p.y + 12,
                          })),
                          id: crypto.randomUUID(),
                          name: layer.name + " copy",
                        })
                      }
                    >
                      <Copy size={13} /> Duplicate
                    </button>
                    <button
                      onClick={() =>
                        addLayer({
                          ...layer,
                          id: crypto.randomUUID(),
                          view: layer.view === "front" ? "back" : "front",
                        })
                      }
                    >
                      Copy to {layer.view === "front" ? "back" : "front"}
                    </button>
                  </div>
                  <div className="vector-pair">
                    <button
                      onClick={() =>
                        change({
                          ...pack,
                          layers: [
                            ...pack.layers.filter((l) => l.id !== layer.id),
                            layer,
                          ],
                        })
                      }
                    >
                      Bring forward
                    </button>
                    <button
                      onClick={() =>
                        change({
                          ...pack,
                          layers: [
                            layer,
                            ...pack.layers.filter((l) => l.id !== layer.id),
                          ],
                        })
                      }
                    >
                      Send behind
                    </button>
                  </div>
                  {tool === "nodes" && layer.contours?.length ? (
                    <label>
                      Contour
                      <select
                        aria-label="Selected contour"
                        value={contour}
                        onChange={(e) => {
                          setContourIndex(Number(e.target.value));
                          setNode(null);
                        }}
                      >
                        {allContours(layer).map((_, i) => (
                          <option key={i} value={i}>
                            Contour {i + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {tool === "nodes" && (
                    <label>
                      Anchor
                      <select
                        aria-label="Selected anchor"
                        value={node ?? ""}
                        onChange={(e) =>
                          setNode(
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                          )
                        }
                      >
                        <option value="">Choose anchor</option>
                        {activeNodes.map((_, i) => (
                          <option key={i} value={i}>
                            Anchor {i + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {tool === "nodes" && currentNode && node !== null && (
                    <div className="vector-node-editor">
                      <strong>Anchor {node + 1}</strong>
                      <button
                        disabled={
                          activeNodes.length >= 2000 ||
                          (!layer.closed && node === activeNodes.length - 1)
                        }
                        onClick={() => {
                          updateLayer(
                            setContour(
                              layer,
                              contour,
                              insertVectorAnchor(
                                { ...layer, nodes: activeNodes },
                                node,
                              ).nodes,
                            ),
                          );
                          setNode(node + 1);
                        }}
                      >
                        Insert anchor after
                      </button>
                      <div className="vector-pair">
                        <Num
                          label="Anchor X"
                          value={currentNode.x}
                          onChange={(x) =>
                            updateNode({
                              ...currentNode,
                              x,
                              in: currentNode.in
                                ? {
                                    ...currentNode.in,
                                    x: currentNode.in.x + x - currentNode.x,
                                  }
                                : undefined,
                              out: currentNode.out
                                ? {
                                    ...currentNode.out,
                                    x: currentNode.out.x + x - currentNode.x,
                                  }
                                : undefined,
                            })
                          }
                        />
                        <Num
                          label="Anchor Y"
                          value={currentNode.y}
                          onChange={(y) =>
                            updateNode({
                              ...currentNode,
                              y,
                              in: currentNode.in
                                ? {
                                    ...currentNode.in,
                                    y: currentNode.in.y + y - currentNode.y,
                                  }
                                : undefined,
                              out: currentNode.out
                                ? {
                                    ...currentNode.out,
                                    y: currentNode.out.y + y - currentNode.y,
                                  }
                                : undefined,
                            })
                          }
                        />
                      </div>
                      {(["in", "out"] as const).map(
                        (handle) =>
                          currentNode[handle] && (
                            <details key={handle}>
                              <summary>
                                {handle === "in" ? "Incoming" : "Outgoing"}{" "}
                                curve handle
                              </summary>
                              <div className="vector-pair">
                                <Num
                                  label={`${handle} handle X`}
                                  value={currentNode[handle]!.x}
                                  onChange={(x) =>
                                    updateNode({
                                      ...currentNode,
                                      [handle]: { ...currentNode[handle]!, x },
                                    })
                                  }
                                />
                                <Num
                                  label={`${handle} handle Y`}
                                  value={currentNode[handle]!.y}
                                  onChange={(y) =>
                                    updateNode({
                                      ...currentNode,
                                      [handle]: { ...currentNode[handle]!, y },
                                    })
                                  }
                                />
                              </div>
                            </details>
                          ),
                      )}
                      <button
                        onClick={() =>
                          updateNode({
                            ...currentNode,
                            in: { x: currentNode.x - 20, y: currentNode.y },
                            out: { x: currentNode.x + 20, y: currentNode.y },
                          })
                        }
                      >
                        Curve anchor
                      </button>
                      <button
                        onClick={() =>
                          updateNode({ x: currentNode.x, y: currentNode.y })
                        }
                      >
                        Corner anchor
                      </button>
                      <button
                        disabled={activeNodes.length <= 2}
                        onClick={() => {
                          updateLayer(
                            setContour(
                              layer,
                              contour,
                              activeNodes.filter((_, i) => i !== node),
                            ),
                          );
                          setNode(null);
                        }}
                      >
                        Remove anchor
                      </button>
                    </div>
                  )}
                  <button className="vector-delete" onClick={remove}>
                    <Trash2 size={14} /> Delete path
                  </button>
                </fieldset>
              </>
            ) : call ? (
              <>
                <label>
                  Instruction
                  <textarea
                    aria-label="Callout instruction"
                    maxLength={240}
                    value={call.text}
                    onChange={(e) =>
                      change({
                        ...pack,
                        callouts: pack.callouts.map((c) =>
                          c.id === call.id ? { ...c, text: e.target.value } : c,
                        ),
                      })
                    }
                  />
                </label>
                <div className="vector-pair">
                  {(["anchor", "label"] as const).flatMap((part) =>
                    (["x", "y"] as const).map((axis) => (
                      <Num
                        key={`${part}-${axis}`}
                        label={`Callout ${part} ${axis.toUpperCase()}`}
                        value={call[part][axis]}
                        onChange={(n) =>
                          change({
                            ...pack,
                            callouts: pack.callouts.map((c) =>
                              c.id === call.id
                                ? { ...c, [part]: { ...c[part], [axis]: n } }
                                : c,
                            ),
                          })
                        }
                      />
                    )),
                  )}
                </div>
                <p className="vector-hint">
                  Drag the small dot to the feature. Drag the number to move its
                  label.
                </p>
                <button onClick={remove}>Delete callout</button>
              </>
            ) : (
              <p className="vector-hint">
                Select a layer on the drawing or in the layer list. Use Draw
                path to create your own shapes.
              </p>
            )}
            {pack.callouts.length > 0 && (
              <div className="vector-callout-list">
                <h3>Construction notes</h3>
                {pack.callouts.map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setCallout(c.id);
                      setSelected(null);
                      setView(c.view);
                    }}
                  >
                    {i + 1}. {c.text}
                  </button>
                ))}
              </div>
            )}
          </aside>
        </div>
      ) : (
        <section className="vector-data-page">
          {tab === "specs" ? (
            <>
              <div className="vector-data-title">
                <div>
                  <span className="eyebrow">FINISHED GARMENT DIMENSIONS</span>
                  <h3>Size specification</h3>
                  <p>
                    Enter finished garment measurements and tolerances. Empty
                    cells export as TBD.
                  </p>
                </div>
                <label>
                  Units
                  <select
                    aria-label="Specification units"
                    value={pack.units}
                    onChange={(e) =>
                      change(
                        convertPackUnits(pack, e.target.value as "cm" | "in"),
                      )
                    }
                  >
                    <option value="cm">Centimeters</option>
                    <option value="in">Inches</option>
                  </select>
                </label>
              </div>
              <div className="vector-sizes">
                <label>
                  Sizes, separated by commas
                  <input
                    aria-label="Size names"
                    value={sizes}
                    onChange={(e) => setSizes(e.target.value)}
                    maxLength={160}
                  />
                </label>
                <button
                  onClick={() => {
                    const names = sizes
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    change(resizeSizes(pack, names));
                  }}
                >
                  Apply size names
                </button>
              </div>
              <div className="vector-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Point of measure</th>
                      <th>How to measure</th>
                      <th>± {pack.units}</th>
                      {pack.sizes.map((s) => (
                        <th key={s}>{s}</th>
                      ))}
                      <th>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pack.measurements.map((m, i) => (
                      <tr key={m.id}>
                        <td>
                          <input
                            aria-label={`Measurement ${i + 1} name`}
                            maxLength={100}
                            value={m.name}
                            onChange={(e) =>
                              change({
                                ...pack,
                                measurements: pack.measurements.map((r) =>
                                  r.id === m.id
                                    ? { ...r, name: e.target.value }
                                    : r,
                                ),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`Measurement ${i + 1} method`}
                            maxLength={240}
                            value={m.method}
                            onChange={(e) =>
                              change({
                                ...pack,
                                measurements: pack.measurements.map((r) =>
                                  r.id === m.id
                                    ? { ...r, method: e.target.value }
                                    : r,
                                ),
                              })
                            }
                          />
                        </td>
                        <td>
                          <Num
                            label={`Tolerance ${i + 1}`}
                            value={m.tolerance}
                            min={0}
                            max={100}
                            step={0.1}
                            onChange={(n) =>
                              change({
                                ...pack,
                                measurements: pack.measurements.map((r) =>
                                  r.id === m.id ? { ...r, tolerance: n } : r,
                                ),
                              })
                            }
                          />
                        </td>
                        {pack.sizes.map((s, j) => (
                          <td key={s}>
                            <input
                              aria-label={`${m.name} ${s}`}
                              type="number"
                              min="0"
                              max="1000"
                              step="0.1"
                              placeholder="TBD"
                              value={
                                m.values[j] === null
                                  ? ""
                                  : Math.round(m.values[j]! * 1000) / 1000
                              }
                              onChange={(e) => {
                                const v =
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value);
                                if (
                                  v !== null &&
                                  (!Number.isFinite(v) || v < 0 || v > 1000)
                                )
                                  return;
                                change({
                                  ...pack,
                                  measurements: pack.measurements.map((r) =>
                                    r.id === m.id
                                      ? {
                                          ...r,
                                          values: r.values.map((old, k) =>
                                            k === j ? v : old,
                                          ),
                                        }
                                      : r,
                                  ),
                                });
                              }}
                            />
                          </td>
                        ))}
                        <td>
                          <button
                            aria-label={`Remove measurement ${i + 1}`}
                            onClick={() =>
                              change({
                                ...pack,
                                measurements: pack.measurements.filter(
                                  (r) => r.id !== m.id,
                                ),
                              })
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                disabled={pack.measurements.length >= 60}
                onClick={() =>
                  change({
                    ...pack,
                    measurements: [
                      ...pack.measurements,
                      {
                        id: crypto.randomUUID(),
                        name: "New measurement",
                        method: "",
                        tolerance: 0.5,
                        values: pack.sizes.map(() => null),
                      },
                    ],
                  })
                }
              >
                <Plus size={14} /> Add measurement
              </button>
            </>
          ) : tab === "materials" ? (
            <>
              <div className="vector-data-title">
                <div>
                  <span className="eyebrow">BILL OF MATERIALS</span>
                  <h3>Fabrics, trims & packaging</h3>
                  <p>
                    Match material codes to the paths in your technical flats.
                  </p>
                </div>
                <button
                  disabled={pack.materials.length >= 60}
                  onClick={() =>
                    change({
                      ...pack,
                      materials: [
                        ...pack.materials,
                        {
                          id: crypto.randomUUID(),
                          code: `MAT-${String(pack.materials.length + 1).padStart(2, "0")}`,
                          kind: "Trim",
                          description: "",
                          composition: "",
                          color: "",
                          quantity: 0,
                          unit: "pcs",
                          supplier: "",
                        },
                      ],
                    })
                  }
                >
                  <Plus size={14} /> Add material
                </button>
              </div>
              <div className="vector-materials">
                {pack.materials.map((m, i) => (
                  <article key={m.id}>
                    <div className="vector-material-heading">
                      <strong>{m.code || "Material"}</strong>
                      <button
                        aria-label={`Remove material ${i + 1}`}
                        onClick={() =>
                          change({
                            ...pack,
                            materials: pack.materials.filter(
                              (r) => r.id !== m.id,
                            ),
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {(
                      [
                        "code",
                        "description",
                        "composition",
                        "color",
                        "supplier",
                        "unit",
                      ] as const
                    ).map((k) => (
                      <label key={k}>
                        {
                          {
                            code: "Material code",
                            description: "Description",
                            composition: "Fiber / composition",
                            color: "Color / reference",
                            supplier: "Supplier",
                            unit: "Quantity unit",
                          }[k]
                        }
                        <input
                          aria-label={`Material ${i + 1} ${k}`}
                          value={m[k]}
                          maxLength={
                            k === "unit"
                              ? 30
                              : k === "code"
                                ? 80
                                : k === "description"
                                  ? 240
                                  : k === "supplier"
                                    ? 150
                                    : k === "color"
                                      ? 100
                                      : 120
                          }
                          onChange={(e) =>
                            change({
                              ...pack,
                              materials: pack.materials.map((r) =>
                                r.id === m.id
                                  ? { ...r, [k]: e.target.value }
                                  : r,
                              ),
                            })
                          }
                        />
                      </label>
                    ))}
                    <div className="vector-pair">
                      <label>
                        Type
                        <select
                          aria-label={`Material ${i + 1} type`}
                          value={m.kind}
                          onChange={(e) =>
                            change({
                              ...pack,
                              materials: pack.materials.map((r) =>
                                r.id === m.id
                                  ? {
                                      ...r,
                                      kind: e.target.value as typeof m.kind,
                                    }
                                  : r,
                              ),
                            })
                          }
                        >
                          {["Fabric", "Trim", "Label", "Packaging"].map((k) => (
                            <option key={k}>{k}</option>
                          ))}
                        </select>
                      </label>
                      <Num
                        label={`Material ${i + 1} quantity`}
                        value={m.quantity}
                        min={0}
                        max={10000}
                        step={0.1}
                        onChange={(quantity) =>
                          change({
                            ...pack,
                            materials: pack.materials.map((r) =>
                              r.id === m.id ? { ...r, quantity } : r,
                            ),
                          })
                        }
                      />
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="vector-data-title">
                <div>
                  <span className="eyebrow">STYLE RECORD</span>
                  <h3>Manufacturer handoff</h3>
                  <p>
                    Your ZIP includes editable SVG flats, a PDF tech pack, CSV
                    specifications and an editable pack file.
                  </p>
                </div>
              </div>
              <div className="vector-style-form">
                {(
                  [
                    "name",
                    "style",
                    "revision",
                    "season",
                    "manufacturer",
                  ] as const
                ).map((k) => (
                  <label key={k}>
                    {
                      {
                        name: "Garment name",
                        style: "Style code",
                        revision: "Pack revision",
                        season: "Season / collection",
                        manufacturer: "Manufacturer / contact",
                      }[k]
                    }
                    <input
                      aria-label={
                        k === "name"
                          ? "Garment name"
                          : k === "style"
                            ? "Style code"
                            : k === "revision"
                              ? "Pack revision"
                              : k === "season"
                                ? "Season / collection"
                                : "Manufacturer / contact"
                      }
                      value={pack[k]}
                      maxLength={
                        k === "name"
                          ? 100
                          : k === "revision"
                            ? 60
                            : k === "manufacturer"
                              ? 120
                              : 80
                      }
                      onChange={(e) => change({ ...pack, [k]: e.target.value })}
                    />
                  </label>
                ))}
                <label className="vector-wide">
                  Construction, finishing & sample instructions
                  <textarea
                    aria-label="Manufacturer instructions"
                    maxLength={5000}
                    rows={12}
                    value={pack.notes}
                    onChange={(e) => change({ ...pack, notes: e.target.value })}
                  />
                </label>
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
