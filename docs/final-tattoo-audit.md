# Tattoo workspace engineering QA — final development push

Date: 2026-11-06. This is an engineering screen, interaction and repository audit; it is not a release approval.

## Completed corrections

- **Stencil workspace:** opening export checks previously expanded its footer to 357px, leaving only 265px of editor height at 1100×760. Checks now live in the settings panel's single scroll area, so opening them does not resize the preview. Export buttons remain fixed, visible and separate from the explanatory text. The regression requires more than 450px of editor height at all three requested window sizes.
- **Image studio:** “Stencil output” was squeezed into the same 35px width as icon buttons. It is now a full text action. Long source names truncate in the header with the complete name available as a title; actions remain visible. The settings column, brush groups, color field and footer spacing have been refined.
- **Keyboard access:** the image studio now receives and traps focus. Opening the nested stencil studio makes the underlying image editor inert and removes it from the accessibility tree until the stencil closes. Existing return-focus behavior is preserved.
- **Body library:** short desktop windows use a smaller preview/header to expose more model choices and body options, while keeping the selection action fixed.
- **Pose study and Review room:** constrained scrolling, stable scrollbar gutters, non-shrinking header actions and shorter-window spacing keep their working areas usable.

Files: `src/ArtworkStudio.tsx`, `src/StencilStudio.tsx`, `src/studio-polish.css`, `src/BodyLibrary.css`, `src/tattoo-planning.css`, `src/review-room.css`, `tests/e2e/tattoo-ux.spec.ts`. This pass does not modify the rendering engine, domain schema, native app code or body assets.

## Verification and visual evidence

- Chromium: all three new responsive-editor scenarios passed (32.4 seconds).
- WebKit: seven scenarios passed (36.6 seconds): three responsive-editor scenarios plus existing anatomy/pose/project round trip, image background removal and erase/restore with unchanged source, crop with calibrated export and grouped undo, and stencil drawing/PNG/PDF/transfer-plan/group round trip.
- Window sizes: 1100×760, 1280×800, 1440×940. Each scenario checks the image action's width/overflow, keyboard focus cycle, nested modal isolation, stencil preview height before/after expanding checks, body selection action visibility, pose preview height and Review room action visibility.
- The responsive stencil passes WCAG 2 A/AA Axe checks in Chromium and WebKit at 1100×760.
- TypeScript passed after the component changes. Root should rerun the integrated build after concurrent fashion work is complete.
- Before screenshots and baseline geometry: `qa/final-ux/tattoo-before/`. After screenshots for all six screens, three sizes and both engines: `qa/final-ux/tattoo-after/`. These are actual rendered application/model/artwork views, not generated mockups. The initial baseline capture did not wait for every asynchronous artwork/pose preview; use the completed after captures to judge content fidelity.

## Performance evidence and limitations

`qa/final-ux/tattoo-performance.json` records an existing production build served without HMR, including renderer identity, cold-ready time, orbit requestAnimationFrame intervals, width/rotation-to-paint times and V8 heap usage. These are headless Chromium measurements using software SwiftShader, not a hardware-accelerated native app benchmark. The artifact identifies the build/measurement limitations and retained transform values. Final integrated native performance remains to be checked by the main release workflow.

The isolated run had one navigation, loaded the body in 3.433 seconds, retained 2,017 connected-placement triangles after transforms, and preserved the requested 105 mm width and 25° rotation. Its 38 orbit samples had an 83.3 ms median / 100 ms p95 rAF interval; transform-to-paint times were 1.635 seconds and 1.243 seconds. V8 heap usage was 102.5 MB, excluding GPU/native/image memory. These slow software-renderer results are documented as a limitation, not a successful native performance target.

An earlier development-server measurement was invalidated by concurrent HMR resetting the demo; its suspected connected-placement loss was not treated as a confirmed defect. No speculative renderer rewrite was made. No claim of anatomical validation, new sculpt fidelity, or completed native performance signoff is made by this pass.

## GitHub readiness: read-only findings

- Snapshot inventory: 928 tracked files, approximately 180.2 MB; 184 untracked files, approximately 171.8 MB. These counts naturally change during the concurrent final push. Largest individual files are approximately 12.8 MB body binaries; no individual inspected file exceeded 100 MB. Retaining historical body revisions preserves saved-study compatibility; publication size is a packaging decision, not a reason to delete them in this pass.
- Existing `.gitignore` excludes dependencies, generated builds, native targets, test output, QA artifacts, local `.formstudio` files, releases and `.tools`. Root owns any additions and publication packaging.
- A bounded scan of tracked and untracked, non-ignored text-like files smaller than 3 MB found **zero** matching GitHub tokens, AWS access-key IDs, sk-prefixed API tokens or private-key headers, and no `.env`/private-key credential filename candidates. Values were not printed. This is a focused pattern scan, not a complete Git-history/high-entropy secret audit; `gitleaks` was unavailable on PATH.
- `npm audit --json` reported **0 vulnerabilities** (0 critical/high/moderate/low/info), with 220 dependencies in the metadata. Full result: `qa/final-ux/dependency-audit.json`. No dependency upgrades were performed. This is the npm audit only; it does not establish Rust or asset license compliance.
- **Publication blocker:** `public/garment-assets/provenance.json` states that the 112 user-supplied PNG sheets in `vectors.zip` had no supplied third-party license. Their originals and traced assets are already tracked. Public redistribution rights must be confirmed or publication packaging must exclude/rework those assets. No new license is asserted by this audit.
- Imported sculpt records preserve named authors, source URLs, hashes and embedded CC BY 4.0 declarations under `assets/sculpts/PROVENANCE.md` and per-part JSON. MakeHuman source license files and Z-Anatomy attribution/CC BY-SA lineage are retained. Revision 9 was absent from `assets/anatomy/atlas/source.json`'s derived-file list at audit time; root was notified to update that provenance manifest.
- Final native Mac checks, complete publication license/provenance review, and explicit owner authorization to publish remain separate release gates. No repository was published, no Git history rewritten and no user project modified by this audit.
