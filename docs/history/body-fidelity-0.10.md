# Body revision 5 — Form Studio 0.10

The body library has a new reference-led sculpt and presentation pass. **Upper body now means torso only**: neck, shoulder contours, chest, abdomen and back, with closed shoulder ends. Full arms remain a separate option. Full body retains both arms and legs. Fit/Average male/female selections use revision 5; older saved projects keep their original surfaces until the user chooses a new template or preset.

## Visible changes

- Fuller, rounded lower male pectorals and a softer curved lower chest fold. Female chest refinement follows the upper rib cage and clavicular transition while preserving breast volume.
- More distinct trapezius, scapular, infraspinatus/teres, lat and erector-spinae planes. Fit has stronger relief; Average retains softer tissue over the same landmarks.
- Smoother abdominal columns, fuller Average waist/belly volumes, deltoid/forearm transitions, wrist detail, foot arches and heels.
- Clean neck and isolated-leg cuts, conformed shoulder/neck junctions, and separate torso shoulder cuts. Isolated arms rotate as complete limbs at the shoulder, avoiding a folded cut rim.
- Physically based skin material, subtle palm/nail variation, crease shading, rest-space ambient occlusion, neutral studio lighting and 30 artist-selected skin colors. Reference photographs are not used as body textures.
- Chest flex and back flex with 0–100% tension. Full body also offers double biceps, with raised arms and upward elbow bends. Surface positions and normals change; UVs, source vertex identities, tattoo anchors and the registered color guide remain attached. Fit model retains the selected camera side.

## Compatibility and asset provenance

Project format 10 reads formats 1–9 through their frozen validators. Revision 5 is a new immutable asset set; all 52 prior manifest entries remain unchanged. Old projects retain their body revision, UV layout and placement anchors. Selecting a new incompatible body clears connected anchors as before. Old personal-fit results apply to revision 4; new results record which surface was fitted.

There are 154,838 male and 156,419 female packed vertices, including cut vertices. The continuous body uses 296,174 / 296,436 triangles. Additional index sets provide isolated legs and the torso without modifying the full-body topology. Counts include retained source vertices and are not a claim that every template renders every vertex.

The body base derives from the pinned MakeHuman CC0 graphical assets. The registered muscle identity/color fields remain CC BY-SA adaptations of Z-Anatomy / BodyParts3D; [provenance and adaptation details](../assets/anatomy/atlas/source.json) and bundled notices cover the new interpolated cut vertices. Supplied Tattoo Smart sheets and bodybuilding photographs were used as visual references only and are not included in the application.

## Reproduction and review

```sh
python3 scripts/build-reference-bodies.py
node scripts/bake-body-occlusion.mjs
npm run dev
node scripts/capture-body-reference.mjs
```

NumPy is needed only for asset generation. The occlusion baker uses the pinned Three.js/BVH packages: 32 deterministic hemisphere samples per vertex for Average and Fit. The sculpt generator rejects inverted faces at Average, midpoint and Fit. It writes a new revision without overwriting old assets.

Local visual review: [render gallery](../qa/body-fidelity/render-review.html). The capture script covers four builds, three sections and three camera sides, chest/back flex variants, anatomy views and double biceps. Captures are actual application renders, not generated concept images.

## Verification

- 76 unit tests passed, including four closed torso boundary loops, complete leg rims, categorical atlas/UV stability, original-surface migration and no inverted faces for chest/back correctives at maximum tension on all four builds.
- The 40-test Chromium/WebKit suite passed after the torso-only change. The affected anatomy/body-library/pose tests passed again after the chest/back and flex changes; the final double-biceps correction was checked separately.
- Rust release tests: 5 passed, 1 local HEIC fixture test intentionally ignored. The native envelope accepts format 10.
- All 62 source/runtime asset checksums verified; the 52 original entries are unchanged.

- Final production WebKit: 2 tests passed against the compiled assets with the desktop Content Security Policy, covering the anatomy toggle, torso-only section, tattoo anchor preservation, tension controls, double biceps and saved-pose reload.
- 50 render captures completed with no page or console errors.
- TypeScript, production web build and the Tauri Mac app build passed. The new bundle is `releases/Form Studio 0.10.0.app`; Info.plist reports 0.10.0 and ad-hoc `codesign --verify --deep --strict` passed. Executable SHA-256: `577cb141109bbf12139d12ed232f205a6aae5cc831be73557facce39017ddd24`. It was packaged separately; the user’s running 0.9 session was not closed. Native system-dialog interaction is not inferred from browser tests.

## Fidelity limits

This is an improved authored model, **not a verified 1:1 reconstruction** of the supplied references. Scan-quality skin microstructure, fully sculpted individual muscle anatomy, reference clothing, reference-matched hand poses and the complete 18-part commercial catalog are not delivered by this pass. Artwork charts remain 2048 pixels; the reference's dedicated 4K UV workflow is not claimed.

Flex is an artist-authored deformation, not a calibrated muscle/skin biomechanics simulation. Static rest-space occlusion follows the mesh but does not compute dynamic contact shadows. The torso-only template deliberately ignores independent arm articulation; the full-body template provides arm poses. Native save/open/portfolio system-dialog round trips, physical qualification and public signing remain separate from these body checks.
