# Guided workspace and local review — 0.18

Form Studio 0.18 makes the existing tattoo and fashion tools easier to navigate and adds revision-linked, offline review packages. It is a partial delivery of research tracks **S2 (guided tasks)** and **S4 (local review)**. It does not complete the competitive-research roadmap or change the anatomical fidelity of the models.

## Starting and returning to work

Open **Home** to continue the current project, open a recent local copy or saved `.formstudio` file, or start one of three tasks:

- **Plan a tattoo** starts a body study and opens the model browser.
- **Draft a garment** opens measurement-driven sewing patterns.
- **Create a technical flat** opens garment drawings and manufacturer specifications.

Starting a new task uses the existing unsaved-work guard. Home is optional; it does not replace the active study when opened. Recent entries come from device-local recovery copies and checkpoints. **Project library** remains the place to manage those copies. Explicit project saves remain separate from recovery.

## Tattoo workflow

The task path links **Choose body → Prepare artwork → Place & adjust → Make stencil**. It opens the existing tools, retaining their editing and Undo behavior. Prepare artwork uses the selected artwork or the first available artwork; with none available, it opens image import.

**Choose body** opens a searchable browser with anatomical and imported-sculpt filters. Select a card to read its coverage and available controls, then choose **Use model** to apply it. Anatomical models offer male/female and fit/average choices. Their coverage illustrations are diagrams; imported-sculpt cards use rendered previews. Imported sculpts retain their fixed authored poses and existing limitations.

The layer search filters artwork names in the current surface or photo workspace. Clearing the search restores the list without changing visibility, placement or source images. The canvas identifies the selected artwork and active placement/orbit mode. Camera presets, focus mode and Cmd/Ctrl+K quick actions remain available.

Changing an incompatible body mesh still clears connected surface anchors and returns affected placements to chart coordinates. The artwork remains available for repositioning; Undo restores the previous state. Browsing or closing the model browser does not apply a selection.

## Fashion workflow

The pattern workspace provides four task routes: **Choose pattern**, **Measurements & fit**, **Edit & construct**, and **Review output**. They expose the relevant panels without changing the draft. The catalog collapses during later steps to leave room for measurements and pieces. A search with no matches keeps the current draft and offers **Clear pattern filters**.

Selected pieces show their cut instructions and dimensions. Arrange, Shape and Pan tools have visible labels. Seams & construction remains accessible with the catalog collapsed. Output choices distinguish **Print & assemble** (tiled PDF) from **Edit at full size** (SVG in millimeters). The manufacturer-pack route opens technical flats, specifications and construction instructions; it does not turn a drawing into a cutting pattern.

Vector packs retain their Technical flats, Size specification, Materials & trims, Style & instructions, and Samples & revisions pages. Next-stage links connect those tasks. Front/back working-view controls sit with selection controls; the footer shows tool or selection context. An empty canvas offers the garment library or drawing from scratch. Export-format descriptions explain the difference between a manufacturer ZIP, PDF tech pack, editable SVG and editable JSON project.

## Review room

1. Arrange the body/photo view, pattern or vector drawing you want to review. Open **Review room** from the project toolbar.
2. Enter a revision name, view name, and object or area. **Freeze & capture** records a fingerprint of the project state and saves a rendered PNG view. The body render waits for the current geometry and artwork; pattern previews include seam-plan matching marks.
3. To add another camera angle, close the room, adjust the camera, reopen it and select **Capture current view**. Changing project content requires a new revision. A fingerprint associates review records with exact content; it is not a restorable copy of the editable geometry. Use saved projects or checkpoints for restoration.
4. In **Notes**, add comments for an object or a particular view, filter open/resolved notes, record resolutions, or add an acknowledgement. An acknowledgement records the views captured at that time; later captures do not expand it. It is included in an export only when its entire recorded view scope is selected. It does not constitute a signature or manufacturing certification.
5. In **Share**, explicitly check the rendered views to include and choose **Export selected review views**. The ZIP contains an offline review page, selected PNGs, associated notes, revision-wide notes, acknowledgement records, a manifest and instructions. Tattoo revisions include an estimated model-section length; the review room does not automatically extract a garment's complete size specification.
6. The recipient opens the extracted HTML locally, adds feedback and downloads feedback JSON. Return that file manually and import it into the originating project's review room. Feedback is linked to the revision fingerprint and adds review records without replacing geometry. Unknown revisions and conflicting feedback IDs are rejected; repeated identical feedback is not duplicated.

Sharing uses rendered derivatives with unnecessary image metadata removed. The review ZIP does not include unselected views, raw source photos, editable project files or raw 3D geometry. The separate manufacturer and portfolio exporters retain their existing purposes.

## Storage, scope and limits

New saves use **project format 18**. Format 17 and older documents validate and migrate without silently changing their body revisions, tattoo placements or original artwork. The first save of an older file creates a new-format copy instead of overwriting the original. Review records live inside the project and participate in project history and saves.

A project supports up to **8 review revisions**, **8 views per revision**, and **100 notes per revision**. Rendered previews are limited to 2 MB each and a combined 12 MB encoded-image budget; feedback input is limited to 300 KB. Review packages remain bounded local exports.

S2 work delivered here covers navigation, contextual controls, empty states and progressive disclosure. A guided interactive tutorial, comprehensive command/history unification, practitioner task studies and native VoiceOver/stylus evaluation remain open. S4 work covers frozen review identities, notes and selected-view feedback packages. Reference permission records, pinned reference crops, live collaboration, accounts, cloud sync and geometry merging are not implemented in this milestone. No server or paid service is required for the delivered workflow.

## Verification

Targeted development checks cover task navigation without draft changes, model-browser selection and cancellation, pattern/vector editing and save/reopen, keyboard and focus paths, review fingerprints and feedback validation, selected-only exports, and paired notches in shared pattern previews. Fashion workflow checks pass in Chromium and WebKit, including automated accessibility checks. TypeScript validation passes.

Release verification on 2026-11-06: **230 unit tests across 26 files**, **7 Rust tests** (one local-HEIC test deliberately ignored), and **22 production WebKit workflows** passed. The new Home/model workflows, review feedback round trip and canvas-resize regression also passed in Chromium and WebKit. Automated WCAG2A/AA checks pass for Home, the model browser, fashion task paths and the review room. TypeScript, the production build, the packaged Mac build, and deep/strict verification of the local ad-hoc signature pass.

The app is at `releases/Form Studio 0.18.0.app`; build identity and verification evidence are recorded in `qa/studio-018/release.json`. **Native 0.18 launch, save/open/cancel and review-export dialogs remain unverified** because app control reports that the Mac is locked. Browser checks do not replace that native verification. Real manufacturer acceptance, printed/toile validation, independent anatomy review, Windows/WebView2 execution and public signing/notarization remain separate gates.
