import { defaultProcessing, type Processing } from "./image-processing";
import { useEffect, useRef, useState } from "react";
import {
  Eraser,
  Paintbrush,
  Undo2,
  Redo2,
  X,
  Download,
  Check,
  Eye,
  Crop,
} from "lucide-react";
import {
  cleanArtwork,
  fullCrop,
  artworkBounds,
  type ArtworkCrop,
  clamp,
  imageSource,
  type Asset,
  type ArtworkEdits,
} from "./domain";
import { renderArtwork } from "./artwork";
import { loadImage, saveReview, native } from "./io";
import { listen } from "@tauri-apps/api/event";

export function ArtworkStudio({
  asset,
  apply,
  close,
  pointBudget,
}: {
  asset: Asset;
  apply: (edits: ArtworkEdits) => void;
  close: () => void;
  pointBudget: number;
}) {
  const [edits, setEdits] = useState<ArtworkEdits>(
    asset.edits ?? cleanArtwork(),
  );
  const [past, setPast] = useState<ArtworkEdits[]>([]),
    [future, setFuture] = useState<ArtworkEdits[]>([]);
  const [tool, setTool] = useState<"erase" | "restore" | "crop">("erase"),
    [radius, setRadius] = useState(0.025),
    [original, setOriginal] = useState(false);
  const [zoom, setZoom] = useState(1),
    [error, setError] = useState(""),
    [exporting, setExporting] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null),
    image = useRef<HTMLImageElement | null>(null),
    gesture = useRef<ArtworkEdits | null>(null);
  const adjustment = useRef<ArtworkEdits | null>(null);
  const cropDrag = useRef<{
    start: [number, number];
    crop: ArtworkCrop;
    fixed?: [number, number];
    move: boolean;
  } | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  useEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const resize = () =>
      setViewport({
        width: Math.max(1, element.clientWidth - 56),
        height: Math.max(1, element.clientHeight - 56),
      });
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => observer.disconnect();
  }, []);
  const [loaded, setLoaded] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number; r: number }>();
  useEffect(() => {
    const handler = () =>
      setError("Apply or cancel your image edits before closing Form Studio.");
    window.addEventListener("artwork-close-request", handler);
    return () => window.removeEventListener("artwork-close-request", handler);
  }, []);
  const live = useRef({ edits, past, future, tool, radius });
  live.current = { edits, past, future, tool, radius };
  const update = (next: ArtworkEdits) => {
    if (JSON.stringify(next) === JSON.stringify(live.current.edits)) return;
    if (!adjustment.current) {
      setPast((p) => [...p.slice(-49), live.current.edits]);
      setFuture([]);
    }
    setEdits(next);
  };
  const processing = edits.processing ?? defaultProcessing();
  const process = (patch: Partial<Processing>) =>
    update({ ...edits, processing: { ...processing, ...patch } });
  const beginAdjustment = () => {
    adjustment.current ??= live.current.edits;
  };
  const endAdjustment = () => {
    const before = adjustment.current;
    adjustment.current = null;
    if (
      !before ||
      JSON.stringify(before) === JSON.stringify(live.current.edits)
    )
      return;
    setPast((p) => [...p.slice(-49), before]);
    setFuture([]);
  };
  const rangeGesture = {
    onPointerDown: beginAdjustment,
    onPointerUp: endAdjustment,
    onPointerCancel: endAdjustment,
    onLostPointerCapture: endAdjustment,
    onBlur: endAdjustment,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
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
        ].includes(e.key)
      )
        beginAdjustment();
    },
    onKeyUp: endAdjustment,
  };
  const undo = () => {
    if (gesture.current || adjustment.current) return;
    const s = live.current;
    if (!s.past.length) return;
    setFuture([s.edits, ...s.future]);
    setEdits(s.past.at(-1)!);
    setPast(s.past.slice(0, -1));
  };
  const redo = () => {
    if (gesture.current || adjustment.current) return;
    const s = live.current;
    if (!s.future.length) return;
    setPast([...s.past, s.edits]);
    setEdits(s.future[0]);
    setFuture(s.future.slice(1));
  };
  useEffect(() => {
    let active = true;
    loadImage(imageSource(asset))
      .then((img) => {
        if (active) {
          image.current = img;
          setLoaded(true);
        }
      })
      .catch(() => setError("This source could not be decoded."));
    return () => {
      active = false;
    };
  }, [asset]);
  useEffect(() => {
    if (!image.current || !canvas.current) return;
    const rendered = renderArtwork(
      image.current,
      original
        ? undefined
        : tool === "crop"
          ? { ...edits, crop: undefined }
          : edits,
    );
    const c = canvas.current;
    c.width = rendered.width;
    c.height = rendered.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(rendered, 0, 0);
    if (tool === "crop" && !original) {
      const r = edits.crop ?? fullCrop(),
        x = r.x * c.width,
        y = r.y * c.height,
        w = r.width * c.width,
        h = r.height * c.height;
      ctx.fillStyle = "#0008";
      ctx.beginPath();
      ctx.rect(0, 0, c.width, c.height);
      ctx.rect(x, y, w, h);
      ctx.fill("evenodd");
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = Math.max(2, c.width / 500);
      ctx.strokeRect(x, y, w, h);
      ctx.lineWidth /= 2;
      for (const f of [1 / 3, 2 / 3]) {
        ctx.beginPath();
        ctx.moveTo(x + w * f, y);
        ctx.lineTo(x + w * f, y + h);
        ctx.moveTo(x, y + h * f);
        ctx.lineTo(x + w, y + h * f);
        ctx.stroke();
      }
      const handle = Math.max(5, c.width / 100);
      ctx.fillStyle = "#fff";
      for (const px of [x, x + w])
        for (const py of [y, y + h])
          ctx.fillRect(px - handle / 2, py - handle / 2, handle, handle);
    }
  }, [edits, original, loaded, tool]);
  useEffect(() => {
    if (!native) return;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    void listen<"undo" | "redo">("editor-history", ({ payload }) => {
      if (gesture.current) return;
      payload === "undo" ? undo() : redo();
    }).then((fn) => {
      if (cancelled) fn();
      else dispose = fn;
    });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);
  const viewCrop = () => {
    if (tool === "crop" || original) return fullCrop();
    const b = artworkBounds(asset.width, asset.height, live.current.edits.crop);
    return {
      x: b.x / asset.width,
      y: b.y / asset.height,
      width: b.width / asset.width,
      height: b.height / asset.height,
    };
  };
  const point = (
    e: React.PointerEvent<HTMLCanvasElement>,
  ): [number, number] => {
    const b = e.currentTarget.getBoundingClientRect();
    const crop = viewCrop();
    return [
      crop.x + clamp((e.clientX - b.left) / b.width, 0, 1) * crop.width,
      crop.y + clamp((e.clientY - b.top) / b.height, 0, 1) * crop.height,
    ];
  };
  const end = () => {
    if (!gesture.current) return;
    const before = gesture.current;
    if (JSON.stringify(before) !== JSON.stringify(live.current.edits)) {
      setPast((p) => [...p.slice(-49), before]);
      setFuture([]);
    }
    gesture.current = null;
    cropDrag.current = null;
  };
  const outputSize = artworkBounds(asset.width, asset.height, edits.crop);
  const displayed = original || tool === "crop" ? asset : outputSize;
  const displayScale =
    Math.min(
      viewport.width / displayed.width,
      viewport.height / displayed.height,
    ) * zoom;
  const displayWidth = displayed.width * displayScale,
    displayHeight = displayed.height * displayScale;
  const crop = edits.crop ?? fullCrop();
  const cropMargins = {
    Left: crop.x,
    Top: crop.y,
    Right: 1 - crop.x - crop.width,
    Bottom: 1 - crop.y - crop.height,
  };
  const setMargin = (side: keyof typeof cropMargins, value: number) => {
    const next = { ...crop };
    if (side === "Left") {
      next.x = Math.min(value, crop.x + crop.width - 0.01);
      next.width = Math.max(0.01, crop.width + crop.x - next.x);
    }
    if (side === "Top") {
      next.y = Math.min(value, crop.y + crop.height - 0.01);
      next.height = Math.max(0.01, crop.height + crop.y - next.y);
    }
    if (side === "Right") next.width = Math.max(0.01, 1 - value - crop.x);
    if (side === "Bottom") next.height = Math.max(0.01, 1 - value - crop.y);
    update({ ...edits, crop: next });
  };
  const count = edits.strokes.reduce((n, s) => n + s.points.length, 0);
  const exportPNG = async () => {
    if (!image.current) return;
    setExporting(true);
    try {
      const c = renderArtwork(image.current, edits, 4096);
      await saveReview(
        c.toDataURL("image/png"),
        asset.name.replace(/\.[^.]+$/, "") + "-clean-artwork",
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="modal-backdrop artwork-backdrop">
      <section
        className="artwork-studio"
        role="dialog"
        aria-modal="true"
        aria-label="Tattoo image studio"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
            e.preventDefault();
            e.stopPropagation();
            if (!gesture.current) e.shiftKey ? redo() : undo();
          }
          if (e.key === "Escape") {
            e.stopPropagation();
            close();
          }
        }}
      >
        <header className="art-studio-header">
          <div>
            <span className="eyebrow">TATTOO IMAGE STUDIO</span>
            <h2>{asset.name}</h2>
          </div>
          <div className="art-actions">
            <button
              onClick={undo}
              disabled={!past.length}
              aria-label="Undo image edit"
            >
              <Undo2 size={17} />
            </button>
            <button
              onClick={redo}
              disabled={!future.length}
              aria-label="Redo image edit"
            >
              <Redo2 size={17} />
            </button>
            <button onClick={close} aria-label="Close image studio">
              <X size={20} />
            </button>
          </div>
        </header>
        <div className="art-studio-body">
          <aside className="art-tools">
            <h3>01 / Crop</h3>
            <button
              className={`wide-button ${tool === "crop" ? "active" : ""}`}
              aria-pressed={tool === "crop"}
              onClick={() => {
                setTool(tool === "crop" ? "erase" : "crop");
                setOriginal(false);
                setCursor(undefined);
              }}
            >
              <Crop size={15} />{" "}
              {tool === "crop" ? "Finish crop" : "Crop image"}
            </button>
            {tool === "crop" && (
              <>
                <p>
                  Drag a corner to resize, or drag inside to move. Drag outside
                  to draw a new crop.
                </p>
                {(Object.keys(cropMargins) as (keyof typeof cropMargins)[]).map(
                  (side) => (
                    <label key={side}>
                      {side} trim{" "}
                      <output>
                        {Number((cropMargins[side] * 100).toFixed(1))}%
                      </output>
                      <input
                        type="range"
                        aria-label={`${side} crop trim`}
                        min="0"
                        max="99"
                        step="0.1"
                        value={Number((cropMargins[side] * 100).toFixed(1))}
                        {...rangeGesture}
                        onChange={(e) => setMargin(side, +e.target.value / 100)}
                      />
                    </label>
                  ),
                )}
                <button
                  className="wide-button"
                  onClick={() => update({ ...edits, crop: undefined })}
                >
                  Reset crop
                </button>
              </>
            )}
            <p>
              {outputSize.width} × {outputSize.height} px · Cropping keeps the
              placed width and center.
            </p>
            <h3>02 / Background</h3>
            <label>
              Remove background
              <select
                aria-label="Background removal"
                value={edits.background}
                onChange={(e) =>
                  update({
                    ...edits,
                    background: e.target.value as ArtworkEdits["background"],
                  })
                }
              >
                <option value="none">Keep original</option>
                <option value="white">White / light paper</option>
                <option value="black">Black background</option>
                <option value="color">Choose a color</option>
              </select>
            </label>
            {edits.background === "color" && (
              <label>
                Background color
                <input
                  type="color"
                  aria-label="Background color"
                  value={edits.color}
                  onChange={(e) => update({ ...edits, color: e.target.value })}
                />
              </label>
            )}
            <label>
              Tolerance <output>{edits.tolerance}</output>
              <input
                aria-label="Background tolerance"
                {...rangeGesture}
                type="range"
                min="0"
                max="180"
                value={edits.tolerance}
                disabled={edits.background === "none"}
                onChange={(e) =>
                  update({ ...edits, tolerance: +e.target.value })
                }
              />
            </label>
            <label>
              Edge softness <output>{edits.feather}</output>
              <input
                aria-label="Edge softness"
                {...rangeGesture}
                type="range"
                min="1"
                max="100"
                value={edits.feather}
                disabled={edits.background === "none"}
                onChange={(e) => update({ ...edits, feather: +e.target.value })}
              />
            </label>
            <p>
              Removes matching colors across the image. Use Restore to recover
              light details.
            </p>
            <h3>03 / Refine</h3>
            <div className="segmented">
              <button
                className={tool === "erase" ? "active" : ""}
                onClick={() => {
                  setTool("erase");
                  setOriginal(false);
                }}
              >
                <Eraser size={14} /> Erase
              </button>
              <button
                className={tool === "restore" ? "active" : ""}
                onClick={() => {
                  setTool("restore");
                  setOriginal(false);
                }}
              >
                <Paintbrush size={14} /> Restore
              </button>
            </div>
            <label>
              Brush diameter <output>{Math.round(radius * 200)}%</output>
              <input
                aria-label="Image brush size"
                type="range"
                min=".002"
                max=".15"
                step=".001"
                value={radius}
                onChange={(e) => setRadius(+e.target.value)}
              />
            </label>
            <p>Paint directly on the image. Each stroke is one undo step.</p>
            <h3>04 / Tone</h3>
            <label className="art-checkbox">
              <input
                type="checkbox"
                checked={edits.grayscale}
                onChange={(e) =>
                  update({ ...edits, grayscale: e.target.checked })
                }
              />{" "}
              Grayscale
            </label>
            <label>
              Contrast <output>{edits.contrast.toFixed(2)}</output>
              <input
                aria-label="Image contrast"
                {...rangeGesture}
                type="range"
                min=".25"
                max="3"
                step=".05"
                value={edits.contrast}
                onChange={(e) =>
                  update({ ...edits, contrast: +e.target.value })
                }
              />
            </label>
            <h3>05 / Ink preparation</h3>
            <label>
              Conversion
              <select
                aria-label="Artwork conversion"
                value={processing.mode}
                onChange={(e) =>
                  process({ mode: e.target.value as Processing["mode"] })
                }
              >
                <option value="original">Original tones</option>
                <option value="stencil">Solid stencil</option>
                <option value="line-art">Contour line art</option>
              </select>
            </label>
            {processing.mode === "stencil" && (
              <>
                <label>
                  Ink threshold <output>{processing.threshold}</output>
                  <input
                    aria-label="Stencil threshold"
                    type="range"
                    min="1"
                    max="254"
                    {...rangeGesture}
                    value={processing.threshold}
                    onChange={(e) => process({ threshold: +e.target.value })}
                  />
                </label>
                <label className="art-checkbox">
                  <input
                    type="checkbox"
                    checked={processing.adaptive}
                    onChange={(e) => process({ adaptive: e.target.checked })}
                  />{" "}
                  Adapt to uneven lighting
                </label>
              </>
            )}
            {processing.mode === "line-art" && (
              <label>
                Contour detail <output>{processing.detail}</output>
                <input
                  aria-label="Contour detail"
                  type="range"
                  min="10"
                  max="200"
                  {...rangeGesture}
                  value={processing.detail}
                  onChange={(e) => process({ detail: +e.target.value })}
                />
              </label>
            )}
            {processing.mode !== "original" && (
              <>
                <label>
                  Noise smoothing <output>{processing.smoothing}</output>
                  <input
                    aria-label="Noise smoothing"
                    type="range"
                    min="0"
                    max="4"
                    {...rangeGesture}
                    value={processing.smoothing}
                    onChange={(e) => process({ smoothing: +e.target.value })}
                  />
                </label>
                <label className="art-checkbox">
                  <input
                    type="checkbox"
                    checked={processing.transparent}
                    onChange={(e) => process({ transparent: e.target.checked })}
                  />{" "}
                  Transparent paper
                </label>
                <p>
                  {processing.mode === "line-art"
                    ? "Extracts visible contours. Increase detail to pick up finer edges."
                    : "Converts dark areas into solid black ink."}{" "}
                  Preview at export size before printing.
                </p>
              </>
            )}
            <label>
              Sharpen <output>{processing.sharpen.toFixed(1)}</output>
              <input
                aria-label="Artwork sharpening"
                type="range"
                min="0"
                max="2"
                step=".1"
                {...rangeGesture}
                value={processing.sharpen}
                onChange={(e) => process({ sharpen: +e.target.value })}
              />
            </label>
            <button
              className="wide-button"
              onClick={() => update(cleanArtwork())}
            >
              Reset all image edits
            </button>
          </aside>
          <div className="art-main">
            <div className="art-canvas-bar">
              <button
                className={original ? "active" : ""}
                onClick={() => setOriginal(!original)}
              >
                <Eye size={15} />
                {original ? "Show edited" : "Compare original"}
              </button>
              <label>
                Zoom{" "}
                <select
                  aria-label="Image zoom"
                  value={zoom}
                  onChange={(e) => setZoom(+e.target.value)}
                >
                  <option value="1">Fit</option>
                  <option value="1.5">150%</option>
                  <option value="2">200%</option>
                  <option value="3">300%</option>
                </select>
              </label>
              <span>{original ? "ORIGINAL" : "TRANSPARENCY PREVIEW"}</span>
            </div>
            <div className="art-canvas-scroll" ref={scroll}>
              <div
                className="art-canvas-fit"
                style={{
                  width: Math.max(viewport.width, displayWidth),
                  height: Math.max(viewport.height, displayHeight),
                }}
              >
                <canvas
                  ref={canvas}
                  aria-label="Artwork cleanup canvas"
                  style={{
                    width: displayWidth,
                    height: displayHeight,
                    maxWidth: "none",
                    maxHeight: "none",
                    aspectRatio:
                      original || tool === "crop"
                        ? `${asset.width}/${asset.height}`
                        : `${outputSize.width}/${outputSize.height}`,
                    cursor: original ? "default" : "crosshair",
                  }}
                  onPointerDown={(e) => {
                    if (original || !loaded || e.button !== 0) return;
                    if (tool === "crop") {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      gesture.current = edits;
                      const start = point(e),
                        r = edits.crop ?? fullCrop(),
                        b = e.currentTarget.getBoundingClientRect();
                      const corners: [number, number][] = [
                        [r.x, r.y],
                        [r.x + r.width, r.y],
                        [r.x, r.y + r.height],
                        [r.x + r.width, r.y + r.height],
                      ];
                      const corner = corners.findIndex(
                        (p) =>
                          Math.hypot(
                            (p[0] - start[0]) * b.width,
                            (p[1] - start[1]) * b.height,
                          ) < 18,
                      );
                      const inside =
                        start[0] > r.x &&
                        start[0] < r.x + r.width &&
                        start[1] > r.y &&
                        start[1] < r.y + r.height;
                      // A full-image frame has nowhere to move: dragging inside starts a fresh crop.
                      cropDrag.current = {
                        start,
                        crop: r,
                        move:
                          corner < 0 &&
                          inside &&
                          (r.width < 0.999 || r.height < 0.999),
                        fixed: corner >= 0 ? corners[3 - corner] : undefined,
                      };
                      return;
                    }
                    if (edits.strokes.length >= 200 || count >= pointBudget) {
                      setError(
                        "Cleanup limit reached. Undo or reset strokes before adding more.",
                      );
                      return;
                    }
                    e.currentTarget.setPointerCapture(e.pointerId);
                    gesture.current = edits;
                    setEdits({
                      ...edits,
                      strokes: [
                        ...edits.strokes,
                        {
                          mode: tool,
                          radius: radius * viewCrop().width,
                          points: [point(e)],
                        },
                      ],
                    });
                  }}
                  onPointerMove={(e) => {
                    const box = e.currentTarget.getBoundingClientRect();
                    setCursor({
                      x: e.clientX,
                      y: e.clientY,
                      r: radius * box.width,
                    });
                    if (!gesture.current) return;
                    const p = point(e);
                    if (cropDrag.current) {
                      const d = cropDrag.current;
                      let next: ArtworkCrop;
                      if (d.move)
                        next = {
                          ...d.crop,
                          x: clamp(
                            d.crop.x + p[0] - d.start[0],
                            0,
                            1 - d.crop.width,
                          ),
                          y: clamp(
                            d.crop.y + p[1] - d.start[1],
                            0,
                            1 - d.crop.height,
                          ),
                        };
                      else {
                        const a = d.fixed ?? d.start;
                        if (
                          Math.abs(p[0] - a[0]) < 0.01 ||
                          Math.abs(p[1] - a[1]) < 0.01
                        )
                          return;
                        next = {
                          x: Math.min(p[0], a[0]),
                          y: Math.min(p[1], a[1]),
                          width: Math.abs(p[0] - a[0]),
                          height: Math.abs(p[1] - a[1]),
                        };
                      }
                      setEdits((current) => ({ ...current, crop: next }));
                      return;
                    }
                    setEdits((current) => {
                      const strokes = [...current.strokes],
                        last = strokes.at(-1)!;
                      if (
                        last.points.length >= 2000 ||
                        current.strokes.reduce(
                          (n, s) => n + s.points.length,
                          0,
                        ) >= pointBudget
                      )
                        return current;
                      const prev = last.points.at(-1)!;
                      if (Math.hypot(p[0] - prev[0], p[1] - prev[1]) < 0.001)
                        return current;
                      strokes[strokes.length - 1] = {
                        ...last,
                        points: [...last.points, p],
                      };
                      return { ...current, strokes };
                    });
                  }}
                  onPointerLeave={() => setCursor(undefined)}
                  onPointerUp={end}
                  onPointerCancel={end}
                  onLostPointerCapture={end}
                />
              </div>
            </div>
            {error && (
              <p className="art-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
        {cursor && !original && tool !== "crop" && (
          <span
            aria-hidden="true"
            className="art-brush-cursor"
            style={{
              left: cursor.x - cursor.r,
              top: cursor.y - cursor.r,
              width: cursor.r * 2,
              height: cursor.r * 2,
            }}
          />
        )}
        <footer className="art-footer">
          <p>
            Original preserved · Apply updates every instance of this source.
            <br />
            <small>
              Transparent PNG export up to 4096 px. Placement previews use up to
              2048 px.
            </small>
          </p>
          <div>
            <button onClick={close}>Cancel</button>
            <button
              onClick={() => void exportPNG()}
              disabled={!loaded || exporting}
            >
              <Download size={15} />
              Export PNG
            </button>
            <button
              className="primary"
              disabled={!loaded}
              onClick={() => apply(edits)}
            >
              <Check size={15} />
              Apply to artwork
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
