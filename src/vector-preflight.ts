import { layerBounds, type VectorPack } from "./vector-pack";
import { revisionChanges, sampleRows } from "./style-development";
export function portablePdfText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—−]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/±/g, "+/-")
    .replace(/×/g, "x")
    .replace(/·/g, "/");
}
export type HandoffIssue = {
  code: string;
  message: string;
  section: "drawing" | "specs" | "materials" | "notes" | "development";
  severity: "warning" | "error";
};
export function vectorPreflight(pack: VectorPack): HandoffIssue[] {
  const issues: HandoffIssue[] = [];
  const add = (
    code: string,
    message: string,
    section: HandoffIssue["section"],
    severity: HandoffIssue["severity"] = "warning",
  ) => issues.push({ code, message, section, severity });
  if (!pack.layers.some((l) => l.visible))
    add(
      "empty",
      "No visible garment drawing. Add a flat before exporting.",
      "drawing",
      "error",
    );
  for (const view of ["front", "back"] as const)
    if (!pack.layers.some((l) => l.visible && l.view === view))
      add("missing-view", `No ${view} view is included.`, "drawing");
  if (!pack.style.trim() || pack.style === "STYLE-001")
    add("style", "Set a unique style identifier.", "notes");
  if (!pack.revision.trim())
    add(
      "revision",
      "Add a revision so the recipient can identify this version.",
      "notes",
    );
  if (!pack.measurements.length)
    add("measurements", "No points of measure have been specified.", "specs");
  for (const m of pack.measurements) {
    if (!m.toleranceConfirmed)
      add(
        "tolerance-unconfirmed",
        `${m.name || "Measurement"}: confirm the tolerance; the current value may be a starter default.`,
        "specs",
      );
    const missing = pack.sizes.filter((_, i) => m.values[i] === null);
    if (missing.length)
      add(
        "missing-values",
        `${m.name || "Unnamed measurement"}: missing ${missing.join(", ")} (${pack.units}).`,
        "specs",
      );
    if (!m.name.trim() || !m.method.trim())
      add(
        "measurement-method",
        `${m.name || "Unnamed measurement"} needs a name and measuring method.`,
        "specs",
      );
    if (m.values.some((v) => v === 0))
      add(
        "zero-value",
        `${m.name || "Measurement"} includes a zero; verify it is intentional.`,
        "specs",
      );
  }
  for (const [i, c] of pack.callouts.entries()) {
    if (
      c.layerId &&
      !pack.layers.some((l) => l.id === c.layerId && l.view === c.view)
    )
      add(
        "callout-component",
        `Callout ${i + 1}: linked component is missing or belongs to another view.`,
        "development",
        "error",
      );
    if (c.materialId && !pack.materials.some((m) => m.id === c.materialId))
      add(
        "callout-material",
        `Callout ${i + 1}: linked material is missing.`,
        "development",
        "error",
      );
    if (
      c.measurementId &&
      !pack.measurements.some((m) => m.id === c.measurementId)
    )
      add(
        "callout-pom",
        `Callout ${i + 1}: linked point of measure is missing.`,
        "development",
        "error",
      );
  }
  const latest = pack.development?.revisions.at(-1);
  if (
    latest &&
    revisionChanges(pack, latest).length &&
    latest.spec.revision === pack.revision
  )
    add(
      "revision-changed",
      `Specifications or drawing changed since ${latest.name} without a new pack revision. Review the change list.`,
      "development",
    );
  for (const sample of pack.development?.samples ?? []) {
    const revision = pack.development!.revisions.find(
      (r) => r.id === sample.revisionId,
    );
    if (!revision) continue;
    const rows = sampleRows(revision, sample),
      outside = rows.filter((r) => r.status === "Outside tolerance");
    if (outside.length)
      add(
        "sample-outside",
        `${sample.name} (${sample.size}, rev ${revision.spec.revision}): ${outside.length} measurements outside the recorded tolerance.`,
        "development",
      );
    if (rows.some((r) => r.status === "Tolerance not confirmed"))
      add(
        "sample-tolerance",
        `${sample.name}: tolerance was not confirmed in the requested revision. Review the recorded specification.`,
        "development",
      );
    if (rows.some((r) => r.status === "Not measured"))
      add(
        "sample-incomplete",
        `${sample.name}: sample measurements are incomplete.`,
        "development",
      );
  }
  for (const w of pack.development?.colorways ?? [])
    if (
      w.materials.some(
        (m) => !pack.materials.some((v) => v.id === m.materialId),
      )
    )
      add(
        "colorway-material",
        `${w.name}: a material was removed. Update the colorway.`,
        "development",
        "error",
      );
  if (!pack.materials.length)
    add("materials", "No materials or trims have been specified.", "materials");
  const codes = pack.materials.map((m) => m.code.trim()).filter(Boolean);
  if (new Set(codes).size !== codes.length)
    add(
      "material-code",
      "Material codes are duplicated. Use distinct codes for traceable assignments.",
      "materials",
    );
  for (const m of pack.materials)
    if (
      !m.code.trim() ||
      !m.description.trim() ||
      !m.unit.trim() ||
      m.quantity === 0
    )
      add(
        "material-details",
        `${m.code || m.kind}: complete the code, description, quantity and unit.`,
        "materials",
      );
  for (const l of pack.layers.filter((l) => l.visible)) {
    const b = layerBounds(l),
      margin = l.strokeWidth / 2;
    if (
      b.x - margin < 0 ||
      b.y - margin < 0 ||
      b.x + b.width + margin > 480 ||
      b.y + b.height + margin > 620
    )
      add(
        "clipped",
        `${l.name || "Path"} (${l.view}) may extend beyond the exported artboard. Bounds include curve handles.`,
        "drawing",
      );
    if (l.material && !codes.includes(l.material.trim()))
      add(
        "unknown-material",
        `${l.name}: material “${l.material}” is absent from the materials table.`,
        "materials",
      );
  }
  if (
    pack.callouts.some((c) =>
      [c.anchor, c.label].some(
        (p) => p.x < 10 || p.x > 470 || p.y < 10 || p.y > 610,
      ),
    )
  )
    add(
      "callout-clipped",
      "A construction callout may be clipped at an artboard edge.",
      "drawing",
    );
  if (
    pack.callouts.some(
      (c) => !c.text.trim() || c.text === "Describe construction or finishing",
    )
  )
    add(
      "callout-text",
      "Replace empty or placeholder construction instructions.",
      "notes",
    );
  const allText = [
    pack.name,
    pack.style,
    pack.revision,
    pack.season,
    pack.manufacturer,
    pack.notes,
    ...pack.callouts.map((c) => c.text),
    ...(pack.development?.revisions ?? []).flatMap((r) => [
      r.name,
      r.summary,
      r.spec.revision,
      ...r.spec.measurements.flatMap((m) => [m.name, m.method]),
    ]),
    ...(pack.development?.samples ?? []).flatMap((s) => [s.name, s.notes]),
    ...(pack.development?.colorways ?? []).flatMap((w) => [
      w.name,
      ...w.materials.flatMap((m) => [m.color, m.reference]),
    ]),
    ...pack.measurements.flatMap((m) => [m.name, m.method]),
    ...pack.materials.flatMap((m) => [
      m.code,
      m.description,
      m.composition,
      m.color,
      m.supplier,
      m.unit,
    ]),
  ];
  if (allText.some((s) => /[^\x20-\x7E\n\r]/.test(portablePdfText(s))))
    add(
      "pdf-text",
      "Some characters are unavailable in the PDF font. SVG/JSON preserve them; PDF substitutes ?.",
      "notes",
    );
  return issues;
}
export function handoffManifest(pack: VectorPack) {
  const issues = vectorPreflight(pack);
  return {
    format: "form-studio-handoff",
    version: 1,
    application: "Corpora Studio 0.23",
    intent: "technical-flat",
    style: pack.style,
    revision: pack.revision,
    specificationUnits: pack.units,
    drawingUnits:
      "SVG user units (px); illustration is not to manufacturing scale",
    status: issues.length ? "draft-needs-review" : "software-checks-passed",
    physicalPrintVerified: false,
    recipientAcceptanceVerified: false,
    includedSheets: [
      ...(pack.layers.some((l) => l.textile && l.fill !== "none")
        ? [
            "textiles.csv",
            ...pack.layers
              .filter((l) => l.textile && l.fill !== "none")
              .map((l) => `textiles/${l.id}.svg`),
          ]
        : []),
      "front.svg",
      "back.svg",
      "technical-flats.svg",
      "tech-pack.pdf",
      "measurements.csv",
      "materials.csv",
      "construction.csv",
      "samples.csv",
      "revisions.csv",
      "colorways.csv",
      "editable-vector-pack.json",
    ],
    recordedRevisions: (pack.development?.revisions ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      style: r.spec.style,
      revision: r.spec.revision,
      units: r.spec.units,
      createdAt: r.createdAt,
      drawingHash: r.drawingHash,
    })),
    samples: (pack.development?.samples ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      size: s.size,
      requestedRevisionId: s.revisionId,
      recordedAt: s.recordedAt,
    })),
    originalSources: pack.sources.map(({ original, ...source }) => ({
      ...source,
      retainedIn: "editable-vector-pack.json",
    })),
    issues,
    recipientChecks: [
      "Open the PDF and both SVG views in your production application.",
      "Compare style, revision, front/back, fills, holes, linework and callout numbers.",
      "Confirm measurements, tolerances, materials and construction instructions.",
      "Do not cut from a technical flat. Export cutting patterns separately at 100% and measure their calibration square.",
      "Record recipient application/version, reviewer, date and sample approval separately.",
    ],
  };
}
export function handoffText(pack: VectorPack) {
  const report = handoffManifest(pack);
  return [
    `CORPORA STUDIO — TECHNICAL FLAT HANDOFF`,
    `${report.style} / Revision ${report.revision}`,
    `Measurement units: ${report.specificationUnits}. Drawing: NOT TO CUTTING SCALE.`,
    `Status: ${report.status}`,
    `Physical print and recipient acceptance: not verified by this software.`,
    "",
    "REVIEW FINDINGS",
    ...report.issues.map((i) => `[${i.severity}] ${i.message}`),
    ...(report.issues.length
      ? []
      : ["No automated findings. Recipient review is still required."]),
    "",
    "RECIPIENT CHECKS",
    ...report.recipientChecks.map((s, i) => `${i + 1}. ${s}`),
    "",
    "Recipient application/version: __________________",
    "Reviewer/date: __________________",
    "Sample/reference: __________________",
  ].join("\n");
}
