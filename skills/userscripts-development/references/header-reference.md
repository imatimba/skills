# Userscript Header Tags Reference

Complete documentation for all userscript header tags. Normative guidance here is manager-agnostic; when a concrete manager must be shown for UI steps, Violentmonkey is the worked example. Per-manager differences are labeled and qualified with the manager name — see [managers.md](managers.md) for the verified source of truth.

## Starter Templates

**Simple script — no GM APIs (`@grant none`):**

```javascript
// ==UserScript==
// @name         My Script Name                    // <- CUSTOMISE: unique name
// @namespace    https://example.com/scripts/      // <- CUSTOMISE: your namespace
// @version      1.0.0                             // <- INCREMENT on every update
// @description  Brief description
// @author       Your Name
// @match        https://example.com/*             // <- CUSTOMISE: target URLs
// @grant        none                              // <- ADD grants only as needed
// @run-at       document-end                      // explicit beats defaults (they differ per manager)
// ==/UserScript==

(function () {
  "use strict";
  // your code here
})();
```

**Async script using GM.* promise APIs (preferred):**

```javascript
// ==UserScript==
// @name         My Script Name
// @namespace    https://example.com/scripts/
// @version      1.0.0
// @description  Brief description
// @author       Your Name
// @match        https://example.com/*
// @grant        GM.getValue
// @grant        GM.setValue
// @run-at       document-end
// ==/UserScript==

(async () => {
  "use strict";
  const setting = await GM.getValue("myKey", "default");
})();
```

Templates use `document-end` explicitly because defaults differ per manager (Tampermonkey defaults to `document-idle`; Violentmonkey, Greasemonkey 4+, and Safari default to `document-end` — see [@run-at](#run-at) and [managers.md](managers.md) §3 — verified 2026-08-25 — violentmonkey.github.io/api/metadata-block documents `document-end` as default; tampermonkey.net/documentation.php TOC lists @run-at). Templates are runnable as-is with explicit grants and IIFE/async wrappers. Prefer promise APIs (`GM.*`) for portability; legacy sync forms (`GM_*`) are absent in Greasemonkey 4+ and Safari (verified 2026-08-25 — wiki.greasespot.net/@grant lists GM.getValue/GM.setValue migration; violentmonkey.github.io/api/gm lists GM.* promise APIs).

TypeScript setup: [typescript.md](typescript.md). Per-manager header support: [managers.md](managers.md).

## Metadata Block Format

```javascript
// ==UserScript==
// @tag value
// ==/UserScript==
```

---

## Script Identity

### @name

The script's display name. Supports i18n with locale suffixes (`:de`, `:fr`, `:zh-CN` etc.) — verified 2026-08-25 — violentmonkey.github.io/api/metadata-block and wiki.greasespot.net/Metadata_block.

```javascript
// @name         My Awesome Script
// @name:de      Mein tolles Skript
```

### @namespace

Unique identifier namespace, typically a URL you control. Always set a stable value for portability. If omitted, Violentmonkey falls back to an empty string (`''`) — verified 2026-08-25 — violentmonkey.github.io/api/metadata-block; Greasy Fork requires `@namespace` (verified 2026-08-25 — greasyfork.org/en/help/meta-keys).

```javascript
// @namespace    https://yoursite.com/userscripts
```

### @version

Script version for update checking. Must increase with each update (required for auto-update). Greasy Fork expects Mozilla version format and warns if not incremented — verified 2026-08-25 — greasyfork.org/en/help/meta-keys.

```javascript
// @version      1.0.0
```

**See:** [version-numbering.md](version-numbering.md) for comparison rules.

### @description

Brief description. Supports i18n (`:locale` suffix) (verified 2026-08-25 — greasyfork.org/en/help/meta-keys lists @description and @description:XX-YY locale variants; violentmonkey.github.io/api/metadata-block documents multilingual keys).

```javascript
// @description       Enhances the user interface with dark mode
// @description:de    Verbessert die Benutzeroberfläche mit Dunkelmodus
```

### Other identity / catalog headers — no runtime portability effect

The following are parsed by managers/catalogs but do not affect execution or cross-manager portability. Include them for catalog display; no per-manager divergence to handle. Add only as needed.

```javascript
// @author       John Doe          // display only (verified 2026-08-25 — greasyfork.org/en/help/meta-keys; tampermonkey.net/documentation.php TOC lists @author)
// @copyright    2024, John Doe    // display only (verified 2026-08-25 — tampermonkey.net/documentation.php TOC lists @copyright)
// @homepage     https://github.com/user/repo  // aliases: @homepageURL/@website/@source (verified 2026-08-25 — tampermonkey.net/documentation.php TOC groups @homepage, @homepageURL, @website, @source)
// @supportURL   https://github.com/user/repo/issues  // (verified 2026-08-25 — tampermonkey.net/documentation.php TOC lists @supportURL; greasyfork.org/en/help/meta-keys)
// @icon         https://example.com/icon.png  // may be absolute, data: URI, or relative to download URL — verified 2026-08-25 — wiki.greasespot.net/Metadata_block
// @icon64       https://example.com/icon64.png  // 64px variant (verified 2026-08-25 — tampermonkey.net/documentation.php TOC lists @icon64, @icon64URL)
```

---

## URL Matching

### @match

Specify pages where the script runs. Base grammar is Chrome match patterns (verified 2026-08-25 — developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns); Violentmonkey ≥2.10.4 adds a documented superset (verified 2026-08-25 — violentmonkey.github.io/api/matching) (see [url-matching.md](url-matching.md) and [managers.md](managers.md) §3).

**Pattern format:** `<scheme>://<host><path>`

```javascript
// @match        https://example.com/*
// @match        https://*.example.com/*
// @match        *://example.com/*
```

**Portability:** Stay within base Chrome grammar for portable `@match`. Violentmonkey extensions (`.tld` wildcard `https://example.*/*`, extra host wildcards `*.example.*`, `*example.com`) work only in Violentmonkey — use explicit `@match` per TLD or `@include` globs for cross-manager TLD coverage. See [url-matching.md](url-matching.md).

### @include

Legacy matching with glob patterns and regex (`/regex/`). Use `@match` for new scripts.

```javascript
// @include      https://example.com/*
// @include      /^https:\/\/www\.example\.com\/page\/\d+$/
```

Neither `@match` nor `@include` matches the URL hash fragment or query string — they match only scheme/host/path (verified 2026-08-25 — violentmonkey.github.io/api/matching `match patterns only work on scheme, host and path`; tampermonkey.net/documentation.php TOC lists @match/@include). For SPA routing combine a broad `@match` with `window.onurlchange` (Tampermonkey only — verified 2026-08-25 — tampermonkey.net/documentation.php lists window.onurlchange) or history-patching fallback. `@include` with `://` is interpreted like `@match`.

### @exclude

Exclude URLs even if matched by `@match`/`@include` (verified 2026-08-25 — violentmonkey.github.io/api/matching documents @exclude; tampermonkey.net/documentation.php TOC lists @exclude; wiki.greasespot.net/Metadata_block documents @exclude).

```javascript
// @match        https://example.com/*
// @exclude      https://example.com/admin/*
```

### @exclude-match — Violentmonkey-only

Match-pattern exclusion. Violentmonkey recommends it as companion to `@match`.

```javascript
// @match          https://example.com/*
// @exclude-match  https://example.com/admin/*
```

Portability: Tampermonkey does not parse `@exclude-match` (verified 2026-08-25 — violentmonkey.github.io/api/metadata-block documents @exclude-match; tampermonkey.net/documentation.php TOC lists only @exclude, no @exclude-match) — use `@exclude` for portable exclusion. Precedence (Violentmonkey per violentmonkey.github.io/api/matching — verified 2026-08-25): `@exclude`/`@exclude-match` checked first → if matched script doesn't run; otherwise if any `@match` defined `@include` is ignored (fallback only when no `@match`).

> **Publishing note (Greasy Fork):** Every script must have at least one `@match` or `@include` (verified 2026-08-25 — greasyfork.org/en/help/meta-keys).

---

## Execution Control

### @run-at

When to inject the script.

| Value | Description | Support |
|-------|-------------|---------|
| `document-start` | Before DOM | All managers |
| `document-body` | When body exists | Tampermonkey; Violentmonkey 2.12.10+ — invalid in Greasemonkey 4+, ignored by Safari |
| `document-end` | At/after DOMContentLoaded | All — **default in Violentmonkey, Greasemonkey 4+, Safari** |
| `document-idle` | After window load / shortly after DOMContentLoaded | All — **default in Tampermonkey only** |
| `context-menu` | Click in browser context menu | **Tampermonkey only** |

Defaults: Tampermonkey `document-idle` (verified 2026-08-25 — tampermonkey.net/documentation.php lists @run-at; Violentmonkey default documented as document-end); Violentmonkey, Greasemonkey 4+, and Safari `document-end` (verified 2026-08-25 — violentmonkey.github.io/api/metadata-block marks `document-end` as default). Set explicitly to avoid cross-manager drift. See [managers.md](managers.md) §3.

```javascript
// @run-at       document-start
// @run-at       document-idle
// @run-at       context-menu  // Tampermonkey only — @include/@exclude ignored with it
```

Other managers parse `context-menu` but do not implement it.

### @run-in — Tampermonkey-only (Tampermonkey 5.3+ — verified 2026-08-25 — tampermonkey.net/documentation.php TOC shows @run-in <sup>v5.3+</sup>; parsed but ignored elsewhere)

Control browser context — Violentmonkey, Greasemonkey 4+, Safari parse but ignore.

| Value | Behaviour |
|-------|-----------|
| `normal-tabs` | Only normal tabs |
| `incognito-tabs` | Incognito/private only |
| `container-id-N` | Firefox containers |

Portable implication: no equivalent elsewhere; Firefox containers otherwise unreachable. Declaring is harmless (ignored) but don't rely on it for portability.

```javascript
// @run-in       normal-tabs
```

### @noframes

Only run on top-level page, not in iframes. Presence enables; off by default (scripts run in frames) — verified 2026-08-25 — wiki.greasespot.net/Metadata_block.

```javascript
// @noframes
```

---

## Permissions and Security

### @grant

Whitelist GM APIs and special window features. Prefer promise forms (`GM.*`) for portability — Greasemonkey 4+ and Safari expose only promise forms (verified 2026-08-25 — violentmonkey.github.io/api/metadata-block documents @grant with GM.* since VM2.12.10; wiki.greasespot.net/@grant documents @grant none default; violentmonkey.github.io/api/gm lists GM.* APIs). `GM_info`/`GM.info` is available without a grant everywhere (verified 2026-08-25 — violentmonkey.github.io/api/gm).

Portable rule: use `GM.*` (`GM.getValue`/`GM.setValue`/`GM.xmlHttpRequest`/`GM.addStyle`/etc.). Legacy `GM_*` sync forms are absent in Greasemonkey 4+ and Safari. Batch `GM.getValues`/`setValues` is Tampermonkey 5.3+ and Violentmonkey 2.19.1+ only — feature-detect or avoid for portable scripts. See [managers.md](managers.md) §2 for per-API matrix and [sandbox-modes.md](sandbox-modes.md).

```javascript
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.xmlHttpRequest
// @grant        unsafeWindow        // needed for page-world access; unavailable in Safari — see @sandbox
// @grant        window.onurlchange  // Tampermonkey only
// @grant        none                // disable sandbox — only GM_info survives
```

> **Boxed note — `no @grant` vs `@grant none` semantics (see [managers.md](managers.md) §3):**
> - **Tampermonkey:** different — empty grant list keeps sandbox enabled; `none` disables it (page context, only `GM_info` survives).
> - **Violentmonkey ≥2.32:** different — no grant = minimal sandbox (`GM_info` + `unsafeWindow`); `none` = full page context.
> - **Greasemonkey 4+ / Safari:** equivalent — no grant and `none` behave the same (both sandboxed/isolated; Safari always content-world when any grant exists).
> `GM_info` / `GM.info` is available in all cases without a grant.

### @sandbox — Tampermonkey-only (Tampermonkey 4.18+ — verified 2026-08-25 — tampermonkey.net/documentation.php TOC shows @sandbox <sup>4.18+</sup>; honored only by Tampermonkey) / @inject-into (Violentmonkey/Safari)

Control injection context. Mapping is conceptual — each manager enforces its own world set.

| Tampermonkey `@sandbox` | Violentmonkey / Safari `@inject-into` | Greasemonkey 4+ | Meaning |
|-------------------------|----------------------------------------|-----------------|---------|
| `raw` | `page` | n/a — always sandboxed | Page world (MAIN_WORLD) |
| `JavaScript` | `auto` (default in Violentmonkey) | n/a | Needs `unsafeWindow`; may use isolated/user-script world |
| `DOM` | `content` | n/a | DOM-only; most isolated |

Tampermonkey ignores `@inject-into`; Violentmonkey/Safari ignore `@sandbox`; Greasemonkey 4+ ignores both (always sandboxed). See [sandbox-modes.md](sandbox-modes.md) and [managers.md](managers.md) §4. Runtime detection: `GM_info.sandboxMode` (`'js'|'raw'|'dom'` TM 4.18+) vs `GM_info.injectInto` (`'auto'|'page'|'content'` VM).

```javascript
// @sandbox      JavaScript  // Tampermonkey
// @inject-into  auto        // Violentmonkey default — tries page, falls back to content
```

### @connect

Whitelist domains for `GM_xmlhttpRequest` / `GM.xmlHttpRequest` (verified 2026-08-25 — tampermonkey.net/documentation.php TOC lists @connect; violentmonkey.github.io/api/metadata-block does not list @connect, consistent with non-enforcement).

```javascript
// @connect      api.example.com
// @connect      *
```

Enforcement (see [managers.md](managers.md) §2) (verified 2026-08-25 — tampermonkey.net/documentation.php TOC lists @connect and GM_xmlhttpRequest enforcement note; violentmonkey.github.io/api/metadata-block omits @connect implying no enforcement):

| Manager | Enforcement |
|---------|-------------|
| Tampermonkey | **Strict** — unlisted hosts prompt/block |
| Violentmonkey | Declared but **NOT enforced** |
| Greasemonkey 4+ / Safari | Ignored / n/a |

Portable: declare known domains; non-enforcing managers ignore — never hurts portability.

---

## External Resources

### @require

Load external JavaScript before script runs. URL may be relative to the script's install URL — verified 2026-08-25 — wiki.greasespot.net/Metadata_block and violentmonkey.github.io/api/metadata-block. With SRI hash: `...js#sha256=...` (see [SRI](#subresource-integrity-sri)).

```javascript
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      ./lib/helper.js  // relative to install URL
// @require      https://example.com/lib.js#sha256=abc123
```

Portable: use `https://` CDN URLs. `tampermonkey://vendor/` scheme is Tampermonkey-only — avoid for portability (use CDN instead).

### @resource

Preload resource for `GM.getResourceText`/`GM.getResourceUrl`. URL may be relative — verified 2026-08-25 — wiki.greasespot.net/Metadata_block and violentmonkey.github.io/api/metadata-block.

```javascript
// @resource     myCSS    https://example.com/style.css
```

With SRI: `...#sha256=...`. Note: resources/`GM_getResourceText` not implemented in Greasemonkey 4+ and Safari — portable fallback is `fetch(await GM.getResourceUrl(...))` (see [managers.md](managers.md) §2).

---

## Updates

### @updateURL

URL to check for updates (requires `@version`) (verified 2026-08-25 — tampermonkey.net/documentation.php TOC lists @updateURL; greasyfork.org/en/help/meta-keys lists @updateURL/@downloadURL grouping).

```javascript
// @updateURL    https://example.com/script.meta.js
```

### @downloadURL

URL to download updates from. Use `none` to disable. Violentmonkey auto-adds `@downloadURL` when using "Install from URL" — verified 2026-08-25 — violentmonkey.github.io/api/metadata-block (`Automatically added when using "Install from URL."`).

```javascript
// @downloadURL  https://example.com/script.user.js
// @downloadURL  none
```

### @installURL — legacy alias of @downloadURL

Legacy alias (Greasemonkey wiki — verified 2026-08-25 — wiki.greasespot.net/Metadata_block). Prefer `@downloadURL`.

Greasy Fork strips `@updateURL`/`@downloadURL`/`@installURL` on publish so installs update only from Greasy Fork (verified 2026-08-25 — greasyfork.org/en/help/meta-keys) — portable implication: explicit URLs are ignored when published there.

---

## Catalog-enforced headers — parsed by directories, ignored by managers

Managers install the script regardless; these affect listing, compliance, and donation UI. No runtime portability divergence — include only if you publish to that catalog.

```javascript
// @license      MIT  // SPDX — Greasy Fork optional (verified 2026-08-25 — greasyfork.org/en/help/meta-keys does not list @license as required); OpenUserJS requires OSI-approved SPDX (verified 2026-08-25 — openuserjs.org/announcements/Licensing_enforcement) — prefer MIT/GPL-3.0-only/Apache-2.0
// @compatible   firefox Must disable pop-up blocker  // Greasy Fork display; browsers: firefox/chrome/opera/safari/edge/brave (verified 2026-08-25 — greasyfork.org/en/help/meta-keys)
// @incompatible safari Broken since FF 23
// @contributionURL    https://www.paypal.com/...  // donation page (Scriptish origin)
// @contributionAmount 5.00
// @antifeature  ads We show advertisements  // disclose monetisation; Greasy Fork requires it, managers ignore (verified 2026-08-25 — tampermonkey.net/documentation.php TOC lists @antifeature; greasyfork.org/en/help/antifeatures lists ads/tracking/miner/payment/membership/referral-link)
```

---

## Web Request Interception

### @webRequest — Tampermonkey experimental — Firefox MV2 only; broken on Chrome MV3; not in Violentmonkey / Greasemonkey 4+ / Safari (verified 2026-08-25 — tampermonkey.net/documentation.php TOC lists @webRequest)

```javascript
// @webRequest   {"selector": "*://ads.example.com/*", "action": "cancel"}
```

Portable fallback: page-level `fetch`/`XHR` patching — works everywhere (see [web-requests.md](web-requests.md) and [managers.md](managers.md) §2).

---

## Miscellaneous — manager-specific, no portable guarantee

```javascript
// @tag          productivity          // Tampermonkey 5.0+ / Violentmonkey 2.35.2+ — categorisation tags in script list (verified 2026-08-25 — violentmonkey.github.io/api/metadata-block) — managers parse but may not surface; safe to include, not portable to rely on
// @unwrap                                // Violentmonkey since 2.13.1 (verified 2026-08-25 — violentmonkey.github.io/api/metadata-block) — inject without wrapper; ignored elsewhere
// @top-level-await                       // Violentmonkey since 2.19.2 (verified 2026-08-25 — violentmonkey.github.io/api/metadata-block) — enables top-level await via async wrapper; incompatible with @unwrap (verified 2026-08-25 — violentmonkey.github.io/api/metadata-block `Can't be used with @unwrap`); ignored elsewhere — (verified 2026-08-25 — violentmonkey.github.io/api/metadata-block#top-level-await)
```

---

## Subresource Integrity (SRI)

Pin `@require` / `@resource` with `#sha256=...` or `#md5=...` (comma/semicolon-separated, last supported wins; hex or base64).

**Portability:** Tampermonkey supports SRI (verified 2026-08-25 — tampermonkey.net/documentation.php TOC lists Subresource Integrity); Violentmonkey partial; Greasemonkey 4+ none — verify before relying. See [managers.md](managers.md) §3. Source: tampermonkey.net/documentation.php?q=sri (verified 2026-08-25 — tampermonkey.net/documentation.php TOC lists Subresource Integrity). Greasy Fork allows arbitrary `@require` URLs **with** a valid SRI hash and monitors mismatches (verified 2026-08-25 — greasyfork.org/en/help/meta-keys notes SRI hashes for @require/@resource).

```javascript
// @require      https://example.com/lib.js#sha256=abc123def456
// @require      https://example.com/lib.js#md5=abc,sha256=def  // last supported wins
```
