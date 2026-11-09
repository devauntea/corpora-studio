import type { Fashion, PatternDraft } from "./fashion-model";
import type { StencilSettings } from "./stencil-export";
import { constructionChecks } from "./seam-checks";
export function patternPreflight(draft: PatternDraft, fashion: Fashion) {
  const issues = [...draft.warnings];
  if (!fashion.seamPlan?.seams.length)
    issues.push(
      "No seam relationships recorded. Open Seams & construction to pair and check joining edges.",
    );
  issues.push(
    ...constructionChecks(draft, fashion).flatMap((c) =>
      c.issues.map((i) => `${c.name}: ${i}`),
    ),
  );
  for (const piece of draft.pieces) {
    if (!piece.cut.trim())
      issues.push(`${piece.name}: add a cut quantity and fold instruction.`);
    const [a, b] = piece.grain;
    if (Math.hypot(a.x - b.x, a.y - b.y) < 1)
      issues.push(`${piece.name}: verify the grainline direction.`);
    if (!piece.notches.length)
      issues.push(
        `${piece.name}: no matching notches; check whether they are needed.`,
      );
  }
  if (fashion.seamAllowance === 0)
    issues.push(
      "Base seam allowance is zero. Verify all intended cut and stitch lines.",
    );
  if (fashion.construction && Object.keys(fashion.construction).length)
    issues.push(
      "Manual piece edits are included. Check shared seam lengths and per-edge allowances before cutting.",
    );
  return [...new Set(issues)];
}
export function stencilPreflight(settings: StencilSettings, contours: number) {
  const issues: string[] = [];
  if (!contours) issues.push("No stencil contours are selected.");
  if (settings.printer.name === "Uncalibrated printer")
    issues.push(
      "No measured printer profile is selected. Print and measure the calibration sheet first.",
    );
  if (settings.mirror)
    issues.push(
      "Mirroring is on. Confirm this is appropriate for your transfer workflow.",
    );
  if (!settings.printer.paper?.trim() || !settings.printer.settings?.trim())
    issues.push(
      "Record paper stock and driver/settings with the printer calibration so it can be reproduced.",
    );
  if (settings.lineWeight < 0.2)
    issues.push(
      "Lines are thinner than 0.2 mm. Verify they survive your printer and transfer process.",
    );
  return issues;
}
