import { sculptGroups, sculptGroupFor, type SculptId } from "./sculpt-catalog";
import "./sculpt-library.css";

export function SculptLibrary({
  selected,
  choose,
}: {
  selected?: SculptId;
  choose: (id: SculptId) => void;
}) {
  return (
    <details className="sculpt-library" open={selected ? true : undefined}>
      <summary>
        Imported sculpts <span>{sculptGroups.length} models</span>
      </summary>
      <p className="field-note">
        Detailed, fixed-pose surfaces for tattoo placement.
      </p>
      <div className="sculpt-grid" aria-label="Imported sculpt library">
        {sculptGroups.map((group) => {
          const entry =
            group.entries.find((e) => e.id === selected) ?? group.entries[0];
          return (
            <button
              key={entry.id}
              aria-pressed={selected === entry.id}
              className={selected === entry.id ? "active" : ""}
              onClick={() => choose(entry.id)}
            >
              <img src={entry.thumbnail} loading="lazy" alt="" />
              <span>
                {group.name}
                {group.entries.length > 1
                  ? ` · ${group.entries.length} ${entry.variantLabel ? "sections" : "poses"}`
                  : ""}
              </span>
            </button>
          );
        })}
      </div>
    </details>
  );
}

export function SculptPosePicker({
  selected,
  choose,
}: {
  selected?: SculptId;
  choose: (id: SculptId) => void;
}) {
  const group = sculptGroupFor(selected);
  if (!group || group.entries.length < 2) return null;
  return (
    <label className="select-field sculpt-pose-picker">
      {group.entries[0].variantLabel ?? "Leg pose"}
      <select
        aria-label={
          group.entries[0].variantLabel
            ? "Imported body section"
            : "Imported leg pose"
        }
        value={selected}
        onChange={(e) => choose(e.target.value as SculptId)}
      >
        {group.entries.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.poseName}
          </option>
        ))}
      </select>
      <span className="field-note">
        {group.entries[0].variantLabel
          ? "Choose a section for tattoo placement. Skin and muscle views share the same placement."
          : "Separate sculpted poses. Artwork placement can be adjusted for each pose."}
      </span>
    </label>
  );
}
