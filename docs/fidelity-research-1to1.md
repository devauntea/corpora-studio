# Reaching 1:1 body fidelity: research and roadmap

Implementation update, 6 November 2026: [Form Studio 0.16 / body revision 8](body-refinement-0.16.md) implements a free-tool subset: individual muscle-head projection, a Blender-polished chest, original procedural pores, angle-driven wrinkle shading and matched-camera render review. The research below describes the state at the time it was written and remains a broader roadmap; registration, contact simulation and reference-level validation are not completed.

Research notes, 5 November 2026. Five research tracks ran in parallel, followed by adversarial license checks on every recommended asset and a completeness critique. Nothing here is built yet. "1:1" means reaching the reference sheets' visual and anatomical quality with an original, legally redistributable asset. It does not mean copying TattooSmart's meshes, textures or UV layouts; those references stay private visual material.

## Summary

| Gap today (revision 7) | What closes it | Fit | Size |
|---|---|---|---|
| (a) Muscle atlas too coarse (no muscle heads, serratus slips, scapular spine, tendons, veins) | **BodyParts3D 4.0 from DBCLS, now CC BY 4.0** (verified), which has separate meshes for the heads; registered onto hm08 with non-rigid ICP | ✅ License-clean, no share-alike | M–L |
| (b) Surface is ≤3 mm procedural relief, far from ZBrush sculpt quality | **A commissioned anatomy sculpt** on our own mesh, delivered as vertex deltas plus normal maps through a headless Blender pipeline | ✅ Only credible route to sculpt quality; needs budget | L |
| (c) No contact creases or flexed muscle shapes when posed | Correctives solved offline by simulation (XPBD/projective dynamics) and stored per pose, plus a clean-room implicit-skinning contact pass and procedural muscle-flex primitives | ✅ Our own code | M–L |
| (d) No pores, wrinkles or normal maps | Second UV set + 4K baked normal/cavity maps, our own procedural pore tile, joint-angle wrinkle maps, pre-integrated skin shading, KTX2 compression | ✅ | M |
| (e) No objective measure of "1:1" | ANSUR II proportion checks, landmark error, matched-camera silhouette tests on an owned photo set, FLIP/LPIPS regression, a blind expert panel | ✅ Dev-only tools | M |

**Ceiling without a sculptor:** registering BodyParts3D, simulated correctives and skin detail will make the bodies anatomically correct and well behaved in poses. ZBrush-level surface quality still needs a human sculpt.

## Key findings

### 1. Most of the "coarse atlas" problem is self-imposed, and there is a license-clean source

- **The source we already have contains the muscle heads.** The Z-Anatomy file on disk has separate objects for: the deltoid's clavicular, acromial and spinal parts; the triceps' three heads; the biceps' two heads; brachialis and brachioradialis; the trapezius parts; serratus; the external oblique origins; infraspinatus and teres; the erector columns; the gluteals; the four quadriceps heads; sartorius and gracilis; the split hamstrings; both gastrocnemius heads, soleus, tibialis and the fibulares; the calcaneal tendon and patellar ligament; the patella, malleoli and acromion; and the superficial veins.
- **Our build throws that detail away.** [scripts/bake-muscle-atlas.py](../scripts/bake-muscle-atlas.py) merges the heads into 36 groups by substring matching. It also registers the anatomy with a hand-tuned piecewise affine map plus a ray-cast, not surface-to-surface registration.
- **BodyParts3D has been relicensed to CC BY 4.0** (no share-alike; license page updated 27 Feb 2025; verified twice): <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html>. The NBDC terms add no commercial restriction. Its IS-A OBJ set has separate meshes with their own IDs for the triceps heads (FMA37692/37694/37693), the deltoid parts (FMA34677/78/79), the gastrocnemius heads (FMA45956/45959), the biceps femoris heads, semitendinosus, vastus medialis, serratus, external oblique, and the cephalic, basilic and great saphenous veins. Download: `isa_BP3D_4.0_obj_99.zip` (136 MB): <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html>.
- **Z-Anatomy (our current source) is CC BY-SA 4.0.** Its own credits still cite BodyParts3D as BY-SA 2.1 JP. Under CC BY-SA §3(b), adapted material must be shared under BY-SA. Whether body vertex positions displaced by that field count as "Adapted Material" is an open legal question (see Decisions). Rebasing on the DBCLS CC BY 4.0 data avoids the question for all future revisions.
- **Our own records are out of date.** `assets/anatomy/atlas/source.json` and `docs/dependencies.md` should be corrected once the source changes.
- **Registration:** trimesh `nricp_amberg` (MIT), aligned per limb segment from bone landmarks, then propagating to the muscle, bone and vein meshes (the "Anatomy Transfer" recipe, Ali-Hamadi et al. 2013): <https://trimesh.org/trimesh.registration.html>. This keeps the r6/r7 vertex order, so tattoo anchors survive.
- **Limits:** BodyParts3D is one adult male. Female breast and gluteal fat distribution, hands, feet, neck and the face need separate handling. Its published OBJs are 99%-reduced and coarse in places (for example the lower border of the serratus).
- **Smaller wins:** the MakeHuman **Arms 01** target pack (CC0, verified) adds elbow dimples, upper and lower arm shape and the armpit. Native hm08 vertex indexing is likely but must be checked.

### 2. Sculpt-grade surface needs a person; the pipeline to ingest it can be automated

- **Blender 4.5.9 headless** works from the already-downloaded dmg without installing it (`hdiutil attach` then `Blender -b --factory-startup -P job.py`). It was tested on this M4: the hm08 mesh at 1.19M vertices builds in 1.9 s, and multires reshape and bakes run. Blender is GPL, but that only matters if we ship Blender itself or bpy scripts; meshes and maps we author are ours (verified: <https://www.blender.org/about/license/>).
- **Two-band detail contract:**
  - Mid-frequency form (wavelengths above about 2 mm) goes into per-vertex deltas at the shipped resolution, the same format as revision 7, so vertex identity is kept.
  - High-frequency detail (tendons, veins, striations, pores) goes into a 4K tangent-space normal map plus a cavity map on a second UV set (`uv1`, bound with three.js `texture.channel = 1`), so the tattoo chart UVs are untouched.
- **Commissioning:**
  - Start with a paid test on one region (posterior arm plus scapula) on our supplied mesh.
  - Then fit male and fit female master sculpts, with the average builds as reduced layers and the hero pose correctives.
  - The contract needs a full copyright assignment, a moral-rights waiver, the source files with vertex order preserved, and a warranty that no third-party scans or maps were used. TexturingXYZ's terms (§9) also forbid using their maps through a contractor.
  - Forum and marketplace rates run about $25–150/h; there is no anatomy-specific rate survey.
- **What a normal-map bake of our current relief does not do:** it re-encodes the same procedural fields at a finer resolution. It adds no anatomy and no sculpt quality. Only the BodyParts3D rebase or a commissioned sculpt adds those.
- **Licensed scan detail** (TexturingXYZ, 3D Scan Store): their current terms appear to block an "anatomy viewer" use and contractor handling. Ask them for written permission, or rule these out.

### 3. Pose soft tissue: why the plane crease failed, and what works

- **Why the plane failed:** a bisector-plane clamp assumes thin limbs. On a thigh or upper arm the plane passes through the muscle mass itself; this is what hollowed the thigh in our test. The standard fix is **implicit skinning** (Vaillant et al. 2013/2014): contact forms where the two segments' distance fields are equal, which gives a flat contact patch, a crease at its edge and a bulge beside it. Its official code is GPL, so we would need a clean-room reimplementation: <https://www.irit.fr/~Loic.Barthe/implicitskinning.php>.
- **Best quality without sculpting:** offline quasi-static **XPBD/projective dynamics** with volume, strain and skin-to-skin contact (<https://matthias-research.github.io/pages/publications/XPBD.pdf>). Solve sample poses (elbow and knee 0–110°, shoulder and hip grids) and store the results as pose-space correctives **at the shipped resolution**. Storing them on the 13k cage would soften a 110° crease.
- **Delta Mush** (on joint regions only) keeps our grooves and landmarks intact through every corrective. Direct Delta Mush paper: <https://ea.com/seed/news/siggraph2019-direct-delta-mush>.
- **Flexed muscles:** VIPER-style volume-preserving muscle primitives (<https://arxiv.org/abs/1906.05260>). Each muscle or head, from the new atlas, shortens and thickens as 1/√stretch × (1 + activation), with sharper grooves when active. Add flex sliders per region, and auto-activation for poses such as double biceps.
- **Avoid:** SMPL, STAR, DMPL/Dyna and GHUM data (non-commercial or unverified), GPL implicit-skinning code, and the patented Disney hex-lattice method (US9135738B2). Meta MHR pose correctives are Apache-2.0 code, but the downloadable assets have no stated terms, so leave them off the critical path unless Meta confirms in writing.
- **Not yet covered by any track:** shoulder-blade movement for the double-biceps back, deltoid and pectoral bunching under abduction, torso flexion creases, the wrist, and reducing (not just reporting) tattoo distortion where skin compresses.

### 4. Skin detail and rendering

| Element | Detail |
|---|---|
| UV atlas | `uv1` detail atlas: start with the CC0 hm08 UVs (verified, about 0.46 mm per texel at 4K), then a Blender unwrap with seams outside tattoo zones (about 0.25–0.36 mm per texel) |
| Tangents | MikkTSpace on the **same triangulation** in Blender and three.js; rest tangents rotated by each vertex's dual-quaternion rotation at pose time |
| Pores | Our own NumPy procedural pore and furrow tile (no third-party asset), applied triplanar at true scale and blended with Reoriented Normal Mapping: <https://blog.selfshadow.com/publications/blending-in-detail/> |
| Wrinkles | Joint-angle wrinkle maps for elbow, knee, armpit and wrist (Jimenez technique, reimplemented: <https://iryoku.com/wrinkles/>), plus a cheap strain term (compressed skin rougher, stretched skin smoother) |
| Material maps | One packed map: cavity, roughness, curvature, thickness |
| Subsurface scattering | A curvature-indexed pre-integrated lookup table (Penner) replacing the wrap term |
| Tattoo ink | Stays in the albedo, under the skin's normal and roughness |
| Compression | KTX2/Basis (Apache-2.0). About 55 MiB per loaded body compressed, versus about 220 MiB uncompressed |
| Optional | MakeHuman Skins 01/02 (CC0, not yet verified) for low-frequency colour variation under the 30-tone tint; TextureCan Skin 0001 (site-wide CC0) only as a cross-check |

### 5. Defining and measuring "1:1"

Proposed acceptance tests (thresholds are engineering proposals; calibrate them on 2–3 pilot references first):

| Test | Method | Gate |
|---|---|---|
| T1 Anthropometry | Measure circumferences and lengths against ANSUR II (<https://www.openlab.psu.edu/ansur2/>) | Average builds at P25–P75; fit builds at P75–P95 for flexed biceps, chest and shoulders, with waist ≤ P50 |
| T2 Landmarks | Acromion, C7, olecranon, epicondyles, ASIS, patella, tibial tuberosity, malleoli | ≤ 10 mm each |
| T3 Muscle borders | Against an **independent** source: anatomist review, or NIH 3DPX-012628 once its license is verified. Not against the same data we registered from, which would be circular. | — |
| T4 Matched views | Camera solved from annotated landmarks (OpenCV solvePnP) against **an owned or commissioned photo set with model releases** | Silhouette IoU ≥ 0.92 (≥ 0.88 flexed); landmark error ≤ 1.5% of image height. TattooSmart sheets and bodybuilder photos stay out of automated tests. |
| T5 Poses | Elbow and knee at 0/45/90/110°, shoulder abduction 0/90° | No self-intersection; ±3% volume; tattoo-area stretch ≤ 15%; visible crease at 110° |
| T6 Regression | FLIP (BSD-3, verified) and LPIPS against approved golden renders | Per-change threshold |
| T7 Expert panel | Blind panel: an anatomist or physiotherapist, 2 tattoo artists and a character artist; Likert rubric plus a forced-choice test against reference-quality images | — |
| T8 Provenance | Every bundled mesh or texture is hashed with its license; the build fails if reference material slips in | — |

**Legal boundary:** matching features is fine. That covers the 18-region × build × sex matrix, seams routed away from tattoo zones, 4K maps and a skin-tone palette. Copying meshes, textures, exact seam layouts, distinctive region or model names, or their marketing layouts is not. Buying TattooSmart files to benchmark against needs counsel review of their single-user license.

## Roadmap

| Phase | Work | Size | Depends on |
|---|---|---|---|
| **P0 Unblock** | Free disk space (**only 7.2 GiB free, 97% used**; target 50+ GB). Run Blender 4.5.9 as a build tool. Download BodyParts3D 4.0 and record its date and SHA-256 hashes. Draft `docs/body-acceptance.md`. Start the owned photo set (long lead time). | S | Your decisions |
| **P1 License-clean anatomy rebase** | Map the BodyParts3D IDs to about 70 labels plus vein and tendon masks. Bone-landmark alignment, then non-rigid ICP onto hm08. Propagate to muscle, bone and veins. Replace the angle-placed head borders and joint-frame landmarks with registered geometry. Ship as revision 8 under CC BY 4.0 with a project-format bump. | M–L | P0 |
| **P2 Detail texture pipeline** | `uv1`; MikkTSpace on a shared triangulation; 4K normal and cavity bake; procedural pores; packed material map; KTX2; subsurface lookup table | M | P0 (parallel with P1, rebake after) |
| **P3 Pose base** | Joint-region Delta Mush; clean-room implicit-skinning contact for elbow and knee; wrinkle maps; tattoo distortion map | M | P1, P2 |
| **P4 Correctives and flex** | Offline XPBD solves for elbow, knee, shoulder and hip at shipped resolution; muscle-flex activation on the per-head atlas; scapular rig check for the double-biceps back | L | P1, P3 |
| **P5 Commissioned sculpt** | Paid test region, then male and female fit masters, average layers, hero-pose correctives, hands, feet and neck, and fat-layer masks. Delivered as deltas plus normal maps. | L, budget | P1 (sculpt on the CC BY base), P2 |
| **P6 Measurement and sign-off** | T1–T8 from P1 onward; expert panel per release candidate | M, ongoing | P0 photo set |

Gaps no track solved yet:
- **Fat layer:** how body fat should soften definition between the average and fit builds.
- **Female-specific anatomy:** BodyParts3D is male only.
- **Hands, feet and neck:** masked out of registration.
- **Shoulder and torso:** scapular movement and torso creases.

## Decisions needed from you

1. **Sculptor budget** (test region, then a full commission). Without it, gap (b) stays short of reference quality.
2. **Reference photo budget** (photographer and models with releases, flexed poses). This is the only legal input for automated closeness tests.
3. **Disk space and Blender:** free about 50 GB, and allow Blender 4.5.9 as a local build tool.
4. **Share-alike:** rebase on BodyParts3D CC BY 4.0 (recommended) or keep the Z-Anatomy BY-SA atlas. Also whether to pay counsel to settle (i) whether r7 and earlier body meshes are BY-SA adaptations and (ii) patents on Delta Mush, implicit skinning and the already-shipped centres-of-rotation skinning (Le & Hodgins 2016).
5. **Meta MHR:** skip it, or ask Meta for written asset terms.
6. **Albedo:** tint × procedural variation (recommended; keeps the 30-tone palette) or per-tone 4K maps.
7. **Scan detail** (TexturingXYZ, 3D Scan Store): ask for written permission, or rule it out.
8. **Definition of done:** "1:1" means passing T1–T8 plus the blind panel, not pixel identity with TattooSmart.

## Unverified items to check before use

- NIH 3DPX-012628 license (CC BY claimed).
- Francavilla écorché on Sketchfab (CC0 claimed; review aid only).
- MakeHuman Skins 01/02 manifests.
- Blender Studio Human Base Meshes: license page and actual detail level.
- Whether the Arms 01 pack's vertex count matches hm08.
- BodyParts3D OBJ units and axes.
- Whether KTX2 transcoding works in Tauri's WKWebView.
- Whether the hm08 UV seams land inside the 18 tattoo regions.
- Which repository `.tools/anatomy/Z-Anatomy.zip` came from: the models repository is CC BY-SA, the LluisV app repository is GPL v3.
- OpenCV and MediaPipe licenses (dev-time only).

