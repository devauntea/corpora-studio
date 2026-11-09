# Form Studio — research for the remaining features

Research notes, 4 November 2026. Nothing here is built. This covers the eight "Remaining original-brief work" items in [studio-completion-status.md](../studio-completion-status.md): what already exists that we can reuse, copy ideas from or use as a reference, what each license allows, and a suggested approach. Read [advanced-studio-plan.md](../history/advanced-studio-plan.md) for the earlier research (Procreate, Adobe masking, SMPL-X, MediaPipe), which this note doesn't repeat.

**Current stack it has to fit:** Tauri 2 (Rust, `main.rs` only; deps are tauri, serde, rfd, tempfile, base64), React 19, Three.js, FreeSewing 4.10.2 (`@freesewing/core` and `@freesewing/teagan`, both MIT), clipper-lib, jsPDF, zod. Body bases come from MakeHuman CC0; muscle data comes from Z-Anatomy / BodyParts3D under CC BY-SA 4.0. The app has no Web Workers and no Python.

**License key:** ✅ can be bundled in a closed or commercial app. ⚠️ needs care: GPL, share-alike or unclear terms. ❌ non-commercial, or can't run on our Mac setup.

---

## Summary

| # | Feature | Best thing to reuse | Fit | Rough size |
|---|---|---|---|---|
| 1 | More garments, grading, profiles, fabric | **FreeSewing designs** (75+ MIT packages, same engine we already use) | ✅ Direct | Medium |
| 2 | Photo garment measurement | Flat-lay photo + printed scale marker (ArUco / OpenCV) | ✅ Build it | Medium |
| 3 | 3D garment fitting / cloth | GarmentCode (MIT) as a design reference; XPBD solver written by us | ⚠️ No drop-in for Mac | Large, research-grade |
| 4 | Body coverage, seams, distortion | Anny / MakeHuman (CC0) bodies; exponential-map decals; BFF distortion | ✅ Mostly | Large |
| 5 | Photo personal body fitting | **Anny** (Apache 2.0, built on MakeHuman) + manual landmarks | ✅ but needs Python or a port | Large, research-grade |
| 6 | Drawing, warps, groups, compare | perfect-freehand, Konva; MLS / lattice warp | ✅ Libraries exist | Medium |
| 7 | Stencil output and calibration | VTracer (MIT) for vectors; printed calibration sheet | ✅ | Small–medium |
| 8 | Jobs, accessibility, Windows, notarization, portfolio | Tauri sidecars/workers, `@axe-core/playwright`, Tauri signing docs | ✅ Documented | Medium; mostly setup |

**Suggested order:** 1 → 7 → 6 → 8 (notarization part) → 2 → 4 → 5 → 3. The first four reuse mature, permissively licensed tools and fit the current architecture. Items 5 and 3 are research projects, and both should wait on decisions about a Python or native compute worker (see item 8).

---

## 1. More garment templates, size grading, measurement profiles, fabric

### What exists

- **FreeSewing design catalog (MIT).** We already run the FreeSewing engine and the Teagan T-shirt. The same engine drives about 75 published designs, so adding a garment mostly means adding a package plus our wrapper. Relevant ones: Titan (unisex trouser block), Charlie (chinos), Simon/Simone (button-down shirts), Sven (sweatshirt), Hugo/Hannah/Huey (hoodies), Brian/Bent/Breanna/Bella (bodice and body blocks), Bibi (knit top block), Sarah (skirt block), Penelope (pencil skirt), Sandy (circle skirt), Lily/Lumina (leggings), Jaeger (sport coat), Wahid (waistcoat). [FreeSewing designs](https://freesewing.eu/designs). Licenses confirmed as MIT for the two packages in our lockfile; check each new package's `package.json` before adding it.
- **FreeSewing doesn't grade.** It drafts a fresh pattern for each set of measurements instead of scaling a base size. [FreeSewing docs](https://freesewing.org/docs/about). So "grading" can mean drafting the same design against a series of measurement sets and nesting the outlines. That's simpler and more accurate than writing grade rules.
- **FreeSewing curated measurement sets.** These are measurements of real people that the project uses to test designs. [Curated measurement sets](https://freesewing.org/docs/about/site/csets). They're useful as test fixtures and as starter profiles; check their data license before bundling them.
- **Seamly2D / Valentina (GPLv3+).** This is the main open-source pattern CAD. It uses the same "sizes from measurement files" approach rather than grade-rule tables. [Seamly FAQ](https://wiki.seamly.io/wiki/FAQ), [GitHub](https://github.com/FashionFreedom/Seamly2D). We **can't copy its code** into a closed app (GPL), but it's a good reference for the general construction workspace (points, lines, curves and pieces defined by formulas over measurements). Its measurement files (`.smis` individual, `.smms` multi-size; XML) are an import format worth supporting. [Format notes](https://forum.seamly.io/t/confusion-in-saved-measurement-files/8890).
- **GarmentCode / PyGarment (MIT).** A Python DSL for parametric sewing patterns built from components (panels, edges, interfaces), from ETH Zürich. [Repo](https://github.com/maria-korosteleva/GarmentCode), [PyPI](https://pypi.org/project/pygarment/2.0.0), [paper](https://arxiv.org/html/2306.03642v2). It's a good model for how to structure a *general* construction workspace and how to attach panels with stitch definitions (which item 3 needs). It's Python, so we'd copy the ideas into TypeScript rather than run it.
- **Size standards.** ASTM D5585-21 (US women's misses 00–20 body tables) and ISO 8559-1/-2/-3 (measurement definitions, size designation, building size tables). [ASTM D5585](https://6sku3uaup9f9.din.de/en/standard/astm-d-5585/337033821), [ISO 8559-3](https://genorma.com/en/standards/iso-8559-3-2018/amp). These are paywalled. Use ISO 8559-1 *definitions* for our measurement names and how-to-measure guidance; don't ship the tables without a license.
- **Fabric specification.** For knits, the essential inputs are stretch percentage (width and length), recovery and the pattern's negative ease. Patterns that need stretch should state a minimum stretch, and the standard home-sewist check is a printed stretch gauge. [Kentucky Extension guide](https://fcs.mgcafe.uky.edu/sites/fcs.mgcafe.uky.edu/files/ct-mmb-165.pdf), [Cashmerette on negative ease](https://blog.cashmerette.com/2019/02/what-is-negative-ease-and-how-does-it-work.html). Weight (GSM), fiber, thickness and bending are the extra inputs a later 3D simulator would need (see item 3).

### Suggested approach

1. Add a generic "design adapter" around the FreeSewing engine (we currently hard-code Teagan in [fashion-draft.ts](../../src/fashion-draft.ts)). Then add 3–4 designs that cover the main block types: Titan (trousers), Brian or Breanna (bodice), Sarah (skirt), Simon (woven shirt).
2. Make measurement profiles a first-class document object: named, reusable across projects, with a source note (tape, photo, standard) and ISO 8559-1 names. Import/export `.smis` and FreeSewing JSON.
3. Grading = draft one design against an ordered list of profiles, then show a nested-outline view and grade-check export. No grade-rule engine.
4. Fabric record: name, structure (woven/knit), stretch % in both directions, recovery, GSM, fiber, and an "allowed ease" rule that warns when the fabric can't support the design's negative ease. Keep these as labeled inputs, not physics.
5. A general construction workspace (formula-driven points and curves) is the largest piece. Model it on Seamly2D's and GarmentCode's concepts, using our own code.

---

## 2. Photo-assisted garment measurement and pattern reconstruction

### What exists

- **Flat-lay measurement with a reference object.** Commercial apps (Tailored, Saisun, Size AI) all photograph the garment flat from straight above with a credit card, QR code or printed card for scale, then detect key points. [Tailored](https://apps.apple.com/us/app/-/id6673894318), [Saisun](https://apps.apple.com/us/app/%E8%B5%9B%E5%AF%B8-ai%E8%A1%A3%E7%89%A9%E5%B0%BA%E7%A0%81%E8%87%AA%E5%8A%A8%E6%B5%8B%E9%87%8F%E5%BA%94%E7%94%A8/id6746278475?l=en-US). A 2022 paper does the same with ArUco markers. It notes that any detectable marker works, and that photos where the marker wasn't detected couldn't be calibrated. [Paper](https://annals-csis.org/Volume_32/drp/pdf/8.pdf). I found no mature open-source tool for this, so we'd build it.
- **Single-image pattern reconstruction (research).** Sewformer (2023) predicts sewing patterns from one photo, trained on about 1M synthetic images. [Paper](https://arxiv.org/pdf/2311.04218). ReWeaver (CVPR 2026) reconstructs simulation-ready patterns from as few as 4 views. [Paper](https://openaccess.thecvf.com/content/CVPR2026/papers/Li_ReWeaver_Towards_Simulation-Ready_and_Topology-Accurate_Garment_Reconstruction_CVPR_2026_paper.pdf). A 2026 follow-up says Sewformer's patterns have low geometric accuracy and sometimes wrong topology. [arXiv 2601.16672](https://arxiv.org/pdf/2601.16672). Licenses on the weights weren't confirmed. These are useful as proof of what's possible, not as something to ship.

### Suggested approach

- Build the measurement step, not automatic reconstruction. Flow: capture guidance screen (flat, overhead, smoothed, marker in frame) → detect a printed marker for scale and perspective (OpenCV's ArUco module, Apache 2.0; or our own [photo-warp.ts](../../src/photo-warp.ts) four-corner perspective with a manually clicked card) → user places or adjusts measurement points → values are written into an editable pattern.
- Show "visible vs hidden" assumptions explicitly. A flat-lay photo shows one layer. Seam allowances, darts, hidden facings and the back piece under the front are assumptions the user confirms.
- Validation data: measure 10–20 garments by tape and by photo, and report the error per measurement. No vendor publishes independent error figures (Bodygram/3DLOOK only make marketing claims; [TechCrunch](https://techcrunch.com/2018/07/02/original-stitchs-new-bodygram-will-measure-your-body)), so our own small benchmark becomes the claim.
- Automatic key-point detection is optional later. Add it only if it beats manual placement on that benchmark.

---

## 3. 3D garment fitting and cloth behavior

### What exists

- **CLO3D / Marvelous Designer** are the industry reference. CLO says library fabrics are about 90% accurate. Its digital-fabric check is a 50 × 50 cm drape over a cylinder, with a pass at ≤1 cm height difference. [CLO support](https://support.clo3d.com/hc/en-us/articles/115013660747), [Fabric Digitization](https://www.clo3d.com:443/en/enterprise/fabric-service). Independent studies find a reasonable drape match but limits for precision garments (compression wear) and less realistic folds in light fabrics. [MDPI 2024](https://www.mdpi.com/2076-3417/14/22/10697), [CDATP](https://cdatp.journals.qucosa.de/cdatp/article/download/17/37). Copy the **evaluation protocol** (a drape test against a physical sample), not the software.
- **GarmentCode simulator (MIT)** drapes GarmentCode patterns using **NVIDIA Warp** (Apache 2.0). [GarmentCode repo](https://github.com/maria-korosteleva/GarmentCode), [Warp](https://github.com/Nvidia/warp). ❌ On a Mac, Warp runs **CPU-only** (no CUDA, no Metal). [Warp compatibility](https://nvidia.github.io/warp/compatibility.html). It works for offline batch jobs but would be slow.
- **libuipc (IPC contact; cloth, soft and rigid bodies).** High-quality, penetration-free contact. [Project](https://spirimirror.github.io/libuipc-web/). ❌ Requires CUDA 12.6+ [PyPI](https://pypi.org/project/pyuipc/), so it won't run on Macs. License not confirmed.
- **Blender cloth with sewing springs.** Blender can pull seam edges together with zero-length springs and freeze the result. [Blender patch](https://developer.blender.org/T31269), [Manual](https://docs.blender.org/manual/pt/latest/physics/cloth/introduction.html). ⚠️ Blender is GPL, so it's only usable as an external tool the user installs, never bundled. It's a fine *prototyping* tool, and we have the Blender MCP connected for experiments.
- **WebGPU / Rust XPBD demos.** There are small demos ([webgpu_cloth_simulator](https://github.com/ccincotti3/webgpu_cloth_simulator), [xpbdrs](https://awesome.ecosyste.ms/projects/github.com%2Fnikhilr612%2Fxpbdrs) MIT) but no garment library with stitching.

### Suggested approach

- Write our own XPBD cloth solver (Rust in Tauri, or WebGPU in the webview). Inputs: triangulated pattern pieces, stitch pairs (from item 1's construction data), the body mesh as a collider, and fabric stretch/bend/weight. XPBD is the standard real-time method and is well documented. This is the only route that runs on our Macs and can be bundled.
- Call it a **visual fit preview** until it's validated. The status doc's requirement ("physically evaluated") means: sew a toile of Teagan from a known profile and fabric, photograph it, and compare against the simulation using CLO's cylinder-drape test plus a few garment ease measurements.
- Prototype seam/drape behavior first in Blender (via MCP) so we learn what the solver must do before writing it.

---

## 4. Body detail, full body/neck coverage, connected placements, distortion

### What exists

- **Anny body model (code Apache 2.0; MakeHuman-derived assets CC0).** It's from NAVER and is built on the same MakeHuman CC0 assets we already use. It covers infants to elders, with phenotype sliders, local shape changes, a 104- or 163-bone rig and face units. [Repo](https://github.com/naver/anny), [paper](https://arxiv.org/html/2511.03589v2). ⚠️ Its `smplx` topology is non-commercial; use the default/MakeHuman topology only. It's PyTorch, so we'd either export meshes and morph targets offline or port the blending to TypeScript/Rust.
- **Z-Anatomy / BodyParts3D (CC BY-SA 4.0)** is already in use for muscles. Extend it for neck and torso coverage under the same attribution.
- **Connected placements across seams.** Our charts are UV atlases, so a design that crosses a UV seam breaks. The standard fix is a **surface-local parameterization** centered on where the design is placed: the *discrete exponential map* (Schmidt et al. 2006), computed with a modified Dijkstra pass. It's fast, works on any mesh and ignores UV seams. [Paper](https://cindygr.github.io/files/sig2006tm.pdf), [demo + source](https://dgp.toronto.edu/~rms/software/expmapdemo.html). A Three.js forum thread suggests the same thing via geodesic distance instead of `DecalGeometry`. [Thread](https://discourse.threejs.org/t/threejs-decalgeometry-alternative/39205). No ready-made Three.js implementation exists, but the algorithm is short.
- **Calibrated distortion inspection.** Boundary First Flattening (Sawhney & Crane) is the standard modern conformal flattening and includes distortion visualization. [Paper](https://arxiv.org/pdf/1704.06873), [geometry-central implementation](https://geometry-central.net/surface/algorithms/parameterization/) (geometry-central is MIT; confirm the BFF repo's own license). A simpler first version: for each triangle, compute the singular values of the 2D→3D Jacobian and color stretch/shear as a heat map. That works with our existing UVs and needs no new library.

### Suggested approach

Exponential-map decals for placements (solves cross-seam placement) → per-triangle stretch heat map (honest distortion display) → full body and neck mesh from MakeHuman/Anny CC0 assets → anatomical review by a qualified reviewer before any accuracy claim.

---

## 5. Photo-assisted personal body fitting

### What exists

- **Anny** is the clean licensing choice. It's differentiable, its authors report millimeter-accurate scan fitting, and Apache 2.0 avoids SMPL-X's non-commercial license (commercial SMPL-X needs a Meshcapade sublicense). [Anny paper](https://arxiv.org/html/2511.03589v2), [licensing write-up](https://dev.to/arkadiuss/a-3d-body-scan-for-nine-cents-without-smpl-4me1).
- **Meta MHR + SAM 3D Body** recovers a full-body mesh from one image. Sources disagree on its license (Apache 2.0 vs the SAM License with use restrictions), so verify it against Meta's own LICENSE files before considering it. [Overview](https://comfyui-wiki.com/en/models/sam/sam-3d-body).
- **MediaPipe Pose** gives 33 landmarks plus "world" coordinates in metres. The code is Apache 2.0, but the commercial terms of the model file are unresolved in Google's own forum. [Forum thread](https://discuss.ai.google.dev/t/commercial-use-of-mediapipe-pose-landmarker-full/184033). Landmarks alone can't give circumferences; scale needs a known height or reference object.
- **Silhouette + landmark fitting** is a well-studied approach (e.g., front and side silhouettes + predicted landmarks → body-model parameters). [Example paper](https://zendy.io/title/10.1111/cgf.13012).

### Suggested approach

The plan from [advanced-studio-plan.md](../history/advanced-studio-plan.md) still holds; Anny makes it buildable. Steps: user confirms landmarks on 2+ photos → user enters height (scale) and a few tape measurements → optimize Anny phenotype and local-shape parameters against landmarks, silhouettes and tape values → show per-measurement **residuals** and which inputs were missing. This needs a PyTorch (or ported) optimizer, so it depends on item 8's compute-job design. Validate on a small group measured by tape before claiming accuracy.

---

## 6. Artwork drawing, compositing, lattice warps, groups, comparison

### What exists

- **perfect-freehand** gives pressure-sensitive stroke outlines (used by tldraw). It's small and was active as of April 2026. [Repo](https://best-of-web.builder.io/library/steveruizok/perfect-freehand). Believed MIT; confirm.
- **Konva / react-konva** provides layers, groups, transforms and hit-testing in React. **Fabric.js** is stronger at image filters but has no official React binding. [Comparison](https://www.pkgpulse.com/guides/fabricjs-vs-konva-vs-pixijs-canvas-2d-graphics-2026). Both are believed MIT; confirm. Our document model already holds layers and history, so we may only want perfect-freehand plus our own canvas, not a full scene-graph library.
- **Local warps.** Procreate's Warp is a mesh with control points (see earlier research). The standard algorithm for point-based warps is **Moving Least Squares** (Schaefer 2006). Rust crates exist under MPL-2.0. [moving-least-squares](https://docs.rs/moving-least-squares/latest/moving_least_squares/). MPL-2.0 is file-level copyleft: usable if we keep its files open, or reimplement (the math is short). A lattice/grid warp is simpler: bilinear or bicubic interpolation of a control grid, rendered as a textured mesh in WebGL. Add a foldover check (negative triangle area) as the brief requires.
- **Side-by-side comparison.** Use our existing named checkpoints: render two checkpoints with a split slider or swipe view.

### Suggested approach

Lattice warp first (fits our existing four-corner transform), then MLS point warp. Use perfect-freehand for drawing. Add layer groups in our own document model. Build checkpoint comparison from existing history data.

---

## 7. Production-scale stencil output

### What exists

- **Studio practice.** Designs are made at true size (or half size at 300 DPI), exported as a high-contrast PNG with a pure white background, and printed at 100% scale (never "fit to page"). Artists print a 2–3 cm test strip first and check it with a ruler. Thermal stencil printers are the common output. [Print guide](https://print-large.pages.dev/en/blog/procreate-tattoo-design-to-print), [Phomemo guide](https://phomemo.com/blogs/guides/tattoo-stencil-printer-beginners-guide). Some apps offer needle-size line-weight presets (03RL–09RL); that's a vendor feature, not a standard. [Product page](https://www.producthunt.com/products/tattoo-stencil-maker-by-tattoodesignpro).
- **Vectorizing.** **VTracer** (Rust, MIT) handles color and high-resolution scans. **Potrace** is GPL (don't bundle it). [Comparison](https://Www.wikipedia.org/wiki/Comparison_of_raster-to-vector_conversion_software). Neither does true centerline tracing; for single-line stencils, skeletonize then trace (our own code).

### Suggested approach

- Add a **calibration sheet**: print a page with a known 50 mm square and ruler, the user measures it and enters the result, and we store a per-printer scale correction. Our PDF tiling already has scale squares, so reuse that code.
- Add **line selection**: the artist picks which contours become stencil lines and sets a line weight in mm. Export at true size with the correction applied, as PDF/PNG at the printer's DPI.
- Optionally add VTracer as a Rust dependency for SVG export.
- "Artist-approved" means having a working artist test it on real stencil paper; plan that as a review step, not a software feature.

---

## 8. Background jobs, performance/accessibility, Windows, notarization, portfolio

- **Background compute jobs.** The app currently has no Web Workers. Two layers: (a) Web Workers for image processing and contour work already in TypeScript (no new dependency); (b) Tauri **sidecar** processes for heavy jobs (Python for Anny fitting, a Rust cloth solver), with progress events, cancellation, resource limits and no network by default. This is the prerequisite for items 3 and 5.
- **Accessibility.** `@axe-core/playwright` plugs into our existing Playwright suite: `new AxeBuilder({ page }).withTags(["wcag2a","wcag2aa"]).analyze()`. [Example](https://developer.shopware.com/frontends/best-practices/testing/accessibility-testing.html). It scans the Vite build in Chromium/WebKit, not the Tauri window itself. Add manual VoiceOver passes for the native shell.
- **macOS notarization.** Needs a paid Apple Developer account ($99/yr) and a Developer ID Application certificate. Tauri v2 signs and notarizes during `tauri build` from environment variables (`APPLE_CERTIFICATE`, App Store Connect API key or Apple ID). [Tauri macOS signing](https://v2.tauri.app/fr/distribute/sign/macos/).
- **Windows qualification.** Tauri v2 documents OV certificates and Azure Key Vault (via `relic` and a custom `signCommand`). Azure Trusted Signing isn't in the official docs but can be wired in through the same `signCommand`. [Tauri Windows signing](https://v2.tauri.app/distribute/sign/windows/). Testing needs a real Windows machine or VM, a separate notice collection (as [dependencies.md](../dependencies.md) already notes) and a WebView2 check.
- **Portfolio showcase.** Per the status doc, it's a static site of finished exports. Nothing in the editor needs to change; define an "export to portfolio" bundle (images + metadata JSON) and build the site separately.

---

## Open checks before committing to any of this

- Confirm the LICENSE files for: each FreeSewing design we add, FreeSewing curated measurement data, perfect-freehand, Konva, VTracer, the BFF repo, libuipc, the Anny MakeHuman assets (the README says CC0), and Meta MHR/SAM 3D Body.
- Confirm the MediaPipe Pose *model file* (not just the code) allows commercial use.
- Decide whether shipping a Python runtime (for Anny fitting) is acceptable, versus porting the shape blending to TypeScript/Rust.
- Budget real-world validation: one sewn toile (item 3), a tape-vs-photo measurement set (items 2 and 5), artist stencil tests (item 7) and an anatomy reviewer (item 4).
