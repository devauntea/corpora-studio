# Body revision 7 — muscle separation and bony landmarks

Revision 7 builds on the revision 6 rig. It adds the surface definition revision 6 removed when it rebased the arms and back onto the smooth MakeHuman surface. It is a step toward the reference sheets, not a match for them, and it has had no artist or anatomy review.

## What changed

- **Muscle separation follows the registered muscle field.** Grooves are cut along the actual borders of the 36-group Z-Anatomy / BodyParts3D field (CC BY-SA 4.0 adaptation), not at hand-placed coordinates. Each pair of neighbouring muscles has its own depth and width (`PAIRS` in [relief.py](../../scripts/anatomy6/relief.py)). For example, the deltopectoral groove is 3.2 mm and the biceps/triceps border is 2.0 mm on a fit male. Each groove has slightly raised edges, so the muscle bellies read as rounded instead of carved.
- **Splits inside single atlas groups:** anterior, lateral and posterior deltoid heads; the triceps long and lateral heads; the bottom of the triceps heads above the tendon plate; and the two gastrocnemius heads. Each is placed by its angle around the limb axis in that limb's joint frame.
- **Bony landmarks:** patella, patellar tendon, tibial tuberosity, olecranon, medial and lateral epicondyles, and medial and lateral malleoli. Each is a smooth bump of exact authored height, centred on the skin in the CC0 MakeHuman joint frame. That makes them follow body proportions and move with the bone under skinning.
- **Muscle bellies:** each registered muscle rises from its own atlas borders as a rounded convex form, amplitude × (1 − e^(−(d/r)²)), where d is surface distance to the border. Fit-male amplitudes range from 0.8 mm (sartorius) to 3.2 mm (the vastus medialis "teardrop"). This gives the calves, quads, arms and back rounded volume instead of carved lines.
- **Scaling by build:** grooves at 100% (fit male), 62% (fit female), 35% (average male) and 22% (average female). Landmarks stay visible on average bodies too.

## Bent elbows and knees

Revision 7 adds pose correctives for bent elbows and knees, using centre-of-rotation skinning (Le & Hodgins 2016, "Real-time skeletal skinning with optimized centers of rotation"):

- For each of the about 12,000 elbow and knee transition vertices per sex, a build step stores a centre of rotation. That centre is the centroid of the skin ring whose forearm or shank weight matches the vertex's own. It is smoothed along the weight axis and computed for both average and fit builds. The sidecars are `cor-v7-{sex}.bin` (about 385 KB each), linked from `human-v7-{sex}.json`.
- The app rotates those vertices about their centre with the blended rotation, moves the centre by linear blending, and fades back to dual-quaternion skinning at the ends of the weight range. Every other vertex keeps dual-quaternion skinning. The correctives are applied in bind space after morph and personal fitting, so tattoos stay attached.
- Effect: the rounded "pillow" bulge that dual quaternions put on the front of a bent knee and the back of a bent elbow is gone, and linear-blend collapse doesn't return. The knee front reads as an angular corner at 90–110°.
- **No contact crease.** A plane-based contact crease (clamping flexor skin at the plane that bisects the joint angle) was tried and then removed. On thick limbs that plane runs through the back of the thigh and the front of the upper arm, which hollowed the thigh and dented the biceps at 110°. A true skin-to-skin contact pass (`scripts/anatomy6/correctives.py`, push both sides apart and diffuse) tore the inner elbow, so it is not used either. Bends use centre-of-rotation skinning only and stay closed from every side (`qa/body-016/bend-review/`, captured by `qa/body-016/capture-bend-review.mjs`).

## Section caps

Section-cut caps now face outward, away from the section's centre, and their triangle winding matches. They use a slightly deeper matte skin tone (86% of the chosen skin) with an emissive floor (42%), plus a small polygon offset behind the rim. The torso-only shoulder ends used to render as a dark oval: the cap existed but faced sideways without the skin shader's wrap lighting. They now read as clean cuts, like the arm and leg caps. Revisions 5 and later get this presentation fix. It changes no geometry.

## What does not change

Revision 7 keeps the revision 6 index buffer byte for byte, plus the revision 6 rig sidecar (163 bones, weights, chart rest positions), joints, section part lists and categorical muscle field. Only rest positions and the fit delta move: at most 3.3 mm for the male and 2.2 mm for the female. Every open section rim (neck, shoulder, thigh and torso cuts) is unchanged byte for byte. The builder rejects any inverted face at five morph samples between average and fit.

Revision 6 assets are not modified. New bodies and the male/female and fit/average buttons now use revision 7 (`LATEST_BODY_REVISION`). **Use refined body · retain placements** now upgrades revision 5 or 6 bodies to 7 and moves matching tattoo anchors with them; undo restores the previous revision.

**Compatibility note:** revision 7 is accepted under project format 15. A format-15 file that uses revision 7 will be rejected by the 0.15.0 build, which only knows revisions up to 6. If that matters, bump the format to 16 at the next release cut, with a frozen `legacy-v15.ts`, following the existing pattern.

## Reproduce

```sh
python3 scripts/build-body-revision7.py
BODY_REVISION=7 node scripts/bake-body-occlusion.mjs
python3 scripts/build-body-correctives.py   # run last: it adds centersOfRotation to the v7 manifests
node qa/body-016/capture-bends.mjs qa/body-016/bend   # needs the dev server on :1420
BODY_REVISION=7 BODY_REVIEW_OUTPUT=qa/body-016/r7-renders node scripts/capture-body-reference.mjs
```

`scripts/anatomy6/` also contains the build-time tools used to develop this: an hm08 rig loader (`mh.py`), an offline review renderer (`render.py`) and LBS/ARAP deformation (`deform.py`) for future pose correctives. None of them ship in the app.

## Verification (5 November 2026)

- 198 unit tests passed, including [body-correctives.test.ts](../../tests/body-correctives.test.ts), which checks that the bind pose is unchanged, the output is finite and bounded, the bent knee bulges less than with DQS alone, and the new [body-revision7.test.ts](../../tests/body-revision7.test.ts). It checks identical topology, index bytes, rig reference, joints, rig/cut channels and muscle field; checks the relief is between 1 mm and 3.5 mm; and confirms revision 6 checksums are unchanged.
- Typecheck is clean.
- 10 body end-to-end scenarios passed in Chromium and WebKit: whole sections and posed round trip, body library and saved choices, skeleton-backed knee bending and comparison, and torso flex/double biceps with preserved anchors.
- 63 app renders were captured with no renderer errors: [qa/body-016/r7-renders](../../qa/body-016/r7-renders/render-review.html). Compare them with revision 6 in `qa/body-014/rig-renders`.

## Still required

1. Pose-specific soft tissue. Bends have the centre-of-rotation bulge fix but no contact crease; at 110° the inner elbow and back of the knee rely on skinning alone. There are no flexed triceps/quad shapes driven by joint angle (the existing biceps shortening remains).
2. Atlas resolution. Deltoid and triceps heads, the serratus slips and the scapular spine come from angles, not from registered sub-muscles. A finer atlas would make them more accurate.
3. Artist and anatomy review of all four builds, from every side, in both skin and muscle-guide views.
