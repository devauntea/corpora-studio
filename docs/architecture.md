# Architecture decision — desktop first

Date: 2026-11-03. Scope: first implementation task F01.

Historical baseline. [F02 design and research](history/advanced-studio-plan.md) documents the current v2 schema, photo workspace and additional templates.

## Product boundary

The user's latest decision supersedes the earlier proposal for selected browser editing: the website will display finished work created in the desktop application. It does not need account management, project editing, cloud inference, or parity with the desktop studio. Portfolio implementation follows useful desktop exports. No website was deployed in this task.

## Stack decision

Use Rust with Tauri 2 for the native host; React/TypeScript for the application interface and document commands; Three.js with WebGL 2 for the surface editor. Language complexity is not a selection criterion. Rust gives a strong native boundary for storage and later geometry/worker coordination. TypeScript keeps interactive tooling maintainable. Three.js supplies the raster renderer and orbit/raycast machinery without coupling the project data model to its scene graph.

This matches Tauri's [native host and webview architecture](https://v2.tauri.app/concept/architecture/) and [typed command mechanism](https://v2.tauri.app/develop/calling-rust/). A successful Mac spike alone does not qualify the Windows WebView2 renderer. Retain that release gate before expanding distribution. No Electron fallback was necessary for the current Mac build.

## Implemented boundaries

| Area | Implementation |
| --- | --- |
| Document and commands | `src/domain.ts`: strict v1 schema, millimeter units, immutable snapshots, grouped commands, stable UUIDs, asset SHA-256 checks |
| Source artwork | Original PNG/JPEG bytes stored as data URLs; derived preview pixels are separate and disposable |
| Native files | `src-tauri/src/main.rs`: native dialogs, dialog-granted destination allowlist, size/envelope validation, same-directory atomic replacement |
| Renderer | `src/scene.ts`: authored procedural mesh, arc-length perimeter coordinates, UV atlas, shadow/lighting, raycast placement, orbit, review export |
| UI | `src/App.tsx`: composition library, artwork/model inspectors, history, errors, dirty state, save/open/export, keyboard controls |
| Development harness | Local Vite server; browser downloads emulate project operations for UI tests only |

## Geometry and placement

The mesh has 128 perimeter segments and 96 length segments. Its elliptical section has a constant 1.13 aspect ratio, with a mild longitudinal bulge and side-dependent lean. Both input end circumferences are preserved. A numerical arc-length lookup makes `u` a perimeter fraction, with the seam behind the model; `v` runs from wrist to elbow. Vertex normals are averaged across the seam.

Artwork width is expressed in millimeters in a chart using the circumference at the placement center. Aspect ratio is retained. Rotation is applied in millimeter coordinates before scaling to the atlas. Periodic chart copies let images cross the wrap seam; the renderer samples a single surface map, so no ray projection passes through to the opposite side. No DecalGeometry or floating planes are used. This surface-specific implementation is not yet a general mesh deformation/retopology system.

## Persistence and privacy

The portable `.formstudio` v1 format is JSON containing the project metadata, body parameters, embedded originals, and layer placements. This deliberately precedes SQLite: one self-contained file is enough to validate F01 without introducing synchronization between a metadata database and assets. A local project index and thumbnail cache can use SQLite in the next foundation increment. Asset embedding is bounded; a ZIP/blob format can be migrated behind a new version when larger projects justify it.

The UI validates the full schema and source hashes before adopting an opened document. The host independently checks the envelope, file size, and granted paths. Only destinations selected by a native file dialog can be written; PNG export always opens its own destination dialog. Failed writes before atomic replacement leave the previous destination untouched. Directory synchronization is best effort. Network filesystems and unusual storage providers require separate qualification.

No remote SDK, analytics, model service, synchronization, or remote font is present. Production CSP restricts network connections to local Tauri IPC. All provided user reference images remain outside the repository; the default botanical study and application icon are original code-authored assets. Body/photo processing and explicit opt-in cloud boundaries remain future work.

## Next increments

1. Extend the desktop foundation with autosave/recovery, a local project index, additional native tests, keyboard accessibility review, and Windows qualification.
2. Add region selection and additional authored body surfaces, richer image conversion, linked sleeve layouts, and reliable UV/geometry version migration.
3. Establish a UI-independent pattern graph with safe measurement expressions, precise point/curve construction, constraints, seam allowances, notches, and scale-verified SVG/PDF export. Evaluate existing permissively licensed drafting components separately; do not embed GPL code without an explicit licensing decision.
4. Add reconstruction as isolated local workers with cancellable jobs and model/license-specific evaluation. Do not present uncertain body/garment estimates as physically validated outputs.
5. Build the portfolio website around selected, intentionally exported finished work. Public publishing and reference-image rights are separate decisions.
