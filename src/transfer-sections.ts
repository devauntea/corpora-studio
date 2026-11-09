import {
  TransferPlanSchema,
  poseNames,
  type TransferPlan,
} from "./tattoo-study";
import { stencilDimensions, type StencilSettings } from "./stencil-export";
import type { Contour } from "./stencil-trace";

export function transferSections(
  w: number,
  h: number,
  settings: StencilSettings,
  input: TransferPlan,
) {
  const plan = TransferPlanSchema.parse(input),
    d = stencilDimensions(w, h, settings),
    height = h * d.scale;
  const sections = plan.sections.length
    ? plan.sections
    : [{ id: "whole", name: "Full artwork", x: 0, y: 0, width: 1, height: 1 }];
  return sections.map((s) => {
    const left = (settings.mirror ? 1 - s.x - s.width : s.x) * settings.width;
    const x = Math.max(0, left - plan.overlap / 2),
      y = Math.max(0, s.y * height - plan.overlap / 2);
    const right = Math.min(
        settings.width,
        left + s.width * settings.width + plan.overlap / 2,
      ),
      bottom = Math.min(height, (s.y + s.height) * height + plan.overlap / 2);
    return {
      id: s.id,
      name: s.name,
      x,
      y,
      width: right - x,
      height: bottom - y,
      marks: plan.marks
        .filter((m) => {
          const mx = (settings.mirror ? 1 - m.x : m.x) * settings.width,
            my = m.y * height;
          return mx >= x && mx <= right && my >= y && my <= bottom;
        })
        .map((m) => ({
          ...m,
          x: (settings.mirror ? 1 - m.x : m.x) * settings.width,
          y: m.y * height,
        })),
    };
  });
}
const ascii = (s: string) => s.replace(/[^\x20-\x7e]/g, " ");
export async function registeredStencilPdf(
  lines: Contour[],
  w: number,
  h: number,
  s: StencilSettings,
  input: TransferPlan,
) {
  if (!lines.length) throw new Error("Select at least one contour.");
  const plan = TransferPlanSchema.parse(input),
    sections = transferSections(w, h, s, plan),
    d = stencilDimensions(w, h, s);
  const { jsPDF } = await import("jspdf"),
    doc = new jsPDF({
      unit: "mm",
      format: s.paper,
      precision: 5,
      compress: true,
    });
  const pw = s.paper === "a4" ? 210 : 215.9,
    ph = s.paper === "a4" ? 297 : 279.4,
    tw = pw - 24,
    th = ph - 48,
    tileOverlap = 5;
  const tiles = sections.map((section) => ({
    section,
    cols: Math.max(
      1,
      Math.ceil((section.width * d.sx - tileOverlap) / (tw - tileOverlap)),
    ),
    rows: Math.max(
      1,
      Math.ceil((section.height * d.sy - tileOverlap) / (th - tileOverlap)),
    ),
  }));
  const stencilPages = tiles.reduce((n, t) => n + t.cols * t.rows, 0);
  if (stencilPages > 48)
    throw new Error(
      "Transfer plan exceeds 48 stencil pages. Use fewer or smaller sections.",
    );
  doc.setFontSize(18);
  doc.text("CORPORA / TRANSFER PROOF", 12, 20);
  doc.setFontSize(10);
  const metadata = [
    `Transfer pose: ${poseNames[plan.pose]}. Mirrored: ${s.mirror ? "yes" : "no"}.`,
    `Artwork: ${s.width.toFixed(1)} x ${(h * d.scale).toFixed(1)} mm. Section overlap: ${plan.overlap.toFixed(1)} mm.`,
    `Printer profile: ${ascii(s.printer.name)}`,
    `Stock / settings: ${ascii((s.printer.paper || "not recorded") + " / " + (s.printer.settings || "not recorded"))}`,
    `Correction: X ${d.sx.toFixed(4)} / Y ${d.sy.toFixed(4)}. Print ACTUAL SIZE / 100%.`,
    "Registration crosses are alignment guides, not tattoo contours.",
    "These sections crop flat source art. They do not flatten a curved body without distortion.",
    "Confirm the pose, landmarks and transfer on the actual body before use.",
  ].flatMap((line) => doc.splitTextToSize(line, pw - 24) as string[]);
  doc.text(metadata, 12, 32);
  doc.setFontSize(9);
  const notes = doc.splitTextToSize(ascii(plan.notes), pw - 24) as string[];
  const noteY = Math.max(73, 32 + metadata.length * 4.1 + 6);
  const extraNotes = !!plan.notes.trim() && noteY + notes.length * 3.7 > 98;
  const count = stencilPages + 1 + (extraNotes ? 1 : 0);
  if (extraNotes)
    doc.text(
      "Orientation / landmark notes continue on the next page.",
      12,
      Math.min(97, noteY),
    );
  else if (plan.notes.trim()) doc.text(notes, 12, noteY);
  const scale = Math.min((pw - 72) / s.width, 92 / (h * d.scale)),
    oy = 104,
    ox = 17;
  doc.setLineWidth(0.2);
  doc.setDrawColor(80);
  doc.setDrawColor(180);
  doc.setLineWidth(0.1);
  for (const line of lines)
    doc
      .path(
        line.points.map(([x, y], i) => ({
          op: i ? ("l" as const) : ("m" as const),
          c: [
            ox + (s.mirror ? w - x : x) * d.scale * scale,
            oy + y * d.scale * scale,
          ],
        })),
      )
      .stroke();
  doc.setDrawColor(40);
  sections.forEach((b, i) => {
    doc.rect(
      ox + b.x * scale,
      oy + b.y * scale,
      b.width * scale,
      b.height * scale,
    );
    doc.text(
      `${i + 1}: ${ascii(b.name).slice(0, 24)}`,
      ox + b.x * scale + 1,
      oy + b.y * scale + 4,
    );
  });
  doc.setFontSize(8);
  doc.text(
    "Overview only - not to scale. The following pages are actual size with printer correction.",
    12,
    205,
  );
  doc.setDrawColor(0);
  doc.setLineWidth(0.15);
  const rulerY = 221;
  doc.line(16, rulerY, 16 + 100 * d.sx, rulerY);
  for (let mm = 0; mm <= 100; mm += 5) {
    doc.line(
      16 + mm * d.sx,
      rulerY,
      16 + mm * d.sx,
      rulerY - (mm % 10 === 0 ? 4 : 2),
    );
    if (mm % 20 === 0) doc.text(String(mm), 16 + mm * d.sx, rulerY + 5);
  }
  doc.text("100 mm horizontal check after printing", 16, rulerY + 10);
  doc.line(pw - 24, 110, pw - 24, 110 + 100 * d.sy);
  doc.line(pw - 27, 110, pw - 21, 110);
  doc.line(pw - 27, 110 + 100 * d.sy, pw - 21, 110 + 100 * d.sy);
  doc.text("100 mm Y", pw - 41, 106);
  doc.text(
    "Physical print / artist acceptance: not yet verified.",
    12,
    ph - 12,
  );
  if (extraNotes) {
    doc.addPage();
    doc.setFontSize(18);
    doc.text("CORPORA / ORIENTATION NOTES", 12, 20);
    doc.setFontSize(10);
    doc.text(`Transfer pose: ${poseNames[plan.pose]}`, 12, 32);
    doc.setFontSize(9);
    doc.text(notes, 12, 45);
  }
  for (const { section: b, cols, rows } of tiles)
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        doc.addPage();
        doc.setFontSize(9);
        doc.text(
          `${ascii(b.name).slice(0, 40)} / R${row + 1} C${col + 1} / ${poseNames[plan.pose]} / ${s.mirror ? "MIRRORED" : "not mirrored"}`,
          12,
          12,
        );
        doc.setFontSize(7);
        doc.text(
          "Print 100% / alignment marks are separate from ink / tile overlap 5 mm",
          12,
          18,
        );
        doc.saveGraphicsState();
        doc
          .rect(
            12,
            24,
            Math.min(tw, b.width * d.sx - col * (tw - tileOverlap)),
            Math.min(th, b.height * d.sy - row * (th - tileOverlap)),
            null,
          )
          .clip()
          .discardPath();
        // jsPDF's drawing API uses top-left millimetres; raw PDF matrices use
        // bottom-left points. Apply calibration in drawing coordinates directly.
        const px = (x: number) =>
          12 + (x - b.x) * d.sx - col * (tw - tileOverlap);
        const py = (y: number) =>
          24 + (y - b.y) * d.sy - row * (th - tileOverlap);
        doc.setDrawColor(0);
        doc.setLineWidth(s.lineWeight);
        doc.setLineCap("round");
        doc.setLineJoin("round");
        for (const line of lines)
          doc
            .path(
              line.points.map(([x, y], i) => ({
                op: i ? ("l" as const) : ("m" as const),
                c: [px((s.mirror ? w - x : x) * d.scale), py(y * d.scale)],
              })),
            )
            .stroke();
        doc.setLineWidth(0.2);
        doc.setFontSize(7);
        for (const m of b.marks) {
          doc.line(px(m.x - 2), py(m.y), px(m.x + 2), py(m.y));
          doc.line(px(m.x), py(m.y - 2), px(m.x), py(m.y + 2));
          doc.ellipse(px(m.x), py(m.y), 0.8 * d.sx, 0.8 * d.sy);
          const labelY = py(m.y) < 30 ? py(m.y) + 3.5 : py(m.y) - 2;
          doc.text(ascii(m.name).slice(0, 20), px(m.x + 3), labelY);
        }
        doc.restoreGraphicsState();
        doc.setDrawColor(150);
        doc.setLineWidth(0.15);
        doc.rect(
          12,
          24,
          Math.min(tw, b.width * d.sx - col * (tw - tileOverlap)),
          Math.min(th, b.height * d.sy - row * (th - tileOverlap)),
        );
        doc.setFontSize(7);
        doc.text(
          `${ascii(s.printer.name).slice(0, 40)} / section overlap ${plan.overlap} mm / page ${doc.getNumberOfPages()} of ${count}`,
          12,
          ph - 8,
        );
      }
  return new Uint8Array(doc.output("arraybuffer"));
}
