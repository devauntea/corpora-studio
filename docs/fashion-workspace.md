# Fashion workspace — 0.11

Form Studio includes 65 measurement-driven FreeSewing designs and a separate vector-pack workspace. Both work locally in the packaged desktop application and save in the same project as tattoo work.

## Sewing pattern catalog

Choose **Fashion**, search the catalog, or filter by Tops, Outerwear, Bottoms, Dresses & one-pieces, Underwear & swim, Blocks, and Accessories. The current design remains in the selector while filtering so searching never replaces work. Switching designs resets its options, custom construction and board layout; project Undo restores them. Measurements, fabric records, profiles and the vector pack are retained.

All 65 designs are pinned to FreeSewing **4.10.2**, under MIT. The 60 additions include raglan and zip hoodies, shirts, coats, jackets, trousers, shorts, leggings, dresses, skirts, swimwear, underwear, bodice blocks, hats, bags, ties and aprons. This is a library of actual local drafting engines, not downloaded previews. [The official catalog](https://freesewing.eu/designs/) identifies the upstream designs. The installed packages declare MIT; the pinned license is retained in `vendor/freesewing/LICENSE` and bundled notices.

The adapter supports complete seams, differently named boundaries and multiple source contours; it preserves cut quantities, fold/bias instructions where supplied, seam allowances, construction guides, notches, buttons and buttonholes. Multi-contour pieces remain multi-contour; direct construction editing is offered only for single closed contours. Original FreeSewing construction paths remain the authority for their shape. The Tina engine's nonfinite title position is replaced by a finite piece-center label; invalid geometry or construction marks stop export.

All required measurement keys are editable, including front bust/high-bust arcs, underbust, bust span, head, heel, ankle, inseam, upper thigh and shoulder-to-elbow. Missing values are shown explicitly. **Add missing sample measurements** fills absent values using authored examples without overwriting existing measurements. Samples are not a sizing standard or a person's data.

The original Teagan neckband, constrained shape handles, measurement profiles, JSON/SMIS interchange, independent size-series drafting, fabric records, formula-based custom pieces, and A4/Letter tiled PDF and millimeter SVG exports remain available. Assembly-guide URLs are included in exported pattern metadata/PDFs. Source design instructions and a toile are still needed to check finishing and fit.

Four evaluated packages are not offered: Gozer and Sunny produced no visible pieces in the tested configuration; Benjamin's collar-band variant did not supply a supported cutting boundary; Shale's generated waistband lacked a supported seam boundary. They are not presented as working catalog entries. Plush toys and the upstream part-library package are outside this garment catalog.

## Vector packs

Open **Fashion → Vector packs**. Start with T-shirt, tank top, sweatshirt, hoodie, shirt, jacket, waistcoat, trousers, shorts, skirt, dress or jumpsuit. Each starter contains front and back views and separate editable paths. These original Form Studio drawings are technical flats; they are not derived automatically from a sewing pattern or represented as scale cutting patterns.

- Add another front/back pair, replace the current drawings, or start from a blank canvas. Undo restores replacements.
- Add patch/welt pockets, collars, cuffs, buttons, zipper lines, topstitching and labels to either view.
- Draw custom open or closed paths. Select and move layers; resize numerically; mirror; duplicate; copy between views; change stacking order, fill, stroke and stitch appearance; hide or lock layers.
- Edit anchors and cubic handles. Choose anchors numerically for keyboard access, turn corners into curves, remove anchors, or insert one without changing the existing curve. Focus a path and use arrow keys to move it; Shift moves ten drawing units.
- Add numbered construction callouts with movable anchors/labels and written instructions.
- Record style code, revision, collection, manufacturer and finishing/sample notes.
- Enter finished-garment points of measure, measuring methods, tolerances and up to eight sizes. Changing cm/in converts existing values with retained precision; tables and exports display up to three decimals. Renaming/reordering sizes preserves values by exact size name. New size names start with blank values.
- Build a bill of materials for fabrics, trims, labels and packaging: codes, descriptions, fiber composition, color references, quantity/unit and supplier. Paths can carry the same material code.

Project Undo/Redo, local recovery, checkpoints, save and reopen include the vector pack. Standalone vector-pack JSON can be exported/imported; import is validated and undoable. Arbitrary Illustrator/SVG files are not parsed into this editor in this release. Exported SVG paths can be edited in other vector applications.

## Manufacturer handoff

**Export vector pack** or **Cmd+E** exports the chosen format. ZIP contains:

1. `front.svg`, `back.svg`, and `technical-flats.svg`: editable cubic vector paths, visible layers, path names/material codes and numbered callouts.
2. `tech-pack.pdf`: vector front/back drawings, construction instructions, size specifications, and bill of materials. Text is transliterated to the bundled PDF font's character set; JSON, SVG and CSV retain UTF-8.
3. `measurements.csv`, `materials.csv`, and `construction.csv`: quoted interchange tables with spreadsheet-formula prefixes neutralized.
4. `editable-vector-pack.json`: complete editable pack, including hidden/locked layers.
5. `README.txt`: file descriptions and scale/production notes.

PDF, combined SVG and editable JSON are also available separately. Native exports use the system file dialog and atomic writes. This creates local files for the user to send; it does not contact a manufacturer. The pack communicates the user's design/specifications; it does not automatically generate graded industrial cutting patterns from the flat or validate physical production fit.

## Persistence and bounds

Format **11** freezes format 10's project/fashion validators before migration. Formats 1–10 remain readable; old body geometry is retained, and the first save of an older file creates a new copy. Each project holds one editable vector pack; use projects/checkpoints or JSON files for separate styles/revisions.

Limits: 200 paths, 250 anchors per path, 10,000 anchors total, 40 callouts, 60 measurements, 60 material rows and eight sizes. Finite coordinate/range checks, strict object schemas, duplicate-ID rejection and size-table consistency checks apply to imports and project loading. Vector JSON imports are limited to 3 MB and generated exports to 30 MB.

## Verification

See [fashion expansion verification](fashion-expansion-0.11.md) for browser, native, geometry and artifact checks. Automated draft checks verify usable numeric output and software behavior, not sewn fit or the correctness of every upstream option combination.
