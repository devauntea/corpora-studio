import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Search, X } from "lucide-react";
import {
  humanBody,
  sculptBody,
  LATEST_BODY_REVISION,
  type Body,
  type HumanBody,
} from "./domain";
import {
  sculptGroups,
  sculptGroupFor,
  type SculptEntry,
  type SculptId,
} from "./sculpt-catalog";
import "./BodyLibrary.css";
import { SculptPosePicker } from "./SculptLibrary";

type Section = HumanBody["section"];
type LibraryFilter = "all" | "anatomical" | "imported";
type Choice =
  | {
      kind: "anatomical";
      id: Section;
      name: string;
      short: string;
      description: string;
      movement: string;
      keywords: string;
    }
  | {
      kind: "imported";
      id: SculptId;
      name: string;
      short: string;
      description: string;
      entry: SculptEntry;
    };

const anatomicalChoices: Choice[] = [
  {
    kind: "anatomical",
    id: "upper-body",
    name: "Upper body",
    short: "Torso only",
    description:
      "Neck, shoulders, chest, abdomen and back. Arms are a separate model.",
    movement: "Relaxed, chest flex and back flex previews.",
    keywords: "torso chest back stomach abdomen shoulder neck",
  },
  {
    kind: "anatomical",
    id: "full-arm",
    name: "Full arm",
    short: "Shoulder to fingertips",
    description: "A complete shoulder, upper arm, elbow, forearm and hand.",
    movement: "Elbow flex, shoulder elevation and forearm rotation.",
    keywords: "sleeve shoulder biceps triceps elbow forearm wrist hand",
  },
  {
    kind: "anatomical",
    id: "full-leg",
    name: "Full leg",
    short: "Thigh to toes",
    description: "A complete thigh, knee, calf, ankle and foot.",
    movement: "Knee flex with relaxed and bent previews.",
    keywords: "thigh quad hamstring calf knee ankle foot feet toes",
  },
  {
    kind: "anatomical",
    id: "full-body",
    name: "Full body",
    short: "Neck to feet",
    description:
      "Connected torso, pelvis, both arms and both legs. No head is included.",
    movement:
      "Individual arm controls, chest flex, back flex and double biceps.",
    keywords: "whole connected suit both arms legs pose",
  },
  {
    kind: "anatomical",
    id: "neck",
    name: "Neck & clavicles",
    short: "A focused neck study",
    description:
      "The neck and clavicular area, for designs around the collar and neckline.",
    movement:
      "Fixed neck position; adjustable body build and muscle definition.",
    keywords: "collar collarbone clavicle throat nape",
  },
];
const importedChoices: Choice[] = sculptGroups.map((group) => ({
  kind: "imported",
  id: group.id,
  name: group.name,
  short:
    group.entries.length > 1
      ? `${group.entries.length} ${group.entries[0].variantLabel ? "body sections" : "sculpted poses"}`
      : group.entries[0].section.replaceAll("-", " "),
  description: group.entries[0].description,
  entry: group.entries[0],
}));
const choices = [...anatomicalChoices, ...importedChoices];
const keyFor = (choice: Choice) => `${choice.kind}:${choice.id}`;

/** Preview pixels come from the same neutral meshes used by the editor. */
function ModelPreview({
  section,
  sex,
  physique,
  side = "left",
}: {
  section: Section;
  sex: "male" | "female";
  physique: "fit" | "average";
  side?: "left" | "right";
}) {
  return (
    <img
      className="body-library-native-preview"
      src={`/studio-previews/body/${section}-${sex}-${physique}.webp`}
      alt=""
      loading="lazy"
      style={{
        transform:
          side === "right" && ["full-arm", "full-leg"].includes(section)
            ? "scaleX(-1)"
            : undefined,
      }}
    />
  );
}

export function BodyLibrary({
  current,
  choose,
  close,
}: {
  current: Body;
  choose: (body: Body) => void;
  close: () => void;
}) {
  const currentKey =
    current.kind === "human-v1"
      ? `${current.model?.sculptId ? "imported" : "anatomical"}:${sculptGroupFor(current.model?.sculptId)?.id ?? current.section}`
      : "anatomical:full-arm";
  const nativeCurrent =
    current.kind === "human-v1" && !current.model?.sculptId
      ? current
      : undefined;
  const [variant, setVariant] = useState<SculptId | undefined>(
    current.kind === "human-v1" ? current.model?.sculptId : undefined,
  );
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState(currentKey);
  const [sex, setSex] = useState<"male" | "female">(
    nativeCurrent?.model?.sex ?? "male",
  );
  const [physique, setPhysique] = useState<"fit" | "average">(
    nativeCurrent?.model?.physique ?? "fit",
  );
  const [side, setSide] = useState<"left" | "right">(current.side);
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const returnFocus = useRef(document.activeElement);
  const titleId = useId();
  const descriptionId = useId();
  const visible = useMemo(
    () =>
      choices.filter((choice) => {
        if (filter !== "all" && choice.kind !== filter) return false;
        const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const text =
          `${choice.name} ${choice.short} ${choice.description} ${choice.kind} ${choice.kind === "anatomical" ? choice.keywords : choice.entry.author}`.toLowerCase();
        return words.every((word) => text.includes(word));
      }),
    [filter, query],
  );
  const selected =
    visible.find((choice) => keyFor(choice) === selection) ?? visible[0];
  const selectedEntry =
    selected?.kind === "imported"
      ? (sculptGroupFor(selected.id)?.entries.find((e) => e.id === variant) ??
        selected.entry)
      : undefined;
  useEffect(() => {
    const modal = dialog.current;
    if (modal && !modal.open) modal.showModal();
    search.current?.focus();
    return () => {
      modal?.close();
      const previous = returnFocus.current;
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  const useModel = () => {
    if (!selected) return;
    if (selected.kind === "imported") {
      choose(sculptBody(selectedEntry!.id, current));
    } else {
      const body = humanBody(selected.id, current);
      body.side = side;
      body.build = nativeCurrent?.build ?? 1;
      body.muscularity =
        nativeCurrent && nativeCurrent.model?.physique === physique
          ? nativeCurrent.muscularity
          : physique === "fit"
            ? 1
            : 0;
      body.anatomy = nativeCurrent?.anatomy ?? false;
      body.model = {
        revision: LATEST_BODY_REVISION,
        sex,
        physique,
        anatomyOpacity: nativeCurrent?.model?.anatomyOpacity ?? 0.85,
      };
      choose(body);
    }
    close();
  };

  return (
    <dialog
      ref={dialog}
      role="dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="body-library-dialog"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
        if (event.key !== "Tab") return;
        const elements = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
          ) ?? [],
        ).filter((element) => element.getClientRects().length > 0);
        const first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <header className="body-library-header">
        <div>
          <span className="body-library-eyebrow">
            CORPORA STUDIO / MODEL LIBRARY
          </span>
          <h1 id={titleId}>Find your canvas.</h1>
          <p id={descriptionId}>
            Choose a body section for your next placement.
          </p>
        </div>
        <button
          className="body-library-close"
          onClick={close}
          aria-label="Close model library"
        >
          <X size={19} />
        </button>
      </header>
      <div className="body-library-toolbar">
        <div
          className="body-library-filters"
          role="group"
          aria-label="Model source"
        >
          {(
            [
              ["all", "All models", choices.length],
              ["anatomical", "Anatomical", anatomicalChoices.length],
              ["imported", "Imported sculpts", importedChoices.length],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
              <span>{count}</span>
            </button>
          ))}
        </div>
        <label className="body-library-search">
          <Search size={16} />
          <input
            ref={search}
            aria-label="Search body models"
            placeholder="Search body parts…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              aria-label="Clear model search"
              onClick={() => {
                setQuery("");
                search.current?.focus();
              }}
            >
              <X size={14} />
            </button>
          )}
        </label>
      </div>
      <div className="body-library-layout">
        <section className="body-library-results" aria-label="Body models">
          <div className="body-library-results-heading">
            <span>
              {filter === "all"
                ? "The collection"
                : filter === "anatomical"
                  ? "Adjustable anatomical models"
                  : "Imported sculpt studies"}
            </span>
            <small aria-live="polite">
              {visible.length} {visible.length === 1 ? "model" : "models"}
            </small>
          </div>
          {visible.length ? (
            <ul className="body-library-grid">
              {visible.map((choice) => (
                <li key={keyFor(choice)}>
                  <button
                    className="body-library-card"
                    aria-pressed={
                      selected && keyFor(selected) === keyFor(choice)
                    }
                    onClick={() => setSelection(keyFor(choice))}
                  >
                    <div className="body-library-card-image">
                      {choice.kind === "imported" ? (
                        <img
                          src={choice.entry.thumbnail}
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <ModelPreview
                          section={choice.id}
                          sex={sex}
                          physique={physique}
                        />
                      )}
                      <span className="body-library-card-type">
                        {choice.kind === "imported"
                          ? "FIXED POSE"
                          : "ANATOMICAL"}
                      </span>
                      {selected && keyFor(selected) === keyFor(choice) && (
                        <span className="body-library-card-check">
                          <Check size={13} />
                        </span>
                      )}
                    </div>
                    <div className="body-library-card-copy">
                      <strong>{choice.name}</strong>
                      <span>{choice.short}</span>
                      {keyFor(choice) === currentKey && (
                        <small>
                          <Check size={11} aria-hidden="true" /> In this study
                        </small>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="body-library-empty">
              <Search size={28} />
              <h2>No matching models</h2>
              <p>Try a body part like “arm”, “torso” or “foot”.</p>
              <button
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                  search.current?.focus();
                }}
              >
                Show all models
              </button>
            </div>
          )}
        </section>
        <aside
          className="body-library-detail"
          aria-label="Selected model details"
        >
          {selected ? (
            <>
              <div className="body-library-detail-preview">
                {selected.kind === "imported" ? (
                  <img
                    src={selectedEntry!.thumbnail}
                    alt={`${selected.name} preview`}
                  />
                ) : (
                  <ModelPreview
                    section={selected.id}
                    sex={sex}
                    physique={physique}
                    side={side}
                  />
                )}
                <span>
                  {selected.kind === "imported"
                    ? "SCULPT PREVIEW"
                    : "NEUTRAL MODEL PREVIEW"}
                </span>
              </div>
              <div className="body-library-detail-copy">
                <span className="body-library-eyebrow">
                  {selected.kind === "imported"
                    ? "IMPORTED SCULPT"
                    : "ANATOMICAL MODEL"}
                </span>
                <h2>{selected.name}</h2>
                <p>{selected.description}</p>
                {selected.kind === "anatomical" ? (
                  <>
                    <p className="body-library-preview-note">
                      Neutral pose · standard build. Your measurements and pose
                      are applied in the studio.
                    </p>
                    <div className="body-library-options">
                      <fieldset>
                        <legend>Body</legend>
                        <div>
                          {(["male", "female"] as const).map((value) => (
                            <button
                              key={value}
                              aria-pressed={sex === value}
                              onClick={() => setSex(value)}
                            >
                              {value === "male" ? "Male" : "Female"}
                            </button>
                          ))}
                        </div>
                      </fieldset>
                      <fieldset>
                        <legend>Build</legend>
                        <div>
                          {(["fit", "average"] as const).map((value) => (
                            <button
                              key={value}
                              aria-pressed={physique === value}
                              onClick={() => setPhysique(value)}
                            >
                              {value === "fit" ? "Fit" : "Average"}
                            </button>
                          ))}
                        </div>
                      </fieldset>
                    </div>
                    {["full-arm", "full-leg"].includes(selected.id) && (
                      <fieldset className="body-library-side">
                        <legend>Side</legend>
                        <div>
                          {(["left", "right"] as const).map((value) => (
                            <button
                              key={value}
                              aria-pressed={side === value}
                              onClick={() => setSide(value)}
                            >
                              {value === "left" ? "Left" : "Right"}
                            </button>
                          ))}
                        </div>
                      </fieldset>
                    )}
                    <dl>
                      <div>
                        <dt>Movement</dt>
                        <dd>{selected.movement}</dd>
                      </div>
                      <div>
                        <dt>Surface</dt>
                        <dd>Skin tones and a toggleable muscle guide.</dd>
                      </div>
                    </dl>
                  </>
                ) : (
                  <>
                    <dl>
                      <div>
                        <dt>Movement</dt>
                        <dd>
                          Fixed sculpted pose. Overall size can be adjusted.
                        </dd>
                      </div>
                      <div>
                        <dt>Surface</dt>
                        <dd>
                          {selected.id === "anatomical-arm"
                            ? "Original anatomical texture. Muscle colors are baked in; no toggleable muscle guide."
                            : "Original sculpt finish. No toggleable muscle guide."}
                        </dd>
                      </div>
                    </dl>
                    <SculptPosePicker
                      selected={selectedEntry?.id}
                      choose={setVariant}
                    />
                    <p className="body-library-credit">
                      {selected.entry.source ? (
                        <>
                          Sculpt by{" "}
                          <a
                            href={selected.entry.source}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {selected.entry.author}
                          </a>
                        </>
                      ) : (
                        <>Created by {selected.entry.author} using Tripo.</>
                      )}
                    </p>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="body-library-detail-empty">
              <span>MODEL DETAILS</span>
              <p>
                Choose a model from the collection to see its coverage and
                controls.
              </p>
            </div>
          )}
        </aside>
      </div>
      <footer className="body-library-footer">
        <p>
          {selected ? (
            <>
              Switching models updates this study.
              <br />
              <span>Review your tattoo placement after switching.</span>
            </>
          ) : (
            "Your current study is unchanged."
          )}
        </p>
        <div>
          <button className="body-library-cancel" onClick={close}>
            Cancel
          </button>
          <button
            className="body-library-use"
            onClick={useModel}
            disabled={!selected}
          >
            Use {selected?.name.toLowerCase() ?? "model"}
            <ArrowRight size={17} />
          </button>
        </div>
      </footer>
    </dialog>
  );
}
