import type { VectorPack } from "./vector-pack";
export type Development = NonNullable<VectorPack["development"]>;
export type StyleRevision = Development["revisions"][number];
export type StyleSample = Development["samples"][number];
export const emptyDevelopment = (): Development => ({
  revisions: [],
  samples: [],
  colorways: [],
});
// Fast local change detection; export provenance still uses SHA-256 below.
export function drawingSignature(pack: VectorPack) {
  const text = JSON.stringify({ layers: pack.layers, groups: pack.groups });
  let a = 0x811c9dc5,
    b = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b ^ text.charCodeAt(i), 2246822519);
  }
  return `${text.length}:${(a >>> 0).toString(16)}:${(b >>> 0).toString(16)}`;
}
export async function drawingHash(pack: VectorPack) {
  const bytes = new TextEncoder().encode(
    JSON.stringify({ layers: pack.layers, groups: pack.groups }),
  );
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export async function captureRevision(
  pack: VectorPack,
  name: string,
  summary: string,
): Promise<StyleRevision> {
  if (!pack.revision.trim())
    throw new Error("Set the pack revision before recording a specification.");
  if (
    pack.development?.revisions.some((r) => r.spec.revision === pack.revision)
  )
    throw new Error(
      "This revision is already recorded. Update the pack revision in Style & instructions before recording another.",
    );
  const {
    name: styleName,
    style,
    revision,
    season,
    manufacturer,
    notes,
    units,
    sizes,
    measurements,
    materials,
    callouts,
  } = pack;
  return {
    id: crypto.randomUUID(),
    name,
    summary,
    createdAt: new Date().toISOString(),
    drawingHash: await drawingHash(pack),
    drawingSignature: drawingSignature(pack),
    spec: structuredClone({
      name: styleName,
      style,
      revision,
      season,
      manufacturer,
      notes,
      units,
      sizes,
      measurements,
      materials,
      callouts,
    }),
  };
}
export function createSample(
  revision: StyleRevision,
  size: string,
  name: string,
): StyleSample {
  if (!revision.spec.sizes.includes(size))
    throw new Error("Choose a size included in this revision.");
  return {
    id: crypto.randomUUID(),
    name,
    revisionId: revision.id,
    size,
    recordedAt: new Date().toISOString(),
    notes: "",
    measurements: revision.spec.measurements.map((m) => ({
      measurementId: m.id,
      value: null,
      notes: "",
    })),
  };
}
export function sampleRows(revision: StyleRevision, sample: StyleSample) {
  const index = revision.spec.sizes.indexOf(sample.size);
  return revision.spec.measurements.map((m) => {
    const actual =
        sample.measurements.find((v) => v.measurementId === m.id)?.value ??
        null,
      requested = m.values[index] ?? null;
    const delta =
      actual !== null && requested !== null ? actual - requested : null;
    return {
      id: m.id,
      name: m.name,
      method: m.method,
      requested,
      actual,
      tolerance: m.tolerance,
      delta,
      status:
        delta === null
          ? "Not measured"
          : !m.toleranceConfirmed
            ? "Tolerance not confirmed"
            : Math.abs(delta) <= m.tolerance + 1e-8
              ? "Within tolerance"
              : "Outside tolerance",
    };
  });
}
export function revisionChanges(
  pack: VectorPack,
  revision: StyleRevision,
  hash?: string,
) {
  const changes: string[] = [];
  const previous = revision.spec;
  for (const key of [
    "name",
    "style",
    "revision",
    "season",
    "manufacturer",
    "notes",
    "units",
  ] as const)
    if (pack[key] !== previous[key]) changes.push(`${key}: changed`);
  if (JSON.stringify(pack.sizes) !== JSON.stringify(previous.sizes))
    changes.push("Size range changed");
  for (const key of ["measurements", "materials", "callouts"] as const) {
    const before = previous[key] as {
        id: string;
        name?: string;
        code?: string;
        text?: string;
      }[],
      after = pack[key] as typeof before;
    for (const row of after) {
      const old = before.find((r) => r.id === row.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(row))
        changes.push(
          `${key}: ${row.name || row.code || row.text || row.id} ${old ? "changed" : "added"}`,
        );
    }
    for (const row of before)
      if (!after.some((r) => r.id === row.id))
        changes.push(
          `${key}: ${row.name || row.code || row.text || row.id} removed`,
        );
  }
  if (
    hash
      ? hash !== revision.drawingHash
      : drawingSignature(pack) !== revision.drawingSignature
  )
    changes.push("Technical flat geometry, appearance or grouping changed");
  return changes;
}
export function calloutLinks(
  pack: VectorPack,
  c: VectorPack["callouts"][number],
) {
  return [
    c.layerId
      ? `Component: ${pack.layers.find((l) => l.id === c.layerId)?.name ?? "MISSING"}`
      : "",
    c.materialId
      ? `Material: ${pack.materials.find((m) => m.id === c.materialId)?.code ?? "MISSING"}`
      : "",
    c.measurementId
      ? `POM: ${pack.measurements.find((m) => m.id === c.measurementId)?.name ?? "MISSING"}`
      : "",
  ]
    .filter(Boolean)
    .join(" / ");
}
