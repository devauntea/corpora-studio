import { zipSync, strToU8 } from "fflate";
import { patternSvg, patternPdf } from "./fashion-export";
import {
  boundaryEdges,
  constructionChecks,
  withSeamNotches,
} from "./seam-checks";
import type { Fashion, PatternDraft } from "./fashion-model";

export function constructionReport(
  draft: PatternDraft,
  f: Fashion,
  name: string,
) {
  const checks = constructionChecks(draft, f);
  return {
    format: "form-studio-construction",
    version: 1,
    project: name,
    style: f.vectorPack?.style ?? name,
    revision: f.vectorPack?.revision ?? "Unspecified",
    profile: "svg-pdf-mm-v1",
    units: "mm",
    size: f.profile,
    sizeDevelopment:
      "Single measurement profile; independently drafted, not graded",
    design: f.design ?? "teagan",
    fabric: f.fabric ?? null,
    pieces: draft.pieces.map((p) => ({
      id: p.id,
      name: p.name,
      cutInstruction: p.cut,
      seam: p.seam,
      cutBoundary: p.cutline,
      grainline: p.grain,
      notches: p.notches,
      edges: boundaryEdges(p).map((e) => ({
        id: e.id,
        index: e.index,
        length: e.length,
      })),
      allowances: p.allowances ?? null,
    })),
    plan: f.seamPlan ?? null,
    checks: checks.map(({ a, b, ...c }) => ({
      ...c,
      aLength: a?.length ?? null,
      bLength: b?.length ?? null,
    })),
    coverage:
      "Only explicitly paired edges are checked; unpaired boundaries and instructions require review.",
    externalCadVerified: false,
    physicalSampleVerified: false,
  };
}
export async function constructionArchive(
  draft: PatternDraft,
  f: Fashion,
  name: string,
) {
  const marked = withSeamNotches(draft, f),
    report = constructionReport(draft, f, name);
  report.pieces.forEach((p, i) => (p.notches = marked.pieces[i].notches));
  const enc = (v: unknown) => strToU8(JSON.stringify(v, null, 2));
  const files: Record<string, Uint8Array> = {
    "cutting-pattern.svg": strToU8(
      patternSvg(marked, f, `${report.style} / Rev ${report.revision}`),
    ),
    "cutting-pattern.pdf": await patternPdf(
      marked,
      f,
      `${report.style} / Rev ${report.revision}`,
    ),
    "construction.json": enc(report),
    "assembly.txt": strToU8(
      [
        `${report.style} / Revision ${report.revision}`,
        `Design: ${report.design}; profile: ${f.profile}`,
        "Editable checklist. Check the design instructions and sample before production.",
        "",
        ...(f.seamPlan?.steps ?? []).flatMap((s, i) => [
          `${i + 1}. ${s.title}`,
          s.instruction,
          `Linked seams: ${s.seamIds.map((id) => f.seamPlan?.seams.find((s) => s.id === id)?.name ?? "Missing").join(", ") || "None"}`,
          "",
        ]),
        f.seamPlan?.notes ?? "",
      ].join("\n"),
    ),
    "README.txt": strToU8(
      "CORPORA STUDIO / SVG + PDF / SINGLE SIZE\nSVG has explicit millimeter dimensions: 1 user unit = 1 mm. Solid lines are cut boundaries, dashed lines are stitch boundaries. Matching crosses, grainlines and cut instructions are included. PDF is tiled at actual size; print at 100% and measure the 100 mm control square.\nconstruction.json preserves piece and edge IDs, geometry, arc lengths, pairings, ease targets and steps.\nThis profile is not apparel DXF/AAMA/ASTM and has no verified external CAD receiver. Only the paired seams were checked. Confirm assembly, scale and sample fit with your recipient.\n",
    ),
  };
  const hashes = await Promise.all(
    Object.entries(files).map(async ([file, bytes]) => ({
      file,
      bytes: bytes.length,
      sha256: [
        ...new Uint8Array(
          await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
        ),
      ]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join(""),
    })),
  );
  files["manifest.json"] = enc({
    application: "Corpora Studio 0.23",
    profile: report.profile,
    style: report.style,
    revision: report.revision,
    units: "mm",
    size: f.profile,
    files: hashes,
    findings: report.checks.flatMap((c) =>
      c.issues.map((message) => ({ seam: c.name, message })),
    ),
    externalCadVerified: false,
    physicalSampleVerified: false,
  });
  return zipSync(files, { level: 6 });
}
