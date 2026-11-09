import { useState } from "react";
import { poseNames, studyPoses, type TransferPlan } from "./tattoo-study";
export function TransferPlanEditor({
  value,
  change,
  save,
}: {
  value: TransferPlan;
  change: (v: TransferPlan) => void;
  save?: () => void;
}) {
  const [section, setSection] = useState<string>(),
    [mark, setMark] = useState<string>();
  const s = value.sections.find((s) => s.id === section),
    m = value.marks.find((m) => m.id === mark);
  const number = (
    label: string,
    v: number,
    min: number,
    max: number,
    update: (v: number) => void,
  ) => (
    <label>
      {label}
      <input
        aria-label={label}
        type="number"
        value={Math.round(v * 1000) / 1000}
        min={min}
        max={max}
        step={0.1}
        onChange={(e) => {
          const n = e.target.valueAsNumber;
          if (Number.isFinite(n) && n >= min && n <= max) update(n);
        }}
      />
    </label>
  );
  const patchSection = (patch: Partial<NonNullable<typeof s>>) =>
    change({
      ...value,
      sections: value.sections.map((v) =>
        v.id === section ? { ...v, ...patch } : v,
      ),
    });
  const patchMark = (patch: Partial<NonNullable<typeof m>>) =>
    change({
      ...value,
      marks: value.marks.map((v) => (v.id === mark ? { ...v, ...patch } : v)),
    });
  return (
    <div className="transfer-plan-editor">
      <h3>3 / Transfer sections</h3>
      <p>
        Split flat artwork into named sections. Put matching marks near shared
        edges; they print on every overlapping section.
      </p>
      <label>
        Intended pose
        <select
          aria-label="Stencil transfer pose"
          value={value.pose}
          onChange={(e) =>
            change({ ...value, pose: e.target.value as TransferPlan["pose"] })
          }
        >
          {studyPoses.map((p) => (
            <option key={p} value={p}>
              {poseNames[p]}
            </option>
          ))}
        </select>
      </label>
      {number("Section overlap (mm)", value.overlap, 0, 20, (v) =>
        change({ ...value, overlap: v }),
      )}
      <button
        disabled={value.sections.length >= 12}
        onClick={() => {
          const s = {
            id: crypto.randomUUID(),
            name: `Section ${value.sections.length + 1}`,
            x: 0,
            y: 0,
            width: 1,
            height: 0.5,
          };
          change({ ...value, sections: [...value.sections, s] });
          setSection(s.id);
        }}
      >
        Add transfer section
      </button>
      <label>
        Section
        <select
          aria-label="Transfer section"
          value={section ?? ""}
          onChange={(e) => setSection(e.target.value)}
        >
          <option value="">Select section</option>
          {value.sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {s && (
        <>
          <label>
            Section name
            <input
              aria-label="Section name"
              maxLength={40}
              value={s.name}
              onChange={(e) =>
                e.target.value.trim() && patchSection({ name: e.target.value })
              }
            />
          </label>
          {number("Section left (%)", s.x * 100, 0, (1 - s.width) * 100, (v) =>
            patchSection({ x: v / 100 }),
          )}
          {number("Section top (%)", s.y * 100, 0, (1 - s.height) * 100, (v) =>
            patchSection({ y: v / 100 }),
          )}
          {number("Section width (%)", s.width * 100, 1, (1 - s.x) * 100, (v) =>
            patchSection({ width: v / 100 }),
          )}
          {number(
            "Section height (%)",
            s.height * 100,
            1,
            (1 - s.y) * 100,
            (v) => patchSection({ height: v / 100 }),
          )}
          <button
            onClick={() => {
              change({
                ...value,
                sections: value.sections.filter((v) => v.id !== section),
              });
              setSection(undefined);
            }}
          >
            Remove section
          </button>
        </>
      )}
      <button
        disabled={value.marks.length >= 24}
        onClick={() => {
          const m = {
            id: crypto.randomUUID(),
            name: `R${value.marks.length + 1}`,
            x: 0.5,
            y: 0.5,
          };
          change({ ...value, marks: [...value.marks, m] });
          setMark(m.id);
        }}
      >
        Add registration mark
      </button>
      <label>
        Mark
        <select
          aria-label="Registration mark"
          value={mark ?? ""}
          onChange={(e) => setMark(e.target.value)}
        >
          <option value="">Select mark</option>
          {value.marks.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      {m && (
        <>
          <label>
            Mark label
            <input
              aria-label="Mark label"
              maxLength={24}
              value={m.name}
              onChange={(e) =>
                e.target.value.trim() && patchMark({ name: e.target.value })
              }
            />
          </label>
          {number("Mark X (%)", m.x * 100, 0, 100, (v) =>
            patchMark({ x: v / 100 }),
          )}
          {number("Mark Y (%)", m.y * 100, 0, 100, (v) =>
            patchMark({ y: v / 100 }),
          )}
          <button
            onClick={() => {
              change({
                ...value,
                marks: value.marks.filter((v) => v.id !== mark),
              });
              setMark(undefined);
            }}
          >
            Remove mark
          </button>
        </>
      )}
      <label>
        Orientation / landmark notes
        <textarea
          aria-label="Transfer notes"
          maxLength={1000}
          value={value.notes}
          onChange={(e) => change({ ...value, notes: e.target.value })}
        />
      </label>
      {save && <button onClick={save}>Save transfer plan to project</button>}
      <p>
        PDF includes the proof page and registered sections. PNG exports the
        selected artwork contours only.
      </p>
    </div>
  );
}
