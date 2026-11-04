# Editing / recovery verification — 0.8.0

Executed on this Mac, 3 November 2026 (America/New_York). Project format 8.

- TypeScript and Vite production build: passed.
- Vitest: 45 passed across domain integrity, image processing, projective transforms, manual construction and pattern export suites.
- Browser coverage: 28 cases across Chromium and WebKit passed across the full run and targeted reruns. The initial full run had 27 passes and one Chromium limb-state assertion failure while development sources were being reloaded. The unchanged limb case subsequently passed in isolation. The manual construction / export workflows were rerun after final bounds/footer corrections; both engines passed their targeted runs.
- Rust: 5 passed; 1 optional supplied-HEIC fixture test intentionally ignored because those private references are not bundled.
- Production npm dependency audit: zero vulnerabilities.
- PDF pages rendered with Poppler. Cover scale square, edited stitching/cutting boundaries, clip frames and overlap marks inspected. Corrected the tile footer to say “Individual edge SA” for manual pieces.
- Mac package built successfully and copied to a new `releases/Form Studio 0.8.0.app`. The bundle was signed ad hoc and passed `codesign --verify --deep --strict`. Full third-party notices are present in Resources.

## New regression evidence

- Manual stitching curves survive detachment in world coordinates; measurement updates do not regenerate detached pieces.
- Curve splitting preserves cubic shape, seam length and matching-mark positions. Anchor removal and outlying dart print bounds are covered.
- Fold and hem allowance rectangles produce exact independent offsets in either winding direction; self-crossing boundaries are rejected.
- Manual curves, per-edge allowances, notches and darts survive save/open. Undo and redo work inside the geometry editor.
- Stencil/contour output preserves original bytes and alpha semantics; visible contour pixels, transparent interior, PNG export and recipe restoration are exercised.
- Corner homographies and inverse maps are checked at corners/interior points, including mirrored placement. Degenerate/folded quads are rejected. Photo masks remain anchored while artwork is warped, flipped and sheared.
- Local recovery survives a reload. Named checkpoints persist independently; opening an older checkpoint does not replace the latest recovery until edited.
- Valid v7 files migrate without changing either studio; new v8 fields are rejected by frozen older readers.

## Limits

Native app-control reported that the Mac remains locked. Native save/open/export dialog interactions, packaged-app local storage persistence and a user-operated quit/relaunch have **not** been verified for 0.8.0. The older 0.7.0 process was left running and its bundle was not modified. No physical pattern fitting, anatomy accuracy, cloth simulation or reconstruction accuracy is claimed.

Artifacts: `qa/editing-recovery/` (ignored from Git), including release metadata, screenshots and rendered PDF pages. These are developer test artifacts; private reference photographs are not test fixtures.
