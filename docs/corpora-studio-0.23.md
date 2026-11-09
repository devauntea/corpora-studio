# Corpora Studio 0.23 — identity and fabric studies

## Identity

**Every body is a first draft.**

The user’s full 24-line poem is preserved verbatim in Studio Home under **The Corpora manifesto**. Its ideas of imperfect bodies, paper learning to bend, and plural forms guide the design.

The logo is original vector artwork inspired by the irregular concentric contours in the supplied microscopy reference. An open contour C sits beside a smaller enclosed form: two different bodies with one visual rhythm. The photograph is not embedded in the app or brand assets.

- [Mark](../public/brand/corpora-mark.svg), [wordmark](../public/brand/corpora-wordmark.svg), [app icon](../public/brand/corpora-icon.svg), [hero contours](../public/brand/corpora-contours.svg).
- Reusable React mark: `src/CorporaMark.tsx`.
- [Brand contact sheet](../qa/corpora-brand/contact.png).
- Application, window title, favicon, native icons and human-readable export labels use Corpora Studio.
- Existing `.formstudio` files, storage/database keys and the desktop bundle identifier are retained for continuity.

The interface uses warm paper, plum ink and rose accents. Light and Dark are both supported, with System preference retained. Color does not alter document artwork, skin or print-paper previews. The shared identity is in `src/corpora-identity.css`; the home composition and manifesto are in `StudioHome.tsx` / `studio-home.css`.

| Role | Light | Dark |
| --- | --- | --- |
| Paper | #f5efed | #1e1822 |
| Panel | #fcf8f5 | #2b2330 |
| Ink | #2e2332 | #f3eaf1 |
| Secondary text | #6d5f6e | #c4b5c5 |
| Border | #d8cbd4 | #635269 |
| Accent | #a12f69 | #f1a9d0 |

## Fabric & color

Open **Fashion → Fabric & color**, choose a print and palette, adjust the repeat, choose the target, then **Apply fabric & color**. The preview is local until applied; Apply is one undo step.

- 16 original prints: plain, stripes, pinstripe, checked, gingham, plaid, argyle, polka dot, floral, paisley, camouflage, leopard, zebra, tiger, herringbone and tie-dye.
- Ten coordinated palettes and four custom color pickers. Repeat size and rotation are editable, with quick rotation presets.
- Live front/back garment preview. Apply to selected parts, front fabric panels, back panels or both views. Automatic targeting preserves imported linework, highlights and trims. Hidden and locked layers are skipped. Artists can intentionally select an eligible filled detail for a different fabric.
- Preview controls stay reachable at 1080 × 720. Prints, Colors and Repeat shortcuts reveal the relevant settings without scrolling through the whole palette.
- Switching to Plain or editing a layer’s ordinary fill removes its print. Project save/open, duplicate, transform, undo/redo and revision signatures preserve print assignments.

These prints are generated from original bounded vector geometry, with no external downloads, paid service, API credits or bitmap copies from the supplied chart.

## Handoff

SVG uses editable tiling patterns. PDF uses native vector tiling patterns, including rotated repeats and even-odd contour holes; it does not silently replace a print with a solid fill. Manufacturer ZIPs add `textiles.csv` and per-layer `textiles/*.svg` swatches when prints are assigned. PDF includes print/color specifications. Editable project JSON retains the settings.

Repeat sizes are **illustration units**, not millimeters or production print dimensions. The pattern-drafting workspace still exports clean cutting geometry. This is a technical-flat fabric/color study, not a 3D cloth-texturing or calibrated fabric simulation. The existing external SVG importer does not recreate arbitrary pattern definitions; reopen the editable project/pack JSON to continue editing these print assignments.

## Verification

- 697 unit tests passed, including deterministic/safe print generation, native PDF pattern resources and holes, SVG/ZIP contents, project round-trips and protected target layers. `qa/textiles-023/unit-final.log`.
- The complete fabric save/reopen/manufacturer export flow passed in Chromium. `qa/textiles-023/handoff-e2e.log`.
- Four fabric UI scenarios passed across Chromium/WebKit; twelve settings states were audited in light/dark at 1080/1440. `qa/textiles-023/` and `qa/corpora-024/textile-ui-tests.log`.
- Home and expanded manifesto passed keyboard, focus-return, exact-poem and targeted accessibility checks in all four theme/size contexts. `qa/corpora-024/home-audit.json`.
- Rendered PDF review: `qa/textiles/printed-hole.png`. Swatches: `qa/fashion-textiles/contact.png`.

- All 16 production WebKit workflow tests passed, covering identity, surface drawing, textile persistence and handoff, themes and vector workspaces. `qa/textiles-023/production-final.log`.
- Native 0.23.0 build completed and was packaged as [Corpora Studio 0.23.0.app](../releases/Corpora%20Studio%200.23.0.app). Bundle name/version and ad-hoc signature verification passed. `qa/textiles-023/desktop-build-final.log` and `qa/textiles-023/signature.log`. The build is not notarized; native save/open dialogs were not requalified in this pass.
- [Brand kit](../releases/corpora-brand-kit.zip) includes editable SVGs and transparent PNGs. [Visual review gallery](../qa/corpora-024/gallery.html) includes both themes and studio workspaces.

These checks are targeted verification, not a certification of accessibility, production color matching or garment fit.

## Pre-publication review — 2026-11-08

A design, flow and defect review before the first push to a private GitHub repository. Fixed in this pass:

- **Review room contrast.** The room used fixed dark greys while the theme painted its shell as paper, so several labels were unreadable in light mode (contrast 1.08). It now uses the shared theme tokens, and light-mode muted text is slightly darker (`#675969`) to clear WCAG AA on every panel colour.
- **Dialog keyboard safety.** Eight dialogs focused their first button on open, even when it was disabled, so focus never entered and Escape did nothing (the pose and sleeve study could not be closed from the keyboard). Clicking empty space inside a dialog also dropped focus to the page. Dialogs now focus their first enabled control and are focusable themselves. Closing the stencil returns focus to the image studio underneath.
- **False "Unsaved changes".** Opening Fashion created the default pattern draft as an edit, which marked a fresh study unsaved and added an undo step. The default is now seeded without either.
- **Stencil studio.** It traces the artwork on open instead of showing an empty preview, and explains when export is unavailable. In dark mode the preview stays white paper, so the contours remain visible.
- **Current step.** The tattoo step row and the dark-mode Fashion step row now mark the current step. The pose and sleeve study sits apart from the numbered steps as an optional extra.

Checks after the fixes: TypeScript build clean; 698 unit tests passed; 67 Chromium end-to-end tests passed (the dark-theme stencil case after a follow-up contrast fix); the production build passed 48 WebKit tests; a known-pattern secret scan of the working tree and history found nothing.

Follow-up the same day:

- **Fashion names.** Each name now means one thing: the pattern being edited is the **Selected pattern**; the 65 drafted designs are the **Pattern catalog**; the 112 imported garment drawings are **Garment flats** (formerly Asset library and Garment assets); fabric prints are the **Print library**. The duplicate Vector packs card under the pattern was removed; the workspace tab remains.
- **Stencil studio** controls use the same numbered sections, fields and buttons as the image studio, in both themes.
- **Project library** returns focus to the button that opened it.
- **1080 px window.** No clipped or overflowing controls were found; the tattoo step numbers and current-step marker now stay visible at this width.
- **Docs.** Milestone records moved to `docs/history/`, research to `docs/research/`, with an index in `docs/README.md`.

Still open: a timed first-run walkthrough of both journeys by a person.
