import { useEffect, useState } from "react";
export function TextField({
  label,
  value,
  change,
  max = 100,
  multiline = false,
}: {
  label: string;
  value: string;
  change: (s: string) => void;
  max?: number;
  multiline?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const props = {
    "aria-label": label,
    value: draft,
    maxLength: max,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(e.target.value),
    onBlur: () => {
      if (draft !== value) change(draft);
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setDraft(value);
        e.stopPropagation();
      }
      if (e.key === "Enter" && !multiline)
        e.currentTarget instanceof HTMLElement && e.currentTarget.blur();
    },
  };
  return (
    <label className="fashion-edit-field">
      <span>{label}</span>
      {multiline ? <textarea {...props} rows={3} /> : <input {...props} />}
    </label>
  );
}
export function NumberField({
  label,
  value,
  change,
  min = 0,
  max = 15000,
  unit = "mm",
}: {
  label: string;
  value: number;
  change: (n: number) => void;
  min?: number;
  max?: number;
  unit?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(Math.round(value * 1000) / 1000)), [value]);
  return (
    <label className="fashion-edit-field">
      <span>
        {label} <small>{unit}</small>
      </span>
      <input
        aria-label={label}
        type="number"
        step="0.1"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number(draft);
          if (draft.trim() && Number.isFinite(n) && n >= min && n <= max) {
            if (n !== value) change(n);
          } else setDraft(String(value));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(String(value));
            e.stopPropagation();
          }
        }}
      />
    </label>
  );
}
