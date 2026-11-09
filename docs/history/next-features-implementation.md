# Next features — implementation record (0.9)

The scope follows `next-features-research.md`. Its research suggestions are references, not instructions to bundle every listed dependency. The desktop remains the editor; portfolio output is a separate static gallery.

| Area | Implemented software | Evaluation still needed |
| --- | --- | --- |
| Garment catalog | Generic FreeSewing adapter; Teagan, Brian, Titan, Sarah, Simon; required inputs and design options; reusable project/device profiles; JSON and SMIS interchange; nested independently drafted size series; grade CSV; fabric records and ease warnings; formula-linked construction points and curves; custom pieces | Sew and measure representative sizes before production use |
| Garment photographs | Local flat-lay import; four-corner planar calibration; editable pointer/keyboard endpoints; multipliers and explicit ease; hidden-construction notes; apply selected draft inputs; tape/error CSV | Tape versus photo benchmark on 10–20 actual garments; no automatic hidden-pattern reconstruction |
| Cloth | Pattern triangulation, unfolding, panel transforms, selectable stitch ranges, pins, body collider, bounded XPBD worker, material controls, review/report export; 500 mm square cylinder benchmark and physical-observation entry | Physical fabric calibration, sewn toile, self-contact and precision-fit qualification |
| Body coverage | Versioned full body (neck down) and neck models; fit/average male/female surfaces; colored muscle guide; connected exponential-map placements; Jacobian stretch inspection | Qualified anatomy review; the models are artistic approximations, not scans |
| Personal fitting | Two local photographs, manual/keyboard landmarks, known height, optional tape measures; six local torso scale parameters on MakeHuman-derived geometry; local optimization; per-input residuals and CSV; saved fit | Real-person tape/scan benchmark; no automated reconstruction or promise of anatomical accuracy |
| Artwork | Pressure strokes and drawing eraser; original-image preservation; groups with visibility/lock/opacity; nine-point photo lattice with fold rejection; checkpoint side-by-side/swipe comparison | Native assistive-technology and stylus hardware review |
| Stencils | Centerline tracing; contour inclusion; physical line width; mirrored PDF/PNG; true-size tiled pages; DPI metadata; named per-printer XY correction and 50 mm calibration sheet | Real printer/paper/ruler checks and artist acceptance |
| Platform | Two-worker bounded queue, cancellation/timeouts/resource limits; keyboard numeric alternatives and focus return; automated accessibility checks; native portfolio ZIP save; separate static gallery; macOS/Windows qualification and signing workflows | Actual Windows/WebView2 execution, Apple credentials/notarization, physical VoiceOver review |

## Compute and licensing choices

The shipped app has no Python or Blender runtime. Image processing, stencil tracing, surface parameterization, body fitting, cloth and ZIP jobs run in local Web Workers (two concurrent, bounded queue, 60-second job timeout). Geometry limits and import/file limits remain enforced. Pattern drafting stays in the existing TypeScript engine.

The body fitter is an independently implemented bounded coordinate-descent optimizer over authored width/depth fields on existing CC0 MakeHuman-derived meshes. It does **not** bundle Anny, its reported fitting accuracy, SMPL/SMPL-X, MediaPipe or Meta models. Front/side landmarks supply silhouette spans, with optional circumference targets from a closed convex tape path. Only torso width/depth around three levels are fitted. Arms, face and unseen anatomy are not recovered. Changing sex, model revision or muscularity clears the applied local fit; source study and its residuals remain available for refitting.

The cloth solver is our own TypeScript implementation of XPBD-style distance and sewing constraints. Opposite triangle vertices provide a simple bending approximation. Mesh sampling avoids tiny curve edges; seam ranges are matched by direction, with gradual sewing and unique vertex pairing. The preview lacks cloth self-collision, anisotropic measured textile mechanics and robust continuous contact. It reports edge strain and stitch gaps and labels every report unvalidated. A separate, unbundled Blender experiment reduced a synthetic 80 mm sewing gap to 0.71 mm mean / 2.37 mm maximum; this is a numerical prototype, not a physical garment experiment.

Sources: [XPBD paper](https://matthias-research.github.io/pages/publications/XPBD.pdf), [discrete exponential maps](https://cindygr.github.io/files/sig2006tm.pdf), [FreeSewing](https://freesewing.eu/designs). New runtime packages are MIT except Delaunator (ISC); the dependency inventory records installed versions. No GPL application code or paywalled size tables were copied. Sample measurements are synthetic, not borrowed curated-person datasets. Registered Z-Anatomy fields retain CC BY-SA attribution and source metadata.

## Document compatibility and privacy

Document format 9 validates older formats before migration. Old versioned body assets are retained so saved placements keep their geometry. New full-body and neck sections require revision 4. Connected placement anchors are invalidated when changing incompatible meshes. Body studies, garment studies, drawing, groups, formulas, fabric, grading and drape setup survive save/open. Simulations are recomputed from saved setup rather than storing huge transient buffers.

Fitting and garment photos remain local document assets. Portfolio export excludes body-photo mockups by default and includes only selected flattened images and display metadata. It has no editable project, separate raw source images, or standalone measurement tables. Exported pixels can still reveal private content, so the export screen shows exactly what will be shared. ZIP export itself never uploads. The initial hosted showcase contains only the original generated demonstration art and synthetic pattern study.

## Rebuilding the full body assets

Run `python3 scripts/build-detailed-anatomy.py --full-body`, the atlas bake with Blender `--background --disable-autoexec` and `--full-body`, then `python3 scripts/refine-body-surfaces.py --full-body`. Intermediate revision-4 bases live in `.tools/anatomy`; only final revision-4 assets go in `public/anatomy`. Default script mode preserves the earlier v2/v3 pipeline. Source provenance and SHA-256 records are in `assets/anatomy/`.

## Distribution

Local Mac builds use ad-hoc signing. A valid ad-hoc signature is **not notarization**. `scripts/signing-preflight.mjs` reports credential presence without revealing values. This machine currently has neither Developer ID signing nor notarization credentials configured.

`.github/workflows/desktop-qualification.yml` runs browser/unit/native tests and builds unsigned Mac/Windows artifacts. The signed workflows are manual dispatches in the `desktop-release` environment. The macOS workflow requires Developer ID and Apple notarization credentials. The Windows workflow imports a PFX temporarily, builds with its thumbprint, removes it, and verifies Authenticode. For hardware/cloud signing, `scripts/windows-release.mjs` also accepts `WINDOWS_SIGN_COMMAND`; credentials belong in the signing tool's environment, never inline in that command. These workflows have been authored, not executed on a remote runner during this task.

References: [Tauri macOS signing](https://v2.tauri.app/distribute/sign/macos/), [Tauri Windows signing](https://v2.tauri.app/distribute/sign/windows/).
