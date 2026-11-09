# Form Studio 0.19 — final development delivery record

**Product owner:** Devauntae Norman  
**Record date:** 6 November 2026  
**Candidate:** application 0.19.0, project format 19  
**Current status:** 0.19.0 is built and locally signed. Unit, Rust and production-browser checks pass; the 96 development-browser cases are verified across the full run and a focused correction rerun. The final design review approved a restricted local preview only. Native launch is observed, but native dialog completion and public release remain unqualified. This record does not declare the application ready for public distribution.

## 1. Scope of this milestone

This development pass completes supported fashion-image workflows, adds documented starter measurements and actual pattern previews, repairs confirmed interface problems, and strengthens image/document handling. It is an incremental extension of the existing local desktop application.

The inherited body revision 9, MakeHuman rig, anatomy guide, seven imported sculpt parts, tattoo wrapping, image/stencil editing, vector packs, 65 FreeSewing designs, seam tools, cloth experiments, review room and portfolio system remain available. Their regression coverage is included in the checks below. **They were not all created in this milestone. No new anatomical body rebuild, commissioned sculpt, reference-level muscle fidelity or new physical cloth solver is claimed here.** The companion website remains a display for exported work, rather than a second editing application.

### Completed new or revised work

| Area | Result in this milestone | Evidence and qualification |
| --- | --- | --- |
| Starter measurements | Six male/female S/M/L starters supply the complete measurement set needed to preview the 65 bundled designs. Published chart anchors are separated from secondary estimates. | 390 design/profile combinations are included in the full unit suite. These are commercial-chart-based drafting examples, not population averages or guaranteed fit. [Sizing record](../starter-sizing.md). |
| Pattern browser | Searchable cards and a larger selected-pattern preview use actual local FreeSewing geometry. Size changes are staged before application. | Existing measurements are backed up; custom construction, layout, notes and profiles are retained. A full profile library causes an explicit refusal rather than overwriting a profile. |
| Pattern-image inventory | PNG/JPEG originals, multiple references, source notes and permission records remain alongside calibrated editable pieces. | Four measured reference corners correct the flat plane. Clean closed outlines can be detected; manual tracing and correction are available. Text, grain, notches and hidden construction are not inferred. [Workflow and limits](../pattern-source-workflow.md). |
| Approximate garment drafts | A measured flat-lay silhouette and user-confirmed dimensions generate a sleeveless box-top shell or straight pull-on-skirt pieces. | Results use real editable construction geometry and preserve their source calibration and generation recipe. Back shape, construction and fabric assumptions are explicit; a toile is required. |
| Imported-piece workspace | A selected source study can open on a board containing only its custom pieces. | Existing template parameters and other construction are preserved. Selecting a template returns to the template workflow without deleting the inventory. |
| Tattoo editor usability | Image/stencil actions, nested keyboard focus, compact-window model selection, pose-study layout and review-room spacing are repaired. | Tested at 1100 × 760, 1280 × 800 and 1440 × 940. The rendering engine and body assets were not rebuilt as part of this UI repair. [Tattoo audit](final-tattoo-audit.md). |
| Fashion/Home presentation | The fashion sidebar has one usable scroll region; pattern browsing and task navigation are clearer. Home previews use real studio/engine assets. | Preview cards represent actual patterns or available app content, rather than invented finished-garment illustrations. Full automatic 3D garments are not supplied for every catalog design. |
| Image integrity and budgets | PNG/JPEG inspection validates actual image structure/dimensions and honors the remaining pixel budget before browser decode. HEIC processing honors the remaining budget on the native path. | Original bytes and hashes are preserved. Multi-reference imports decode sequentially. Tests include malformed/truncated data, dimensions and real local HEIC references. |
| Save semantics and migration | Project format 19 persists source inventory/custom-piece selection and migrates earlier formats. Browser download requests retain the unsaved-change guard. | Native file-save success and an unconfirmed browser download are distinguished. Format-18 measurements, body identity and immutable review fingerprints are covered by migration tests. |
| Ownership and preparation | User-facing product ownership and package/native metadata identify Devauntae Norman. Publication preparation documents separate code/asset ownership from distribution rights. | Required third-party provenance remains. See [ownership](../../OWNERSHIP.md) and [GitHub preparation](../github-readiness.md). No publication or history rewrite was performed. |

### Principal affected files

This table identifies the main files involved in the milestone, not every historical change in the working tree.

| Concern | Implementation and integration | Tests / documentation |
| --- | --- | --- |
| Starter profiles and preview geometry | `src/starter-sizing.ts`, `src/pattern-preview.ts`, `src/PatternCatalogBrowser.tsx`, `src/pattern-catalog-browser.css` | `tests/starter-sizing.test.ts`, `tests/e2e/starter-sizing.spec.ts`, `docs/starter-sizing.md` |
| Pattern reference inventory and reconstruction | `src/pattern-source.ts`, `src/PatternSourceStudio.tsx`, `src/pattern-source.css` | `tests/pattern-source.test.ts`, `tests/e2e/pattern-source.spec.ts`, `docs/pattern-source-workflow.md` |
| Project format and custom drafts | `src/domain.ts`, `src/fashion-model.ts`, `src/fashion-draft.ts`, `src/legacy-v18.ts`, `src/legacy-fashion-v18.ts`, `src/App.tsx` | `tests/pattern-inventory-project.test.ts`, existing domain/history and browser round-trip tests |
| Fashion layout and Home presentation | `src/FashionWorkspace.tsx`, `src/fashion-workflow.css`, `src/StudioHome.tsx`, `src/studio-home.css`, `public/studio-previews/`, `scripts/build-home-previews.mjs` | `tests/e2e/fashion-ux.spec.ts`, `tests/e2e/studio-ux.spec.ts`, actual preview captures |
| Tattoo workspace corrections | `src/ArtworkStudio.tsx`, `src/StencilStudio.tsx`, `src/studio-polish.css`, `src/BodyLibrary.css`, `src/tattoo-planning.css`, `src/review-room.css` | `tests/e2e/tattoo-ux.spec.ts`, `docs/final-tattoo-audit.md` |
| Raster import/restore and native budget checks | `src/raster-header.ts`, `src/io.ts`, `src/domain.ts`, `src-tauri/src/main.rs` | `tests/raster-header.test.ts`, `tests/raster-fixtures.ts`, `tests/e2e/raster-import.spec.ts`, Rust HEIC tests |
| Browser save protection | `src/App.tsx`, `src/io.ts` | `tests/e2e/browser-save.spec.ts` |
| Ownership, release and provenance | `README.md`, `OWNERSHIP.md`, `CONTRIBUTING.md`, `SECURITY.md`, `.gitignore`, package/native metadata, `assets/anatomy/atlas/source.json` | `docs/github-readiness.md`, this record, third-party notices |

## 2. Working user flows

### Preview, size and draft

Open Fashion and browse the 65 drafted patterns. Choose **Male starter** or **Female starter**, then S/M/L. The cards and selected preview redraw independently of the current document. Review the chart/estimate disclosure, then apply the chosen design with or without its starter measurements. Application preserves the previous measurements in profiles when necessary and remains undoable. Enter actual personal measurements and check the resulting pieces before making a garment.

The starter chart anchors come from the cited Simplicity tables; additional landmarks use documented preview assumptions. This fulfills a usable default-size workflow without misrepresenting estimates as a standard anthropometric dataset. Bust-sensitive or child designs still need appropriate personal measurements; the catalog explicitly identifies Otis as a baby romper.

### Import an existing pattern image

Open **Fashion → Image inventory → Import pattern image**. Import a PNG/JPEG with a clear closed outline. Mark four corners of a same-plane rectangle and enter its known width/height in millimetres; the initial A4-like values are examples and must be confirmed. Detect candidates or trace manually, choose the intended outline, and correct points by dragging or numeric percentage coordinates.

Create an editable piece, then review its geometry, grain, notches, name, cut quantity and allowance in the construction editor. The importer does not know whether the source boundary is a cutting or seam line, so it starts with zero allowance and a provisional grainline. **Use these pieces in draft** opens the selected inventory's custom board. Saving the project preserves the original bytes, source/permission notes, calibration and editable result.

### Draft an approximation from garment photographs

Choose **Reconstruct garment** and retain one or several photographs. Analyze one flat-lay reference at a time; additional photos support manual review rather than automatic multi-view reconstruction. Calibrate the plane and detect/trace the silhouette. The visible bounds can suggest panel width and length, but unsupported dimensions are rejected rather than silently clamped.

Choose either the sleeveless box top or straight pull-on skirt. Confirm actual dimensions and the stated construction assumptions, then generate the editable pieces. The top supplies assumed front/back shells; the skirt supplies two panels and a casing piece to cut twice and join. Neither result recovers hidden seams, closures, darts, lining, facings or fabric properties. Generated pieces remain visibly labeled as approximate, with the exact confirmed recipe retained as evidence.

### Continue tattoo work with repaired editor layouts

Prepare artwork, open the stencil tools, compose on a body and compare poses using the existing workflows. Text actions now have enough width, source names no longer crowd them, and stencil checks remain in the settings scroll area rather than shrinking the preview. When the stencil editor is nested inside the image editor, the underlying editor is inert and focus stays in the active dialog. Compact windows retain access to model selection and pose/review actions.

### Save and restore

Native saves use the existing atomic file path. In the browser harness, **Save** reports that a download was requested and retains the unsaved-change warning because the application cannot prove that the user actually received the file. Source originals remain byte-preserved. Existing project formats migrate to format 19 without replacing older body revisions or personal measurements; the first save of a migrated native document is a new copy.

## 3. Verification ledger

These results are supported by logs or completed targeted runs. A browser test validates the compiled/browser workflow; it does not prove native OS dialog behavior or physical garment accuracy.

| Check | Verified result | Evidence |
| --- | --- | --- |
| Integrated TypeScript and production build | Passed; Vite and TypeScript pass, including the final browser-only save-copy rebuild. | `qa/studio-019/production-final.log` |
| Full unit suite | **667/667 passed across 30 files**, 19.30 seconds. Includes inherited regressions and the 390 starter/design combinations; these are not 667 newly added tests. | `qa/studio-019/unit-final.log` |
| Native Rust unit suite | **7 passed, 0 failed, 1 ignored** in the default run. The ignored test deliberately requires private local HEIC fixtures. This log is the debug test profile, not a native performance measurement. | `qa/studio-019/rust-final.log` |
| Explicit local HEIC check | **1 passed**, exercising both supplied 4032 × 3024 originals, successful PNG conversion, unchanged source bytes and rejection against a 1 MP remaining budget. | `qa/studio-019/heic-final.log` |
| Compiled production WebKit workflows | **29/29 passed in 2.0 minutes**. Covers source inventory, starter staging, custom construction, tattoo/body identity and posing, stencil export, review feedback, save/recovery, vectors, resizing and responsive UI. | `qa/studio-019/production-final.log`; selected captures under `qa/studio-019/screenshots/` |
| Source workflow targeted checks | **14 unit tests** and **4 browser cases** passed: two workflows in each of Chromium and WebKit. Includes invalid-value retention, manual grain/notch edits, exact original preservation and project reopen. | `tests/pattern-source.test.ts`, `tests/e2e/pattern-source.spec.ts`, `.tools/qa/pattern-source/` |
| Starter/catalog targeted checks | 465 sizing/catalog unit checks and eight focused browser cases passed during development, including all 390 design/profile combinations. | `docs/starter-sizing.md`; preview captures under `qa/final-development/` |
| Responsive tattoo checks | Three new Chromium scenarios and seven WebKit scenarios passed in the targeted audit; the three responsive cases also pass in the final compiled production suite. | `docs/final-tattoo-audit.md`, `tests/e2e/tattoo-ux.spec.ts` |
| Automated accessibility | Scoped Axe WCAG 2 A/AA checks report zero violations for the tested pattern inventory/browser and responsive stencil views. Keyboard focus and narrow-window access also have explicit assertions. | Relevant E2E tests and targeted records; this is not full WCAG or assistive-technology certification. |
| Full development-browser suite | **94 passed / 2 failed in the full 17.2-minute run; both corrected cases then passed in 44.1 seconds.** The failures expected the obsolete single Gastrocnemius label; the existing atlas now names medial/lateral calf heads. Tests now assert both heads. Thus all 96 cases are verified across these runs, not one uninterrupted clean run. No product change was made for these failures. | `qa/studio-019/e2e-final.log`, `qa/studio-019/limb-rerun.log`, `qa/studio-019/full-e2e/`, `qa/studio-019/limb-rerun/` |
| Packaged native 0.19 application | **Build, bundle identity, local signature and native launch passed. Dialog completion remains unverified.** Initial release compile 4m23s; final browser-copy rebuild 45.8s; RC2 is 146,368,693 bytes. The initial 0.19 window rendered normally. User directly confirmed that Save opens a macOS dialog. CUA timed out; completed save/cancel/open/export remains unverified. RC2 changes only browser confirmation text and has not been separately UI-launched. | `qa/studio-019/desktop-build-final.log`, `release-manifest.json`, `native-qualification.json`, `native-save-sample.txt` |
| Final browser confirmation copy | **2/2 Chromium/WebKit checks plus 1/1 compiled-production WebKit check passed** after clarifying “Download a copy.” The native path remains unchanged. | `qa/studio-019/save-copy-check.log`, `qa/studio-019/production-save-final.log` |
| Final design review | **Approved for restricted local preview only**, medium confidence. Final release/publication qualification is withheld. | Corrections C01–C09 are summarized below |

The explicit HEIC run read `IMG_5426.HEIC` (816,206 original bytes; 7,510,494 PNG preview bytes) and `IMG_5456.HEIC` (1,053,150 original bytes; 10,565,327 PNG preview bytes). The private photographs are not added to automated public fixtures.

## 4. Screenshots and visual review

These captures show rendered application content. QA files are local verification artifacts excluded from Git; decide separately which owner-approved images belong in public project documentation.

| View | Evidence |
| --- | --- |
| Actual pattern browser, large desktop | [WebKit 1440 preview](../../qa/final-development/pattern-browser-webkit-1440.png) |
| Actual pattern browser, compact production window | [Production WebKit 1100 preview](../../qa/final-development/pattern-browser-webkit-production-1100.png) |
| Fashion workspace with measurements and pieces | [WebKit 1100 workspace](../../qa/final-development/pattern-workspace-webkit-1100.png) |
| Calibrated pattern inventory | [Production desktop](../../qa/studio-019/screenshots/pattern-inventory.png) |
| Narrow source inventory with visible study selection | [WebKit 540-pixel view](../../qa/studio-019/screenshots/pattern-inventory-narrow.png) |
| Editable approximate front/back pieces | [WebKit garment reconstruction](../../qa/studio-019/screenshots/approximate-garment-draft.png) |
| Tattoo image editor after layout corrections | [Production WebKit 1100 artwork](../../qa/final-ux/tattoo-after/webkit-production-1100-artwork.png) |
| Stencil preview and controls after layout corrections | [Production WebKit 1100 stencil](../../qa/final-ux/tattoo-after/webkit-production-1100-stencil.png) |
| Body library in a short window | [Production WebKit 1100 model selection](../../qa/final-ux/tattoo-after/webkit-production-1100-body-library.png) |
| Pose study in a short window | [Production WebKit 1100 planning](../../qa/final-ux/tattoo-after/webkit-production-1100-planning.png) |
| Review room in a short window | [Production WebKit 1100 review](../../qa/final-ux/tattoo-after/webkit-production-1100-review-room.png) |

The tattoo audit also retains before captures, but its earliest baseline did not wait for every asynchronous artwork/pose image. Use the completed after captures for content-fidelity assessment. The tests compare relevant dimensions and access to controls, rather than treating a screenshot alone as proof that a workflow works.

## 5. Performance observations and remaining work

| Measurement | Observed result | Scope |
| --- | --- | --- |
| First visible drafted catalog card | 129 ms in one WebKit development run, with six card images loaded initially. | Click-to-visible timing includes automation overhead; warm application modules, cold browser panel. Not a sustained benchmark. `qa/final-development/pattern-preview-check.json`. |
| Closed-outline detector | Three 1200 × 1200 synthetic rectangle samples: Chromium **34.9–60.2 ms**; WebKit **98–215 ms**. | Detector call only; excludes original-file reading and validation, image decode and UI work. Not a guarantee for complex drawings or a memory measurement. `.tools/qa/pattern-source/**/outline-performance.json`. |
| Preview/cache bounds | Processing rasters are at most 1.44 MP; catalog SVG cache holds at most 48 entries; reference imports decode sequentially within source/project limits. | Structural limits, not measured peak process or GPU memory. |
| Current 0.19 less-contended software-renderer check | Initial ready **3.477 s**; orbit median **83.4 ms** / p95 **100.1 ms**, about **12 FPS**; connected-width scene updates **375–566 ms**, rotation **20–23 ms**; JS heap **83.0 MB**. | One headless Chromium/SwiftShader run on Apple M4 / 16 GB after test/build completion; other user apps remained open. Zero page errors; requested values retained. Excludes native/GPU memory; not native GPU signoff. `qa/studio-019/performance-isolated.json`. |
| Current 0.19 contended stress observation | Initial ready **17.9 s**; orbit median **566.7 ms**, p95 **1433.3 ms**; JS heap **61.3 MB**. | Same production artifact while full browser/build work was active; load average rose 7.62→21.66. Preserved as contention evidence, not a normal-use benchmark. `qa/studio-019/performance-contended.json`. |
| Earlier tattoo rendering baseline | Prior 0.18 production build on headless Chromium/SwiftShader: body ready **3.433 s**, orbit rAF median **83.3 ms** / p95 **100 ms**, width/rotation-to-paint **1.635 s / 1.243 s**, V8 heap **102.5 MB**. | Predates the final 0.19 integration and uses software rendering. Heap excludes native, image and GPU memory. It retained 2,017 connected-placement triangles and requested 105 mm width / 25° rotation. `qa/final-ux/tattoo-performance.json`. |

Both the earlier and current SwiftShader results are slow and remain an explicitly documented limitation. They are not evidence of a successful frame-rate target, a speed improvement in 0.19, or native GPU performance acceptance. The current measurements precede a final browser-only confirmation-label clarification; rendering code is unchanged. An earlier HMR-interrupted sample was invalidated and was not used to justify a speculative renderer rewrite. Final hardware-accelerated native orbit/drag/transform, maximum-project memory and sustained responsiveness benchmarks remain outstanding.

The compiled build still reports chunks above 500 kB and ineffective dynamic imports. The largest emitted drafting chunk is about 1.65 MB minified / 375 kB gzip; Three.js is about 697 kB minified / 177 kB gzip. The build passes, but this warning is not recorded as fixed.

## 6. Findings corrected during engineering review

These are verified implementation corrections. They do not substitute for the separate final review.

- The stencil export-check footer previously grew to 357 pixels and left 265 pixels of editor height at 1100 × 760. Checks now remain in the settings scroll area; the regression requires more than 450 pixels of editor height without reducing it when checks open.
- The image studio's text stencil action previously received an icon-sized 35-pixel width. It now has a normal text-action width; long source names cannot push the action away.
- Nested stencil focus now isolates the underlying artwork editor. The source construction editor also keeps stable undo/redo callbacks so committing a numeric point with Enter cannot inadvertently focus/activate Done.
- Invalid source measurements remain visible with an error and block conversion. A typed 2500 mm reference width is not silently changed to 2000 mm. Unsupported measured reconstruction suggestions are rejected rather than converted into different dimensions.
- The narrow source layout retains the study selector; it is exercised at 540 pixels wide. Preview grid rows cannot collapse into clipped strips when all 65 cards are visible.
- New original-image inspection rejects invalid image structure/dimension evidence before handing oversized images to the browser. The native HEIC path checks the remaining budget before conversion; sequential reference import avoids six simultaneous decoded originals.
- Browser download requests no longer clear the unsaved-change guard. The browser confirmation action says “Download a copy” and explains how to verify the file before leaving; only the native action promises “Save & continue.” Tests intentionally suppress the download activation and confirm that the document remains dirty and protected.
- Legacy project schemas remain frozen. Newly introduced fields cannot be smuggled into old-version envelopes, while legitimate old measurements, artwork, body identity and review fingerprints remain intact after migration.

## 7. Known limitations and uncompleted requirements

1. **Image interpretation:** no automatic OCR, notch/grain/label recognition or reliable recognition of printed measurements. Open/overlapping line art, thick strokes, text islands and difficult backgrounds can require manual tracing and interpretation.
2. **Garment reconstruction:** only the explicitly confirmed sleeveless box-top and straight pull-on-skirt constructions are implemented. Arbitrary garments, hidden backs/seams, darts, closures, lining, facing, sleeve topology and multi-view 3D recovery are not inferred. A reference in a different plane cannot flatten a worn garment accurately.
3. **Fit and manufacturing:** starter estimates, seam checks, scale-preserving exports and geometric tests do not prove fit, material response or manufacturer acceptance. Physical samples, printer calibration, personal measurement checks and SVG/PDF review by the receiving maker remain necessary.
4. **Anatomy and tattoo appearance:** the inherited bodies are artistic approximations. Reference-quality muscle sculpting, scan accuracy, validated flex/skin mechanics and healed-tattoo appearance are not complete. This milestone supplies no new body-sculpt fidelity claim.
5. **3D clothing:** the existing prepared-panel drape tools remain experimental visual aids. Automatically assembled 3D garments for every catalog item, self-collision and calibrated anisotropic cloth behavior are not delivered.
6. **Performance:** final native GPU, maximum-budget memory and sustained interaction qualification remain open. Headless software-renderer timing is not a substitute.
7. **Release and review gates:** native launch is observed, but native save/cancel/open/export completion is unverified after repeated app-control timeouts. The full browser results and restricted review approval are recorded above. Windows/WebView2 qualification, public signing and notarization remain separate distribution work.
8. **Publication:** rights for the supplied vector-sheet library, the owner's original-code license choice, exact-tree/full-history secret review and final dependency/asset licensing review remain publication concerns. Current status belongs in [GitHub preparation](../github-readiness.md), which must be read before publishing.

## 8. Ownership and GitHub readiness assessment

Branding communicates one product identity under Devauntae Norman. This does not reassign third-party authorship or grant rights to redistribute supplied files. Legitimate MakeHuman, Z-Anatomy, sculpt, FreeSewing and other dependency provenance remains attached to the project. The inherited revision-9 outputs have been included in the anatomy adaptation manifest; recording them is not a new sculpt rebuild.

The repository has development, ownership, contribution and security documentation, exclusion rules for local projects/builds/QA artifacts, and verification logs. It is prepared for an owner review of publication packaging, **not automatically approved for public release**. In particular, the supplied vector originals/traces are already tracked and their redistribution rights are unresolved; adding an ignore rule cannot remove that exposure from history. No root license grant should be inferred until the owner selects one.

No repository publication, deployment, destructive history rewrite or overwrite of an existing user project was authorized or performed by this milestone. Complete native qualification and the publication checklist before changing that status.

## 9. Local build and review evidence

The packaged candidate is [Form Studio 0.19.0 RC2.app](../../releases/Form%20Studio%200.19.0%20RC2.app). Its executable SHA-256 is `98c3f4e9cd81b65ac2caa2738f12cad05b9edd2c1cb082060ef9052ffa0ac31f`. The initial 0.19 candidate and earlier release bundles remain intact; RC2 is separate so the running app was not replaced. No signed/notarized distribution claim is made.

The final review accepted corrections C01–C09 for restricted local preview: image integrity, accessible units, explicit invalid-input errors, narrow-window inventory access, rejection of unsupported measured suggestions, production CI coverage, predecode/aggregate budgets, browser save protection and original-metadata disclosure. The review relied on reported test evidence, not independent final reruns. The later full-browser and native-launch results in this record are subsequent qualification evidence, not a retroactive expansion of that approval.
