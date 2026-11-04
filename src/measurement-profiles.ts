import {
  MeasurementProfileSchema,
  measurementFields,
  type Fashion,
  type MeasurementProfile,
  type MeasurementKey,
} from "./fashion-model";
// Explicit format mapping only. Different anatomical landmarks are never silently equated.
const smisNames: Partial<Record<MeasurementKey, string>> = {
  chest: "bust_circ",
  waist: "waist_circ",
  seat: "hip_circ",
  neck: "neck_circ",
  biceps: "arm_upper_circ",
  wrist: "wrist_circ",
  shoulderToWrist: "arm_shoulder_tip_to_wrist_bent",
  knee: "leg_knee_circ",
};
const escape = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function exportProfile(p: MeasurementProfile, format: "json" | "smis") {
  MeasurementProfileSchema.parse(p);
  if (format === "json")
    return JSON.stringify(
      {
        name: p.name,
        units: "mm",
        source: p.source,
        note: p.note,
        measurements: p.measurements,
      },
      null,
      2,
    );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<smis><version>0.3.4</version><read-only>false</read-only><notes>${escape(p.note)}</notes><unit>mm</unit><pm_system>998</pm_system><personal><family-name/><given-name>${escape(p.name)}</given-name><birth-date>1800-01-01</birth-date><gender>unknown</gender><email/></personal><body-measurements>${Object.entries(
    p.measurements,
  )
    .map(
      ([k, v]) =>
        `<m name="${smisNames[k as MeasurementKey] ?? "@form_" + k}" value="${v}" full_name="${escape(measurementFields.find((f) => f[0] === k)?.[1] ?? k)}"/>`,
    )
    .join("")}</body-measurements></smis>`;
}
export function importProfile(
  text: string,
  base: Fashion["measurements"],
): { profile: MeasurementProfile; imported: string[]; warnings: string[] } {
  if (text.length > 200000) throw new Error("Measurement file exceeds 200 KB.");
  const values: Record<string, unknown> = {},
    warnings: string[] = [];
  let name = "Imported measurements",
    note = "",
    factor = 1;
  if (text.trim().startsWith("<")) {
    if (/<!DOCTYPE|<!ENTITY/i.test(text))
      throw new Error("XML entities and document types are not supported.");
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (
      doc.querySelector("parsererror") ||
      doc.documentElement.tagName !== "smis"
    )
      throw new Error("Choose a valid individual Seamly .smis file.");
    const unit = doc.querySelector("unit")?.textContent;
    if (!["mm", "cm", "inch"].includes(unit ?? ""))
      throw new Error("Measurement units must be mm, cm, or inch.");
    factor = unit === "cm" ? 10 : unit === "inch" ? 25.4 : 1;
    name = doc.querySelector("given-name")?.textContent?.trim() || name;
    note = doc.querySelector("notes")?.textContent ?? "";
    for (const m of doc.querySelectorAll("body-measurements > m")) {
      const k = m.getAttribute("name") ?? "",
        raw = m.getAttribute("value") ?? "";
      const key = k.startsWith("@form_")
        ? k.slice(6)
        : Object.keys(smisNames).find(
            (key) => smisNames[key as MeasurementKey] === k,
          );
      if (!key || !measurementFields.some((f) => f[0] === key)) {
        warnings.push(`Unmapped measurement: ${k}`);
        continue;
      }
      if (!/^[-+]?\d+(\.\d+)?$/.test(raw.trim())) {
        warnings.push(`Formula not imported: ${k}. Enter its measured value.`);
        continue;
      }
      if (Object.hasOwn(values, key))
        throw new Error(`Duplicate measurement: ${key}`);
      values[key] = Number(raw.trim());
    }
  } else {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error("Choose a FreeSewing measurement object.");
    const units = data.units ?? "mm";
    if (!["mm", "cm", "inch"].includes(units))
      throw new Error("Unsupported measurement unit.");
    factor = units === "cm" ? 10 : units === "inch" ? 25.4 : 1;
    name = typeof data.name === "string" ? data.name : name;
    note = typeof data.note === "string" ? data.note : "";
    const source = data.measurements ?? data;
    for (const [k, v] of Object.entries(source))
      if (measurementFields.some((f) => f[0] === k)) values[k] = v;
  }
  const imported = Object.keys(values);
  if (!imported.length)
    throw new Error("No supported numeric measurements were found.");
  for (const k of imported) {
    if (typeof values[k] !== "number")
      throw new Error(`Expected a numeric ${k} measurement.`);
    values[k] = Number(values[k]) * (k === "shoulderSlope" ? 1 : factor);
  }
  const profile = MeasurementProfileSchema.parse({
    id: crypto.randomUUID(),
    name: name.slice(0, 80),
    source: "tape",
    note: `Imported; confirm source. ${note}`.slice(0, 1000),
    measurements: { ...base, ...values },
  });
  warnings.unshift(
    "Only listed measurements were imported. Other values remain from the current profile; confirm them before drafting.",
  );
  return { profile, imported, warnings };
}
const storageKey = "form-studio-measurement-profiles-v1";
export function readProfiles(): MeasurementProfile[] {
  const data = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
  return MeasurementProfileSchema.array().max(50).parse(data);
}
export function storeProfile(profile: MeasurementProfile) {
  const all = readProfiles().filter((p) => p.id !== profile.id);
  all.push(MeasurementProfileSchema.parse(profile));
  if (all.length > 50)
    throw new Error(
      "The device library holds up to 50 measurement profiles. Remove one first.",
    );
  localStorage.setItem(storageKey, JSON.stringify(all));
}
export function removeProfile(id: string) {
  localStorage.setItem(
    storageKey,
    JSON.stringify(readProfiles().filter((p) => p.id !== id)),
  );
}
