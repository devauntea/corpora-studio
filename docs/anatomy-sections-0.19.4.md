# Anatomy-derived sections — 0.19.4

The existing user-provided `human anatomy model 3d.glb` now supplies a separate collection with ten selectable sections: full body, torso, left/right full arms, left/right forearms, left/right full legs, neck and head. The originals retain their IDs and geometry.

In **Choose body → Imported sculpts → Anatomy-derived body**, choose a section. In **Body model**, turn **Muscle display** on for the source colored anatomy, or off for the preview skin envelope. Skin tone and model rotation controls work with this collection.

The muscle view and envelope share render topology, canonical tattoo vertex IDs, source texture UVs and the tattoo chart. A saved tattoo stays on corresponding vertices when switching views. Changing to a different section is a different mesh and follows the existing placement-reset behavior.

## Asset construction

`scripts/build-anatomy-sections.py` imports the normalized source GLB in Blender, welds coincident vertices, derives a volume-preserving smoothed envelope with a regional soft-tissue offset, cuts body sections, removes disconnected fragments, caps section openings and exports the envelope as a matching morph target. Each output has source/output hashes and its derivation recorded in `assets/sculpts/`.

This is an illustrative prototype, not finished realistic flesh. The source's hard muscle separations and generation artifacts remain visible in places. The current envelope does not model fat distribution, sliding skin, muscle contraction or medically accurate soft-tissue thickness. Section cut planes are approximate, and the dimensions are estimates. Imported sections keep their fixed A-pose. The app's existing independently rigged bodies are unchanged.

No Tripo API requests or paid generations were used. The new exports inherit the user-provided source provenance; no CC0 or other third-party license is asserted for them.

## Checks

- Frontend unit suite: 680 passing tests, including every new GLB's morph bounds, stable canonical vertex identity, matching tattoo UVs and project round trips.
- Browser checks exercise all ten sections in both views, connected tattoo placement, unchanged saved anchors, save/open and the single collection card.
- Production WebKit checks passed for all ten paired sections, all 29 imported surfaces, skin/orientation persistence, and the six-leg-pose collection. The all-imports test required a more specific summary selector after the Tripo connection panel was added; it passed after that test-only correction.
- Desktop 0.19.4 built successfully and its copied release bundle passed ad-hoc signature verification. It is not notarized.
- Native save/open dialogs are not newly verified in this change; browser save/open and the desktop bundle build are separate checks.

See [the manual Tripo creation brief](tripo-creation-brief.md) for the next useful models and export instructions.
