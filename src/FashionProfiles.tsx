import { useEffect, useRef, useState } from "react";
import {
  exportProfile,
  importProfile,
  readProfiles,
  storeProfile,
  removeProfile,
} from "./measurement-profiles";
import { type Fashion, type MeasurementProfile } from "./fashion-model";
import { saveTextFile } from "./io";
export function FashionProfiles({
  value,
  change,
  notify,
}: {
  value: Fashion;
  change: (f: Fashion) => void;
  notify: (s: string, error?: boolean) => void;
}) {
  const [library, setLibrary] = useState<MeasurementProfile[]>([]),
    [source, setSource] = useState<MeasurementProfile["source"]>("tape"),
    [note, setNote] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const refresh = () => {
    try {
      setLibrary(readProfiles());
    } catch {
      notify(
        "The local measurement library could not be read. Your current project is unaffected.",
        true,
      );
    }
  };
  useEffect(refresh, []);
  const current = (): MeasurementProfile => ({
    id: crypto.randomUUID(),
    name: value.profile,
    source,
    note,
    measurements: value.measurements,
  });
  const add = (p: MeasurementProfile) => {
    if ((value.profiles?.length ?? 0) >= 20) {
      notify("A project can hold 20 profiles.", true);
      return;
    }
    change({
      ...value,
      profiles: [...(value.profiles ?? []).filter((x) => x.id !== p.id), p],
    });
  };
  return (
    <details className="fashion-details">
      <summary>Profiles & size series</summary>
      <label className="fashion-text-field">
        Measurement source
        <select
          aria-label="Measurement source"
          value={source}
          onChange={(e) => setSource(e.target.value as typeof source)}
        >
          <option value="tape">Tape measurements</option>
          <option value="photo">Photo assisted</option>
          <option value="sample">Sample / unverified</option>
          <option value="standard">Named standard</option>
        </select>
      </label>
      <label className="fashion-text-field">
        Source notes
        <textarea
          aria-label="Measurement source notes"
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <button type="button" onClick={() => add(current())}>
        Keep current profile in project
      </button>
      <button
        type="button"
        onClick={() => {
          try {
            storeProfile(current());
            refresh();
            notify("Profile saved to this device.");
          } catch (e) {
            notify(String(e), true);
          }
        }}
      >
        Save to device library
      </button>
      <input
        type="file"
        hidden
        ref={file}
        accept=".json,.smis"
        onChange={async (e) => {
          const selected = e.target.files?.[0];
          e.target.value = "";
          if (!selected) return;
          try {
            if (selected.size > 200000)
              throw new Error("Measurement file exceeds 200 KB.");
            const r = importProfile(await selected.text(), value.measurements);
            add(r.profile);
            notify(
              `Imported ${r.imported.length} measurements into “${r.profile.name}”. ${r.warnings.join(" ")}`,
            );
          } catch (err) {
            notify(String(err), true);
          }
        }}
      />
      <button type="button" onClick={() => file.current?.click()}>
        Import JSON / Seamly measurements
      </button>
      <div className="fashion-presets">
        {(["json", "smis"] as const).map((format) => (
          <button
            key={format}
            onClick={async () => {
              try {
                await saveTextFile(
                  exportProfile(current(), format),
                  value.profile,
                  format,
                );
              } catch (e) {
                notify(String(e), true);
              }
            }}
          >
            Export {format.toUpperCase()}
          </button>
        ))}
      </div>
      <p className="fashion-caption">
        Project profiles travel with the file. The device library is local. Size
        comparison drafts each selected profile independently.
      </p>
      {(value.profiles ?? []).map((p) => (
        <div className="profile-row" key={p.id}>
          <strong>{p.name}</strong>
          <small>
            {p.source} · {p.note}
          </small>
          <div className="fashion-presets">
            <button
              onClick={() => {
                setSource(p.source);
                setNote(p.note);
                change({
                  ...value,
                  profile: p.name,
                  measurements: p.measurements,
                });
              }}
            >
              Use
            </button>
            <button
              onClick={() =>
                change({
                  ...value,
                  profiles: value.profiles?.filter((x) => x.id !== p.id),
                  gradeIds: value.gradeIds?.filter((x) => x !== p.id),
                })
              }
            >
              Remove
            </button>
          </div>
          <label className="fashion-check">
            <input
              type="checkbox"
              checked={value.gradeIds?.includes(p.id) ?? false}
              onChange={(e) => {
                const ids = value.gradeIds ?? [];
                if (e.target.checked && ids.length >= 8) {
                  notify("Compare up to eight profiles.", true);
                  return;
                }
                change({
                  ...value,
                  gradeIds: e.target.checked
                    ? [...ids, p.id]
                    : ids.filter((id) => id !== p.id),
                });
              }}
            />
            Include in size series
          </label>
        </div>
      ))}
      {library.length > 0 && (
        <>
          <h4>On this device</h4>
          {library.map((p) => (
            <div className="profile-row" key={p.id}>
              <strong>{p.name}</strong>
              <div className="fashion-presets">
                <button onClick={() => add({ ...p, id: crypto.randomUUID() })}>
                  Add to project
                </button>
                <button
                  onClick={() => {
                    try {
                      removeProfile(p.id);
                      refresh();
                    } catch (e) {
                      notify(String(e), true);
                    }
                  }}
                >
                  Remove from device
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </details>
  );
}
