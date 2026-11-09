# Form Studio 0.21 — Premium UI refinement

## Delivered

- Shared Paper & Ink identity across Tattoo and Fashion: warm paper panels, charcoal stage controls, editorial headings, clearer selected states and increased control readability.
- Studio Home: larger typography, numbered task cards, restrained transitions and real source previews.
- Body Library:20 actual revision9 render previews covering five sections, two sexes and two builds; clearer selection and readable compact layouts. Neutral previews are labeled; right limbs use mirrored neutral thumbnails.
- Pattern Library: larger numbered cards using actual cutting geometry, stronger category hierarchy and selection; measurements and pieces navigation reveals the requested editing controls instead of leaving them below catalog content.
- Tattoo: quieter stage chrome; enlarged artwork preview; named ink presets with undo; accessible pressed state on skin/ink swatches; spacing corrections for direct-drawing controls.
- Fashion: readable measurement forms, grouped/wrapping toolbar, consistent paper drafting and technical-flat boards; source/reconstruction dialog surface treatment.
- Reduced-motion support, normal keyboard focus and existing saved-project formats preserved. No modeling/fit algorithms or schema migrations changed.

## Before and after

Eight screens at1440×940 and1080×720: tattoo, studio home, body picker, image studio, stencil, fashion, pattern picker and vector studio.

- [Before/after comparison gallery](../../qa/ui-021/comparison.html)
- [Before screenshots](../../qa/ui-021/before)
- [After screenshots](../../qa/ui-021/after)
- [Source and garment library review](../../qa/ui-021/fashion-review)
- Repeatable capture: `node scripts/capture-ui-021.mjs after` (isolated browser contexts; user's live studies are not touched).

## Verification record

- All683 unit tests passed (`qa/ui-021/unit-final.log`). One initial5s timeout under concurrent browser load passed in isolation and in the full rerun with two workers.
- Nine production WebKit scenarios passed (`qa/ui-021/production-final.log`): palette/undo, reduced motion, draw-toolbar spacing, studio navigation, camera reset, direct drawing and save/open, vector SVG handoff, fashion navigation and browser unsaved-change protection.
- Eight additional Chromium fashion/source/handoff scenarios passed (`qa/ui-021/fashion-regression.log`), including SVG/PDF export and source calibration/reconstruction round-trips. Tattoo editor checks also passed at1100,1280and1440px.
- Automated accessibility checks in the selected home, image, stencil and vector flows passed; this is not an exhaustive accessibility certification.
- Before/after review covers32screenshots, eight screens at two sizes. Final capture log: `qa/ui-021/capture-after.log`.
- Production build passed with existing chunk-size/dynamic-import warnings. `git diff --check` passed.
- macOS0.21.0 bundle built, copied to `releases/Form Studio 0.21.0.app`, locally ad-hoc signed and verified with `codesign --verify --deep --strict`. It is not notarized. The existing running app and earlier releases were preserved.

Initial failures were investigated: an opacity entrance animation reduced contrast while fading (removed); camera pixel differences were a hovered button over the canvas (test now compares identical pointer states plus exact camera state); one production run overlapped a rebuild of its served files (rerun against stable output passed all nine).

Browser tests do not establish native macOS dialog behavior. Earlier manual native tests are not substituted for this release.

## Independent review

Review findings: the direction is coherent and primary modal actions remain reachable at 1080×720. The Draw-mode status/palette overlap was corrected and is covered by a geometry assertion. Stray home icons and title/status spacing were also corrected.

## Remaining issues / assessment

- This is a significant presentation pass, not a complete component-system replacement. Legacy styles remain in specialist tools.
- Compact technical-flat editing remains dense; artboard height improved only modestly. Focus mode is useful for longer drawing sessions.
- At720px high, body details and home content require ordinary scrolling. We do not claim every option is simultaneously visible.
- Draft previews retain engine construction marks and some irregular fills. Imported raster illustrations were not re-authored or upscaled.
- Light/dark treatments mean paper panels and charcoal stages, not a full dark-mode preference.
- No new website, notarized distribution, native dialog qualification, anatomical accuracy or improved tattoo-fit realism is claimed.

See [design identity](design-identity.md) for reusable tokens, reference observations and website continuity.
