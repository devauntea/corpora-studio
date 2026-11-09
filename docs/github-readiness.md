# GitHub preparation — 0.19 candidate

Product owner: Devauntae Norman. Date: 2026-11-06. No repository was published, no remote added and no history rewritten by this development pass.

## Prepared

- Root README, ownership, contribution and security documents describe the local desktop product and its real limits.
- `.gitignore` excludes builds, dependencies, native targets, QA captures, releases, local projects, `.tools`, environment files, private keys/certificates, logs and coverage. Ignore rules do not remove already tracked files.
- CI is configured to check development and production renderers, Rust and native builds; signed-release workflows are manual and use protected `desktop-release` secrets. The Windows CI job has not been executed in this session. These workflows produce artifacts and do not publish a repository.
- Application/package/native About metadata identifies Devauntae Norman as product owner. Legitimate third-party author records are preserved, including Gauthier Kervyn's Z-Anatomy attribution.
- Revision9 body outputs are added to the inherited anatomy attribution manifest. Source and adaptation records remain beside the assets.
- npm audit returned **0 vulnerabilities across 220 reported dependencies**. Full result is `qa/final-ux/dependency-audit.json`.
- `cargo-audit 0.22.2` found **0 vulnerability entries and 5 advisory warnings** in the lockfile: unmaintained `proc-macro-error 1.0.4` (RUSTSEC-2024-0370), `zbus_names 4.3.5` (RUSTSEC-2026-0371), `zvariant 5.15.1` (RUSTSEC-2026-0370), `zvariant_derive 5.15.1` (RUSTSEC-2026-0372), and unsound `glib 0.18.5` (RUSTSEC-2024-0429). This is not a clean advisory audit. The glib dependency is in the Linux GTK chain and is absent from the checked `aarch64-apple-darwin` target graph. Review upstream resolution before any Linux build. Evidence: `qa/studio-019/cargo-audit.json`, `glib-chain.txt`.
- Dependency notices were regenerated: **461 package records, 606 notice files, 52 records without a top-level license file**. Missing top-level files do not themselves establish unlicensed use, but require package-by-package review before publication. See `docs/dependencies.md`, `THIRD_PARTY_NOTICES.txt` and `qa/studio-019/notices.log`.
- The redacted known-pattern scanner covered **1,396 text items** from non-ignored working files and reachable Git blobs, with **0 matches**; **935 binary or large items were skipped**. It checks text up to 3 MB, has no entropy analysis and does not prove absence of other secrets. No inspected working file exceeded 100 MB. The approximate working source/asset footprint was 352 MB; historical body versions remain for compatibility. Evidence: `qa/studio-019/secrets-audit-final.json` and `scripts/prepublish-audit.py`.

## Publication blockers

1. **Supplied vector redistribution:** `public/garment-assets/provenance.json` records no third-party license for 112 source sheets from `vectors.zip`. Originals and traced assets are already tracked. The owner must establish redistribution rights or approve a clean publication package that excludes/replaces them. Merely adding an ignore rule cannot solve tracked-file/history exposure.
2. **Original-code license choice:** no root license grant has been selected. Devauntae Norman must choose the intended licensing/public-access terms. Third-party assets retain their own terms regardless of that choice.
3. **Final publication audit:** review the exact staged tree and history with a dedicated secret scanner, resolve or explicitly accept applicable Rust advisory warnings, complete review of missing package notices, and verify all third-party asset records. The bounded known-pattern scan is narrower than a complete secret audit.
4. **Distribution qualification:** local macOS preview signing is not notarized public delivery. Windows packaging/native workflows and manufacturer SVG/PDF acceptance remain unqualified until actually exercised. Final 0.19 native-check status belongs in the delivery record.
5. **Explicit authorization:** public GitHub publication or deployment requires the owner's explicit decision. No publication action should run merely because software checks pass.

A local-preview approval must not be presented as approval to publish unlicensed assets or as certified garment fit/anatomical fidelity.
