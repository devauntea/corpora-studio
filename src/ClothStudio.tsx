import { useDialogReturnFocus } from "./dialog-focus";
import { bodiceSetup } from "./cloth-setup";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  clothDefaults,
  type ClothConfig,
  type ClothPanel,
  type ClothResult,
} from "./cloth-model";
import { clothMesh, panelOutline } from "./cloth-mesh";
import { clothInWorker } from "./compute-jobs";
import { humanBody, blankProject, type Body } from "./domain";
import type { Fashion, PatternDraft } from "./fashion-model";
import { ClothStage, type Collider } from "./ClothStage";
import type { StudioScene } from "./scene";
import { saveReview, saveTextFile } from "./io";
import "./stencil.css";
const benchmarkDraft: PatternDraft = {
  neckLength: 0,
  warnings: [],
  pieces: [
    {
      id: "drape-benchmark",
      name: "500 mm square",
      cut: "Calibration swatch",
      width: 500,
      height: 500,
      seam: [
        { type: "move", to: { x: 0, y: 0 } },
        { type: "line", to: { x: 500, y: 0 } },
        { type: "line", to: { x: 500, y: 500 } },
        { type: "line", to: { x: 0, y: 500 } },
        { type: "close" },
      ],
      cutline: [],
      guides: [],
      notches: [],
      grain: [
        { x: 250, y: 30 },
        { x: 250, y: 470 },
      ],
      label: { x: 250, y: 250 },
      handles: [],
      origin: { x: 0, y: 0 },
      hemY: 500,
      sleeveHalfWidth: 0,
    },
  ],
};
function panel(pieceId: string, name: string): ClothPanel {
  return {
    id: crypto.randomUUID(),
    pieceId,
    name,
    unfold: false,
    mirror: false,
    x: 0,
    y: 300,
    z: 200,
    yaw: 0,
    roll: 0,
    pinTop: true,
  };
}
export function ClothStudio({
  value,
  draft: inputDraft,
  body: previous,
  change,
  close,
}: {
  value: Fashion;
  draft: PatternDraft;
  body: Body;
  change: (f: Fashion) => void;
  close: () => void;
}) {
  useDialogReturnFocus();
  const config = value.cloth ?? clothDefaults();
  const draft = config.mode === "cylinder" ? benchmarkDraft : inputDraft;
  const [body] = useState(() =>
    previous.kind === "human-v1" && previous.section === "full-body"
      ? { ...previous, anatomy: false }
      : humanBody("full-body", previous),
  );
  const [selected, setSelected] = useState(config.panels[0]?.id ?? ""),
    [message, setMessage] = useState(""),
    [progress, setProgress] = useState<number | null>(null),
    [result, setResult] = useState<ClothResult>(),
    [collider, setCollider] = useState<Collider>();
  const controller = useRef<AbortController | null>(null),
    scene = useRef<StudioScene | undefined>(undefined),
    dialog = useRef<HTMLElement>(null),
    resultKey = useRef("");
  const key = JSON.stringify({
    config: { ...config, benchmark: undefined },
    measurements: value.measurements,
    options: value.options,
    designOptions: value.designOptions,
    construction: value.construction,
  });
  const prepared = useMemo(() => {
    try {
      return { mesh: clothMesh(draft, config), error: "" };
    } catch (e) {
      return { mesh: undefined, error: String(e) };
    }
  }, [key]);
  const p = config.panels.find((p) => p.id === selected),
    piece = draft.pieces.find((d) => d.id === p?.pieceId);
  useEffect(() => {
    dialog.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus();
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    controller.current?.abort();
    setResult(undefined);
  }, [key]);
  const update = (patch: Partial<ClothConfig>) =>
      change({ ...value, cloth: { ...config, ...patch } }),
    edit = (patch: Partial<ClothPanel>) =>
      update({
        panels: config.panels.map((x) =>
          x.id === selected ? { ...x, ...patch } : x,
        ),
      });
  const addPanel = () => {
    const p = panel(draft.pieces[0].id, `Panel ${config.panels.length + 1}`);
    update({ panels: [...config.panels, p] });
    setSelected(p.id);
  };
  const run = async () => {
    if (!prepared.mesh || !collider) return;
    controller.current?.abort();
    const c = (controller.current = new AbortController());
    setProgress(0);
    setMessage("");
    try {
      const copy = structuredClone(prepared.mesh);
      const r = await clothInWorker(
        {
          mesh: copy,
          config,
          gsm: value.fabric?.gsm ?? 180,
          bodyPositions: collider.positions.slice(),
          bodyIndices: collider.indices.slice(),
          floor: collider.floor,
        },
        { signal: c.signal, progress: setProgress },
      );
      resultKey.current = key;
      setResult(r);
      setMessage(
        "Visual drape computed. Inspect seams and strain; this is not a fit guarantee.",
      );
    } catch (e) {
      setMessage(
        (e as Error).name === "AbortError" ? "Drape cancelled." : String(e),
      );
    } finally {
      if (controller.current === c) setProgress(null);
    }
  };
  const setup = () => {
    const front = inputDraft.pieces.find((p) => p.id === "front"),
      back = inputDraft.pieces.find((p) => p.id === "back");
    if (!front || !back) {
      setMessage(
        "Add panels individually for this design. The bodice starter uses front and back pieces.",
      );
      return;
    }
    const next = bodiceSetup(inputDraft);
    update(next);
    setSelected(next.panels[0].id);
    setMessage(
      "Bodice visual starter: side seams paired; shoulders pinned. Sleeves, neckband and finishing are not assembled. Inspect the highlighted boundary ranges.",
    );
  };
  return (
    <div className="modal-backdrop stencil-backdrop">
      <section
        ref={dialog}
        className="stencil-studio cloth-studio"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-label="Garment drape studio"
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
            <span className="eyebrow">FASHION / VISUAL FIT PREVIEW</span>
            <h2>Panels, stitches & drape</h2>
          </div>
          <button onClick={close}>Close drape studio</button>
        </header>
        <div className="stencil-body">
          <aside>
            <p>
              Arrange panels outside the body, join matching boundary ranges,
              then run the local solve. Cloth thickness, weight, stretch and
              bending affect this preview. Self-collision and calibrated fabric
              mechanics are not modeled.
            </p>
            <button onClick={setup}>Prepare bodice starter</button>
            <button
              onClick={() => {
                const p = {
                  ...panel("drape-benchmark", "500 mm calibration square"),
                  y: 380,
                  z: 0,
                  pitch: 90,
                  pinTop: false,
                };
                update({
                  ...clothDefaults(),
                  mode: "cylinder",
                  panels: [p],
                  steps: 240,
                  benchmark: config.benchmark,
                });
                setSelected(p.id);
                setMessage(
                  "500 × 500 mm cloth over a 200 mm diameter cylinder. Compare the measured edge drop with a real sample.",
                );
              }}
            >
              Cylinder drape benchmark
            </button>
            <button disabled={config.panels.length >= 16} onClick={addPanel}>
              Add pattern panel
            </button>
            <label>
              Selected panel
              <select
                aria-label="Drape panel"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Choose panel</option>
                {config.panels.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {p && (
              <>
                <label>
                  Piece
                  <select
                    aria-label="Drape pattern piece"
                    value={p.pieceId}
                    onChange={(e) => edit({ pieceId: e.target.value })}
                  >
                    {draft.pieces.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Name
                  <input
                    aria-label="Drape panel name"
                    maxLength={80}
                    value={p.name}
                    onChange={(e) =>
                      e.target.value && edit({ name: e.target.value })
                    }
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={p.unfold}
                    onChange={(e) => edit({ unfold: e.target.checked })}
                  />
                  Unfold vertical fold edge
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={p.mirror}
                    onChange={(e) => edit({ mirror: e.target.checked })}
                  />
                  Mirror panel
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={p.pinTop}
                    onChange={(e) => edit({ pinTop: e.target.checked })}
                  />
                  Pin top edge for fitting
                </label>
                {(["x", "y", "z", "yaw", "roll", "pitch"] as const).map((k) => (
                  <label key={k}>
                    {k}{" "}
                    {k === "yaw" || k === "roll" || k === "pitch"
                      ? "degrees"
                      : "mm"}
                    <input
                      aria-label={`Panel ${k}`}
                      type="number"
                      value={p[k] ?? 0}
                      onChange={(e) => {
                        const v = +e.target.value,
                          limit =
                            k === "yaw" || k === "roll" || k === "pitch"
                              ? 180
                              : 1500;
                        if (Math.abs(v) <= limit) edit({ [k]: v });
                      }}
                    />
                  </label>
                ))}
                <button
                  onClick={() => {
                    update({
                      panels: config.panels.filter((x) => x.id !== p.id),
                      stitches: config.stitches.filter(
                        (s) => s.a.panel !== p.id && s.b.panel !== p.id,
                      ),
                    });
                    setSelected("");
                  }}
                >
                  Remove selected panel
                </button>
              </>
            )}
            <details>
              <summary>Stitch pairs ({config.stitches.length})</summary>
              <p>
                Boundary percentages follow the numbered outline clockwise. Use
                short corresponding ranges. Reverse the second range when
                needed.
              </p>
              <button
                disabled={
                  config.panels.length < 2 || config.stitches.length >= 40
                }
                onClick={() =>
                  update({
                    stitches: [
                      ...config.stitches,
                      {
                        id: crypto.randomUUID(),
                        a: { panel: config.panels[0].id, from: 0, to: 0.1 },
                        b: { panel: config.panels[1].id, from: 0, to: 0.1 },
                        reverse: true,
                      },
                    ],
                  })
                }
              >
                Add stitch pair
              </button>
              {config.stitches.map((s, i) => (
                <fieldset className="stitch-row" key={s.id}>
                  <legend>Seam {i + 1}</legend>
                  {(["a", "b"] as const).map((side) => (
                    <div key={side}>
                      <label>
                        Panel {side.toUpperCase()}
                        <select
                          aria-label={`Seam ${i + 1} panel ${side}`}
                          value={s[side].panel}
                          onChange={(e) =>
                            update({
                              stitches: config.stitches.map((x) =>
                                x.id === s.id
                                  ? {
                                      ...s,
                                      [side]: {
                                        ...s[side],
                                        panel: e.target.value,
                                      },
                                    }
                                  : x,
                              ),
                            })
                          }
                        >
                          {config.panels.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {(["from", "to"] as const).map((end) => (
                        <label key={end}>
                          {end} %
                          <input
                            aria-label={`Seam ${i + 1} ${side} ${end}`}
                            type="number"
                            min={0}
                            max={100}
                            value={+(s[side][end] * 100).toFixed(2)}
                            onChange={(e) => {
                              const v = +e.target.value;
                              if (v >= 0 && v <= 100)
                                update({
                                  stitches: config.stitches.map((x) =>
                                    x.id === s.id
                                      ? {
                                          ...s,
                                          [side]: {
                                            ...s[side],
                                            [end]: v / 100,
                                          },
                                        }
                                      : x,
                                  ),
                                });
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  ))}
                  <label>
                    <input
                      type="checkbox"
                      checked={s.reverse}
                      onChange={(e) =>
                        update({
                          stitches: config.stitches.map((x) =>
                            x.id === s.id
                              ? { ...s, reverse: e.target.checked }
                              : x,
                          ),
                        })
                      }
                    />
                    Reverse B
                  </label>
                  <button
                    onClick={() =>
                      update({
                        stitches: config.stitches.filter((x) => x.id !== s.id),
                      })
                    }
                  >
                    Remove seam {i + 1}
                  </button>
                </fieldset>
              ))}
            </details>
            <details>
              <summary>Cloth settings</summary>
              {(
                [
                  ["spacing", "Mesh spacing (mm)", 12, 60],
                  ["steps", "Simulation steps", 30, 360],
                  ["stretch", "Stretch softness", 0, 100],
                  ["bend", "Bend softness", 0, 100],
                  ["thickness", "Contact thickness (mm)", 0.1, 8],
                  ["damping", "Motion damping", 0, 0.5],
                ] as const
              ).map(([k, label, min, max]) => (
                <label key={k}>
                  {label}
                  <input
                    aria-label={label}
                    type="number"
                    min={min}
                    max={max}
                    step={k === "damping" ? 0.01 : k === "thickness" ? 0.1 : 1}
                    value={config[k]}
                    onChange={(e) => {
                      const v = +e.target.value;
                      if (v >= min && v <= max) update({ [k]: v });
                    }}
                  />
                </label>
              ))}
              <p>
                Mass uses the fabric record: {value.fabric?.gsm ?? 180} GSM.
                Softness controls are exploratory and uncalibrated.
              </p>
            </details>
            <button
              disabled={!prepared.mesh || !collider || progress !== null}
              onClick={() => void run()}
            >
              Run visual drape
            </button>
            {progress !== null && (
              <>
                <progress value={progress} max={1} />
                <button onClick={() => controller.current?.abort()}>
                  Cancel drape
                </button>
              </>
            )}
          </aside>
          <div className="cloth-preview">
            <ClothStage
              body={body}
              benchmark={config.mode === "cylinder"}
              mesh={prepared.mesh}
              result={resultKey.current === key ? result : undefined}
              onCollider={setCollider}
              onScene={(s) => {
                scene.current = s;
              }}
            />
            {piece && p && config.mode !== "cylinder" && (
              <svg
                className="panel-outline"
                viewBox={`0 0 ${piece.width * 2 + 40} ${piece.height + 40}`}
                aria-label="Panel boundary percentages"
              >
                {(() => {
                  try {
                    const poly = panelOutline(piece, p.unfold),
                      minX = Math.min(...poly.map((p) => p.x)),
                      minY = Math.min(...poly.map((p) => p.y)),
                      loop = prepared.mesh?.panels.find((x) => x.id === p.id);
                    return (
                      <>
                        <path
                          d={
                            poly
                              .map(
                                (p, i) =>
                                  `${i ? "L" : "M"}${p.x - minX + 20},${p.y - minY + 20}`,
                              )
                              .join(" ") + "Z"
                          }
                          fill="#fafafa"
                          stroke="#111"
                          strokeWidth="3"
                        />
                        {loop?.boundary
                          .filter(
                            (_, i) =>
                              i %
                                Math.max(
                                  1,
                                  Math.floor(loop.boundary.length / 10),
                                ) ===
                              0,
                          )
                          .map((i) => {
                            const j = loop.boundary.indexOf(i);
                            return (
                              <text
                                key={i}
                                x={prepared.mesh!.rest[i * 3] - minX + 20}
                                y={prepared.mesh!.rest[i * 3 + 1] - minY + 20}
                                fontSize="20"
                              >
                                {Math.round(loop.fractions[j] * 100)}%
                              </text>
                            );
                          })}
                      </>
                    );
                  } catch {
                    return null;
                  }
                })()}
              </svg>
            )}
            <div className="cloth-status" role="status">
              {prepared.error || message}
              {prepared.mesh?.warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
              {result && (
                <p>
                  {prepared.mesh!.positions.length / 3} vertices ·{" "}
                  {(result.p95EdgeStrain * 100).toFixed(1)}% 95th percentile
                  edge strain · {result.seamGap.toFixed(1)} mm largest stitch
                  gap. Large gaps or strain require revising the assembly.
                </p>
              )}
            </div>
            {config.mode === "cylinder" && result && (
              <div className="cloth-benchmark">
                <label>
                  Physical swatch edge drop below cylinder top (mm)
                  <input
                    aria-label="Physical drape drop (mm)"
                    type="number"
                    min={0}
                    max={600}
                    value={config.benchmark?.physicalDrop ?? ""}
                    onChange={(e) => {
                      const v = +e.target.value;
                      if (!e.target.value || (v >= 0 && v <= 600))
                        change({
                          ...value,
                          cloth: {
                            ...config,
                            benchmark: {
                              notes: config.benchmark?.notes ?? "",
                              physicalDrop: e.target.value ? v : undefined,
                            },
                          },
                        });
                    }}
                  />
                </label>
                <p>
                  Simulated maximum drop:{" "}
                  {(
                    350 -
                    Math.min(
                      ...Array.from(result.positions).filter(
                        (_, i) => i % 3 === 1,
                      ),
                    )
                  ).toFixed(1)}{" "}
                  mm.{" "}
                  {config.benchmark?.physicalDrop !== undefined
                    ? `Difference: ${Math.abs(350 - Math.min(...Array.from(result.positions).filter((_, i) => i % 3 === 1)) - config.benchmark.physicalDrop).toFixed(1)} mm. Physical observation entered by you.`
                    : "No physical observation recorded."}
                </p>
              </div>
            )}
            {result && (
              <div className="cloth-export">
                <button
                  onClick={() => {
                    if (scene.current)
                      void saveReview(
                        scene.current.exportReview({
                          ...blankProject(),
                          name: "Garment visual fit preview",
                          body,
                        }),
                        "Garment visual fit preview",
                      ).catch((e) => setMessage(String(e)));
                  }}
                >
                  Export drape review
                </button>
                <button
                  onClick={() => {
                    void saveTextFile(
                      JSON.stringify(
                        {
                          format: "form-studio-drape-report",
                          version: 1,
                          validated: false,
                          vertices: prepared.mesh!.positions.length / 3,
                          p95EdgeStrain: result.p95EdgeStrain,
                          maxEdgeStrain: result.maxEdgeStrain,
                          seamGapMm: result.seamGap,
                          steps: result.steps,
                          fabric: value.fabric ?? null,
                          benchmark: config.benchmark ?? null,
                          simulatedDropMm:
                            config.mode === "cylinder"
                              ? 350 -
                                Math.min(
                                  ...Array.from(result.positions).filter(
                                    (_, i) => i % 3 === 1,
                                  ),
                                )
                              : undefined,
                          limitations: [
                            "No cloth self-collision",
                            "No physical fabric calibration",
                            "No sewn-toile validation",
                          ],
                        },
                        null,
                        2,
                      ),
                      "Drape report",
                      "json",
                    ).catch((e) => setMessage(String(e)));
                  }}
                >
                  Export drape report
                </button>
              </div>
            )}
          </div>
        </div>
        <footer>
          <p>
            Visual study only. Verify a sewn toile and a physical drape sample
            before relying on garment fit. Pattern pieces and stitch definitions
            are saved; simulations can be rerun.
          </p>
        </footer>
      </section>
    </div>
  );
}
