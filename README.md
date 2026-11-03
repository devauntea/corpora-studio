# Form Studio 0.2.1

A local desktop tattoo-planning studio for photographic compositions and approximate 3D surfaces.

Save and quit any currently open Form Studio session, then open `releases/Form Studio 0.2.1.app` on this Mac. The older app bundle was left in place to avoid interrupting active work. Choose **Photograph → Add body photos** for PNG/JPEG or native HEIC import. Import artwork or reuse the source library, drag its handles, and paint **Protect existing ink** over areas new artwork must avoid. Save includes unchanged originals.

Choose **3D surface → Body model** for forearm, upper arm, calf, thigh or torso templates. These are adjustable planning surfaces; automatic photo reconstruction and connected/full-body modeling are not implemented.

Existing v1 projects open with unchanged sources and placements. Saving an opened v1 document prompts for a new v2 copy. Older app versions cannot open v2 files.

- [Audit, research, priorities, design and roadmap](docs/advanced-studio-plan.md)
- [Current verification and limitations](docs/advanced-verification.md)

## Original implementation notes

A local desktop workspace for composing tattoos on an adjustable 3D forearm. This is the first working slice of the tattoo and fashion platform, version 0.1 at that milestone. The current release extends this foundation as described above.

## Run the desktop application

On this Mac, open `releases/Form Studio 0.2.1.app` in Finder. It runs without the development server or an internet connection. The build is local and unsigned for distribution; it has not been notarized. Subsequent builds are produced in `src-tauri/target/release/bundle/macos/`.

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

## Use the first workflow

1. Start with the original Solar botanical study, or create a blank project.
2. In **Body model**, choose left/right forearm, enter length and wrist/elbow circumferences in millimeters, and select a preview tone.
3. **Import artwork** accepts PNG and JPEG. Files remain local. Dragging files into the viewport also imports them.
4. Choose **Place** (`G`) and click or drag on the surface. Use the numeric fields for perimeter position, height from the wrist, width, and rotation. Press Enter or leave the field to commit.
5. Choose **Orbit** (`V`) to rotate; scroll to zoom and right-drag to pan. Front/left/back/right and Fit reset the camera.
6. Adjust opacity, black ink, and light-paper removal. Duplicate layers or reuse source artwork from the library. Original source bytes are retained.
7. **Save** (`Cmd+S`) writes a `.formstudio` project. The arrow beside Save invokes Save As. **Open** restores measurements, layers, source assets, and the study label.
8. **Export review** (`Cmd+E`) writes an 1800 × 1800 PNG of the current view with the model's approximation label.

Undo/redo is `Cmd+Z` / `Shift+Cmd+Z` (Ctrl on Windows). Each surface drag or opacity gesture is one history step. Undo history holds up to 100 changes in the current session, survives a save, and resets when another project opens. The current composition is saved; undo history and camera position are not serialized.

## Current boundaries

- Five approximate 3D templates and direct photo overlays are implemented. No automatic reconstruction, connected body, joint articulation, pattern drafting, garment simulation, or AI inference is implemented yet.
- Authored procedural surfaces avoid restricted body-model assets. Measurements control its proportions; this does not make it a personal anatomical reconstruction.
- A UV atlas wraps artwork around the surface, including across the seam. Width is defined in the tangent chart at its center. Tapering stretches the design away from its center. Overlapping wraps can blend; the model ends clip artwork. This is visual planning, not a validated stencil or physical fit guarantee.
- Ink uses selectable multiply/normal blending and approximate preview lighting. Color is not calibrated to skin or healed tattoos. Light-paper removal is a luminance/color heuristic, not semantic background segmentation.
- The display atlas is 2048 × 2048. Original images stay at their imported resolution. Review PNGs include the viewport image fitted inside the review sheet; a 1800-pixel sheet is not a guarantee of that much source detail.
- Limits: 24 assets/layers, 15 MB and 32 megapixels per image, 8192 pixels per side, 64 megapixels total source imagery, 70 MB import data budget, 80 MB project file.
- Saves replace the destination atomically using a same-directory temporary file. There is no autosave or crash recovery yet. Save before quitting; unsaved edits are guarded on New/Open/window close.
- Mac native behavior is the first test target. Windows native build, graphics, dialog behavior, file association, installers, signing, and notarization remain release work.

See [architecture](docs/architecture.md), [verification](docs/verification.md), and [dependency inventory](docs/dependencies.md). The earlier research report remains alongside this repository in `../tattoo-fashion-research-2026-11-03/`.
