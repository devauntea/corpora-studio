# Development

Corpora Studio is maintained for product owner Devauntae Norman. Read `README.md`, `docs/studio-completion-status.md` and the relevant feature record before changing a workflow. Do not treat the presence of a feature as evidence of physical manufacturing accuracy.

Use Node24 and stable Rust with Tauri prerequisites. Run `npm ci`, `npm test`, `npm run build`, and `cargo test --release --manifest-path src-tauri/Cargo.toml`. Browser qualification uses `npm run test:production`; install Playwright Chromium/WebKit first. Never run concurrent builds against a production test server.

Keep project migrations additive and strict. Freeze previous schemas before changing persistent fields; preserve source-image hashes, body revision and tattoo anchor identity. Add a regression covering the changed invariant. Keep user projects and QA captures outside Git, and avoid embedding personal photos or unlicensed reference sheets in automated fixtures.

Use original or appropriately licensed assets and record their source, author, license, modifications and checksum. Preserve all required attribution. Do not weaken input budgets, local-file authorization or export checks to make a test pass. Keep visual simulation and approximate pattern results clearly distinguished from physically validated outputs.

Publication, deployment and Git-history rewriting require the owner's explicit authorization. Current local preview builds are ad-hoc signed and are not public distribution releases.
