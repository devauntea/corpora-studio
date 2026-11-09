import { TextileStudio } from "./TextileStudio";
import { textilePatternSvg, textilePatternId } from "./textiles";
import { StyleDevelopment } from "./StyleDevelopment";
import { VectorReview } from "./VectorReview";
import { importSvg, placeSvg, type SvgImport } from "./vector-svg-import";
import { vectorPreflight } from "./vector-preflight";
import {
  selectionFor,
  selectionBounds,
  pruneGroups,
  groupSelection,
  transformSelection,
  duplicateSelection,
  reorderSelection,
} from "./vector-selection";
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
  Shirt as ShirtIcon,
  PenTool,
  Plus,
  Copy,
  Trash2,
  Undo2,
  Redo2,
  PanelLeft,
  PanelRight,
  Info,
} from "lucide-react";
import type { Fashion } from "./fashion-model";
import {
  VectorPackSchema,
  allContours,
  setContour,
  insertVectorAnchor,
  mapLayer,
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
  openTextiles?: boolean;
  onTextilesChange?: (open: boolean) => void;
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
  openTextiles,
  onTextilesChange,
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
  const [reviewExport, setReviewExport] = useState(false);
  const [svgPreview, setSvgPreview] = useState<SvgImport | null>(null);
  const [importingSvg, setImportingSvg] = useState(false);
  const svgFile = useRef<HTMLInputElement>(null);
  const importGeneration = useRef(0);
  useEffect(
    () => () => {
      importGeneration.current++;
    },
    [],
  );
  const fallback = useRef(templatePack("T-shirt"));
  const pack = value.vectorPack ?? fallback.current;
  const [contour, setContourIndex] = useState(0);
  const [selected, setSelectedRaw] = useState<string | null>(null),
    [node, setNode] = useState<number | null>(null),
    [view, setView] = useState<VectorView>("front");
  const [extraSelected, setExtraSelected] = useState<string[]>([]);
  const [individual, setIndividual] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(
    () => window.innerWidth > 1200,
  );

  const setSelected = (id: string | null) => {
    setSelectedRaw(id);
    setExtraSelected([]);
  };
  const selectedIds = [selected, ...extraSelected].filter(
    (id): id is string => !!id && pack.layers.some((l) => l.id === id),
  );
  const selectedLayers = pack.layers.filter((l) => selectedIds.includes(l.id));
  const lockedSelection = selectedLayers.some((l) => l.locked);
  const chooseIds = (ids: string[]) => {
    setSelectedRaw(ids[0] ?? null);
    setExtraSelected(ids.slice(1));
    setNode(null);
    setCallout(null);
  };
  const choose = (id: string, additive = false) => {
    const ids = selectionFor(pack, id, individual || tool === "nodes");
    const next = additive
      ? ids.every((i) => selectedIds.includes(i))
        ? selectedIds.filter((i) => !ids.includes(i))
        : [...new Set([...selectedIds, ...ids])]
      : ids;
    chooseIds(next);
    return next;
  };
  const [tab, setTab] = useState<
      | "drawing"
      | "fabric"
      | "assets"
      | "specs"
      | "materials"
      | "notes"
      | "development"
    >("drawing"),
    [tool, setTool] = useState<"select" | "nodes" | "pen" | "callout">(
      "select",
    );
  useEffect(() => {
    setTab((t) => (openLibrary ? "assets" : t === "assets" ? "drawing" : t));
  }, [openLibrary]);
  useEffect(() => {
    if (openTextiles !== undefined)
      setTab((current) =>
        openTextiles ? "fabric" : current === "fabric" ? "drawing" : current,
      );
  }, [openTextiles]);
  const navigateTab = (next: typeof tab) => {
    setTab(next);
    if (next === "fabric" && onTextilesChange) onTextilesChange(true);
    else onLibraryChange(next === "assets");
  };
  const [template, setTemplate] = useState<FlatTemplate>("T-shirt"),
    [component, setComponent] =
      useState<(typeof componentNames)[number]>("Patch pocket");
  const [pen, setPen] = useState<VectorNode[]>([]),
    [penClosed, setPenClosed] = useState(true),
    [format, setFormat] = useState<"zip" | "pdf" | "svg" | "json">("zip");
  const [sizes, setSizes] = useState(pack.sizes.join(", ")),
    [zoom, setZoom] = useState(1),
    [callout, setCallout] = useState<string | null>(null);
  useEffect(() => {
    // Selecting a path exposes its properties; artists can collapse the panel again.
    if (selected || callout || tool === "pen") setInspectorOpen(true);
  }, [selected, callout, tool]);
  const pageGuidance = {
    drawing: [
      "Design the garment",
      "Build the front and back, then add details and construction callouts.",
    ],
    fabric: [
      "Give the garment its character",
      "Explore fabric prints and color palettes on your front and back drawings.",
    ],
    specs: [
      "Define the fit",
      "Record finished garment measurements, size ranges and tolerances.",
    ],
    materials: [
      "Specify every material",
      "List fabrics, trims and quantities so your sample maker knows what to source.",
    ],
    notes: [
      "Explain the construction",
      "Give this style an identity and describe how it should be made.",
    ],
    development: [
      "Review the sample",
      "Track revisions and decisions before preparing the next handoff.",
    ],
    assets: [
      "Choose a starting design",
      "Add editable garment assets to your technical flats.",
    ],
  }[tab];
  const nextPage = (
    {
      drawing: "specs",
      fabric: "drawing",
      specs: "materials",
      materials: "notes",
      notes: "development",
      development: "drawing",
      assets: "drawing",
    } as const
  )[tab];
  const exportDescription = {
    zip: "Complete handoff: drawings, specifications, materials and editable source.",
    pdf: "A readable tech pack with drawings, measurements and instructions.",
    svg: "Editable front and back drawings. Dimensions stay in the size specification.",
    json: "Editable source for reopening this vector pack in Corpora Studio.",
  }[format];
  const toolGuidance = {
    select: "Select a path to move it. Shift-click to add to the selection.",
    nodes: selectedLayers.length
      ? "Select an anchor to edit its position and curve handles."
      : "Select a path first to reveal its editable anchors.",
    pen: `Click in the ${view} artboard to place points, then finish the path.`,
    callout:
      "Click a garment detail to add a numbered construction instruction.",
  }[tool];
  const svg = useRef<SVGSVGElement>(null),
    file = useRef<HTMLInputElement>(null);
  const drag = useRef<{
    start: { x: number; y: number };
    pack: VectorPack;
    layer?: string;
    ids?: string[];
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
    const checked = VectorPackSchema.safeParse(pruneGroups(p));
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
    exporter.current = async () => {
      setReviewExport(true);
    };
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
    let movingIds: string[] = [];
    if (id) {
      movingIds =
        ni !== undefined
          ? [id]
          : !e.shiftKey && selectedIds.includes(id)
            ? selectedIds
            : choose(id, e.shiftKey);
      if (ni !== undefined) setSelected(id);
      setNode(ni ?? null);
      setCallout(null);
      if (
        pack.layers.some((l) => movingIds.includes(l.id) && l.locked) ||
        e.shiftKey
      )
        return;
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
      ids: movingIds,
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
      x: p.x + dx,
      y: p.y + dy,
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
          if (!g.ids?.includes(l.id)) return l;
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
  const cancelDrag = () => {
    if (!drag.current) return;
    const original = drag.current.pack;
    drag.current = null;
    change(original);
    commit();
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
    if (!lockedSelection) change(transformSelection(pack, selectedIds, fn));
  };
  const bounds = selectionBounds(selectedLayers);
  const remove = () => {
    if (layer && !lockedSelection) {
      change({
        ...pack,
        layers: pack.layers.filter((l) => !selectedIds.includes(l.id)),
      });
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
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          cancelDrag();
          chooseIds([]);
          setPen([]);
          setTool("select");
        }
      }}
    >
      {reviewExport && (
        <VectorReview
          title="Review production handoff"
          close={() => setReviewExport(false)}
        >
          <p>
            <strong>
              Technical flat · {pack.style || "Untitled style"} · Revision{" "}
              {pack.revision || "unset"}
            </strong>
          </p>
          <p>
            Measurements are in <strong>{pack.units}</strong>. SVG/PDF drawings
            show design intent; use the specification table for dimensions.
            Export cutting patterns separately from Pattern studio.
          </p>
          <p>
            {format === "zip"
              ? "Includes SVG views, PDF, measurement/material tables, editable project and a handoff report."
              : `Export format: ${format.toUpperCase()}. The ZIP also includes the handoff report and editable project.`}
          </p>
          <div className="vector-review-findings">
            {vectorPreflight(pack).length ? (
              vectorPreflight(pack).map((issue, i) => (
                <div key={i}>
                  <p>
                    <strong>
                      {issue.severity === "error" ? "Cannot export" : "Review"}:
                    </strong>{" "}
                    {issue.message}
                  </p>
                  <button
                    onClick={() => {
                      navigateTab(issue.section);
                      setReviewExport(false);
                    }}
                  >
                    Go to{" "}
                    {issue.section === "specs"
                      ? "size specification"
                      : issue.section}
                  </button>
                </div>
              ))
            ) : (
              <p>
                No automated findings. Confirm the specifications and sample
                with your recipient before production.
              </p>
            )}
          </div>
          <footer>
            <button onClick={() => setReviewExport(false)}>Keep editing</button>
            <button
              className="primary"
              disabled={
                busy ||
                vectorPreflight(pack).some((i) => i.severity === "error")
              }
              onClick={async () => {
                await exportPack();
                setReviewExport(false);
              }}
            >
              Export reviewed {format.toUpperCase()}
            </button>
          </footer>
        </VectorReview>
      )}
      {svgPreview && (
        <VectorReview
          title="Review SVG import"
          close={() => setSvgPreview(null)}
        >
          <p>
            <strong>{svgPreview.source.name}</strong> ·{" "}
            {svgPreview.layers.length} editable paths ·{" "}
            {svgPreview.layers[0].view} view
          </p>
          <p>
            Original size: {svgPreview.source.width} ×{" "}
            {svgPreview.source.height}. ViewBox:{" "}
            {svgPreview.source.viewBox || "unspecified"}.
          </p>
          <svg
            className="vector-import-preview"
            viewBox="0 0 480 640"
            role="img"
            aria-label="Converted SVG preview"
          >
            <defs
              dangerouslySetInnerHTML={{
                __html: svgPreview.layers
                  .filter((l) => l.textile)
                  .map((l) =>
                    textilePatternSvg(l.textile!, `import-fabric-${l.id}`),
                  )
                  .join(""),
              }}
            />
            {svgPreview.layers.map((l) => (
              <path
                key={l.id}
                d={vectorPath(l)}
                fill={
                  l.textile
                    ? `url(#${textilePatternId(`import-fabric-${l.id}`)})`
                    : l.fill
                }
                fillRule={l.fillRule}
                stroke={l.stroke}
                strokeWidth={l.strokeWidth}
                strokeLinecap={l.lineCap}
                strokeLinejoin={l.lineJoin}
              />
            ))}
          </svg>
          {svgPreview.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
          <p>
            The original SVG and its dimensions are retained in the editable
            project. No source markup is executed.
          </p>
          <footer>
            <button onClick={() => setSvgPreview(null)}>Cancel import</button>
            <button
              className="primary"
              onClick={() => {
                try {
                  const next = placeSvg(pack, svgPreview);
                  change(next);
                  chooseIds(svgPreview.layers.map((l) => l.id));
                  setView(svgPreview.layers[0].view);
                  setSvgPreview(null);
                  notify("SVG imported. Undo restores the previous drawing.");
                } catch (e) {
                  notify(String(e), true);
                }
              }}
            >
              Place SVG
            </button>
          </footer>
        </VectorReview>
      )}
      <header className="vector-top">
        <button onClick={close}>
          <ArrowLeft size={15} /> Pattern studio
        </button>
        <div>
          <span className="eyebrow">
            STYLE {pack.style || "UNTITLED"} / REV {pack.revision || "—"}
          </span>
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
        {tab === "drawing" && (
          <div
            className="vector-panel-controls"
            role="group"
            aria-label="Drawing panels"
          >
            <button
              aria-label="Garment flats panel"
              title={
                libraryOpen ? "Hide garment library" : "Show garment library"
              }
              aria-controls="vector-library-panel"
              aria-expanded={libraryOpen}
              onClick={() => setLibraryOpen((v) => !v)}
            >
              <PanelLeft size={17} />
              <span>Library</span>
            </button>
            <button
              aria-label="Path inspector panel"
              title={
                inspectorOpen ? "Hide path inspector" : "Show path inspector"
              }
              aria-controls="vector-inspector-panel"
              aria-expanded={inspectorOpen}
              onClick={() => setInspectorOpen((v) => !v)}
            >
              <PanelRight size={17} />
              <span>Inspector</span>
            </button>
          </div>
        )}
        <div className="vector-export-choice">
          <select
            aria-label="Vector export format"
            aria-describedby="vector-export-intent"
            value={format}
            onChange={(e) => setFormat(e.target.value as typeof format)}
          >
            <option value="zip">Manufacturer pack · ZIP</option>
            <option value="pdf">Tech pack · PDF</option>
            <option value="svg">Editable flats · SVG</option>
            <option value="json">Editable project · JSON</option>
          </select>
          <details className="vector-export-help">
            <summary aria-label="About this export">
              <Info size={15} />
            </summary>
            <small id="vector-export-intent">{exportDescription}</small>
          </details>
        </div>
        <button
          className="primary"
          disabled={busy}
          onClick={() => setReviewExport(true)}
        >
          <Download size={15} /> Export vector pack
        </button>
      </header>
      <nav className="vector-tabs" aria-label="Vector pack pages">
        {(
          [
            "drawing",
            "fabric",
            "specs",
            "materials",
            "notes",
            "development",
          ] as const
        ).map((t) => (
          <button
            key={t}
            aria-pressed={tab === t}
            className={tab === t ? "active" : ""}
            onClick={() => navigateTab(t)}
          >
            {
              {
                drawing: "Technical flats",
                fabric: "Fabric & color",
                assets: "Garment flats",
                specs: "Size specification",
                materials: "Materials & trims",
                notes: "Style & instructions",
                development: "Samples & revisions",
              }[t]
            }
          </button>
        ))}
        <button
          className="vector-next-stage"
          onClick={() => navigateTab(nextPage)}
        >
          {
            {
              specs: "Next: Define sizes",
              materials: "Next: Add materials",
              notes: "Next: Construction notes",
              development: "Next: Sample review",
              drawing: "Return to drawing",
            }[nextPage]
          }{" "}
          →
        </button>
      </nav>
      {tab !== "assets" && tab !== "drawing" && tab !== "fabric" && (
        <div className="vector-workflow-context">
          <div>
            <b>{pageGuidance[0]}</b>
            <span>{pageGuidance[1]}</span>
          </div>
        </div>
      )}
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
            navigateTab("drawing");
            chooseIds(selectionFor(next, layers[0]?.id ?? ""));
            setView(layers[0]?.view ?? "front");
            setCallout(null);
            setPen([]);
            setTool("select");
            notify(
              "Garment paths added. Select a layer to recolor or reshape it.",
            );
          }}
        />
      ) : tab === "fabric" ? (
        <TextileStudio
          pack={pack}
          selectedIds={selectedIds}
          onSelect={chooseIds}
          change={change}
          busy={busy}
          notify={notify}
          returnToDrawing={() => navigateTab("drawing")}
        />
      ) : tab === "drawing" ? (
        <div
          className={`vector-drawing${libraryOpen ? "" : " library-collapsed"}${inspectorOpen ? "" : " inspector-collapsed"}`}
        >
          <aside
            id="vector-library-panel"
            className="vector-sidebar"
            aria-label="Garment flats"
          >
            <button
              className="asset-library-entry"
              onClick={() => {
                navigateTab("assets");
              }}
            >
              <Layers size={18} />
              <span>
                <strong>Browse garment flats</strong>
                <small>112 imported flats →</small>
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
              {!pack.layers.some((l) => l.view === view) && (
                <p className="vector-hint">
                  No {view} paths yet. Add a template or draw a custom path.
                </p>
              )}
              {pack.layers
                .filter((l) => l.view === view)
                .slice()
                .reverse()
                .map((l) => (
                  <div
                    key={l.id}
                    className={selectedIds.includes(l.id) ? "selected" : ""}
                  >
                    <button
                      onClick={(e) => {
                        choose(l.id, e.shiftKey);
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
              disabled={busy || importingSvg}
              onClick={() => svgFile.current?.click()}
            >
              {importingSvg ? "Reading SVG…" : "Import SVG drawing"}
            </button>
            <input
              ref={svgFile}
              hidden
              type="file"
              accept=".svg,image/svg+xml"
              aria-label="Import SVG file"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                const generation = ++importGeneration.current;
                setImportingSvg(true);
                try {
                  if (f.size > 500000) throw new Error("SVG limit is 500 KB.");
                  const preview = await importSvg(await f.text(), f.name, view);
                  if (generation === importGeneration.current)
                    setSvgPreview(preview);
                } catch (error) {
                  if (generation === importGeneration.current)
                    notify(`SVG not imported: ${String(error)}`, true);
                } finally {
                  if (generation === importGeneration.current)
                    setImportingSvg(false);
                }
              }}
            />
            {pack.sources.length > 0 && (
              <details className="vector-sources">
                <summary>Original SVG files ({pack.sources.length}/8)</summary>
                {pack.sources.map((source) => (
                  <section key={source.id}>
                    <p>
                      <strong>{source.name}</strong>
                      <br />
                      {source.width} × {source.height}
                    </p>
                    <button
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const bytes = new TextEncoder().encode(
                            source.original,
                          );
                          const digest = Array.from(
                            new Uint8Array(
                              await crypto.subtle.digest("SHA-256", bytes),
                            ),
                            (b) => b.toString(16).padStart(2, "0"),
                          ).join("");
                          if (digest !== source.sha256)
                            throw new Error(
                              "Original SVG integrity check failed.",
                            );
                          await saveVectorPack(
                            bytes,
                            source.name.replace(/\.svg$/i, ""),
                            "svg",
                          );
                        } catch (error) {
                          notify(String(error), true);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Save original SVG
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        change({
                          ...pack,
                          sources: pack.sources.filter(
                            (s) => s.id !== source.id,
                          ),
                        })
                      }
                    >
                      Remove saved original
                    </button>
                  </section>
                ))}
                <p>
                  Removing an original keeps the placed paths. Undo restores it.
                </p>
              </details>
            )}
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
              <div
                className="vector-draw-tools"
                role="group"
                aria-label="Drawing tools"
              >
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
              </div>
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
            <div className="vector-selectionbar">
              <div
                className="vector-view-switch"
                aria-label="Working garment view"
              >
                {(["front", "back"] as const).map((v) => (
                  <button
                    key={v}
                    aria-label={`Work on ${v} view`}
                    aria-pressed={view === v}
                    onClick={() => {
                      setView(v);
                      setPen([]);
                      chooseIds([]);
                    }}
                    disabled={busy}
                  >
                    {v === "front" ? "Front" : "Back"}
                  </button>
                ))}
              </div>

              <label>
                <input
                  type="checkbox"
                  checked={individual}
                  onChange={(e) => {
                    setIndividual(e.target.checked);
                    setSelected(selected);
                  }}
                />{" "}
                Individual paths
              </label>
              <button
                disabled={busy}
                onClick={() =>
                  chooseIds(
                    pack.layers.filter((l) => l.view === view).map((l) => l.id),
                  )
                }
              >
                Select {view}
              </button>
              <button
                disabled={busy || selectedIds.length < 2}
                onClick={() => change(groupSelection(pack, selectedIds))}
              >
                Group selection
              </button>
              <button
                disabled={
                  busy ||
                  !pack.groups.some((g) =>
                    g.layerIds.some((id) => selectedIds.includes(id)),
                  )
                }
                onClick={() =>
                  change({
                    ...pack,
                    groups: pack.groups.filter(
                      (g) => !g.layerIds.some((id) => selectedIds.includes(id)),
                    ),
                  })
                }
              >
                Ungroup selection
              </button>
              <span aria-live="polite">{selectedIds.length} selected</span>
            </div>
            <div className="vector-canvas-scroll">
              {pack.layers.length === 0 &&
                pack.callouts.length === 0 &&
                tool === "select" && (
                  <div className="vector-empty-canvas">
                    <ShirtIcon />
                    <h3>Start with a garment shape</h3>
                    <p>
                      Choose an editable flat or draw your own outline. Add
                      front and back views before preparing your handoff.
                    </p>
                    <div>
                      <button
                        onClick={() => {
                          navigateTab("assets");
                        }}
                      >
                        Explore garment library
                      </button>
                      <button
                        onClick={() => {
                          setTool("pen");
                          setPen([]);
                        }}
                      >
                        Draw from scratch
                      </button>
                    </div>
                  </div>
                )}
              <svg
                ref={svg}
                className={`vector-canvas tool-${tool}`}
                style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
                viewBox="0 0 960 640"
                aria-label="Front and back garment flats"
                role="group"
                onPointerMove={move}
                onPointerUp={finish}
                onPointerCancel={cancelDrag}
                onLostPointerCapture={finish}
              >
                <defs
                  dangerouslySetInnerHTML={{
                    __html: pack.layers
                      .filter((l) => l.textile)
                      .map((l) =>
                        textilePatternSvg(l.textile!, `canvas-fabric-${l.id}`),
                      )
                      .join(""),
                  }}
                />
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
                            fill={
                              l.textile
                                ? `url(#${textilePatternId(`canvas-fabric-${l.id}`)})`
                                : l.fill
                            }
                            fillRule={
                              l.fillRule ?? (l.contours ? "evenodd" : "nonzero")
                            }
                            stroke={l.stroke}
                            strokeWidth={l.strokeWidth}
                            strokeDasharray={l.dashed ? "5 4" : undefined}
                            strokeLinejoin={l.lineJoin ?? "round"}
                            strokeLinecap={l.lineCap ?? "round"}
                            onPointerDown={(e) => start(e, v, l.id)}
                            tabIndex={0}
                            role="button"
                            aria-label={`Select ${v} ${l.name}`}
                            onFocus={() => {
                              if (!selectedIds.includes(l.id)) choose(l.id);
                              setView(v);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                choose(l.id, e.shiftKey);
                                setView(v);
                              }
                              if (
                                !lockedSelection &&
                                [
                                  "ArrowUp",
                                  "ArrowDown",
                                  "ArrowLeft",
                                  "ArrowRight",
                                ].includes(e.key)
                              ) {
                                e.preventDefault();
                                const d = e.shiftKey ? 10 : 1;
                                change(
                                  transformSelection(
                                    pack,
                                    selectedIds.includes(l.id)
                                      ? selectedIds
                                      : selectionFor(pack, l.id, individual),
                                    (p) => ({
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
                                    }),
                                  ),
                                );
                              }
                            }}
                          />
                          {selectedIds.includes(l.id) && (
                            <path
                              d={vectorPath(l)}
                              fill="none"
                              stroke="#303030"
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
                                            stroke="#303030"
                                          />
                                          <circle
                                            cx={n[h]!.x}
                                            cy={n[h]!.y}
                                            r="3"
                                            fill="white"
                                            stroke="#303030"
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
                                  fill={i === node ? "#303030" : "white"}
                                  stroke="#303030"
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
                          stroke="#303030"
                          strokeWidth="1.5"
                          pointerEvents="none"
                        />
                        {pen.map((p, i) => (
                          <circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r="3"
                            fill="#303030"
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
              <span aria-live="polite">
                {tool === "pen" || tool === "callout" || tool === "nodes"
                  ? toolGuidance
                  : call
                    ? "Construction callout selected"
                    : selectedIds.length
                      ? `${selectedIds.length === 1 ? layer?.name || "Unnamed path" : `${selectedIds.length} paths`} selected${lockedSelection ? " · Locked" : ""}`
                      : "Select a path to move it · Shift-click for multiple paths"}
              </span>
              <span>
                {view === "front" ? "Front" : "Back"} · {pack.layers.length}{" "}
                paths / {pack.callouts.length} callouts
              </span>
            </footer>
          </section>
          <aside
            id="vector-inspector-panel"
            className="vector-inspector"
            aria-label="Path inspector"
          >
            <span className="eyebrow">
              {call ? "CONSTRUCTION CALLOUT" : "PATH PROPERTIES"}
            </span>
            {selectedIds.length > 1 && bounds ? (
              <>
                <h3>
                  {pack.groups.find(
                    (g) =>
                      g.layerIds.length === selectedIds.length &&
                      g.layerIds.every((id) => selectedIds.includes(id)),
                  )?.name ?? "Multiple paths"}
                </h3>
                {pack.groups
                  .filter(
                    (g) =>
                      g.layerIds.length === selectedIds.length &&
                      g.layerIds.every((id) => selectedIds.includes(id)),
                  )
                  .map((g) => (
                    <label key={g.id}>
                      Group name
                      <input
                        aria-label="Group name"
                        maxLength={80}
                        value={g.name}
                        onChange={(e) =>
                          change({
                            ...pack,
                            groups: pack.groups.map((a) =>
                              a.id === g.id
                                ? { ...a, name: e.target.value }
                                : a,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                <p>
                  {selectedIds.length} paths selected. Shift-click adds or
                  removes a garment.
                </p>
                <fieldset disabled={busy || lockedSelection}>
                  <Num
                    label="Selection X"
                    value={bounds.x}
                    onChange={(x) =>
                      transform((p) => ({ ...p, x: p.x + x - bounds.x }))
                    }
                  />
                  <Num
                    label="Selection Y"
                    value={bounds.y}
                    onChange={(y) =>
                      transform((p) => ({ ...p, y: p.y + y - bounds.y }))
                    }
                  />
                  <Num
                    label="Selection width"
                    min={1}
                    value={bounds.width}
                    onChange={(w) =>
                      bounds.width &&
                      transform((p) => ({
                        ...p,
                        x: bounds.x + ((p.x - bounds.x) * w) / bounds.width,
                      }))
                    }
                  />
                  <Num
                    label="Selection height"
                    min={1}
                    value={bounds.height}
                    onChange={(h) =>
                      bounds.height &&
                      transform((p) => ({
                        ...p,
                        y: bounds.y + ((p.y - bounds.y) * h) / bounds.height,
                      }))
                    }
                  />
                  <button
                    onClick={() =>
                      transform((p) => ({
                        ...p,
                        x: 2 * bounds.x + bounds.width - p.x,
                      }))
                    }
                  >
                    Mirror selection
                  </button>
                  <button
                    onClick={() => {
                      const cx = bounds.x + bounds.width / 2,
                        cy = bounds.y + bounds.height / 2;
                      transform((p) => ({
                        x: cx - (p.y - cy),
                        y: cy + (p.x - cx),
                      }));
                    }}
                  >
                    Rotate selection 90°
                  </button>
                  <button
                    onClick={() => {
                      const result = duplicateSelection(pack, selectedIds);
                      change(result.pack);
                      chooseIds(result.ids);
                    }}
                  >
                    Duplicate selection
                  </button>
                  <button
                    onClick={() => {
                      const result = duplicateSelection(
                        pack,
                        selectedIds,
                        view === "front" ? "back" : "front",
                      );
                      change(result.pack);
                      chooseIds(result.ids);
                      setView(view === "front" ? "back" : "front");
                    }}
                  >
                    Copy selection to other view
                  </button>
                  <button
                    onClick={() =>
                      change(reorderSelection(pack, selectedIds, true))
                    }
                  >
                    Bring selection forward
                  </button>
                  <button
                    onClick={() =>
                      change(reorderSelection(pack, selectedIds, false))
                    }
                  >
                    Send selection behind
                  </button>
                  <button onClick={remove}>Delete selection</button>
                </fieldset>
                <button
                  disabled={busy}
                  onClick={() =>
                    change({
                      ...pack,
                      layers: pack.layers.map((l) =>
                        selectedIds.includes(l.id)
                          ? { ...l, locked: !lockedSelection }
                          : l,
                      ),
                    })
                  }
                >
                  {lockedSelection ? "Unlock selection" : "Lock selection"}
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    change({
                      ...pack,
                      layers: pack.layers.map((l) =>
                        selectedIds.includes(l.id)
                          ? {
                              ...l,
                              visible: !selectedLayers.every((l) => l.visible),
                            }
                          : l,
                      ),
                    })
                  }
                >
                  {selectedLayers.every((l) => l.visible)
                    ? "Hide selection"
                    : "Show selection"}
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    setIndividual(true);
                    setSelected(selected);
                  }}
                >
                  Edit individual paths
                </button>
              </>
            ) : layer && bounds ? (
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
                        onChange={(e) =>
                          updateLayer({
                            fill: e.target.value,
                            textile: undefined,
                          })
                        }
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
                  <button onClick={() => navigateTab("fabric")}>
                    Fabric & color{layer.textile ? " · Edit print" : " →"}
                  </button>
                  <label className="vector-inline">
                    <input
                      type="checkbox"
                      checked={layer.fill === "none"}
                      onChange={(e) =>
                        updateLayer({
                          fill: e.target.checked ? "none" : "#f0eee9",
                          textile: undefined,
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
              <div className="vector-inspector-empty">
                <Layers size={24} />
                <h3>
                  {tool === "pen"
                    ? "Drawing a new path"
                    : tool === "callout"
                      ? "Add a construction note"
                      : "Choose something to edit"}
                </h3>
                <p>
                  {tool === "pen"
                    ? "Place at least two points on the active artboard, then choose Finish path."
                    : tool === "callout"
                      ? "Click the detail on your drawing. Its numbered note and position appear here."
                      : "Select a garment path or a layer to change its color, shape and position."}
                </p>
                {tool !== "pen" && tool !== "callout" && (
                  <>
                    {pack.layers.some((l) => l.view === view && l.visible) && (
                      <button
                        onClick={() =>
                          choose(
                            pack.layers.find(
                              (l) => l.view === view && l.visible,
                            )!.id,
                          )
                        }
                      >
                        Select first {view} path
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setTool("pen");
                        setPen([]);
                      }}
                    >
                      Start a custom path
                    </button>
                    <details>
                      <summary>Selection tips</summary>
                      <p>
                        Shift-click to select several paths. Turn on Individual
                        paths to edit part of a group. Use arrow keys to nudge a
                        selected path.
                      </p>
                    </details>
                  </>
                )}
              </div>
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
      ) : tab === "development" ? (
        <StyleDevelopment pack={pack} change={change} notify={notify} />
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
                                  r.id === m.id
                                    ? {
                                        ...r,
                                        tolerance: n,
                                        toleranceConfirmed: true,
                                      }
                                    : r,
                                ),
                              })
                            }
                          />
                          <label>
                            <input
                              type="checkbox"
                              aria-label={`Confirm tolerance ${i + 1}`}
                              checked={m.toleranceConfirmed ?? false}
                              onChange={(e) =>
                                change({
                                  ...pack,
                                  measurements: pack.measurements.map((r) =>
                                    r.id === m.id
                                      ? {
                                          ...r,
                                          toleranceConfirmed: e.target.checked,
                                        }
                                      : r,
                                  ),
                                })
                              }
                            />
                            Confirmed
                          </label>
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
