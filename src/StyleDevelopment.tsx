import { useEffect, useRef, useState } from "react";
import type { VectorPack } from "./vector-pack";
import {
  captureRevision,
  createSample,
  drawingHash,
  emptyDevelopment,
  revisionChanges,
  sampleRows,
  type StyleSample,
} from "./style-development";
import { TextField } from "./FashionFields";
import "./fashion-development.css";

export function StyleDevelopment({
  pack,
  change,
  notify,
}: {
  pack: VectorPack;
  change: (p: VectorPack) => void;
  notify: (s: string, error?: boolean) => void;
}) {
  const development = pack.development ?? emptyDevelopment(),
    [page, setPage] = useState<"samples" | "links" | "colorways">("samples"),
    [name, setName] = useState("Specification review"),
    [summary, setSummary] = useState(""),
    [recording, setRecording] = useState(false),
    [revisionId, setRevisionId] = useState(
      development.revisions.at(-1)?.id ?? "",
    ),
    [sampleId, setSampleId] = useState(development.samples.at(-1)?.id ?? ""),
    [size, setSize] = useState(""),
    [sampleName, setSampleName] = useState("First sample"),
    [hash, setHash] = useState("");
  const latest = useRef(pack);
  latest.current = pack;
  useEffect(() => {
    let cancelled = false;
    drawingHash(pack)
      .then((h) => {
        if (!cancelled) setHash(h);
      })
      .catch(() => {
        if (!cancelled) setHash("");
      });
    return () => {
      cancelled = true;
    };
  }, [pack.layers, pack.groups]);
  const revision =
      development.revisions.find((r) => r.id === revisionId) ??
      development.revisions.at(-1),
    sample =
      development.samples.find((s) => s.id === sampleId) ??
      development.samples.at(-1),
    sampleRevision = development.revisions.find(
      (r) => r.id === sample?.revisionId,
    );
  const editSample = (next: Partial<StyleSample>) =>
    sample &&
    change({
      ...pack,
      development: {
        ...development,
        samples: development.samples.map((s) =>
          s.id === sample.id ? { ...s, ...next } : s,
        ),
      },
    });
  return (
    <section className="style-development" aria-label="Samples and revisions">
      <div className="development-section-heading">
        <div>
          <span className="eyebrow">FASHION / DEVELOPMENT</span>
          <h2>Keep the sample and the spec together.</h2>
          <p>
            Record the requested specification, measure the returned sample, and
            carry every change into the handoff.
          </p>
        </div>
        <div className="development-actions">
          {(
            [
              ["samples", "Samples & revisions"],
              ["links", "Linked callouts"],
              ["colorways", "Colorways"],
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
        </div>
      </div>
      {page === "samples" && (
        <div className="development-columns">
          <div>
            <aside>
              <h3>Record a specification revision</h3>
              <p>
                Freezes measurements, units, materials and callouts. Later edits
                leave this record unchanged.
              </p>
              <label>
                Revision label
                <input
                  aria-label="Revision record name"
                  value={name}
                  maxLength={100}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Change summary
                <textarea
                  aria-label="Revision change summary"
                  value={summary}
                  maxLength={2000}
                  rows={3}
                  onChange={(e) => setSummary(e.target.value)}
                />
              </label>
              <p>
                Style {pack.style} · Revision {pack.revision} · {pack.units}
              </p>
              <button
                className="primary"
                disabled={
                  recording ||
                  !name.trim() ||
                  !pack.revision.trim() ||
                  development.revisions.length >= 20
                }
                onClick={async () => {
                  setRecording(true);
                  const source = pack;
                  try {
                    const record = await captureRevision(
                      source,
                      name.trim(),
                      summary,
                    );
                    if (latest.current !== source) {
                      notify(
                        "The style changed while recording. Review it and record again.",
                        true,
                      );
                      return;
                    }
                    change({
                      ...pack,
                      development: {
                        ...development,
                        revisions: [...development.revisions, record],
                      },
                    });
                    setRevisionId(record.id);
                    notify(
                      "Specification revision recorded. Future edits will not change it.",
                    );
                  } catch (e) {
                    notify(String(e), true);
                  } finally {
                    setRecording(false);
                  }
                }}
              >
                {recording ? "Recording…" : "Record specification revision"}
              </button>
              <p className="development-limit">
                {development.revisions.length}/20 revision records. A drawing
                checksum identifies the flat; use the project checkpoint tool to
                retain a restorable drawing.
              </p>
            </aside>
            <aside>
              <h3>Revision history</h3>
              {!development.revisions.length && (
                <p>No specification revisions recorded.</p>
              )}
              {[...development.revisions].reverse().map((r) => (
                <div key={r.id} className="revision-card">
                  <b>{r.name}</b>
                  <p>
                    Rev {r.spec.revision} · {r.spec.units} ·{" "}
                    {r.createdAt.slice(0, 10)}
                  </p>
                  <p>{r.summary || "No change note"}</p>
                  <button
                    aria-pressed={revision?.id === r.id}
                    onClick={() => {
                      setRevisionId(r.id);
                      setSize(r.spec.sizes[0]);
                    }}
                  >
                    Compare with current
                  </button>
                  <button
                    disabled={development.samples.some(
                      (s) => s.revisionId === r.id,
                    )}
                    aria-label={`Remove revision ${r.name}`}
                    onClick={() =>
                      change({
                        ...pack,
                        development: {
                          ...development,
                          revisions: development.revisions.filter(
                            (v) => v.id !== r.id,
                          ),
                        },
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </aside>
          </div>
          <div>
            <section>
              <h3>Changes since {revision?.name ?? "the recorded revision"}</h3>
              {revision ? (
                <>
                  <p>
                    Recorded rev {revision.spec.revision} → current rev{" "}
                    {pack.revision}
                  </p>
                  <ul className="development-changes">
                    {revisionChanges(pack, revision, hash).map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                    {!revisionChanges(pack, revision, hash).length && (
                      <li>No specification or drawing changes detected.</li>
                    )}
                  </ul>
                </>
              ) : (
                <p>Record a specification to start a change list.</p>
              )}
            </section>
            <section>
              <h3>Measure a sample</h3>
              <p>
                Compare finished garment measurements with a recorded
                specification. Sample values keep that revision’s units.
              </p>
              <div className="development-actions">
                <label>
                  Sample name
                  <input
                    aria-label="New sample name"
                    value={sampleName}
                    maxLength={100}
                    onChange={(e) => setSampleName(e.target.value)}
                  />
                </label>
                <label>
                  Requested revision
                  <select
                    aria-label="Sample revision"
                    value={revision?.id ?? ""}
                    onChange={(e) => {
                      setRevisionId(e.target.value);
                      setSize("");
                    }}
                  >
                    <option value="" disabled>
                      Record a revision first
                    </option>
                    {development.revisions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} · {r.spec.revision}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Size
                  <select
                    aria-label="Sample size"
                    value={
                      revision?.spec.sizes.includes(size)
                        ? size
                        : (revision?.spec.sizes[0] ?? "")
                    }
                    onChange={(e) => setSize(e.target.value)}
                  >
                    {revision?.spec.sizes.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                disabled={
                  !revision ||
                  !sampleName.trim() ||
                  development.samples.length >= 40
                }
                onClick={() => {
                  if (!revision) return;
                  const next = createSample(
                    revision,
                    revision.spec.sizes.includes(size)
                      ? size
                      : revision.spec.sizes[0],
                    sampleName.trim(),
                  );
                  change({
                    ...pack,
                    development: {
                      ...development,
                      samples: [...development.samples, next],
                    },
                  });
                  setSampleId(next.id);
                }}
              >
                Add sample measurement record
              </button>
              {sample && sampleRevision && (
                <>
                  <label>
                    Sample record
                    <select
                      aria-label="Active sample"
                      value={sample.id}
                      onChange={(e) => setSampleId(e.target.value)}
                    >
                      {development.samples.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} · {s.size}
                        </option>
                      ))}
                    </select>
                  </label>
                  <TextField
                    label="Sample record name"
                    value={sample.name}
                    change={(name) => editSample({ name })}
                  />
                  <p>
                    <b>
                      {sample.name} · Size {sample.size} · Rev{" "}
                      {sampleRevision.spec.revision} ·{" "}
                      {sampleRevision.spec.units}
                    </b>
                  </p>
                  <div className="vector-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Point of measure</th>
                          <th>Requested</th>
                          <th>Measured ({sampleRevision.spec.units})</th>
                          <th>Δ</th>
                          <th>± tolerance</th>
                          <th>Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sampleRows(sampleRevision, sample).map((row) => (
                          <tr key={row.id}>
                            <td>
                              <b>{row.name}</b>
                              <p>{row.method}</p>
                            </td>
                            <td>{row.requested ?? "TBD"}</td>
                            <td>
                              <input
                                aria-label={`Sample ${row.name}`}
                                type="number"
                                min={0}
                                max={1000}
                                step="0.1"
                                placeholder="Not measured"
                                value={row.actual ?? ""}
                                onChange={(e) => {
                                  const n =
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value);
                                  if (
                                    n !== null &&
                                    (!Number.isFinite(n) || n < 0 || n > 1000)
                                  )
                                    return;
                                  editSample({
                                    measurements: sample.measurements.map(
                                      (m) =>
                                        m.measurementId === row.id
                                          ? { ...m, value: n }
                                          : m,
                                    ),
                                  });
                                }}
                              />
                            </td>
                            <td>
                              {row.delta === null
                                ? "—"
                                : `${row.delta > 0 ? "+" : ""}${row.delta.toFixed(2)}`}
                            </td>
                            <td>{row.tolerance}</td>
                            <td
                              className="sample-status"
                              data-status={row.status}
                            >
                              {row.status}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <TextField
                    label="Sample findings and requested changes"
                    value={sample.notes}
                    max={3000}
                    multiline
                    change={(notes) => editSample({ notes })}
                  />
                  <button
                    onClick={() => {
                      change({
                        ...pack,
                        development: {
                          ...development,
                          samples: development.samples.filter(
                            (s) => s.id !== sample.id,
                          ),
                        },
                      });
                      setSampleId("");
                    }}
                  >
                    Remove sample record
                  </button>
                </>
              )}
            </section>
          </div>
        </div>
      )}
      {page === "links" && (
        <section>
          <h3>Link construction callouts</h3>
          <p>
            References use stable record IDs. Renaming a material updates its
            label; deleting a linked record creates an export finding.
          </p>
          {!pack.callouts.length && (
            <p>
              Add callouts on the technical flat to connect components,
              materials and points of measure.
            </p>
          )}
          {pack.callouts.map((c, i) => (
            <div className="revision-card" key={c.id}>
              <b>
                {i + 1}. {c.text}
              </b>
              <div className="development-actions">
                {(
                  [
                    [
                      "layerId",
                      "Component",
                      pack.layers
                        .filter((l) => l.view === c.view)
                        .map((l) => ({ id: l.id, label: l.name })),
                    ],
                    [
                      "materialId",
                      "Material",
                      pack.materials.map((m) => ({
                        id: m.id,
                        label: m.code || m.description,
                      })),
                    ],
                    [
                      "measurementId",
                      "Point of measure",
                      pack.measurements.map((m) => ({
                        id: m.id,
                        label: m.name,
                      })),
                    ],
                  ] as const
                ).map(([key, label, rows]) => (
                  <label key={key}>
                    {label}
                    <select
                      aria-label={`Callout ${i + 1} ${label}`}
                      value={c[key] ?? ""}
                      onChange={(e) =>
                        change({
                          ...pack,
                          callouts: pack.callouts.map((v) =>
                            v.id === c.id
                              ? { ...v, [key]: e.target.value || undefined }
                              : v,
                          ),
                        })
                      }
                    >
                      <option value="">No link</option>
                      {c[key] && !rows.some((r) => r.id === c[key]) && (
                        <option value={c[key]}>
                          Missing reference — reconnect
                        </option>
                      )}
                      {rows.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
      {page === "colorways" && (
        <section>
          <div className="development-section-heading">
            <div>
              <h3>Material colorways</h3>
              <p>
                Named supplier/color references for the same material list.
                These records do not recolor the drawing automatically.
              </p>
            </div>
            <button
              disabled={development.colorways.length >= 20}
              onClick={() =>
                change({
                  ...pack,
                  development: {
                    ...development,
                    colorways: [
                      ...development.colorways,
                      {
                        id: crypto.randomUUID(),
                        name: `Colorway ${development.colorways.length + 1}`,
                        materials: pack.materials.map((m) => ({
                          materialId: m.id,
                          color: m.color,
                          reference: "",
                        })),
                      },
                    ],
                  },
                })
              }
            >
              Add colorway
            </button>
          </div>
          {development.colorways.map((w, i) => (
            <article className="revision-card" key={w.id}>
              <TextField
                label={`Colorway ${i + 1} name`}
                value={w.name}
                change={(name) =>
                  change({
                    ...pack,
                    development: {
                      ...development,
                      colorways: development.colorways.map((c) =>
                        c.id === w.id ? { ...c, name } : c,
                      ),
                    },
                  })
                }
              />
              {w.materials.map((m, j) => (
                <div className="development-actions" key={m.materialId}>
                  <p>
                    {pack.materials.find((v) => v.id === m.materialId)?.code ??
                      "Missing material"}
                  </p>
                  <TextField
                    label={`Colorway ${i + 1} material ${j + 1} color`}
                    value={m.color}
                    change={(color) =>
                      change({
                        ...pack,
                        development: {
                          ...development,
                          colorways: development.colorways.map((c) =>
                            c.id === w.id
                              ? {
                                  ...c,
                                  materials: c.materials.map((v) =>
                                    v.materialId === m.materialId
                                      ? { ...v, color }
                                      : v,
                                  ),
                                }
                              : c,
                          ),
                        },
                      })
                    }
                  />
                  <TextField
                    label={`Colorway ${i + 1} material ${j + 1} reference`}
                    value={m.reference}
                    max={150}
                    change={(reference) =>
                      change({
                        ...pack,
                        development: {
                          ...development,
                          colorways: development.colorways.map((c) =>
                            c.id === w.id
                              ? {
                                  ...c,
                                  materials: c.materials.map((v) =>
                                    v.materialId === m.materialId
                                      ? { ...v, reference }
                                      : v,
                                  ),
                                }
                              : c,
                          ),
                        },
                      })
                    }
                  />
                  <button
                    aria-label={`Remove colorway ${i + 1} material ${j + 1}`}
                    onClick={() =>
                      change({
                        ...pack,
                        development: {
                          ...development,
                          colorways: development.colorways.map((c) =>
                            c.id === w.id
                              ? {
                                  ...c,
                                  materials: c.materials.filter(
                                    (v) => v.materialId !== m.materialId,
                                  ),
                                }
                              : c,
                          ),
                        },
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  change({
                    ...pack,
                    development: {
                      ...development,
                      colorways: development.colorways.map((c) =>
                        c.id === w.id
                          ? {
                              ...c,
                              materials: [
                                ...c.materials,
                                ...pack.materials
                                  .filter(
                                    (m) =>
                                      !c.materials.some(
                                        (v) => v.materialId === m.id,
                                      ),
                                  )
                                  .map((m) => ({
                                    materialId: m.id,
                                    color: m.color,
                                    reference: "",
                                  })),
                              ],
                            }
                          : c,
                      ),
                    },
                  })
                }
              >
                Add missing materials
              </button>
              <button
                onClick={() =>
                  change({
                    ...pack,
                    development: {
                      ...development,
                      colorways: development.colorways.filter(
                        (c) => c.id !== w.id,
                      ),
                    },
                  })
                }
              >
                Remove colorway
              </button>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}
