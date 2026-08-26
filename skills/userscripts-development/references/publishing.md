# Publishing & Updates

Catalog rules that change portable metadata or auto-update behaviour — not a Greasy Fork/OpenUserJS manual.

## Publishing to Greasy Fork

- **Rewrite on publish:** Greasy Fork rewrites `@updateURL` / `@downloadURL` to point at Greasy Fork and strips `@installURL`; inserts `@version` / `@namespace` if missing. (verified 2026-08-25 — greasyfork.org/en/help/meta-keys: "@updateURL, @installURL, @downloadURL — Greasy Fork will strip these keys" + "@version/@namespace — Greasy Fork requires this field")
- **Mozilla version format (verified 2026-08-25 — greasyfork.org/en/help/meta-keys + MDN Legacy Version Format):** `@version` must be Mozilla version format — up to 4 dot-separated parts, each `<number-a><string-b><number-c><string-d>`; hyphens create negative numbers (`2026-04-12` → `-04` fails comparison) — meta-keys + MDN Legacy Version Format. Use dot-delimited `X.Y.Z` — see [version-numbering.md](version-numbering.md) for portable comparison.
- **Catalog rules beyond metadata:** code inspectability, external-script allowlist/SRI, antifeatures, listing hygiene, update-check limits — see [Greasy Fork Code Rules](https://greasyfork.org/en/help/code-rules), [External Scripts](https://greasyfork.org/en/help/external-scripts), [Antifeatures](https://greasyfork.org/en/help/antifeatures), [Meta Keys](https://greasyfork.org/en/help/meta-keys) and [header-reference.md](header-reference.md)/[security-checklist.md](security-checklist.md) for SRI.

Verify: greasyfork.org

## Publishing to OpenUserJS

- **Update URL:** point `@updateURL` at the `.meta.js` variant, not the full `.user.js` — pointing at `.user.js` can flip the update engine to `FAIL` state. UNVERIFIED (2026-08-25) — not found in openuserjs.org announcements/docs today; known community guidance, verify via OpenUserJS webhook/meta docs.
- **Catalog rewriting difference (verified 2026-08-25 — greasyfork.org/en/help/meta-keys for Greasy Fork side; OpenUserJS side unverified):** Greasy Fork rewrites/strips `@updateURL`/`@downloadURL`/`@installURL` to force updates from Greasy Fork; OpenUserJS does not rewrite and serves `.meta.js` via `Accept: text/x-userscript-meta` negotiation — choose primary catalog accordingly. Greasy Fork side verified via /help/meta-keys; OpenUserJS negotiation UNVERIFIED (2026-08-25) — not found in announcements/docs today.
- **OpenUserJS specifics:** OSI-approved `@license` (SPDX), size limits, GitHub webhook/branch handling, extra-file policy — see [OpenUserJS Licensing](https://openuserjs.org/announcements/Licensing_enforcement) and [header-reference.md](header-reference.md).

Verify: openuserjs.org

## Update Mechanics

| Header | Semantics |
|--------|-----------|
| `@updateURL` | Check-only URL — manager fetches metadata to compare `@version` |
| `@downloadURL` | Download-on-update URL — fetched when an update is available (`none` disables) |
| Absent both | Disables auto-update checks |
| `@version` | **REQUIRED** for auto-update. Violentmonkey never auto-updates a versionless script. |

(verified 2026-08-25 — violentmonkey.github.io/api/metadata-block: "@version — If no @version is specified, the script will not be updated automatically" + "@downloadURL — Checked for updates automatically")

- Comparison is per-manager (see [version-numbering.md](version-numbering.md)); always bump `@version` and never decrement. (verified 2026-08-25 — greasyfork.org/en/help/meta-keys warns on version decrement + violentmonkey.github.io versioning)
- **Download suppression & cache busting (verified 2026-08-25 — violentmonkey.github.io/api/metadata-block + Tampermonkey docs):** `@downloadURL none` disables download on update; to force re-fetch of cached `@require`/`@resource` add `?v=` to the URL or bump `@version` — Violentmonkey/Tampermonkey docs.

Verify: violentmonkey.github.io

## Delivery & Serving Gotchas

- **Version & namespace:** catalogs insert them if missing on import, but set them explicitly for portability. (verified 2026-08-25 — greasyfork.org/en/help/meta-keys: Greasy Fork requires @version/@namespace)
- **Cache:** managers cache `@require` / `@resource`; version bumps re-fetch externals — review SRI hashes on every bump. (verified 2026-08-25 — violentmonkey.github.io/api/metadata-block: @require/@resource downloaded at install)

Verify: tampermonkey.net · raw.githubusercontent.com

## See Also

- header-reference.md — `@updateURL`, `@downloadURL`, `@installURL`, `@version`
- version-numbering.md — version comparison per manager
- security-checklist.md — Supply Chain & External Code (SRI)
