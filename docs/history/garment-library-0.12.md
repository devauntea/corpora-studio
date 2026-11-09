# Garment library and workspace UI — 0.12

Local implementation and verification record, 5 November 2026.

## Delivered

- The supplied `vectors.zip` contains 112 PNG sheets. Originals are preserved with SHA-256 hashes. The local library offers 217 separately traced views across seven garment/accessory categories, with name search, favorites, view selection, original/trace comparison, and placement on either artboard or as a two-view pair.
- Traces contain editable grayscale Fabric, Highlights and/or Linework layers. Compound contours preserve small islands and holes; point editing, transforms, SVG/PDF export, editable JSON and project persistence support these contours.
- Replacing a destination changes only its drawings/callouts. Size specifications and materials survive. Placement is undoable. Generic starter names follow replacement assets, while custom names are retained.
- Direct Fashion workspace tabs, searchable Cmd/Ctrl+K quick actions, panel focus mode, clearer project/save controls, fewer duplicate export controls, and monochrome styling improve access to the existing tattoo and fashion tools. The asset gallery uses the full workspace height without the drawing editor's repeated header.
- Project format 12 validates and migrates formats 1–11. Vector pack format 2 validates and migrates format 1. Frozen legacy validators prevent newer compound-path structures from being accepted as an older format. Existing body surfaces remain unchanged.

## Asset conversion

`scripts/import-garment-assets.py` rebuilds the collection from the supplied archive. Its offline environment uses Pillow 11.3.0, numpy 2.0.2, scipy 1.13.1 and [VTracer 0.6.15](https://pypi.org/project/vtracer/). These conversion tools are not runtime application dependencies. Example:

```sh
python3 -m venv .tools/asset-env
.tools/asset-env/bin/pip install Pillow==11.3.0 numpy==2.0.2 scipy==1.13.1 vtracer==0.6.15
.tools/asset-env/bin/python scripts/import-garment-assets.py /path/to/vectors.zip
```

Source masks exclude white lettering outside garment silhouettes. Splitting uses empty gutters and rejects insignificant fragments, preserving complete accessories. Tracing uses a three-tone palette and polygon edges at a maximum 1800 pixels per view. Polygon tracing avoids the exaggerated curves found in the initial spline conversion. Original PNGs are not modified.

The resulting paths are automatic traces, not recovered source vectors. Shades, antialiasing and very fine stitching can differ from the originals. Filled linework is editable geometry rather than semantic seams/stitches. Related color layers must be moved consistently when transforming a whole garment. There is no arbitrary Illustrator/SVG import or automatic industrial pattern generation.

The source archive SHA-256 is recorded in `public/garment-assets/provenance.json`, with original per-file hashes, source dimensions and view counts in `catalog.json`. No license was supplied in the archive; no new license or public redistribution right is asserted for the artwork.

## Verification

- All 165 unit tests passed, including every original file's SHA-256/dimensions, all 217 view geometry bounds, compound contour transforms and exports, destination replacement, legacy migrations and saved-project round trips.
- Reviewed source/trace contact sheets for all 217 views and larger hoodie/cap comparisons. Previews preserve view order without cutting through garment silhouettes. A two-view pair uses a common drawing scale.

- The full Chromium/WebKit run exercised 52 scenarios. Its three failures were a recovery-status selector that still targeted the old header and WebKit focus restoration in the new command menu. The status now has a visible footer location, the selector follows it, and the menu restores its trigger focus. All six affected library/recovery checks then passed across both browsers; the other 49 full-run checks passed.
- Six production WebKit scenarios passed against compiled assets under the desktop Content Security Policy: library discovery/editing/handoff, favorites and four-view selection, keyboard focus, recovery, vector packs, expanded pattern catalog and custom drawing. The library and command menu passed the included automated WCAG A/AA checks.
- Six native Rust release tests passed, with the existing HEIC local-fixture test intentionally ignored. Updated tests cover project format 12 and vector format 2 export envelopes, signatures and byte-preserving writes.
- TypeScript, Vite compilation and whitespace/diff checks passed. Existing large-chunk and ineffective-dynamic-import build warnings are nonfatal.

Screenshots and source/trace contact sheets are in ignored `qa/garment-library/`. Reproducible behavior checks are in `tests/garment-library.test.ts`, `tests/e2e/garment-library.spec.ts` and the existing vector/recovery suites.

## Packaged application

`releases/Form Studio 0.12.0.app` was built successfully, copied to its versioned release path, locally ad-hoc signed, and passed `codesign --verify --deep --strict`. Its bundle metadata reports 0.12.0. The final compact-gallery adjustment also passed both production WebKit library scenarios. Manual browser inspection verified panel focus/restore in the tattoo and pattern workspaces; the asset placement buttons remain visible at the 1080 × 720 minimum window size.

Executable SHA-256:

```text
531b70abb922640e436caf09c2d1807457022dae6565c68c117973620763a6d4
```

The bundle is a local Mac build, not notarized for public distribution. Native save/open dialogs were not manually exercised in this pass; browser downloads and Rust envelope tests do not establish native dialog interaction. The older running app session is preserved.
