# Reliable editing and production handoff — 0.13

Implementation and verification record, 5 November 2026. SVG/PDF are the default recipient formats because the manufacturer's application is not yet known.

## Delivered

- Garment library imports now group each view's Fabric/Highlights/Linework paths. Select and drag the garment as one object; Shift-click adds/removes selections. Select front/back, group/ungroup, rename groups, move, resize, mirror, rotate 90 degrees, duplicate, copy to the other view, reorder, hide and lock work across a selection. Individual-path mode retains color and Bezier editing. A locked member prevents a group transform from pulling the drawing apart. Pointer gestures are one undo transaction; Escape/pointer cancellation restores the starting geometry.
- SVG import has a conversion preview before placement, reports source width/height/viewBox and scale treatment, and keeps the untouched original with SHA-256 in the editable project. Sources can be saved separately or removed without deleting placed paths; removal is undoable. Original markup is never inserted into the page. Canceling the preview leaves the project untouched.
- Technical-flat export opens a review with links to the relevant editor section. Checks cover absent views, style/revision, missing size values and measuring methods, zero measurements, incomplete/duplicate material codes, unresolved path-material assignments, artboard overflow, callout instructions and PDF font limitations. An empty drawing blocks handoff; other findings can be exported as an explicitly reported draft.
- Manufacturer ZIPs include `handoff-report.txt` and `handoff-manifest.json` alongside editable JSON, front/back/combined SVG, PDF, measurement/material/construction CSV. PDF includes the same review and recipient checklist. Reports distinguish specification units from drawing coordinates and do not assert print or recipient approval. PDF strokes now preserve line caps, joins, miter limits and fill rules; page numbering includes the handoff review.
- Pattern exports have an inline cutting-pattern review: design/profile, pieces, millimeters, paper/tiles, cut instructions, grainline/notch checks, manual allowances and engine warnings. Stencil export checks expose physical width, DPI, mirror state, thin-line concerns and missing printer calibration. Existing calibration squares and 100% print instructions remain authoritative.
- Project format 13 migrates formats 1–12. Vector pack format 3 migrates formats 1–2. Frozen v12/v2 validators reject newer fields mislabeled as older files. Older paths, images, body surfaces and measurements are preserved. Opening a pre-v13 native project clears its save path so the first save creates a new copy.

## SVG import contract

This is an intentionally bounded drawing import, not full Illustrator/SVG document compatibility:

- Solid black/white or hex fills/strokes; paths, rectangles, circles, ellipses, lines, polylines/polygons and groups; supported affine transforms; explicit fill rules and line caps/joins.
- Cubic handles are retained and quadratics become equivalent cubics. Elliptical arcs are converted to 96 straight segments per arc, disclosed before placement. Drawing bounds are fitted to a 420 × 510 area within the artboard. Source page whitespace/viewBox does not define cutting scale.
- No text, embedded raster images, external references, CSS classes/stylesheets, gradients, opacity, clipping, masks, filters, symbols/use, scripts or nested SVG viewports. Unsupported input is rejected as a whole with an actionable explanation. Outline text/effects and simplify before importing.
- Non-uniform transformed strokes require outlining. Stroke widths must be numeric user units and at most 12 units after fitting. Mixed open/closed contours in one painted path require separation.
- Limits: 500 KB/source, 1,000 elements, 24 nested groups, 24,000 numeric path/transform tokens, 200 painted paths, 12,000 converted anchors and 2,000 anchors per contour. Eight originals can be retained per pack. Existing pack limits remain 200 paths and 60,000 total anchors.
- The converter runs synchronously after bounded XML inspection; it is not a worker-based universal document converter. Editable JSON is the lossless Form Studio interchange. Exported presentation SVG includes text and clipping, so it is not promised to reimport through this restricted artwork importer.

Existing v2 imported layers are not silently regrouped based on their names. For an older composition, use Select front/back and Group selection, or Shift-select the intended members. New library/SVG imports are grouped automatically. There are no nested groups or linked component instances in this release.

## Verification

- 169 unit tests passed, including real legacy migration, compound contours/handles, group transforms, lock protection, duplicate membership remapping, one-transaction undo, export preflight, and all 217 garment asset views.
- All 56 Chromium/WebKit regression scenarios passed. These include tattoo/image editing, bodies/poses, fashion construction, stencils, recovery, saved projects and the new vector handoff workflow. Earlier version assertions and library tests were updated to follow format 13 and garment-first selection.
- Seven compiled WebKit scenarios passed with the same Content Security Policy as the desktop app: garment discovery/editing, source/SVG import, grouping, export, project reopen, recovery, custom paths and catalog selection. Reproduce with `npm run test:production`. After adding original-source download/removal controls and stricter malformed-path checks, all four affected Chromium/WebKit scenarios and the final compiled WebKit handoff scenario passed again.
- Native Rust: seven release tests passed, including format 13/v3 envelopes and byte-preserving writes, including original SVGs with/without XML declarations, leading comments and BOM. One existing HEIC test remains intentionally ignored because it needs unbundled local fixtures.
- Packaged macOS 0.13 native checks passed after unlocking the Mac: cancel/save a new project, save edits to the existing file, reopen through the native file picker, import a headerless SVG through its native picker and conversion preview, save its original source, cancel/save a reviewed manufacturer ZIP, save standalone SVG/PDF, and save a portfolio ZIP. Reopening preserved two editable paths, their group, and the retained source with its 100 mm × 150 mm dimensions. The project reported successful original-image integrity checks. This used an isolated `Native QA 0.13` project and left the running 0.12 session intact.
- Files from those native dialogs were independently checked in `qa/handoff-013/native/`: project format 13/vector format 3, exact original-source byte equality and SHA-256, valid SVG XML, ZIP integrity and all 11 manufacturer-pack entries, a five-page A4 PDF with its draft handoff findings, and a portfolio gallery containing five PNG studies. The PDF's first page was rendered with Poppler and visually checked. `verification.json` records file hashes and assertions; no application rebuild was needed for this verification pass.
- Automated accessibility checks passed for the SVG preview and export review, in addition to the existing library and vector-workspace checks. This does not establish VoiceOver/stylus hardware acceptance.
- Independently rendered the exported five-page PDF with Poppler and inspected the pages. Confirmed explicit A4 size, vector linework, preserved holes, no embedded raster images/JavaScript, and consistent final page numbering. SVG output is exercised in browser engines; no Illustrator/Inkscape recipient acceptance is claimed.
- Captured 50 body views with zero page errors into `qa/handoff-013/body-baseline/`, including a JSON record of body settings and viewport. These establish a repeatable baseline for 0.14; body geometry has not been changed or qualified as a near-1:1 match by this milestone.

Evidence lives in ignored `qa/handoff-013/`; tests and capture scripts are versioned. Large bundle and existing ineffective dynamic-import warnings remain nonfatal.

## Release qualification

`releases/Form Studio 0.13.0.app` is the local Mac release. It uses local ad-hoc signing, not Developer ID notarization. Earlier release bundles and running sessions are preserved.

Native save/open and the SVG/PDF/manufacturer-ZIP/portfolio-ZIP export dialogs have now been exercised successfully in this packaged Mac release. This closes the previously blocked native-dialog check; it does not qualify every native workflow or another operating system.

Physical printer/stencil calibration, recipient application/version acceptance, sewn sample review, body/anatomy review, Windows/WebView2 and native assistive/stylus hardware checks remain open. No physical observations or acceptance results have been invented. The research milestone's software work is delivered; these external qualification gates remain pending.

The final bundle passed `codesign --verify --deep --strict`. Bundle version: 0.13.0. Executable SHA-256: `20f6ceea10088625a22db375062b84b3a78735fe5411e1a25cf7ffa2bb9aab7b`.
