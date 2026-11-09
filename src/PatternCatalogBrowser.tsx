import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { patternCatalog, designIds, type DesignId } from "./pattern-catalog";
import { measurementFields, type Fashion } from "./fashion-model";
import {
  starterProfile,
  sizingSources,
  type StarterId,
  type StarterBody,
  type StarterSize,
} from "./starter-sizing";
import { patternPreview } from "./pattern-preview";
import { requiredMeasures } from "./design-adapters";
import "./pattern-catalog-browser.css";

export function PatternCatalogBrowser({
  value,
  initialSize,
  onApply,
  close,
}: {
  value: Fashion;
  initialSize: StarterId;
  onApply: (design: DesignId, size: StarterId | null) => void;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [chosen, setChosen] = useState<DesignId>(value.design ?? "teagan");
  const [size, setSize] = useState<StarterId>(initialSize);
  const [useStarter, setUseStarter] = useState(true);
  const [construction, setConstruction] = useState(false);
  const profile = starterProfile(size);
  const result = useMemo(
    () => patternPreview(chosen, size, construction),
    [chosen, size, construction],
  );
  const matches = designIds.filter(
    (id) =>
      (category === "All" || patternCatalog[id].category === category) &&
      query
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .every((term) =>
          `${patternCatalog[id].name} ${patternCatalog[id].category} ${patternCatalog[id].description}`
            .toLowerCase()
            .includes(term),
        ),
  );
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    search.current?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  const required = requiredMeasures(chosen);
  const missing = required.filter(
    (k) =>
      value.measurements[k as keyof typeof value.measurements] === undefined,
  );
  return (
    <dialog
      ref={dialog}
      className="pattern-catalog-dialog"
      aria-label="Pattern catalog"
      onCancel={close}
    >
      <header>
        <div>
          <span className="eyebrow">PATTERNS / {designIds.length} DESIGNS</span>
          <h2>Find your starting shape.</h2>
          <p>
            Actual drafted pieces. Explore sizes before changing your project.
          </p>
        </div>
        <button onClick={close} aria-label="Close pattern library">
          <X size={19} />
        </button>
      </header>
      <div className="pattern-catalog-toolbar">
        <label className="pattern-catalog-search">
          <Search size={16} />
          <input
            ref={search}
            aria-label="Search pattern library"
            placeholder="Search by name, garment or category"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          Category
          <select
            aria-label="Browse pattern category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option>All</option>
            {[
              ...new Set(Object.values(patternCatalog).map((p) => p.category)),
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <span aria-live="polite">{matches.length} designs</span>
      </div>
      <div className="pattern-catalog-content">
        <div
          className="pattern-preview-grid"
          aria-label="Drafted pattern previews"
        >
          {matches.map((id) => (
            <PatternCard
              key={`${id}:${size}`}
              id={id}
              size={size}
              active={chosen === id}
              onClick={() => setChosen(id)}
            />
          ))}
          {!matches.length && (
            <div className="pattern-catalog-empty">
              <b>No patterns match.</b>
              <p>Try another garment name or category.</p>
              <button
                onClick={() => {
                  setQuery("");
                  setCategory("All");
                }}
              >
                Clear library filters
              </button>
            </div>
          )}
        </div>
        <aside className="pattern-catalog-detail">
          <span className="eyebrow">{patternCatalog[chosen].category}</span>
          <h3>{patternCatalog[chosen].name.split(" · ")[0]}</h3>
          <p>{patternCatalog[chosen].description}</p>
          <div className="pattern-catalog-hero">
            {result.url ? (
              <img
                src={result.url}
                alt={`${patternCatalog[chosen].name} drafted preview`}
              />
            ) : (
              <p role="alert">{result.error}</p>
            )}
          </div>
          <div className="pattern-preview-detail-tools">
            <b>{result.pieces} pattern pieces</b>
            <button
              type="button"
              aria-pressed={construction}
              onClick={() => setConstruction(!construction)}
            >
              Construction lines
            </button>
          </div>
          <p className="pattern-preview-note">
            Seam outlines · not print scale. Construction lines show cutting
            allowances and guides.
          </p>
          <div className="starter-picker">
            <label>
              Body profile
              <select
                aria-label="Preview body profile"
                value={profile.body}
                onChange={(e) =>
                  setSize(
                    `${e.target.value as StarterBody}-${profile.size.toLowerCase()}` as StarterId,
                  )
                }
              >
                <option value="male">Male starter</option>
                <option value="female">Female starter</option>
              </select>
            </label>
            <div role="group" aria-label="Preview starter size">
              {(["S", "M", "L"] as StarterSize[]).map((s) => (
                <button
                  key={s}
                  aria-pressed={profile.size === s}
                  onClick={() =>
                    setSize(`${profile.body}-${s.toLowerCase()}` as StarterId)
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <p className="starter-summary">
            {profile.measurements.chest / 10} cm chest / bust ·{" "}
            {profile.measurements.waist / 10} cm waist ·{" "}
            {profile.measurements.seat / 10} cm seat
          </p>
          <p className="starter-explanation">
            {profile.sourceSize} chart anchors, with estimated secondary
            measurements. Preview fit only; check your measurements before
            cutting.
          </p>
          {chosen === "otis" && (
            <p className="starter-alert">
              Otis is a baby romper. Adult profiles show its geometry only;
              enter the child’s waist before making this design.
            </p>
          )}
          <details className="starter-evidence">
            <summary>Measurement sources & estimates</summary>
            <p>
              <a href={sizingSources.chart} target="_blank" rel="noreferrer">
                Published size chart
              </a>{" "}
              ·{" "}
              <a
                href={sizingSources.landmarks}
                target="_blank"
                rel="noreferrer"
              >
                Measurement landmarks
              </a>
            </p>
            <dl>
              {measurementFields
                .filter(([k]) => required.includes(k))
                .map(([k, label]) => (
                  <div key={k}>
                    <dt>
                      {label}{" "}
                      <b>
                        {profile.measurements[k]}
                        {k === "shoulderSlope" ? "°" : " mm"}
                      </b>
                    </dt>
                    <dd>
                      <strong>
                        {profile.evidence[k].kind === "chart"
                          ? "Chart value"
                          : "Derived estimate"}
                      </strong>{" "}
                      — {profile.evidence[k].basis}
                    </dd>
                  </div>
                ))}
            </dl>
          </details>
          <p className="starter-explanation">
            Drafted locally with FreeSewing · MIT. 2D pattern preview; supported
            3D drape is available from the workspace.
          </p>
        </aside>
      </div>
      <footer>
        <div className="starter-apply-summary">
          <label className="starter-apply-choice">
            <input
              type="checkbox"
              checked={useStarter}
              onChange={(e) => setUseStarter(e.target.checked)}
            />
            Apply this starter size
          </label>
          <p className="starter-explanation">
            {useStarter
              ? "Your current measurements will be kept as a project profile. Custom pieces and construction notes stay saved."
              : missing.length
                ? `${missing.length} measurements are missing from your current profile. Complete them after choosing the design.`
                : "Your current measurements will be used when the design opens. The preview above uses the selected starter size."}
          </p>
        </div>
        <button
          className="primary"
          disabled={!!result.error}
          onClick={() => onApply(chosen, useStarter ? size : null)}
        >
          Use this pattern <ArrowRight size={15} />
        </button>
      </footer>
    </dialog>
  );
}
function PatternCard({
  id,
  size,
  active,
  onClick,
}: {
  id: DesignId;
  size: StarterId;
  active: boolean;
  onClick: () => void;
}) {
  const card = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "150px" },
    );
    if (card.current) observer.observe(card.current);
    return () => observer.disconnect();
  }, []);
  const result = useMemo(
    () => (visible ? patternPreview(id, size) : null),
    [visible, id, size],
  );
  return (
    <button
      ref={card}
      className="pattern-preview-card"
      aria-label={`Preview ${patternCatalog[id].name}`}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="pattern-card-image">
        <span className="pattern-card-number" aria-hidden="true">
          {String(designIds.indexOf(id) + 1).padStart(2, "0")}
        </span>
        {active && (
          <span className="pattern-card-selected" aria-hidden="true">
            Selected
          </span>
        )}
        {result?.url ? (
          <img src={result.url} alt="" />
        ) : (
          <span>
            {result?.error ? "Preview unavailable" : "Drafting preview…"}
          </span>
        )}
      </span>
      <span className="pattern-card-copy">
        <span className="pattern-card-category">
          {patternCatalog[id].category}
        </span>
        <b>{patternCatalog[id].name.split(" · ")[0]}</b>
        <small>{patternCatalog[id].description}</small>
        <span>
          {result?.pieces
            ? `${result.pieces} drafted pieces`
            : "Drafted to measure"}
        </span>
      </span>
    </button>
  );
}
