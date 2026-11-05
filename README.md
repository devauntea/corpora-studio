# Form Studio 0.12.0

A local desktop studio for tattoo composition, artwork preparation and measurement-driven fashion design.

Open `releases/Form Studio 0.12.0.app` on this Mac. Save work in an older session before switching versions; previous release bundles are preserved.

- **Body studio:** fit/average male and female full arms, upper bodies, full legs, neck and full body from the neck down. Toggle the colored muscle guide, pose arms independently and inspect named regions. Connected placements cross chart boundaries; distortion inspection reports triangle stretch.
- **Body revision 5:** torso-only upper bodies, rounded lower pectorals, clearer back muscle planes, fuller average builds, clean section cuts, refined skin/nail shading and 30 skin colors. Chest flex, back flex and full-body double-biceps presets deform the tattoo-bearing surface. Older saved bodies retain their original mesh. See the [body review](docs/body-fidelity-0.10.md).
- **Personal fitting:** import front/side photographs, confirm landmarks, enter height and optional tape measurements, optimize locally, review residuals and apply the fitted torso shape.
- **Artwork studio:** crop; key a light, dark or sampled background; erase/restore; draw pressure-sensitive strokes; adjust tone and contrast; export transparent PNG. Original images remain embedded unchanged.
- **Stencil studio:** select traced centerlines, set line width in millimeters, calibrate a printer with a 50 mm square, and export mirrored or normal true-size PDF/PNG with physical resolution metadata.
- **Photo composition:** placement, perspective corners, nine-point lattice, numeric keyboard controls, existing-ink protection, groups and review export.
- **Fashion:** 65 searchable FreeSewing sewing patterns across tops, outerwear, bottoms, dresses, underwear, blocks and accessories; required measurements and options; reusable profiles, JSON/SMIS interchange, independently drafted nested sizes and grade checks; fabric records and ease warnings.
- **Vector packs:** 12 editable front/back garment-flat starters; custom paths and Bezier editing; pockets/collars/cuffs/trims; construction callouts, size specifications and bills of materials. Export editable SVG, vector PDF, CSV and a manufacturer ZIP. See the [fashion guide](docs/fashion-workspace.md).
- **Imported garment library:** 112 original PNG sheets and 217 editable traced views, with categories, search, favorites, source/trace previews and front/back placement. Compound paths retain holes, linework and stitching in SVG/PDF exports.
- **Workspace navigation:** direct Patterns / Vector packs / Asset library tabs, Cmd/Ctrl+K quick actions, canvas focus mode and a simpler monochrome hierarchy.
- **Pattern construction:** custom panels, formula-linked anchors and cubic controls, per-edge allowances, grainlines, notches and dart guides. SVG and overlapping A4/Letter PDF exports retain true dimensions and calibration squares.
- **Garment photo measurements:** four-corner reference calibration, editable endpoints, explicit ease/hidden-layer assumptions, draft-input transfer and tape/error CSV.
- **3D drape:** arrange triangulated pattern panels, pair stitch ranges, set pins and material controls, run a local visual simulation against the body and export reports. A cylinder benchmark accepts a measured physical sample for comparison.
- **Project library and portfolio:** local recovery copies, named checkpoints, side-by-side/swipe comparison, native save/open and a standalone gallery ZIP. Portfolio export includes only selected finished images and metadata; body-photo mockups are opt-in.

The [implementation record](docs/next-features-implementation.md) maps all eight research areas to software and evaluation status. The [status ledger](docs/studio-completion-status.md) distinguishes delivered workflows from physical and distribution qualification.

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
npm run desktop:build
```

`npm run dev` serves a browser test harness with download-based file operations. The companion website displays exported work and does not implement the editor. `scripts/dependency-notices.py` collects licenses for the chosen Cargo target; see [dependencies](docs/dependencies.md). Signing and Windows workflows are documented in the implementation record.

## Placement and files

Choose **Place** (`G`) and click/drag a surface. Numeric controls adjust width, position, rotation and stretch. Enable connected placement to cross local chart seams; changing incompatible mesh revisions clears those anchors. **Orbit** (`V`), scroll, right-drag, presets and Fit model control the view. Turning on muscle colors does not alter saved artwork.

Save is `Cmd+S`, Save As `Shift+Cmd+S`, Open `Cmd+O`, Undo/Redo `Cmd+Z` / `Shift+Cmd+Z`, and Export `Cmd+E` (Ctrl equivalents in the Windows harness). Project history keeps 100 changes; image editing has its own session history. Applying image edits is one project undo step. Version 12 documents open versions 1–11 after validating and migrating them, keeping old surfaces intact. The first save of an older document creates a new copy.

## Practical limits

- Anatomy, personal shape fitting, ink appearance and cloth are artistic approximations. No clinical, scan-reconstruction, healed-tattoo, fabric-accuracy or production-fit claims are made. Body fitting adjusts torso width/depth at three levels; full-body models omit the head.
- Photo measurement assumes a flat plane and a known reference. It does not recover hidden seams, darts, facings or back pieces. Background removal is color-key based, not semantic segmentation.
- Cloth currently has no self-collision or calibrated anisotropic fabric mechanics. Inspect the strain and seam report; validate a sewn toile and real cylinder sample before relying on fit.
- Connected maps can fold on large curved regions; folded triangles are omitted and reported. Distortion is a geometric Jacobian estimate, not a calibrated skin-mechanics model.
- Source limits: 24 assets, 24 layers, 8 body photos, 15 MB / 32 megapixels / 8192 pixels per source, 64 megapixels in total, 70 MB encoded images and 80 MB project file. Brush-point and geometry budgets are enforced on load. Two bounded workers run at once, with cancellation and a 60-second job limit.
- Recovery copies are local, quota-limited and separate from explicit file saves. Project history and transient simulations are not serialized; editable drape setup is saved for recomputation.
- Physical garment/stencil tests, qualified anatomy review, real-person fitting benchmarks, Windows/WebView2 qualification and public signing/notarization remain external evaluation steps. Automated checks do not substitute for them.

Earlier milestones are preserved in `docs/` as historical records. The current implementation and verification records supersede their old “not implemented” lists.
