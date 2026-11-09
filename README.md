# Corpora Studio 0.23.0 preview (formerly Form Studio)

**Product owner: Devauntae Norman.**

A local desktop studio for tattoo composition, artwork preparation and measurement-driven fashion design.

**Every body is a first draft.**

Corpora Studio 0.23 adds an original fabric-print and color workspace, editable repeat size and rotation, and print-aware SVG/PDF/manufacturer exports. The app name and mark are new; existing `.formstudio` projects and local recovery storage remain compatible.

Earlier milestones added chart-based male/female S/M/L pattern starters, actual pattern previews and a local image inventory for calibrated tracing and supported approximate garment drafts. See the [0.19 delivery record](docs/final-development-0.19.md) for those workflows and limitations, and [GitHub preparation](docs/github-readiness.md) before any publication.

This is a local preview, not a certified manufacturing or anatomical tool. Physical sample/fit review, native distribution qualification and supplied vector-asset redistribution rights remain open. Earlier release bundles are preserved.

- **Guided workspace:** optional Home with task starters and recent projects; searchable body-model browser and artwork layers; direct tattoo task paths; clearer active tools, selection and empty states.
- **Pattern inventory:** preserve PNG/JPEG originals, calibrate a flat plane with four corners and measured dimensions, detect clean closed outlines or trace manually, edit construction/markings and retain source notes. Measured box-top and straight pull-on-skirt drafts are supported approximations; there is no automatic OCR or hidden-construction recovery.
- **Starter sizes:** all 65 patterns preview before customization with six source-documented profiles; essential chart measurements and estimated secondary landmarks are distinguished. Apply retains a backup of custom measurements and manual construction.
- **Fashion guidance:** choose/fit/construct/output routes, collapsible pattern catalog, selected-piece dimensions, explicit PDF/SVG destinations and connected vector-pack pages with front/back working-view controls.
- **Local review room:** freeze a project fingerprint, capture rendered views, add object/view notes and export an explicitly selected offline ZIP. Recipients return revision-linked JSON feedback; imports add review records without changing geometry. No live collaboration or raw 3D geometry export.
- **Surface drawing and navigation (0.20):** draw and erase on the model, save editable ink layers, pan and zoom while editing, and inspect tattoo fit. The anatomy-derived preview collection has been removed from the picker. [Usage and fit limitations](docs/surface-drawing-0.20.md).
- **Imported sculpts:** seven additional parts from the supplied GLBs, including separate hand and foot models, embedded detail maps, connected tattoo placement and persistent asset identity. These retain their authored fixed poses. See [0.17 changes and usage](docs/sculpt-library-0.17.md).
- **Body revision 9:** smoother, fuller shoulder/arm/back/thigh/calf forms, with the r8 chest, exact topology, rims, rig and tattoo anchor indices preserved. Old studies upgrade explicitly.
- **Body studio:** fit/average male and female full arms, upper bodies, full legs, neck and full body from the neck down. Toggle the colored muscle guide, pose arms independently and inspect named regions. Connected placements cross chart boundaries; distortion inspection reports triangle stretch.
- **Body revision 8:** 52 visible muscle regions, a rebuilt and Blender-polished male pectoral contour, source-projected separation and seamless physical-scale skin detail. Bend-driven wrinkles supplement the existing r7 rig. Old studies keep their original bodies until an explicit, undoable upgrade. See [0.16 changes, comparisons and limits](docs/body-refinement-0.16.md).
- **Body revision 6:** full MakeHuman bone hierarchy and skin weights, morph-following joints, dual-quaternion deformation, distributed arm twist and corrected knee direction. Male pectoral profile rebuilt; repeated arm/back surface ridges reduced. Older bodies remain reproducible and revision 5 has an explicit upgrade retaining tattoo anchors and charts. Reference-level anatomical fidelity is still in progress. See [0.14 implementation and remaining work](docs/body-composition-0.14.md).
- **Pose & sleeve study:** linked relaxed/posed views, shared tattoo editing, landmark/focal/space guides, knee and elbow comparisons, transfer-pose intent and PNG proof. A selected body chart can use 4K artwork detail.
- **Registered stencil sections:** named overlapping sections, common alignment crosses, orientation notes and remembered printer/paper/settings. PDF contours now use correct page-unit coordinates.
- **Personal fitting:** import front/side photographs, confirm landmarks, enter height and optional tape measurements, optimize locally, review residuals and apply the fitted torso shape.
- **Artwork studio:** crop; key a light, dark or sampled background; erase/restore; draw pressure-sensitive strokes; adjust tone and contrast; export transparent PNG. Original images remain embedded unchanged.
- **Stencil studio:** select traced centerlines, set line width in millimeters, calibrate a printer with a 50 mm square, and export mirrored or normal true-size PDF/PNG with physical resolution metadata.
- **Photo composition:** placement, perspective corners, nine-point lattice, numeric keyboard controls, existing-ink protection, groups and review export.
- **Construction & samples:** paired seam edges, length/ease/notch checks, editable assembly steps, linked callouts, frozen specification revisions, sample measurements and material colorways. SVG/PDF construction packages and expanded tech packs retain their units and revision identity. See [0.15 workflows and limits](docs/construction-fashion-0.15.md).
- **Fashion:** 65 searchable FreeSewing sewing patterns across tops, outerwear, bottoms, dresses, underwear, blocks and accessories; required measurements and options; reusable profiles, JSON/SMIS interchange, independently drafted nested sizes and grade checks; fabric records and ease warnings.
- **Vector packs:** 12 editable front/back garment-flat starters; custom paths and Bezier editing; pockets/collars/cuffs/trims; construction callouts, size specifications and bills of materials. Export editable SVG, vector PDF, CSV and a manufacturer ZIP. See the [fashion guide](docs/fashion-workspace.md).
- **Imported garment library:** 112 original PNG sheets and 217 editable traced views, with categories, search, favorites, source/trace previews and front/back placement. Compound paths retain holes, linework and stitching in SVG/PDF exports.
- **Reliable handoff (0.13):** grouped garments and multi-selection; previewed SVG artwork import with retained originals; export checks for missing specs, materials and clipping; SVG/PDF handoff reports. See [supported SVG input and verification](docs/reliable-handoff-0.13.md).
- **Workspace navigation:** direct Patterns / Vector packs / Asset library tabs, Cmd/Ctrl+K quick actions, canvas focus mode and a simpler monochrome hierarchy.
- **Pattern construction:** custom panels, formula-linked anchors and cubic controls, per-edge allowances, grainlines, notches and dart guides. SVG and overlapping A4/Letter PDF exports retain true dimensions and calibration squares.
- **Garment photo measurements:** four-corner reference calibration, editable endpoints, explicit ease/hidden-layer assumptions, draft-input transfer and tape/error CSV.
- **3D drape:** arrange triangulated pattern panels, pair stitch ranges, set pins and material controls, run a local visual simulation against the body and export reports. A cylinder benchmark accepts a measured physical sample for comparison.
- **Project library and portfolio:** local recovery copies, named checkpoints, side-by-side/swipe comparison, native save/open and a standalone gallery ZIP. Portfolio export includes only selected finished images and metadata; body-photo mockups are opt-in.

The [implementation record](docs/next-features-implementation.md) maps all eight research areas to software and evaluation status. The [status ledger](docs/studio-completion-status.md) distinguishes delivered workflows from physical and distribution qualification.

**Corpora Studio 0.23:** original contour logo and app icon, a rose/plum identity in both themes, the complete Corpora manifesto, and Fabric & color with 16 editable vector prints and 10 palettes. [Release details](docs/corpora-studio-0.23.md).

**UI refinement 0.22:** persistent Light/Dark/System appearance in both studios, collapsible vector panels with more canvas space, and clean seam-outline pattern previews. See [release verification](docs/ui-refinement-0.22.md).

**UI refinement 0.21:** a shared Paper & Ink identity, actual body-model previews, clearer pattern galleries and more readable editing controls. See the [design system](docs/design-identity.md), [verification and remaining issues](docs/premium-ui-0.21.md), and [before/after gallery](qa/ui-021/comparison.html).

## Run and develop

The packaged Mac app works without a development server or network. It is locally ad-hoc signed, not notarized for public distribution. Install Node 24, stable Rust and the [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
npm ci
npm run desktop
```

Cargo is installed at `/Users/bigbobby/.cargo/bin` on this machine. If needed, run `source /Users/bigbobby/.cargo/env` before the commands below.

```sh
npm test
cargo test --release --manifest-path src-tauri/Cargo.toml
npm run build
npx playwright install chromium webkit
npm run test:e2e
npm run test:production
npm run desktop:build
```

`npm run dev` serves a browser test harness with download-based file operations. The companion website displays exported work and does not implement the editor. `scripts/dependency-notices.py` collects licenses for the chosen Cargo target; see [dependencies](docs/dependencies.md). Signing and Windows workflows are documented in the implementation record.

## Placement and files

Choose **Place** (`G`) and click/drag a surface. Numeric controls adjust width, position, rotation and stretch. Enable connected placement to cross local chart seams; changing incompatible mesh revisions clears those anchors. **Orbit** (`V`), scroll, right-drag, presets and Fit model control the view. Turning on muscle colors does not alter saved artwork.

Save is `Cmd+S`, Save As `Shift+Cmd+S`, Open `Cmd+O`, Undo/Redo `Cmd+Z` / `Shift+Cmd+Z`, and Export `Cmd+E` (Ctrl equivalents in the Windows harness). Project history keeps 100 changes; image editing has its own session history. Applying image edits is one project undo step. Version 19 documents open versions 1–18 after validating and migrating them, keeping body revisions, placements and original artwork intact. The first save of an older document creates a new copy.

## Practical limits

- Anatomy, personal shape fitting, ink appearance and cloth are artistic approximations. No clinical, scan-reconstruction, healed-tattoo, fabric-accuracy or production-fit claims are made. Body fitting adjusts torso width/depth at three levels; full-body models omit the head.
- Photo measurement assumes a flat plane and a known reference. It does not recover hidden seams, darts, facings or back pieces. Background removal is color-key based, not semantic segmentation.
- Cloth currently has no self-collision or calibrated anisotropic fabric mechanics. Inspect the strain and seam report; validate a sewn toile and real cylinder sample before relying on fit.
- Connected maps can fold on large curved regions; folded triangles are omitted and reported. Distortion is a geometric Jacobian estimate, not a calibrated skin-mechanics model.
- Source limits: 24 assets, 24 layers, 8 body photos, 15 MB / 32 megapixels / 8192 pixels per source, 64 megapixels in total, 70 MB encoded images and 80 MB project file. Brush-point and geometry budgets are enforced on load. Two bounded workers run at once, with cancellation and a 60-second job limit.
- Recovery copies are local, quota-limited and separate from explicit file saves. Project history and transient simulations are not serialized; editable drape setup is saved for recomputation.
- Physical garment/stencil tests, qualified anatomy review, real-person fitting benchmarks, Windows/WebView2 qualification and public signing/notarization remain external evaluation steps. Automated checks do not substitute for them.

Earlier milestones are preserved in `docs/` as historical records. The current implementation and verification records supersede their old “not implemented” lists.
