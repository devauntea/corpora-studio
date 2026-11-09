# Rotation controls and Tripo connection — 0.19.3

Imported model X/Y/Z rotation and tattoo rotation now have continuous drag sliders, exact degree entry, ±15°/±90° steps and individual reset buttons. Forearm twist on adjustable anatomical arms has the same controls but clamps at its joint limits. Whole-turn controls wrap naturally through 0°/360° (models) or −180°/180° (tattoos). Slider gestures use one undo transaction, including keyboard adjustments. Pointer capture and explicit track positioning provide consistent dragging in WebKit and Chromium. Lay model horizontal and Reset model rotation reframe the model after the change.

## Tripo

The Body model inspector includes Tripo connection → Check Tripo connection. The native Rust command reads the locally saved key from `~/.config/form-studio/tripo-api-key` and sends an authenticated GET to the fixed official `https://openapi.tripo3d.ai/v3/account/balance` endpoint. The key is never returned to frontend code, added to project data, bundled, or printed. Redirects are disabled, the request has a 25-second timeout and a 64 KB response limit, and errors do not echo remote response bodies or credentials. Only validated connection/balance/frozen-credit fields reach the UI. The browser preview cannot access the saved native credential.

The initial saved value was a Client ID. The user replaced it with the secret API key. Both the Python account check and the native Rust client authenticated successfully on November 7, 2026. At verification the available and frozen API balances were both 0. No generation, model upload, paid processing or other billable task was requested. Setup now rejects Client IDs before saving, with an actionable explanation.

This integration verifies account access and provides a reusable native connection. Generation and rigging controls are not part of this update. Tripo API credits are separate from Studio credits: https://platform.tripo3d.ai/docs/faq. Account endpoint: https://developers.tripo3d.ai/en/docs/account.

## Validation

- 670 frontend unit tests passed.
- 9 native unit tests passed; the explicit live read-only Tripo account integration test also passed.
- Chromium and WebKit passed drag rotation, quick turns, reset, one-step undo and saved tattoo-angle checks.
- Production WebKit checks cover the new rotation workflow plus skin colors, full-axis orientation and project reopen.
- Tattoo rotation controls visually reviewed in WebKit.
- Desktop build 0.19.3. Credential stays outside the app bundle. Native save/open dialogs were not re-tested for this update.
