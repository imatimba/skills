# Publishing & Updates

When you publish or update scripts, read this first — catalog rules, update mechanics, and delivery gotchas that break installs if missed.

## Publishing to Greasy Fork

Greasy Fork enforces code inspectability and update integrity:

- **Code rules:** no obfuscated or minified code; 2 MB size limit (not bypassable by minifying); primary functionality must be hosted on Greasy Fork. (verified 2026-08-25 — greasyfork.org/en/help/code-rules)
- **Antifeatures:** disclose author-benefiting features via `@antifeature <type> <description>` — types `ads`, `membership`, `miner`, `payment`, `referral-link`, `tracking` (with `:locale` i18n variants, e.g. `@antifeature:de`). (verified 2026-08-25 — greasyfork.org/en/help/antifeatures + /help/meta-keys)
- **External executable code — allowlist only:** (verified 2026-08-25 — greasyfork.org/en/help/external-scripts)
  - Recognized CDNs (see Greasy Fork CDN list)
  - `@require` / `@resource` with SRI hash (`#sha256=...` or `#md5=...` in Tampermonkey format)
  - Greasy Fork-hosted libraries (syncable from GitHub)
  - Same-origin injection (script at `example.com` re-injecting `example.com` code only)
  - Non-executable loads (JSON, CSS) are exempt.
- **Rewrite on publish:** Greasy Fork rewrites `@updateURL` / `@downloadURL` to point at Greasy Fork and strips `@installURL`; inserts `@version` / `@namespace` if missing. (verified 2026-08-25 — greasyfork.org/en/help/meta-keys: "@updateURL, @installURL, @downloadURL — Greasy Fork will strip these keys" + "@version/@namespace — Greasy Fork requires this field")
- **Integrity checks:** warns on SRI hash mismatch and on version decrement. (verified 2026-08-25 — greasyfork.org/en/help/meta-keys: "@require/@resource will alert if hashes do not match" + "@version will warn if decremented")
- **Account:** 2FA required for password-based logins (2025 phased rollout; OAuth via Google/GitHub/GitLab exempt if password removed — greasyfork.org discussion #268441). UNVERIFIED (2026-08-25) — no 2FA requirement found in greasyfork.org help pages today; verify directly via Greasy Fork discussion #268441 and account settings.
- **Update-check & injection (verified 2026-08-25 — greasyfork.org/en/help/code-rules):** scripts must not check for updates more than once per day; do not dynamically inject another Greasy Fork-hosted script (bypasses manager caching) — Greasy Fork Code Rules.
- **Listing hygiene (verified 2026-08-25 — greasyfork.org/en/help/code-rules):** no ads in Greasy Fork descriptions, no unrelated keywords/sites to game search, no excessive version bumps to game ranking, no `@match`/`@include` for sites with no functionality, flag adult content — Code Rules.
- **Mozilla version format (verified 2026-08-25 — greasyfork.org/en/help/meta-keys + MDN Legacy Version Format):** `@version` must be Mozilla version format — up to 4 dot-separated parts, each `<number-a><string-b><number-c><string-d>`; hyphens create negative numbers (`2026-04-12` → `-04` fails comparison) — meta-keys + MDN Legacy Version Format.
- **Inline library attribution (verified 2026-08-25 — greasyfork.org/en/help/code-rules):** prefer `@require`; if inlined, include comment with source URL/name/version — Code Rules.
- **Library exemptions:** scripts marked as libraries are exempt from required `@version`/`@namespace` and `version_not_incremented` warnings. UNVERIFIED (2026-08-25) — via Greasy Fork script_version.rb source; not verifiable in help pages today, requires source-code inspection.
- **Rewriting extras:** on update `@description` is backfilled from prior version if missing; CRLF/CR normalized to LF. UNVERIFIED (2026-08-25) — not found in greasyfork.org help pages (code-rules/meta-keys/external-scripts) today; verify via Greasy Fork source/Rewriting docs directly.
- **SRI details:** Tampermonkey format supports `#sha256=`/`#sha256-` (both accepted after Greasy Fork fix), `#sha384`/`#sha512`/`#sha1` via `window.crypto`, `#md5=` legacy; multiple hashes comma/semicolon-separated, hex or Base64, last supported wins. UNVERIFIED (2026-08-25) — Tampermonkey SRI docs page structure changed; hash-format details not retrievable from tampermonkey.net/documentation.php today; verify via Tampermonkey SRI docs and Greasy Fork SRI fix notes.
- **Antifeature ≠ exemption (verified 2026-08-25 — greasyfork.org/en/help/code-rules + /help/antifeatures):** disclosing via `@antifeature` does not exempt a script from Code Rules on primary functionality or external-code allowlist — Code Rules + Antifeatures.

Verify: greasyfork.org

## Publishing to OpenUserJS

- **License:** OSI-approved `@license` REQUIRED; server now rejects new scripts/updates (incl. GitHub webhook pushes) lacking an OSI-approved SPDX `@license` (openuserjs.org/announcements/Licensing_enforcement) — implied MIT per ToS applies to legacy scripts only. Use an SPDX identifier (`MIT`, `GPL-3.0-only`, etc.). (verified 2026-08-25 — openuserjs.org/announcements/Licensing_enforcement: "if you don't utilize an OSI approved SPDX code for @license the server will automatically reject new scripts and script updates")
- **Update URL:** point `@updateURL` at the `.meta.js` variant, not the full `.user.js` — pointing at `.user.js` can flip the update engine to `FAIL` state. UNVERIFIED (2026-08-25) — not found in openuserjs.org announcements/docs today; known community guidance, verify via OpenUserJS webhook/meta docs.
- **GitHub import:** webhook available to sync from a GitHub repo. UNVERIFIED (2026-08-25) — not found in openuserjs.org announcements/docs today; verify via OpenUserJS import docs.
- **Size cap:** ~500 KiB hosted cap per script. UNVERIFIED (2026-08-25) — not found in openuserjs.org announcements/docs today.
- **Extra files:** ship via `@require` / `@resource` or data URIs (no arbitrary extra-file hosting). UNVERIFIED (2026-08-25) — not found in openuserjs.org announcements/docs today.
- **Maintenance & webhook branch:** site is low-maintenance; GitHub webhook has reported 403s when default branch is `main` instead of `master` (see OpenUserJS issue #1781 and 2025 discussion threads) — pin webhook to `master` or verify after push. UNVERIFIED (2026-08-25) — via GitHub issue #1781, not OpenUserJS announcements/docs; verify directly via issue tracker.
- **Dual/CC license pitfall (verified 2026-08-25 — openuserjs.org/announcements/Licensing_enforcement):** CC licenses (e.g. `CC-BY-NC-SA-4.0`) are rejected as primary `@license` because they are not OSI-approved; dual-license with an OSI-approved SPDX code first (e.g. `MIT`) — Licensing_enforcement (OSI-approved SPDX required).
- **Catalog rewriting difference (verified 2026-08-25 — greasyfork.org/en/help/meta-keys for Greasy Fork side; OpenUserJS side unverified):** Greasy Fork rewrites/strips `@updateURL`/`@downloadURL`/`@installURL` to force updates from Greasy Fork; OpenUserJS does not rewrite and serves `.meta.js` via `Accept: text/x-userscript-meta` negotiation — choose primary catalog accordingly. Greasy Fork side verified via /help/meta-keys; OpenUserJS negotiation UNVERIFIED (2026-08-25) — not found in announcements/docs today.

Verify: openuserjs.org

## Update Mechanics

| Header | Semantics |
|--------|-----------|
| `@updateURL` | Check-only URL — manager fetches metadata to compare `@version` |
| `@downloadURL` | Download-on-update URL — fetched when an update is available (`none` disables) |
| Absent both | Disables auto-update checks |
| `@version` | **REQUIRED** for auto-update. Violentmonkey never auto-updates a versionless script. |

(verified 2026-08-25 — violentmonkey.github.io/api/metadata-block: "@version — If no @version is specified, the script will not be updated automatically" + "@downloadURL — Checked for updates automatically")

- Smart servers return metadata-only responses to `@updateURL` (no need to serve the full script). UNVERIFIED (2026-08-25) — Violentmonkey docs describe @updateURL/@downloadURL but not explicit "smart server metadata-only" negotiation; verify via Tampermonkey/Violentmonkey update docs.
- Comparison is per-manager (see version-numbering.md); always bump `@version` and never decrement. (verified 2026-08-25 — greasyfork.org/en/help/meta-keys warns on version decrement + violentmonkey.github.io versioning)
- **Download suppression & cache busting (verified 2026-08-25 — violentmonkey.github.io/api/metadata-block + Tampermonkey docs):** `@downloadURL none` disables download on update; to force re-fetch of cached `@require`/`@resource` add `?v=` to the URL or bump `@version` — Violentmonkey/Tampermonkey docs.

Verify: violentmonkey.github.io

## Delivery & Serving Gotchas

- **GitHub Raw:** `raw.githubusercontent.com` serves `.user.js` as `text/plain` with `nosniff` — managers detect installs by the `.user.js` URL suffix, not MIME. Do not rely on content-type. (verified 2026-08-25 — raw.githubusercontent.com headers: Content-Type text/plain; charset=utf-8 + x-content-type-options nosniff; managers detect by suffix — Violentmonkey/Tampermonkey docs)
- **Tampermonkey MV3 (Chrome):** installs redirect through `tampermonkey.net` `script_installation.php` due to MV3 `webRequest` limits. UNVERIFIED (2026-08-25) — not retrievable from tampermonkey.net/documentation.php today; verify via Tampermonkey MV3 docs.
- **Version & namespace:** catalogs insert them if missing on import, but set them explicitly for portability. (verified 2026-08-25 — greasyfork.org/en/help/meta-keys: Greasy Fork requires @version/@namespace)
- **Cache:** managers cache `@require` / `@resource`; version bumps re-fetch externals — review SRI hashes on every bump. (verified 2026-08-25 — violentmonkey.github.io/api/metadata-block: @require/@resource downloaded at install)

Verify: tampermonkey.net · raw.githubusercontent.com

## See Also

- header-reference.md — `@updateURL`, `@downloadURL`, `@installURL`, `@version`
- version-numbering.md — version comparison per manager
- security-checklist.md — Supply Chain & External Code (SRI)
