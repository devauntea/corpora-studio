# Form Studio 0.3 verification — 2026-11-03

## Automated checks

All final checks passed on this Mac:

| Check | Result | Coverage |
| --- | --- | --- |
| `npm test` | 15 passed | Frozen v1 and v2 migration, unchanged original bytes, project validation/budgets, legacy circumference/seam invariants, history, photo references, HEIC preview integrity; v3 anatomy/cleanup persistence; background alpha; finite anatomy normals; identical rest UVs under pose/build changes; mirrored section bounds |
| `npm run test:e2e` | 10 passed | Five scenarios in both Chromium and WebKit: legacy editing/import/save/open/export; surface drag undo; photo masks/handles/locking; complete sections/muscle map/flex/chart round trip; image cleanup with pixel assertions, erase/restore, undo/redo, original comparison, transparent PNG and unchanged source SHA |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 4 passed, 1 intentionally ignored | Atomic replacement and failure preservation, supported v1/v2/v3 envelope, malformed HEIC. The ignored test reads private local HEIC reference files and was not rerun for this update |
| `npm run desktop:build` | Passed | TypeScript, Vite and macOS arm64 release bundle |

Total: **29 passing checks**, plus the one explicit private-file test exclusion. The existing Three.js chunk-size warning remains; there are no build failures. Automated screenshots are in the ignored `test-results/` directory. These tests are workflow and geometry checks, not a clinical validation or a GPU benchmark.

## Native packaged-app checks

The versioned app was launched independently while the user's existing 0.2.1 process remained running. The test process was closed after verification; the old process remained intact.

Verified through the actual Tauri UI at `tauri://localhost`:

- Bundled anatomical mesh loads under the production content-security policy. Complete arm, upper body, camera presets, muscle guide and 90-degree elbow flex render in the native WebKit view.
- A v3 study saves through the native Save dialog and opens through the native Open dialog. Saved pose, section, muscle-guide flag and source edits restore, and the app reports successful original-image integrity checks.
- Native review export produces an RGBA 1800 × 1800 PNG. The resulting image was visually inspected.
- Native image studio changes background cleanup, exports an RGBA 600 × 1000 transparent source PNG, records a physical pointer erase stroke, undoes it with Cmd+Z and redoes it with Shift+Cmd+Z. The applied project retains one erase stroke and unchanged source SHA; legacy paper removal is disabled after background cleanup.
- Cmd+Q while the image editor is open keeps the session alive and displays the instruction to apply or cancel pending image edits. The saved test session then closes normally.

Local native evidence (ignored, not shipped): `qa/F03 native verification.formstudio`, `qa/F03-native-review.png`, `qa/F03-native-clean-art.png`. The native source checksum was recomputed from the embedded original and matched. No supplied personal photos or reference artwork are in the release or tracked tests.

The native diagnostics showed a 95th-percentile animation-frame interval of about **18 ms over its rolling 600-frame window** during this simple one-layer session, with 93,410 rendered triangles reported for the upper body. This is an observed frame-interval sample, not a controlled benchmark, GPU timing, guarantee for large studies, or measured improvement over a prior release. Headless test timing is slower and is not treated as native performance evidence.

## Deliverable

- App: `releases/Form Studio 0.3.0.app` (8.82 MiB reported by the bundler)
- Executable SHA-256: `bc7b069578449b68c0dc5ec9b850df2d5790b4f74e3fc053e8224286e2fffc09`
- Pinned graphical asset source and checksums: `assets/anatomy/`
- Derived mesh: `public/anatomy/human-v1.json` (36,012 shared vertices; section-specific triangles)
- Converter: `scripts/build-anatomy.py` (Python standard library)

The app is a local macOS build, not a notarized public release. No Windows native test or whole-app/GPU memory qualification was performed. Anatomical accuracy, physical tattoo stretch, clinical muscle boundaries and stencil validity are not asserted. Remaining model and editor boundaries are listed in the update design and README.
