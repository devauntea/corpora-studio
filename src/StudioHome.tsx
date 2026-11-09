import { CorporaMark } from "./CorporaMark";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Clock3,
  FolderOpen,
  PenTool,
  Scissors,
  Sparkles,
  X,
} from "lucide-react";
import { useDialogReturnFocus } from "./dialog-focus";
import {
  listWorkspace,
  readWorkspace,
  type WorkspaceEntry,
} from "./workspace-store";
import "./studio-home.css";

export const corporaManifesto = `Every body is a first draft.
Every draft begins as a thought,
every thought as an impulse,
and every impulse lives somewhere in the body.
No body comes out even.
One shoulder rides higher,
one leg carries more of the weight.
We drew the line on paper first,
flat and sure of itself,
then laid it on a body
and watched it learn to bend.
A sleeve has to clear the elbow.
A rose has to survive the knee.
The cloth and the needle
ask the same question of the skin:
will you carry me?
So we measure before we mark.
We fold the pattern, wrap the stencil,
try the pose, check the tone,
and only then
commit.
Corpora is plural on purpose.
No two bodies wear a thing the same way.
This is a studio for all of them.`;

export type StartTask = "tattoo" | "patterns" | "vectors";
export function StudioHome({
  name,
  start,
  resume,
  openFile,
  openLocal,
  library,
}: {
  name: string;
  start: (task: StartTask) => void;
  resume: () => void;
  openFile: () => void;
  openLocal: (content: string) => void;
  library: () => void;
}) {
  useDialogReturnFocus();
  const panel = useRef<HTMLElement>(null);
  const [recent, setRecent] = useState<WorkspaceEntry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    panel.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus();
    void listWorkspace()
      .then((entries) => {
        if (active)
          setRecent(
            entries
              .filter(
                (entry, i, all) =>
                  all.findIndex((e) => e.projectId === entry.projectId) === i,
              )
              .slice(0, 5),
          );
      })
      .catch(() => {
        if (active)
          setError(
            "Local copies are unavailable. You can still open a saved project file.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  const tasks = [
    {
      id: "tattoo" as const,
      icon: Sparkles,
      title: "Plan a tattoo",
      description:
        "Prepare your artwork, compose on a body, and review the placement.",
      output: "Body study · stencil · presentation",
      visual: "tattoo",
    },
    {
      id: "patterns" as const,
      icon: Scissors,
      title: "Draft a garment",
      description:
        "Start with measurements. Shape the pieces and check their construction.",
      output: "Cutting pattern · assembly plan",
      visual: "pattern",
    },
    {
      id: "vectors" as const,
      icon: PenTool,
      title: "Create a technical flat",
      description:
        "Draw the garment, define its details, and prepare a manufacturer handoff.",
      output: "Editable SVG · PDF technical pack",
      visual: "flat",
    },
  ];
  return (
    <div className="studio-home-backdrop">
      <section
        ref={panel}
        className="studio-home corpora-home"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-label="Studio home"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            resume();
          }
          if (e.key === "Tab") {
            const items = [
              ...e.currentTarget.querySelectorAll<HTMLElement>(
                "button:not(:disabled),input:not(:disabled),a[href],summary",
              ),
            ];
            if (e.shiftKey && document.activeElement === items[0]) {
              e.preventDefault();
              items.at(-1)?.focus();
            } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
              e.preventDefault();
              items[0]?.focus();
            }
          }
        }}
      >
        <header>
          <div className="home-wordmark">
            <CorporaMark className="home-corpora-mark" />
            <div>
              <strong>CORPORA</strong>
              <small>STUDIO</small>
            </div>
            <span>BODY · GARMENT · INK</span>
          </div>
          <button onClick={resume} aria-label="Close studio home">
            <X size={20} />
          </button>
        </header>
        <div className="home-intro home-corpora-hero">
          <div className="home-hero-copy">
            <span className="eyebrow">CORPORA STUDIO</span>
            <h1>Every body is a first draft.</h1>
            <p>
              A studio for what the body carries. Shape garments, compose ink,
              and let each design follow its own form.
            </p>
            <button className="home-resume" onClick={resume}>
              <span>
                <small>CONTINUE YOUR STUDY</small>
                <strong>{name}</strong>
              </span>
              <ArrowRight size={19} />
            </button>
          </div>
          <div className="home-contour-study" aria-hidden="true">
            <img src="/brand/corpora-contours.svg" alt="" />
            <div className="home-contour-caption">
              <span>STUDIES IN FORM</span>
              <span>001 / CONTINUITY</span>
            </div>
          </div>
        </div>
        <div className="home-collection-heading">
          <span>THREE WAYS TO BEGIN</span>
          <span>One practice. Many forms.</span>
        </div>
        <div className="home-task-grid">
          {tasks.map((task, index) => (
            <button
              key={task.id}
              className="home-task"
              onClick={() => start(task.id)}
            >
              <div
                className={`home-task-art ${task.visual}`}
                aria-hidden="true"
              >
                <TaskArt kind={task.visual} />
                <task.icon size={18} />
                <span className="home-task-index">0{index + 1}</span>
              </div>
              <div className="home-task-copy">
                <h2>
                  {task.title}
                  <ArrowUpRight size={19} />
                </h2>
                <p>{task.description}</p>
                <small>{task.output}</small>
              </div>
            </button>
          ))}
        </div>
        <details className="home-manifesto">
          <summary>
            <span>The Corpora manifesto</span>
            <span className="home-manifesto-prompt">
              A studio for all of them.
            </span>
          </summary>
          <div className="home-manifesto-body">
            <p>{corporaManifesto}</p>
            <span className="home-manifesto-signature">
              CORPORA STUDIO
              <br />
              BODY · GARMENT · INK
            </span>
          </div>
        </details>
        <div className="home-lower">
          <section className="home-recents">
            <div className="home-section-title">
              <h2>
                <Clock3 size={16} /> Pick up where you left off
              </h2>
              <button onClick={library}>
                All local projects <ArrowUpRight size={14} />
              </button>
            </div>
            {error && <p role="alert">{error}</p>}
            {!recent.length && !error && (
              <div className="home-no-recents">
                <FolderOpen size={22} />
                <p>
                  Your local projects will appear here.
                  <small>
                    Start a study or open an existing .formstudio file.
                  </small>
                </p>
              </div>
            )}
            {recent.map((entry) => (
              <button
                className="home-recent"
                key={entry.id}
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  setError("");
                  try {
                    openLocal(await readWorkspace(entry.id));
                  } catch (e) {
                    setError(String(e));
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <span className="home-recent-icon">
                  {entry.studio === "tattoo" ? (
                    <Sparkles size={18} />
                  ) : (
                    <Scissors size={18} />
                  )}
                </span>
                <span>
                  <strong>{entry.name}</strong>
                  <small>{entry.label}</small>
                </span>
                <time dateTime={new Date(entry.updated).toISOString()}>
                  {new Date(entry.updated).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </time>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </section>
          <aside className="home-file">
            <FolderOpen size={25} />
            <h2>Bring your work with you.</h2>
            <p>
              Open a saved project with its original artwork, measurements and
              review notes.
            </p>
            <button onClick={openFile}>
              Open project file <ArrowRight size={16} />
            </button>
            <small>Projects and recovery copies stay on this device.</small>
          </aside>
        </div>
      </section>
    </div>
  );
}

function TaskArt({ kind }: { kind: string }) {
  const src =
    kind === "pattern"
      ? "/studio-previews/pattern.svg"
      : kind === "flat"
        ? "/studio-previews/technical-flat.svg"
        : "/sculpts/sculpt-arm.png";
  return <img className={`home-source-preview ${kind}`} src={src} alt="" />;
}
