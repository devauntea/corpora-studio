# Form Studio — implementation status

The desktop app is the editing product. The separate portfolio displays finished exports. Version 0.9 implements software in all eight areas of `next-features-research.md`; the entire platform is not represented as physically or publicly qualified.

The 0.10 body pass adds torso-only upper bodies, revised chest/back forms and muscle-flex presets. See [body fidelity and verification](body-fidelity-0.10.md). Near-1:1 similarity to the supplied commercial reference models is still not established.

## Delivered workflows

1. Five garment designs through a generic FreeSewing adapter; reusable measurement profiles and interchange; nested size series; fabric/ease records; custom formula-driven pattern construction.
2. Calibrated flat-lay photo measurements, pointer/keyboard adjustment, explicit hidden-construction and ease assumptions, transfer to draft measurements and error exports.
3. Local bounded cloth preview from triangulated panels, stitch ranges, pins and body contact; cylinder benchmark and observation/report export. Self-contact and measured fabric calibration are not implemented.
4. Versioned continuous full-body/neck coverage, fit/average bodies, colored muscle guidance, cross-chart connected placements and Jacobian distortion inspection.
5. Local personal fitting from front/side landmarks, known height and optional tape inputs, with six authored torso scale parameters and per-input residuals.
6. Pressure drawing, image cleanup, groups, protected photo composition, fold-checked nine-point lattice and checkpoint comparison.
7. Centerline contour selection, millimeter line widths, per-printer calibration, true-size tiled PDF/PNG and DPI metadata.
8. Bounded cancellable workers, keyboard alternatives and automated accessibility checks, native export, static portfolio bundle/gallery, qualification CI and credential-dependent signing pipelines.

See [implementation details and limits](next-features-implementation.md) and [release verification](next-features-verification.md).

## Remaining evaluation and release gates

- Tape-versus-photo measurements on 10–20 real garments and a small consenting group for body fitting; report residuals and error distributions rather than claiming accuracy from synthetic tests.
- Sew and measure a toile; compare a real 500 mm fabric square over the cylinder against the preview. No physical observations have been fabricated or bundled as validation data.
- Qualified review of the muscle guide and body geometry.
- Print calibration and selected contours on actual stencil paper; artist acceptance.
- Native VoiceOver/stylus hardware review and actual Windows/WebView2 execution. CI configuration is not a passed Windows run.
- Developer ID credentials, notarization and Windows signing credentials. Local ad-hoc signing is not public distribution approval.

These require physical specimens, qualified reviewers, platform hardware or account credentials. They remain explicitly unverified until evidence is recorded.
