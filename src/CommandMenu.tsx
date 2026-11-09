import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Search, X } from "lucide-react";
export type StudioCommand = {
  id: string;
  label: string;
  description: string;
  keys?: string;
  run: () => void;
  disabled?: boolean;
};
export function CommandMenu({
  commands,
  close,
}: {
  commands: StudioCommand[];
  close: () => void;
}) {
  const [query, setQuery] = useState(""),
    [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const shown = commands.filter((c) =>
    `${c.label} ${c.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    panel.current
      ?.querySelector(".command-results .current")
      ?.scrollIntoView({ block: "nearest" });
  }, [active, query]);
  const run = (c: StudioCommand) => {
    if (!c.disabled) {
      close();
      c.run();
    }
  };
  return (
    <div
      className="command-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="command-menu"
        ref={panel}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="command-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            close();
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) =>
              shown.length
                ? (i + (e.key === "ArrowDown" ? 1 : -1) + shown.length) %
                  shown.length
                : 0,
            );
          }
          if (
            e.key === "Enter" &&
            e.target === input.current &&
            shown[active]
          ) {
            e.preventDefault();
            run(shown[active]);
          }
          if (e.key === "Tab") {
            const focus = [
              ...panel.current!.querySelectorAll<HTMLElement>(
                "input,button:not(:disabled)",
              ),
            ];
            if (e.shiftKey && document.activeElement === focus[0]) {
              e.preventDefault();
              focus.at(-1)?.focus();
            } else if (!e.shiftKey && document.activeElement === focus.at(-1)) {
              e.preventDefault();
              focus[0]?.focus();
            }
          }
        }}
      >
        <h2 id="command-title" className="sr-only">
          Quick actions
        </h2>
        <div className="command-search">
          <Search size={20} />
          <input
            ref={input}
            aria-label="Search quick actions"
            placeholder="Where would you like to go?"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            aria-controls="command-results"
          />
          <button aria-label="Close quick actions" onClick={close}>
            <X size={18} />
          </button>
        </div>
        <div className="command-results" id="command-results">
          {shown.map((c, i) => (
            <button
              key={c.id}
              disabled={c.disabled}
              className={active === i ? "current" : ""}
              onMouseEnter={() => setActive(i)}
              onClick={() => run(c)}
            >
              <span>
                <strong>{c.label}</strong>
                <small>{c.description}</small>
              </span>
              {c.keys ? <kbd>{c.keys}</kbd> : <ArrowUpRight size={16} />}
            </button>
          ))}
          {!shown.length && <p>No actions match “{query}”.</p>}
        </div>
        <footer>
          <span>↑ ↓ to navigate · Enter to open</span>
          <kbd>Esc</kbd> to close
        </footer>
      </div>
    </div>
  );
}
