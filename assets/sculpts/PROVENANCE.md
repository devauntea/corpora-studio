# Imported sculpt asset provenance

These seven static surfaces are adaptations of three GLBs supplied by the user. Attribution and the CC BY 4.0 designation below are preserved from each input’s embedded `asset.extras` metadata. Original downloads are preserved byte-for-byte in `.tools/sculpts/originals/`.

## Sources

- **06 Torso** — Osama Elhadidi (https://sketchfab.com/osamaelhadidi)
  - Source: https://sketchfab.com/3d-models/06-torso-27cc1020d63e4d37b38d259378e39d3a
  - License: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
  - Original: `06_torso.glb`
  - Original SHA-256: `977d62e0f9e16eb9379d7f08d07e21ceb7066a1e82c5f29574afa9dddafb4a9c`

- **Anatomy - male arm** — 3dmaven (https://sketchfab.com/3Dmaven)
  - Source: https://sketchfab.com/3d-models/anatomy-male-arm-af9a4101fa2c483cab363cf0a629762f
  - License: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
  - Original: `anatomy_-_male_arm.glb`
  - Original SHA-256: `bf93d5972b938a62c5e35e3b56bf98e573989178b8dbf7d2f0e301833882184d`

- **Male Body Parts Sculpt** — gabrielmendesm (https://sketchfab.com/gabrielmendesm)
  - Source: https://sketchfab.com/3d-models/male-body-parts-sculpt-aaa5435a7c63432494f2d54e8d02ddc1
  - License: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
  - Original: `male_body_parts_sculpt.glb`
  - Original SHA-256: `2e8d1b1c091bb270a8e01706c9320e4df3329b8d4c0581aa7c84d700d3da80e0`

## Adaptations

The source multi-part scene is separated using its authored groups: `1tronco` (torso), `2bracos` (shoulder-to-wrist arm), `3maos` (hand), `4pernas` (thigh-to-ankle leg), and `5pes` (foot). Mesh fragments within each anatomical group are joined; no arm/hand or leg/foot combination is fabricated. The independent torso and anatomical arm remain separate additional assets.

Adaptations include bounding-box centering, estimated adult dimensions, front-view orientation corrections, sub-micrometre duplicate-vertex welding, indexed triangulation, and silhouette-preserving decimation. The dense source torso was reduced from 992,908 to 220,000 triangles. Detail normal maps are baked from the preserved dense surfaces: 4096 × 4096 for torsos, 2048 × 2048 for limbs. All sculpt detail charts are non-overlapping atlases; the source arm/hand UV layers contained near-zero coordinates and were not usable for baking. The anatomical arm retains its original geometry and three embedded material textures.

The neutral clay material and rendered thumbnails are also adaptations. The native source anatomy and muscular detail are preserved; no claim is made that the imports are medically validated, rigged, or anthropometrically measured. Dimensions are useful estimates for tattoo placement preview. Source chest/back sculpt style varies by author.

## Outputs and verification

Every exported GLB has one mesh, one indexed triangle primitive, finite positions/normals/UV coordinates, and embedded images. All exports are below 250,000 vertices and 500,000 triangles. Blender preview renders were checked from front/back/side for torso, arm and leg surfaces, and for hand/foot isolation. The torso-study orientation and foot thumbnail framing were corrected during this review. `validation.json` records exported counts; each part JSON and the runtime catalog record the input and output hashes.

| Output | Triangles | Exported vertices | SHA-256 |
|---|---:|---:|---|
| `torso-study.glb` | 180,000 | 98,020 | `7a7a6e12d7d2f793bc3346d34e70a80a469d5271c8b79c8eda2d7c37ba24355a` |
| `anatomical-arm.glb` | 2,135 | 1,211 | `fce9768632add381b04ca3ff56de2f5b4604b95c69a908b74c0c1add63a8aa2b` |
| `sculpt-torso.glb` | 220,000 | 114,676 | `f2d837537ea426d0778586e3e9dbf8735b48c578aec33fa143dc19976c04cc5b` |
| `sculpt-arm.glb` | 150,000 | 77,680 | `3bd7d323b342d69579b5f266c836e1eb03e67eaf6802e841017a20855cae35ce` |
| `sculpt-hand.glb` | 120,000 | 64,325 | `f49686d3f26a378cd061bd5e175c756a5ad59e867c45a80b29e7b7d2595bd665` |
| `sculpt-leg.glb` | 180,000 | 94,087 | `4efe958ac40b2e74d093981f36a0fe0de722171058371eb27e683d1d60f2c6ff` |
| `sculpt-foot.glb` | 140,000 | 73,772 | `855fdf207b106ca5a9b2f40d47978e4120a0759cab4482bb301d841e91616519` |

Regenerate using Blender 4.5 with `scripts/import-sculpt-assets.py`. The script writes only the imported-sculpt outputs and staging area; it does not modify the native body mesh or its tattoo anchors.
