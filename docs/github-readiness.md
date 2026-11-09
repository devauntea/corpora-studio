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

## Publication status — 2026-11-09

The repository was made public as open source.

1. **Supplied garment flats:** the 112 PNG sheets from `vectors.zip` had no redistribution licence, so they and their traces were removed from the repository and its history before publication. They remain on the owner's computer in the ignored `public/garment-assets/` folder; the app shows an import prompt when the folder is absent.
2. **Licence:** original code is released under the MIT licence (`LICENSE`). Third-party assets keep their own terms, listed in the README.
3. **Audit:** a known-pattern secret scan of the working tree and full history found no matches. Commit author emails use the owner's GitHub no-reply address. Rust advisory warnings listed above still apply to Linux builds.
4. **Distribution qualification:** local macOS preview signing is not notarized public delivery. Windows packaging and manufacturer SVG/PDF acceptance remain unqualified until exercised.

A local-preview approval must not be presented as approval to publish unlicensed assets or as certified garment fit/anatomical fidelity.
