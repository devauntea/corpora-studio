# Form Studio 0.6 — close-view surface detail

This pass refines the male/female Fit and Average bodies and the muscle filter. The desktop tattoo, image-cleanup and photograph workflows remain available.

## Visible changes

- Chest and abdominal transitions, clavicles, the neck notch, shoulder-blade borders and spinal planes have additional modeled relief. Fit has stronger muscle separation; Average retains the bony landmarks with softer muscle definition.
- Deltoid insertion, bicipital grooves, elbow landmarks, forearm cords, quadriceps transitions, patellar contours, the tibial ridge, calf divisions, ankle landmarks and Achilles margins receive local shaping.
- Hands add dorsal tendon paths, knuckle pads and distal nail-bed relief. Continuous shader detail adds digit, palm, wrist and toe folds without the triangular artifacts of interpolating narrow creases from sparse vertex samples. Skin pores and roughness variation resolve at close zoom.
- The muscle filter has distinct fan-shaped pectoral/trapezius/latissimus flow, vertical abdominal fibers, diagonal obliques and longitudinal/pennate limb cues. Coarse fascicle bundles and finer filaments fade with pixel footprint to reduce shimmer.
- Muscle labels are smoothed as categorical probabilities on the surface, then sharpened in the shader. This removes many small color flecks and creates narrow connective borders without blurring neighboring colors together. Hover uses the same interpolated probabilities as the visible filter.

These remain authored planning models, not scans or exact copies of the supplied products. Fiber patterns indicate general flow; they are not measured fascicles. Atlas registration remains approximate, particularly at shoulders, joints and female breast surfaces. Hands and feet retain a pale connective layer rather than a complete intrinsic-muscle dissection. Flex remains the existing approximate joint/pose preview, not a physiological skin-strain simulation.

## Attachment and compatibility

The refined mesh is **body revision 3**, saved in **project format v6**. The shipped v1 and v2 geometry and v2 atlas fields are unchanged. A frozen v5 reader validates old studies before migration, keeping their existing body revision, image bytes and placements. Selecting a body preset explicitly chooses the new sculpt; simply opening an old study does not. The first native save of an older project asks for a new destination.

Skin/Muscles and opacity only change material uniforms. The filter never moves the mesh, the raycast surface or tattoo coordinates. Rest-space details and categorical fields follow the mesh through physique and pose changes. Section cuts retain their existing planes and triangle connectivity. The upper body still has separate trunk and arm tattoo charts.

## Assets and regeneration

`scripts/refine-body-surfaces.py` reads the shipped CC0 MakeHuman-derived v2 buffers and pinned source landmarks, then authors new v3 buffers. It does not overwrite v1/v2 assets. Triangle counts are unchanged: 285,452 across the male library and 286,666 across the female library. This pass adds surface modeling and shading detail rather than increasing polygon density indiscriminately.

The muscle fields derive from the previously registered Z-Anatomy / BodyParts3D fields. The new compact field stores RGB and identity for compatibility plus four categorical labels and weights per vertex: 12 bytes per vertex, about 1.72 MB per body. Per-triangle palette slots preserve the categorical identities during interpolation. Joint, finger and toe landmarks are bundled in the mesh metadata; the renderer has no network or Blender dependency.

Run:

```sh
python3 scripts/refine-body-surfaces.py
python3 scripts/dependency-notices.py
npm test
npm run test:e2e
npm run desktop:build
```

Geometry remains derived from **MakeHuman CC0** graphical assets. Both v2 and v3 atlas fields are **CC BY-SA 4.0** derivatives of **Z-Anatomy / BodyParts3D — The Database Center for Life Science**. Source revisions, checksums, original attribution and licenses are retained in `assets/anatomy/source/` and `assets/anatomy/atlas/`. The new adaptation record lists label cleanup and categorical smoothing. App credits, bundled notices and muscle-filter review exports carry the attribution. Reference screenshots and commercial reference meshes are not bundled.

## Verification

- 24 domain/geometry tests passed, including frozen v5 migration, v2/v3 asset checksums, connected cut boundaries, finite posed geometry, immutable tattoo UVs and anatomy fields, categorical weight validity, and interpolated muscle picking.
- All 18 Chromium/WebKit workflows passed. The first complete run passed 12 and stopped six workflows at assertions expecting format v5; after those assertions were updated to v6, all six affected workflows passed in a focused rerun. Coverage includes body/limb presets and poses, filter/opacity pixel changes, image cleanup, crop, photo masks, unchanged image bytes, save/open and review export.
- Four Rust tests passed; the private HEIC reference-file test remains intentionally ignored.
- TypeScript and production/native builds passed. The existing Three.js bundle-size advisory remains.
- Every source/public asset matches the manifest. Previously shipped v1/v2 body and v2 atlas buffers are byte-identical to the preceding commit.
- `releases/Form Studio 0.6.0.app` is built for Apple Silicon, ad-hoc signed, and passes strict deep signature verification. Executable SHA-256: `4b620ba455ed93407b0894dbee4e68e1acfb5b3ccc351267c68380e85091a54d`.

Close-view captures are kept in the ignored `qa/f06/` directory; 32 front/back/side and bent-pose library captures are retained in `qa/f06/library/`. Native launch and save/open dialog verification of the packaged 0.6 app remain pending: the app-control tool reported the Mac locked during this pass. Browser checks do not substitute for that native dialog check. The new bundle is separate from the existing running apps and has not replaced them.
