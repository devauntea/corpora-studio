# Form Studio 0.4 verification — 2026-11-03

## Automated checks

| Check                                             | Result                            | Coverage                                                                                                                                                                                                                                            |
| ------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                                        | 19 passed                         | Project integrity, v1/v2/v3 migrations, original bytes, legacy geometry and history; stable human UVs, finite normals, independent arm geometry, cropped dimensions and placement aspect, bounded recipes, camera-fit bounds in every preset        |
| `npm run test:e2e`                                | 12 passed                         | Six scenarios in Chromium and WebKit: legacy study round trips and drags; photo composition/masks/handles; independent arm poses; image cleanup; crop, zoom, alpha pixels, export dimensions, grouped undo, photo proportions and unchanged sources |
| Focused final Playwright run                      | 6 passed                          | All anatomy/cleanup/crop scenarios in both engines after the final immediate camera render and minimum crop-bound adjustment; includes extreme trim undo                                                                                            |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 4 passed, 1 intentionally ignored | Atomic replacement, failed-save preservation, v1–v4 envelope and invalid HEIC; private local HEIC fixtures remain intentionally excluded                                                                                                            |
| `npm run desktop:build`                           | Passed                            | TypeScript, Vite and macOS arm64 release bundle                                                                                                                                                                                                     |
| `git diff --check`                                | Passed                            | Patch whitespace                                                                                                                                                                                                                                    |

There are **35 distinct passing automated checks** (19 unit + 12 workflow + 4 native Rust), plus the focused six-scenario rerun. The existing Three.js bundle-size warning remains. Headless test frame intervals are not a performance qualification. No new runtime dependency or external asset was added.

## Native packaged-app checks

Verified in `releases/Form Studio 0.4.0.app` at `tauri://localhost`, after the user unlocked the Mac:

- Bundled human geometry loads. The v3 native verification study opens with its upper-body section, muscle guide, 90° elbow poses and previous image cleanup intact. The app announces a new v4 copy on Save rather than overwriting the v3 file.
- Left shoulder elevation of 65° and forearm rotation of −45° work; selecting the right arm still shows 0° elevation and rotation with its original 90° elbow. Fit frames both arms. The actual native view was inspected.
- Crop-trim sliders change a 600 × 1000 source to 303 × 505. Cmd+Z restores the previous crop; Shift+Cmd+Z restores the change. A native PNG export has the exact 303 × 505 dimensions and was visually inspected.
- Save produces `qa/F04 native verification.formstudio` with version 4, independent arm settings, and the crop recipe. Comparing its embedded source and cleanup strokes to the v3 file confirms both remain unchanged.
- Reopening the v4 file restores the 65° shoulder, −45° forearm rotation, 303 × 505 crop and white-paper cleanup. The app reports successful original-image integrity checks.

The study present before testing was first saved to `qa/F04 precheck study.formstudio` and reopened at the end. The new app remains open on that preserved study. The user's existing 0.2.1 and 0.3.0 app sessions were not closed or overwritten. QA files are ignored and are not part of the shipped assets.

## Bundle integrity

The copied versioned app was locally ad-hoc signed, then passed `codesign --verify --deep --strict`. Its Info.plist reports version 0.4.0. This local integrity signature does not provide notarization or public-distribution signing.

Executable SHA-256 after signing:

`faded0628547b973e4217445d19ce33f2643db4f6faa861490f2c79a3b655f81`

The Tauri bundler reports approximately 8.82 MiB before local signing. For future local copies, sign the completed app bundle before launch; never replace or re-sign a running app. Keep earlier versions separate.

## Remaining limits

The muscle overlay and weighted poses remain approximations; large compound rotations can show joint and shoulder artifacts. There is no muscle-contraction/skin-strain simulation, new body template, seamless cross-chart painting, automatic photo reconstruction, perspective correction or crash recovery in this update. Windows and public distribution are not qualified.
