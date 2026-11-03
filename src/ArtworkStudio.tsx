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
} from "lucide-react";
import {
  cleanArtwork,
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
  const [tool, setTool] = useState<"erase" | "restore">("erase"),
    [radius, setRadius] = useState(0.025),
    [original, setOriginal] = useState(false);
  const [zoom, setZoom] = useState(1),
    [error, setError] = useState(""),
    [exporting, setExporting] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null),
    image = useRef<HTMLImageElement | null>(null),
    gesture = useRef<ArtworkEdits | null>(null);
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
    setPast((p) => [...p.slice(-49), live.current.edits]);
    setFuture([]);
    setEdits(next);
  };
  const undo = () => {
    const s = live.current;
    if (!s.past.length) return;
    setFuture([s.edits, ...s.future]);
    setEdits(s.past.at(-1)!);
    setPast(s.past.slice(0, -1));
  };
  const redo = () => {
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
    const rendered = renderArtwork(image.current, original ? undefined : edits);
    canvas.current.width = rendered.width;
    canvas.current.height = rendered.height;
    canvas.current.getContext("2d")!.drawImage(rendered, 0, 0);
  }, [edits, original, loaded]);
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
  const point = (
    e: React.PointerEvent<HTMLCanvasElement>,
  ): [number, number] => {
    const b = e.currentTarget.getBoundingClientRect();
    return [
      clamp((e.clientX - b.left) / b.width, 0, 1),
      clamp((e.clientY - b.top) / b.height, 0, 1),
    ];
  };
  const end = () => {
    if (!gesture.current) return;
    const before = gesture.current;
    setPast((p) => [...p.slice(-49), before]);
    setFuture([]);
    gesture.current = null;
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
            <h3>01 / Background</h3>
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
            <h3>02 / Refine</h3>
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
            <h3>03 / Tone</h3>
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
            <div className="art-canvas-scroll">
              <div
                className="art-canvas-fit"
                style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
              >
                <canvas
                  ref={canvas}
                  aria-label="Artwork cleanup canvas"
                  style={{
                    aspectRatio: `${asset.width}/${asset.height}`,
                    cursor: original ? "default" : "crosshair",
                  }}
                  onPointerDown={(e) => {
                    if (original || !loaded || e.button !== 0) return;
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
                        { mode: tool, radius, points: [point(e)] },
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
        {cursor && !original && (
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
