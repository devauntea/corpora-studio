# Form Studio 0.5 verification — 2026-11-03

## Automated checks

| Check | Result | Coverage |
| --- | --- | --- |
| `npm run build` | Passed | TypeScript and production Vite bundle; the existing Three.js chunk-size advisory remains |
| `npm test` | 22 passed | Frozen old-format migration, source integrity, image cleanup/crop, chart invariants, complete v2 attributes, finite poses, unchanged UV/identity fields, mesh/atlas checksums, valid group IDs, connected shoulder topology, planar neck/waist boundary rings and joint-radius preservation |
| Full Playwright suite | 16 passed in 3.1 minutes | Chromium and WebKit: four body presets, complete limbs and poses, filter persistence, artwork cleanup/crop, photo masks, source preservation, file round trips, invalid-file recovery and review export |
| Focused filter check | 2 passed | Both engines: filter changes actual canvas pixels; 0% opacity and switching back to Skin restore the exact original canvas image; hover identifies Pectoralis major; no shader or page errors |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 4 passed, 1 intentionally ignored | Atomic replacement, failed-save preservation, v1–v5 envelope and invalid HEIC; private local HEIC fixtures remain excluded |
| `npm run desktop:build` | Passed | Apple Silicon Tauri application, about 14.55 MiB reported by the bundler |
| `git diff --check` and asset manifest verification | Passed | No whitespace errors; all source and generated asset hashes match |

Initial continuous rendering caused software-renderer timeouts during long screenshot sequences. The renderer now redraws when camera/composition changes and stops drawing idle frames; the complete suite passed after that change. These test timings are not steady-state native GPU benchmarks. The diagnostics show intervals during orbit, excluding idle periods.

The focused pixel comparison reads the canvas itself; a DOM element screenshot also captures overlaid Skin/Muscles buttons and is unsuitable for an exact surface-only comparison.

## Visual checks

The four upper-body variants were inspected from front, back and side. Both sexes' complete arms and legs were inspected from front, back and side, with separate right-side 90-degree anatomy poses. The colored upper body was inspected from front, back and side. The 32 comparison captures are retained locally in `qa/f05/`.

The checks caught and corrected the initial female height/crop mismatch, lower-boundary morph overshoot, cut-face shading wedges, distant fiber shimmer, colored distal tendons, and a shader color-vector mismatch. The final material tests compile and render in both browser engines. Atlas boundaries and model proportions remain approximate; passing a rendering test is not anatomical validation or a claim of one-to-one fidelity with the commercial references.

## Desktop package

- App: `releases/Form Studio 0.5.0.app`
- Version in Info.plist: `0.5.0`
- Executable SHA-256: `5601703c078489ac759e8a9fbd5f948ee1f2acf0b92df2941db113d5080c73a7`
- Local ad-hoc signature passed `codesign --verify --deep --strict` before launch. This is not public-distribution signing or notarization.
- Full notices are bundled at `Contents/Resources/_up_/THIRD_PARTY_NOTICES.txt`.
- The versioned app launches as **Form Studio 0.5** at `tauri://localhost`, with the new controls present. The earlier 0.4 app bundle and session are preserved.

**Pending native check:** macOS locked when the Open dialog was requested. The app-control tool requires the user to unlock the Mac. The user has been asked; native v4/v5 open/save and export dialogs in this release have not yet been verified. Browser file round trips, browser export, and Rust file-operation tests passed as listed above.

## Compatibility evidence

`public/anatomy/human-v1.json` remains byte-for-byte identical to the previous release, SHA-256 `41c5f7ce45c8b4bdf5755be11223ac9aea9ece2b00182ca2bbe203a8f45acda7`. Frozen v4 validation rejects new model fields in a purported v4 file, and migration retains old body values without adding `model`. New v5 studies persist body sex, physique, anatomy opacity and independent arm poses.

The atlas and body provenance, regeneration steps and limitations are documented in [the detailed body update](detailed-body-update.md).
