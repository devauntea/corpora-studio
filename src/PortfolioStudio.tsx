import { useDialogReturnFocus } from "./dialog-focus";
import { useEffect, useRef, useState } from "react";
import type { Project } from "./domain";
import { portfolioFiles, type PortfolioOptions } from "./portfolio-export";
import { archiveInWorker } from "./compute-jobs";
import { savePortfolio } from "./io";
import "./stencil.css";
export function PortfolioStudio({
  project,
  close,
}: {
  project: Project;
  close: () => void;
}) {
  useDialogReturnFocus();
  const [options, setOptions] = useState<PortfolioOptions>({
      title: project.name,
      description: "Selected tattoo and fashion studies made in Form Studio.",
      surface: true,
      pattern: !!project.fashion,
      photos: false,
      anatomy: false,
    }),
    [progress, setProgress] = useState<number | null>(null),
    [message, setMessage] = useState(""),
    [previews, setPreviews] = useState<{ url: string; title: string }[]>([]);
  const controller = useRef<AbortController | null>(null),
    dialog = useRef<HTMLElement>(null),
    urls = useRef<string[]>([]);
  useEffect(() => {
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      controller.current?.abort();
      urls.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);
  const build = async () => {
    controller.current?.abort();
    const c = (controller.current = new AbortController());
    setProgress(0);
    setMessage("");
    try {
      const { files, manifest } = await portfolioFiles(
        project,
        options,
        c.signal,
        setProgress,
      );
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      urls.current = [];
      setPreviews(
        manifest.works.map((w) => {
          const url = URL.createObjectURL(
            new Blob([files[w.image] as Uint8Array<ArrayBuffer>], {
              type: "image/png",
            }),
          );
          urls.current.push(url);
          return { url, title: w.title };
        }),
      );
      const zip = await archiveInWorker(files, { signal: c.signal });
      if (c.signal.aborted) return;
      const saved = await savePortfolio(zip, options.title);
      if (saved)
        setMessage(
          "Portfolio ZIP saved. It contains a standalone gallery, selected images, and metadata. Review the images before sharing.",
        );
    } catch (e) {
      setMessage(
        (e as Error).name === "AbortError" ? "Export cancelled." : String(e),
      );
    } finally {
      if (controller.current === c) setProgress(null);
    }
  };
  return (
    <div className="modal-backdrop stencil-backdrop">
      <section
        className="stencil-studio"
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Export portfolio"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            close();
          }
          if (e.key === "Tab") {
            const ns = [
                ...e.currentTarget.querySelectorAll<HTMLElement>(
                  'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
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
            <span className="eyebrow">FINISHED WORK / STATIC SHOWCASE</span>
            <h2>Export a portfolio collection</h2>
          </div>
          <button onClick={close}>Close portfolio export</button>
        </header>
        <div className="stencil-body">
          <aside>
            <label>
              Collection title
              <input
                aria-label="Portfolio title"
                maxLength={100}
                value={options.title}
                onChange={(e) =>
                  setOptions({ ...options, title: e.target.value })
                }
              />
            </label>
            <label>
              Collection description
              <textarea
                aria-label="Portfolio description"
                maxLength={1500}
                value={options.description}
                onChange={(e) =>
                  setOptions({ ...options, description: e.target.value })
                }
              />
            </label>
            {(
              [
                ["surface", "Four body views"],
                ["pattern", "Pattern study"],
                ["photos", "Include body photograph mockups"],
                ["anatomy", "Show muscle guide in body views"],
              ] as const
            ).map(([k, label]) => (
              <label key={k}>
                <input
                  type="checkbox"
                  checked={options[k]}
                  disabled={
                    (k === "pattern" && !project.fashion) ||
                    (k === "photos" && !project.photos.length)
                  }
                  onChange={(e) =>
                    setOptions({ ...options, [k]: e.target.checked })
                  }
                />
                {label}
              </label>
            ))}
            <p>
              Body photographs are excluded by default. Selected mockups are
              flattened into exported images. Review them before sharing.
            </p>
            <p>
              The ZIP opens as a static gallery and includes images plus JSON
              metadata. Exporting does not publish or upload anything.
            </p>
            <button disabled={progress !== null} onClick={() => void build()}>
              Export portfolio ZIP
            </button>
            {progress !== null && (
              <>
                <progress value={progress} max={1} />
                <button onClick={() => controller.current?.abort()}>
                  Cancel portfolio export
                </button>
              </>
            )}
          </aside>
          <div
            className="portfolio-preview"
            tabIndex={0}
            aria-label="Exported collection preview"
          >
            <p role="status">
              {message || "Your exported collection will appear here."}
            </p>
            <div className="portfolio-grid">
              {previews.map((p) => (
                <figure key={p.url}>
                  <img src={p.url} alt={p.title} />
                  <figcaption>{p.title}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
        <footer>
          <p>
            Editable project data and raw photo files are kept out of the
            bundle. The gallery is separate from the desktop editor.
          </p>
        </footer>
      </section>
    </div>
  );
}
