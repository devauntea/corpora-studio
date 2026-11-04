import {useDialogReturnFocus} from "./dialog-focus";
import "./stencil.css";
import { useEffect, useRef, useState } from "react";
import { renderArtworkAsync } from "./artwork";
import { traceInWorker } from "./compute-jobs";
import { imageSource, type Asset, type ArtworkEdits } from "./domain";
import { loadImage, savePattern, saveReview } from "./io";
import {
  calibrationPdf,
  PrinterSchema,
  stencilDimensions,
  stencilPdf,
  stencilPng,
  type PrinterCalibration,
  type StencilSettings,
} from "./stencil-export";
import type { Contour } from "./stencil-trace";
const key = "form-studio-printers-v1";
export function StencilStudio({
  asset,
  edits,
  close,
}: {
  asset: Asset;
  edits: ArtworkEdits;
  close: () => void;
}) {
  useDialogReturnFocus();
  const [lines, setLines] = useState<Contour[]>([]),
    [size, setSize] = useState({ width: 1, height: 1 }),
    [excluded, setExcluded] = useState<number[]>([]),
    [threshold, setThreshold] = useState(128),
    [minimum, setMinimum] = useState(4),
    [progress, setProgress] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [printers, setPrinters] = useState<PrinterCalibration[]>([]);
  const [settings, setSettings] = useState<StencilSettings>({
    width: 100,
    lineWeight: 0.3,
    dpi: 300,
    mirror: false,
    paper: "a4",
    printer: { name: "Uncalibrated printer", measuredX: 50, measuredY: 50 },
  });
  const job = useRef<AbortController | null>(null),
    dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    try {
      setPrinters(
        PrinterSchema.array()
          .max(30)
          .parse(JSON.parse(localStorage.getItem(key) ?? "[]")),
      );
    } catch {
      setError("Stored printer calibration could not be read.");
    }
    return () => job.current?.abort();
  }, []);
  const trace = async () => {
    job.current?.abort();
    const controller = new AbortController();
    job.current = controller;
    setBusy(true);
    setError("");
    setProgress(0);
    try {
      const image = await loadImage(imageSource(asset)),
        c = await renderArtworkAsync(image, edits, 1024, {
          signal: controller.signal,
          progress: (v) => setProgress(v * 0.2),
        });
      const contours = await traceInWorker(
        {
          pixels: c.getContext("2d")!.getImageData(0, 0, c.width, c.height)
            .data,
          width: c.width,
          height: c.height,
          threshold,
        },
        {
          signal: controller.signal,
          progress: (v) => setProgress(0.2 + v * 0.8),
        },
      );
      setSize({ width: c.width, height: c.height });
      setLines(contours);
      setExcluded([]);
      if (!contours.length)
        setError(
          "No dark lines found. Adjust threshold or prepare line art in the image studio.",
        );
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(String(e));
    } finally {
      if (job.current === controller) setBusy(false);
    }
  };
  const selected = lines.filter(
    (l) => l.length >= minimum && !excluded.includes(l.id),
  );
  const exportFile = async (format: "png" | "pdf") => {
    setBusy(true);
    setError("");
    try {
      if (format === "png")
        await saveReview(
          stencilPng(selected, size.width, size.height, settings),
          asset.name + "-stencil",
        );
      else
        await savePattern(
          await stencilPdf(selected, size.width, size.height, settings),
          asset.name + "-stencil",
          "pdf",
        );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const field = (
    label: string,
    value: number,
    min: number,
    max: number,
    change: (v: number) => void,
    step = 0.1,
  ) => (
    <label>
      {label}
      <input
        aria-label={label}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v) && v >= min && v <= max) change(v);
        }}
      />
    </label>
  );
  return (
    <div className="modal-backdrop stencil-backdrop">
      <section
        ref={dialog}
        className="stencil-studio"
        role="dialog"
        aria-modal="true"
        aria-label="Calibrated stencil studio"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            close();
          }
          if (e.key === "Tab") {
            const nodes = [
                ...e.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not(:disabled),input:not(:disabled),select:not(:disabled)",
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
          <div>
            <span className="eyebrow">PRINT / ACTUAL SIZE</span>
            <h2>Stencil studio</h2>
          </div>
          <button onClick={close} aria-label="Close stencil studio">
            Close
          </button>
        </header>
        <div className="stencil-body">
          <aside>
            <h3>1 / Select the lines</h3>
            <p>
              Trace the prepared artwork, then click lines to exclude them.
              Original pixels stay unchanged.
            </p>
            {field("Tracing threshold", threshold, 1, 254, setThreshold, 1)}
            <button onClick={() => void trace()} disabled={busy}>
              Trace artwork
            </button>
            {busy && (
              <>
                <progress
                  value={progress}
                  max={1}
                  aria-label="Local stencil job"
                />
                <button onClick={() => job.current?.abort()}>Cancel job</button>
              </>
            )}
            {field(
              "Minimum contour length (px)",
              minimum,
              2,
              200,
              setMinimum,
              1,
            )}
            <div className="fashion-presets">
              <button onClick={() => setExcluded([])}>Select all lines</button>
              <button onClick={() => setExcluded(lines.map((l) => l.id))}>
                Clear line selection
              </button>
            </div>
            <label>
              Toggle contour by number
              <input
                aria-label="Toggle contour number"
                type="number"
                min={1}
                max={lines.length}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const id = Number(e.currentTarget.value) - 1;
                    if (id >= 0 && id < lines.length)
                      setExcluded((x) =>
                        x.includes(id) ? x.filter((v) => v !== id) : [...x, id],
                      );
                  }
                }}
              />
            </label>
            <h3>2 / Physical output</h3>
            {field("Stencil width (mm)", settings.width, 10, 600, (v) =>
              setSettings({ ...settings, width: v }),
            )}
            {field(
              "Line weight (mm)",
              settings.lineWeight,
              0.05,
              2,
              (v) => setSettings({ ...settings, lineWeight: v }),
              0.05,
            )}
            <label>
              PNG resolution
              <select
                aria-label="Stencil DPI"
                value={settings.dpi}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    dpi: Number(e.target.value) as StencilSettings["dpi"],
                  })
                }
              >
                {[150, 300, 600].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              PDF paper
              <select
                aria-label="Stencil paper"
                value={settings.paper}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    paper: e.target.value as "a4" | "letter",
                  })
                }
              >
                <option value="a4">A4</option>
                <option value="letter">US Letter</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.mirror}
                onChange={(e) =>
                  setSettings({ ...settings, mirror: e.target.checked })
                }
              />
              Mirror for transfer
            </label>
            <h3>3 / Printer calibration</h3>
            <p>
              Print the uncorrected sheet at 100%, then measure both sides of
              its square. Recalibrate after changing printer settings.
            </p>
            <button
              onClick={async () => {
                try {
                  await savePattern(
                    await calibrationPdf(settings.paper),
                    "Printer calibration",
                    "pdf",
                  );
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              Export calibration sheet
            </button>
            {printers.length > 0 && (
              <label>
                Saved printer
                <select
                  aria-label="Saved printer"
                  value=""
                  onChange={(e) => {
                    const p = printers.find((p) => p.name === e.target.value);
                    if (p) setSettings({ ...settings, printer: p });
                  }}
                >
                  <option value="">Choose…</option>
                  {printers.map((p) => (
                    <option key={p.name}>{p.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Printer name
              <input
                aria-label="Printer name"
                maxLength={80}
                value={settings.printer.name}
                onChange={(e) =>
                  e.target.value &&
                  setSettings({
                    ...settings,
                    printer: { ...settings.printer, name: e.target.value },
                  })
                }
              />
            </label>
            {field(
              "Measured square width (mm)",
              settings.printer.measuredX,
              40,
              60,
              (v) =>
                setSettings({
                  ...settings,
                  printer: { ...settings.printer, measuredX: v },
                }),
            )}
            {field(
              "Measured square height (mm)",
              settings.printer.measuredY,
              40,
              60,
              (v) =>
                setSettings({
                  ...settings,
                  printer: { ...settings.printer, measuredY: v },
                }),
            )}
            <button
              onClick={() => {
                try {
                  const next = [
                    ...printers.filter((p) => p.name !== settings.printer.name),
                    PrinterSchema.parse(settings.printer),
                  ];
                  if (next.length > 30)
                    throw new Error("Up to 30 printers can be stored.");
                  localStorage.setItem(key, JSON.stringify(next));
                  setPrinters(next);
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              Save printer calibration
            </button>
          </aside>
          <div className="stencil-preview">
            <div className="stencil-status">
              {selected.length} / {lines.length} contours selected ·{" "}
              {settings.width} mm wide · {settings.lineWeight} mm lines
            </div>
            <svg
              viewBox={`-5 -5 ${size.width + 10} ${size.height + 10}`}
              aria-label="Stencil contour preview"
              role="img"
            >
              {lines
                .filter((l) => l.length >= minimum)
                .map((l) => (
                  <g
                    key={l.id}
                    onClick={() =>
                      setExcluded((x) =>
                        x.includes(l.id)
                          ? x.filter((v) => v !== l.id)
                          : [...x, l.id],
                      )
                    }
                  >
                    <path
                      d={l.points
                        .map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`)
                        .join(" ")}
                      fill="none"
                      stroke={excluded.includes(l.id) ? "#ccc" : "#111"}
                      strokeWidth={
                        (settings.lineWeight * size.width) / settings.width
                      }
                      strokeLinecap="round"
                    />
                    <path
                      d={l.points
                        .map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`)
                        .join(" ")}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="8"
                    >
                      <title>
                        Contour {l.id + 1}:{" "}
                        {excluded.includes(l.id) ? "excluded" : "selected"}
                      </title>
                    </path>
                  </g>
                ))}
            </svg>
            {!lines.length && (
              <p>Trace artwork to choose your stencil contours.</p>
            )}
            {error && <p role="alert">{error}</p>}
          </div>
        </div>
        <footer>
          <p>
            White paper · actual-size output · correction{" "}
            {stencilDimensions(size.width, size.height, settings).sx.toFixed(4)}{" "}
            ×{" "}
            {stencilDimensions(size.width, size.height, settings).sy.toFixed(4)}
            . Verify a test print with a ruler before use.
          </p>
          <button
            disabled={busy || !selected.length}
            onClick={() => void exportFile("png")}
          >
            Export stencil PNG
          </button>
          <button
            disabled={busy || !selected.length}
            onClick={() => void exportFile("pdf")}
          >
            Export stencil PDF
          </button>
        </footer>
      </section>
    </div>
  );
}
