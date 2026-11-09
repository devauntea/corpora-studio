# Form Studio: competitive research and development strategy

Research date: **5 November 2026**. Baseline: **Form Studio 0.12.0**, commit `44fbac7`, project format 12. This report proposes work; it does not implement it.

**Recommendation:** make Form Studio dependable from editing through handoff before expanding into autonomous garment reconstruction or biomechanical simulation. The highest-return next release is **0.13 — Reliable editing and production handoff**: grouped garment editing, a clearly bounded SVG importer, export preflight, and real recipient/print trials. Establish a body-quality benchmark during the same milestone, then use it to drive the next tattoo-focused release.

Form Studio already has a substantial foundation. Its opportunity is to connect artwork, body placement, garment construction, and review through reusable local project data. Its main competitive weaknesses are editing depth, body fidelity, interoperability, and evidence of physical accuracy. Adding more catalog entries alone will not resolve those weaknesses.

Reading guide: [current capabilities](#1-scope-evidence-and-current-baseline), [competitors](#2-competitive-landscape-15-relevant-products), [feature matrix](#3-feature-comparison-matrix), [tattoo priorities](#4-ranked-tattoo-studio-recommendations), [fashion priorities](#5-ranked-fashion-studio-recommendations), [shared tools](#6-shared-platform-improvements), [technical options](#7-technical-feasibility-and-reuse-decisions), [UX](#8-uxui-direction), [differentiation](#9-differentiation-strategy), [roadmap](#10-updated-development-roadmap), [top 10](#11-top-10-recommendations), [next milestone](#12-concrete-next-milestone-and-action-plan).

## 1. Scope, evidence, and current baseline

This is a documentation, source-code, and public-source review, not a hands-on benchmark of every competing product. Public manuals establish documented workflows; they do not establish comparative speed, garment fit, anatomical accuracy, or user satisfaction.

Evidence labels used below:

- **D — Documented:** a specific feature or workflow described in an official manual, release note, repository, or platform listing.
- **M — Marketing/demo:** vendor positioning or a demonstration without independent production validation.
- **R — Research:** a paper or research implementation; commercial usability and rights require separate evaluation.
- **U — User report:** an anecdotal community/review observation, not a measured failure rate.
- **Proposal:** an original recommendation for Form Studio. All priorities, effort estimates, budgets, and acceptance targets in this report are proposals.

“Not verified” means evidence was insufficient; it does not mean a competitor lacks a feature. Sources were accessed for this review on 5 November 2026. Several live pages contain older material, so access date is not treated as release date.

### What already works in Form Studio

| Area | Implemented foundation | Actual remaining gap |
| --- | --- | --- |
| Body library | Fit/Average male/female; torso-only upper body, full arms/hands, legs/feet, neck and connected full body; 30 skin colors; revised chest/back surfaces | Reference-level fidelity is not demonstrated. Dedicated 4K artwork charts, detailed scan-like skin and qualified anatomical review remain outstanding. |
| Anatomy and posing | Named colored muscle guidance, arm poses, chest/back tension and double-biceps presets; attached tattoos follow deformations | Authored deformation is not calibrated skin/muscle mechanics. Compare-at-once pose review and empirical deformation checks need development. |
| Tattoo placement | Connected surface mapping across charts, numerical controls, triangle distortion inspection | Better sleeve composition, negative-space planning, registration and controlled flattening workflows. |
| Artwork/photo editing | Original images retained, crop, color-key background removal, erase/restore, pressure drawing, tone controls, groups, perspective and nine-point warp, protected existing ink | Semantic selection, richer mask/effect stacks and persistent paint layers directly on a 3D surface. |
| Stencils | Contour/centerline selection, physical line widths, mirrored tiled PDF/PNG, DPI metadata and named printer calibration | Actual printer/paper qualification and artist-approved multi-section registration. |
| Patterns | 65 pinned FreeSewing designs; measurement profiles; JSON/SMIS interchange; independently drafted nested sizes; custom formula points/curves, allowances, grainlines and notches | Seam relationships, construction validation, robust supplier interchange and production grading rules. |
| Photo measurement | Calibrated flat-lay image measurements with editable points, explicit assumptions and residual exports | Real garment benchmark; automatic suggestions only after comparison against manual work. It is not inverse pattern reconstruction. |
| Garment preview | Bounded local cloth solver, sewing constraints, pins, body contact, strain/gap reports, cylinder comparison workflow | Self-contact, robust continuous collision handling, calibrated directional textile behavior and real garment fit evidence. |
| Vector packs | 12 original starters, 112 supplied PNG sheets represented as 217 editable traced views, searchable/favorite asset library; paths, cubic handles, layers, callouts, POM tables and BOM; SVG/PDF/CSV/JSON/ZIP | Multi-selection, groups, reusable linked components, general SVG import and recipient-tested handoff. Traces are not recovered original vectors or cutting patterns. |
| Shared desktop | Local recovery, checkpoints, comparison, undo, versioned files, bounded cancellable workers, command search, focus mode, keyboard alternatives, monochrome interface | Native accessibility/hardware qualification, deeper workflow consistency, review annotations and larger-document performance. |
| Distribution/portfolio | Local Mac bundle and a static finished-work portfolio export | Public signing/notarization and actual Windows qualification. The website remains a display of finished work, not a second editor. |

Baseline sources: [implementation status](../studio-completion-status.md), [0.12 garment library](../history/garment-library-0.12.md), [fashion workspace](../fashion-workspace.md), [body fidelity limits](../history/body-fidelity-0.10.md), and [implementation details](../history/next-features-implementation.md). Targeted source checks included [vector schema](../../src/vector-pack.ts), [vector editor](../../src/VectorPackStudio.tsx), [cloth solver](../../src/cloth-solver.ts), [body fitting](../../src/body-fitting.ts), and [compute worker](../../src/compute.worker.ts).

The earlier [next-features research](next-features-research.md) remains useful historical context, but statements about only having Teagan, no workers, absent photo measurement, and missing stencil calibration are superseded. Its licensing shorthand also needs care: GPL permits commercial distribution subject to its obligations; it is not a blanket commercial-use prohibition. Independent redrafting is not inherently more accurate than industry grade rules.

The software test record is not physical validation. Real stencil prints, sewn samples, tape measurements, anatomical review, native assistive technology, and distribution signing remain separate gates. No new application tests or physical trials were performed for this research-only report.

## 2. Competitive landscape: 15 relevant products

### Tattoo, artwork, and vector tools

| Product | Documented workflow, visualization and interchange | AI / evidence level | Strength, limitation and lesson for Form Studio |
| --- | --- | --- | --- |
| **Tattoo Smart** | An asset ecosystem used with Procreate. Its Body Parts collection lists 72 male/female, Fit/Average limbs and torsos; its FAQ describes USDZ model import. **D/M:** asset formats and catalog are documented; natural placement quality is a vendor claim. [Body Parts](https://tattoosmart.com/products/body-parts), [FAQ](https://tattoosmart.com/pages/faqs) | This reviewed workflow is authored assets plus painting; AI is not required. | A beginner can start from a recognizable body section instead of preparing a mesh. Model quality and seam placement are useful benchmarks. It relies on a host editor; screenshots and an asset purchase do not establish redistribution rights for Form Studio. |
| **INKHUNTER** | Consumer-oriented AR tattoo preview, own-image upload, a design gallery, image capture and photo editing. Apple describes a drawn tracking marker. **D:** listing/editorial workflow; metric accuracy not established. [App listing](https://apps.apple.com/pl/app/inkhunter-ai-tattoo-design/id991558368), [Apple walkthrough](https://apps.apple.com/pl/iphone/story/id1560989793) | Current branding includes AI; the reviewed listing does not establish its model, editable output structure or offline operation. | Fast visual decision-making is its appeal. AR preview is not evidence of calibrated stencil dimensions or skin mechanics. Adapt the short preview flow; defer a mobile AR companion until the desktop handoff is reliable. |
| **Procreate** | Pen-first drawing and layered painting on UV-mapped OBJ/USDZ models, with 3D transforms and presentation/export workflows. Official guidance explicitly discusses poor, overlapping or missing UVs. **D.** [3D handbook](https://help.procreate.com/procreate/handbook/3d-painting), [UV requirements](https://help.procreate.com/procreate/handbook/3d-painting/basics) | AI generation is not established by these reviewed 3D docs. | Strong direct manipulation and a canvas-led experience for learners and working artists. Mesh preparation remains a separate skill. Form should make seam quality and texture resolution understandable without requiring Blender knowledge. |
| **Photoshop** | Layered raster composition, editable Smart Filters, and mask-based control; PSD-oriented working documents rather than sewing patterns. **D.** Legacy Photoshop 3D was removed in July 2024; do not recommend that old workflow. [Smart Filters](https://helpx.adobe.com/in/photoshop/using/applying-smart-filters.html), [3D removal notice](https://helpx.adobe.com/nz/photoshop/using/image-stacks.html) | Firefly Generative Fill produces a separate generative layer. **D** for operation; output suitability remains case-specific. [Generative Fill](https://www.adobe.com/products/photoshop/generative-fill.html) | Deep professional editing, with more concepts to learn than a task-specific stencil app. Adapt reversible operations and explicit generated variants; avoid silently replacing original tattoo linework or garment dimensions. |
| **TattStencil** | Image-to-stencil controls, Pencil drawing/erasing, a printer workspace supporting multi-page output, and synchronized reference views. **D:** guide describes the sequence from preparation to printing and procedure reference. General editable-vector interchange was not verified. [App guide](https://www.tattstencil.com/app-guide) | Reviewed guide supports image processing; no need to describe it as generative AI. | Clear task stages serve both new and experienced tattoo artists. Form already has many stencil controls; the useful additions are linked reference views, transfer-section planning and physical print proof. |
| **Substance 3D Painter** | Specialist surface texturing with UV-tile workflows and texture-output templates; mesh export can preserve Painter-side changes. **D.** [UV tiles](https://www.adobe.com/products/substance3d/magazine/paint-across-uv-tiles-udims-in-substance-painter.html), [export](https://experienceleague.adobe.com/en/docs/substance-3d-painter/using/export/export), [output templates](https://experienceleague.adobe.com/en/docs/substance-3d-painter/using/getting-started/export/export-window/output-templates) | No AI capability is needed to justify the reviewed workflow. | A strong professional reference for persistent surface paint, materials and predictable texture delivery. UV/material/export complexity is excessive for a simple tattoo task; expose those details only when artists need them. |
| **Adobe Illustrator** | Grouped object editing, reusable symbols and artboard-oriented vector delivery; AI/PDF/SVG working/export options with format-specific differences. **D.** [Groups](https://helpx.adobe.com/illustrator/desktop/manage-objects/select-objects/group-ungroup-objects.html), [symbols](https://helpx.adobe.com/illustrator/desktop/manage-objects/traces-mockups-symbols/symbols-panel-options.html), [save formats](https://helpx.adobe.com/au/illustrator/using/saving-artwork.html), [export](https://helpx.adobe.com/illustrator/using/exporting-artwork.html) | AI is outside the evidenced comparison here; editable vector structure is the relevant benchmark. | A professional vector reference for flats and repeated trims. Format conversion can change appearance/editability. Form should implement garment-level selection and a documented SVG subset before promising general Illustrator-file compatibility. |

### Fashion, patternmaking, and simulation

| Product | Documented workflow, visualization and interchange | AI / evidence level | Strength, limitation and lesson for Form Studio |
| --- | --- | --- | --- |
| **CLO** | Integrated 2D patterns and 3D garment workflows. Its DXF controls distinguish AAMA, ASTM and standard DXF, units, grading and seam/cutting-line interpretation. **D.** [DXF documentation](https://support.clo3d.com/hc/en-us/articles/115000493067-2D-Pattern-DXF-Import-Export), [workflow overview](https://www.clo3d.com/explore/guide/2d-3d-cad-pattern-making-drafting-grading-simulation) | AI is not necessary to establish these capabilities. Avoid equating automation with verified fit. | Strong production-oriented reference; recipients still need compatible export settings. Hardware and detailed simulation cost matter. Form should borrow explicit format/units choices and publish tested receiver profiles. |
| **Marvelous Designer** | Pattern-based garment construction with simulation quality modes, avatar auto-fitting/redraping, and OBJ/FBX/Alembic/USD-family interchange. **D.** [Simulation](https://support.marvelousdesigner.com/hc/en-us/articles/47358232630937-Simulation), [formats](https://support.marvelousdesigner.com/hc/en-us/articles/47358199862553-Compatible-File-Format), [auto-fitting](https://support.marvelousdesigner.com/hc/en-us/articles/47358335130649-Auto-Fitting) | Auto-fit is documented automation, not proof of inferred manufacturing construction. | Particularly relevant to 3D asset creation. Auto-fit and redrape have different effects on garment size. Form should make “change pattern” versus “preview on another body” explicit and preserve originals. |
| **Browzwear VStitcher** | Garment/material workflow with structured tech packs, BOM, artwork placement, sizes, DXF settings and editable delivery options. Material import includes common raster/vector formats, U3M and SBSAR. **D.** [Tech packs](https://help.browzwear.com/en/articles/13066153-create-a-tech-pack), [export properties](https://help.browzwear.com/en/articles/13065820-editing-tech-pack-properties), [materials](https://help.browzwear.com/en/articles/13065600-adding-material) | The reviewed production documentation does not establish autonomous pattern reconstruction. | A useful professional handoff benchmark. Imported fabric images receive default physics unless physical data is supplied. Form should separate fabric appearance, measured behavior, and supplier identity. |
| **Seamly2D / SeamlyME** | Formula/measurement-based 2D drafting with individual and multi-size measurement files; separate draft, piece and export stages. PDF/SVG/DXF export is documented by the project community. **D.** [Repository](https://github.com/FashionFreedom/Seamly2D), [export workflow](https://forum.seamly.io/t/exporting-with-points-and-lines/16832/2) | No AI workflow verified. | Valuable for custom-fit patternmakers; understanding drafting and the piece-export distinction matters. GPLv3+ source is available under obligations. Adapt workflow concepts and interchange deliberately; do not treat source as permissively licensed components. |
| **FreeSewing** | Measurement-driven designs, editable options and browser drafting; maker documentation links designs, measurements and construction guidance. **D.** Form already embeds 65 pinned MIT design packages. [Editor](https://freesewing.eu/docs/editor/), [documentation](https://freesewing.eu/docs/), [local integration](../fashion-workspace.md) | Parametric generation is not learned AI. | Excellent reuse for personalized patterns and a low-friction starting point. It still needs correct inputs and sewing judgment. Improve measurement guidance and construction relations rather than duplicating this catalog. |
| **Valentina / Tape / Puzzle** | Measurement-based 2D pattern development, measurement management and layout. Release notes describe symmetric pieces, PDF layout improvements and DXF AAMA/ASTM compatibility fixes for CLO. **D.** [Project](https://gitlab.com/smart-pattern/valentina/), [release notes](https://gitlab.com/smart-pattern/valentina/-/releases) | No AI workflow verified. | A detailed parametric CAD reference. Release fixes illustrate why mirrored allowances, notches and external interchange require regression fixtures. GPLv3+ is a licensing decision, not a free-to-copy proprietary implementation. |
| **Style3D Studio** | 2D sewing/pattern inputs, material choice and selectable simulation modes. Its documentation connects unstable results to pattern, sewing and material setup. **D.** [Simulation guidance](https://help.style3d.com/studio/en/c4905/d2d78/19ef3) | A September 2026 vendor article demonstrates AI-controlled editable garment creation. **M**, not independently proven hidden-construction recovery or factory acceptance. [AI demonstration](https://www.style3d.com/blog/when-ai-takes-on-professional-3d-garment-creation-gpt-6-astra-style3d-studio/) | A relevant automation direction. Exact supplier-format round trips were not verified here. Form should guide correction of pattern/sewing causes before exposing more solver knobs. |
| **Tailornova** | Web-based garment configuration, measurement-driven patterns and 3D preview are described by the vendor. **M/D:** service workflow is described; fit superiority is unverified. Specific export fidelity was not established. [FAQ](https://tailornova.com/faq), [technology](https://tailornova.com/technology) | Its technology page describes single-image/sketch-to-pattern AI as work under development. Treat it as an ambition, not a shipped production guarantee. | Approachable configuration is attractive to beginners. Dependence on an online subscription contrasts with Form’s local documents. The FAQ also retains old roadmap text, limiting its usefulness for current release claims. |

### User friction: corroborated themes, not a market survey

| Evidence | What it supports | Product consequence |
| --- | --- | --- |
| Procreate users describe pixelated 3D painting and difficulty diagnosing UV quality. Its official handbook independently warns that imported UVs may be unsuitable. **U + D.** [Discussion](https://www.reddit.com/r/ProCreate/comments/1po8vci/3d_model_pixelated/), [handbook](https://help.procreate.com/procreate/handbook/3d-painting/basics) | A real discoverability problem around surface resolution; not a measured defect rate or proof that every model fails. | Preview actual tattoo detail at intended size, show resolution limits, and provide a repairable import report. |
| Separate CLO discussions report scale/geometry problems and DXF/RUL receiving-CAD issues; other participants report successful imports. **U.** [Import thread](https://www.reddit.com/r/CLO3D/comments/1iajphp/), [receiving-CAD thread](https://www.reddit.com/r/CLO3D/comments/1ii9o70/) | Interchange depends on files, versions and receiver conventions. | Test real receiver fixtures and include a dimensional control shape. A “DXF” checkbox alone is insufficient. |
| A 2025 Seamly support exchange explains the draft → piece → export distinction to a user. **U/D community guidance.** [Thread](https://forum.seamly.io/t/exporting-with-points-and-lines/16832/2) | A workflow concept can prevent completion even when the tool exists. | Offer a visible “prepare pieces for export” step with direct fixes. |
| INKHUNTER’s listing includes a 2024 trial-billing complaint and a 2025 loading-screen complaint. **U.** [Listing reviews](https://apps.apple.com/pl/app/inkhunter-ai-tattoo-design/id991558368) | Reasons to test launch reliability and communicate costs clearly; not grounds to declare systematic misconduct. | Keep local editing/recovery available and avoid obstructive onboarding or review prompts. |
| A 2023 CLO Mac discussion describes poor acceleration and confusing requirements. Newer official guidance says Apple Silicon GPU simulation arrived in 2026.1, while an older speed article still describes Windows-only GPU simulation. **U + conflicting D.** [2023 discussion](https://support.clo3d.com/hc/en-us/community/posts/22905788975257-M1-M2-support-status-Conflicting-information), [September 2026 requirements](https://support.clo3d.com/hc/en-us/articles/115000307168-CLO-system-requirements-September-2026?page=1), [speed article](https://support.clo3d.com/hc/en-us/articles/23390057463577-How-to-Speed-Up-CLO) | Historical hardware complaints must not be repeated as current universal limitations. | Publish Form benchmarks by app version, device, scene and quality mode. |

No sufficiently strong recurring-complaint sample was established for every product. The limitations in the landscape table are documented constraints or explicitly identified research judgments, not invented review consensus.

## 3. Feature comparison matrix

This matrix compares workflow depth, not feature counts. **Present** means implemented locally; **Partial** means a useful foundation exists but the stated professional workflow is incomplete; **Absent** means the reviewed code/docs do not provide it; **Unqualified** means evidence of real-world correctness is missing.

| Capability | Form 0.12 | Competitive benchmark | Opportunity |
| --- | --- | --- | --- |
| Recognizable body sections and build variants | Present; fidelity unqualified | Tattoo Smart’s focused body library | T1: body/UV quality gate and authored asset upgrade |
| Colored anatomy and flex poses | Present; authored guidance | Anatomy references supplied by the user; no equivalent validated tattoo biomechanics established | T2: pose comparison and measured deformation studies |
| Surface painting | Partial: image painting and placed artwork | Procreate, Painter | T3: persistent body paint and masks |
| Sleeve composition and seam-aware placement | Partial: connected placements/distortion | Tattoo Smart + Procreate; TattStencil printing | T2/T4: composition guides and registered transfer sections |
| Image cleanup | Present: manual/color-key | Photoshop selection/effect workflows | S3: optional semantic masks and reversible recipe |
| Physical stencil dimensions | Present; print result unqualified | TattStencil’s print stage | T4/S1: preflight plus real printer proof |
| Parametric garment catalog | Present: 65 designs | FreeSewing, Seamly, Valentina | F2: relationship-aware editing, not another catalog pass |
| Size-series drafting | Present | CLO grade interchange; Seamly measurement series | F4: explicit sizing method, later grade-rule support |
| Photo garment reconstruction | Partial: calibrated measurement only | Tailornova ambition, Style3D demo, Sewformer research | F7: constrained suggestions before inverse reconstruction |
| 3D garment preview | Present; physics unqualified | CLO, Marvelous Designer, VStitcher | F5: contact/material validation |
| Fabric records and appearance | Present | VStitcher materials/FAB | F5: measured material provenance and compatible physics |
| Technical flats and packs | Present | Illustrator, VStitcher | F1/F3: groups, components, linked POM/material checks |
| Editable SVG import | Absent as a general workflow | Illustrator SVG interchange | S1: supported subset and visible conversion report |
| Apparel DXF interchange | Absent | CLO, Valentina | F4: named receiver profiles and round-trip suite |
| Seam walking and sewing sequence | Partial: geometry, notches, stitch constraints | Pattern CAD and FreeSewing assembly instructions | F2: seam graph and construction steps |
| Nondestructive history and comparison | Present | Photoshop/Procreate layer concepts | S2: consistent command/group semantics; per-operation recipes |
| Reference collection and review | Partial: originals, checkpoints and finished portfolio | TattStencil reference view; professional tech-pack workflows | S4: linked references, local annotations, revision acknowledgment |
| Task guidance/accessibility | Partial: commands, focus, keyboard, automated checks | Procreate learning material; staged stencil/drafting flows | S2: task paths and native human testing |
| Offline core workflow | Present | Local desktop CAD; contrasts with Tailornova’s web service | S5: preserve local execution and qualify deployment |

Competitive evidence is linked in section 2. Form evidence is linked in section 1. The remaining sections specify the proposed changes and their engineering cost.

## 4. Ranked Tattoo Studio recommendations

Effort estimates assume an engineer familiar with the repository, reusable existing infrastructure, and access to the indicated specialist. **S:** roughly 3–7 engineering days; **M:** 2–4 engineering weeks; **L:** 1–3 engineering months; **XL:** longer or research-dependent. These are order-of-magnitude estimates, not commitments. Artist work, participant recruitment, device access and external review add elapsed time. Value is estimated from workflow relevance, not measured demand.

### T1 — Reference-quality body and UV pipeline · P0 · Very high value · L · High risk

**Problem and benchmark:** recognizable proportions and clean surfaces determine whether tattoo placement is useful. The user’s near-1:1 request remains unmet. Tattoo Smart provides a relevant visual target; Procreate documents why usable UVs matter. Geometry and texture quality must be assessed separately.

**Proposed workflow:** choose one of four builds; inspect identical front/back/side/three-quarter views at neutral and flex poses; toggle muscle guidance; verify full arm, torso-only and full leg silhouettes. Prioritize clavicles, lower pectorals, scapulae/lats, shoulder transitions, wrists, hands, knees and feet. Keep Average anatomically plausible rather than merely reducing a Fit mesh’s detail. Add skin-tone/lighting reference scenes and dedicated 4K region maps only where they materially improve artwork.

**Engineering:** continue the CC0 base plus an authored sculpt/retopology and pose-corrective pipeline. Bake fine detail to normal/roughness maps, retain stable placement identities, and version all geometry/UV changes. Keep the separately attributed anatomy derivative under its applicable license. Use xatlas only as an optional offline UV tool; automatic packing does not understand tattoo placement priorities. See technical options A and B below.

**Dependencies and gate:** an anatomical sculptor/reviewer, reference rubric and migration fixtures. Set mesh/texture budgets from profiling; increased polygon count alone is not success. All processing can remain local. Review topology, clipping, seams, joint folds, all four builds and tattoo continuity before calling it a fidelity upgrade. Do not promise an exact commercial-model reconstruction from screenshots.

### T2 — Pose comparison and sleeve composition · P1 · Very high value · M–L · Medium risk

**Problem:** existing flex presets require artists to remember what changed. A placement may read well at rest and poorly when bent.

**Proposed workflow:** linked rest/flex views, synchronized camera, pinned anatomical landmarks, adjustable negative-space bands, focal points and an unwrapped sleeve overview. Record chosen pose and intended transfer pose with the composition. Use the existing connected placements and distortion display; add per-layer visibility and measurement readouts across views. Borrow the synchronized-reference idea from TattStencil without copying its interface.

**Engineering and limits:** reuse Three.js, current rigs, stable anchors and checkpoint comparisons. Maintain one authoritative artwork/placement record with multiple view states, rather than divergent copies. Restrict simultaneous high-resolution render targets; test an interactive preview mode on the baseline laptop. Local photos remain local. This is achievable visualization now; muscle force, skin sliding and true tissue stretch remain experimental and must not be inferred from the color guide.

**Acceptance:** changing a design updates both views; switching poses does not lose anchors; save/reopen reproduces the chosen transfer pose; users can explain which effects are authored versus measured. Depends on T1’s topology/version contract, not completion of every new sculpt.

### T3 — Paint and mask directly on the body · P1 · High value · L · High risk

**Problem and benchmark:** placement alone is cumbersome for connecting motifs, shading gaps and building sleeves. Procreate and Painter demonstrate layered surface painting.

**Proposed workflow:** project an image, paint or erase on a separate body layer, edit a mask, mirror a stroke when requested, and inspect the same work in 2D. Preserve original source art and the paint recipe. Export flattened textures and an editable Form project; make destructive baking explicit.

**Engineering:** Three.js ray hits → surface coordinates → tiled GPU/CPU brush stamps, with seam padding and explicit chart adjacency. Reuse pressure input and brush logic, but implement surface painting as a new subsystem. Store stroke/tile deltas rather than a full 4K texture for every undo step. A single 4096² RGBA8 image is **64 MiB before mipmaps or extra buffers**; ten such layers already consume 640 MiB before history.

**Dependencies and gate:** T1 UV stability, S2 command semantics, a GPU memory budget and export parity tests. No new AI or cloud requirement. Validate seams, mirrored sides, joints, hidden-surface rejection, undo and restart recovery. Start with color/alpha painting; full material-channel painting can follow demonstrated need.

### T4 — Artist-reviewed stencil and transfer planning · P0 proof / P1 expansion · High value · M · Medium risk

**Problem:** calibrated PDFs exist, but the final paper and transfer process are unqualified. Large curved areas require deliberate sectioning.

**Proposed workflow:** keep current contour selection and calibration; add labeled transfer sections, user-positioned overlap/registration marks, orientation landmarks, a printed ruler, and a proof view identifying the selected printer profile and transfer pose. Keep registration marks separate from tattoo artwork. TattStencil supplies a clear preparation/print/reference workflow benchmark.

**Engineering:** extend current vector/PDF generation and surface mapping. A curved patch cannot generally flatten without distortion; expose stretch and let an artist split/reposition sections rather than claiming automatic distortion-free output. Use existing local CPU workers and bounded export jobs.

**Dependencies and gate:** S1 preflight, physical printer/paper access, and a tattoo artist reviewing transfers on appropriate practice surfaces. Retain calibration by printer/settings/paper combination, not printer name alone. Record measured output and failed cases. A proposed initial gate is a 100 mm check within ±1 mm on the tested configuration; that is a product target, not an industry standard or universal accuracy claim.

### T5 — Ink appearance and live try-on · P2 visual aid / P3 prediction · Medium value · L–XL · High risk

**Problem:** users want to compare contrast on different skin tones and understand placement in context. INKHUNTER demonstrates a convenient AR concept; this does not validate healed ink or skin mechanics.

**Near-term option:** improve neutral lighting, opacity/contrast controls and side-by-side tone studies using the existing renderer. Label results as visual approximations. Preserve color values and export color-profile metadata where supported.

**Research option:** a separately scoped mobile companion could use platform body/plane tracking with manually confirmed scale. Native camera permissions, tracking drift, lighting, occlusion and device qualification make this a distinct product effort. Evaluate platform SDK terms and hardware support before selecting an implementation; no reusable production-ready tattoo deformation engine was established in this review.

**Gate:** do not claim pigment matching, healing prediction or aging accuracy without artist-led longitudinal evidence. Do not prioritize AR over desktop body quality, image editing or stencil reliability. Reference photographs and live camera frames need explicit inclusion controls; they should not enter portfolio output automatically.

## 5. Ranked Fashion Studio recommendations

### F1 — Garment-level vector selection, groups and components · P0 · Very high value · M · Low–medium risk

**Problem and benchmark:** the 217 traced views have separate grayscale layers. Moving only one can misalign the garment. Illustrator’s groups and symbols offer an established interaction model.

**Proposed workflow:** click a garment to select its entire imported view; enter the group to edit Fabric, Highlights or Linework; Shift-select arbitrary paths; align/distribute; transform a front/back pair consistently. Allow reusable collars, pockets, cuffs and labels, with a clear choice to edit an instance or its source. Preserve manual independent paths.

**Engineering:** add stable group/component IDs and selection sets to the existing vector schema, with acyclic parent checks, hierarchical transforms and one undo transaction per gesture. Migrate old documents without changing their geometry. This is own TypeScript code; no editor framework replacement is required. Symbol-like reuse is functional inspiration, not copying Illustrator implementation.

**Performance/privacy:** remain local, bound nesting and expanded instances, cache bounds and avoid retracing on pointer movement. Test the most complex imported views, not only the simple starters. Gate on exact relative layer alignment, locks, duplicate/mirror behavior, export and save/reopen. This is the clearest immediate usability repair.

### F2 — Seam relationships, construction checks and sewing steps · P0 checks / P1 instructions · Very high value · L · Medium risk

**Problem:** independent curves and stitch ranges do not capture all construction intent. Mismatched seam lengths, lost notches and incorrect allowances can survive a visually plausible preview.

**Proposed workflow:** pair named seam edges; walk corresponding lengths; mark intentional ease/gather; align notches by edge distance; visualize dart intake and fold lines; generate an editable assembly sequence. Explain “sleeve cap is longer by 14 mm; intended ease is 12 mm” with a link to the relevant curves. Use FreeSewing assembly documentation and Seamly/Valentina construction concepts as references.

**Engineering:** add an explicit seam/construction graph over current pattern pieces. Use numerical curve arc lengths, dependency invalidation and existing offset geometry; distinguish seam and cut boundaries. Instructions should be authored templates linked to operations, with human editing, not an unconstrained language model inventing sewing steps. Current stack and permissively licensed drafting code suffice.

**Dependencies and gate:** stable edge IDs, measurement provenance and a patternmaker. CPU work scales with piece/edge count; cache arc lengths and run large checks off the UI thread. Qualify three garment families with real assembly review/toiles. Unknown constructions remain “unreviewed,” not automatically approved.

### F3 — Connected style specifications and sample revisions · P1 · High value · M–L · Medium risk

**Problem and benchmark:** flats, POM tables, callouts and materials exist but can disagree. VStitcher demonstrates coordinated tech-pack delivery.

**Proposed workflow:** link a callout to a component/material/POM; flag missing material codes, contradictory units and unspecified tolerances. Track requested versus measured sample values and a revision change list. Support named colorways and, later, several styles per project through separate style documents. Keep the current one-pack workflow simple for a single garment.

**Engineering:** extend existing IDs/schema and exports; keep draft body measurements separate from finished-garment measurements. Add an export manifest identifying revision and included sheets. CSV remains useful; add XLSX only if recipients request it and after selecting/verifying an appropriate maintained library. No proprietary PLM integration is required for the first release.

**Performance/privacy:** ordinary local CPU/storage; supplier/client data stays in the project unless explicitly exported. Maintain migrations and recipient templates. Depends on F1 and S1. Acceptance requires a manufacturer/sample maker to interpret the pack without guessing which revision or units apply; it does not guarantee manufacture from an incomplete design.

### F4 — Apparel DXF and explicit size-development methods · P1 · Very high value for production users · L · High risk

**Problem and benchmark:** SVG/PDF are useful delivery formats but do not provide industrial pattern semantics. CLO’s options and Valentina’s compatibility fixes show the importance of units, boundaries, notches and grades.

**Proposed workflow:** choose a tested receiving application/version, units and size-development method. Export cutting/seam boundaries, grainline, notches, piece quantity and identifiers in that receiver’s supported convention. Start with one size; add nested redrafted sizes next. Treat grade-rule tables and rule-file exchange as a separate capability, not a renamed FreeSewing size series.

**Engineering:** define a canonical apparel interchange model before adding a serializer. Evaluate MIT ezdxf as an offline oracle/fixture generator; shipping its Python runtime would be an explicit packaging tradeoff. A TypeScript/Rust adapter remains an option. A generic DXF parser does not supply AAMA/ASTM garment meaning. Obtain any needed specification permissions and supplier fixtures; do not copy proprietary SDKs.

**Gate:** round-trip several real garments with named receivers, compare dimensions and curve deviation, and verify notches/allowances/size identities. Resource use is modest for bounded documents, but ongoing receiver-version regression maintenance is substantial. All conversion can remain local. Depends on F2 and S1.

### F5 — Measured fabrics and more trustworthy cloth · P1 data / P3 physical-fit claim · Very high potential · L–XL · High risk

**Problem:** the current cloth preview can communicate shape but lacks self-contact and calibrated textile mechanics. A fabric photograph supplies appearance, not force/stretch/bend behavior. Browzwear explicitly separates image import from physical properties and provides fabric testing procedures. [Material import](https://help.browzwear.com/en/articles/13065600-adding-material), [FAB tests](https://help.browzwear.com/en/collections/17211886-fabric-analyzer)

**Proposed workflow:** material records distinguish measured, supplier-reported and estimated values; include specimen direction, thickness, mass, stretch/recovery and bend observations. Display the test source and compatible solver version. Continue to call unqualified results “drape preview.”

**Engineering:** first improve diagnostics and contact cases in the existing bounded solver. Evaluate continuous collision/self-contact and directional stretch, shear and bending; a barrier-contact solver would be a major architecture decision, not a library checkbox. IPC Toolkit provides contact building blocks, not a complete cloth solver. Warp is useful for offline experiments but currently lacks Metal acceleration on macOS. See technical option E.

**Dependencies and gate:** F2 seam graph, measured fabrics and physical samples. Use cylinder, fold/self-contact and sewn-garment comparisons with held-out cases. Maintain a fast preview and slower evaluation mode with cancellation. Budget specialist simulation work and workstation tests; do not promise real-time production physics on an untested laptop.

### F6 — Fabric layout, print matching and waste estimates · P2 · High value for makers · M–L · Medium risk

**Problem:** nested sizes are not a cutting marker. Users need to know whether pieces fit fabric width, respect grain/nap and align stripes or printed artwork. Tailornova markets layout optimization; Form can offer a transparent, editable version rather than an optimality claim.

**Proposed workflow:** a fabric-width board with quantity, fold, directional grain, print repeat and clearance rules. Show fabric length and unused-area estimates; let users lock placements and compare alternatives. A print motif can be shared with a garment flat or tattoo artwork, but scale/context remain independent.

**Engineering:** reuse current polygon/offset geometry with a bounded nesting heuristic and a collision checker in a worker. Model multi-contour pieces correctly; retain current authored cutting boundaries. No new AI dependency is necessary. Store constraints so rerunning layout does not silently rotate one-way prints.

**Gate:** zero illegal overlaps, required quantities included, declared grain limits respected, reported length agrees with the resulting layout. CPU effort rises with search time; offer a time budget and improve the best valid result progressively. Local files protect unpublished designs. Depends on F2’s piece semantics and S1 units.

### F7 — Assisted photo-to-pattern development · P2 constrained assistant / P3 reconstruction · High potential · XL · High risk

**Problem:** existing flat-lay measurement is useful, but a photograph does not reveal every seam, facing, allowance, lining or back panel.

**Proposed near-term flow:** identify likely garment category and visible landmarks; suggest a compatible existing block and bounded options; require user confirmation of unseen construction; show residuals against the calibrated image. Keep explicit dimensions authoritative. Compare correction time against today’s manual workflow before retaining automation.

**Research:** Sewformer predicts patterns from images; GarmentCode supplies a structured parametric representation; 2026 NGL research uses a language-aligned specification converted to patterns. These establish promising approaches, not guaranteed manufacturability. [Sewformer paper](https://arxiv.org/abs/2311.04218), [GarmentCode](https://github.com/maria-korosteleva/GarmentCode), [NGL v2](https://arxiv.org/abs/2602.20700v2)

**Engineering/gate:** use schema-constrained suggestions over approved pattern operations, never unrestricted generated code. Code, datasets and weights require separate license checks; no candidate’s complete commercial reconstruction pipeline was cleared here. Local inference needs a device-specific evaluation; cloud inference would require a separate opt-in for each upload. Test real photos, occlusion, uncommon garments and sewn outcomes. Depends on F2/F4 and the measurement benchmark, and should remain outside the core release promise.

## 6. Shared platform improvements

### S1 — Import contracts, export preflight and recipient profiles · P0 · Very high value · M first slice / L full interchange · Medium–high risk

An export should explain what will survive. Build a common preflight that identifies units, document revision, missing fonts/assets, raster content, unresolved measurements, calibration and unsupported effects. Separate a design-flat export, a cutting-pattern export and a tattoo-stencil export. Reuse native atomic writes, existing schemas and exporters; they already exist.

Start general import with an **explicit SVG subset**: paths/basic shapes, transforms, groups, fills/strokes and supported compound paths. Preserve the source, show a conversion report, and reject or explicitly flatten unsupported content. Never silently accept a raster embedded in SVG as an editable vector. Importing arbitrary `.ai` or PDF editing structure is a separate problem. Illustrator’s save/export documentation and CLO’s DXF settings are the benchmarks.

Technical option C provides local parsing/rendering candidates. An allowlisted document model, external-resource prohibition, recursion/geometry limits and CPU worker deadlines are essential for imported files; a sanitizer alone does not make conversion correct. Maintain malicious/complex fixtures and receiver-version fixtures. Dependencies: F1 IDs/groups and output schemas. Acceptance: no silent scale changes or dropped objects, and receiving-application comparison for the advertised subset.

### S2 — Consistent editing and guided task paths · P0 · High value · M · Low–medium risk

The app already has navigation tabs, quick actions, keyboard alternatives and focus mode. The next UX pass should connect them to tasks: **prepare artwork → place/compare → stencil**, and **draft/edit → check construction → prepare handoff**. Show selected object, active tool and available next action in predictable locations. Group one drag into one undo; make replacement, detach, bake and unit conversion explicit. Preserve selection/camera across workspace changes where valid.

Use the existing React command/state infrastructure, with keyboard/stylus and native VoiceOver testing rather than adopting a new canvas framework. Link recoverable errors to the relevant object. Provide a short interactive example with optional steps; never block returning users. Benchmarks are Procreate’s canvas-led workflow, TattStencil’s task tabs and the Seamly piece/export support issue.

This is local UI work with modest compute needs. Maintain command and focus regression tests. Gate on task completion by new and experienced users, fewer avoidable mode errors, no data loss, and accessible non-pointer routes. Proposed test: five tattoo users and five garment users; report observations, not statistically representative satisfaction claims.

### S3 — Reversible cleanup with optional local mask assistance · P1 · High value · M–L · Medium risk

Current color-key removal and manual erasing should remain available. Add click/box foreground selection, mask feathering, separate mask history, and explicit accept/reject suggestions. Put adjustments in an editable recipe, retaining original pixels. Photoshop’s reversible filters/generative layers are useful interaction references; local segmentation does not need to generate new art.

Evaluate SAM 2 Tiny, including Apple’s Core ML conversion, against a mixed set of line art, paper photos, grayscale shading, lace and low-contrast designs. SAM predicts regions; it does not reliably distinguish every fine tattoo line or provide perfect alpha matting. Technical option D covers runtime and licensing. Keep manual refinement and CPU fallback; expose model download size and make installation optional.

Inference remains local by default. Cache image embeddings within bounded memory; measure first selection separately from refinements. Gate on correction time and edge preservation versus current tools, not visually attractive demos alone. Requires S2 operation history and a packaged native-compute bridge if the chosen model cannot run acceptably in the existing worker.

### S4 — Reference boards and local review packages · P1 · High value · M · Low–medium risk

Build on existing source preservation, checkpoints and static portfolio export. Attach source/permission notes to references; pin crops beside the canvas; annotate a saved revision; collect sample-maker or tattoo-artist feedback by object/view. A review bundle should include selected views, dimensions, revision ID and an acknowledgment record. Reopening feedback should not overwrite geometry automatically.

TattStencil’s reference workspace and Browzwear’s structured tech-pack workflow are relevant benchmarks. Implement an ordinary versioned local annotation schema and static bundle first. Yjs is an optional future collaboration component, not necessary for asynchronous review. Permissions, authentication, sync conflicts and geometry merge semantics would remain additional work.

No server is required. Include only deliberately selected photos; strip unnecessary image metadata from shared derivatives while retaining the local original. Keep audit history understandable without treating an acknowledgment as a legal signature or manufacturing certification. Depends on S1 manifest/revision IDs. Gate on exact revision association and zero unintended raw-photo inclusion.

### S5 — Qualification and sustainable document storage · P0 release gate / P2 scale work · High value · M–L · Medium risk

Keep Tauri/Rust, React/TypeScript, Three.js and the current worker model. They already support the product boundary. A language rewrite would not repair body quality or cloth physics.

Qualify actual Mac native dialogs, VoiceOver/stylus use and Windows WebView2; execute the existing signing pipeline when credentials are available. Add per-device performance fixtures and explicit supported configurations. Existing CI definitions and an ad-hoc signature are not equivalent to completed distribution qualification.

As larger paint/project data justifies it, migrate embedded images toward a versioned local container with content-addressed blobs and incremental history. Preserve portable backups and atomic saves. Implement this only after measuring load/save and memory costs; it is not necessary to replace the current format for the first grouping feature. Keep cloud sync optional and separate. Dependencies are migration/recovery tests and hardware access; maintenance includes platform updates and dependency notices.

## 7. Technical feasibility and reuse decisions

### Candidate components and restrictions

These are evaluated options, not an approved dependency list. Pin versions and retain license notices at implementation time. Software, model weights, datasets, reference images, fonts and commercial asset packs are separate rights questions.

| Option | Reuse and licensing evidence | Integration, hardware and maintenance decision |
| --- | --- | --- |
| **A. Body asset pipeline** | MakeHuman **core graphical assets are CC0**; MakeHuman code is AGPL and MPFB code GPL. This distinction supports authored asset reuse, not copying their runtime into Form without considering obligations. [Official license](https://static.makehumancommunity.org/about/license.html) | Continue offline authoring/baking and versioned runtime assets. Artist time and pose-corrective validation dominate. Existing anatomy derivatives have separate attribution/share-alike requirements documented in [local provenance](../../assets/anatomy/atlas/source.json). Do not infer rights for arbitrary community assets from the core-asset license. |
| **B. UV generation** | **xatlas, MIT**, provides mesh parameterization/UV unwrapping. [Repository](https://github.com/jpcy/xatlas) | Candidate offline C++ tool, not necessarily a runtime dependency. Seam placement, mirrored islands, texel density and stable anchor migration still need Form-specific policies. Keep old UV revisions available for saved projects. |
| **C. SVG and DXF** | **resvg/usvg, MIT or Apache-2.0**, supplies static SVG processing/rendering; **DOMPurify, Apache-2.0 or MPL-2.0**, can sanitize browser-facing markup; **ezdxf, MIT**, handles DXF in Python. [resvg](https://github.com/linebender/resvg), [DOMPurify license](https://github.com/cure53/DOMPurify/blob/main/LICENSE), [ezdxf](https://github.com/mozman/ezdxf) | Prefer a Form-specific SVG intermediate model and deterministic preview comparison. resvg is not an editable Illustrator importer; DOMPurify is not a geometry validator; ezdxf is not an apparel convention implementation. Use Python offline for receiver fixtures initially. Expect ongoing compatibility/security maintenance. |
| **D. Local segmentation** | Meta’s SAM 2 repository provides promptable image/video segmentation; code/checkpoints use Apache-2.0 with separately noted components. Apple’s **SAM 2 Tiny Core ML model card specifies Apache-2.0**. **ONNX Runtime is MIT** and documents a Core ML provider. [SAM 2](https://github.com/facebookresearch/sam2), [Apple model](https://huggingface.co/apple/coreml-sam2-tiny), [ORT license](https://github.com/microsoft/onnxruntime/blob/main/LICENSE), [Core ML provider](https://onnxruntime.ai/docs/execution-providers/CoreML-ExecutionProvider.html) | Prototype still-image masking first. A converted model must be tested for operator support, CPU fallback, output parity and memory on packaged devices. A Swift/Core ML helper or native ORT bridge adds packaging work; a published model does not prove fast inference in Tauri. Keep model installation optional and hash/version its assets. |
| **E. Cloth/contact** | **IPC Toolkit, MIT**, supplies collision/contact derivatives and detection, explicitly **not a complete physics solver**. **NVIDIA Warp, Apache-2.0**, currently runs CPU-only on macOS without Metal acceleration. [IPC Toolkit](https://github.com/ipc-sim/ipc-toolkit), [Warp](https://github.com/NVIDIA/warp) | Benchmark a native CPU contact spike before committing to a solver rewrite. IPC-style barrier integration may require an implicit solve architecture. CUDA-based demonstrations do not transfer performance claims to a Mac. Material calibration, robust seams, self-contact and specialist maintenance are major costs. |
| **F. Parametric garment research** | **GarmentCode/PyGarment code is MIT**, with explicit panel/edge/interface abstractions. Dataset/body assets require separate review; the dataset download/license record was not successfully retrieved here. [Code](https://github.com/maria-korosteleva/GarmentCode), [license](https://github.com/maria-korosteleva/GarmentCode/blob/main/LICENSE) | Useful as a design reference and offline experiment. It introduces Python and its own representation; do not replace working FreeSewing integration without evidence of benefit. Its license does not automatically clear datasets, body models or every optional simulation tool. |
| **G. Inverse reconstruction** | Sewformer is a published research implementation. NGL v2 says code/data will be released for **research use**. A complete commercial weight/data/runtime license was not established for either. [Sewformer repository](https://github.com/sail-sg/sewformer), [NGL paper](https://arxiv.org/abs/2602.20700v2) | Keep an isolated evaluation track; no automatic bundling. Measure topology, dimensions, seam validity, correction time and sewn results on real data. Hardware needs depend on selected inference model and pipeline; do not invent a minimum GPU requirement before testing. |
| **H. Collaboration** | **Yjs, MIT**, offers shared data types. [Repository](https://github.com/yjs/yjs), [license](https://github.com/yjs/yjs/blob/main/LICENSE) | Consider only after asynchronous review works. CRDT convergence does not guarantee valid pattern geometry or sensible simultaneous edits. Hosting, access control, undo semantics and recovery remain product engineering. |
| **I. Restricted alternatives** | **BRIA RMBG-2.0 weights are source-available for non-commercial use; commercial use needs an appropriate agreement.** SMPL-X’s site separates research access and commercial licensing. [BRIA model card](https://huggingface.co/briaai/RMBG-2.0), [SMPL-X](https://smpl-x.is.tue.mpg.de/) | Neither is a default unrestricted bundled dependency. Do not inherit a permissive wrapper’s license as if it covered its model. Choose permissively cleared assets or negotiate the needed terms before product integration. |
| **J. Existing open-source CAD** | Seamly and Valentina publish GPLv3+ source; Form’s pinned FreeSewing packages are MIT. [Seamly](https://github.com/FashionFreedom/Seamly2D), [Valentina](https://gitlab.com/smart-pattern/valentina/), [bundled FreeSewing license](../../vendor/freesewing/LICENSE) | Reuse the current MIT engine. Study CAD workflows and exchange formats; directly incorporating GPL code requires a compatible distribution decision. Commercial use and closed-source embedding are different questions. A separate process is not automatically a universal licensing exemption. |

### Architecture and performance policy

Use TypeScript for document operations and UI; keep heavy geometry/image work in bounded workers. Introduce Rust/C++/Swift only for demonstrated compute or platform needs. Preserve cancellation, timeouts and atomic native storage. Keep native schemas/versioning independent of the renderer so a future solver or graphics backend does not redefine projects.

Proposed evaluation tiers—not existing guarantees:

| Tier | Proposed fixture and target | Why |
| --- | --- | --- |
| Everyday editing | Apple Silicon laptop with 16 GB RAM plus a separately tested Windows machine; 200-layer representative vector pack; common selection/transform feedback p95 below 50 ms | Detects editing regressions on a realistic desktop baseline. Log device and OS; do not extrapolate to all machines. |
| Body/paint interaction | One body, two linked views and a bounded paint-layer fixture; target at least 30 fps during navigation, reduced-detail fallback when needed | Prevents a fidelity increase from making placement unpleasant. Measure GPU memory separately from process memory. |
| Mask assistance | A 1024-pixel working image; target first result within 5 seconds and cached prompt refinements within 500 ms on the chosen baseline | A proposed usability bar; publish actual numbers and keep manual fallback if unmet. Higher-resolution edge refinement needs its own measurement. |
| Geometry exports | Stress fixtures near supported limits; visible progress and responsive cancel; identical dimensions after repeated exports | Protects reliability under complex traced assets. Raising limits without profiling is not a feature. |
| Cloth evaluation | Fixed mesh/material/contact cases at two quality levels; report solve time, memory, residuals and contact failures | A stable, honest preview is preferable to unqualified “real-time accurate fit.” No frame-rate promise is justified yet. |

The current solver caps vertices at 7,000 and the renderer uses a 2048 artwork atlas. Those are implementation boundaries, not proof of optimal budgets. [Solver](../../src/cloth-solver.ts), [renderer](../../src/scene.ts). Moving to 4K painting requires a texture/history/storage plan, not just changing one constant.

### Data and maintenance practices

Every generated or imported artifact should retain source, transformation recipe, version and uncertainty where relevant. Keep measured values distinct from defaults, predictions and visual estimates. Run inference locally where practical; any future remote service must clearly disclose which files leave the device and require an affirmative upload action.

Keep a license/provenance manifest for bundled assets and models. The supplied vector archive had no license document; the current local import record does not assert public redistribution rights. [Import record](../history/garment-library-0.12.md). It can remain in this private workflow while rights for a publicly distributed asset library are resolved. No competitor body model should be extracted or bundled merely because its screenshot was provided as a reference.

Prefer stable source/export contracts over opaque proprietary dependencies. Maintain a small fixture corpus per format, model version and receiver. Update these fixtures when upstream formats, runtime providers or model licenses change. The maintenance cost of external integrations must be included in feature cost, not treated as a one-time import task.

## 8. UX/UI direction

The recent monochrome navigation work is a suitable base. Improve task completion and confidence rather than starting another visual redesign.

| Interaction | Proposed behavior | Success criterion |
| --- | --- | --- |
| Start a project | Offer “Plan a tattoo,” “Draft a garment,” and “Create a technical flat,” with a recent-project route. Explain that a flat is a design drawing and a pattern is for cutting. | A new user chooses the appropriate workflow without discovering the distinction after export. |
| Selection | One selection model across canvases: click selects a logical object, enter/double-click edits its contents, Escape returns one level. Show selection bounds and a breadcrumb. | A multi-layer garment can be moved once without color-layer misalignment. |
| Contextual controls | A compact tool strip for common actions; inspector for precise values; advanced controls expandable. Show units beside every dimensional field. | Artists can both drag intuitively and enter exact values without switching unrelated panels. |
| Layer organization | Named groups, visibility/lock, thumbnails, meaningful source labels and filter-by-view. Keep colorway/material references inspectable. | Users find and edit the intended object in the largest supported pack. |
| Body preview | Separate view controls from body changes; fit-to-section and front/back/side shortcuts; linked pose views; a clear anatomy toggle. | Camera navigation never accidentally changes tattoo dimensions or body configuration. |
| Export | Ask what the recipient needs: stencil, technical pack, cutting pattern, editable artwork or finished presentation. Show preflight with direct fixes and a preview. | Users understand dimensions, missing data and flattened elements before saving. |
| Background work | Preserve the existing progress/cancel system; distinguish preparing, computing and writing. Show recoverable failure with retry or reduced-quality options. | No apparent freeze and no loss of the last valid document. |
| Learning | An optional sample task with three to five contextual steps and measurement illustrations; keep command search as a shortcut, not the sole discovery mechanism. | First-use success improves without delaying experienced users. |
| Confidence language | Use “Measured,” “Entered,” “Estimated,” and “Not checked” on relevant values. Use “Drape preview” until a solver/material combination is qualified. | Users can explain what the app knows and what they must still verify. |
| Accessibility | Test native dialogs, focus return, keyboard canvas editing, readable contrast, zoom and VoiceOver names on actual hardware. Do not encode muscle identity or distortion by color alone. | A person using keyboard/assistive technology can complete the same core export workflow. |

Suggested usability study tasks: prepare a supplied image and print a scale-checked stencil; compare a sleeve motif in rest/flex poses; edit a traced hoodie and export a readable tech pack; draft a garment from personal measurements and identify its seam/cut boundaries. Record time, help requests, mode errors, destructive mistakes and successful recipient interpretation. Repeat after fixes with a fresh participant where possible. Five users per discipline can expose problems; it cannot establish broad market preference.

## 9. Differentiation strategy

**Positioning hypothesis:** Form Studio can be a local creative workbench that takes body-aware artwork and garment ideas into editable, inspectable handoffs. Validate this with practitioners before claiming a market advantage.

The useful connections are specific:

1. **One person’s measurements, with separate meanings.** Reuse body height/circumferences and their provenance where applicable. Never substitute a rendered body’s width for a measured circumference or confuse finished-garment POM with body size. Let tattoo users opt out of garment data entirely.
2. **One source artwork, several intentional uses.** A motif can become a tattoo, garment print or technical-flat embellishment while retaining its original bytes and rights notes. Each instance has its own scale, surface and output requirements.
3. **Clothing coverage as a composition aid.** After basic garment preview is reliable, show approximate neckline/sleeve/hem coverage over tattoos in selected poses. This connects the two workspaces usefully without needing full production physics. It must remain a visual aid, not a promise about every garment’s fit.
4. **Evidence attached to the handoff.** Include revision, dimensions, calibration, material provenance and unresolved assumptions in exports. This is more valuable than adding a vague “production-ready” badge.
5. **Private references and portable work.** Client body photos, unpublished designs and supplier details remain local unless intentionally shared. The portfolio displays chosen finished results; it does not become a mandatory account or cloud editing dependency.

The inspected competitors provide pieces of these workflows. This review does **not** establish that no competitor combines them. Form’s differentiation must come from a smoother tested path and trustworthy outputs, not a claim of unique feature ownership.

Avoid forcing every user through both disciplines. Keep specialized tools in their workspace and share assets, measurements, history, review and export infrastructure underneath. Do not start with booking/payments, a social marketplace, autonomous design generation or a full enterprise PLM system; none addresses the current editing and fidelity bottlenecks.

## 10. Updated development roadmap

This roadmap supersedes the *proposed order* in the older research note without erasing that historical document. P0 means a dependable core/release foundation; P1 expands professional usefulness; P2 adds workflow efficiency; P3 is research-gated. Milestones are recommended scopes, not promised dates.

| Milestone | Scope and dependencies | Acceptance / exit criteria |
| --- | --- | --- |
| **0.13 — Reliable editing and production handoff** | F1 garment groups/multi-select; S1 bounded SVG import and output preflight; essential S2 interaction fixes; T4 print proof; start T1 body benchmark. Depends on current schemas/exporters, recipient fixtures and practitioner access. | Existing documents reopen unchanged; multi-layer garments transform coherently; supported SVGs preserve geometry/scale; unsupported content is reported; representative packs open correctly in a named receiving editor; real stencil calibration results are recorded; core keyboard/native dialog paths pass. |
| **0.14 — Body quality and tattoo composition** | T1 reviewed body/UV revision; T2 linked pose/sleeve composition; T4 registered sections. Depends on body benchmark, stable anchor migration and artist review. | Four builds reviewed across required sections/views; no blocking anatomical or cut/joint defects; tattoo anchors survive supported poses; old body revisions remain reproducible; actual-size detail/UV seam checks pass. Release notes describe remaining approximation. |
| **0.15 — Construction-aware fashion** | F2 seam graph and checks; F3 connected specs/sample revisions; initial single-size F4 recipient profile. Depends on stable edge IDs, output contracts and a patternmaker/manufacturer. | Three garment families have reviewed seam/ease/notch behavior and construction steps; real toile/sample findings recorded; one named external CAD round trip passes dimensional/semantic checks; technical pack revision/specs agree. |
| **0.16 — Surface paint and assisted preparation** | T3 tiled body paint; S3 optional local masking; S4 reference/review bundles. Depends on stable UVs, command history, model packaging and measured memory budget. | Paint survives seam crossing, poses, undo and reopening; model assistance reduces measured correction effort on the evaluation set; review bundles include only selected data and identify an exact revision. |
| **Subsequent efficiency work** | F6 cutting layouts; F4 additional receiver/grade-rule profiles; richer reusable components and colorways. Depends on real demand and preceding construction contracts. | Valid fabric layouts with constraints respected; grade-rule behavior independently distinguished from redrafting; each newly advertised receiver passes its own fixtures. |
| **Separate research track** | F5 measured cloth/contact, F7 inverse reconstruction, T5 AR/ink/tissue prediction. Do not make core releases wait for uncertain research. | A candidate must beat the manual/current baseline on held-out data, meet hardware/privacy/license requirements, and survive physical review before promotion into a product promise. |
| **Every public release** | S5 native/device qualification, migrations, recovery, provenance and signing. | Actual supported-platform evidence, native accessibility checks, no silent data loss, and appropriate signing/notarization. If a platform is untested, do not list it as qualified. |

### Validation work that must be scheduled, not assumed

| Domain | Proposed evidence set | Decision rule |
| --- | --- | --- |
| Body fidelity | Four builds × torso/full arm/full leg × front/back/side/three-quarter; neutral and relevant flex poses; consistent camera/light; tattoo detail chart on each | Use a five-part rubric: silhouette/proportions, landmarks/planes, joint/cut transitions, material/detail, UV/artwork continuity. Require independent anatomical review and artist acceptance of all critical areas. Fix blocking defects before marketing near-reference fidelity. |
| Measurement | 10–20 garments measured by tape and the photo tool; a separate consenting body-fitting pilot | Report absolute error and error distribution per measurement, including failed cases. Agree tolerances for the task before evaluation; do not generalize a small pilot to arbitrary bodies/garments. |
| Pattern handoff | Woven top, knit top and trousers; straight/curved seams, intentional ease, fold pieces, notches, multiple sizes and nontrivial allowances | Compare original/received piece identity, units and dimensions; proposed round-trip target ≤0.5 mm curve/dimension deviation on the agreed digital fixtures. Sew/measure representative samples separately. |
| Tattoo print | At least two printer/settings configurations and actual target paper; 100 mm control plus thin/thick contours and tiled joins | Record physical scale/line/registration measurements and artist judgment. The ±1 mm initial scale target applies only to tested configurations. |
| Cloth | Known directional fabric samples; existing cylinder test, contact folds and sewn garments; held-out material/pose cases | No claim of physical fit solely from plausible renders. Publish material source, residuals, failure cases and hardware/time. |
| Editing/accessibility | Largest supported vector fixtures, two linked body views, keyboard/stylus/VoiceOver and native save/open on supported systems | No loss of layers/units/history; usable focus order and cancel/recovery; measured responsiveness against the proposed budgets. |

Where a physical evaluator, specimen or platform is unavailable, mark the gate unverified. Do not replace that evidence with a generated screenshot, synthetic-only test or a vendor accuracy claim.

## 11. Top 10 recommendations

The ordering combines immediate user friction, professional consequence, architectural dependency and engineering risk. It is a product judgment based on this evidence, not a numerical market-demand score. Native release qualification remains mandatory even though it is not a feature competing for a slot.

| Rank | Recommendation | Why it earns resources now |
| --- | --- | --- |
| **1** | **F1 — Grouped garment editing** | Repairs a concrete limitation in the newly imported 217-view library. Illustrator’s object/group model supplies a mature reference; this is smaller and more valuable than importing another large pack. |
| **2** | **S1 — Honest SVG import and export preflight** | Connects the app to real workflows while exposing losses and scale issues. Official Illustrator/CLO format controls and user interoperability reports support the need. |
| **3** | **T1 — Reviewed body/UV quality pipeline** | Directly addresses the user’s repeated unmet fidelity request. The existing body pass itself documents the remaining gap. Prioritize anatomy and usable texture detail over polygon count. |
| **4** | **F2 — Seam relationships and construction checks** | Moves patterns toward dependable construction. Existing formulas and stitch ranges are foundations; consistency checks prevent expensive downstream rework. |
| **5** | **T4 — Real stencil proof and transfer sections** | The core tools already exist. Practical print/transfer evidence can improve confidence sooner than an entirely new tattoo subsystem. |
| **6** | **S2 — Guided tasks and consistent selection/history** | Makes current capabilities discoverable and reduces mode errors. The staged workflows in stencil and pattern tools provide concrete references. |
| **7** | **F4 — One verified apparel DXF receiver path** | High professional value when tightly scoped. Test a named receiving workflow before advertising broad compatibility or adding grade-rule support. |
| **8** | **F3 — Linked specifications and sample revisions** | Converts existing flats/BOM/POM exports into a coordinated handoff. Browzwear’s structured tech-pack features show the value of coherent data. |
| **9** | **T2 — Linked rest/flex and sleeve planning** | Builds on already implemented anatomy/poses and connected placements. Gives artists a clearer decision tool without pretending authored flex is biomechanics. |
| **10** | **S3 — Optional local masking assistance** | Offers a bounded AI benefit with editable results and a permissively licensed candidate. Judge it by saved correction time, not model novelty. |

Direct surface painting remains a strong P1 investment after UV/history stability. Reference/review bundles and cutting layouts follow when the underlying outputs are dependable. Autonomous reconstruction, predictive healed ink and physically accurate muscle/cloth interaction should receive limited research budgets with explicit stop/go tests, not open-ended commitments.

## 12. Concrete next milestone and action plan

Proceed next with **Form Studio 0.13 — Reliable editing and production handoff**. Scope it to grouped vector editing, supported-subset SVG import, contextual preflight, and verified real-world delivery. Establish the body benchmark now so 0.14 has a measurable target; do not label another unreviewed sculpt pass “near 1:1.”

1. **Freeze baseline fixtures and output contracts.** Select representative existing projects, complex imported views and supplier/editor examples. Record required units, groups, holes, callouts and unsupported SVG effects. Capture the four current body builds under consistent views. Preserve 0.12 reopening/export comparisons.
2. **Implement F1 first.** Define migration-safe group IDs, selection behavior and undo transactions. Make every imported garment view a coherent transformable object, with explicit entry into its color layers. Review the interaction before adding component instances.
3. **Add the first S1 importer/preflight slice.** Limit editable SVG to supported geometry; retain originals and report unsupported elements. Add export intent, units, revision and checks for missing pack/stencil inputs. Compare supported output with a named external editor; do not claim AI-file or industrial DXF support in this slice.
4. **Run recipient and print trials.** Have a sample maker inspect two representative tech packs and a tattoo artist inspect/print two stencil compositions. Record scale, missing information and correction requests. Fix observed failures before expanding formats.
5. **Qualify the shipped experience.** Test existing-file migration, undo, cancellation, recovery, native save/open and keyboard/VoiceOver on supported hardware. Package only after these pass; signing/public distribution remains credential-dependent. Update status docs with evidence and remaining limits.
6. **Choose the 0.14 body asset plan from review results.** Assign sculpt, UV and pose corrections to specific defects. Estimate artist/engineering work using the accepted rubric; keep topology migration explicit. Start anatomy review early rather than waiting until the final render.

Planning allowance for the bounded 0.13 engineering scope: **roughly 6–10 engineer-weeks**, with the largest uncertainty in SVG conversion/recipient compatibility. This excludes a full body re-sculpt, industrial DXF, live collaboration and advanced cloth, and assumes access to reviewers/devices. Release smaller internal increments if needed, but call the milestone complete only when its handoff and recovery gates pass.

The next implementation brief should therefore begin with **garment grouping plus output contracts**, followed by a bounded SVG importer and real handoff trials. That sequence makes the work already delivered more useful immediately and creates the stable foundation needed for the body, painting and manufacturing improvements that follow.
