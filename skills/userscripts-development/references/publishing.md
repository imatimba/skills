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
- **Account:** 2FA required for password-based logins (2025 phased rollout; OAuth via Google/GitHub/GitLab exempt if password removed — greasyfork.org discussion #268441).
- **Update-check & injection (verified 2026-08-24):** scripts must not check for updates more than once per day; do not dynamically inject another Greasy Fork-hosted script (bypasses manager caching) — Greasy Fork Code Rules.
- **Listing hygiene (verified 2026-08-24):** no ads in Greasy Fork descriptions, no unrelated keywords/sites to game search, no excessive version bumps to game ranking, no `@match`/`@include` for sites with no functionality, flag adult content — Code Rules.
- **Mozilla version format (verified 2026-08-24):** `@version` must be Mozilla version format — up to 4 dot-separated parts, each `<number-a><string-b><number-c><string-d>`; hyphens create negative numbers (`2026-04-12` → `-04` fails comparison) — meta-keys + MDN Legacy Version Format.
- **Inline library attribution (verified 2026-08-24):** prefer `@require`; if inlined, include comment with source URL/name/version — Code Rules.
- **Library exemptions (verified 2026-08-24, via Greasy Fork script_version.rb):** scripts marked as libraries are exempt from required `@version`/`@namespace` and `version_not_incremented` warnings.
- **Rewriting extras (verified 2026-08-24):** on update `@description` is backfilled from prior version if missing; CRLF/CR normalized to LF — Greasy Fork Rewriting.
- **SRI details (verified 2026-08-24):** Tampermonkey format supports `#sha256=`/`#sha256-` (both accepted after Greasy Fork fix), `#sha384`/`#sha512`/`#sha1` via `window.crypto`, `#md5=` legacy; multiple hashes comma/semicolon-separated, hex or Base64, last supported wins — Tampermonkey SRI docs.
- **Antifeature ≠ exemption (verified 2026-08-24):** disclosing via `@antifeature` does not exempt a script from Code Rules on primary functionality or external-code allowlist — Code Rules + Antifeatures.

Verify: greasyfork.org

## Publishing to OpenUserJS

- **License:** OSI-approved `@license` REQUIRED; server now rejects new scripts/updates (incl. GitHub webhook pushes) lacking an OSI-approved SPDX `@license` (openuserjs.org/announcements/Licensing_enforcement) — implied MIT per ToS applies to legacy scripts only. Use an SPDX identifier (`MIT`, `GPL-3.0-only`, etc.).
- **Update URL:** point `@updateURL` at the `.meta.js` variant, not the full `.user.js` — pointing at `.user.js` can flip the update engine to `FAIL` state.
- **GitHub import:** webhook available to sync from a GitHub repo.
- **Size cap:** ~500 KiB hosted cap per script.
- **Extra files:** ship via `@require` / `@resource` or data URIs (no arbitrary extra-file hosting).
- **Maintenance & webhook branch (verified 2026-08-24):** site is low-maintenance; GitHub webhook has reported 403s when default branch is `main` instead of `master` (see OpenUserJS issue #1781 and 2025 discussion threads) — pin webhook to `master` or verify after push.
- **Dual/CC license pitfall (verified 2026-08-24):** CC licenses (e.g. `CC-BY-NC-SA-4.0`) are rejected as primary `@license` because they are not OSI-approved; dual-license with an OSI-approved SPDX code first (e.g. `MIT`) — Licensing_enforcement (OSI-approved SPDX required).
- **Catalog rewriting difference (verified 2026-08-24):** Greasy Fork rewrites/strips `@updateURL`/`@downloadURL`/`@installURL` to force updates from Greasy Fork; OpenUserJS does not rewrite and serves `.meta.js` via `Accept: text/x-userscript-meta` negotiation — choose primary catalog accordingly.

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
- **Download suppression & cache busting (verified 2026-08-24):** `@downloadURL none` disables download on update; to force re-fetch of cached `@require`/`@resource` add `?v=` to the URL or bump `@version` — Violentmonkey/Tampermonkey docs.

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
