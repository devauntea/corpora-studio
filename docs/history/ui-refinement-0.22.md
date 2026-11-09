# Form Studio 0.22 — Room to draw, clear patterns, dark mode

## Delivered

- Independent Library and Inspector panel controls in the vector workspace. At compact widths the empty Inspector starts closed; selecting a path opens its properties. Closing/reopening panels preserves selection. Shorter header, grouped drawing controls, and an export-info disclosure reclaim vertical space.
- Pattern previews use complete seam outlines without filling open compound paths. This removes false wedges and dense allowance marks. A Construction lines toggle adds allowance and guide paths to the selected preview. All pieces share one scale and keep their original orientation. Packing affects the preview only, not the project, cutting layout, measurements or exported files.
- Light, Dark and System appearance in the top bar. Preference persists locally, follows live OS changes in System mode, and applies across Tattoo, Fashion and their editing dialogs. It does not dirty a study or change its saved data.
- Charcoal desks and panels with readable controls, tables, selections, error messages and focus rings. Artwork colors, model skin tones and physical paper previews remain unchanged. No global image/SVG/canvas inversion.

## Canvas room

Measured scrollable canvas bounds against 0.21.0:

| Window | Previous | New default | Both panels closed |
| --- | --- | --- | --- |
| 1080 × 720 | 700 × 282 | 890 × 338 | 1080 × 338 |
| 1440 × 940 | 995 × 496 | 995 × 540 | 1440 × 540 |

The compact default has 52% more canvas area; the larger default has 9% more. This measures workspace room, not an increase in artwork scale. The SVG remains aspect-preserving.

## Evidence

- [Canvas measurements](../../qa/ui-022/vector-layout-metrics.json)
- [Light/dark comparison gallery](../../qa/ui-022/comparison.html)
- [Dark screenshots](../../qa/ui-022/dark) and [light screenshots](../../qa/ui-022/light) — eight screens at two sizes per theme.
- [All 65 drafted-pattern previews](../../qa/ui-022/patterns/all-65.png)
- [Theme checks](../../qa/ui-022/theme-tests.log), [core audit](../../qa/ui-022/theme-audit.json), [specialist audit](../../qa/ui-022/theme-specialist.json)
- Reproducible captures: `node scripts/capture-ui-022.mjs dark`, `node scripts/capture-ui-022.mjs light` with the development server running at port 1420.

## Validation

- 686 unit tests passed, including preview geometry and starter-size checks. `qa/ui-022/unit-final.log`.
- Ten theme scenarios passed across Chromium and WebKit, covering both window sizes, persistence, live OS changes, studio switching, unchanged project JSON and preserved vector colors. Separate audits reviewed 22 dark states with zero remaining reported accessibility violations. This is targeted testing, not an accessibility certification.
- Pattern-library construction toggle, vector panel selection behavior and drafting/export regressions were checked separately.
- TypeScript and production web build passed; existing chunk-size/dynamic-import warnings remain.

- Twelve final production WebKit scenarios passed: compact/large vector panel layout and selection, optional pattern construction detail, five theme scenarios, fashion navigation, surface drawing/erase/undo/save/flex, and browser unsaved-change protection. `qa/ui-022/production-final.log`.
- The macOS 0.22.0 bundle was built, copied to `releases/Form Studio 0.22.0.app`, locally ad-hoc signed and verified with `codesign --verify --deep --strict`. Version metadata reports 0.22.0. `qa/ui-022/desktop-build-final.log` and `qa/ui-022/signature.log`. The bundle is not notarized; native save/open dialogs were not re-tested in this milestone. Earlier releases and the running app were preserved.
- Final light/dark screenshot review corrected the remaining thumbnail backing and status-bar contrast. `git diff --check` passed. No commit or publication was performed.

## Limits

The pattern library is a visual selection tool: previews are not at print scale and do not simulate sewn garments. Artwork boards and printed-piece paper remain light in dark mode. Compact panels scroll normally. This milestone changes interface behavior and presentation, not body geometry, muscle deformation or tattoo projection. Native save/open dialogs are not requalified by browser tests.
