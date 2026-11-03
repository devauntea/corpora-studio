# Form Studio 0.6.0

A local desktop tattoo-planning studio with complete anatomical sections and an image cleanup workspace.

Open **`releases/Form Studio 0.6.0.app`** on this Mac. Save and quit an older Form Studio session before switching versions; the previous app bundle is preserved.

- **Body model → Template:** full arm, connected upper body, or full leg. Choose male or female and **Fit / Average**, refine build and definition, then use **Skin / Muscles** and filter opacity to compare the tattoo against muscle flow. The latest sculpt adds joint and tendon landmarks, skin folds, and muscle-specific fibers with clean connective borders. Point at a colored region for its name and direction. Each arm has independent elbow flex, shoulder elevation and forearm rotation; legs retain knee flex. Use **Fit model** after raising an arm.
- **Tattoo image studio:** crop the image; remove a light, black or chosen-color background; erase/restore details; adjust tone; compare with the original; export a transparent PNG; then apply edits to the composition.
- **Photograph → Add body photos:** the existing direct-photo workflow, protection masks and HEIC import remain available.
- **Save:** v6 projects embed unchanged original images plus editing recipes. v1/v2/v3/v4/v5 projects open with their old surfaces and placements; their first save creates a new copy.

The colored muscle map is registered from a superficial anatomy atlas to an adjustable skin surface. It is a placement reference, and flex is an approximate pose preview. This is not a clinical anatomy model, personal body reconstruction, calibrated skin-stretch simulation or validated tattoo stencil. Upper-body artwork uses separate trunk and arm charts.

See [the surface-detail update and verification](docs/surface-detail-update.md), [the body library and asset provenance](docs/detailed-body-update.md), and [the preceding pose and crop update](docs/pose-crop-update.md).

## Run and develop

The Mac app runs without a development server or internet connection. This local build is not notarized for public distribution. Build output goes to `src-tauri/target/release/bundle/macos/`; versioned copies in `releases/` avoid replacing a running app.

For development, install Node 24, stable Rust, and the [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/). Then:

```sh
npm ci
npm run desktop
```

Rust was installed at `/Users/bigbobby/.cargo/bin` on this machine without changing shell profiles. If Cargo is not on your PATH, run `source /Users/bigbobby/.cargo/env` first.

```sh
npm run test
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
npx playwright install chromium webkit
npm run test:e2e
npm run desktop:build
```

`npm run dev` is a browser development harness. Its download-based file operations are only for development testing. The companion public website is a future portfolio of finished work, not a browser editing product.

## Placement and files

Choose **Place** (`G`) and click or drag on a body surface. For the connected upper body, a surface click selects the trunk or corresponding arm chart. Numeric controls adjust position, width, rotation and stretch. **Orbit** (`V`), scroll, right-drag, camera presets and Fit control the view. On photographs, use the visible scale/rotation handles and optional protection masks.

Artwork appearance, visibility, locking, layer ordering and duplication remain available. Source cleanup applies to all instances; ink appearance remains per layer. Apply in the image studio is one project undo step. Each image brush stroke, crop drag and continuous adjustment-slider gesture is one editor undo step. In Crop mode, drag corners to resize, drag inside to move, or drag outside to draw another rectangle. Reset crop recovers the full image without losing brush edits. Cropping keeps each placed instance’s width and center and updates its height to match the new aspect ratio. Fit and 150–300% zoom scale the image to the available editor space.

Save is `Cmd+S`, Save As is `Shift+Cmd+S`, and Open is `Cmd+O`. Undo/redo is `Cmd+Z` / `Shift+Cmd+Z` (Ctrl in the browser harness on Windows). Project undo holds 100 changes and resets on Open; undo history and camera position are not serialized. Review export is `Cmd+E`: 1800 × 1800 for 3D; photo export has a maximum 4000-pixel image edge plus its review footer. These dimensions do not guarantee equivalent source detail. Muscle-filter exports include the atlas attribution; skin-only and photograph reviews retain their existing footer.

## Current boundaries

- Male and female anatomical surfaces with fit and average presets, complete arm/upper-body/leg sections, and the five legacy surfaces. No automatic personal reconstruction, clinical muscle segmentation, muscle-contraction simulation, garment simulation or AI inference.
- Surface charts preserve attachment through model and pose changes but have local distortion, especially around joints, shoulders, hands and feet. A single upper-body layer does not paint seamlessly across the trunk/arm chart boundaries.
- Ink color and lighting are artistic approximations. Background removal keys chosen colors; it does not recognize semantic subjects. Perspective correction and semantic subject segmentation remain future work.
- Source limits: 24 assets and 24 layers; 15 MB, 32 megapixels and 8192 pixels per side per source; 64 megapixels across source imagery; 70 MB encoded image budget; 80 MB project file. Photo and cleanup mask budgets are validated on load.
- Sources are embedded unchanged. Display processing uses up to 2048 pixels per image and 2048 × 2048 per surface chart. Transparent artwork export uses up to 4096 pixels.
- Saves atomically replace the selected destination. Autosave and crash recovery are not implemented. Pending project changes are guarded on New/Open/close, and a pending image editor must be applied or canceled before quitting.
- macOS Apple Silicon is the tested native target. Windows qualification, installers, file associations, distribution signing and notarization remain release work.

See the [dependency inventory](docs/dependencies.md). Earlier milestones remain documented in [the original architecture](docs/architecture.md), [the photo workflow plan](docs/advanced-studio-plan.md) and [its verification](docs/advanced-verification.md). The original research report is alongside the repository in `../tattoo-fashion-research-2026-11-03/`.
