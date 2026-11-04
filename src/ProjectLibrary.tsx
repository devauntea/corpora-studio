import { CheckpointCompare } from "./CheckpointCompare";
import { parseProject } from "./domain";
import { useEffect, useState } from "react";
import { FolderOpen, X, Trash2, Save } from "lucide-react";
import {
  deleteWorkspace,
  listWorkspace,
  putWorkspace,
  readWorkspace,
  type WorkspaceEntry,
} from "./workspace-store";
import type { Project } from "./domain";
export function ProjectLibrary({
  project,
  studio,
  open,
  close,
}: {
  project: Project;
  studio: "tattoo" | "fashion";
  open: (content: string) => void;
  close: () => void;
}) {
  const [comparison, setComparison] = useState<{
    name: string;
    project: Project;
  } | null>(null);
  const [entries, setEntries] = useState<WorkspaceEntry[]>([]),
    [query, setQuery] = useState(""),
    [label, setLabel] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [remove, setRemove] = useState<string | null>(null);
  const refresh = () =>
    listWorkspace()
      .then(setEntries)
      .catch((e) => setError(String(e)));
  useEffect(() => {
    void refresh();
    const first = document.querySelector<HTMLElement>(
      '[aria-label="Close project library"]',
    );
    first?.focus();
  }, []);
  const checkpoint = async () => {
    setBusy(true);
    setError("");
    try {
      const content = JSON.stringify(project),
        updated = Date.now();
      await putWorkspace(
        {
          id: crypto.randomUUID(),
          projectId: project.id,
          name: project.name,
          label:
            label.trim() || `Checkpoint ${new Date(updated).toLocaleString()}`,
          kind: "checkpoint",
          updated,
          bytes: content.length * 2,
          studio,
        },
        content,
      );
      setLabel("");
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop library-backdrop">
      {comparison && (
        <CheckpointCompare
          left={comparison}
          right={{ name: "Current project", project }}
          studio={studio}
          close={() => setComparison(null)}
        />
      )}
      <section
        className="project-library"
        role="dialog"
        aria-modal="true"
        aria-label="Project library"
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
          if (e.key === "Tab") {
            const nodes = [
                ...e.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not(:disabled),input:not(:disabled)",
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
            <span className="eyebrow">ON THIS DEVICE</span>
            <h2>Project library</h2>
          </div>
          <button aria-label="Close project library" onClick={close}>
            <X size={20} />
          </button>
        </header>
        <p className="library-description">
          Recover your latest work or keep a named checkpoint before exploring a
          new direction. Opening a local copy leaves your saved files unchanged.
        </p>
        <div className="checkpoint-form">
          <input
            aria-label="Checkpoint name"
            maxLength={100}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Name this version, e.g. Sleeve study 02"
          />
          <button disabled={busy} onClick={() => void checkpoint()}>
            <Save size={15} /> Keep checkpoint
          </button>
        </div>
        <input
          className="library-search"
          aria-label="Search local projects"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects and checkpoints…"
        />
        {error && (
          <p role="alert" className="fashion-warning">
            {error}
          </p>
        )}
        <div className="library-entries">
          {entries
            .filter((e) =>
              `${e.name} ${e.label}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((entry) => (
              <article className="library-entry" key={entry.id}>
                <div>
                  <small>
                    {entry.kind === "recovery"
                      ? "LATEST LOCAL COPY"
                      : "CHECKPOINT"}{" "}
                    · {entry.studio.toUpperCase()}
                  </small>
                  <h3>{entry.name}</h3>
                  <p>{entry.label}</p>
                  <time>
                    {new Date(entry.updated).toLocaleString()} ·{" "}
                    {(entry.bytes / 1_000_000).toFixed(1)} MB
                  </time>
                </div>
                <div className="library-entry-actions">
                  <button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const content = await readWorkspace(entry.id);
                        open(content);
                      } catch (e) {
                        setError(String(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <FolderOpen size={15} /> Open
                  </button>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        setComparison({
                          name: entry.label,
                          project: await parseProject(
                            await readWorkspace(entry.id),
                          ),
                        });
                      } catch (e) {
                        setError(String(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Compare with current
                  </button>
                  <button
                    aria-label={`Remove local copy ${entry.label}`}
                    disabled={busy}
                    onClick={async () => {
                      if (remove !== entry.id) {
                        setRemove(entry.id);
                        return;
                      }
                      setBusy(true);
                      try {
                        await deleteWorkspace(entry.id);
                        setRemove(null);
                        await refresh();
                      } catch (e) {
                        setError(String(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Trash2 size={14} />
                    {remove === entry.id ? "Confirm removal" : "Remove"}
                  </button>
                </div>
              </article>
            ))}
          {!entries.length && (
            <div className="library-empty">
              Your edited projects will appear here automatically.
              <br />
              Keep a checkpoint to preserve the current version.
            </div>
          )}
        </div>
        <footer>
          Local copies use this app’s storage. Save a .formstudio file for a
          portable backup.
        </footer>
      </section>
    </div>
  );
}
