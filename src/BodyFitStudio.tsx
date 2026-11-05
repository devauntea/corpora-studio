import { useDialogReturnFocus } from "./dialog-focus";
import { useEffect, useRef, useState } from "react";
import {
  BodyStudySchema,
  landmarkKeys,
  photoFitTargets,
  type BodyStudy,
  type Landmark,
} from "./body-fitting";
import { loadHuman } from "./anatomy";
import { fitBodyInWorker } from "./compute-jobs";
import {
  humanBody,
  imageSource,
  type Asset,
  type Project,
  type HumanBody,
} from "./domain";
import { assetFromFile, saveTextFile } from "./io";
import "./stencil.css";
const labels: Record<Landmark, string> = {
  top: "Top of head",
  floor: "Floor at feet",
  neck: "Under jaw / top of neck",
  chestLeft: "Chest left edge",
  chestRight: "Chest right edge",
  waistLeft: "Waist left edge",
  waistRight: "Waist right edge",
  hipsLeft: "Seat left edge",
  hipsRight: "Seat right edge",
};
export function BodyFitStudio({
  project,
  change,
  close,
}: {
  project: Project;
  change: (study: BodyStudy, asset?: Asset, body?: HumanBody) => void;
  close: () => void;
}) {
  useDialogReturnFocus();
  const [view, setView] = useState<"front" | "side">("front"),
    [landmark, setLandmark] = useState<Landmark>("top"),
    [message, setMessage] = useState(""),
    [progress, setProgress] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null),
    dialog = useRef<HTMLElement>(null),
    svg = useRef<SVGSVGElement>(null),
    input = useRef<HTMLInputElement>(null);
  const study = project.bodyStudy ?? {
      height: 1750,
      views: [],
      tape: {},
      notes: "",
    },
    photo = study.views.find((p) => p.view === view),
    asset = project.assets.find((a) => a.id === photo?.assetId),
    selectedPoint = photo?.points[landmark];
  const body = humanBody("full-body", project.body),
    sex = body.model!.sex;
  useEffect(() => {
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => controller.current?.abort();
  }, []);
  const update = (patch: Partial<BodyStudy>) => {
    controller.current?.abort();
    change({ ...study, ...patch, result: undefined });
  };
  const point = (q: [number, number]) => {
    if (photo)
      update({
        views: study.views.map((p) =>
          p === photo ? { ...p, points: { ...p.points, [landmark]: q } } : p,
        ),
      });
  };
  const fit = async () => {
    controller.current?.abort();
    const c = (controller.current = new AbortController());
    setProgress(0);
    setMessage("");
    try {
      BodyStudySchema.parse(study);
      const target = photoFitTargets(
          study,
          project.assets,
          sex,
          body.model!.revision === 5 ? 5 : 4,
        ),
        data = await loadHuman(body);
      if (c.signal.aborted) return;
      const vertices = new Float32Array(data.vertices.length * 3);
      data.vertices.forEach((v, i) => {
        for (let k = 0; k < 3; k++)
          vertices[i * 3 + k] = v[k] + v[k + 3] * body.muscularity;
      });
      const result = await fitBodyInWorker(
        {
          ...target,
          vertices,
          armGates: Float32Array.from(
            data.vertices,
            (v) => 1 - Math.min(1, Math.max(v[6], v[9]) * 2),
          ),
          indices: new Uint32Array(
            [data.parts[0], data.parts[3], data.parts[4]].flat(),
          ),
        },
        { signal: c.signal, progress: setProgress },
      );
      change({
        ...study,
        result: {
          ...result,
          length: target.length,
          sex,
          muscularity: body.muscularity,
          modelRevision: body.model!.revision === 5 ? 5 : 4,
        },
      });
      setMessage("Fit computed. Review the residuals before applying.");
    } catch (e) {
      setMessage(
        (e as Error).name === "AbortError" ? "Fit cancelled." : String(e),
      );
    } finally {
      if (controller.current === c) setProgress(null);
    }
  };
  return (
    <div className="modal-backdrop stencil-backdrop">
      <section
        ref={dialog}
        className="stencil-studio body-fit"
        role="dialog"
        aria-modal="true"
        aria-label="Personal body fitting"
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
            <span className="eyebrow">LOCAL / PHOTO + TAPE FITTING</span>
            <h2>Fit a personal body study</h2>
          </div>
          <button onClick={close}>Close body fitting</button>
        </header>
        <div className="stencil-body">
          <aside>
            <p>
              Use front and side photographs from waist-height, several meters
              away. Stand upright, arms clear of the torso, with head and feet
              visible. Use fitted clothing. Mark the same chest, natural waist
              and fullest seat levels in both views.
            </p>
            <p>
              This adult body fit adjusts torso width and depth around three
              levels. Tape estimates use a closed, taut cross-section. It does
              not reconstruct a scan or infer unseen anatomy.
            </p>
            <label>
              Standing height (mm)
              <input
                aria-label="Standing height (mm)"
                type="number"
                min={1000}
                max={2300}
                value={study.height}
                onChange={(e) => {
                  const v = +e.target.value;
                  if (v >= 1000 && v <= 2300) update({ height: v });
                }}
              />
            </label>
            <label>
              Photograph view
              <select
                aria-label="Fitting photograph view"
                value={view}
                onChange={(e) => {
                  setView(e.target.value as typeof view);
                  setLandmark("top");
                }}
              >
                <option value="front">Front</option>
                <option value="side">Side</option>
              </select>
            </label>
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
                  controller.current?.abort();
                  const a = await assetFromFile(file);
                  change(
                    {
                      ...study,
                      views: [
                        ...study.views.filter((p) => p.view !== view),
                        { assetId: a.id, view, points: {} },
                      ],
                      result: undefined,
                    },
                    { ...a, role: "body" },
                  );
                  setLandmark("top");
                } catch (e) {
                  setMessage(String(e));
                }
              }}
            />
            <button onClick={() => input.current?.click()}>
              Import {view} fitting photo
            </button>
            <label>
              Landmark
              <select
                aria-label="Fitting landmark"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value as Landmark)}
              >
                {landmarkKeys.map((k) => (
                  <option key={k} value={k}>
                    {photo?.points[k] ? "✓ " : ""}
                    {labels[k]}
                  </option>
                ))}
              </select>
            </label>
            <p>
              Click the point on the photograph. Select an existing landmark to
              adjust it. On the side view, left/right mean the two visible
              silhouette edges.
            </p>
            <div className="field-grid">
              {[0, 1].map((axis) => (
                <label key={axis}>
                  {axis ? "Y" : "X"} %
                  <input
                    aria-label={`Fitting landmark ${axis ? "Y" : "X"} percent`}
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    disabled={!asset}
                    value={
                      selectedPoint
                        ? +(selectedPoint[axis] * 100).toFixed(2)
                        : ""
                    }
                    onChange={(e) => {
                      const v = +e.target.value;
                      if (v >= 0 && v <= 100) {
                        const p: [number, number] = selectedPoint
                          ? [...selectedPoint]
                          : [0.5, 0.5];
                        p[axis] = v / 100;
                        point(p);
                      }
                    }}
                  />
                </label>
              ))}
            </div>
            <h3>Optional tape measurements</h3>
            {(["chest", "waist", "hips"] as const).map((k) => (
              <label key={k}>
                {k === "hips" ? "Full seat" : k} circumference (mm)
                <input
                  aria-label={`Fitting ${k} tape (mm)`}
                  type="number"
                  value={study.tape[k] ?? ""}
                  onChange={(e) => {
                    const v = +e.target.value;
                    if (!e.target.value || (v >= 400 && v <= 1900))
                      update({
                        tape: {
                          ...study.tape,
                          [k]: e.target.value ? v : undefined,
                        },
                      });
                  }}
                />
              </label>
            ))}
            <label>
              Capture notes
              <textarea
                aria-label="Body fitting notes"
                value={study.notes}
                maxLength={1500}
                onChange={(e) => update({ notes: e.target.value })}
              />
            </label>
            <button disabled={progress !== null} onClick={() => void fit()}>
              Optimize body fit locally
            </button>
            {progress !== null && (
              <>
                <progress value={progress} max={1} />
                <button onClick={() => controller.current?.abort()}>
                  Cancel body fit
                </button>
              </>
            )}
          </aside>
          <div className="stencil-preview">
            <svg
              ref={svg}
              viewBox={`0 0 ${asset?.width ?? 600} ${asset?.height ?? 900}`}
              role="img"
              aria-label="Body fitting landmarks"
              onClick={(e) => {
                if (!asset || !svg.current) return;
                const m = svg.current.getScreenCTM();
                if (!m) return;
                const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
                  m.inverse(),
                );
                point([
                  Math.max(0, Math.min(1, p.x / asset.width)),
                  Math.max(0, Math.min(1, p.y / asset.height)),
                ]);
                const index = landmarkKeys.indexOf(landmark);
                if (index < landmarkKeys.length - 1)
                  setLandmark(landmarkKeys[index + 1]);
              }}
            >
              {asset && (
                <image
                  href={imageSource(asset)}
                  width={asset.width}
                  height={asset.height}
                />
              )}{" "}
              {asset &&
                photo &&
                landmarkKeys.map((k) => {
                  const p = photo.points[k];
                  return (
                    p && (
                      <g key={k}>
                        <circle
                          cx={p[0] * asset.width}
                          cy={p[1] * asset.height}
                          r={asset.width / 90}
                          fill={k === landmark ? "#f8ca55" : "white"}
                          stroke="#111"
                          strokeWidth={asset.width / 300}
                        />
                        <text
                          x={p[0] * asset.width + asset.width / 55}
                          y={p[1] * asset.height}
                          fill="#111"
                          stroke="white"
                          strokeWidth={asset.width / 650}
                          paintOrder="stroke"
                          fontSize={asset.width / 35}
                        >
                          {labels[k]}
                        </text>
                      </g>
                    )
                  );
                })}
            </svg>
            {message && <p role="status">{message}</p>}
            {study.result && (
              <div className="fit-results">
                <h3>Fit residuals · {study.result.sex} surface</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Input</th>
                      <th>Target mm</th>
                      <th>Model mm</th>
                      <th>Error mm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {study.result.residuals.map((r) => (
                      <tr key={r.label}>
                        <th>{r.label}</th>
                        <td>{r.target.toFixed(1)}</td>
                        <td>{r.predicted.toFixed(1)}</td>
                        <td>{r.error.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p>
                  Missing tape inputs:{" "}
                  {(["chest", "waist", "hips"] as const)
                    .filter((k) => study.tape[k] === undefined)
                    .join(", ") || "none"}
                  . Photo perspective and landmark error are not included in
                  these residuals.
                </p>
                <button
                  onClick={() => {
                    const r = study.result!;
                    change(study, undefined, {
                      ...humanBody("full-body"),
                      length: r.length,
                      muscularity: r.muscularity,
                      fitting: r.shape,
                      model: {
                        revision: r.modelRevision ?? 4,
                        sex: r.sex,
                        physique: r.muscularity > 0.5 ? "fit" : "average",
                        anatomyOpacity: 0.85,
                      },
                    });
                    setMessage(
                      "Personal fit applied to the 3D body. Review it from all angles.",
                    );
                  }}
                >
                  Apply fitted body
                </button>
                <button
                  onClick={() => {
                    void saveTextFile(
                      "measurement,target_mm,model_mm,error_mm\n" +
                        study
                          .result!.residuals.map(
                            (r) =>
                              `${r.label},${r.target},${r.predicted},${r.error}`,
                          )
                          .join("\n"),
                      "Body fitting residuals",
                      "csv",
                    ).catch((e) => setMessage(String(e)));
                  }}
                >
                  Export fit residual CSV
                </button>
              </div>
            )}
          </div>
        </div>
        <footer>
          <p>
            Approximate local shape fitting on CC0 MakeHuman geometry. No
            medical, tailoring-accuracy or scan-equivalence claim. Photographs
            stay on this device and inside files you save.
          </p>
        </footer>
      </section>
    </div>
  );
}
