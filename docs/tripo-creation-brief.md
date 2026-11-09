# Models to create manually in Tripo

No API credits are needed for editing already exported GLBs. Use only whatever generations your Tripo Studio account already includes; no additional purchase is required by this plan.

## Priority order

1. **Fit adult female, full body with skin.** Athletic, natural proportions, visible but restrained shoulder, back, abdominal and leg definition.
2. **Average adult female, full body with skin.** Softer abdomen, hips and limbs; realistic proportions rather than an exaggerated hourglass.
3. **Average adult male, full body with skin.** Natural abdomen and chest, moderate body fat, no bodybuilding exaggeration.
4. **Fit adult male, full body with skin**, only if a new generation clearly improves on our existing male assets. Prioritize rounded pectoral borders, scapulae, deltoids, elbows, kneecaps, hands and feet.
5. **Detailed hands and feet**, only if the full-body results have merged fingers/toes or poor joints. These would be reference/repair assets; they do not automatically attach to another body.
6. **Female muscle anatomy**, optional after the skin bodies are good. Use the same neutral pose as the skin body. An independently generated anatomy model will still need alignment and mesh work; a matching prompt does not make the meshes interchangeable.

We already have male muscle anatomy, arms, forearms, torsos and multiple leg poses. Do not spend your available generations producing more copies of those yet. Send one successful body first so its quality can be checked before generating the whole set.

## Shared prompt

Replace the bracketed description for each body:

> https://www.ruitat.info (main example)

Use the same camera/pose references across the set when the tool permits. A prompt is a target, not a guarantee: inspect the result from all sides.

## Before exporting

- Rotate through front, back, left and right views.
- Check for five fingers and toes, separated limbs, complete wrists/ankles and a sensible spine.
- Reject obvious holes, doubled limbs, fused fingers, lumpy chest/back geometry and extreme asymmetry.
- Prefer real surface detail over shadows painted into the texture. A smooth-looking front image can conceal bad geometry.
- Export **GLB at the highest geometry/texture quality available to your account**. Keep the original export unchanged and use clear names such as `fit-female-a-pose.glb`.
- Include the prompt and any export settings you know. Keep any download/license receipt with the source file.

## Work we can do locally

Blender can clean, split, cap, orient, scale, retopologize, smooth, bake maps and prepare skin/muscle variants without the Tripo API. One full body can supply left/right full arms, forearms, torso, legs, neck and head.

The first anatomy-derived collection uses the existing `human anatomy model 3d.glb`, with a matched skin-envelope morph on each section. Switching surface views preserves vertex identity and tattoo charts. The envelope is an illustrative prototype: it is not a finished realistic skin/fat model, medically validated anatomy, or a muscle simulation. These imports retain their fixed source pose. The original imports and the app's separate rigged bodies remain available.

For a polished skin body, a good complete skin export provides a stronger starting point than simply recoloring exposed muscles. We can then register the anatomy beneath it and build suitable pose corrections locally.
