# F02 verification — Form Studio 0.2.1

Executed 3 November 2026 on this Apple M4 MacBook Air (16 GB, arm64). This record qualifies the implemented milestone, not the full advanced-platform roadmap.

## Automated results

| Check | Result and evidence |
| --- | --- |
| TypeScript / production frontend | `npm run build` passes; one expected large Three.js chunk warning |
| Domain / geometry / history | 11 Vitest tests pass in `tests/domain.test.ts` |
| Native storage / HEIC | 5 Rust tests pass, including the opt-in local reference test |
| UI workflows | 6 Playwright scenarios pass: three scenarios each in Chromium and WebKit |
| Runtime dependency audit | `npm audit --omit=dev --audit-level=high`: zero vulnerabilities reported |
| Source whitespace | `git diff --check` passes |
| Mac release | Optimized Tauri `.app` build succeeds; local arm64 bundle, not notarized for distribution |

The domain tests include a real F01 saved project fixture. Migration preserves its body, layers, source data and hashes exactly; a v2 save/parse cycle remains stable. Forearm tests retain the original seam, measured-circumference and chart-scale assertions. New-region checks cover all four templates, end and intermediate circumferences (within 0.05 mm of the defined procedural circumference), seam coincidence, finite normals and a measurable geometric change from contour strength. These tests verify the mathematical templates, not accuracy against a person's anatomy.

Photo schema tests cover independent placements, protection strokes, custom appearance, flips/stretch/locking, missing references, image budgets, invalid mask coordinates and HEIC preview integrity. Existing 20-command undo/redo and transaction grouping tests still pass.

The photo UI scenario verifies:

- Empty photo mode does not expose 3D layers.
- Two independent photo records and artwork import work.
- A multi-step drag and a scale-handle gesture each undo in one step.
- Pixel sampling confirms new ink darkens the photo, then a protection stroke restores the sampled original pixel exactly.
- Undo/redo restores the stroke; original/composition comparison works.
- Keyboard movement works; locked placement and ink controls are disabled and keyboard movement is blocked.
- Affine shear, flipping and custom ink survive save/open.
- Original photo bytes and their SHA-256 match the imported buffer exactly after saving.
- PNG photo export has the expected image dimensions plus its footer.
- Reordering stays within the selected photo even with layers from other photos between them.
- Invalid PNG import reports an error without crashing the application.
- Switching back to 3D restores its own artwork and exposes torso measurements/contour controls.
- No uncaught page errors or external HTTP requests occur.

The original UI workflows still verify width edit/cancel, undo/redo, measurement/side edits, file round-trip, corrupt-file recovery, image import, seam-side review export, surface dragging, camera presets and the unsaved New guard.

## Native checks and private references

The native HEIC worker was exercised on both supplied 4032 × 3024 images:

| Local source | Original bytes | Decoded PNG bytes |
| --- | ---: | ---: |
| IMG_5426.HEIC | 816,206 | 7,510,494 |
| IMG_5456.HEIC | 1,053,150 | 10,565,327 |

Both produced valid PNGs with the expected dimensions. The test reread and compared the original files after conversion; their bytes were unchanged. Preview data fits the retained per-preview and combined image budgets. Malformed headers/base64 are rejected. The source photos and decoded QA previews are not committed or bundled.

The 0.2.0 native build was launched without a development server. An open, unsaved v1 study was first saved to `studies/Before F02 upgrade.formstudio` and independently hash-checked. The new app opened that v1 file, restored both original layers and showed the migration notice. Native import of IMG_5426.HEIC displayed the full photograph in the photo workspace. The user began editing this workspace during verification, so that session was deliberately left open.

The final 0.2.1 bundle is packaged separately as `releases/Form Studio 0.2.1.app`. It adds the verified empty-mode filter, disabled locked controls and photo-specific ordering fixes. It was built after those fixes; it was not launched over the user's active session. Save the active work and quit that instance before opening the final bundle. Final native v2 dialog save/reopen and photo-PNG dialog export were not repeated over the user's live session. Their shared atomic file/PNG host paths are covered by the F01 native checks and current Rust tests; current v2 payload round-trip and photo PNG rendering are covered by both browser engines.

## Performance and resource limits

The 3D atlas remains 2048² and the surface mesh remains 12,513 vertices. The visible scene diagnostic reports 49,538 rendered triangles including passes. Region templates add a bounded cross-section cache; photo mode pauses scene rendering. Photo preview and processed artwork are capped at 2048 pixels per edge. Review photo rendering is capped at 4000 pixels per longest edge plus the label footer. Cached variants are pruned to used layers.

The headless browser diagnostics varied with concurrent build/test load (roughly 80–190 ms p95 in the final workflow runs). These are software/headless test observations, not a native frame-rate qualification. No improved frame rate, GPU peak, full-project peak memory, anatomical accuracy or physically uniform tattoo scale is claimed. The F01 native baseline remains documented separately; maximum-budget photo/3D profiling and broader hardware qualification remain release gates. A separate host-process sample was approximately 88 MiB RSS; it excludes WebKit/GPU processes and must not be interpreted as total application memory.

Unchanged limits: 24 total embedded sources and 24 layers, 15 MB/source, 32 MP/image, 64 MP/project, 8192 pixels per side, 70 MB encoded source/preview data and 80 MB project file. New limits: eight photos, 200 protection strokes/photo, 2000 points/stroke, 80,000 total protection points. HEIC previews are separately capped at 16.5 MB before base64 encoding. Oversized images are rejected, not silently substituted for their originals.

## Limits that remain explicit

- Torso/limb templates are blockouts, not scans. They do not include articulated elbows/knees, shoulders, neck attachments or connected full bodies.
- Photos are placement canvases, not automatically reconstructed models. Per-photo placements do not project into 3D or synchronize across angles.
- The photo warp is affine shear; there is no local mesh deformation, perspective fit, mask feathering/reveal brush, or photo zoom/pan yet.
- Locks protect transforms, appearance and deletion. Visibility, stacking and duplicating an unlocked copy remain available.
- Threshold and ink previews are artistic studies, not calibrated healed-ink predictions or validated transfer stencils.
- Photo masks protect all new ink on that photo; per-artwork masks/crop/brush/outlines, grouping, snapping and saved variations remain future work.
- No autosave/crash recovery, Windows release, distribution signing/notarization, or public portfolio publishing was added.

Reproduce the local HEIC test only when those private reference files are available:

```sh
FORM_STUDIO_REFERENCE_DIR=/Users/bigbobby/Downloads \
  cargo test --manifest-path src-tauri/Cargo.toml -- --include-ignored --nocapture
```

The test is ignored by default because personal images must not become repository fixtures. All other automated tests use generated images or the original code-drawn botanical source.

Final executable SHA-256: `f80e29e431f1918c6f9f6263af9c8f305dfd4fc50f6c99893a5b5874fd622a4c`. Bundle version: `0.2.1`.
