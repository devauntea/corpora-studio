import { useDialogReturnFocus } from "./dialog-focus";
import { PointInputs } from "./PointInputs";
import { useEffect, useRef, useState } from "react";
import {
  calibratedDistance,
  studyCsv,
  type GarmentStudy,
} from "./garment-measure";
import { imageSource, type Asset } from "./domain";
import {
  measurementFields,
  MeasurementsSchema,
  type Fashion,
  type MeasurementKey,
} from "./fashion-model";
import { assetFromFile, saveTextFile } from "./io";
import "./stencil.css";
export function GarmentPhotoStudio({
  value,
  assets,
  change,
  close,
}: {
  value: Fashion;
  assets: Asset[];
  change: (f: Fashion, a?: Asset) => void;
  close: () => void;
}) {
  useDialogReturnFocus();
  const [mode, setMode] = useState<"card" | "line">("card"),
    [pending, setPending] = useState<[number, number] | null>(null),
    [error, setError] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const [keyboardPoint, setKeyboardPoint] = useState<[number, number]>([
    0.5, 0.5,
  ]);
  const input = useRef<HTMLInputElement>(null),
    svg = useRef<SVGSVGElement>(null),
    dialog = useRef<HTMLElement>(null);
  const study = value.photoStudy,
    asset = assets.find((a) => a.id === study?.assetId);
  useEffect(() => {
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, []);
  const update = (patch: Partial<GarmentStudy>) =>
    study && change({ ...value, photoStudy: { ...study, ...patch } });
  const placePoint = (q: [number, number]) => {
    if (!study) return;
    if (mode === "card" && study.corners.length < 4) {
      update({ corners: [...study.corners, q] });
      if (study.corners.length === 3) setMode("line");
    } else if (mode === "line" && study.lines.length < 32) {
      if (!pending) setPending(q);
      else {
        update({
          lines: [
            ...study.lines,
            {
              id: crypto.randomUUID(),
              name: `Measurement ${study.lines.length + 1}`,
              points: [pending, q],
              target: "",
              multiplier: 1,
              ease: 0,
            },
          ],
        });
        setPending(null);
      }
    }
  };
  const result = (line: NonNullable<typeof study>["lines"][number]) => {
    try {
      return {
        value: calibratedDistance(
          study!,
          line.points,
          asset!.width,
          asset!.height,
        ),
        error: "",
      };
    } catch (e) {
      return { value: 0, error: String(e) };
    }
  };
  return (
    <div className="modal-backdrop stencil-backdrop">
      <section
        className="stencil-studio garment-photo"
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Photo garment measurements"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            close();
          }
          if (e.key === "Tab") {
            const ns = [
                ...e.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
                ),
              ].filter((n) => n.getClientRects().length > 0),
              first = ns[0],
              last = ns.at(-1);
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
            <span className="eyebrow">FLAT-LAY / CALIBRATED MEASUREMENTS</span>
            <h2>Measure a garment photograph</h2>
          </div>
          <button onClick={close}>Close garment photo</button>
        </header>
        <div className="stencil-body">
          <aside>
            <h3>Capture guidance</h3>
            <p>
              Lay one garment flat and smooth. Photograph from overhead with a
              rectangular reference on the same plane. Enter its measured width
              and height. Avoid wrinkles, shadows and a tilted camera.
            </p>
            <input
              ref={input}
              type="file"
              hidden
              accept="image/png,image/jpeg,.heic"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  const a = await assetFromFile(file);
                  change(
                    {
                      ...value,
                      photoStudy: {
                        assetId: a.id,
                        referenceWidth: 85.6,
                        referenceHeight: 53.98,
                        corners: [],
                        lines: [],
                        assumptions:
                          "One visible layer. Hidden back, darts, facings and seam allowances are unknown.",
                      },
                    },
                    { ...a, role: "garment" },
                  );
                  setMode("card");
                  setPending(null);
                } catch (e) {
                  setError(String(e));
                }
              }}
            />
            <button onClick={() => input.current?.click()}>
              Import flat-lay photograph
            </button>
            {study && (
              <>
                <label>
                  Reference width (mm)
                  <input
                    aria-label="Reference width (mm)"
                    type="number"
                    min={10}
                    max={500}
                    value={study.referenceWidth}
                    onChange={(e) => {
                      const v = +e.target.value;
                      if (v >= 10 && v <= 500) update({ referenceWidth: v });
                    }}
                  />
                </label>
                <label>
                  Reference height (mm)
                  <input
                    aria-label="Reference height (mm)"
                    type="number"
                    min={10}
                    max={500}
                    value={study.referenceHeight}
                    onChange={(e) => {
                      const v = +e.target.value;
                      if (v >= 10 && v <= 500) update({ referenceHeight: v });
                    }}
                  />
                </label>
                <button
                  aria-pressed={mode === "card"}
                  onClick={() => {
                    update({ corners: [] });
                    setMode("card");
                    setPending(null);
                  }}
                >
                  Mark reference corners again
                </button>
                <p>
                  Click top-left, top-right, bottom-right, bottom-left.{" "}
                  {study.corners.length}/4 corners marked.
                </p>
                <button
                  disabled={
                    study.corners.length !== 4 || study.lines.length >= 32
                  }
                  aria-pressed={mode === "line"}
                  onClick={() => {
                    setMode("line");
                    setPending(null);
                  }}
                >
                  Add measurement endpoints
                </button>
                <p>
                  {pending
                    ? "Click the second endpoint."
                    : "Click two garment points to measure."}
                </p>
                <details>
                  <summary>Keyboard point placement</summary>
                  <PointInputs
                    label="New photo point"
                    point={keyboardPoint}
                    change={setKeyboardPoint}
                  />
                  <button
                    disabled={
                      (mode === "card" && study.corners.length >= 4) ||
                      (mode === "line" && study.lines.length >= 32)
                    }
                    onClick={() => placePoint(keyboardPoint)}
                  >
                    Place entered point
                  </button>
                </details>
                <details>
                  <summary>Adjust reference corners</summary>
                  {study.corners.map((q, i) => (
                    <PointInputs
                      key={i}
                      label={`Reference corner ${i + 1}`}
                      point={q}
                      change={(q) =>
                        update({
                          corners: study.corners.map((p, j) =>
                            i === j ? q : p,
                          ),
                        })
                      }
                    />
                  ))}
                </details>
                <label>
                  Visible / hidden assumptions
                  <textarea
                    aria-label="Garment photo assumptions"
                    maxLength={1500}
                    value={study.assumptions}
                    onChange={(e) => update({ assumptions: e.target.value })}
                  />
                </label>
                <p>
                  Photo values describe the garment, not the body. Circumference
                  estimates need a multiplier and a deliberate ease adjustment.
                </p>
                <label>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  I accounted for ease, thickness and hidden layers
                </label>
                <button
                  disabled={!confirmed || !study.lines.length}
                  onClick={() => {
                    try {
                      const m = { ...value.measurements };
                      let count = 0;
                      for (const l of study.lines) {
                        if (!l.target) continue;
                        const field = measurementFields.find(
                          (f) => f[0] === l.target,
                        );
                        if (!field)
                          throw new Error("Unknown target measurement.");
                        const r = result(l);
                        if (r.error) throw new Error(r.error);
                        const v = r.value * l.multiplier - l.ease;
                        if (v < field[2] || v > field[3])
                          throw new Error(
                            `${field[1]} is outside the supported range after ease adjustment.`,
                          );
                        m[l.target as MeasurementKey] = Math.round(v * 10) / 10;
                        count++;
                      }
                      if (!count)
                        throw new Error(
                          "Choose a target measurement for at least one line.",
                        );
                      MeasurementsSchema.parse(m);
                      change({ ...value, measurements: m });
                      setError(
                        `${count} draft inputs updated. Verify with a tape before cutting.`,
                      );
                    } catch (e) {
                      setError(String(e));
                    }
                  }}
                >
                  Apply selected draft inputs
                </button>
                <button
                  onClick={async () => {
                    try {
                      await saveTextFile(
                        studyCsv(study, asset!.width, asset!.height),
                        "Photo measurement benchmark",
                        "csv",
                      );
                    } catch (e) {
                      setError(String(e));
                    }
                  }}
                >
                  Export measurements / error CSV
                </button>
              </>
            )}
          </aside>
          <div className="stencil-preview">
            <svg
              ref={svg}
              role="img"
              aria-label="Calibrated garment photo"
              viewBox={`0 0 ${asset?.width ?? 1000} ${asset?.height ?? 800}`}
              onClick={(e) => {
                if (!asset || !study || !svg.current) return;
                const t = svg.current.getScreenCTM();
                if (!t) return;
                const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
                    t.inverse(),
                  ),
                  q: [number, number] = [
                    Math.min(1, Math.max(0, p.x / asset.width)),
                    Math.min(1, Math.max(0, p.y / asset.height)),
                  ];
                placePoint(q);
              }}
            >
              {asset && (
                <image
                  href={imageSource(asset)}
                  width={asset.width}
                  height={asset.height}
                />
              )}
              {asset &&
                study?.corners.map(([x, y], i) => (
                  <g key={i}>
                    <circle
                      cx={x * asset.width}
                      cy={y * asset.height}
                      r={asset.width / 150}
                      fill="white"
                      stroke="#111"
                      strokeWidth={asset.width / 600}
                    />
                    <text
                      x={x * asset.width + asset.width / 80}
                      y={y * asset.height}
                      fill="white"
                      stroke="#111"
                      strokeWidth={0.5}
                      fontSize={asset.width / 40}
                    >
                      {i + 1}
                    </text>
                  </g>
                ))}
              {asset &&
                study?.lines.map((l) => (
                  <g key={l.id}>
                    <line
                      x1={l.points[0][0] * asset.width}
                      y1={l.points[0][1] * asset.height}
                      x2={l.points[1][0] * asset.width}
                      y2={l.points[1][1] * asset.height}
                      stroke="#fff"
                      strokeWidth={asset.width / 300}
                    />
                    {l.points.map(([x, y], i) => (
                      <circle
                        key={i}
                        cx={x * asset.width}
                        cy={y * asset.height}
                        r={asset.width / 180}
                        fill="#111"
                        stroke="white"
                        strokeWidth={asset.width / 600}
                      />
                    ))}
                  </g>
                ))}
            </svg>
            <div className="photo-measurements">
              {study?.lines.map((l) => {
                const r = result(l),
                  edit = (patch: Partial<typeof l>) =>
                    update({
                      lines: study.lines.map((x) =>
                        x.id === l.id ? { ...l, ...patch } : x,
                      ),
                    });
                return (
                  <div key={l.id}>
                    <input
                      aria-label={`${l.name} name`}
                      value={l.name}
                      maxLength={80}
                      onChange={(e) =>
                        e.target.value && edit({ name: e.target.value })
                      }
                    />
                    <details>
                      <summary>Adjust endpoints</summary>
                      {l.points.map((q, i) => (
                        <PointInputs
                          key={i}
                          label={`${l.name} endpoint ${i + 1}`}
                          point={q}
                          change={(q) =>
                            edit({
                              points: l.points.map((p, j) =>
                                i === j ? q : p,
                              ) as typeof l.points,
                            })
                          }
                        />
                      ))}
                    </details>
                    <strong>
                      {r.error ? "Check reference" : r.value.toFixed(1) + " mm"}
                    </strong>
                    <select
                      aria-label={`${l.name} target`}
                      value={l.target}
                      onChange={(e) => edit({ target: e.target.value })}
                    >
                      <option value="">Reference only</option>
                      {measurementFields
                        .filter((f) => f[0] !== "shoulderSlope")
                        .map((f) => (
                          <option key={f[0]} value={f[0]}>
                            {f[1]}
                          </option>
                        ))}
                    </select>
                    <label>
                      ×
                      <input
                        aria-label={`${l.name} multiplier`}
                        type="number"
                        min={0.1}
                        max={4}
                        step={0.1}
                        value={l.multiplier}
                        onChange={(e) => {
                          const v = +e.target.value;
                          if (v >= 0.1 && v <= 4) edit({ multiplier: v });
                        }}
                      />
                    </label>
                    <label>
                      − ease mm
                      <input
                        aria-label={`${l.name} ease`}
                        type="number"
                        min={-300}
                        max={500}
                        value={l.ease}
                        onChange={(e) => {
                          const v = +e.target.value;
                          if (v >= -300 && v <= 500) edit({ ease: v });
                        }}
                      />
                    </label>
                    <label>
                      Tape mm
                      <input
                        aria-label={`${l.name} tape benchmark`}
                        type="number"
                        min={0}
                        max={3000}
                        value={l.tape ?? ""}
                        onChange={(e) => {
                          const v = +e.target.value;
                          if (v >= 0 && v <= 3000)
                            edit({ tape: e.target.value ? v : undefined });
                        }}
                      />
                    </label>
                    <button
                      onClick={() =>
                        update({
                          lines: study.lines.filter((x) => x.id !== l.id),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
            {error && <p role="status">{error}</p>}
          </div>
        </div>
        <footer>
          <p>
            Perspective-calibrated planar measurements. Curvature, wrinkles and
            hidden construction are not reconstructed. Compare with real tape
            measurements.
          </p>
        </footer>
      </section>
    </div>
  );
}
