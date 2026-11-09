# Form Studio 0.3 — whole sections and tattoo image studio

## Delivered behavior

New studies start with a complete arm, including a shoulder cap, upper arm, elbow, forearm, wrist, hand and fingers. The selector also offers a connected upper body (neck base, shoulders, chest, abdomen, back and both complete arms) and a complete left or right leg (thigh, knee, calf, ankle, foot and toes). The older forearm and region surfaces remain in a separate legacy group for existing work.

The new surfaces use an actual human mesh rather than a sequence of procedural elliptical rings. Section length, build and muscle definition adjust its proportions. A muscle guide adds labeled, schematic superficial muscle footprints and directional fiber marks. Elbow and knee controls bend the skin mesh and attached ink from 0 to 110 degrees. The monochrome interface leaves imported artwork, photographs and skin-tone choices in color.

The **Tattoo image studio** is available from the library or the selected artwork inspector. It provides white-paper, black-background and chosen-color removal; tolerance and edge softness; erase and restore brushes with a size cursor; grayscale and contrast; fit/zoom; original comparison; local undo/redo; and transparent PNG export up to 4096 pixels on the longest edge. Apply updates all instances of a source as one project undo step. Applying background removal also turns off legacy light-paper keying on those instances to avoid removing the same edges twice. Cancel discards the editor draft. Source bytes and their integrity hashes never change. Photo protection masks continue to operate independently.

## Audit and design decisions

The preceding forearm/region renderer assumed one tube-shaped chart for every body region. Adding more lobes could not produce branching shoulders or hands. Its saved equations are frozen so old placements stay intact; new geometry has its own `human-v1` discriminator.

A reproducible, independently written conversion script reads only CC0 graphical data from MakeHuman: the base mesh, an adult masculine target, a muscular target, joint positions and rig weights. It straightens the reference elbows, performs one Catmull–Clark subdivision, partitions skin at weighted shoulder boundaries, clips the neck/waist/leg sections, and retains interpolation weights. Runtime geometry uses those weights for elbow/knee flex and keeps rest-space UVs unchanged. Shared normals are computed before splitting charts; cut boundaries receive neutral caps. No MakeHuman application code is linked or copied.

The upper body has separate trunk, left-arm and right-arm painting charts. Clicking a surface with Place chooses the corresponding chart; the inspector also exposes **Placement surface**. Full arms and legs have continuous longitudinal charts. Charts use nominal dimensions, not exact tape measurements. Fingers, feet and shoulders can have substantial local texture distortion. A single image does not automatically blend across the shoulder chart boundary; use separate layers for those transitions.

Artwork edits are bounded vector-mask recipes stored beside the original source. The editor caches the background/tone pass and replays brush masks on transparent canvases; the same processor feeds photo and 3D ink compositing. No cloud service, AI model or new runtime dependency is involved. The existing 24-source, 24-layer, 64-megapixel and file-size budgets remain. Cleanup supports up to 200 strokes per source, 2,000 points per stroke and 80,000 points across the project. Preview processing stays capped at 2048 pixels.

Projects now save as v3. Frozen v1 and v2 readers validate their original schemas before migration; geometry, layer transforms, body-photo masks, source bytes and hashes remain unchanged. Opening an older project clears its writable path, so the first save creates a new copy. Earlier apps reject v3 rather than silently dropping new information.

## References and asset provenance

- [User's moving torso reference, by caterina.zamai](https://sketchfab.com/3d-models/moving-male-torso-anatomy-d54f23aab2fa479cb860639032222723): useful reference for comparing anatomy across poses. Search-index metadata was available; the direct page returned 403. Its geometry is not included.
- [Tattoo Smart: Human Canvases](https://tattoosmart.com/blogs/news/human-canvases-for-tattoo-mockups): demonstrates whole-limb and body references, varied builds and deliberate UV seams for tattoo work. It informed the larger-section workflow. No commercial assets were purchased or redistributed.
- [MakeHuman asset license](https://www.makehumancommunity.org/about/license.html) and [pinned license statement](https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/LICENSE.md): core graphical assets, including mesh and targets, are CC0; application code has a separate AGPL license. Local source files, the full CC0 dedication, revision and hashes are retained in `assets/anatomy/`. The asset notice is included in the bundled third-party notices.
- [OpenStax: upper-limb muscles](https://openstax.org/books/anatomy-and-physiology/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs) and [abdominal-wall muscles](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-4-axial-muscles-of-the-abdominal-wall-and-thorax): reference for broad superficial muscle grouping and movement terminology. The guide graphics are independently drawn, simplified surface annotations, not copies of textbook illustrations.

## Limits and next work

This release has one adult masculine base shape with adjustable build and muscle definition. The anatomy overlay is a placement guide, not a segmented medical muscle model. Flex uses joint-weighted mesh deformation; it does not simulate muscle contraction, tissue sliding, skin strain, or healed tattoos. It does not reconstruct a person from photographs. The photographic composition mode remains the way to work directly with a specific body and existing tattoos.

Future priorities are additional body templates, artist-reviewed muscle boundaries, shoulder elevation and forearm rotation, more refined joint deformation, and seam-aware painting across connected charts. Image cropping, perspective tools and AI subject segmentation are not part of this update. The portfolio website remains separate from the desktop editing application.
