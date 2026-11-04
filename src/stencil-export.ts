import { z } from "zod";
import type { Contour } from "./stencil-trace";
const n = (min: number, max: number) => z.number().finite().min(min).max(max);
export const PrinterSchema = z
  .object({
    name: z.string().min(1).max(80),
    measuredX: n(40, 60),
    measuredY: n(40, 60),
  })
  .strict();
export type PrinterCalibration = z.infer<typeof PrinterSchema>;
export type StencilSettings = {
  width: number;
  lineWeight: number;
  dpi: 150 | 300 | 600;
  mirror: boolean;
  paper: "a4" | "letter";
  printer: PrinterCalibration;
};
export function stencilDimensions(w: number, h: number, s: StencilSettings) {
  if (
    w < 1 ||
    h < 1 ||
    s.width < 10 ||
    s.width > 600 ||
    s.lineWeight < 0.05 ||
    s.lineWeight > 2 ||
    ![150, 300, 600].includes(s.dpi)
  )
    throw new Error("Invalid stencil size, line weight or resolution.");
  const p = PrinterSchema.parse(s.printer),
    sx = 50 / p.measuredX,
    sy = 50 / p.measuredY;
  return {
    width: s.width * sx,
    height: ((s.width * h) / w) * sy,
    sx,
    sy,
    scale: s.width / w,
  };
}
export async function calibrationPdf(paper: "a4" | "letter") {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: paper, precision: 5 });
  doc.setFontSize(18);
  doc.text("FORM / PRINTER CALIBRATION", 20, 25);
  doc.setFontSize(10);
  doc.text(
    [
      "Print at ACTUAL SIZE / 100%. Disable fit-to-page.",
      "Use the same printer, driver, paper and settings as the final stencil.",
      "Measure the outside square in both directions and enter the results.",
      "This sheet is intentionally uncorrected.",
    ],
    20,
    40,
  );
  doc.setLineWidth(0.15);
  doc.rect(25, 75, 50, 50);
  doc.text("50 x 50 mm", 25, 135);
  for (let mm = 0; mm <= 100; mm++) {
    const h = mm % 10 === 0 ? 7 : mm % 5 === 0 ? 5 : 3;
    doc.line(25 + mm, 155, 25 + mm, 155 - h);
    if (mm % 10 === 0) doc.text(String(mm), 25 + mm, 162, { align: "center" });
  }
  doc.text("100 mm ruler", 25, 175);
  return new Uint8Array(doc.output("arraybuffer"));
}
export async function stencilPdf(
  lines: Contour[],
  w: number,
  h: number,
  s: StencilSettings,
) {
  if (!lines.length) throw new Error("Select at least one contour.");
  const d = stencilDimensions(w, h, s),
    { jsPDF } = await import("jspdf"),
    doc = new jsPDF({
      unit: "mm",
      format: s.paper,
      precision: 5,
      compress: true,
    });
  const pw = s.paper === "a4" ? 210 : 215.9,
    ph = s.paper === "a4" ? 297 : 279.4,
    tw = pw - 20,
    th = ph - 30,
    overlap = 5;
  const columns = Math.max(
      1,
      Math.ceil((d.width + 4 - overlap) / (tw - overlap)),
    ),
    rows = Math.max(1, Math.ceil((d.height + 4 - overlap) / (th - overlap)));
  if (columns * rows > 36)
    throw new Error("Stencil exceeds the 36-page print budget.");
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < columns; col++) {
      if (row || col) doc.addPage();
      doc.setFontSize(8);
      doc.text(
        `FORM stencil / R${row + 1} C${col + 1} / ${s.width.toFixed(1)} mm / print 100%`,
        10,
        10,
      );
      doc.saveGraphicsState();
      doc.rect(10, 16, tw, th, null).clip().discardPath();
      const tx = 12 - col * (tw - overlap),
        ty = 18 - row * (th - overlap);
      doc.setCurrentTransformationMatrix(doc.Matrix(d.sx, 0, 0, d.sy, tx, ty));
      doc.setLineWidth(s.lineWeight);
      doc.setLineCap("round");
      doc.setLineJoin("round");
      doc.setDrawColor(0);
      for (const line of lines)
        doc
          .path(
            line.points.map(([x, y], i) => ({
              op: i ? ("l" as const) : ("m" as const),
              c: [(s.mirror ? w - x : x) * d.scale, y * d.scale],
            })),
          )
          .stroke();
      doc.restoreGraphicsState();
      doc.setDrawColor(150);
      doc.setLineWidth(0.15);
      doc.rect(10, 16, tw, th);
      doc.setFontSize(7);
      doc.text(
        `Printer: ${s.printer.name.replace(/[^\x20-\x7e]/g, " ").slice(0, 45)} / correction ${d.sx.toFixed(4)} x ${d.sy.toFixed(4)} / overlap 5 mm`,
        10,
        ph - 6,
      );
    }
  return new Uint8Array(doc.output("arraybuffer"));
}
export function withPngDpi(bytes: Uint8Array, dpi: number) {
  if (
    bytes.length < 33 ||
    bytes[0] !== 137 ||
    String.fromCharCode(...bytes.slice(1, 4)) !== "PNG"
  )
    throw new Error("Invalid PNG.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    chunks: Uint8Array[] = [bytes.slice(0, 8)];
  let inserted = false;
  const payload = new Uint8Array(13);
  payload.set([112, 72, 89, 115]);
  const data = new DataView(payload.buffer);
  data.setUint32(4, Math.round(dpi / 0.0254));
  data.setUint32(8, Math.round(dpi / 0.0254));
  payload[12] = 1;
  let crc = 0xffffffff;
  for (const v of payload) {
    crc ^= v;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const phys = new Uint8Array(21),
    pv = new DataView(phys.buffer);
  pv.setUint32(0, 9);
  phys.set(payload, 4);
  pv.setUint32(17, (crc ^ 0xffffffff) >>> 0);
  for (let offset = 8; offset < bytes.length; ) {
    const length = view.getUint32(offset),
      end = offset + 12 + length;
    if (end > bytes.length) throw new Error("Invalid PNG chunk.");
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    if (type !== "pHYs") chunks.push(bytes.slice(offset, end));
    if (type === "IHDR") {
      chunks.push(phys);
      inserted = true;
    }
    offset = end;
  }
  if (!inserted) throw new Error("PNG header missing.");
  const output = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}
export function stencilPng(
  lines: Contour[],
  w: number,
  h: number,
  s: StencilSettings,
) {
  if (!lines.length) throw new Error("Select at least one contour.");
  const d = stencilDimensions(w, h, s),
    px = s.dpi / 25.4,
    c = document.createElement("canvas");
  c.width = Math.ceil((d.width + 4) * px);
  c.height = Math.ceil((d.height + 4) * px);
  if (c.width * c.height > 16_000_000 || c.width > 12000 || c.height > 12000)
    throw new Error(
      "PNG exceeds 16 megapixels. Reduce size / DPI or use tiled PDF.",
    );
  const x = c.getContext("2d")!;
  x.fillStyle = "white";
  x.fillRect(0, 0, c.width, c.height);
  x.translate(2 * px, 2 * px);
  x.scale(px * d.sx, px * d.sy);
  x.strokeStyle = "black";
  x.lineWidth = s.lineWeight;
  x.lineJoin = x.lineCap = "round";
  for (const line of lines) {
    x.beginPath();
    line.points.forEach(([a, b], i) =>
      i
        ? x.lineTo((s.mirror ? w - a : a) * d.scale, b * d.scale)
        : x.moveTo((s.mirror ? w - a : a) * d.scale, b * d.scale),
    );
    x.stroke();
  }
  const raw = atob(c.toDataURL("image/png").split(",")[1]),
    bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0)),
    out = withPngDpi(bytes, s.dpi);
  let binary = "";
  for (let i = 0; i < out.length; i += 8192)
    binary += String.fromCharCode(...out.subarray(i, i + 8192));
  return "data:image/png;base64," + btoa(binary);
}
