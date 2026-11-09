# Editing and recovery update — 0.8

## Tattoo preparation

The source editor now stores a local processing recipe: original tones, solid stencil or contour line art; threshold / local illumination option; contour detail; noise smoothing; sharpening; and transparent paper. Conversion operates on a derived canvas. Original data and its SHA-256 remain unchanged. Erase and restore still edit the separate mask; restore does not recreate paper intentionally removed by stencil conversion. Preview uses up to 2048 px and PNG export up to 4096 px. Edge detection is resolution dependent, so inspect export output before printing.

The contour pipeline uses separable Gaussian filtering, Sobel gradients, directional suppression and connected hysteresis. Stencil conversion uses global or local-mean thresholding. These are deterministic image operations, not an AI image service. Algorithm references: [OpenCV Canny tutorial](https://docs.opencv.org/4.13.0/da/d22/tutorial_py_canny.html) and [thresholding tutorial](https://docs.opencv.org/4.13.0/d7/d4d/tutorial_py_thresholding.html). No OpenCV code or binary is bundled.

Photo corner warping stores four local normalized corners. A convexity check prevents folded / collapsed quads. Inverse projective sampling with premultiplied-alpha interpolation creates the derived image. Flip, rotate, shear, scale, layer opacity and blend remain composable. Body protection is applied afterward in photograph coordinates, so moving or warping the design cannot move the protection mask. Reference: [OpenCV geometric transforms](https://docs.opencv.org/4.13.0/da/d54/group__imgproc__transform.html). This is perspective placement, not reconstruction of body curvature.

## Manual fashion construction

Pieces can detach from the parametric Teagan draft. Detachment preserves stitching geometry and rebuilds the cutting boundary with bounded miter joins. Corner construction can differ from Teagan's original allowance by a few millimeters; the stitching line is unchanged. Manual pieces keep their own shape and allowances when measurements or fit settings change. Restore measurement draft reconnects the selected piece and can be undone.

The editor supports anchors, cubic control handles, exact de Casteljau segment splitting, conversion between line/curve, anchor removal, per-edge allowances, single/double matching marks and editable grainlines. Dart triangles are construction markings; they do not automatically rebalance seam lengths or perform dart transfer. Notches track their associated curve parameter when the edge is reshaped or split. Inspect matching seam lengths after editing; the manual editor does not guarantee seam pairing or neckband fit.

Cut outlines flatten cubic segments to a 0.1 mm geometric tolerance, use 0.001 mm integer precision, and union outward edge strips and joins with [Clipper 6.4.2](https://github.com/junmer/clipper-lib). Self-crossing boundaries and ambiguous allowance output are rejected, preserving the last valid edit. No allowance is required at a fold edge; hem edges may use their own value. Manual seams, cutlines, marks and guides feed both vector SVG and tiled PDF exports.

## Local copies and checkpoints

A changed project writes a local recovery copy after 1.2 seconds of inactivity. Writes are serialized and both metadata and content update in one IndexedDB transaction. A 400 MB UTF-16 content budget prevents unbounded storage; errors surface in the app and do not modify saved project files. Local copies are never automatically evicted. Named checkpoints use separate records. Opening an old checkpoint does not overwrite the latest recovery copy unless the user edits it.

The library is app-local storage, not a portable backup. Save a .formstudio file to keep a copy outside the app. Source images are never uploaded. A crash before the debounce completes can lose the last unsaved gesture; un-applied image-studio edits are not in project recovery. Native close protection still requires applying/canceling image edits and saving/discarding the project.

## Format and licensing

Format 8 adds optional processing, photo warp and manual construction recipes. Frozen v7 and fashion-v7 schemas validate old files before migration. v1–v7 source bytes, placements and geometry revisions retain their semantics. Native envelopes accept v8; migrating clears the destination and saves a new v8 copy.

Clipper uses the Boost Software License with Tom Wu JSBN attribution. Full upstream notices are retained in vendor/clipper and included by the dependency-notice generator. No paid reference models, external model checkpoints or user reference images are bundled.
