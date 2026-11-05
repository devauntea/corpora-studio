import { jsPDF } from "jspdf";
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
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\n]/g, "?");
const dimension = (value: number | null) =>
  value === null ? "" : Math.round(value * 1000) / 1000;
export function vectorSvg(input: VectorPack, view?: VectorView) {
  const p = VectorPackSchema.parse(input),
    views: VectorView[] = view ? [view] : ["front", "back"];
  const width = views.length * 480;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="680" viewBox="0 0 ${width} 680"><title>${esc(p.style + " · " + p.name)}</title><desc>Technical garment flat. Not a scale cutting pattern. Revision ${esc(p.revision)}.</desc><rect width="100%" height="100%" fill="white"/><g font-family="Arial,sans-serif" fill="#202020"><text x="20" y="26" font-size="14">${esc(p.style + " / " + p.name + " / Rev " + p.revision)}</text>${views
    .map(
      (v, i) =>
        `<defs><clipPath id="${v}-artboard"><rect width="480" height="620"/></clipPath></defs><g id="${v}" transform="translate(${i * 480} 45)" clip-path="url(#${v}-artboard)"><text x="220" y="20" font-size="11" text-anchor="middle">${v.toUpperCase()}</text>${p.layers
          .filter((l) => l.view === v && l.visible)
          .map(
            (l) =>
              `<path id="layer-${l.id}" data-name="${esc(l.name)}" data-material="${esc(l.material)}" d="${vectorPath(l)}" fill="${l.fill}" fill-rule="${l.contours ? "evenodd" : "nonzero"}" stroke="${l.stroke}" stroke-width="${l.strokeWidth}" stroke-linejoin="round" stroke-linecap="round"${l.dashed ? ' stroke-dasharray="5 4"' : ""}><title>${esc(l.name)}</title></path>`,
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
    ["No.", "View", "Instruction"],
    ...p.callouts.map((c, i) => [i + 1, c.view, c.text]),
  ]);
}
function drawLayer(doc: jsPDF, l: VectorLayer, offset: number) {
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
    if (l.strokeWidth === 0) l.contours ? doc.fillEvenOdd() : doc.fill();
    else l.contours ? doc.fillStrokeEvenOdd() : doc.fillStroke();
  }
}
export function vectorPdf(input: VectorPack): Uint8Array {
  const p = VectorPackSchema.parse(input),
    doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setProperties({
    title: `${p.style} ${p.name}`,
    subject: "Garment specification and editable vector flat handoff",
    creator: "Form Studio",
  });
  const title = (s: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor("#202020");
    doc.text(printable(s).slice(0, 100), 15, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
  };
  title(`${p.style} / ${p.name}`);
  doc.text(
    printable(`Revision ${p.revision} | ${p.season} | ${p.manufacturer}`).slice(
      0,
      160,
    ),
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
      doc.text(printable(i ? "Continued" : label), 15, y);
      doc.setFont("helvetica", "normal");
      doc.text(chunk, 15, y + 5);
      y += h + 4;
    }
  };
  newPage("Construction & development notes");
  line("STYLE / REVISION", `${p.style} / ${p.revision}`);
  line("NOTES", p.notes);
  for (const [i, c] of p.callouts.entries())
    line(`${i + 1} / ${c.view.toUpperCase()}`, c.text);
  newPage(`Size specification / ${p.units}`);
  if (!p.measurements.length) line("MEASUREMENTS", "No measurements entered.");
  for (const m of p.measurements) {
    line(
      m.name,
      `${m.method}\nTolerance: +/- ${dimension(m.tolerance)} ${p.units}\n${p.sizes.map((s, i) => `${s}: ${m.values[i] === null ? "TBD" : dimension(m.values[i])}`).join("     ")}`,
    );
  }
  newPage("Bill of materials");
  if (!p.materials.length) line("MATERIALS", "No materials entered.");
  for (const m of p.materials)
    line(
      `${m.code} / ${m.kind}`,
      `${m.description}\nComposition: ${m.composition || "TBD"} | Color: ${m.color || "TBD"}\nQuantity: ${m.quantity} ${m.unit} | Supplier: ${m.supplier || "TBD"}`,
    );
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
      "front.svg": strToU8(vectorSvg(p, "front")),
      "back.svg": strToU8(vectorSvg(p, "back")),
      "technical-flats.svg": strToU8(vectorSvg(p)),
      "tech-pack.pdf": vectorPdf(p),
      "measurements.csv": strToU8(specCsv(p)),
      "materials.csv": strToU8(materialsCsv(p)),
      "construction.csv": strToU8(calloutsCsv(p)),
      "editable-vector-pack.json": strToU8(JSON.stringify(p, null, 2)),
      "README.txt": strToU8(
        `FORM STUDIO / ${p.style} / ${p.name} / REV ${p.revision}\n\nSVG files contain editable vector paths, front/back views and numbered construction callouts.\nPDF and CSV files contain specifications, material records and callout instructions.\nImport editable-vector-pack.json in Form Studio to continue editing.\nFlats are design drawings, not scale cutting patterns. Blank measurements are TBD. Confirm specifications and sample fit with your manufacturer before production.\nSewing patterns are exported separately from the Pattern studio.\n`,
      ),
    },
    { level: 6 },
  );
}
