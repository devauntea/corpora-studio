# Form Studio 0.15 preview — construction and sample development

This release implements the software portion of the construction-aware fashion milestone. It adds seam relationships, editable assembly plans, linked style records, frozen specification revisions and sample measurements. The delivery profile is SVG/PDF, as requested. Real sewn samples, patternmaker acceptance and a named external CAD round trip remain unverified; the roadmap's complete production-qualification gate is not claimed.

## Use the new workspaces

**Fashion → Patterns → Seams & construction** opens paired stitch boundaries. Choose the two pieces and consecutive edges, reverse the sewing direction where needed, then compare arc lengths. Record plain/eased/gathered/stretched intent, the intended signed difference (B minus A), and the allowed length deviation. A walking cursor shows proportional positions along both sides. Matching marks have separate distances from each side's sewing start, names and single/double marks. Changes use project undo/redo.

**Load design checklist** supplies selected joins and four editable assembly steps for Teagan (knit T-shirt), Simon (woven shirt) and Titan (trouser block). It is available on the original drafted geometry. These are starting checklists, not complete or professionally approved sewing instructions. Sleeve caps, collars, closures and many other joins still require explicit pairing and review. Existing fold/dart guides remain visible; new automatic dart-intake analysis is not implemented.

The assembly page records step order, instructions and related seams. Deleting a seam removes its step links. Changing the garment design preserves the old plan and exposes a mismatch with an undoable **Start plan for current design** action. Missing measurements must be supplied before the new design can draft; the existing sample-measurement button is only an explicitly labeled starting point.

**Fashion → Vector packs → Samples & revisions** adds three pages:

- **Samples & revisions:** record the current style code, revision, finished-garment measurements, units, tolerances, materials and callouts. Records include a SHA-256 of the drawing and groups; use a project checkpoint to retain a restorable drawing. Pack revision identifiers cannot be reused. A change list compares the current specification and drawing with a selected record.
- **Sample records:** select a recorded revision and size, enter actual finished-garment measurements and findings, and see requested/actual/difference/tolerance. Later measurement or unit changes leave the requested sample record unchanged. A starter tolerance must be explicitly confirmed before a measured result can read “Within tolerance.” Sample records are user-entered evidence, not automatic fit approval.
- **Linked callouts and colorways:** connect callouts to stable component, material and point-of-measure IDs. Renaming a material updates the displayed reference; deleting linked data blocks handoff until the link is fixed or cleared. Named colorways carry color and supplier references per material; they do not automatically recolor the drawing.

## Files and output contracts

Construction ZIPs contain `cutting-pattern.svg`, a tiled `cutting-pattern.pdf`, `construction.json`, `assembly.txt`, README and a SHA-256 manifest. SVG dimensions are explicitly millimeters (one user unit = one mm). The JSON preserves piece/edge IDs, cut and stitch geometry, grainlines, cut quantities, matching marks, edge lengths, ease targets, checks and assembly links. The selected profile is a single independently drafted measurement size, not grading. JSON allowance arrays are populated for manually constructed pieces; engine pieces preserve their actual cut boundary and retain allowance rules in the design, rather than inventing per-edge numeric allowances.

Construction PDF has a 100 × 100 mm calibration square; pattern SVG has a 50 × 50 mm square. Print PDFs at actual size and measure the square. Derived matching crosses are on the stitch boundary, not V-shaped cuts in seam allowances. Changes to seam lengths do not silently reposition an existing absolute-distance mark; out-of-range and mismatched marks are reported for correction.

The vector handoff ZIP now has 14 entries, adding `samples.csv`, `revisions.csv` and `colorways.csv`. The PDF includes linked construction references, colorways, revision history and sample results with their requested revision and units. Editable JSON contains the complete frozen specifications. These SVG/PDF technical flats remain illustrations; use the specification table for manufacturing dimensions and the separate pattern export for cutting.

The app reports unconfirmed tolerances, missing linked records, incomplete/out-of-tolerance samples, and changes made while reusing the latest pack revision. Reports explicitly leave physical printing, sample acceptance and external CAD acceptance unverified. SVG/PDF delivery is not apparel DXF/AAMA/ASTM compatibility.

Project format **15** reads formats 1–14. Vector pack format **4** reads formats 1–3. Frozen old validators reject new fields mislabeled as old documents. Opening a pre-v15 native project clears its write path so the next save creates a new copy. Older releases cannot open v15/v4; previous release bundles and documents are preserved.

Limits: 80 seam pairs, 64 edges per side, 24 matching marks per pair, 80 assembly steps, 20 specification revisions, 40 sample records and 20 colorways. All processing remains local. Edge lengths use cached adaptive curve subdivision; manually splitting/removing edges invalidates affected links instead of rebinding by index. Named engine point identities survive measurement redrafting; anonymous segments are scoped to path topology.

## Verification

- 193 unit tests passed across 18 files: legacy migration; seam identities across three design families; curve lengths against a dense numerical reference; split/remove invalidation; matching marks; frozen sample values/units; missing links; revision reuse; construction ZIP geometry and independent SHA-256 verification.
- 28 Chromium/WebKit end-to-end scenarios passed for the new seam/sample workflows and existing fashion drafting, manual construction, vector editing, SVG import, garment assets, save/reopen, undo and export. Accessibility checks passed for the seam editor and sample workspace. The linked-material test confirms the rename follows its ID and deletion blocks export.
- Independently rendered all eight pages of a sample tech pack and all 22 pages of a Teagan construction PDF with Poppler. Inspected page layout, actual A4 dimensions, calibration square, seam/cut linework, matching crosses, sample revision/units and findings. A PDF renderer check does not verify a physical printer.
- 15 compiled WebKit scenarios passed under the desktop Content Security Policy, including the new fashion work and existing body/pose, stencil, recovery and saved-project workflows. After the final modal keyboard fix, all ten affected Chromium/WebKit scenarios and all four affected compiled WebKit scenarios passed again.
- Seven native Rust release tests passed, including project format 15 and vector JSON format 4 envelopes and byte-preserving exports. One existing HEIC fixture test remains intentionally ignored because its local reference files are not bundled.
- `releases/Form Studio 0.15.0.app` built successfully and passed local ad-hoc `codesign --verify --deep --strict`. Executable SHA-256: `36b00c4a123c35ee9a4b71f294c30243789f892cb4776679c46e5317a7015225`. This is not Developer ID signing or notarization. Existing bundle-size and ineffective-dynamic-import warnings remain nonfatal.
- The packaged 0.15 window launched and displayed its native project-open dialog. UI control then stalled: the selected fixture could not be opened, coordinate input reported no windows available, and cancel/reacquiring control timed out. Native save/open/export completion is therefore **unverified** for 0.15. Prior-version native checks and browser downloads are not substituted for it. Synthetic fixtures are isolated in `qa/fashion-015/native/`; no user project was overwritten.

Evidence is in ignored `qa/fashion-015/`; test source is in `tests/fashion-construction.test.ts` and `tests/e2e/fashion-construction.spec.ts`. Original checklist wording was informed by the design scope in the FreeSewing [Teagan](https://freesewing.eu/docs/designs/teagan/), [Simon](https://freesewing.eu/docs/designs/simon/) and [Titan](https://freesewing.eu/docs/designs/titan/) documentation. Consult each design's complete assembly instructions.

## Remaining qualification

Three-family patternmaker/assembly review and real toiles have not been performed. No sample measurements are fabricated as validation data. The manufacturer has not specified an editor, so SVG/PDF is the chosen handoff and no named external CAD round trip is claimed. Industrial DXF, grade-rule interchange, complete assembly coverage, automatic dart-intake analysis and shared cloth/seam-graph simulation remain later work. Near-reference body fidelity is also still in progress from 0.14 and is not changed by this fashion milestone.
