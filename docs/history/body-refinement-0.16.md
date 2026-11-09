# Body refinement — Form Studio 0.16.0

6 November 2026. This pass builds on the existing revision 7 rig and surface work using the locally available Blender 4.5.9 LTS, MakeHuman graphical assets, Z-Anatomy muscles and original code. No purchases, paid services or reference-image textures were used.

## Delivered

- **52 visible muscle regions.** The previous 36-group atlas merged several distinct structures. Revision 8 projects 56 source objects (left/right) into 28 new labels for individual deltoid, biceps, triceps, trapezius, hamstring, gastrocnemius, adductor, fibularis, gluteal, erector and wrist-extensor parts. Existing quadriceps categories remain. The hover name, flow description, legend and color shader understand the new labels. Flex correctives still use each label's parent muscle.
- **Rebuilt fit-male chest.** The old lower-pectoral shelf was above the nipple and created an unnatural profile. An authored depth contour replaces that region, followed by Blender's weighted depth-only Smooth modifier. The final maximum change from r7 is 30.34 mm, confined to the male chest; 95% of fit-male vertices move less than 0.60 mm. Female fit changes stay below 1.27 mm and preserve the existing breast form.
- **Finer surface separation.** Source-projected head boundaries replace the analytical head-groove layer. Border relief is restrained to avoid treating every colored region as a raised lump. Existing bony landmarks and the r7 centers-of-rotation deformation remain.
- **Original skin microdetail.** A seamless 1024×1024 packed height/roughness/cavity tile generated with NumPy and Blender spans 48 mm of skin. Rest-space triplanar sampling follows posing without using or changing tattoo UVs. Height ranges from −0.035 to +0.020 mm. Appearance-only elbow and posterior-knee creases strengthen with joint angle. The anatomy guide's fiber bump was reduced to avoid exaggerated ridges.
- **Compatible upgrades.** New studies use body revision 8. Old studies retain their original revision and appearance. The explicit upgrade from revisions 5–7 retains connected tattoo anchors and charts, and Undo restores the old body. Project format 16 adds revision 8; the frozen format-15 validator rejects r8 data masquerading as an older file.
- **Reliable close-up inspection.** Zoom buttons now invalidate the rendered frame, and the skin tile loads before the first body frame. Migrated format-15 files save to a new format-16 copy.

The original vertex order, triangle indices, rig weights, cut boundaries, bone data and chart identity are preserved. This is a surface refinement, not a topology replacement. Male/female and average/fit remain available across the existing body sections.

## Inspect the result

- App: `releases/Form Studio 0.16.0.app`.
- [Matched before/after gallery](../../qa/body-017/comparison/index.html): 24 pairs, with front/back/profile, arms, legs, average torsos, 110° bends and double-biceps poses. The capture uses the same arm-pose preset as the UI.
- [Render settings and errors](../../qa/body-017/comparison/report.json).
- [Final geometry measurements](../../qa/body-017/final-geometry.json).

For an older study, open **Body model → Use refined body · retain placements**. Enable **Muscle anatomy guide** to inspect the subdivisions; the guide opacity can be adjusted while placing artwork.

## Verification

- 202 unit tests in 21 files passed.
- Rust: 7 passed, 1 intentionally ignored local-HEIC test.
- 10 body workflow tests passed across Chromium and WebKit: anatomy toggle/opacity/hover, male/female and average/fit, pose controls, connected placement and saved-file round trips.
- The upgrade test was extended and passed again in both browsers, checking r5 and r7 upgrade/Undo and exact retained anchor data.
- After the zoom/first-frame fixes, all four library and connected-placement checks passed again in Chromium/WebKit. Three production WebKit checks also passed for the rig, connected anchors/upgrades and muscle poses.
- 48 matched-camera renders completed without renderer errors. A close-up skin capture supplements the normal-scale views.
- Geometry checks cover finite values, exact triangle/rig/cut identity, all 28 new head IDs, normalized categorical weights, metadata checksums and all section rims. Build-time checks reject face orientation reversals at five points between average and fit.
- Production TypeScript/Vite and the macOS app bundle build passed. The copied release's local ad-hoc signature passes `codesign --verify --deep --strict`. [Release identity](../../qa/body-017/release.json) records the binary checksum. After the user unlocked the Mac, the packaged 0.16 app launched and its accessibility tree exposed the body library, torso controls, muscle guide and camera controls. Native save/open and screenshot verification remain pending: subsequent app-control calls repeatedly timed out or reported concurrent user changes, and no save dialog completion was observed. A process sample showed the native main thread waiting normally in the AppKit event loop. Browser verification is not represented as native-dialog verification.

These checks establish implementation behavior and compatibility. They do not establish anatomical accuracy or a near-1:1 match to the supplied reference models.

## Rebuild with free tools

From the repository root, with the existing pinned source meshes and r7 assets available:

```sh
# Use the locally mounted Blender; use your own installed path elsewhere.
BLENDER_BIN=/Volumes/Blender/Blender.app/Contents/MacOS/Blender
"$BLENDER_BIN" --background --factory-startup --disable-autoexec --python scripts/bake-muscle-heads.py
python3 scripts/build-body-revision8.py
"$BLENDER_BIN" --background --factory-startup --disable-autoexec --python scripts/polish-body-r8.py
"$BLENDER_BIN" --background --factory-startup --disable-autoexec --python scripts/bake-skin-detail.py
BODY_REVISION=8 node scripts/bake-body-occlusion.mjs
python3 scripts/dependency-notices.py
```

The host Python needs NumPy/SciPy. Blender includes its own Python and NumPy. The polish script refuses to apply twice; run the r8 builder first when rebuilding. Head projection caches live under `.tools/anatomy/r8/`. Its pinned registration report is in [assets/anatomy/atlas/registration-v8.json](../../assets/anatomy/atlas/registration-v8.json). Run `node scripts/capture-body-r8.mjs` against a local Vite server to recapture the gallery images.

## Provenance and remaining work

This pass uses the existing **Z-Anatomy-derived CC BY-SA 4.0** lineage, including its attribution in the distributed notices. It does not relicense those derivatives based on BodyParts3D's newer terms. Revision 8's modified skin assets explicitly retain that attribution. The independently authored procedural skin tile is CC0; no source photographs or external texture maps were used. Blender is a build tool, not bundled with the app.

The [fidelity research](../research/fidelity-research-1to1.md) remains a broader roadmap. The following are **not completed by this release**:

- BodyParts3D-only rebase, non-rigid ICP and independent landmark accuracy validation. The new head projection uses the inherited segment-landmark mapping, outward-ray intersection and nearest-surface fallback, constrained by the old parent field. Projection distances measure source-to-skin separation, not registration accuracy. Female anatomy remains an adapted guide, not a separate female anatomical dataset.
- Full tendons, veins, serratus slips and a validated scapular-motion model. Shoulder cuts and armpit transitions still need sculpting and review.
- Contact-aware skin folding, volume-preserving muscle simulation, offline pose-space simulation and realistic deep elbow/knee compression. The new wrinkle shading changes appearance only; the underlying r7 deformation is retained.
- Second UV atlas, whole-body 4K sculpt-normal maps, KTX2 compression or new subsurface-scattering integration. The delivered physical-scale tile is a different, lightweight seam-free approach for pores; it does not replace a sculpt.
- ANSUR-based acceptance thresholds, owned-photo silhouette validation, perceptual regression thresholds and independent expert review. The gallery compares our own builds without using the supplied commercial imagery as test fixtures.

The next useful free work is improving registration and joint-contact deformation. The current surfaces are better defined and the anatomy filter is more informative, but the reference models' sculpt quality has not been achieved.
