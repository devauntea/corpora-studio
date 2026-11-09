# Direct drawing, navigation and tattoo fit — 0.20.0

## Changes

- Removed the Anatomy-derived body collection from all model pickers. Its old IDs and files remain readable so existing saved work can reopen.
- Added **Draw on model (B)** with brush size, ink color and erasing. Mouse and pen strokes hit the visible tattoo-bearing mesh; missed hits split strokes, and section caps are excluded. Pressure changes pen width.
- Each completed stroke is one undoable change. Drawings are ordinary transparent PNG artwork layers and persist with the project, including a surface identity so renaming and reopening do not break the eraser. Erasing affects the generated drawing, not imported artwork or the model's original texture.
- Added **Pan view (H)**, lower orbit/zoom sensitivity, cursor-centered zoom and double-click focus. Scroll/pinch zoom and right-drag pan remain available during placement and drawing. **V** returns to orbit; **Fit model** restores the selected camera framing.
- Added **Inspect tattoo fit** on the viewport toolbar. The inspector reports mapping distortion and offers size reduction or repositioning when distortion is high.
- Expanded artwork width validation to 2400 mm to support full surface drawing charts. Older project versions keep their existing validation rules.
- Corrected sidebar flex shrinking so additional drawing layers do not overlap the import controls.

## Fit review

The automated render audit exercised all 19 active imported surfaces and 20 native pose/library combinations: male/female × fit/average × bent arm, bent leg, chest flex, back flex and double biceps. It produced screenshots and numeric mapping results under `qa/body-020/production/`.

Connected tattoo triangles follow the current surface geometry (the existing 0.08 mm normal offset avoids depth flicker). Saved anchor identity survives the tested pose changes. Direct drawings use the mesh's rest-coordinate charts, so their textures deform with it.

**This does not establish realistic skin biomechanics or perfect placement everywhere.** The hand sculpt, some posed leg imports and bent native knees showed high mapping distortion at the tested artwork size and location. The fit inspector now calls attention to this. Smaller designs and better placement can help, but cannot repair inaccurate underlying anatomy or joint deformation.

In the final 39-case sample, 22 placements exceeded 25% p95 mapping error, and 16 had folded triangles omitted. These results are a record of limitations, not a passing quality score.

The audit uses one sample artwork at selected locations, not an exhaustive inspection of every skin point. Its statistics cover mapped artwork bounds, including transparent margins. They describe parameterization distortion, not measured biological skin strain. Imported models remain in their authored static poses. Direct drawing uses the existing cylindrical surface charts; complex fingers, concave areas and chart boundaries can still distort or overlap, and need improved UV layouts for uniformly precise painting.

## Verification

All 683 unit tests and six production WebKit scenarios passed. These functional checks cover removal from the picker; drawing, erasing, undo, save/open and renamed-layer erasing; navigation while editing; persistent model/tattoo orientation; the 39-case fit audit; and existing flex/anchor preservation.

The desktop release is locally signed for local use, not notarized. Native save/open dialogs were not re-tested in this change; browser save/open and the packaged build are separate checks.
