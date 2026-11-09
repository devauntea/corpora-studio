# Fashion expansion — 0.11 verification

Verified locally on Apple Silicon macOS, 5 November 2026.

## Delivered

- The pattern catalog grew from 5 to **65 FreeSewing designs**. All 60 additions use pinned 4.10.2 drafting engines, not preview images. Search, garment categories, all required measurement fields, design options, numeric geometry validation and source assembly-guide references are included. Otis accepts infant waist measurements down to 250 mm.
- **Vector packs** is a dedicated Fashion workspace with 12 original front/back garment starters, eight reusable detail components, blank-canvas drawing, editable cubic anchors/handles, size and position controls, mirroring, duplication, layer ordering, visibility/locking and numbered construction callouts.
- Editable size specifications, cm/in conversion, tolerances, fabric/trim/label/packaging records, style/revision information and manufacturer instructions save in the project. Repeated unit conversion retains precision; human-readable size exports use up to three decimals.
- Handoff exports include editable front/back/combined SVG, vector PDF, three CSV tables, editable JSON and a nine-file ZIP. Per-view clipping prevents drawing outside an artboard from covering the neighboring view. Hidden/locked paths remain in editable JSON.
- Format 11 freezes and validates format 10 before migration. Formats 1–10 remain readable. A legacy project's first save creates a new copy. Existing tattoo surfaces retain their saved revisions.

Catalog provenance: [FreeSewing's official catalog](https://freesewing.eu/designs/), installed package metadata and package source. The imported packages declare MIT; notices are bundled in `THIRD_PARTY_NOTICES.txt`. Four evaluated engines with unsupported/empty boundaries were excluded, as recorded in the [fashion guide](fashion-workspace.md).

## Checks passed

- **162 unit tests in 13 files**, including finite geometry and supported measurements for all 65 designs, infant sizing, all 12 vector starters, curve-preserving subdivision, repeated unit conversion, path transforms, invalid import rejection, old/new project round trips, CSV quoting, ZIP contents and vector PDF pagination.
- **48 end-to-end tests** across Chromium and WebKit. The new workflow checks custom drawings, templates/details, curve edits, undo/redo, keyboard movement, mirroring, view copying, locking, callouts, size conversion, materials, pack export/import, complete project save/reopen, catalog filtering/drafting and automated WCAG A/AA checks for the editor. Existing tattoo, anatomy, artwork, pattern, photo, recovery and export checks also passed.
- After final rounding, artboard and infant-size corrections, the unit suite passed again and **3 production WebKit tests** passed against the compiled assets with the desktop Content Security Policy. The production run includes the complete handoff round trip, expanded catalog and blank-path workflows.
- **6 Rust release tests passed**, with 1 existing local-HEIC-fixture test intentionally ignored. Coverage includes supported project envelopes, export signature validation and atomic file replacement. Browser downloads do not establish native system-dialog interaction; the new native save dialog was not manually exercised in this pass.
- TypeScript, Vite production compilation and the Tauri macOS application build passed. Vite reports large-chunk and existing ineffective-dynamic-import warnings; these are nonfatal. `npm audit --omit=dev` reported no vulnerabilities for the installed dependency graph.
- Visually inspected the editor in both browser engines, a contact sheet of all 12 front/back templates, and the exported PDF's drawings, instructions, size specifications and material page. Final exported measurement tables show 60 cm and 0.5 cm tolerance after cm → in → cm, without conversion noise.

Local QA artifacts are in ignored `qa/fashion-expansion/`, including screenshots, the template contact sheet, exported SVG/PDF/CSV files and the production-test manufacturer ZIP. Reproducible checks are in `tests/catalog-expanded.test.ts`, `tests/vector-pack.test.ts` and `tests/e2e/vector-pack.spec.ts`.

## Packaged application

`releases/Form Studio 0.11.0.app` reports version **0.11.0** and contains the updated offline editor and dependency notices. The bundle was ad-hoc signed locally, and `codesign --verify --deep --strict` passed. This is not a notarized public-distribution build.

Executable SHA-256:

```text
e9a076c0221a532a8a535c743bb34c3b9435062e6eb400b02f0a17dc652dcec7
```

The earlier 0.10 bundle and the running older app session were preserved.

## Practical scope

The vector editor produces technical drawings and the specifications entered by the designer. It does not turn arbitrary flats into graded industrial cutting patterns, parse Illustrator/SVG files into its editor, or establish physical garment fit. Sewing patterns are exported separately from Pattern studio. Only software behavior and sampled numeric drafts were checked; the full range of upstream options and sewn samples has not been physically qualified. Nothing was sent to a manufacturer.
