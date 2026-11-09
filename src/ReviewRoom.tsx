import { useEffect, useRef, useState } from "react";
import {
  X,
  Camera,
  Download,
  MessageSquare,
  LockKeyhole,
  Plus,
  Check,
  ArrowLeft,
  FileUp,
  Trash2,
} from "lucide-react";
import type { Project } from "./domain";
import {
  REVIEW_ACKNOWLEDGEMENT,
  REVIEW_LIMITS,
  acknowledgeReview,
  addReviewNote,
  addReviewView,
  defaultReview,
  exportReviewBundle,
  freezeReviewRevision,
  importReviewFeedback,
  prepareReviewCapture,
  reviewProjectHash,
  reviewSchema,
  saveReviewBundle,
  setReviewNoteStatus,
  type ReviewData,
} from "./review-room";
import "./review-room.css";

type Props = {
  project: Project;
  studio: "tattoo" | "fashion";
  onChange: (review: ReviewData) => void;
  capture: () => Promise<string>;
  close: () => void;
};
const tabs = ["Views", "Notes", "Share"] as const;
type Tab = (typeof tabs)[number];
const dateLabel = (s: string) =>
  new Date(s).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
const errorLabel = (error: unknown) =>
  error instanceof Error
    ? error.message.startsWith("[")
      ? "This review exceeds its limits or has incomplete fields. Check the names, notes and preview count."
      : error.message
    : "This review action could not be completed.";

export function ReviewRoom({
  project,
  studio,
  onChange,
  capture,
  close,
}: Props) {
  const data =
    (project as Project & { review?: ReviewData }).review ?? defaultReview();
  const dialog = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null),
    currentProject = useRef(project);
  currentProject.current = project;
  const [selected, setSelected] = useState(data.revisions.at(-1)?.id ?? ""),
    [tab, setTab] = useState<Tab>("Views"),
    [currentHash, setCurrentHash] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [label, setLabel] = useState(project.revision || ""),
    [viewName, setViewName] = useState(
      studio === "fashion" ? "Garment overview" : "Current body view",
    ),
    [objectName, setObjectName] = useState(
      studio === "fashion" ? "Garment" : "Body placement",
    ),
    [viewId, setViewId] = useState(""),
    [author, setAuthor] = useState("Studio"),
    [note, setNote] = useState(""),
    [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved">(
      "open",
    ),
    [shareIds, setShareIds] = useState<string[]>([]),
    [ackName, setAckName] = useState(""),
    [confirmDelete, setConfirmDelete] = useState(false);
  const revision =
    data.revisions.find((r) => r.id === selected) ?? data.revisions.at(-1);
  const matches = !!revision && revision.hash === currentHash;
  const report = (text: string, isError = false) => {
    setMessage(text);
    setError(isError);
  };
  const commit = (next: ReviewData) => onChange(reviewSchema.parse(next));
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    let live = true;
    void reviewProjectHash(project)
      .then((hash) => {
        if (live) setCurrentHash(hash);
      })
      .catch((e) => {
        if (live) report(errorLabel(e), true);
      });
    return () => {
      live = false;
    };
  }, [project]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    report("");
    try {
      await action();
    } catch (e) {
      report(errorLabel(e), true);
    } finally {
      setBusy(false);
    }
  };
  const selectRevision = (id: string) => {
    setSelected(id);
    setShareIds([]);
    setViewId("");
    setConfirmDelete(false);
    report("");
  };
  const freeze = () =>
    run(async () => {
      if (!viewName.trim() || !objectName.trim())
        throw new Error("Name the view and its object before capturing.");
      const snapshot = currentProject.current,
        hash = await reviewProjectHash(snapshot);
      let next = await freezeReviewRevision(snapshot, data, label, studio);
      const png = await prepareReviewCapture(await capture());
      if ((await reviewProjectHash(currentProject.current)) !== hash)
        throw new Error(
          "The project changed during capture. Freeze the current revision again.",
        );
      next = addReviewView(next, hash, {
        png,
        name: viewName.trim(),
        objectName: objectName.trim(),
        studio,
      });
      commit(next);
      const created = next.revisions.find((r) => r.hash === hash)!;
      setSelected(created.id);
      setTab("Views");
      setShareIds([]);
      report(
        "Revision frozen and rendered view saved. Choose views explicitly when you share.",
      );
    });
  const captureView = () =>
    run(async () => {
      if (
        !revision ||
        (await reviewProjectHash(currentProject.current)) !== revision.hash
      )
        throw new Error(
          "The project has changed. Freeze a new revision before adding views.",
        );
      if (!viewName.trim() || !objectName.trim())
        throw new Error("Name the view and its object before capturing.");
      const png = await prepareReviewCapture(await capture());
      if ((await reviewProjectHash(currentProject.current)) !== revision.hash)
        throw new Error(
          "The project changed during capture. This view was not added.",
        );
      commit(
        addReviewView(data, revision.hash, {
          png,
          name: viewName.trim(),
          objectName: objectName.trim(),
          studio,
        }),
      );
      report("Rendered view added to this exact revision.");
    });
  const addNote = () => {
    if (!revision) return;
    try {
      commit(
        addReviewNote(data, revision.hash, {
          text: note.trim(),
          objectName: objectName.trim(),
          author: author.trim(),
          ...(viewId ? { viewId } : {}),
        }),
      );
      setNote("");
      report("Note added to this revision.");
    } catch (e) {
      report(errorLabel(e), true);
    }
  };
  const importFile = async (file: File) =>
    run(async () => {
      if (file.size > REVIEW_LIMITS.feedbackBytes)
        throw new Error("Choose feedback JSON smaller than 300 KB.");
      const result = importReviewFeedback(data, await file.text());
      commit(result.review);
      setSelected(
        result.review.revisions.find((r) => r.hash === result.revisionHash)!.id,
      );
      setTab("Notes");
      setStatusFilter("all");
      setViewId("");
      setShareIds([]);
      report(
        result.added
          ? `${result.added} feedback records imported. Geometry is unchanged.`
          : "This feedback is already recorded.",
      );
    });
  const removeRevision = () => {
    if (!revision) return;
    commit({
      ...data,
      revisions: data.revisions.filter((r) => r.id !== revision.id),
    });
    selectRevision("");
    report(
      "Review revision removed from this project. Exported files are unchanged.",
    );
  };
  const changeTab = (index: number) => {
    const next = tabs[(index + tabs.length) % tabs.length];
    setTab(next);
    requestAnimationFrame(() =>
      dialog.current
        ?.querySelector<HTMLButtonElement>(`#review-tab-${next.toLowerCase()}`)
        ?.focus(),
    );
  };
  return (
    <dialog
      ref={dialog}
      className="review-room"
      aria-labelledby="review-room-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <header className="review-room-header">
        <div>
          <p className="review-eyebrow">CORPORA / LOCAL COLLABORATION</p>
          <h1 id="review-room-title">Review room</h1>
          <p>
            Freeze a version. Share the views that matter. Keep feedback
            connected.
          </p>
        </div>
        <button
          className="review-icon-button"
          aria-label="Close review room"
          disabled={busy}
          onClick={close}
        >
          <X size={20} />
        </button>
      </header>
      <div className="review-room-layout">
        <aside className="review-room-sidebar">
          <div className="review-sidebar-heading">
            <h2>Saved revisions</h2>
            <span>
              {data.revisions.length} / {REVIEW_LIMITS.revisions}
            </span>
          </div>
          <div className="review-revision-list">
            {data.revisions.map((r, i) => (
              <button
                key={r.id}
                className={revision?.id === r.id ? "selected" : ""}
                aria-pressed={revision?.id === r.id}
                disabled={busy}
                onClick={() => selectRevision(r.id)}
              >
                <span className="review-revision-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <strong>{r.label}</strong>
                  <small>
                    {dateLabel(r.frozenAt)} · {r.views.length} views
                  </small>
                  <small>
                    {r.notes.filter((n) => n.status === "open").length} open
                    notes
                  </small>
                </span>
                {r.hash === currentHash && (
                  <span
                    className="review-current-dot"
                    title="Matches the current project"
                  />
                )}
              </button>
            ))}
          </div>
          <div className="review-freeze">
            <LockKeyhole size={19} />
            <h3>Capture this version</h3>
            <p>
              A frozen fingerprint identifies this exact project state. Rendered
              views remain available as the design changes.
            </p>
            <label>
              Revision name
              <input
                aria-label="Review revision name"
                maxLength={120}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={`Revision ${data.revisions.length + 1}`}
                disabled={busy}
              />
            </label>
            <button
              className="review-primary"
              disabled={busy || !currentHash}
              onClick={() => void freeze()}
            >
              <Plus size={16} />
              {busy ? "Working…" : "Freeze & capture"}
            </button>
          </div>
          <button
            className="review-import"
            disabled={busy || !data.revisions.length}
            onClick={() => input.current?.click()}
          >
            <FileUp size={16} /> Import feedback JSON
          </button>
          <input
            ref={input}
            hidden
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void importFile(file);
            }}
          />
          <p className="review-small">
            Stored in your project. Sharing creates a local ZIP; nothing is
            uploaded.
          </p>
        </aside>
        <section className="review-room-main">
          {revision ? (
            <>
              <div className="review-revision-title">
                <div>
                  <p className="review-eyebrow">FROZEN REVISION</p>
                  <h2>{revision.label}</h2>
                  <p>
                    {matches
                      ? "Matches the current project"
                      : "Earlier project state · freeze a new revision to capture changes"}
                  </p>
                </div>
                <span className="review-hash" title={revision.hash}>
                  <LockKeyhole size={13} /> {revision.hash.slice(0, 12)}
                </span>
              </div>
              <div
                className="review-tabs"
                role="tablist"
                aria-label="Review tasks"
              >
                {tabs.map((item, i) => (
                  <button
                    key={item}
                    id={`review-tab-${item.toLowerCase()}`}
                    role="tab"
                    tabIndex={tab === item ? 0 : -1}
                    aria-selected={tab === item}
                    aria-controls={`review-panel-${item.toLowerCase()}`}
                    onClick={() => setTab(item)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                        e.preventDefault();
                        changeTab(i + (e.key === "ArrowRight" ? 1 : -1));
                      }
                      if (e.key === "Home" || e.key === "End") {
                        e.preventDefault();
                        changeTab(e.key === "Home" ? 0 : 2);
                      }
                    }}
                  >
                    {item}
                    {item === "Notes" && (
                      <span>
                        {
                          revision.notes.filter((n) => n.status === "open")
                            .length
                        }
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {tab === "Views" && (
                <div
                  className="review-panel"
                  id="review-panel-views"
                  role="tabpanel"
                  aria-labelledby="review-tab-views"
                >
                  <div className="review-capture-fields">
                    <label>
                      View name
                      <input
                        aria-label="Review view name"
                        maxLength={100}
                        value={viewName}
                        onChange={(e) => setViewName(e.target.value)}
                        placeholder="Front / back / neckline detail"
                        disabled={busy}
                      />
                    </label>
                    <label>
                      Object or area
                      <input
                        aria-label="Review object name"
                        maxLength={100}
                        value={objectName}
                        onChange={(e) => setObjectName(e.target.value)}
                        disabled={busy}
                      />
                    </label>
                    <button
                      disabled={
                        busy ||
                        !matches ||
                        revision.views.length >= REVIEW_LIMITS.views
                      }
                      onClick={() => void captureView()}
                    >
                      <Camera size={16} /> Capture current view
                    </button>
                  </div>
                  <p className="review-small">
                    To capture another angle, close this room, adjust the
                    camera, and reopen it. Model changes require a new revision.
                  </p>
                  <div className="review-view-grid">
                    {revision.views.map((v) => (
                      <article key={v.id} className="review-view-card">
                        <img src={v.png} alt={v.name} />
                        <div>
                          <strong>{v.name}</strong>
                          <small>
                            {v.objectName} · {dateLabel(v.capturedAt)}
                          </small>
                          <button
                            onClick={() => {
                              setViewId(v.id);
                              setObjectName(v.objectName);
                              setTab("Notes");
                            }}
                          >
                            <MessageSquare size={14} /> Annotate view
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  {!revision.views.length && (
                    <p className="review-empty-inline">
                      No rendered views yet. Capture the current view while this
                      revision matches your project.
                    </p>
                  )}
                  <details className="review-manage">
                    <summary>Revision details & removal</summary>
                    <p className="review-small">
                      SHA-256 <code>{revision.hash}</code>
                    </p>
                    <p className="review-small">
                      Frozen {dateLabel(revision.frozenAt)}. This records the
                      project fingerprint and rendered views; it does not store
                      a second editable project.
                    </p>
                    {confirmDelete ? (
                      <div>
                        <p>
                          Remove this revision and its {revision.notes.length}{" "}
                          notes from this project?
                        </p>
                        <button disabled={busy} onClick={removeRevision}>
                          Remove revision
                        </button>
                        <button onClick={() => setConfirmDelete(false)}>
                          Keep revision
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(true)}>
                        <Trash2 size={14} /> Remove review revision
                      </button>
                    )}
                  </details>
                </div>
              )}
              {tab === "Notes" && (
                <div
                  className="review-panel"
                  id="review-panel-notes"
                  role="tabpanel"
                  aria-labelledby="review-tab-notes"
                >
                  <div className="review-note-composer">
                    <div className="review-two-fields">
                      <label>
                        Attach to
                        <select
                          aria-label="Note view"
                          value={viewId}
                          onChange={(e) => {
                            setViewId(e.target.value);
                            const v = revision.views.find(
                              (v) => v.id === e.target.value,
                            );
                            if (v) setObjectName(v.objectName);
                          }}
                        >
                          <option value="">Entire revision</option>
                          {revision.views.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Author
                        <input
                          aria-label="Review note author"
                          maxLength={100}
                          value={author}
                          onChange={(e) => setAuthor(e.target.value)}
                        />
                      </label>
                    </div>
                    <label>
                      Object or area
                      <input
                        aria-label="Note object or area"
                        maxLength={100}
                        value={objectName}
                        onChange={(e) => setObjectName(e.target.value)}
                      />
                    </label>
                    <label>
                      Note
                      <textarea
                        aria-label="Review note"
                        maxLength={2000}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="What should be checked or changed?"
                      />
                    </label>
                    <button
                      className="review-primary"
                      disabled={
                        busy ||
                        !note.trim() ||
                        !objectName.trim() ||
                        !author.trim() ||
                        revision.notes.length >= REVIEW_LIMITS.notes
                      }
                      onClick={addNote}
                    >
                      <Plus size={16} /> Add note
                    </button>
                  </div>
                  <div className="review-note-heading">
                    <h3>Conversation</h3>
                    <select
                      aria-label="Filter review notes"
                      value={statusFilter}
                      onChange={(e) =>
                        setStatusFilter(e.target.value as typeof statusFilter)
                      }
                    >
                      <option value="open">Open notes</option>
                      <option value="resolved">Resolved notes</option>
                      <option value="all">All notes</option>
                    </select>
                  </div>
                  <div className="review-notes">
                    {revision.notes
                      .filter(
                        (n) =>
                          statusFilter === "all" || n.status === statusFilter,
                      )
                      .map((n) => (
                        <article
                          key={n.id}
                          className={`review-note ${n.status}`}
                        >
                          <div>
                            <strong>{n.objectName}</strong>
                            <span className="review-note-status">
                              {n.status}
                            </span>
                          </div>
                          <p>{n.text}</p>
                          <small>
                            {n.author} ·{" "}
                            {n.viewId
                              ? revision.views.find((v) => v.id === n.viewId)
                                  ?.name
                              : "Entire revision"}{" "}
                            · {dateLabel(n.createdAt)}
                          </small>
                          <button
                            disabled={busy}
                            onClick={() => {
                              try {
                                commit(
                                  setReviewNoteStatus(
                                    data,
                                    revision.hash,
                                    n.id,
                                    n.status === "open" ? "resolved" : "open",
                                  ),
                                );
                              } catch (e) {
                                report(errorLabel(e), true);
                              }
                            }}
                          >
                            {n.status === "open" ? (
                              <Check size={14} />
                            ) : (
                              <ArrowLeft size={14} />
                            )}
                            {n.status === "open"
                              ? "Mark resolved"
                              : "Reopen note"}
                          </button>
                        </article>
                      ))}
                  </div>
                  {!revision.notes.some(
                    (n) => statusFilter === "all" || n.status === statusFilter,
                  ) && (
                    <p className="review-empty-inline">
                      No {statusFilter === "all" ? "" : statusFilter} notes for
                      this revision.
                    </p>
                  )}
                  <section className="review-acknowledge">
                    <h3>Review acknowledgement</h3>
                    <p className="review-small">
                      Records the {revision.views.length} views currently saved
                      in this revision; future captures are not included. It is
                      not a signature, fit approval or manufacturing
                      certification.
                    </p>
                    <label>
                      Reviewer name
                      <input
                        aria-label="Acknowledgement reviewer name"
                        maxLength={100}
                        value={ackName}
                        onChange={(e) => setAckName(e.target.value)}
                      />
                    </label>
                    <p>“{REVIEW_ACKNOWLEDGEMENT}”</p>
                    <button
                      disabled={
                        !ackName.trim() ||
                        !revision.views.length ||
                        busy ||
                        revision.acknowledgements.length >= 20
                      }
                      onClick={() => {
                        try {
                          commit(
                            acknowledgeReview(
                              data,
                              revision.hash,
                              ackName.trim(),
                            ),
                          );
                          setAckName("");
                          report("Review acknowledgement recorded.");
                        } catch (e) {
                          report(errorLabel(e), true);
                        }
                      }}
                    >
                      Record acknowledgement
                    </button>
                    {revision.acknowledgements.map((a) => (
                      <p className="review-small" key={a.id}>
                        {a.name} · {dateLabel(a.at)}
                        <br />
                        {a.text}
                        <br />
                        Views:{" "}
                        {a.viewIds
                          .map(
                            (id) =>
                              revision.views.find((v) => v.id === id)?.name ??
                              "Unknown view",
                          )
                          .join(", ")}
                      </p>
                    ))}
                  </section>
                </div>
              )}
              {tab === "Share" && (
                <div
                  className="review-panel"
                  id="review-panel-share"
                  role="tabpanel"
                  aria-labelledby="review-tab-share"
                >
                  <h3>Choose exactly what to share</h3>
                  <p className="review-panel-intro">
                    Only checked rendered views are shared. Their view-specific
                    notes and all notes attached to the entire revision are
                    included. Original photos and editable project files stay
                    here.
                  </p>
                  <div className="review-share-grid">
                    {revision.views.map((v) => (
                      <label
                        className={shareIds.includes(v.id) ? "selected" : ""}
                        key={v.id}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Share ${v.name}`}
                          checked={shareIds.includes(v.id)}
                          onChange={(e) =>
                            setShareIds(
                              e.target.checked
                                ? [...shareIds, v.id]
                                : shareIds.filter((id) => id !== v.id),
                            )
                          }
                        />
                        <img src={v.png} alt="" />
                        <span>
                          <strong>{v.name}</strong>
                          <small>{v.objectName}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="review-share-summary">
                    <LockKeyhole size={22} />
                    <div>
                      <strong>
                        {shareIds.length} of {revision.views.length} views
                        selected
                      </strong>
                      <p>
                        Includes selected PNGs, their view-specific notes, all
                        revision-wide notes, a local review page, a manifest and
                        instructions. Acknowledgements are included only when
                        every view in their recorded scope is selected.
                      </p>
                      {revision.dimensions.map((d) => (
                        <p key={d.label}>
                          {d.label}: {d.valueMm} mm · {d.source}
                        </p>
                      ))}
                      <p>
                        The recipient adds feedback in the local page and sends
                        its JSON back. Importing it adds notes to this
                        fingerprint; geometry stays unchanged.
                      </p>
                    </div>
                  </div>
                  <button
                    className="review-primary"
                    disabled={busy || !shareIds.length}
                    onClick={() =>
                      void run(async () => {
                        const bytes = exportReviewBundle(
                          data,
                          revision.hash,
                          shareIds,
                        );
                        const result = await saveReviewBundle(
                          bytes,
                          `${revision.projectName}-${revision.label}`,
                        );
                        report(
                          result
                            ? `Review bundle saved with ${shareIds.length} selected views.`
                            : "Export cancelled.",
                        );
                      })
                    }
                  >
                    <Download size={16} /> Export selected review views
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="review-room-empty">
              <div className="review-empty-symbol">
                <LockKeyhole size={36} />
              </div>
              <p className="review-eyebrow">A CLEAR HANDOFF</p>
              <h2>Give feedback a fixed point.</h2>
              <p>
                Freeze your current project state and capture a rendered view.
                Add notes, choose what to share, then collect feedback against
                that exact version.
              </p>
              <div className="review-capture-fields">
                <label>
                  First view name
                  <input
                    aria-label="Review view name"
                    maxLength={100}
                    value={viewName}
                    onChange={(e) => setViewName(e.target.value)}
                  />
                </label>
                <label>
                  Object or area
                  <input
                    aria-label="Review object name"
                    maxLength={100}
                    value={objectName}
                    onChange={(e) => setObjectName(e.target.value)}
                  />
                </label>
              </div>
              <p className="review-small">
                Start with “Freeze & capture” on the left.
              </p>
            </div>
          )}
        </section>
      </div>
      <footer className="review-room-footer">
        <p
          role={error ? "alert" : "status"}
          className={error ? "review-error" : ""}
        >
          {message ||
            "Local by default · Selected views only · Feedback never changes geometry"}
        </p>
        <button disabled={busy} onClick={close}>
          Return to studio
        </button>
      </footer>
    </dialog>
  );
}
