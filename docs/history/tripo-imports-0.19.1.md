# User model import — 0.19.1

All ten supplied files are accounted for. The three previously imported Sketchfab sources retain their seven existing parts, IDs, topology and credits. Seven new Tripo files add seven library entries containing twelve surfaces. The complete imported library has fourteen entries and nineteen selectable surfaces.

| Supplied file | Library entry |
| --- | --- |
| c6c3567f-9e5c-4cad-afba-8bfc2ab968d3.glb | Full body study |
| full body model.glb | Full body sculpt |
| human anatomy model 3d.glb | Human muscle atlas |
| anatomical human model 3d.glb | Anatomical body study |
| muscular arm 3d model.glb | Flexed muscular arm |
| muscular forearm 3d model.glb | Extended muscular arm (the supplied geometry includes the upper arm and hand) |
| human leg muscles 3d model.glb | Muscular leg → six individual authored poses |
| male_body_parts_sculpt.glb | Existing Sculpt torso, arm, hand, leg and foot |
| anatomy_-_male_arm.glb | Existing Anatomical arm |
| 06_torso.glb | Existing Torso study |

## Leg collection

Blender connectivity analysis reconnects UV/normal seams on a temporary mesh and identifies exactly six separate legs. Original render vertices, UVs, normals, materials and all 10,156 triangles are retained across the six output GLBs. No slicing, remeshing or invented connecting geometry is used. Each output is centered independently, with a shared scale across poses; bent legs are not stretched to standing height. Pose names follow left-to-right source order (four standing, two bent).

The model chooser, inspector cards and template dropdown each present one Muscular leg parent. A six-option pose selector chooses the actual surface. Each pose has an immutable ID for saving and tattoo anchors. Switching to another pose clears incompatible connected anchors through the existing model-change flow; artwork remains in the chart for repositioning. These meshes do not share a rig or vertex correspondence, so automatic tattoo deformation between poses is not claimed. Undo restores the previous model and anchors.

## Textures, dimensions and provenance

Original embedded textures and source normals are preserved. The anatomy colors are baked into the supplied textures, not a toggleable anatomy overlay. Full-body imports use a trunk artwork chart and remain fixed shapes. Size is uniformly adjustable. Dimensions are approximate display scales, not scans or measured anthropometry. Added runtime assets total about 27.6 MB, including the six independently loadable textured legs.

Source files are retained in `.tools/sculpts/originals/` with input/output hashes and metadata in `assets/sculpts/`. Regenerate using Blender and `scripts/import-tripo-assets.py`. The original importer preserves these new entries when rebuilding the older seven parts. Downloads can be moved after originals are cached.

The user states the new models were made using Tripo. Their source metadata contains no license. They are identified as user-provided Tripo generations; no CC license is invented. The three existing Sketchfab sources retain their original CC BY 4.0 attribution. No Tripo API key, account access or paid service was used.

## Verification

- 668 unit tests passed, including all catalog IDs, project round trips, grouped entries and full-body chart mapping.
- All nineteen surfaces loaded in WebKit; existing connected tattoo placement, save/open and undo flow passed.
- Grouped pose selection, variant preview, save/open, undo and reopening the model chooser passed in Chromium and WebKit.
- Blender previews visually reviewed: six complete single legs, including both bent variants.
- Both import browser flows passed against the production build in WebKit.
- Desktop build: 0.19.1, locally ad-hoc signed and signature verified; not notarized. Native macOS dialogs were not re-tested in this import-only update.
