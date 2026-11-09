# Imported model appearance and orientation — 0.19.2

Every imported sculpt now exposes the same 30 skin-tone swatches. Clicking a swatch selects Skin tone mode. The Surface colors selector restores Original colors, including the colored anatomical maps, without altering the original asset. Older projects default to their original appearance. Skin mode replaces the source color with the selected tone and retains a restrained luminance detail contribution plus the source normal/roughness maps. This is a display material; it does not reconstruct missing skin anatomy or simulate real tattoo pigment absorption.

Rotate X, Rotate Y and Rotate Z each accept 0–360 degrees. Rotation applies to the parent object containing both the surface and connected tattoos, preserving geometry, UVs and anchor IDs. Reset model rotation restores the authored orientation. These settings save with the project and participate in undo. Fit model reframes long parts after orientation changes. The floor follows the rotated bounds, and planning guides use the same rotation. Orbit controls allow the full vertical viewing range.

Optional `sculptAppearance` and `sculptRotation` fields live under the model in project format 19. The update is additive; previous studies remain readable. Earlier app builds cannot read projects containing the newly added settings, so use 0.19.2 for those projects.

## Tripo credential setup

Run this directly in Terminal:

```sh
python3 /Users/bigbobby/Projects/form-studio/scripts/setup-tripo.py
```

Enter the API key at the hidden prompt. The script atomically stores it in `~/.config/form-studio/tripo-api-key` with owner-only read/write permissions (0600), outside the repository and saved projects. It never prints the key and makes no API requests. This prepares a local credential for a later integration; it does not add generation, rigging or an API client to the desktop app. No credits are used by setup. Do not paste credentials in chat or put them in frontend environment variables.

Official authentication reference: https://developers.tripo3d.ai/en/docs/introduction — bearer authentication, global v3 endpoint. Tripo Studio and API credit balances are separate per https://platform.tripo3d.ai/docs/faq.

## Verification

- 669 unit tests passed.
- WebKit exercised skin-tone controls on all 19 imported surfaces, compared original/recolored renders, rotated all axes through 360°, and verified reset, save and reopen.
- Both appearance/orientation and existing imported-tattoo flows passed against the production build in WebKit.
- Reviewed the recolored full anatomy model and its horizontal orientation visually.
- Python setup script passes syntax compilation. No real credential was entered or validated.
- Desktop build 0.19.2; native dialogs were not re-tested for this material/orientation update.
