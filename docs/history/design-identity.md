> Superseded for current visual identity by [Corpora Studio 0.23](corpora-studio-0.23.md). This document records the earlier Paper & Ink foundation.

# Form Studio — Paper & Ink

## Direction

An original editorial identity for making work worn on the body. Paper is the working surface; charcoal is the frame around the work. Serif titles give discovery pages a human rhythm; system sans-serif controls remain efficient during long editing sessions. The existing FORM / STUDIO name remains unchanged.

Reference reviewed on 8 November 2026: [Rui](https://www.ruitat.info/), including home, [work gallery](https://www.ruitat.info/works), selected-work inspection, [flash placement](https://www.ruitat.info/flash), and [about](https://www.ruitat.info/about). Observed a restrained navigation frame, prominent typography, image-led collections, floating contextual controls, and a close relationship between artwork and body previews. The loading screen mentions cursor ink. We did not validate every cursor/animation state or copy the site's assets, fonts, code, copy, or layouts.

## Shared foundation

Implementation: `src/studio-identity.css`. Components retain their existing behavior and data formats.

| Role | Value / rule |
| --- | --- |
| Paper | `--fs-paper: #f4f1e9` |
| Panel | `--fs-panel: #fbf9f4` |
| Ink | `--fs-ink: #242521` |
| Secondary text | `--fs-muted: #66665d` |
| Hairline | `--fs-border: #d5d1c7` |
| Stage | `--fs-stage: #242626`, pale controls on dark chrome |
| Display type | Georgia, system serif fallback; 38–54px discovery, 24–28px section titles |
| UI type | Existing system sans stack; 12px primary controls, 10–11px secondary metadata |
| Spacing | 4, 8, 12, 16, 24, 32px token scale |
| Corners | 6px controls; restrained 5–10px cards and larger dialogs |
| Motion | 160ms state changes; 240ms short rise, cubic-bezier(.22,1,.36,1) |
| Reduced motion | Disable animation and transitions including pseudo-elements |
| Focus | Visible 2px warm-ink outline with 3px offset |

No cursor trails over editing canvases. No entrance opacity fade: it temporarily reduced small-text contrast. Appearance now offers Light, Dark, and System in the top bar. The choice persists on this device, follows OS changes in System mode, and is independent of project data. Dark mode uses charcoal editing surfaces with pale text; actual artwork, skin colors, and print paper retain their intended colors.

## Component principles

- Gallery images show the actual selectable asset. Built-in bodies use renders of the current revision9 models. Neutral thumbnail limitations are labeled. Imported models and source illustrations remain their original assets.
- Pattern cards show complete drafted seam outlines, with optional construction lines in the detail view; these are not simulated finished garments or print-scale sheets. Numbered metadata, clear selection, consistent image areas and quiet boundaries unify the galleries.
- Selected layers have both a fill and an edge marker. Skin and ink swatches expose pressed state; custom color controls remain available.
- Group drafting tools by task. Measurements and Pieces navigation closes the catalog and resets the panel scroll.
- Keep modal actions outside scrollable content. Prefer one useful scroll area to small nested scrolling boxes.
- Keep model controls at the viewport edges; drawing tools remain separate from the title and tool status.
- Preserve native focus, keyboard interaction and undo. Do not animate transformations of the artwork merely to decorate the interface.

## Future website continuity

Reuse the tokens, wordmark spacing, numbered collection language, actual work imagery, serif display headings and charcoal/paper contrast. A portfolio can use larger type and more generous pacing. The application keeps smaller controls and stable spatial relationships. No website was built or published in this milestone.

The alternate theme is implemented in `src/studio-theme.css` and preference handling in `src/appearance.tsx`. Shared surfaces use paper/panel/ink/muted/border/field/selected tokens. Dark values: paper `#1c1f1c`, panel `#252925`, ink `#ecefe5`, muted `#bcc2b6`, border `#51594e`, field `#191d19`, selected `#dfe5d6`, selected text `#1b211a`. Legacy selectors still exist; changes to specialist tools should be checked in both themes. Do not use global color inversion on artwork, SVG, images, or canvases.
