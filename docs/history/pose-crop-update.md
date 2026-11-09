# Form Studio 0.4 — independent arm poses and nondestructive crop

## Behavior

The complete arm and upper-body templates now support shoulder elevation (0–120°), forearm rotation (−90–90°) and elbow flex (0–110°). For an upper body, select **Pose left arm** or **Pose right arm**; changing one preserves the other. Relaxed resets all three values on the selected arm. Bent 90° changes that elbow only. The existing knee control remains unchanged. Fit model and the four camera presets now frame the actual posed bounds with padding, including raised arms, rather than estimating framing from section length.

The tattoo image studio adds a crop frame with corner handles, drag-to-move, drag-to-redraw, and accessible trim sliders. Finish crop returns to the cropped editing preview; Reset crop restores the entire source while keeping cleanup strokes. Brush edits remain attached to original-image coordinates, both before and after cropping. Original comparison always shows the full original image. PNG export uses the cropped dimensions, limited to 4096 pixels on its longest edge without upscaling source pixels.

Applying a crop changes every instance of that source. Each instance retains its center, width, rotation, stretch and opacity; its height follows the cropped aspect ratio. This behavior is consistent in 3D surface painting, photo compositing, hit testing and photo selection handles. Source dimensions, bytes and SHA-256 remain untouched.

Continuous tolerance, edge-softness, contrast and crop-trim slider gestures are grouped into one local undo operation. Cropping is also one undo step per drag. Image zoom now scales the canvas relative to the available editor area, including small source images; resizing the window updates Fit automatically. Enlarging the preview does not increase export resolution.

## Implementation and compatibility

No dependency, downloaded asset or service was added. The existing joint weights drive lower-arm axial rotation, then elbow bending, then shoulder elevation from the existing relaxed pose. Left/right directions are mirrored, while rest-space UVs remain fixed. The old `flex` field remains the fallback when per-arm poses are absent, preserving the simultaneous arm poses in v3 studies.

The project format is v4. A frozen v3 schema validates old studies before migration, alongside the existing v1/v2 readers. Opening an older project clears the writable path so the next Save creates a new copy. Earlier apps reject v4 files rather than silently dropping poses or crops.

Crop recipes store normalized bounds in the source. Bounds round once to original pixel edges; rendering draws directly from that source rectangle before applying the existing color key, tone and masks. Brush points and radii retain source coordinates. The cropped aspect ratio is shared by all placement/rendering paths. The 2048-pixel preview cap and original-image budgets still apply. Crops must remain within the image and span at least 1% per axis; narrow crops still provide a minimum one-pixel output.

## Limits

Poses are weighted skin-mesh approximations, not a muscle contraction, scapular motion or tissue-strain simulation. Large shoulder angles and combinations of elbow flex and twist can show deformation artifacts. The muscle overlay remains schematic. The app still uses one adult masculine base shape, separate trunk/arm charts, and nominal dimensions; no new body reconstruction or seamless cross-chart painting was introduced.

Perspective correction, AI subject segmentation, additional body templates, autosave/recovery and the separate portfolio website remain future work. The app is a local macOS Apple Silicon build and is not notarized for public distribution.
