# Form Studio 0.14 preview — body rig and tattoo composition

This local build introduces the rig foundation and tattoo-planning tools. It does **not** satisfy the roadmap's final body-fidelity acceptance gate. The supplied references remain the target; this is not a near-1:1 result or anatomically validated simulation.

## What changed

- Revision 6 uses all 163 bones from the pinned MakeHuman CC0 skeleton. Every nonzero skin influence is propagated through the original two subdivision steps and all section cuts, then normalized. Both exporters assert byte-for-byte identity with the historical mesh before producing weights; there is no nearest-neighbor transfer. The packed male/female rigs retain 620,441 / 631,735 influences.
- Average/fit joint centers come from the skeleton's mesh helpers and interpolate with the body morph. Fitting adjustments affect joint positions. Forward kinematics and normalized dual-quaternion skinning replace the six-region per-point rotations on revision 6. Forearm twist spans both forearm bones; double biceps externally rotates both upper-arm segments and raises the clavicles.
- Positive knee flexion bends the shank toward the back. Numeric checks cover both sexes and average/intermediate/fit morphs, 90° knee direction, inherited wrist movement, bind-pose identity and twist volume retention.
- The male chest's longitudinal profile is rebuilt with a curved inferior edge. Problematic arm/back regions are rebased toward the unlayered subdivision surface, reducing stacked nodules and diagonal grooves. Hands, feet and stable topology remain. Bounded contraction correctives follow registered muscle fields before skinning. These are authored visual approximations, not skin-strain or force predictions.
- The muscle filter remains a material view of the same tattoo-bearing geometry. The existing 36-group atlas is preserved; this milestone does not claim a newly validated muscle segmentation.
- The full source UV map is not substituted into existing projects. Revision 5 chart positions are carried in the rig sidecar so cylindrical artwork charts and vertex/barycentric anchors survive an explicit upgrade. A different UV layout will require its own versioned migration.

## Composition and transfer tools

**Pose & sleeve study** opens two linked-camera views of one composition. Change tattoo size, chart position, angle, opacity and visibility; retain undo/redo; add landmark, focal and space-band guides; choose transfer-pose intent; export an 1800 × 1100 PNG proof. Full-leg revision 6 supports relaxed versus 90° knee comparison. Guides are planning aids and do not promise a geodesic or physically accurate stencil boundary.

A selected body region can use a 4096-pixel chart while other regions use 1024. Standard charts remain 2048; paired previews use 1024. Higher source-resolution processing is bounded to approximately two square 4K images, and originals are not upscaled. Resizing an uploaded texture now reallocates its GPU storage, fixing black partial charts after switching detail levels.

Stencil plans save with the artwork: named sections, overlap, shared alignment crosses, transfer pose, notes and output settings. Printer profiles distinguish printer, paper and driver settings. The PDF includes a proof overview, corrected rulers, full notes and tiled section pages. Registration marks and contours share the same corrected millimeter coordinate system. Both the new and existing stencil PDF paths were corrected to avoid mixing raw PDF point/bottom-left transforms with the library's millimeter/top-left coordinates. Sectioning crops flat artwork; it does not flatten a curved body without distortion.

## Compatibility

Project format 14 reads formats 1–13. Frozen older validators reject newer fields under older version numbers. Opening an older native file requires a new save copy. Body revisions 1–5 and their pose behavior remain unchanged, including historical defects, so old compositions are reproducible. Use **Use refined body · retain placements** on revision 5 to adopt the corrected rig. The change is undoable; model/anchor revision changes without replacing vertex IDs, chart coordinates, fitting or original artwork bytes.

## Verification recorded on 2026-11-05

- 182 unit tests passed; the 13 rig/composition tests passed again after adding revision 5 chart-position identity assertions. Full legacy and current geometry/atlas assets remain checksummed.
- Eight targeted Chromium/WebKit scenarios passed: actual skeleton loading, knee/filter comparison, old-body upgrade and undo, connected anchors, torso/full-body poses, linked studies, 4K texture allocation, save/reopen and proof export.
- Twelve production WebKit scenarios passed under the packaged app's content security policy, covering the new body/planning/stencil paths and fashion handoff/recovery.
- A 63-image male/female × fit/average × section/view review completed without renderer errors. A later production capture verifies external upper-arm rotation in double biceps. These renders expose remaining fidelity gaps; they are not an artist approval.
- Registered stencil PDFs and a maximum-length note/settings fixture were rendered and visually inspected. Actual printer output remains unverified.
- The Mac bundle builds and its local ad-hoc signature passes `codesign --verify --deep --strict`. It is not Developer-ID signed or notarized. Native 0.14 save/open/export dialogs remain pending: app control reports the Mac locked. Older native verification is not substituted for this version.
- All 60 final Chromium/WebKit regression scenarios passed in 6.6 minutes, including tattoo editing, rigged poses, project recovery, fashion drafting and vector handoff.

Evidence: `qa/body-014/rig-renders/`, `rig-final-tests/`, `production-tests/`, `final-regression-tests/`, and `pdf-review/`. Earlier `renders/` captures document the pre-rig experiment, not the final rigged build.

## Work still required to meet the reference target

1. Refine deltoid/axillary section boundaries and cap presentation; the isolated sections still visibly terminate in cut surfaces.
2. Sculpt convincing olecranon, elbow crease, patella and tendon transitions in bent poses; the rig fixes direction and rotation but does not supply all soft-tissue landmarks.
3. Develop stronger, coherent triceps/quadriceps/back muscle separation and pose-specific shapes for all four builds. Inspect both skin and colored-guide views from every side.
4. Review remaining seam/hip transition artifacts and measured UV distortion at actual tattoo detail scale. Do not silently replace the preserved charts.
5. Obtain artist/anatomy review of the resulting geometry and muscle field and verify physical stencil registration on actual paper/body positioning.

## Reproducible assets

```sh
python3 scripts/build-detailed-anatomy.py --full-body --rig-sidecar
python3 scripts/build-reference-bodies.py --rig-sidecar
python3 scripts/build-body-revision6.py
python3 scripts/build-body-rig.py
BODY_REVISION=6 node scripts/bake-body-occlusion.mjs
```

The first two commands verify and leave historical assets untouched. Sidecars and clean surfaces are local `.tools/anatomy` intermediates. The revision 6 builder preserves exact indices and categorical fields and rejects inverted faces at five morph samples.

Technical references: [MakeHuman rig format](https://static.makehumancommunity.org/mpfb/developer/rigging_and_posing.html), [Kavan et al., dual-quaternion skinning](https://users.cs.utah.edu/~ladislav/dq/index.html). Source assets, pinned revisions and licenses are in `assets/anatomy/`; the algorithm is independently implemented in `src/skeleton.ts`.
