import {
  handoffManifest,
  handoffText,
  portablePdfText,
} from "./vector-preflight";
import { jsPDF } from "jspdf";
import {
  textilePatternId,
  textilePatternSvg,
  textileSwatchSvg,
  textileSummary,
  textileTile,
} from "./textiles";
import { calloutLinks, sampleRows } from "./style-development";
import { zipSync, strToU8 } from "fflate";
import {
  VectorPackSchema,
  vectorPath,
  allContours,
  type VectorPack,
  type VectorView,
  type VectorLayer,
} from "./vector-pack";
const esc = (s: string) =>
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
const printable = (s: string) =>
  portablePdfText(s).replace(/[^\x20-\x7E\n]/g, "?");
const dimension = (value: number | null) =>
  value === null ? "" : Math.round(value * 1000) / 1000;
export function vectorSvg(input: VectorPack, view?: VectorView) {
  const p = VectorPackSchema.parse(input),
    views: VectorView[] = view ? [view] : ["front", "back"];
  const width = views.length * 480;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}px" height="680px" viewBox="0 0 ${width} 680"><defs>${p.layers
    .filter(
      (l) =>
        l.textile && l.fill !== "none" && l.visible && views.includes(l.view),
    )
    .map((l) => textilePatternSvg(l.textile!, `export-${l.id}`))
    .join(
      "",
    )}</defs><title>${esc(p.style + " · " + p.name)}</title><desc>Technical garment flat. Not a scale cutting pattern. Revision ${esc(p.revision)}.</desc><rect width="100%" height="100%" fill="white"/><g font-family="Arial,sans-serif" fill="#202020"><text x="20" y="26" font-size="14">${esc(p.style + " / " + p.name + " / Rev " + p.revision)}</text>${views
    .map(
      (v, i) =>
        `<defs><clipPath id="${v}-artboard"><rect width="480" height="620"/></clipPath></defs><g id="${v}" transform="translate(${i * 480} 45)" clip-path="url(#${v}-artboard)"><text x="220" y="20" font-size="11" text-anchor="middle">${v.toUpperCase()}</text>${p.layers
          .filter((l) => l.view === v && l.visible)
          .map(
            (l) =>
              `<path id="layer-${l.id}" data-name="${esc(l.name)}" data-group="${p.groups.find((g) => g.layerIds.includes(l.id))?.id ?? ""}" data-material="${esc(l.material)}" d="${vectorPath(l)}" fill="${l.textile && l.fill !== "none" ? `url(#${textilePatternId(`export-${l.id}`)})` : l.fill}"${l.textile ? ` data-textile="${esc(textileSummary(l.textile))}"` : ""} fill-rule="${l.fillRule ?? (l.contours ? "evenodd" : "nonzero")}" stroke="${l.stroke}" stroke-width="${l.strokeWidth}" stroke-linejoin="${l.lineJoin ?? "round"}" stroke-linecap="${l.lineCap ?? "round"}"${l.dashed ? ' stroke-dasharray="5 4"' : ""}><title>${esc(l.name)}</title></path>`,
          )
          .join("")}${p.callouts
          .filter((c) => c.view === v)
          .map(
            (c) =>
              `<g><path d="M${c.anchor.x} ${c.anchor.y} L${c.label.x} ${c.label.y}" fill="none" stroke="#555" stroke-width="1"/><circle cx="${c.label.x}" cy="${c.label.y}" r="10" fill="white" stroke="#555"/><text x="${c.label.x}" y="${c.label.y + 4}" font-size="10" text-anchor="middle">${p.callouts.indexOf(c) + 1}</text><title>${esc(c.text)}</title></g>`,
          )
          .join("")}</g>`,
    )
    .join(
      "",
    )}<text x="20" y="663" font-size="10">Technical flat · use the specification table for dimensions (${p.units}) · not to scale</text></g></svg>`;
}
function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (typeof value === "string" && /^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
const csv = (rows: unknown[][]) =>
  rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
export function specCsv(p: VectorPack) {
  return csv([
    [
      "Style",
      "Revision",
      "Point of measure",
      "How to measure",
      `Tolerance (${p.units})`,
      ...p.sizes.map((s) => `${s} (${p.units})`),
    ],
    ...p.measurements.map((m) => [
      p.style,
      p.revision,
      m.name,
      m.method,
      dimension(m.tolerance),
      ...m.values.map(dimension),
    ]),
  ]);
}
export function materialsCsv(p: VectorPack) {
  return csv([
    [
      "Style",
      "Code",
      "Kind",
      "Description",
      "Composition",
      "Color / reference",
      "Quantity",
      "Unit",
      "Supplier",
    ],
    ...p.materials.map((m) => [
      p.style,
      m.code,
      m.kind,
      m.description,
      m.composition,
      m.color,
      m.quantity,
      m.unit,
      m.supplier,
    ]),
  ]);
}
export function calloutsCsv(p: VectorPack) {
  return csv([
    ["No.", "View", "Instruction", "Linked records"],
    ...p.callouts.map((c, i) => [i + 1, c.view, c.text, calloutLinks(p, c)]),
  ]);
}
export function samplesCsv(p: VectorPack) {
  return csv([
    [
      "Sample",
      "Requested style",
      "Requested revision",
      "Size",
      "Units",
      "Point of measure",
      "Requested",
      "Measured",
      "Difference",
      "Tolerance",
      "Result",
      "Sample notes",
    ],
    ...(p.development?.samples ?? []).flatMap((s) => {
      const r = p.development!.revisions.find((r) => r.id === s.revisionId)!;
      return sampleRows(r, s).map((m) => [
        s.name,
        r.spec.style,
        r.spec.revision,
        s.size,
        r.spec.units,
        m.name,
        m.requested,
        m.actual,
        m.delta,
        m.tolerance,
        m.status,
        s.notes,
      ]);
    }),
  ]);
}
export function revisionsCsv(p: VectorPack) {
  return csv([
    [
      "Record",
      "Style",
      "Revision",
      "Units",
      "Recorded at",
      "Change summary",
      "Drawing SHA-256",
    ],
    ...(p.development?.revisions ?? []).map((r) => [
      r.name,
      r.spec.style,
      r.spec.revision,
      r.spec.units,
      r.createdAt,
      r.summary,
      r.drawingHash,
    ]),
  ]);
}
export function colorwaysCsv(p: VectorPack) {
  return csv([
    [
      "Style",
      "Revision",
      "Colorway",
      "Material code",
      "Color",
      "Supplier reference",
    ],
    ...(p.development?.colorways ?? []).flatMap((w) =>
      w.materials.map((m) => [
        p.style,
        p.revision,
        w.name,
        p.materials.find((v) => v.id === m.materialId)?.code ?? "MISSING",
        m.color,
        m.reference,
      ]),
    ),
  ]);
}
export function textilesCsv(p: VectorPack) {
  return csv([
    [
      "Layer ID",
      "View",
      "Layer",
      "Visible",
      "Material reference",
      "Print",
      "Base color",
      "Color 2",
      "Color 3",
      "Color 4",
      "Repeat (illustration units)",
      "Rotation (degrees)",
      "Swatch",
    ],
    ...p.layers
      .filter((l) => l.textile && l.fill !== "none")
      .map((l) => [
        l.id,
        l.view,
        l.name,
        l.visible,
        l.material,
        l.textile!.pattern,
        ...l.textile!.colors,
        l.textile!.scale,
        l.textile!.rotation,
        `textiles/${l.id}.svg`,
      ]),
  ]);
}

/** One vector tile per layer, repeated by the PDF renderer instead of duplicating thousands of shapes. */
function registerTextile(doc: jsPDF, l: VectorLayer, offset: number) {
  if (!l.textile || l.fill === "none") return;
  const t = l.textile,
    tile = textileTile(t),
    pointsPerMm = 72 / 25.4;
  const factor = (t.scale / tile.size) * 0.25 * pointsPerMm;
  const angle = (t.rotation * Math.PI) / 180,
    cos = Math.cos(angle),
    sin = Math.sin(angle);
  // SVG uses x-right/y-down. A PDF pattern matrix is in page points, independent of
  // jsPDF's mm coordinate adapter. This maps its origin to the same flat origin as SVG.
  const matrix = doc.Matrix(
    factor * cos,
    -factor * sin,
    -factor * sin,
    -factor * cos,
    offset * pointsPerMm,
    (doc.internal.pageSize.getHeight() - 28) * pointsPerMm,
  );
  const key = `textile-${l.id}`;
  doc.advancedAPI(() => {
    const pattern = doc.TilingPattern(
      [0, 0, tile.size, tile.size],
      tile.size,
      tile.size,
      undefined,
      matrix,
    );
    doc.beginTilingPattern(pattern);
    doc.setLineWidth(0);
    for (const mark of tile.marks) {
      doc.saveGraphicsState();
      if (mark.opacity !== undefined)
        doc.setGState(doc.GState({ opacity: mark.opacity }));
      doc.setFillColor(mark.fill);
      doc.path(mark.path);
      doc.fill();
      doc.restoreGraphicsState();
    }
    doc.endTilingPattern(key, pattern);
  });
  return { key };
}
function drawLayer(doc: jsPDF, l: VectorLayer, offset: number) {
  if (l.fill === "none" && l.strokeWidth === 0) return;
  const pattern = registerTextile(doc, l, offset);
  doc.setLineCap(l.lineCap ?? "round");
  doc.setLineJoin(l.lineJoin ?? "round");
  doc.setLineMiterLimit(4);
  const scale = 0.25,
    yy = 28;
  const xy = (p: { x: number; y: number }) => [
    offset + p.x * scale,
    yy + p.y * scale,
  ];
  const ops: { op: "m" | "l" | "c" | "h"; c: number[] }[] = [];
  const segment = (
    a: VectorLayer["nodes"][number],
    b: VectorLayer["nodes"][number],
  ) =>
    ops.push(
      a.out || b.in
        ? { op: "c", c: [...xy(a.out ?? a), ...xy(b.in ?? b), ...xy(b)] }
        : { op: "l", c: xy(b) },
    );
  for (const nodes of allContours(l)) {
    ops.push({ op: "m", c: xy(nodes[0]) });
    nodes.slice(1).forEach((n, i) => segment(nodes[i], n));
    if (l.closed) {
      segment(nodes.at(-1)!, nodes[0]);
      ops.push({ op: "h", c: [] });
    }
  }
  doc.setDrawColor(l.stroke);
  doc.setLineWidth(l.strokeWidth * scale);
  doc.setLineDashPattern(l.dashed ? [1.25, 1] : [], 0);
  doc.path(ops);
  if (l.fill === "none") doc.stroke();
  else {
    doc.setFillColor(l.fill);
    if (l.strokeWidth === 0)
      (l.fillRule ?? (l.contours ? "evenodd" : "nonzero")) === "evenodd"
        ? doc.fillEvenOdd(pattern)
        : doc.fill(pattern);
    else
      (l.fillRule ?? (l.contours ? "evenodd" : "nonzero")) === "evenodd"
        ? doc.fillStrokeEvenOdd(pattern)
        : doc.fillStroke(pattern);
  }
}
export function vectorPdf(input: VectorPack): Uint8Array {
  const p = VectorPackSchema.parse(input),
    doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setProperties({
    title: `${p.style} ${p.name}`,
    subject: "Garment specification and editable vector flat handoff",
    creator: "Corpora Studio",
  });
  const fitted = (s: string, width: number) => {
    let value = printable(s).replace(/[\r\n]+/g, " ");
    if (doc.getTextWidth(value) <= width) return value;
    while (value.length && doc.getTextWidth(value + "...") > width)
      value = value.slice(0, -1);
    return value + "...";
  };
  const title = (s: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor("#202020");
    doc.text(fitted(s, 267), 15, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
  };
  title(`${p.style} / ${p.name}`);
  doc.text(
    fitted(`Revision ${p.revision} | ${p.season} | ${p.manufacturer}`, 267),
    15,
    23,
  );
  for (const [i, v] of (["front", "back"] as const).entries()) {
    const ox = i === 0 ? 23 : 164;
    doc.saveGraphicsState();
    doc.rect(ox, 28, 120, 155, null);
    doc.clip();
    doc.discardPath();
    doc.setFontSize(9);
    doc.text(v.toUpperCase(), ox + 55, 34, { align: "center" });
    p.layers
      .filter((l) => l.view === v && l.visible)
      .forEach((l) => drawLayer(doc, l, ox));
    doc.setLineDashPattern([], 0);
    doc.setLineWidth(0.25);
    doc.setDrawColor("#555555");
    p.callouts
      .filter((c) => c.view === v)
      .forEach((c) => {
        const x = ox + c.label.x * 0.25,
          y = 28 + c.label.y * 0.25;
        doc.line(ox + c.anchor.x * 0.25, 28 + c.anchor.y * 0.25, x, y);
        doc.setFillColor("#ffffff");
        doc.circle(x, y, 2.5, "FD");
        doc.setFontSize(7);
        doc.text(String(p.callouts.indexOf(c) + 1), x, y + 0.8, {
          align: "center",
        });
      });
    doc.restoreGraphicsState();
  }
  doc.setFontSize(9);
  doc.text(
    `Technical flats are not cutting patterns. Dimensions are in ${p.units}; use the size specification.`,
    15,
    195,
  );
  let y = 0;
  const newPage = (name: string) => {
    doc.addPage();
    title(name);
    y = 30;
  };
  const line = (label: string, body: string) => {
    const wrapped = doc.splitTextToSize(
      printable(body || "Not specified"),
      245,
    ) as string[];
    for (let i = 0; i < wrapped.length; i += 24) {
      const chunk = wrapped.slice(i, i + 24);
      const h = chunk.length * 4 + 8;
      if (y + h > 190) newPage("Specifications / continued");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(fitted(i ? "Continued" : label, 267), 15, y);
      doc.setFont("helvetica", "normal");
      doc.text(chunk, 15, y + 5);
      y += h + 4;
    }
  };
  newPage("Construction & development notes");
  line("STYLE / REVISION", `${p.style} / ${p.revision}`);
  line("NOTES", p.notes);
  for (const [i, c] of p.callouts.entries())
    line(
      `${i + 1} / ${c.view.toUpperCase()}`,
      [c.text, calloutLinks(p, c)].filter(Boolean).join("\n"),
    );
  newPage(`Size specification / ${p.units}`);
  if (!p.measurements.length) line("MEASUREMENTS", "No measurements entered.");
  for (const m of p.measurements) {
    line(
      m.name,
      `${m.method}\nTolerance: +/- ${dimension(m.tolerance)} ${p.units} (${m.toleranceConfirmed ? "confirmed" : "not confirmed"})\n${p.sizes.map((s, i) => `${s}: ${m.values[i] === null ? "TBD" : dimension(m.values[i])}`).join("     ")}`,
    );
  }
  newPage("Bill of materials");
  if (!p.materials.length) line("MATERIALS", "No materials entered.");
  for (const m of p.materials)
    line(
      `${m.code} / ${m.kind}`,
      `${m.description}\nComposition: ${m.composition || "TBD"} | Color: ${m.color || "TBD"}\nQuantity: ${m.quantity} ${m.unit} | Supplier: ${m.supplier || "TBD"}`,
    );
  const textileLayers = p.layers.filter((l) => l.textile && l.fill !== "none");
  if (textileLayers.length) {
    newPage("Fabric prints & color placement");
    line(
      "PRINT SCALE",
      "Repeat sizes are illustration units in the technical flat, not millimeters or a production print repeat. Confirm final repeat, substrate and color matching with the manufacturer.",
    );
    for (const l of textileLayers)
      line(
        `${l.view.toUpperCase()} / ${l.name}${l.visible ? "" : " (hidden)"}`,
        `${textileSummary(l.textile!)}\nMaterial reference: ${l.material || "Not assigned"}`,
      );
  }
  for (const w of p.development?.colorways ?? []) {
    newPage(`Colorway / ${w.name}`);
    for (const m of w.materials)
      line(
        p.materials.find((v) => v.id === m.materialId)?.code ??
          "MISSING MATERIAL",
        `${m.color || "TBD"}\nSupplier reference: ${m.reference || "TBD"}`,
      );
  }
  if (p.development?.revisions.length) {
    newPage("Specification revision history");
    for (const r of p.development.revisions)
      line(
        `${r.name} / Rev ${r.spec.revision}`,
        `${r.createdAt} / ${r.spec.units}\n${r.summary || "No change summary"}\nDrawing SHA-256: ${r.drawingHash}`,
      );
  }
  for (const s of p.development?.samples ?? []) {
    const r = p.development!.revisions.find((r) => r.id === s.revisionId)!;
    newPage(`Sample / ${s.name}`);
    line(
      "REQUESTED SPECIFICATION",
      `${r.spec.style} / Revision ${r.spec.revision} / Size ${s.size} / ${r.spec.units}\nRecorded ${s.recordedAt}`,
    );
    for (const row of sampleRows(r, s))
      line(
        row.name,
        `Method: ${row.method}\nRequested: ${row.requested ?? "TBD"} / Measured: ${row.actual ?? "Not measured"} / Difference: ${row.delta === null ? "-" : row.delta.toFixed(3)} ${r.spec.units}\nTolerance: +/- ${row.tolerance} ${r.spec.units} / ${row.status}`,
      );
    line("SAMPLE FINDINGS", s.notes);
  }
  doc.addPage();
  title("Handoff review");
  let reviewY = 29;
  for (const line of handoffText(p).split("\n")) {
    for (const text of doc.splitTextToSize(printable(line), 264) as string[]) {
      if (reviewY > 190) {
        doc.addPage();
        title("Handoff review continued");
        reviewY = 29;
      }
      doc.text(text, 15, reviewY);
      reviewY += 5;
    }
  }
  const count = doc.getNumberOfPages();
  for (let i = 1; i <= count; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor("#555555");
    doc.text(
      printable(`${p.style} / Rev ${p.revision}  -  ${i} / ${count}`),
      282,
      204,
      { align: "right" },
    );
  }
  return new Uint8Array(doc.output("arraybuffer"));
}
export function vectorArchive(input: VectorPack): Uint8Array {
  const p = VectorPackSchema.parse(input);
  return zipSync(
    {
      ...(p.layers.some((l) => l.textile && l.fill !== "none")
        ? {
            "textiles.csv": strToU8(textilesCsv(p)),
            ...Object.fromEntries(
              p.layers
                .filter((l) => l.textile && l.fill !== "none")
                .map((l) => [
                  `textiles/${l.id}.svg`,
                  strToU8(textileSwatchSvg(l.textile!)),
                ]),
            ),
          }
        : {}),
      "front.svg": strToU8(vectorSvg(p, "front")),
      "back.svg": strToU8(vectorSvg(p, "back")),
      "technical-flats.svg": strToU8(vectorSvg(p)),
      "tech-pack.pdf": vectorPdf(p),
      "measurements.csv": strToU8(specCsv(p)),
      "materials.csv": strToU8(materialsCsv(p)),
      "construction.csv": strToU8(calloutsCsv(p)),
      "samples.csv": strToU8(samplesCsv(p)),
      "revisions.csv": strToU8(revisionsCsv(p)),
      "colorways.csv": strToU8(colorwaysCsv(p)),
      "editable-vector-pack.json": strToU8(JSON.stringify(p, null, 2)),
      "handoff-report.txt": strToU8(handoffText(p)),
      "handoff-manifest.json": strToU8(
        JSON.stringify(handoffManifest(p), null, 2),
      ),
      "README.txt": strToU8(
        `CORPORA STUDIO / ${p.style} / ${p.name} / REV ${p.revision}\n\nSVG files contain editable vector paths, front/back views and numbered construction callouts.\nPDF and CSV files contain specifications, material records and callout instructions.\nImport editable-vector-pack.json in Corpora Studio to continue editing.\nFabric prints use editable SVG/PDF tiling patterns. When present, textiles.csv and textiles/*.svg record layer assignments, colors and swatches. Repeat sizes are illustration units, not physical print dimensions. Confirm print repeats and production color matching separately.\nFlats are design drawings, not scale cutting patterns. Blank measurements are TBD. Confirm specifications and sample fit with your manufacturer before production.\nSewing patterns are exported separately from the Pattern studio.\n`,
      ),
    },
    { level: 6 },
  );
}
