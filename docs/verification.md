# F01 verification record

Date: 2026-11-03. Hardware: Apple M4 MacBook Air, 16 GB RAM, Apple silicon. Xcode 26.6. Node 24.7.0. Rust 1.99.1. Native release and browser UI checks are recorded separately below.

## Automated checks

- Seven domain tests cover schema rejection, corrupt asset rejection, portable project round trip, seam position/normal continuity at 97 cross-sections, numerical circumference measurement, physical chart scale, 20 mixed edits through undo/redo and a save boundary, and grouped drag behavior with redo invalidation.
- Three Rust tests cover complete atomic replacement, failure cleanup while preserving the prior destination's data, and unsupported project envelopes.
- End-to-end tests run in Chromium and WebKit. They exercise measurement editing, undo/redo, project download/reopen, invalid-file recovery without losing the current composition, generated artwork import, seam placement, 1800 × 1800 export, unsaved-change cancellation, surface dragging, and camera presets. They collect uncaught page errors and external HTTP requests for the main workflow.
- TypeScript compilation and the Vite production bundle are required before the native build.

An initial concurrent Chromium run exceeded the 5-second startup assertion while Rust release compilation and multiple renderers were running. The test runner was changed to one worker and a 15-second UI readiness assertion. Performance numbers from that loaded run (including 100–400 ms frame intervals) are not steady-state native benchmarks.

## Native checks and performance

The local release application was launched through its macOS app bundle and inspected visually and through accessibility state. The delivered copy is `releases/Form Studio.app` (about 8.06 MiB). It runs at `tauri://localhost`, without a development-server dependency.

| Native check | Observed result |
| --- | --- |
| Numeric edit and Save | Width changed from 95 to 112 mm; native Save wrote `qa/Native verification.formstudio`; saved bytes contained width 112 and rotation 0 |
| Save As cancellation | Native dialog canceled; composition and Saved status preserved |
| Close with unsaved changes | Rotation changed to 15 degrees; window close showed Save / Discard / Cancel; Cancel retained the edit; Discard closed the test app |
| Reopen after process exit | Native Open loaded the saved file, restored width 112 / rotation 0, and passed artwork integrity checks |
| Native review export | Save dialog wrote `qa/Solar study-review.png`; PNG header verified at 1800 × 1800; image visually inspected with approximation label intact |
| Command-Q | The default macOS predefined Quit action initially bypassed protection. It was replaced with an explicit menu command. Final build showed the unsaved-changes dialog on Command-Q; Cancel returned to the document |
| Native Command-Z | Restored rotation 0 and the clean state after the quit test |
| JPEG import | Imported the user-provided `IMG_8035.jpg` through the native image picker; created the layer and source-library entry; Undo restored the starter composition. The reference was not saved into the repository or bundled application |
| Packaged layout | Native workspace visually inspected; 3D surface, artwork, controls, labels, and diagnostics rendered successfully |

Native diagnostic samples on this M4 MacBook Air reported **18–21 ms p95 frame intervals**, each over the latest 600 frames, for the single-layer forearm scene. The final release copy reported 18.0 ms / 600 frames / 49,538 rendered triangles. This meets the 33 ms target for this measured scene. The window was approximately 1440 × 900 logical pixels with device-pixel ratio capped at 2, a 2048² atlas, and shadows enabled. Measurements include normal viewing and occasional UI interaction, not a stress test of 24 layers or continuous editing. These are requestAnimationFrame intervals, not GPU timer-query measurements. Maximum-load performance remains unqualified.

Final results: **7 domain tests, 3 Rust tests, and 4 browser end-to-end runs passed**; TypeScript and native release build passed. `npm audit --omit=dev` reported zero known npm runtime vulnerabilities at the time of this check; this is not a Rust dependency audit or comprehensive security review. The large Three.js bundle warning is expected for this local graphics application.

Local QA artifacts are ignored by Git. The default study is original artwork authored in code. No user reference file was modified.

## Limits of this evidence

No body reconstruction, photo-to-pattern inference, sewing fit, calibrated skin rendering, physical stencil accuracy, Windows native behavior, signing/notarization, or production distribution was tested or claimed. Unit measurements validate this procedural model's conventions, not anatomical accuracy. Browser request observation plus production CSP is evidence about this workflow, not a general security audit. Protection was verified for the window close button and the application Quit/Command-Q command; Dock Quit, OS shutdown, force quit, and crash recovery are not qualified. Save explicitly before leaving; there is no autosave yet.
