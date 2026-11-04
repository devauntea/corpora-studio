# Fashion workspace — 0.7

This first fashion milestone adds a measured knit T-shirt to the existing desktop project. The Tattoo / Fashion switch changes workspaces without discarding either document. Fashion is local and works offline in the packaged app.

## Working with a pattern

1. Choose **Fashion**. Replace the sample profile with your measurements in millimeters; shoulder slope uses degrees. Field tooltips explain the measurements. Enter or blur commits; Escape cancels an uncommitted number.
2. Adjust ease, body/sleeve proportions, waist shaping and neckline. Classic, Relaxed and Longline are parameter presets for the same garment, not three independent drafting systems.
3. Use **Edit pattern shape** to drag the front neckline, body hem or sleeve hem. These are constrained parametric tools: body length updates front and back, and neck changes regenerate the neckband. A drag is one project undo step.
4. Use **Pieces** to inspect cut quantities, arrange the board and keep fabric/fitting notes. Arrange pieces restores the default positions. Pan, zoom, grid and fit affect only the view.
5. Choose **Print & export**. PDF tiles each piece independently; SVG preserves the board arrangement. SVG placement can overlap if you arrange pieces on top of each other. Native exports use the system save dialog and atomic writes.

The front and back are half patterns, cut on fold. Sleeves are cut as a mirrored pair. Seam allowance is configurable from 0–25 mm; the generator uses three times that allowance at the body and sleeve hems, and no allowance at fold edges. The added neckband is a rectangle based on the full neckline seam length and an adjustable reduction ratio. Its finished width is half its seamline height. The ratio requires testing with the intended ribbing; it is not a fabric model.

## Geometry and persistence

- FreeSewing **Teagan 4.10.2**, Brian and the sleeve library provide the measured drafting construction. The adapter extracts numeric path operations directly from the drafting model, not by reverse engineering an SVG. The app renders and exports the same piece geometry. Front/back neckline curves are integrated at 256 samples each to derive the added neckband.
- Inputs are finite, bounded, strict-schema values. Impossible vertical/shoulder relationships are rejected before drafting. Draft errors and nonfinite control points stop rendering/export instead of silently exporting an earlier pattern. Measurement, option and allowance changes regenerate; layout, paper and notes do not invoke the solver.
- Format **v7** adds optional fashion data with an explicit engine revision. Format v6 is frozen for validation before migration. Older tattoo surfaces and placements are retained exactly. Loading v1–v6 clears the save destination so the first save creates a new copy.
- Fixed the native envelope validator, which accepted only v1–v5 even though 0.6 wrote v6. It now accepts v1–v7, with Rust coverage for every supported version.
- Core and garment packages are pinned. The shared upstream MIT license at tag `v4.10.2` is retained in `vendor/freesewing/` because the npm archives omit it. Two obsolete standalone lodash dependencies are replaced by tiny local compatibility packages delegating to maintained **lodash 4.18.1**. This avoids their known prototype-pollution implementations. Prototype path regressions are covered; npm audit reports zero findings for the resolved graph.
- The fashion workspace and PDF library load on demand. Tattoo rendering pauses while Fashion is visible. Both sections share project-level Save/Open, dirty-state protection and undo/redo.

## Export scale

SVG uses physical `mm` dimensions and a matching numeric viewBox: one user unit equals one millimeter. It includes a 50 × 50 mm calibration square. Numeric paths retain three decimal places; text is XML-escaped.

PDF uses vector cubic paths in millimeters, with A4 or US Letter page dimensions, a 100 × 100 mm calibration square, per-piece row/column labels and 5 mm overlapping strips. Tiles include 10 mm side margins and 16 mm top/bottom margins. Each piece has 6 mm padding within its tile grid. A clipping path prevents curves from printing through headers/footers. **Print at actual size / 100%, disable fit-to-page, and measure the square.** Printer scaling is outside the app’s control.

## Verification

- 32 TypeScript/domain tests: prior tattoo coverage, deterministic drafting, measurement propagation, neckband dimensions, seam and fold allowances, strict validation, v6/v7 round trips, SVG units/escaping, tile coverage, PDF calibration/path clipping and dependency shim regression tests.
- Browser checks in Chromium and WebKit exercise measurements, shape dragging, grouped undo, layout, notes, both paper sizes, both export formats, shared save/reopen, section switching and invalid-profile recovery. No external network requests occur in these flows.
- PDF covers and cutting tiles are rendered with Poppler and visually reviewed. The encoded 100 mm square is checked within 0.001 mm in both PDF paper formats. This validates digital output scale, not printer accuracy or physical garment fit.
- Rust covers atomic file replacement, the current/legacy project envelopes and export signature/format validation. Native save/open/export dialog interaction remains unverified in this session because the Mac is locked.

## Boundaries and next work

One knit template, one measurement profile per project, parametric shape controls and local print exports are available. General point/Bezier editing, darts, split/merge pieces, multi-size grading, woven blocks, image placement on garments, photo-to-pattern reconstruction and 3D cloth simulation remain future milestones. This is a first fitting draft, not a production-validated pattern; sew a toile before cutting final fabric.

Primary references: [Teagan design](https://freesewing.eu/docs/designs/teagan/), [drafting API](https://freesewing.dev/reference/api/), [settings and millimeter seam allowances](https://freesewing.dev/reference/settings/), and installed MIT license files collected in `THIRD_PARTY_NOTICES.txt`.
