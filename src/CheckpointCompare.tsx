import { useDialogReturnFocus } from "./dialog-focus";
import { useEffect, useRef, useState } from "react";
import type { Project } from "./domain";
import { projectPreview } from "./project-preview";
import type { View } from "./scene";
export function CheckpointCompare({
  left,
  right,
  studio,
  close,
}: {
  left: { name: string; project: Project };
  right: { name: string; project: Project };
  studio: "fashion" | "tattoo";
  close: () => void;
}) {
  useDialogReturnFocus();
  const [mode, setMode] = useState<"surface" | "photo" | "pattern">(
      studio === "fashion" ? "pattern" : "surface",
    ),
    [view, setView] = useState<View>("front"),
    [images, setImages] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [swipe, setSwipe] = useState(false),
    [split, setSplit] = useState(50);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    dialog.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus();
  }, []);
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    setBusy(true);
    setError("");
    setImages([]);
    void (async () => {
      try {
        for (const p of [left.project, right.project]) {
          if (cancelled) return;
          const url = await projectPreview(p, mode, view);
          urls.push(url);
          if (cancelled) {
            if (url.startsWith("blob:")) URL.revokeObjectURL(url);
            return;
          }
        }
        setImages([...urls]);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
      urls
        .filter((u) => u.startsWith("blob:"))
        .forEach((u) => URL.revokeObjectURL(u));
    };
  }, [left, right, mode, view]);
  return (
    <div className="modal-backdrop checkpoint-compare">
      <section
        ref={dialog}
        role="dialog"
        tabIndex={-1}
        aria-label="Compare checkpoints"
        aria-modal="true"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            close();
          }
          if (e.key === "Tab") {
            const nodes = [
                ...e.currentTarget.querySelectorAll<HTMLElement>(
                  "button,input,select",
                ),
              ],
              first = nodes[0],
              last = nodes.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header>
          <h2>Compare checkpoints</h2>
          <button onClick={close}>Close comparison</button>
        </header>
        <div className="compare-controls">
          <label>
            View
            <select
              aria-label="Comparison mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
            >
              <option value="surface">3D surface</option>
              <option value="photo">First photograph</option>
              <option value="pattern">Pattern draft</option>
            </select>
          </label>
          {mode === "surface" && (
            <label>
              Angle
              <select
                aria-label="Comparison angle"
                value={view}
                onChange={(e) => setView(e.target.value as View)}
              >
                {["front", "back", "left", "right"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            <input
              type="checkbox"
              checked={swipe}
              onChange={(e) => setSwipe(e.target.checked)}
            />
            Swipe comparison
          </label>
          {swipe && (
            <input
              type="range"
              aria-label="Comparison split"
              min={0}
              max={100}
              value={split}
              onChange={(e) => setSplit(Number(e.target.value))}
            />
          )}
        </div>
        <div className="compare-labels">
          <strong>{left.name}</strong>
          <strong>{right.name}</strong>
        </div>
        {busy && <p role="status">Rendering local checkpoint previews…</p>}
        {error && <p role="alert">{error}</p>}
        <div className={`compare-images ${swipe ? "swipe" : ""}`}>
          {images.map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`${i ? right.name : left.name} preview`}
              style={
                swipe && i === 1
                  ? { clipPath: `inset(0 0 0 ${split}%)` }
                  : undefined
              }
            />
          ))}
        </div>
        <footer>
          Read-only previews. Your current project and checkpoint files remain
          unchanged. Photo mode uses the first photograph in each checkpoint.
        </footer>
      </section>
    </div>
  );
}
