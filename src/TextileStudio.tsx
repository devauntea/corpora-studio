import { selectionBounds } from "./vector-selection";
import { useMemo, useRef, useState } from "react";
import { Check, Palette, RotateCcw, SlidersHorizontal } from "lucide-react";
import { vectorPath, type VectorLayer, type VectorPack } from "./vector-pack";
import {
  colorPalettes,
  defaultTextile,
  textilePatternSvg,
  textilePatternId,
  textilePresets,
  textileSummary,
  textileSwatchSvg,
  type Textile,
} from "./textiles";
import "./textile-studio.css";

export type TextileScope = "selected" | "front" | "back" | "both";
const paintable = (layer: VectorLayer) =>
  layer.visible && !layer.locked && layer.closed && layer.fill !== "none";
const fabricPart = (layer: VectorLayer) =>
  /(?:^| · )(?:fabric|shell)(?:$| · )/i.test(layer.name) ||
  /^(?:front|back|bodice|sleeve)(?: panel)?$/i.test(layer.name);
/** Automatic application keeps traced linework, highlights and trims intact. */
export function textileTargetLayers(
  pack: VectorPack,
  scope: TextileScope,
  selectedIds: string[],
) {
  return pack.layers.filter(
    (layer) =>
      paintable(layer) &&
      (scope === "selected"
        ? selectedIds.includes(layer.id)
        : fabricPart(layer) && (scope === "both" || layer.view === scope)),
  );
}
export function applyTextileToPack(
  pack: VectorPack,
  style: Textile,
  ids: string[],
): VectorPack {
  const chosen = new Set(ids);
  return {
    ...pack,
    layers: pack.layers.map((layer) => {
      if (!chosen.has(layer.id) || !paintable(layer)) return layer;
      const { textile: _previous, ...plain } = layer;
      return {
        ...plain,
        fill: style.colors[0],
        ...(style.pattern !== "plain"
          ? {
              textile: {
                ...style,
                colors: [...style.colors] as Textile["colors"],
              },
            }
          : {}),
      };
    }),
  };
}
const imageUrl = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export function TextileStudio({
  pack,
  selectedIds,
  onSelect,
  change,
  busy,
  notify,
  returnToDrawing,
}: {
  pack: VectorPack;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  change: (pack: VectorPack) => void;
  busy: boolean;
  notify: (message: string) => void;
  returnToDrawing: () => void;
}) {
  const controls = useRef<HTMLElement>(null);
  const reveal = (section: string) => {
    const pane = controls.current,
      target = pane?.querySelector<HTMLElement>(
        `[data-textile-section="${section}"]`,
      );
    if (pane && target)
      pane.scrollTo({
        top:
          pane.scrollTop +
          target.getBoundingClientRect().top -
          pane.getBoundingClientRect().top -
          62,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  };
  const initial =
    pack.layers.find((l) => selectedIds.includes(l.id) && paintable(l)) ??
    pack.layers.find((l) => paintable(l) && fabricPart(l));
  const [style, setStyle] = useState<Textile>(
    () =>
      initial?.textile ?? {
        ...defaultTextile(),
        colors: [
          initial?.fill === "none" ? "#f0eee9" : (initial?.fill ?? "#f0eee9"),
          ...defaultTextile().colors.slice(1),
        ] as Textile["colors"],
      },
  );
  const [scope, setScope] = useState<TextileScope>(
    selectedIds.length &&
      !pack.layers.some(
        (l) =>
          selectedIds.includes(l.id) &&
          / · (?:Linework|Highlights)$/i.test(l.name),
      )
      ? "selected"
      : "both",
  );
  const [family, setFamily] = useState("All prints");
  const [status, setStatus] = useState("");
  const targetLayers = textileTargetLayers(pack, scope, selectedIds),
    targetIds = targetLayers.map((l) => l.id);
  const preview = useMemo(
    () => applyTextileToPack(pack, style, targetIds),
    [pack, style, targetIds.join(",")],
  );
  const previewBounds = selectionBounds(
    preview.layers.filter((l) => l.visible),
  ) ?? { x: 0, y: 0, width: 480, height: 640 };
  const previewBox = `${previewBounds.x - 18} ${previewBounds.y - 18} ${previewBounds.width + 36} ${previewBounds.height + 36}`;
  const current = textilePresets.find((p) => p.id === style.pattern)!;
  const families = [
    "All prints",
    ...new Set(textilePresets.map((p) => p.family)),
  ];
  const prints = textilePresets.filter(
    (p) => family === "All prints" || p.family === family,
  );
  const update = (value: Partial<Textile>) => {
    setStyle((s) => ({ ...s, ...value }));
    setStatus("");
  };
  const skipped =
    scope === "selected"
      ? pack.layers.filter((l) => selectedIds.includes(l.id) && !paintable(l))
          .length
      : pack.layers.filter(
          (l) =>
            fabricPart(l) &&
            (scope === "both" || l.view === scope) &&
            !paintable(l),
        ).length;
  return (
    <section className="textile-studio" aria-label="Fabric and color studio">
      <div className="textile-preview-column">
        <header className="textile-preview-heading">
          <div>
            <span className="eyebrow">FABRIC / COLOR STUDY</span>
            <h3>{current.name}</h3>
            <p>Try a print, tune the palette, then apply it to your garment.</p>
          </div>
          <span className="textile-preview-badge">Live preview</span>
        </header>
        <div className="textile-target-controls">
          <label>
            Apply to
            <select
              aria-label="Fabric application target"
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as TextileScope);
                setStatus("");
              }}
            >
              <option value="both">Both views · fabric panels</option>
              <option value="front">Front · fabric panels</option>
              <option value="back">Back · fabric panels</option>
              <option value="selected">Selected parts</option>
            </select>
          </label>
          <span>
            {targetLayers.length} {targetLayers.length === 1 ? "part" : "parts"}{" "}
            in preview{skipped ? ` · ${skipped} locked or unavailable` : ""}
          </span>
        </div>
        <div className="textile-garment-preview">
          {pack.layers.some((l) => l.visible) ? (
            <div
              className="textile-preview-views"
              role="group"
              aria-label="Fabric preview on front and back garments"
            >
              {(["front", "back"] as const).map((view) => (
                <figure key={view}>
                  <figcaption>{view.toUpperCase()}</figcaption>
                  <svg
                    viewBox={previewBox}
                    aria-label={`${view} fabric preview`}
                  >
                    <defs
                      dangerouslySetInnerHTML={{
                        __html: preview.layers
                          .filter((l) => l.view === view && l.textile)
                          .map((l) =>
                            textilePatternSvg(
                              l.textile!,
                              `textile-live-${l.id}`,
                            ),
                          )
                          .join(""),
                      }}
                    />
                    {preview.layers
                      .filter((l) => l.view === view && l.visible)
                      .map((l) => (
                        <path
                          key={l.id}
                          data-fabric-layer={l.id}
                          d={vectorPath(l)}
                          fill={
                            l.textile
                              ? `url(#${textilePatternId(`textile-live-${l.id}`)})`
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
                          role={paintable(l) ? "button" : undefined}
                          tabIndex={paintable(l) ? 0 : undefined}
                          aria-label={
                            paintable(l)
                              ? `Choose ${view} ${l.name} for fabric`
                              : undefined
                          }
                          aria-pressed={
                            paintable(l)
                              ? selectedIds.includes(l.id)
                              : undefined
                          }
                          onClick={() => {
                            if (paintable(l)) {
                              onSelect([l.id]);
                              setScope("selected");
                              setStatus("");
                            }
                          }}
                          onKeyDown={(e) => {
                            if (
                              paintable(l) &&
                              (e.key === "Enter" || e.key === " ")
                            ) {
                              e.preventDefault();
                              onSelect([l.id]);
                              setScope("selected");
                              setStatus("");
                            }
                          }}
                        >
                          <title>
                            {l.name}
                            {l.locked ? " · locked" : ""}
                          </title>
                        </path>
                      ))}
                  </svg>
                </figure>
              ))}
            </div>
          ) : (
            <div className="textile-empty">
              <Palette size={32} />
              <h3>Start with a garment shape</h3>
              <p>
                Add a garment flat or draw a closed shape, then give it color
                and pattern.
              </p>
              <button onClick={returnToDrawing}>Open technical flats</button>
            </div>
          )}
        </div>
        <footer className="textile-preview-footer">
          <div className="textile-preview-description">
            <img
              src={imageUrl(textileSwatchSvg(style))}
              alt={`${current.name} fabric swatch`}
            />
            <div>
              <strong>{current.name}</strong>
              <span>
                {style.pattern === "plain"
                  ? style.colors[0].toUpperCase()
                  : `Repeat ${style.scale} · ${style.rotation}° rotation`}
              </span>
              <small>
                Illustrative print scale. Specify final repeat size with your
                sample maker.
              </small>
            </div>
          </div>
          <div className="textile-apply-row">
            <p role="status">
              {status ||
                (targetLayers.length
                  ? "Preview only until applied. Artwork lines stay intact."
                  : scope === "selected"
                    ? "Select a filled garment part in the preview or Technical flats."
                    : "No available fabric panels. Choose Selected parts to style a custom shape.")}
            </p>
            <button
              className="primary"
              disabled={busy || !targetLayers.length}
              onClick={() => {
                change(applyTextileToPack(pack, style, targetIds));
                const message = `${current.name} applied to ${targetLayers.length} ${targetLayers.length === 1 ? "part" : "parts"}.`;
                setStatus(message);
                notify(message);
              }}
            >
              <Check size={16} />
              Apply fabric & color
            </button>
          </div>
        </footer>
      </div>
      <aside
        ref={controls}
        className="textile-controls"
        aria-label="Fabric palette"
      >
        <nav className="textile-control-nav" aria-label="Fabric settings">
          <button onClick={() => reveal("prints")}>Prints</button>
          <button onClick={() => reveal("colors")}>Colors</button>
          <button onClick={() => reveal("repeat")}>Repeat</button>
        </nav>
        <section
          className="textile-pattern-section"
          data-textile-section="prints"
        >
          <div className="textile-section-title">
            <div>
              <span className="eyebrow">01 / CHOOSE A PRINT</span>
              <h4>Pattern library</h4>
            </div>
            <label>
              <span className="sr-only">Print category</span>
              <select
                aria-label="Print category"
                value={family}
                onChange={(e) => setFamily(e.target.value)}
              >
                {families.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="textile-pattern-grid">
            {prints.map((p) => (
              <button
                key={p.id}
                className="textile-pattern-card"
                aria-label={`Fabric pattern ${p.name}`}
                aria-pressed={style.pattern === p.id}
                onClick={() => {
                  setStyle(defaultTextile(p.id));
                  setStatus("");
                }}
              >
                <img
                  src={imageUrl(textileSwatchSvg(defaultTextile(p.id)))}
                  alt=""
                />
                <span>{p.name}</span>
                {style.pattern === p.id && (
                  <Check size={13} aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </section>
        <section data-textile-section="colors">
          <div className="textile-section-title">
            <div>
              <span className="eyebrow">02 / MAKE IT YOURS</span>
              <h4>Color palette</h4>
            </div>
            <Palette size={17} />
          </div>
          <div className="textile-colorways">
            {colorPalettes.map((p) => (
              <button
                key={p.name}
                title={p.name}
                aria-label={`Color palette ${p.name}`}
                aria-pressed={p.colors.every(
                  (c, i) => c.toLowerCase() === style.colors[i].toLowerCase(),
                )}
                onClick={() =>
                  update({ colors: [...p.colors] as Textile["colors"] })
                }
              >
                <span className="textile-palette-swatches">
                  {p.colors.map((c, i) => (
                    <i key={i} style={{ backgroundColor: c }} />
                  ))}
                </span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>
          <div className="textile-custom-colors">
            {style.colors.map((color, i) => (
              <label key={i}>
                <span>{["Base", "Primary", "Secondary", "Accent"][i]}</span>
                <input
                  type="color"
                  aria-label={`Fabric ${["base", "primary", "secondary", "accent"][i]} color`}
                  value={color}
                  onChange={(e) => {
                    const colors = [...style.colors] as Textile["colors"];
                    colors[i] = e.target.value;
                    update({ colors });
                  }}
                />
                <small>{color.toUpperCase()}</small>
              </label>
            ))}
          </div>
          <p className="textile-control-note">
            Use a preset or choose your own colors. Solid fabric uses the base
            color.
          </p>
        </section>
        <section data-textile-section="repeat">
          <div className="textile-section-title">
            <div>
              <span className="eyebrow">03 / TUNE THE REPEAT</span>
              <h4>Scale & direction</h4>
            </div>
            <SlidersHorizontal size={17} />
          </div>
          <fieldset
            disabled={style.pattern === "plain"}
            className="textile-repeat-fields"
          >
            <label>
              <span>
                Repeat size<output>{style.scale}</output>
              </span>
              <input
                aria-label="Fabric repeat size"
                type="range"
                min="12"
                max="160"
                step="2"
                value={style.scale}
                onChange={(e) => update({ scale: Number(e.target.value) })}
              />
            </label>
            <label>
              <span>
                Rotation<output>{style.rotation}°</output>
              </span>
              <input
                aria-label="Fabric rotation"
                type="range"
                min="-180"
                max="180"
                step="5"
                value={style.rotation}
                onChange={(e) => update({ rotation: Number(e.target.value) })}
              />
            </label>
            <div className="textile-rotation-presets">
              {[0, 45, 90].map((r) => (
                <button
                  key={r}
                  aria-label={`Fabric rotation ${r} degrees`}
                  aria-pressed={style.rotation === r}
                  onClick={() => update({ rotation: r })}
                >
                  {r}°
                </button>
              ))}
              <button
                aria-label="Reset fabric repeat"
                onClick={() =>
                  update({
                    scale: defaultTextile(style.pattern).scale,
                    rotation: 0,
                  })
                }
              >
                <RotateCcw size={13} />
                Reset
              </button>
            </div>
          </fieldset>
          <p className="textile-control-note">{textileSummary(style)}</p>
        </section>
      </aside>
    </section>
  );
}
