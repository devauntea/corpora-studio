import { useEffect, useMemo, useRef, useState } from "react";
import {
  pathString,
  type Fashion,
  type PatternDraft,
  type PatternPiece,
} from "./fashion-model";
import {
  boundaryEdges,
  checkSeam,
  constructionChecks,
  newSeam,
  starterSeams,
} from "./seam-checks";
import { SeamPlanSchema, type Seam, type SeamSide } from "./seam-model";
import { constructionArchive } from "./construction-export";
import { saveVectorPack, native } from "./io";
import { listen } from "@tauri-apps/api/event";
import { TextField, NumberField } from "./FashionFields";
import "./fashion-development.css";

function PieceView({
  piece,
  side,
  onEdges,
  notches,
  walk,
}: {
  piece: PatternPiece;
  side: SeamSide;
  onEdges: (edges: string[]) => void;
  notches: { x: number; y: number }[];
  walk?: { x: number; y: number };
}) {
  const edges = useMemo(() => boundaryEdges(piece), [piece]);
  return (
    <svg
      viewBox={`-20 -20 ${piece.width + 40} ${piece.height + 40}`}
      aria-label={`${piece.name} seam selection`}
      role="group"
    >
      <path
        d={pathString(piece.cutline)}
        fill="#f4f4f2"
        stroke="#ccc"
        strokeWidth={1}
      />
      {piece.guides.map((g, i) => (
        <path
          key={i}
          d={pathString(g)}
          fill="none"
          stroke="#bbb"
          strokeDasharray="4 3"
        />
      ))}
      {edges.map((e) => (
        <g key={e.id}>
          <polyline
            points={e.points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={side.edges.includes(e.id) ? "#111" : "#999"}
            strokeWidth={side.edges.includes(e.id) ? 3 : 1}
          />
          <polyline
            points={e.points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="transparent"
            strokeWidth={12}
            role="button"
            tabIndex={0}
            aria-label={`Toggle ${piece.name} edge ${e.index}`}
            aria-pressed={side.edges.includes(e.id)}
            onClick={() =>
              onEdges(
                edges
                  .filter((x) =>
                    x.id === e.id
                      ? !side.edges.includes(x.id)
                      : side.edges.includes(x.id),
                  )
                  .map((x) => x.id),
              )
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onEdges(
                  edges
                    .filter((x) =>
                      x.id === e.id
                        ? !side.edges.includes(x.id)
                        : side.edges.includes(x.id),
                    )
                    .map((x) => x.id),
                );
              }
            }}
          />
        </g>
      ))}
      {notches.map((p, i) => (
        <path
          key={i}
          d={`M${p.x - 5} ${p.y}h10 M${p.x} ${p.y - 5}v10`}
          stroke="#24646f"
          strokeWidth={1.8}
        />
      ))}
      {walk && (
        <circle
          cx={walk.x}
          cy={walk.y}
          r={5}
          fill="#fff"
          stroke="#111"
          strokeWidth={2}
        />
      )}
    </svg>
  );
}
export function SeamStudio({
  value,
  draft,
  change,
  close,
  undo,
  redo,
  canUndo,
  canRedo,
  name,
  notify,
}: {
  value: Fashion;
  draft: PatternDraft;
  change: (f: Fashion) => void;
  close: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  name: string;
  notify: (s: string, error?: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [selected, setSelected] = useState<string | null>(
      value.seamPlan?.seams[0]?.id ?? null,
    ),
    [page, setPage] = useState<"seams" | "steps" | "handoff">("seams"),
    [walk, setWalk] = useState(50),
    [exporting, setExporting] = useState(false);
  const plan = value.seamPlan ?? {
    design: value.design ?? "teagan",
    seams: [],
    steps: [],
    notes: "",
  };
  const seam = plan.seams.find((s) => s.id === selected) ?? plan.seams[0],
    checks = useMemo(
      () => constructionChecks(draft, value),
      [draft, value.seamPlan, value.design],
    );
  const check = seam ? checkSeam(draft, seam) : null;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    if (!native) return;
    let disposed = false,
      cleanup: (() => void) | undefined;
    void listen<"undo" | "redo">("editor-history", ({ payload }) => {
      if (exporting) return;
      if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName ?? ""))
        document.execCommand(payload);
      else payload === "undo" ? undo() : redo();
    })
      .then((fn) => {
        if (disposed) fn();
        else cleanup = fn;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [undo, redo, exporting]);
  const update = (next: typeof plan) => {
    const parsed = SeamPlanSchema.safeParse(next);
    if (parsed.success) change({ ...value, seamPlan: parsed.data });
    else
      notify(
        parsed.error.issues[0]?.message ?? "Invalid construction plan",
        true,
      );
  };
  const patch = (s: Partial<Seam>) =>
    seam &&
    update({
      ...plan,
      seams: plan.seams.map((old) =>
        old.id === seam.id ? { ...old, ...s } : old,
      ),
    });
  const add = () => {
    const a = draft.pieces.find((p) => boundaryEdges(p).length),
      b =
        draft.pieces.find((p) => p.id !== a?.id && boundaryEdges(p).length) ??
        a;
    if (!a || !b) return;
    const s = newSeam(
      { pieceId: a.id, edges: [boundaryEdges(a)[0].id], reverse: false },
      { pieceId: b.id, edges: [boundaryEdges(b)[0].id], reverse: false },
    );
    update({ ...plan, seams: [...plan.seams, s] });
    setSelected(s.id);
    setPage("seams");
  };
  const starter = () => {
    const next = starterSeams(draft, value.design ?? "teagan");
    update(next);
    setSelected(next.seams[0]?.id ?? null);
  };
  return (
    <dialog
      ref={dialog}
      role="dialog"
      tabIndex={-1}
      className="fashion-development-dialog"
      aria-labelledby="construction-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!exporting) close();
      }}
      onKeyDown={(e) => {
        if (
          (e.metaKey || e.ctrlKey) &&
          e.key.toLowerCase() === "z" &&
          !["INPUT", "TEXTAREA", "SELECT"].includes(
            (e.target as HTMLElement).tagName,
          )
        ) {
          e.preventDefault();
          e.shiftKey ? redo() : undo();
        }
      }}
    >
      <header>
        <div>
          <span className="eyebrow">FASHION / CONSTRUCTION</span>
          <h2 id="construction-title">Make every seam intentional.</h2>
          <p>{value.profile} · stitch lengths in millimeters</p>
        </div>
        <div className="development-actions">
          <button disabled={!canUndo || exporting} onClick={undo}>
            Undo
          </button>
          <button disabled={!canRedo || exporting} onClick={redo}>
            Redo
          </button>
          <button disabled={exporting} onClick={close}>
            Close construction
          </button>
        </div>
      </header>
      <nav aria-label="Construction pages">
        {(
          [
            ["seams", "Seam relationships"],
            ["steps", "Assembly steps"],
            ["handoff", "Check & handoff"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            aria-pressed={page === id}
            onClick={() => setPage(id)}
          >
            {label}
          </button>
        ))}
        <span>
          {plan.seams.length} paired seams ·{" "}
          {checks.reduce((n, c) => n + c.issues.length, 0)} findings
        </span>
      </nav>
      <div className="development-content" inert={exporting}>
        {plan.design !== (value.design ?? "teagan") && (
          <div className="construction-findings" role="status">
            <p>
              This plan belongs to {plan.design}. Its edges are not applied to{" "}
              {value.design}. Start a new plan for this design; Undo restores
              the previous plan.
            </p>
            <button
              onClick={() => {
                update({
                  design: value.design ?? "teagan",
                  seams: [],
                  steps: [],
                  notes: "",
                });
                setSelected(null);
              }}
            >
              Start plan for current design
            </button>
          </div>
        )}
        {page === "seams" && (
          <div className="seam-workspace">
            <aside className="seam-list" aria-label="Seam pairs">
              <h3>Paired seams</h3>
              <p>
                Choose the stitch edges that will meet. Click curves or select
                their edge numbers.
              </p>
              {plan.seams.map((s) => (
                <button
                  key={s.id}
                  className={seam?.id === s.id ? "selected" : ""}
                  aria-pressed={seam?.id === s.id}
                  onClick={() => {
                    setSelected(s.id);
                    setWalk(0);
                  }}
                >
                  <b>{s.name}</b>
                  <small>
                    {checks.find((c) => c.id === s.id)?.issues.length || 0}{" "}
                    findings
                  </small>
                </button>
              ))}
              <button disabled={plan.seams.length >= 80} onClick={add}>
                + Pair seam edges
              </button>
              {!plan.seams.length &&
                ["teagan", "simon", "titan"].includes(
                  value.design ?? "teagan",
                ) &&
                !Object.keys(value.construction ?? {}).length && (
                  <button onClick={starter}>Load design checklist</button>
                )}
              <p className="development-muted">
                Only paired edges are checked. A starter covers selected joins;
                it is not a reviewed sewing pattern.
              </p>
            </aside>
            {seam ? (
              <>
                <section className="seam-preview">
                  <div className="seam-pieces">
                    {(["a", "b"] as const).map((key) => {
                      const side = seam[key],
                        p = draft.pieces.find((p) => p.id === side.pieceId),
                        result = check?.[key];
                      return (
                        <article key={key}>
                          <h3>
                            {key.toUpperCase()} · {p?.name ?? "Missing piece"}
                          </h3>
                          <p>
                            {result
                              ? `${result.length.toFixed(1)} mm in sewing direction`
                              : "Reconnect edges"}
                          </p>
                          {p && (
                            <PieceView
                              piece={p}
                              side={side}
                              onEdges={(edges) => {
                                if (edges.length)
                                  patch({ [key]: { ...side, edges } });
                              }}
                              notches={
                                result
                                  ? seam.notches
                                      .filter((n) => n[key] <= result.length)
                                      .map((n) => result.at(n[key]))
                                  : []
                              }
                              walk={result?.at((walk / 100) * result.length)}
                            />
                          )}
                        </article>
                      );
                    })}
                  </div>
                  <div className="seam-walk">
                    <label>
                      Walk the seam · {walk}%
                      <input
                        aria-label="Walk seam"
                        type="range"
                        min={0}
                        max={100}
                        value={walk}
                        onChange={(e) => setWalk(Number(e.target.value))}
                      />
                    </label>
                    <p>
                      {check?.a && check.b
                        ? `A ${((walk / 100) * check.a.length).toFixed(1)} mm ↔ B ${((walk / 100) * check.b.length).toFixed(1)} mm · Total B − A: ${check.difference!.toFixed(1)} mm`
                        : "Select consecutive edges on each piece."}
                    </p>
                  </div>
                  <div className="construction-findings" aria-live="polite">
                    {check?.issues.length ? (
                      check.issues.map((m, i) => <p key={i}>Review: {m}</p>)
                    ) : (
                      <p>
                        Lengths and paired marks meet the entered targets.
                        Construction and sample fit still need review.
                      </p>
                    )}
                  </div>
                  <h3>Matching marks</h3>
                  <p>
                    Distances follow each side’s sewing direction. Marks export
                    on the stitch boundary.
                  </p>
                  {seam.notches.map((n, i) => (
                    <div className="notch-row" key={n.id}>
                      <TextField
                        label={`Mark ${i + 1} name`}
                        value={n.name}
                        change={(name) =>
                          patch({
                            notches: seam.notches.map((m) =>
                              m.id === n.id ? { ...m, name } : m,
                            ),
                          })
                        }
                      />
                      {(["a", "b"] as const).map((key) => (
                        <NumberField
                          key={key}
                          label={`Mark ${i + 1} ${key.toUpperCase()}`}
                          value={n[key]}
                          change={(v) =>
                            patch({
                              notches: seam.notches.map((m) =>
                                m.id === n.id ? { ...m, [key]: v } : m,
                              ),
                            })
                          }
                        />
                      ))}
                      <label>
                        <input
                          type="checkbox"
                          checked={n.double}
                          onChange={(e) =>
                            patch({
                              notches: seam.notches.map((m) =>
                                m.id === n.id
                                  ? { ...m, double: e.target.checked }
                                  : m,
                              ),
                            })
                          }
                        />
                        Double
                      </label>
                      <button
                        aria-label={`Remove mark ${i + 1}`}
                        onClick={() =>
                          patch({
                            notches: seam.notches.filter((m) => m.id !== n.id),
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    disabled={
                      !check?.a || !check.b || seam.notches.length >= 24
                    }
                    onClick={() => {
                      if (check?.a && check.b)
                        patch({
                          notches: [
                            ...seam.notches,
                            {
                              id: crypto.randomUUID(),
                              name: `Mark ${seam.notches.length + 1}`,
                              a: (check.a.length * walk) / 100,
                              b: (check.b.length * walk) / 100,
                              double: false,
                            },
                          ],
                        });
                    }}
                  >
                    Add matching mark at cursor
                  </button>
                </section>
                <aside
                  className="seam-inspector"
                  aria-label="Selected seam properties"
                >
                  <TextField
                    label="Seam name"
                    value={seam.name}
                    change={(name) => patch({ name })}
                  />
                  {(["a", "b"] as const).map((key) => {
                    const side = seam[key],
                      p = draft.pieces.find((p) => p.id === side.pieceId);
                    return (
                      <fieldset key={key}>
                        <legend>Side {key.toUpperCase()}</legend>
                        <label>
                          Pattern piece
                          <select
                            aria-label={`Side ${key.toUpperCase()} piece`}
                            value={side.pieceId}
                            onChange={(e) => {
                              const p = draft.pieces.find(
                                (p) => p.id === e.target.value,
                              )!;
                              patch({
                                [key]: {
                                  ...side,
                                  pieceId: p.id,
                                  edges: [boundaryEdges(p)[0].id],
                                },
                              });
                            }}
                          >
                            {!p && (
                              <option value={side.pieceId}>
                                Missing: {side.pieceId}
                              </option>
                            )}
                            {draft.pieces
                              .filter((p) => boundaryEdges(p).length)
                              .map((p) => (
                                <option value={p.id} key={p.id}>
                                  {p.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          Consecutive edges
                          <select
                            aria-label={`Side ${key.toUpperCase()} edges`}
                            multiple
                            value={side.edges}
                            onChange={(e) => {
                              const edges = [...e.target.selectedOptions].map(
                                (o) => o.value,
                              );
                              if (edges.length)
                                patch({ [key]: { ...side, edges } });
                            }}
                          >
                            {p &&
                              boundaryEdges(p).map((e) => (
                                <option key={e.id} value={e.id}>
                                  {e.label}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            aria-label={`Reverse side ${key.toUpperCase()}`}
                            checked={side.reverse}
                            onChange={(e) =>
                              patch({
                                [key]: { ...side, reverse: e.target.checked },
                              })
                            }
                          />
                          Reverse sewing direction
                        </label>
                      </fieldset>
                    );
                  })}
                  <label>
                    Seam intent
                    <select
                      aria-label="Seam intent"
                      value={seam.mode}
                      onChange={(e) =>
                        patch({ mode: e.target.value as Seam["mode"] })
                      }
                    >
                      {["plain", "ease", "gather", "stretch"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <NumberField
                    label="Intended B minus A"
                    min={-2000}
                    max={2000}
                    value={seam.ease}
                    change={(ease) => patch({ ease })}
                  />
                  <NumberField
                    label="Length tolerance"
                    max={50}
                    value={seam.tolerance}
                    change={(tolerance) => patch({ tolerance })}
                  />
                  <TextField
                    label="Seam notes"
                    multiline
                    max={1000}
                    value={seam.notes}
                    change={(notes) => patch({ notes })}
                  />
                  <button
                    onClick={() => {
                      update({
                        ...plan,
                        seams: plan.seams.filter((s) => s.id !== seam.id),
                        steps: plan.steps.map((s) => ({
                          ...s,
                          seamIds: s.seamIds.filter((id) => id !== seam.id),
                        })),
                      });
                      setSelected(null);
                    }}
                  >
                    Remove seam pair
                  </button>
                </aside>
              </>
            ) : (
              <section className="development-empty">
                <h3>Connect the pieces before cutting.</h3>
                <p>
                  Pair edges to compare stitch lengths, record intentional ease
                  and add shared matching marks.
                </p>
                <button className="primary" onClick={add}>
                  Pair your first seam
                </button>
              </section>
            )}
          </div>
        )}
        {page === "steps" && (
          <section className="assembly-editor">
            <div className="development-section-heading">
              <div>
                <h3>Assembly sequence</h3>
                <p>Editable instructions linked to the seams they describe.</p>
              </div>
              <button
                disabled={plan.steps.length >= 80}
                onClick={() =>
                  update({
                    ...plan,
                    steps: [
                      ...plan.steps,
                      {
                        id: crypto.randomUUID(),
                        title: `Step ${plan.steps.length + 1}`,
                        instruction: "",
                        seamIds: [],
                      },
                    ],
                  })
                }
              >
                Add assembly step
              </button>
            </div>
            {plan.steps.map((s, i) => (
              <article key={s.id}>
                <div className="assembly-number">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div>
                  <TextField
                    label={`Step ${i + 1} title`}
                    value={s.title}
                    change={(title) =>
                      update({
                        ...plan,
                        steps: plan.steps.map((v) =>
                          v.id === s.id ? { ...v, title } : v,
                        ),
                      })
                    }
                  />
                  <TextField
                    label={`Step ${i + 1} instructions`}
                    multiline
                    max={2000}
                    value={s.instruction}
                    change={(instruction) =>
                      update({
                        ...plan,
                        steps: plan.steps.map((v) =>
                          v.id === s.id ? { ...v, instruction } : v,
                        ),
                      })
                    }
                  />
                  <fieldset>
                    <legend>Related seams</legend>
                    {plan.seams.map((seam) => (
                      <label key={seam.id}>
                        <input
                          type="checkbox"
                          checked={s.seamIds.includes(seam.id)}
                          onChange={(e) =>
                            update({
                              ...plan,
                              steps: plan.steps.map((v) =>
                                v.id === s.id
                                  ? {
                                      ...v,
                                      seamIds: e.target.checked
                                        ? [...v.seamIds, seam.id]
                                        : v.seamIds.filter(
                                            (id) => id !== seam.id,
                                          ),
                                    }
                                  : v,
                              ),
                            })
                          }
                        />
                        {seam.name}
                      </label>
                    ))}
                  </fieldset>
                </div>
                <div>
                  <button
                    disabled={i === 0}
                    aria-label={`Move step ${i + 1} up`}
                    onClick={() => {
                      const steps = [...plan.steps];
                      [steps[i - 1], steps[i]] = [steps[i], steps[i - 1]];
                      update({ ...plan, steps });
                    }}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Remove step ${i + 1}`}
                    onClick={() =>
                      update({
                        ...plan,
                        steps: plan.steps.filter((v) => v.id !== s.id),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
            <TextField
              label="Construction notes"
              multiline
              max={3000}
              value={plan.notes}
              change={(notes) => update({ ...plan, notes })}
            />
          </section>
        )}
        {page === "handoff" && (
          <section className="construction-handoff">
            <span className="eyebrow">SINGLE SIZE / SVG + PDF</span>
            <h3>A traceable construction package.</h3>
            <p>
              Full-size SVG, tiled PDF, paired-edge report, matching marks,
              assembly instructions and a file checksum manifest.
            </p>
            <dl>
              <div>
                <dt>Style / revision</dt>
                <dd>
                  {value.vectorPack?.style ?? name} /{" "}
                  {value.vectorPack?.revision ??
                    "Unspecified — set in Vector packs"}
                </dd>
              </div>
              <div>
                <dt>Measurement profile</dt>
                <dd>{value.profile}</dd>
              </div>
              <div>
                <dt>Pattern dimensions</dt>
                <dd>Millimeters · one SVG unit = one mm</dd>
              </div>
              <div>
                <dt>Receiver profile</dt>
                <dd>SVG/PDF · external CAD round trip not verified</dd>
              </div>
            </dl>
            <div className="construction-findings">
              {!checks.length && (
                <p>No seam relationships have been recorded.</p>
              )}
              {checks.map((c) => (
                <article key={c.id}>
                  <b>{c.name}</b>
                  {c.issues.length ? (
                    c.issues.map((i, n) => <p key={n}>{i}</p>)
                  ) : (
                    <p>Within entered targets</p>
                  )}
                </article>
              ))}
            </div>
            <p>
              Print at actual size and measure the PDF control square. Only
              listed seams are checked; complete a sample before cutting
              production fabric.
            </p>
            <button
              className="primary"
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  const data = await constructionArchive(draft, value, name);
                  if (await saveVectorPack(data, `${name}-construction`, "zip"))
                    notify("Construction package exported in millimeters.");
                } catch (e) {
                  notify(String(e), true);
                } finally {
                  setExporting(false);
                }
              }}
            >
              {exporting ? "Preparing package…" : "Export construction ZIP"}
            </button>
          </section>
        )}
      </div>
    </dialog>
  );
}
