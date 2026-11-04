# Next-features verification — 0.9.0

Verification on 4 November 2026, Apple Silicon macOS. This is a software verification record; physical garment, stencil, body-fitting and anatomy acceptance are separate.

## Automated evidence

- TypeScript and Vite production build passed. The packaged worker is emitted as a local asset; no hosted compute service is required.
- 67 unit tests passed: existing image/project/pattern regression checks, five design adapters, formulas and calibration, tracing/physical exports, known-shape fitting, seam direction/closure, tape-path closure, and surface-map/distortion cases.
- Surface tests include a curved periodic cylinder crossing its conventional atlas seam, planar millimeter recovery, anisotropic triangle stretch and disconnected-surface rejection.
- Cloth tests preserve fixed pins, check finite results, match seam endpoints by height and verify the stitches close. A captured default-body run had 968 vertices, 10.59% p95 edge strain and a 0.00014 mm maximum stitch gap. Its maximum local edge strain was 289.6%: inspect localized stress and do not interpret this visual preview as validated fabric behavior.
- The full browser suite ran 40 scenarios across Chromium and WebKit: 39 passed initially; a WebKit-specific return-focus failure was fixed. The previously failing measurement/formula/checkpoint/portfolio scenario then passed on WebKit. The three affected Chromium workflows were rerun after the fix and passed.
- Four additional WebKit checks passed against the built production files with the application Content Security Policy: body fitting, cloth, integrated portfolio export and stencil/drawing. This verifies bundled worker execution over the browser harness, not native system dialogs.
- Accessibility scans for garment catalog, artwork/stencil, body fitting, cloth, photo measurement and portfolio used axe WCAG 2 A/AA rules. Keyboard numeric inputs supplement spatial controls. This does not constitute native VoiceOver qualification.
- Five Rust tests passed in release mode, covering atomic file replacement, failed replacement preservation, malformed HEIC rejection, pattern format checks and project envelopes. One test requiring personal reference files remains deliberately ignored.
- `npm audit --omit=dev` found zero vulnerabilities in the resolved runtime graph.
- All 52 anatomy/source SHA-256 records matched. All 44 prior records remained unchanged; eight new final revision-4 files were added. Intermediate bases were moved out of shipped assets.
- License inventory regenerated: 399 package records and 542 notice files. Packages without a top-level notice are explicitly listed; public-release license review remains required.

## Portfolio evidence

The integrated browser workflow calibrates a synthetic flat-lay image, applies a 960 mm chest input, adds a measurement formula, compares a checkpoint, and exports a ZIP with five finished images. No separate raw fixture photograph or editable project appears in the ZIP. The default body-photo option is off.

The standalone export was checked at 1440 px and 390 px widths: no horizontal overflow, working category filters, keyboard lightbox closing/focus return, and zero axe A/AA violations. Screenshots and the generated ZIP are in `qa/next-features/` (local verification artifacts, ignored by Git).

A private showcase of selected studies was published from source commit `fc4cd2979228d55d4fd3196f64663c99b4e9fa0e`. The separate checkout is `/Users/bigbobby/Projects/form-studio-showcase`. It contains only generated demonstration art and a synthetic pattern study; no personal reference photographs were uploaded.

## Native and external limits

The final Mac application was rebuilt after the focus fix, copied to `releases/Form Studio 0.9.0.app`, and passed ad-hoc `codesign --verify --deep --strict`. It was launched. Executable SHA-256: `2e71c041a185cc48b51be9d4f8c0761024861075a9a91a8c63240b004bea929b`. Both attempts to inspect the native app were blocked by the locked Mac; native save/open/portfolio system dialogs remain unverified. The user was asked to unlock it. A browser test is not evidence of native dialog interaction.

Developer ID and notarization environment checks both returned false. No Apple notarization was attempted. Windows qualification and signed-release workflows were created but were not run on a Windows host. No sewn toile, physical cylinder sample, tape-measured garment/body cohort, artist stencil-paper test or qualified anatomy review was performed. Synthetic test inputs are not physical validation observations.
