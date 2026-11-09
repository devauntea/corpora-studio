# Form Studio — implementation status

The desktop app is the editing product. The separate portfolio displays finished exports. Version 0.9 implements software in all eight areas of `next-features-research.md`; the entire platform is not represented as physically or publicly qualified.

The 0.10 body pass adds torso-only upper bodies, revised chest/back forms and muscle-flex presets. See [body fidelity and verification](history/body-fidelity-0.10.md). Near-1:1 similarity to the supplied commercial reference models is still not established.

## Delivered workflows

1. 65 searchable garment designs through a generic FreeSewing adapter; reusable measurement profiles and interchange; nested size series; fabric/ease records; custom formula-driven pattern construction.
2. Vector packs with 12 original front/back flat starters and 112 imported PNG sheets converted into 217 editable views, custom path/curve editing, construction callouts, material records and size specifications; editable SVG, vector PDF, CSV and ZIP handoff. These are design flats, not automatically generated cutting patterns.
3. Calibrated flat-lay photo measurements, pointer/keyboard adjustment, explicit hidden-construction and ease assumptions, transfer to draft measurements and error exports.
4. Local bounded cloth preview from triangulated panels, stitch ranges, pins and body contact; cylinder benchmark and observation/report export. Self-contact and measured fabric calibration are not implemented.
5. Versioned continuous full-body/neck coverage, fit/average bodies, colored muscle guidance, cross-chart connected placements and Jacobian distortion inspection.
6. Local personal fitting from front/side landmarks, known height and optional tape inputs, with six authored torso scale parameters and per-input residuals.
7. Pressure drawing, image cleanup, groups, protected photo composition, fold-checked nine-point lattice and checkpoint comparison.
8. Centerline contour selection, millimeter line widths, per-printer calibration, true-size tiled PDF/PNG and DPI metadata.
9. Bounded cancellable workers, keyboard alternatives and automated accessibility checks, native export, static portfolio bundle/gallery, qualification CI and credential-dependent signing pipelines.

The 0.12 garment library and navigation update is described in the [fashion guide](fashion-workspace.md). It adds searchable categories/favorites, source/trace previews, quick actions and canvas focus mode.

See [implementation details and limits](history/next-features-implementation.md) and [release verification](history/next-features-verification.md).

The [0.13 handoff milestone](history/reliable-handoff-0.13.md) adds garment groups/multi-selection, bounded SVG import with original retention, export preflight and recipient review reports. The packaged Mac release passed native project save/cancel/reopen, SVG import/source export, SVG/PDF/manufacturer-ZIP export and portfolio-ZIP export checks. Physical printing and recipient acceptance remain unverified.

The [0.14 preview](history/body-composition-0.14.md) implements a 163-bone body rig with exact interpolated skin weights, correct knee flexion, upper/forearm twist distribution, cleaned arm/back surfaces, a rebuilt male chest profile, linked pose composition and registered stencil sections. Software checks are recorded separately from anatomy acceptance. The supplied references are **not yet matched near 1:1**; section cuts, joint landmarks, muscle separation, seams and pose-specific fidelity need further work. Native 0.14 save/open/export dialogs remain pending because app control reports the Mac locked.

The [0.15 fashion preview](history/construction-fashion-0.15.md) adds seam pairing/walking, ease and matching-mark checks, three design-family starting checklists, editable assembly steps, linked callout/material/POM references, frozen specification revisions, sample measurement comparisons and named material colorways. Construction ZIPs preserve millimeter geometry and checksums; technical packs include sample/revision/colorway sheets. SVG/PDF remains the chosen receiver profile. Real toiles, complete assembly review and manufacturer acceptance remain open. The 0.15 bundle builds and its local signature verifies; native dialog completion remains unverified after app control stalled during the open-dialog check.

The [0.16 body refinement](history/body-refinement-0.16.md) adds 28 individual-head labels (52 visible regions overall), a rebuilt and Blender-polished fit-male pectoral contour, subtle source-head boundary relief, original physical-scale pores and joint-angle wrinkle shading. Revision 8 preserves the existing rig, charts, indices and section rims; old studies upgrade explicitly with Undo and connected tattoo anchors retained. Non-rigid registration, contact-aware pose deformation, sculpt-level surfaces and independent anatomy validation remain open. This is partial implementation of the fidelity research, not completion of its five tracks.

The [0.17 sculpt library](history/sculpt-library-0.17.md) adds seven user-supplied sculpt parts as fixed-pose tattoo surfaces, including separate hand and foot options, repaired material UVs and embedded detail maps. Body revision 9 refines existing muscular volumes while preserving topology and anchors. Project format 17 stores imported mesh identity.

The [0.18 guided workspace and review preview](history/guided-studio-0.18.md) adds optional Home/task starters, recent projects, a searchable model browser and artwork layers, contextual tattoo/fashion task routes, clearer output destinations, and an offline review room. Review records bind rendered views and object/view notes to a project fingerprint; users explicitly select views for ZIP sharing and import revision-linked JSON feedback without geometry changes. Project format 18 migrates format 17 and earlier while preserving existing bodies, placements and artwork. This is partial S2/S4 delivery: interactive tutorials, comprehensive command/history unification, reference permission/crop boards, live collaboration and practitioner/native accessibility studies remain open. Review storage is bounded to 8 revisions, 8 views and 100 notes per revision. 230 unit tests, 7 Rust tests and 22 production WebKit workflows pass; the Mac bundle and local signature verify. Native 0.18 dialog checks remain unverified because the Mac is locked.

The [0.19 final development candidate](history/final-development-0.19.md) adds documented male/female S/M/L starters, actual previews for all 65 patterns, calibrated pattern-image inventory and two clearly labeled approximate garment-photo drafts. It repairs cramped tattoo/stencil/fashion layouts, validates raster dimensions and data before decode, preserves source originals, migrates project format 19 and retains browser unsaved-change protection after an unconfirmed download. Tests and scope are recorded in the delivery report. The final design review approved a restricted local preview only. The Mac app builds, its ad-hoc signature verifies and native launch is observed; native dialog completion remains unverified after app-control timeouts. Public publication is still unauthorized and blocked by unresolved supplied-asset rights and licensing/qualification review.

## Remaining evaluation and release gates

- Tape-versus-photo measurements on 10–20 real garments and a small consenting group for body fitting; report residuals and error distributions rather than claiming accuracy from synthetic tests.
- Sew and measure a toile; compare a real 500 mm fabric square over the cylinder against the preview. No physical observations have been fabricated or bundled as validation data.
- Qualified review of the muscle guide and body geometry.
- Print calibration and selected contours on actual stencil paper; artist acceptance.
- Native VoiceOver/stylus hardware review and actual Windows/WebView2 execution. CI configuration is not a passed Windows run.
- Developer ID credentials, notarization and Windows signing credentials. Local ad-hoc signing is not public distribution approval.

These require physical specimens, qualified reviewers, platform hardware or account credentials. They remain explicitly unverified until evidence is recorded.
