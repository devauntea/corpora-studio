# Pattern images and approximate garment drafts — 0.19

Form Studio can convert supported reference images into ordinary editable construction pieces. Processing is local. This is a bounded geometry workflow, not an OCR, seam-recognition or garment-simulation system.

## Pattern image workflow

1. Open **Fashion → Image inventory → Import pattern image** and choose a PNG or JPEG scan, screenshot or photograph. Use a clear, continuous dark outline on a plain light background; reverse contrast is available.
2. Mark a rectangle of known physical width and height in the same flat plane as the pattern. Mark its corners clockwise from top-left. Enter the measured dimensions in millimetres and confirm them. The initial 210 × 297 mm values are examples, not an inferred paper size.
3. Detect closed outlines or trace a boundary manually. Choose among detected shapes, drag a point, or edit point coordinates by keyboard. Perspective correction is applied to the resulting geometry; the original remains unchanged.
4. Create a piece. The traced boundary is not automatically classified as a seam line or cutting line, so imported pieces start with zero seam allowance. Grain direction is provisional. Text, cut quantity, notches, grainlines and interior measurements require manual checking.
5. **Edit geometry & markings** opens the existing construction editor for points, curves, grain, notches, darts, piece name, cut instructions and allowances. **Use these pieces in draft** opens only the selected study's custom pieces. Existing template settings and other construction are retained.

The detector thresholds a processing copy at up to 1200 pixels per side and 1.44 megapixels, flood-fills enclosed regions, traces the raster-region perimeter and simplifies it to at most 128 source points. Pattern mode extracts enclosed light regions; garment mode extracts isolated solid silhouettes. Components connected to the image border and small components are excluded. An open outline normally merges into the background and cannot be extracted as a piece. Large enclosed lettering or unrelated objects can still appear as candidates; the user must select the appropriate shape and check line thickness against the original.

## Garment reference workflow

**Reconstruct garment** preserves up to six reference images per study. One selected flat-lay image supplies the calibrated silhouette; the other photographs support manual review. Switching the analyzed image resets its current calibration and outline but does not change previously generated pieces or their evidence.

Two construction families are supported:

- **Sleeveless box top:** editable front and back shell pieces using confirmed flat panel width, garment length, neck width/depths, armhole depth and allowance. The back and unshaped shell construction are explicit assumptions. Sleeves, closures, darts, facing and fabric behavior are not recovered.
- **Pull-on straight skirt:** front and back rectangular panels plus a casing piece cut twice and joined. Confirm panel width, length, hip circumference, casing width and allowance. The two panels must clear the entered hip circumference by at least 40 mm. Elastic length, stretch, fit and assembly require fitting decisions.

A silhouette can suggest width and length, rounded to the nearest millimetre, but suggestions outside the supported 120–1400 mm panel-width / 150–1800 mm garment-length range are rejected, not clamped. Rounding is a drafting convenience, not a claim of measurement precision. Before generation, the user must confirm the entered measurements and construction assumptions. Results are labeled **Approximate · review required**. Make a toile; the result is not a recovered production pattern.

## Preservation and limits

- Original PNG/JPEG bytes, dimensions and SHA-256 remain in project assets; no external service receives them.
- Each piece keeps the source asset ID, confirmed calibration and source outline. Approximate pieces also keep the exact confirmed reconstruction recipe used for generation, even when later study assumptions change.
- Source/author/URL, permission category and permission notes are user records, not independent license verification. Unverified references stay labeled as such.
- The inventory supports eight studies, six references per study, twelve pieces per study and forty pieces total. The project also permits at most forty manual construction pieces; opening imported pieces cannot silently discard existing construction to make room.
- Reference width and height must each be 10–2000 mm. A converted pattern outline must span 5–2200 mm in each direction. Reference corners must describe a convex rectangle in clockwise order and cover enough of the image for a stable transform.
- Original images retain the existing per-source limits of 15 MB, 8192 pixels per side and 32 megapixels. The project limits of twenty-four images, sixty-four megapixels and seventy MB of encoded image data still apply. Byte limits use decimal MB.
- Reference images decode sequentially. PNG/JPEG headers and the remaining pixel budget are checked before decode. Imports are transactional: a failing batch does not insert partial study data.
- Source measurements reject out-of-range entries with a visible, accessible error and retain the typed value until corrected or canceled. They do not silently clamp measurements.

Source calibration and reconstruction measurement inputs identify millimetres in their accessible names. Reference and outline points also have numeric X/Y percentage controls, so the conversion workflow does not require dragging. The study selector remains available in the narrow layout. These provisions and the automated checks below do not constitute a complete assistive-technology certification.

## Verification

`tests/pattern-source.test.ts` covers perspective-to-mm accuracy, closed and concave contours, multiple components, open-outline rejection, inverse contrast, bounds, real construction geometry, explicit approximation confirmations, recipe preservation, missing references, duplicate IDs, manual edits and project save/open.

`tests/e2e/pattern-source.spec.ts` runs the real import, calibration, detection, grain/notch/name correction, isolated draft and save/open flow in Chromium and WebKit. It also checks multiple garment originals, explicit approximate generation, measurement errors, narrow-screen inventory access and WCAG 2 A/AA findings through Axe. Fixtures are self-authored test drawings, not third-party reference photographs.

The targeted check on 6 November 2026 passed 14 unit tests and four browser cases (two workflows in each engine). The inventory's Axe scan reported zero violations for its WCAG 2 A/AA tags. Browser checks exercised 1440 × 940, 1024 × 768 and 540 × 820 windows, including invalid-measurement retention and narrow-screen study selection.

Screenshots and detector timing samples are recorded under `.tools/qa/pattern-source/`. In one three-sample run on this Mac, a self-authored 1200 × 1200 rectangle fixture took 34.9–60.2 ms per detector call in Chromium and 98–215 ms in WebKit. These are synthetic detector timings, not image-load latency, memory measurements or guarantees for every drawing.

Reviewed screenshots:

- `.tools/qa/pattern-source/pattern-source-pattern-ori-500a5-tions-and-survive-save-open-chromium/pattern-source-desktop.png`
- `.tools/qa/pattern-source/pattern-source-pattern-ori-500a5-tions-and-survive-save-open-chromium/pattern-source-compact.png`
- `.tools/qa/pattern-source/pattern-source-pattern-ori-500a5-tions-and-survive-save-open-chromium/pattern-source-narrow.png`
- `.tools/qa/pattern-source/pattern-source-garment-fla-60eab-confirmed-approximate-shell-chromium/garment-reconstruction-pieces.png`

Equivalent WebKit captures are in the adjacent `-webkit` directories. Production checks run the same user flows against the built application, excluding the development-only direct-module microbenchmark; final integration records their pass/fail status separately. Their captures use the corresponding `qa/studio-019/production-tests/` directories.

## Remaining limitations

Automatic OCR, notch/grain/label recognition, reliable hidden-seam recovery, arbitrary garment reconstruction, multi-view photogrammetry and fitted cloth simulation are not implemented. Worn garments, folded fabric, occlusion, complex backgrounds and open or overlapping line art require manual interpretation. A scale reference in a different plane cannot correct a three-dimensional garment surface. The raster detector measures an outline edge; line thickness and pixel sampling introduce error that should be checked with a printed test length.
