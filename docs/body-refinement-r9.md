# Body revision 9 — muscle surface pass

Revision 9 is an immutable refinement of the existing revision 8 bodies. The
downloaded sculpt assets are a separate library addition; they do not replace
the editable male/female bodies and are not used as unverified deformation
data for this pass.

## What changed

- Broad muscle volume on the upper arms, radial forearms, quadriceps,
  hamstrings, calves, upper back and lats is guided by the existing registered
  muscle fields and skeletal limb axes. Volumes taper toward joints and
  insertions; no new grooves or rows of surface bumps are added.
- Blender 4.5.9 LTS applies a weighted 18-iteration fairing pass to the affected
  skin. Its displacement is capped at 2 mm before the broader forms are added.
- The volume field is smoothed over mesh adjacency and fades over 60 mm near
  fixed section rims. The wider fade was selected during render review because
  a shorter falloff accentuated a band under the shoulder.
- Fit bodies receive stronger changes, with softer changes on the average
  bodies. Female fit amplitudes are 58% of male fit amplitudes for this authored
  pass; these are artistic settings, not population measurements.
- Short-range skin occlusion was rebaked from the resulting geometry for both
  sexes and both body builds.

The anterior chest is deliberately protected, including the r8 male pectoral
contour. Hands, feet, muscle identities and colors, UV/chart data, rig channels,
joint frames, centers of rotation and pose correctives remain compatible with
r8. The existing r8 skin detail texture and shader are reused.

## Validation

The serialized float32 buffers were checked at nine equally spaced average-to-
fit builds. Every nondegenerate source triangle retains its orientation, with
no collapsed or reversed faces. All 443,620 triangle indices are byte-for-byte
identical to r8. All 1,764 male and 1,761 female section-rim vertices retain
their exact 12-float records, including any rims internal to the full-body
surface. Existing studies can retain r8; upgrading keeps the same vertex and
triangle anchor identities.

| Body | Maximum change, average | Maximum change, fit | 95th percentile change, fit |
| --- | ---: | ---: | ---: |
| Male | 1.98 mm | 9.95 mm | 4.39 mm |
| Female | 1.29 mm | 5.36 mm | 2.42 mm |

`qa/body-018/revision9-geometry.json` contains the complete build report.
`tests/body-revision9.test.ts` checks finite data, exact topology and rims,
bounded changes, preserved central chest, identical anatomy fields and matching
occlusion checksums.

`qa/body-018/sculpt-comparison/index.html` contains matched r8/r9 Blender clay
comparisons of male/female fit back, front/rear arm and front/rear leg. They use
the actual asset buffers with no render-only subdivision or displacement. The
arm is rotated upright only for these comparisons; app geometry is unchanged.
The raw section cuts are left uncapped in this geometry review. The application
adds its usual cut caps.

## Rebuild

```sh
python3 scripts/build-body-revision9.py
BODY_REVISION=9 node scripts/bake-body-occlusion.mjs
/Volumes/Blender/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python scripts/blender-body-r9.py -- render
npx vitest run tests/body-revision9.test.ts
```

The host Python step uses NumPy/SciPy and calls Blender for the actual fairing.
Set the `BLENDER` environment variable if Blender is installed elsewhere. All
tools and existing source assets used in this pass are free. The derived
surface retains r8's CC BY-SA 4.0 attribution; the MakeHuman foundation remains
CC0. Source and attribution metadata are carried forward unchanged.

## Limits

This is a conservative surface refinement, not a scan, commissioned anatomy
sculpt, new non-rigid registration or muscle simulation. It improves fullness
and continuity but does not establish a 1:1 match to the references. Deep joint
contact, shoulder/scapular motion and pose-dependent muscle-volume mechanics
are unchanged from r8. The detailed muscle map is the same approximate
registration; no new claim of anatomical accuracy is made.
