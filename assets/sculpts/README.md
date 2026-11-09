# Imported sculpt parts

Seven static sculpt surfaces derived from three user-supplied GLBs. Originals are preserved without modification in `.tools/sculpts/originals/`. Each entry in `public/sculpts/catalog.json` records its source URL, author, CC BY 4.0 license, input SHA-256, selected source group, geometric counts, and estimated physical dimensions.

Regenerate with Blender using `scripts/import-sculpt-assets.py`. Multipart exports are joined by authored anatomical group, welded at 0.5 micrometres, decimated for interaction, and normal-baked from the original surface (4K torso, 2K limbs). The anatomical arm retains its authored textures and geometry. These are static surfaces; they do not inherit the native body's pose or build controls. No source arm/hand or leg/foot parts are falsely combined. Dimensions are estimates, not scanned anthropometry.

Adaptations: separation, centering, scale normalization, export cleanup, triangle reduction, non-overlapping UV atlas creation on sculpt meshes, normal baking, neutral sculpt material, front orientation corrections, and preview rendering. The files remain under CC BY 4.0 with the respective source attribution.

## Additional user-generated collection (0.19.1)

Seven Tripo source files add twelve fixed surfaces, including six single-leg poses grouped under one Muscular leg library entry. They preserve their source textures and geometry. Regenerate with `scripts/import-tripo-assets.py`; details and provenance are in `docs/tripo-imports-0.19.1.md`. These additional files have user-provided provenance, not the CC BY license of the original seven parts.
