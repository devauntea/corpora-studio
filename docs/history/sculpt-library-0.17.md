# Imported sculpts and body revision 9

Form Studio 0.17 adds the three supplied GLBs as seven additional tattoo surfaces, alongside the existing male/female, fit/average body library.

Open **Body model → Imported sculpts**, or choose a sculpt from **Template**. The multipart file is split into torso, shoulder-to-wrist arm, hand, thigh-to-ankle leg and foot. The other two downloads provide a second torso and a textured arm with its hand. Part names and descriptions reflect what each source actually includes.

The imported models support orbiting, camera presets, uniform sizing, chart artwork, connected tattoo placement, distortion inspection, 2K/4K artwork charts, project save/open and Undo. Their original authored poses are fixed: there is no skeleton or muscle map in these files. Pose, body-fitting and muscle-filter controls are available on the existing anatomical bodies instead. The textured anatomical arm retains its original skin; neutral sculpts support the surface-tone palette. Starting dimensions are estimates, not measurements of a person.

## Asset preparation

Blender separates the authored anatomical groups, joins their mesh fragments, welds duplicate positions, corrects orientation and reduces excessive geometry while retaining the silhouette. The dense torso's 992,908 triangles become 220,000 runtime triangles. Sculpt detail is baked from the dense originals into embedded 4K torso and 2K limb normal maps. Unusable limb UVs are replaced with non-overlapping detail atlases. Artwork charts are separate from these native material UVs.

The anatomical arm's original geometry and textures are preserved. Source downloads remain unchanged in `.tools/sculpts/originals/`. [Provenance](../../assets/sculpts/PROVENANCE.md) records authors, source URLs, CC BY 4.0 metadata, adaptations and input/output hashes. These credits are also bundled in the application's notices. [Asset validation](../../assets/sculpts/validation.json) records the seven self-contained GLBs.

## Existing bodies

Revision 9 refines broad shoulder, arm, back, thigh and calf muscle volumes using the existing per-head atlas, with Blender fairing and a broad taper near joints and section rims. Fit shapes receive stronger refinement; average shapes remain softer. The revision 8 anterior chest is retained.

Both sexes preserve triangle order, rig channels, section rims, muscle-field identities and tattoo anchor indices. Existing projects retain their previous body revision. **Use refined body · retain placements** upgrades a compatible anatomical body, with Undo available. Switching to a different imported sculpt clears connected anchors because its topology differs; artwork remains available at chart positions for repositioning.

The changes improve surface definition. They do not add new pose mechanics, contact-aware muscle deformation or establish a 1:1 match to the references. Large connected patches can still distort or fold around highly curved areas such as finger roots; use distortion inspection and smaller placements there.

## Compatibility and verification

New saves use project format 17, which records each imported sculpt's immutable ID in the body and connected anchors. Formats 1–16 still load without silently replacing their body meshes; old format numbers reject the new fields.

Checks passed before packaging: 211 unit tests across 24 files; 7 Rust tests with one intentionally ignored local-file test; four production WebKit workflows covering imported sculpts, body rigs, muscle poses and connected placement/upgrades. The sculpt workflow also passed Chromium and WebKit development builds. It covers all seven parts, saved identities, Undo, native-texture loading under the packaged CSP, and clearing/recreating anchors on model switches. An extended test covers legacy-template-to-sculpt cards, 4K artwork charts, uniform resizing and reopening those projects.

Verification artifacts are under `qa/body-018/`: matched revision 8/9 Blender comparisons, geometry checks, imported-model browser renders and application workflow captures. Release verification is recorded in `release.json` after the final build.

The final ad-hoc-signed desktop bundle launched successfully. Native visual review confirmed the imported torso with artwork and the corrected thumbnail layout. The native Save dialog opened and was cancelled; a complete native write/reopen check remains unverified because dialog automation timed out and input did not behave reliably. Browser save/reopen workflows and Rust file-validation tests passed.

Rebuild imports with Blender 4.5 and `scripts/import-sculpt-assets.py`. Rebuild revision 9 with `scripts/build-body-revision9.py` and `BODY_REVISION=9 node scripts/bake-body-occlusion.mjs`. Blender and the source models are build inputs; the runtime app contains the optimized assets.
