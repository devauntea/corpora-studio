# Security and privacy

Corpora Studio is a local desktop application. Project files can contain original artwork, garment references and body photographs. Recovery copies remain in the local application storage; explicit saves and exports write to the destination selected by the user. Treat projects and review exports as private until their contents have been checked.

The project parser enforces versions, geometry/image budgets, UUID references and original-image hashes. Native file operations are bounded and use atomic replacement. Review exports select finished views; inspect their disclosed notes and content before sharing. The application uses a restrictive content-security policy and does not upload source images for pattern detection.

Report a suspected issue privately to the repository owner through the private reporting channel they configure before public launch. No support email or public security-reporting service has been invented for this preview. Do not post customer projects, secrets or personal images in public issues.

Dependency and secret scans are evidence with a stated scope, not guarantees. See `docs/github-readiness.md` for current audit coverage and unresolved distribution gates.
