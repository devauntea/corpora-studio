import {
  layoutBounds,
  layoutPieces,
  pathString,
  tilePlan,
  type Fashion,
  type PatternDraft,
  type PatternOp,
  type PatternPiece,
  type Point2,
} from "./fashion-model";

export const xml = (s: string) =>
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
export function pieceMarkup(p: PatternPiece, sa: number, guides = true) {
  const path = (
    ops: PatternOp[],
    stroke: string,
    width: number,
    dash = "",
    fill = "none",
  ) =>
    `<path d="${pathString(ops)}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
  const [a, b] = p.grain;
  const angle = Math.atan2(b.y - a.y, b.x - a.x),
    arrow = (at: Point2, dir: number) => {
      const l = {
          x: at.x + Math.cos(angle + 0.5) * 5 * dir,
          y: at.y + Math.sin(angle + 0.5) * 5 * dir,
        },
        r = {
          x: at.x + Math.cos(angle - 0.5) * 5 * dir,
          y: at.y + Math.sin(angle - 0.5) * 5 * dir,
        };
      return `M${l.x},${l.y} L${at.x},${at.y} L${r.x},${r.y}`;
    };
  return (
    path(p.seam, "#777", 0.35, sa ? "3 2" : "", "#fff") +
    (sa ? path(p.cutline, "#222", 0.6) : "") +
    (guides ? p.guides.map((g) => path(g, "#aaa", 0.3, "2 3")).join("") : "") +
    `<path d="M${a.x},${a.y} L${b.x},${b.y} ${arrow(a, 1)} ${arrow(b, -1)}" fill="none" stroke="#555" stroke-width="0.4"/>` +
    p.notches
      .map(
        (n) =>
          `<path d="M${n.point.x - 3},${n.point.y} h6 M${n.point.x},${n.point.y - 3} v6${n.double ? ` M${n.point.x + 3},${n.point.y - 3} v6` : ""}" fill="none" stroke="#111" stroke-width="0.6"/>`,
      )
      .join("") +
    `<g fill="#333" font-family="Arial, sans-serif" text-anchor="middle"><text x="${p.label.x}" y="${p.label.y - 5}" font-size="7">${xml(p.name.toUpperCase())}</text><text x="${p.label.x}" y="${p.label.y + 5}" font-size="4.5">${xml(p.cut)}</text></g>`
  );
}
export function patternSvg(draft: PatternDraft, f: Fashion, name: string) {
  const b = layoutBounds(draft, f),
    height = b.height + 110;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${b.width.toFixed(3)}mm" height="${height.toFixed(3)}mm" viewBox="${b.x} ${b.y - 110} ${b.width} ${height}">
<title>${xml(name)} — sewing pattern in millimeters</title>
<desc>Drafted locally using FreeSewing Teagan 4.10.2. Neckband by Form Studio. Seam allowance ${f.seamAllowance} mm; body and sleeve hems ${f.seamAllowance * 3} mm. Verify with a toile. Print at 100 percent.</desc>
<g fill="#222" font-family="Arial, sans-serif"><text x="${b.x + 20}" y="${b.y - 85}" font-size="12">${xml(name)}</text><text x="${b.x + 20}" y="${b.y - 68}" font-size="6">${xml(f.profile)} · 1 SVG unit = 1 mm · Print at 100%</text><text x="${b.x + 20}" y="${b.y - 54}" font-size="5">Solid: cut · Dashed: stitch · Crosses: matching marks · SA ${f.seamAllowance} mm / hems ${f.seamAllowance * 3} mm</text><text x="${b.x + 20}" y="${b.y - 40}" font-size="5">Knit T-shirt · Test neckband stretch and fit in a toile before cutting final fabric.</text></g>
<rect x="${b.x + b.width - 80}" y="${b.y - 90}" width="50" height="50" fill="none" stroke="#222" stroke-width="0.3"/>
<text x="${b.x + b.width - 55}" y="${b.y - 30}" font-family="Arial, sans-serif" font-size="5" text-anchor="middle">50 × 50 mm</text>
${layoutPieces(draft, f)
  .map(
    ({ piece, x, y }) =>
      `<g id="piece-${piece.id}" transform="translate(${x} ${y})">${pieceMarkup(piece, f.seamAllowance)}</g>`,
  )
  .join("\n")}</svg>`;
}

export async function patternPdf(
  draft: PatternDraft,
  f: Fashion,
  name: string,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    unit: "mm",
    format: f.paper,
    compress: true,
    precision: 5,
  });
  const ascii = (s: string) => s.replace(/[^\x20-\x7e]/g, " ");
  doc.setProperties({
    title: name,
    subject: "Full-scale tiled sewing pattern",
    creator: "Form Studio 0.7",
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.text("FORM / PATTERN STUDIO", 15, 23);
  doc.setFontSize(13);
  doc.text(ascii(name).slice(0, 70), 15, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const instructions = [
    `Profile: ${ascii(f.profile)}`,
    "Knit T-shirt / FreeSewing Teagan 4.10.2 + Form Studio neckband",
    `Print on ${f.paper === "a4" ? "A4" : "US Letter"} at ACTUAL SIZE / 100%. Disable fit-to-page.`,
    "Measure the square below before assembling or cutting.",
    "Trim on the tile frames. Match the 5 mm overlapping strips.",
    "Each piece has its own grid: rows top to bottom, columns left to right.",
    `Seam allowance: ${f.seamAllowance} mm. Body and sleeve hems: ${f.seamAllowance * 3} mm.`,
    "Solid lines: cut. Dashed: stitch. Crosses: matching marks.",
    "Front and back: cut 1 on fold. Sleeves: cut 2 mirrored.",
    `Neckband: ${Math.round(f.bandRatio * 100)}% of neck opening; finished width ${f.bandWidth} mm.`,
    "Neckband stretch varies by ribbing. Test a sample and sew a toile first.",
  ];
  instructions.forEach((line, i) => doc.text(line, 15, 45 + i * 5));
  doc.setDrawColor(0);
  doc.setLineWidth(0.25);
  doc.rect(15, 105, 100, 100);
  doc.text("100 x 100 mm calibration square", 15, 212);
  let page = 2;
  draft.pieces.forEach((p, i) => {
    const t = tilePlan(p, f.paper),
      count = t.columns * t.rows;
    doc.text(
      `${p.name}: ${t.columns} columns x ${t.rows} rows / pages ${page}-${page + count - 1}`,
      15,
      224 + i * 6,
    );
    page += count;
  });
  doc.setFontSize(8);
  doc.text(
    "Assembly instructions: freesewing.eu/docs/designs/teagan/instructions/",
    15,
    254,
  );
  doc.text(
    "This is a first fitting draft. Physical fit has not been verified.",
    15,
    260,
  );
  const drawPath = (
    ops: PatternOp[],
    x: number,
    y: number,
    stroke: number,
    dash: number[] = [],
  ) => {
    doc.setDrawColor(stroke);
    doc.setLineWidth(0.25);
    doc.setLineDashPattern(dash, 0);
    doc
      .path(
        ops.map((o) =>
          o.type === "close"
            ? { op: "h", c: [] }
            : o.type === "curve"
              ? {
                  op: "c",
                  c: [
                    o.cp1.x + x,
                    o.cp1.y + y,
                    o.cp2.x + x,
                    o.cp2.y + y,
                    o.to.x + x,
                    o.to.y + y,
                  ],
                }
              : {
                  op: o.type === "move" ? "m" : "l",
                  c: [o.to.x + x, o.to.y + y],
                },
        ),
      )
      .stroke();
    doc.setLineDashPattern([], 0);
  };
  for (const p of draft.pieces) {
    const t = tilePlan(p, f.paper);
    for (let row = 0; row < t.rows; row++)
      for (let col = 0; col < t.columns; col++) {
        doc.addPage(f.paper, "portrait");
        doc.saveGraphicsState();
        // A null paint style keeps the rectangle in the path until clipping.
        doc.rect(10, 16, t.width, t.height, null).clip().discardPath();
        const x = 16 - col * (t.width - t.overlap),
          y = 22 - row * (t.height - t.overlap);
        drawPath(p.seam, x, y, 70, f.seamAllowance ? [3, 2] : []);
        if (f.seamAllowance) drawPath(p.cutline, x, y, 0);
        p.guides.forEach((g) => drawPath(g, x, y, 150, [2, 3]));
        const [a, b] = p.grain;
        drawPath(
          [
            { type: "move", to: a },
            { type: "line", to: b },
          ],
          x,
          y,
          80,
        );
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        for (const [at, dir] of [
          [a, 1],
          [b, -1],
        ] as const)
          drawPath(
            [
              {
                type: "move",
                to: {
                  x: at.x + Math.cos(angle + 0.5) * 5 * dir,
                  y: at.y + Math.sin(angle + 0.5) * 5 * dir,
                },
              },
              { type: "line", to: at },
              {
                type: "line",
                to: {
                  x: at.x + Math.cos(angle - 0.5) * 5 * dir,
                  y: at.y + Math.sin(angle - 0.5) * 5 * dir,
                },
              },
            ],
            x,
            y,
            80,
          );
        for (const { point: n, double } of p.notches) {
          drawPath(
            [
              { type: "move", to: { x: n.x - 3, y: n.y } },
              { type: "line", to: { x: n.x + 3, y: n.y } },
              { type: "move", to: { x: n.x, y: n.y - 3 } },
              { type: "line", to: { x: n.x, y: n.y + 3 } },
            ],
            x,
            y,
            0,
          );
          if (double)
            drawPath(
              [
                { type: "move", to: { x: n.x + 3, y: n.y - 3 } },
                { type: "line", to: { x: n.x + 3, y: n.y + 3 } },
              ],
              x,
              y,
              0,
            );
        }
        doc.setFontSize(15);
        doc.setTextColor(30);
        doc.text(p.name.toUpperCase(), p.label.x + x, p.label.y + y - 5, {
          align: "center",
        });
        doc.setFontSize(10);
        doc.text(ascii(p.cut), p.label.x + x, p.label.y + y + 5, {
          align: "center",
        });
        doc.restoreGraphicsState();
        doc.setDrawColor(160);
        doc.setLineWidth(0.2);
        doc.rect(10, 16, t.width, t.height);
        // Duplicate strips on adjacent pages provide registration without scaling.
        doc.setLineDashPattern([1, 2], 0);
        if (col < t.columns - 1)
          doc.line(10 + t.width - 5, 16, 10 + t.width - 5, 16 + t.height);
        if (row < t.rows - 1)
          doc.line(10, 16 + t.height - 5, 10 + t.width, 16 + t.height - 5);
        doc.setLineDashPattern([], 0);
        doc.setTextColor(50);
        doc.setFontSize(9);
        doc.text(
          `${p.name} / R${row + 1} C${col + 1} / ${t.rows} rows x ${t.columns} columns`,
          10,
          10,
        );
        doc.text(
          `Form Studio | ${f.paper.toUpperCase()} | 100% | ${f.seamAllowance} mm SA | 5 mm overlap`,
          10,
          t.pageHeight - 8,
        );
        doc.text(
          `${doc.getNumberOfPages()}`,
          t.pageWidth - 12,
          t.pageHeight - 8,
          { align: "right" },
        );
      }
  }
  return new Uint8Array(doc.output("arraybuffer"));
}
