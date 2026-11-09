# Form Studio — expanded tattoo planning

Decision and implementation record, 3 November 2026. Milestone F02 extends the existing application; it does not complete the entire advanced-platform brief. The desktop application remains the editing product. A future website will display chosen finished exports.

## Audit of the starting application

The audited baseline is commit `7bc7cde`, following the F01 implementation. There were no uncommitted source changes. The stack remains Rust/Tauri 2, React/TypeScript and Three.js; no additional runtime package or hosted service was needed.

| Existing area | Finding | F02 treatment |
| --- | --- | --- |
| Document model | Strict v1 JSON, original embedded PNG/JPEG data, SHA-256, stable UUIDs | Freeze the v1 reader; validate before migrating to v2 in memory |
| Forearm | 128 × 96 segments; perimeter arc-length mapping; millimeter placement | Preserve the `forearm-v1` equations and measurement semantics |
| Rendering | A 2048² texture atlas, periodic wrap copies, Three.js orbit/raycast | Retain atlas size; share image processing with photo mode |
| History | Immutable snapshots, 100-command bound, grouped gestures | Reuse for photos, masks, geometry, ink and transforms |
| Native persistence | File-dialog destination allowlist; atomic replacement; dirty/quit guards | Keep protections; accept both format versions |
| Image limits | 24 sources/layers, 15 MB/source, 8192 per dimension, 32 MP/image, 64 MP/project, 70 MB image data, 80 MB file | Retain; HEIC originals and previews both count toward encoded-data budget |
| Artwork editing | Original bytes separate from processed paper/black previews | Extend derived previews; never bake edits into original data |
| Tests | Domain, Rust storage and Chromium/WebKit workflows | Add old-file fixture, new geometry/schema and photo workflow coverage |
| Gaps | Forearm only; no photo composition, masks, extended ink, reconstruction or connected body | Address the first four in a bounded milestone; sequence the others below |

The original implementation stored `wrist` and `elbow` as forearm circumferences. New templates use `distal` and `proximal`, with region-specific labels. These values are not reinterpreted in legacy files. Existing layer width/rotation/perimeter semantics remain unchanged.

## Research and product decisions

### Composition around anatomy and existing pieces

Tattooing 101's practitioner teaching recommends working from a photo or tracing of the actual placement area, particularly for gaps between existing pieces. It describes following the body's directional curves and using background elements to connect designs. Form Studio therefore adds photo composition and a photo-anchored protection mask before attempting automatic reconstruction. The mask keeps new ink out of existing pieces and preserves deliberate skin gaps. It is manually painted; it does not identify tattoos automatically. [Body flow and photo tracing](https://tattooing101.com/learn/guides/how-to-draw-tattoo-designs/)

Their design guidance treats negative space and readable detail as composition decisions affected by available area. Our implication is to support reversible placement and comparison, not automatically fill every visible gap or claim that a dense preview will remain legible on skin. [Design techniques](https://tattooing101.com/learn/design/)

Their placement examples also show why a design may need restructuring when moved between a broad area and a narrow wrapping area. F02 retains a continuous wrap for each template, separate photo placements for each angle, and explicit warnings about local distortion. A sleeve is a future connected-surface problem; a longer forearm is not presented as a completed sleeve. [Placement and redesign](https://tattooing101.com/learn/guides/tattoo-placement-guide/)

### Professional digital editing

Procreate's 3D transform interface provides uniform and independent scaling, flipping, rotation and surface attachment; it also groups transform operations into undo steps. Those interaction principles inform F02's photo handles, shared flips/stretch and gesture history. Its projection settings demonstrate that projection depth and back-facing surfaces require explicit control. F02 keeps its existing UV-bound 3D placement rather than introducing an unqualified projector that can print through a body. [Procreate 3D Transform](https://help.procreate.com/procreate/handbook/5.4/3d-painting/transform)

Procreate's Warp tool uses a mesh with adjustable control points. F02 implements only affine shear in photo coordinates, plus rotation and independent height scaling. It is useful for simple visual adaptation but is not mesh warp or perspective reconstruction. Local mesh warp is a later milestone with foldover and export tests. [Procreate Warp](https://help.procreate.com/procreate/handbook/5.3/transform/transform-warp)

Adobe documents layer masks as reversible visibility changes, and nondestructive adjustments as a way to preserve source pixels. F02 follows that separation: the photograph, artwork, transform parameters, appearance parameters and protection strokes remain independent. Repeated transformations are rendered from the same source, avoiding a chain of destructive raster edits. The protection mask is attached to the photo rather than an artwork layer because it represents areas of the body that all new designs must avoid. [Layer mask editing](https://helpx.adobe.com/photoshop/desktop/create-masks/layer-masks/edit-and-refine-layer-masks.html), [Nondestructive editing](https://helpx.adobe.com/photoshop/desktop/create-manage-layers/create-layer-compositions/non-destructive-editing-techniques.html)

Linework, shading and transfer preparation should remain separate stages. F02 supplies black, grayscale, soft gray, color, custom color and threshold studies, with paper removal, opacity, contrast and saturation. These are compositing operations, not simulations of needle depth, healing, scattering or calibrated skin response. Threshold output is a consultation study and is labeled as not being a validated stencil. A proper future transfer workflow needs scale calibration, artist-approved line selection, print-scale checks and tile alignment.

### Photo-assisted modeling research

SMPL-X describes fitting a parametric articulated human model to image features, including pose priors and interpenetration handling. This is a plausible later foundation for connected bodies, but it is a statistical fit and not a guarantee of personal dimensions. The project explicitly distinguishes research access and commercial licensing. F02 does not download or bundle these model assets. License and redistribution qualification must precede any commercial integration. [SMPL-X project and paper](https://smpl-x.is.tue.mpg.de/)

MediaPipe Pose Landmarker produces an estimated set of 33 body landmarks and optional segmentation. It could initialize pose and silhouette fitting, but those outputs are not a dense measured skin surface. Our inference is that cropped back photographs will need manual landmarks and rejection/fallback paths; landmarks cannot supply unseen circumferences or detailed shoulder geometry reliably. [MediaPipe task specification](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker)

The supplied photos show an overall back view and a closer view of existing ink, with different framing and pose. They are useful local placement references. F02 does not estimate personal measurements from them. There is no automated reconstruction or claimed metric calibration in this release.

A focused next prototype should optimize a licensed or authored template against manually confirmed landmarks, silhouettes and entered measurements. Separate camera scale/focal assumptions from body shape; penalize excessive deformation; display fit residuals and missing evidence. Add a detector only after it improves a manually labeled evaluation set. Test multi-angle consistency and repeatability before presenting a photo-assisted result. Video capture, segmentation and multi-view fitting remain optional local worker jobs, with cancellation, explicit resource limits and no default upload.

## Priorities and delivered scope

| Priority | Capability | F02 status |
| --- | --- | --- |
| 1 | Photo composition around existing tattoos | Implemented: multiple photos, shared source library, independent placements, protective brush masks, original/composition comparison, PNG review export |
| 2 | Flexible editing without damaging sources | Implemented: move/scale/rotate photo handles; keyboard nudges; flips; height stretch; affine shear; center alignment; lock/duplicate/order/visibility; shared ink controls |
| 3 | More 3D surfaces | Implemented: original forearm plus upper-arm, calf, thigh and torso blockout templates, circumference/length/depth/contour controls |
| 4 | Reliable local documents | Implemented: v1 import, v2 portability, exact original image preservation, macOS HEIC conversion with independent preview integrity |
| 5 | Photo-assisted 3D fitting | Designed/researched; not implemented |
| 6 | Connected sleeves, shoulders, neck, legs and full body | Deferred until topology, articulation and multi-chart placement are verified |
| 7 | Freeform artwork refinement | Threshold/contrast/paper controls now; crop, local mesh warp, layer masks, drawing/erase, outlines, grouping and saved variations later |
| 8 | Delivery and recovery | Current Mac build tested; Windows, autosave/recovery and broader hardware qualification still required |

## Technical design

### Document and migration

Version 2 adds a discriminated body union, photo records and optional per-layer extensions. An unextended layer uses the old ink and transform defaults. Each photo references one embedded body source and an array of normalized protection strokes. Photo layers reference a photo ID and have separate normalized X/Y/width/shear fields; their old millimeter fields do not become pixel values. Assets remain shared across layers and modes.

Opening a v1 document validates the frozen schema first, then adds only `version: 2` and `photos: []`. Its original source data, IDs, measurements and placements remain unchanged. The app clears the save destination when migrating a v1 file, so Save prompts for a new v2 copy; the existing file is not silently overwritten. Old app versions cannot open v2 documents. The new app can open both versions. No private references are bundled in the app or committed as tests.

HEIC import runs locally in a blocking Rust worker using macOS `/usr/bin/sips`, with fixed command arguments and a temporary directory. It checks file/header, dimensions and output size. The unchanged HEIC and a full-size PNG preview each have SHA-256 checks. Non-Mac HEIC import is explicitly unsupported; an already embedded PNG preview is portable. PNG/JPEG import remains unchanged. No machine-learning dependency is introduced.

### Geometry

The original forearm path is preserved. New regions use closed, smooth cross sections with an arc-length lookup and circumference normalization. Length, end circumferences, depth and contour strength affect vertices. Torso contours suggest paired anterior/back masses and a spinal groove; they are authored approximations. They have no shoulders, arms, neck attachments, joint bends or verified anatomical landmarks.

Placement remains attached through UV coordinates during camera and measurement changes. The 2048² atlas, 128 perimeter segments and 96 longitudinal segments are unchanged. Width is locally measured in the chart at the layer center; stretching away from that center is not eliminated. F02 has no guarantee of uniform physical scale over large distorted patches. Future connected surfaces should use stable mesh IDs, barycentric surface anchors, per-chart seam adjacency and distortion visualization; a geodesic or locally optimized parameterization must be compared against the current chart before replacement.

### Photo composition and history

The preview fits inside the available viewport and renders at up to 2048 pixels on its longest edge. Photo export renders up to 4000 pixels on its longest edge, then adds a 100-pixel explanatory footer. Artwork processing is capped at 2048 per edge. Exports are review images, not source-resolution production masters.

All gestures render from original images. Protection strokes use normalized photo coordinates and do not move when an artwork layer is moved, flipped or resized. They remove new ink only. Undo can restore a cleared mask. Each photo supports 200 strokes, each stroke 2000 points, with 80,000 points across the project. There are at most eight photos within the unchanged 24-source budget. The surface renderer pauses while photo mode is active. Derived variants and decoded images are disposable caches.

### UI design

Keep the muted natural palette, central canvas and source/layer library. A small mode switch changes the central view. Photo thumbnails select an independent composition angle. Contextual transform fields use percentages for photos and millimeters/perimeter coordinates for surfaces. A single photo toolbar switches between placement, protection and original comparison. Ink controls remain per-layer. More advanced features should enter collapsible inspector groups rather than accumulate permanent toolbars.

Next UX work: zoom/pan for high-detail photo masking, mask reveal/erase and feathering, direct 3D handles, snapping guides, named variations and layer groups. New template selection currently changes the shared 3D surface while retaining its layers; undo restores the previous template and placement state.

## Roadmap and acceptance gates

1. **F02 — photo planning and region templates (this release):** old-file restoration; unchanged source hashes; mask pixel preservation; transform/undo; region circumference/seam tests; native save/open/export and HEIC checks.
2. **F03 — precision editing:** local mesh warp, editable protection/brush masks, crop, drawing guides, groups, saved variations and photo zoom. Gate on inverse transforms, no foldover by default, resolution-independent masks and deterministic export.
3. **F04 — connected anatomy:** authored shoulder/arm and hip/leg topology with joint landmarks, articulated pose and multi-chart placement. Gate on seam continuity, surface attachment, stress maps and artist-reviewed flow across poses.
4. **F05 — photo-assisted fitting prototype:** user-confirmed landmarks, licensed/owned template, camera assumptions, measurement constraints and residual display. Gate on a consented evaluation set with independent measurements, uncertainty reporting and fallback for insufficient evidence.
5. **F06 — workflow hardening:** autosave/recovery, bounded worker cancellation, large-project profiling, Windows qualification and accessible direct-manipulation controls. Add calibrated print/stencil exports only with a separately verified physical-scale workflow.
6. **Portfolio:** publish user-selected finished reviews and process stories. The site remains a showcase; it will not receive personal source photos or projects automatically.

See [F02 verification](advanced-verification.md) for executed checks and remaining limits.
