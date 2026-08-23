# Publishing & Updates

When you publish or update scripts, read this first — catalog rules, update mechanics, and delivery gotchas that break installs if missed.

## Publishing to Greasy Fork

Greasy Fork enforces code inspectability and update integrity:

- **Code rules:** no obfuscated or minified code; 2 MB size limit (not bypassable by minifying); primary functionality must be hosted on Greasy Fork.
- **Antifeatures:** disclose author-benefiting features via `@antifeature <type> <description>` — types `ads`, `membership`, `miner`, `payment`, `referral-link`, `tracking` (with `:locale` i18n variants, e.g. `@antifeature:de`).
- **External executable code — allowlist only:**
  - Recognized CDNs (see Greasy Fork CDN list)
  - `@require` / `@resource` with SRI hash (`#sha256=...` or `#md5=...` in Tampermonkey format)
  - Greasy Fork-hosted libraries (syncable from GitHub)
  - Same-origin injection (script at `example.com` re-injecting `example.com` code only)
  - Non-executable loads (JSON, CSS) are exempt.
- **Rewrite on publish:** Greasy Fork rewrites `@updateURL` / `@downloadURL` to point at Greasy Fork and strips `@installURL`; inserts `@version` / `@namespace` if missing.
- **Integrity checks:** warns on SRI hash mismatch and on version decrement.
- **Account:** 2FA required for authors (2025 rollout).

Verify: greasyfork.org

## Publishing to OpenUserJS

- **License:** OSI-approved `@license` REQUIRED; if absent, OpenUserJS treats it as implied MIT (per ToS). Use an SPDX identifier (`MIT`, `GPL-3.0-only`, etc.).
- **Update URL:** point `@updateURL` at the `.meta.js` variant, not the full `.user.js` — pointing at `.user.js` can flip the update engine to `FAIL` state.
- **GitHub import:** webhook available to sync from a GitHub repo.
- **Size cap:** ~500 KiB hosted cap per script.
- **Extra files:** ship via `@require` / `@resource` or data URIs (no arbitrary extra-file hosting).

Verify: openuserjs.org

## Update Mechanics

| Header | Semantics |
|--------|-----------|
| `@updateURL` | Check-only URL — manager fetches metadata to compare `@version` |
| `@downloadURL` | Download-on-update URL — fetched when an update is available (`none` disables) |
| Absent both | Disables auto-update checks |
| `@version` | **REQUIRED** for auto-update. Violentmonkey never auto-updates a versionless script. |

- Smart servers return metadata-only responses to `@updateURL` (no need to serve the full script).
- Comparison is per-manager (see version-numbering.md); always bump `@version` and never decrement.

Verify: violentmonkey.github.io

## Delivery & Serving Gotchas

- **GitHub Raw:** `raw.githubusercontent.com` serves `.user.js` as `text/plain` with `nosniff` — managers detect installs by the `.user.js` URL suffix, not MIME. Do not rely on content-type.
- **Tampermonkey MV3 (Chrome):** installs redirect through `tampermonkey.net` `script_installation.php` due to MV3 `webRequest` limits.
- **Version & namespace:** catalogs insert them if missing on import, but set them explicitly for portability.
- **Cache:** managers cache `@require` / `@resource`; version bumps re-fetch externals — review SRI hashes on every bump.

Verify: tampermonkey.net · raw.githubusercontent.com

## See Also

- header-reference.md — `@updateURL`, `@downloadURL`, `@installURL`, `@version`
- version-numbering.md — version comparison per manager
- security-checklist.md — Supply Chain & External Code (SRI)
