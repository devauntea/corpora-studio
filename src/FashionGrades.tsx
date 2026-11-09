import { useMemo } from "react";
import { draftFashion } from "./fashion-draft";
import { pathString, type Fashion } from "./fashion-model";
import { savePattern, saveTextFile } from "./io";
import { xml } from "./fashion-export";
export function gradeSeries(f: Fashion) {
  return (f.gradeIds ?? []).map((id) => {
    const profile = f.profiles?.find((p) => p.id === id);
    if (!profile) throw new Error("Missing size-series profile.");
    return {
      profile,
      draft: draftFashion({
        ...f,
        profile: profile.name,
        measurements: profile.measurements,
        construction: undefined,
      }),
    };
  });
}
export function gradeSvg(f: Fashion) {
  const series = gradeSeries(f);
  if (series.length < 2)
    throw new Error(
      "Select at least two project profiles for size comparison.",
    );
  const colors = [
    "#111111",
    "#b92727",
    "#175abb",
    "#267333",
    "#8b36a4",
    "#975715",
    "#08777f",
    "#bb326f",
  ];
  let x = 25,
    height = 200;
  const paths: string[] = [];
  for (const p of series[0].draft.pieces) {
    const members = series
      .map((s, i) => ({ piece: s.draft.pieces.find((q) => q.id === p.id), i }))
      .filter((m) => m.piece !== undefined);
    const minX = Math.min(...members.map((m) => m.piece!.origin.x)),
      minY = Math.min(...members.map((m) => m.piece!.origin.y));
    const maxX = Math.max(
        ...members.map((m) => m.piece!.origin.x + m.piece!.width),
      ),
      maxY = Math.max(
        ...members.map((m) => m.piece!.origin.y + m.piece!.height),
      );
    paths.push(`<text x="${x}" y="95" font-size="7">${xml(p.name)}</text>`);
    for (const { piece: q, i } of members)
      paths.push(
        `<path d="${pathString(q!.seam)}" transform="translate(${x + q!.origin.x - minX},${110 + q!.origin.y - minY})" fill="none" stroke="${colors[i]}" stroke-width="0.65"${i ? ' stroke-dasharray="' + (i + 2) + ' 2"' : ""}/>`,
      );
    x += maxX - minX + 40;
    height = Math.max(height, maxY - minY + 145);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${x}mm" height="${height}mm" viewBox="0 0 ${x} ${height}"><rect width="100%" height="100%" fill="white"/><g font-family="Arial,sans-serif" fill="#222"><text x="25" y="18" font-size="10">CORPORA / SIZE SERIES · independent drafts</text><text x="25" y="30" font-size="4.5">Stitch lines aligned in engine coordinates. Manual piece overrides are excluded. 1 unit = 1 mm.</text>${series.map((s, i) => `<text x="25" y="${40 + i * 5}" font-size="4" fill="${colors[i]}">${i + 1}. ${xml(s.profile.name)}</text>`).join("")}<rect x="${x - 80}" y="25" width="50" height="50" fill="none" stroke="#111" stroke-width=".3"/><text x="${x - 80}" y="82" font-size="4">50 mm calibration</text>${paths.join("")}</g></svg>`;
}
export function gradeCsv(f: Fashion) {
  const escape = (s: string) => '"' + s.replace(/"/g, '""') + '"';
  return (
    "Profile,Piece,Width mm,Height mm\r\n" +
    gradeSeries(f)
      .flatMap((s) =>
        s.draft.pieces.map((p) =>
          [
            escape(s.profile.name),
            escape(p.name),
            p.width.toFixed(3),
            p.height.toFixed(3),
          ].join(","),
        ),
      )
      .join("\r\n")
  );
}
export function FashionGrades({
  value,
  notify,
}: {
  value: Fashion;
  notify: (s: string, error?: boolean) => void;
}) {
  const result = useMemo(() => {
    try {
      return { svg: gradeSvg(value), error: "" };
    } catch (e) {
      return { svg: "", error: String(e) };
    }
  }, [value]);
  return (
    <div className="grade-board">
      <div className="pattern-toolbar">
        <span>Nested stitch lines · independent drafts</span>
        <button
          disabled={!result.svg}
          onClick={async () => {
            try {
              await savePattern(
                new TextEncoder().encode(result.svg),
                "Size series",
                "svg",
              );
            } catch (e) {
              notify(String(e), true);
            }
          }}
        >
          Export nested SVG
        </button>
        <button
          disabled={!result.svg}
          onClick={async () => {
            try {
              await saveTextFile(gradeCsv(value), "Grade check", "csv");
            } catch (e) {
              notify(String(e), true);
            }
          }}
        >
          Export grade check
        </button>
      </div>
      {result.error ? (
        <p role="status">
          {result.error} Open Profiles & size series to select profiles.
        </p>
      ) : (
        <div
          className="grade-preview"
          role="img"
          aria-label="Nested pattern size comparison"
          dangerouslySetInnerHTML={{
            __html: result.svg.replace(/^<\?xml.*?\?>/, ""),
          }}
        />
      )}
    </div>
  );
}
