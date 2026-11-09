# Form Studio 0.5 — detailed bodies and colored muscle filter

The body library now has male and female surfaces with Fit and Average presets. Each has a connected upper body with both arms, complete left/right arms including hands, and complete left/right legs including feet. The monochrome desktop interface and tattoo image studio remain available.

## Surface work

The new generation uses two Catmull–Clark subdivision passes, continuous fit/average morphs, local muscle targets and additional authored surface relief. Detail covers pectoral and abdominal planes, rib/oblique transitions, clavicles, shoulder blades, spinal columns, deltoid/biceps/triceps contours, forearm taper, quadriceps, calves, kneecaps, ankle landmarks, Achilles tendons and knuckles. Female skeletal heights are normalized before sectioning so the same neck, waist and leg boundaries work for both variants. Shoulder joins share vertex normals; cut faces remain separate from tattoo charts.

The male asset has 143,094 shared vertices and 285,452 triangles across all five charts; the female asset has 143,689 vertices and 286,666 triangles. Only the selected section is rendered. The renderer sleeps between camera/composition changes instead of continually drawing an idle body. Positions, morph deltas and rig weights are packed into about 10.3 MB per body. These are modeled planning surfaces, not scans or exact replicas of the reference products.

New surfaces use normalized quaternion blending about each joint pivot to reduce the loss of volume from linear blending. A small artistic biceps corrective accompanies elbow flex. This is not a full musculoskeletal simulation: it does not calculate individual muscle contraction, tissue sliding, skin strain or a person's physical tattoo distortion. The previous renderer retains its original deformation path.

## Muscle filter

122 superficial muscle meshes from Z-Anatomy are registered to the body landmarks and projected into 36 color identities. The colors, pale connective regions and fine directional surface detail follow the rest surface through morphing and posing. Skin/Muscles and opacity update shader uniforms without rebuilding the body. Hover identifies a group and describes its general flow; the legend uses the same colors.

The atlas is a single reference anatomy adapted to both skin surfaces. Its boundaries are approximate, especially around shoulders, the breast surface and joints. The hands, feet and selected tendon regions use the pale connective layer; they do not contain a complete intrinsic-muscle atlas. Fine fibers are an authored visual cue, not measured individual fascicles. Close viewing resolves more fiber and skin detail; distant views suppress high frequencies to reduce shimmer.

Tattoo layers keep their surface coordinates when the filter, physique or pose changes. Upper bodies still use separate trunk and arm charts, so a single layer does not wrap seamlessly across all three charts. The image studio retains crop, background removal, erase/restore, tone editing, undo, transparent export and unchanged source bytes.

## Project compatibility

The project format is v5. Frozen v1/v2/v3/v4 readers validate old files before migration. A missing `body.model` retains the original human asset and chart equations; opening a saved study never opts it into the new shape. Choosing a new body preset is explicit. An older file's first native save asks for a new path, protecting the previous file. Earlier app versions reject v5 instead of dropping new body choices.

## Sources and licenses

- [User's Sketchfab anatomy collection](https://sketchfab.com/Stereotype24/collections/anatomy-263c48fd2789452f93b733a1e2d5f667), including [enricsant's anatomy study](https://sketchfab.com/3d-models/anatomy-study-full-rigged-character-00347f3ee4bb402a9975bb2d4e921499), and the supplied Tattoo Smart sheets informed silhouette, colored grouping and flow. Their commercial meshes and reference images are not bundled.
- [MakeHuman core graphical assets](https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482): CC0 base mesh, targets and rig weights, pinned at `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`. Source files and notices are retained in `assets/anatomy/source/`. No MakeHuman application code is included.
- [Z-Anatomy / BodyParts3D](https://github.com/Z-Anatomy/Models-of-human-anatomy/tree/679bc9bf746fdc2671398aa3857a8acff263a0fb): source archive pinned at `679bc9bf746fdc2671398aa3857a8acff263a0fb`. Attribution: **BodyParts3D — The Database Center for Life Science — CC-BY-SA 2.1 Japan; Z-Anatomy — The libre 3D atlas of anatomy — CC-BY-SA 4.0**. Original model: Kousaku Okubo; Z-Anatomy design, 3D and anatomy: Gauthier Kervyn and contributors. The four `muscle-field-v2-*` files are adapted color/identity fields distributed under **CC BY-SA 4.0**. Registration, palette, connective masks and boundary smoothing are modifications. No organs, brain, ear, kidney, source application code or definitions are included.

The anatomy source URL, archive checksum, modifications and full license are retained in `assets/anatomy/atlas/`. App Help contains credits; the bundled third-party notice contains full license texts; exported muscle-filter reviews carry attribution and license/source URLs. The software dependency inventory identifies anatomical assets separately from software licenses.

## Regeneration

1. Run `python3 scripts/build-detailed-anatomy.py`. It reads the checked-in CC0 inputs and writes packed surface assets plus ignored `.tools/anatomy/{male,female}-surface.json` bake inputs. `scripts/surface-sculpt.py` contains the additional surface modeling.
2. Download the exact archive named in `assets/anatomy/atlas/source.json`, verify its SHA-256, and extract `Z-Anatomy/Startup.blend` under `.tools/anatomy/z-anatomy/`.
3. Run Blender 4.5 LTS in background mode with `--factory-startup --disable-autoexec`, opening that blend and explicitly executing only `scripts/bake-muscle-atlas.py` using `--python`. Embedded source scripts must remain disabled. Blender is a build tool, not a runtime dependency.
4. The baker writes both color/identity fields, their metadata and the final `assets/anatomy/hashes.json`. Run `python3 scripts/dependency-notices.py` after dependencies or notices change.

The runtime loads only bundled surface and field files. It does not contact Sketchfab, MakeHuman or Z-Anatomy and does not require Blender or an internet connection.
