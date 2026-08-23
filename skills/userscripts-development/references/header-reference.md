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

Templates use `document-end` explicitly because defaults differ per manager (Tampermonkey defaults to `document-idle`; Violentmonkey, Greasemonkey 4+, and Safari default to `document-end` — see [@run-at](#run-at) and [managers.md](managers.md) §3). Prefer promise APIs (`GM.*`) for portability; legacy sync forms (`GM_*`) are absent in Greasemonkey 4+ and Safari.

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

The script's display name. Supports internationalisation.

```javascript
// @name         My Awesome Script
// @name:de      Mein tolles Skript
// @name:fr      Mon script génial
// @name:ja      私の素晴らしいスクリプト
```

### @namespace

Unique identifier namespace, typically a URL you control.

```javascript
// @namespace    https://yoursite.com/userscripts
```

### @version

Script version for update checking. Must increase with each update.

```javascript
// @version      1.0.0
// @version      2.3.1-beta
// @version      2024-01-15
```

**See:** [version-numbering.md](version-numbering.md) for comparison rules.

### @description

Brief description of what the script does. Supports i18n.

```javascript
// @description       Enhances the user interface with dark mode
// @description:de    Verbessert die Benutzeroberfläche mit Dunkelmodus
```

### @author

The script author's name.

```javascript
// @author       John Doe
```

### @copyright

Copyright statement shown in the script editor.

```javascript
// @copyright    2024, John Doe (https://example.com)
```

### @homepage, @homepageURL, @website, @source

Link to the script's homepage (all are aliases).

```javascript
// @homepage     https://github.com/user/repo
// @supportURL   https://github.com/user/repo/issues
```

### @supportURL

URL for users to report issues.

```javascript
// @supportURL   https://github.com/user/repo/issues
```

---

## Icons

### @icon, @iconURL, @defaulticon

Script icon (low resolution).

```javascript
// @icon         https://example.com/icon.png
// @icon         data:image/png;base64,iVBORw0...
```

### @icon64, @icon64URL

Script icon at 64x64 pixels. Used at various places in the options page.

```javascript
// @icon64       https://example.com/icon64.png
```

---

## URL Matching

### @match

Specify pages where the script runs. Uses match patterns. Base grammar is Chrome match patterns; Violentmonkey ≥2.10.4 adds a documented superset (see [url-matching.md](url-matching.md) and [managers.md](managers.md) §3).

**Pattern format:** `<scheme>://<host><path>`

```javascript
// Match all pages on example.com
// @match        https://example.com/*

// Match any subdomain
// @match        https://*.example.com/*

// Match all HTTPS sites
// @match        https://*/*

// Match HTTP and HTTPS
// @match        *://example.com/*

// Match specific paths
// @match        https://example.com/page/*/details

// Multiple matches (use multiple tags)
// @match        https://example.com/*
// @match        https://other.com/*
```

**Special patterns:**
- `*` in scheme matches http or https
- `*` in host matches any subdomain
- `*` in path matches any characters

### @include

Legacy matching with glob patterns and regex support.

```javascript
// Glob patterns
// @include      https://example.com/*
// @include      *://*.example.com/*

// Regular expression (wrapped in //)
// @include      /^https:\/\/www\.example\.com\/page\/\d+$/
```

**Note:** @include with `://` is interpreted like @match. Use @match for new scripts.

### @exclude

Exclude URLs even if matched by @match or @include.

```javascript
// @match        https://example.com/*
// @exclude      https://example.com/admin/*
// @exclude      https://example.com/api/*
```

### @exclude-match — Violentmonkey-only (unsupported in Tampermonkey)

Match-pattern exclusion — Violentmonkey documents it as the recommended companion to `@match` (preferred over `@include` / `@exclude`).

```javascript
// @match          https://example.com/*
// @exclude-match  https://example.com/admin/*
```

Matching logic (Violentmonkey): a script runs if **any** `@match` or `@include` rule matches **and** no `@exclude-match` or `@exclude` rule matches. Tampermonkey does not parse `@exclude-match` (parser.js only handles `@exclude`; issue Tampermonkey/tampermonkey#2161 reports `"@exclude-match" is not a valid userscript header`). Use `@exclude` for Tampermonkey-compat exclusion.

Verify: violentmonkey.github.io/api/metadata-block · violentmonkey.github.io/api/matching

---

## Execution Control

### @run-at

When to inject the script.

| Value | Description | Support |
|-------|-------------|---------|
| `document-start` | Inject as early as possible, before DOM | All managers |
| `document-body` | Inject when body element exists | Tampermonkey; Violentmonkey 2.12.10+ — invalid enum in Greasemonkey 4+, ignored by Safari |
| `document-end` | Inject at/after DOMContentLoaded | All — **default in Violentmonkey, Greasemonkey 4+, Safari** |
| `document-idle` | Inject after window load / shortly after DOMContentLoaded | All — **default in Tampermonkey only** |
| `context-menu` | Inject when clicked in browser context menu | **Tampermonkey only** |

Defaults: Tampermonkey `document-idle`; Violentmonkey, Greasemonkey 4+, and Safari `document-end`. Set explicitly to avoid cross-manager drift. See [managers.md](managers.md) §3.

> **Greasemonkey 4 note:** only `document-end` is guaranteed; `document-body` is an invalid enum and `context-menu` / `document-idle` may be treated as `document-end` or ignored — verify per Greasemonkey docs.

```javascript
// @run-at       document-start
// @run-at       document-idle
// @run-at       context-menu  // Tampermonkey only
```

**Note (Tampermonkey):** With `context-menu`, `@include` and `@exclude` are ignored. Other managers parse `context-menu` but do not implement it.

### @run-in — Tampermonkey-only (Tampermonkey 5.3+; parsed but ignored elsewhere)

Control browser context (normal vs incognito tabs). Violentmonkey, Greasemonkey 4+, and Safari parse the header without error but ignore it.

| Value | Behaviour | Support |
|-------|-----------|---------|
| `normal-tabs` | Only in normal tabs | Tampermonkey 5.3+ |
| `incognito-tabs` | Only in incognito/private mode | Tampermonkey 5.3+ |
| `container-id-N` | Firefox containers (e.g., `container-id-2`) | Tampermonkey 5.3+ |

```javascript
// Only in normal tabs
// @run-in       normal-tabs

// Only in incognito/private mode
// @run-in       incognito-tabs

// Firefox containers
// @run-in       container-id-2
// @run-in       container-id-3
```

Default: Runs in all tabs if not specified. Other managers: no equivalent — Firefox containers otherwise unreachable from userscript headers.

### @noframes

Only run on main page, not in iframes.

```javascript
// @noframes
```

---

## Permissions and Security

### @grant

Whitelist GM APIs and special window features. Prefer promise forms (`GM.*`) for portability; Greasemonkey 4+ and Safari expose only the promise forms.

| Need | Legacy `@grant` (sync `GM_*`) | Promise `@grant` (async `GM.*`) | Availability |
|------|-------------------------------|----------------------------------|--------------|
| Storage get/set | `GM_getValue` / `GM_setValue` | `GM.getValue` / `GM.setValue` | `GM_*` absent in Greasemonkey 4+, Safari |
| List/delete storage | `GM_listValues` / `GM_deleteValue` | `GM.listValues` / `GM.deleteValue` | Same |
| Batch storage | `GM_getValues` / `GM_setValues` | `GM.getValues` / `GM.setValues` | Tampermonkey 5.3+, Violentmonkey 2.19.1+ only |
| XHR / fetch | `GM_xmlhttpRequest` | `GM.xmlHttpRequest` | Sync form absent in Greasemonkey 4+, Safari |
| Style | `GM_addStyle` | `GM.addStyle` | Sync absent in Greasemonkey 4+ (polyfill only); Safari partial |
| Element | `GM_addElement` | `GM.addElement` | Absent in Greasemonkey 4+, Safari |
| Menu command | `GM_registerMenuCommand` | `GM.registerMenuCommand` | Async re-added later in Greasemonkey 4+; absent in Safari |
| Notification | `GM_notification` | `GM.notification` | Absent in Safari |
| Clipboard | `GM_setClipboard` | `GM.setClipboard` | Promise-only in Greasemonkey 4+, Safari |
| Tab | `GM_openInTab` | `GM.openInTab` | Promise forms vary by manager |
| Resources | `GM_getResourceText` / `GM_getResourceURL` | `GM.getResourceText` / `GM.getResourceUrl` | Safari: resources not implemented |
| Page window | `unsafeWindow` | `unsafeWindow` (same) | Requires explicit grant when other grants exist in Tampermonkey; unavailable in Safari |
| SPA event | `window.onurlchange` | `window.onurlchange` (same) | **Tampermonkey only** |
| Window control | `window.close` / `window.focus` | `window.close` / `window.focus` | Manager support varies — see [managers.md](managers.md) |

```javascript
// Legacy sync grants
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_notification

// Promise grants (preferred)
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.xmlHttpRequest
// @grant        GM.addStyle

// Special window access
// @grant        unsafeWindow
// @grant        window.close
// @grant        window.focus
// @grant        window.onurlchange  // Tampermonkey only

// Disable sandbox (no GM APIs except GM_info)
// @grant        none
```

> **Boxed note — `no @grant` vs `@grant none` semantics (see [managers.md](managers.md) §3):**
> - **Tampermonkey:** different — empty grant list keeps the sandbox enabled (GM APIs need explicit grants); `none` disables the sandbox (page context, only `GM_info` survives).
> - **Violentmonkey ≥2.32:** different — no grant = minimal sandbox (`GM_info` + `unsafeWindow` available); `none` = full page context.
> - **Greasemonkey 4+ / Safari:** equivalent — no grant and `none` behave the same (both sandboxed / both isolated respectively; Safari always content-world when any grant exists).
> `GM_info` / `GM.info` is available in all cases without a grant.

**See:** [sandbox-modes.md](sandbox-modes.md) and [managers.md](managers.md) §4 for injection vs sandbox implications.

### @sandbox — Tampermonkey-only (Tampermonkey 4.18+; honored only by Tampermonkey)

Control script injection context in Tampermonkey. Other managers ignore `@sandbox`; use the per-manager directive for the same intent. See [sandbox-modes.md](sandbox-modes.md) and [managers.md](managers.md) §4.

| Tampermonkey `@sandbox` | Violentmonkey / Safari `@inject-into` | Greasemonkey 4+ | Meaning |
|-------------------------|----------------------------------------|-----------------|---------|
| `raw` | `page` | n/a — always sandboxed | Run in page world (MAIN_WORLD) |
| `JavaScript` | `auto` (default in Violentmonkey) | n/a — always sandboxed | Need `unsafeWindow`; may use isolated/user-script world |
| `DOM` | `content` | n/a — always sandboxed | DOM-only; most isolated |

Mapping is conceptual, not 1:1 — each manager enforces its own world set and fallback. Tampermonkey ignores `@inject-into`; Violentmonkey and Safari ignore `@sandbox`; Greasemonkey 4+ ignores both (always sandboxed via Xray vision in Firefox).

Tampermonkey values:

| Value | Behaviour |
|-------|-----------|
| `raw` | Run in page context (MAIN_WORLD) — default in Tampermonkey |
| `JavaScript` | Need `unsafeWindow` access, may use USERSCRIPT_WORLD |
| `DOM` | Only need DOM access, may use ISOLATED_WORLD |

```javascript
// Tampermonkey
// @sandbox      JavaScript
// @sandbox      DOM
// @sandbox      raw

// Violentmonkey / Safari equivalent
// @inject-into  auto     // default in Violentmonkey — tries page, falls back to content
// @inject-into  page     // force page world (subject to CSP)
// @inject-into  content  // force isolated/content world

// Greasemonkey 4+ — no directive; always sandboxed
```

**See:** [sandbox-modes.md](sandbox-modes.md) for details. Runtime detection: Tampermonkey uses `GM_info.sandboxMode` (`'js'|'raw'|'dom'` since Tampermonkey 4.18+); Violentmonkey uses `GM_info.injectInto` (`'auto'|'page'|'content'`) — feature-detect, don't branch on names alone.

### @connect

Whitelist domains for `GM_xmlhttpRequest` / `GM.xmlHttpRequest`.

```javascript
// @connect      api.example.com
// @connect      *.googleapis.com
// @connect      self
// @connect      localhost
// @connect      127.0.0.1
// @connect      *
```

Enforcement (see [managers.md](managers.md) §2):

| Manager | Enforcement |
|---------|-------------|
| Tampermonkey | **Strict** — unlisted hosts prompt or block; checks initial and final URL after redirects |
| Violentmonkey | Declared but **NOT enforced** — requests allowed regardless |
| Greasemonkey 4+ | Ignored / not used |
| Safari | Not applicable — not enforced |

**Best practice (Tampermonkey-compat):** Declare known domains explicitly; add `*` only to offer an "allow all" toggle where your manager surfaces it. Declaring hosts never hurts portability — non-enforcing managers simply ignore the list.

### @antifeature

Disclose monetisation (required by GreasyFork).

```javascript
// @antifeature       ads         We show advertisements
// @antifeature       tracking    Analytics included
// @antifeature       miner       Uses crypto mining
// @antifeature:de    ads         Wir zeigen Werbung an
```

---

## External Resources

### @require

Load external JavaScript before script runs.

```javascript
// External URLs
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js

// With integrity hash (SRI) — support varies, see SRI section
// @require      https://code.jquery.com/jquery-3.6.0.min.js#sha256-/xUj+3OJU...

// Multiple hashes
// @require      https://example.com/lib.js#md5=abc123,sha256=def456

// Built-in vendor libraries — Tampermonkey-specific URL scheme
// @require      tampermonkey://vendor/jquery.js
// @require      tampermonkey://vendor/jszip/jszip.js
// Other managers: use a plain https URL via @require (e.g., CDN) — tampermonkey://vendor is ignored elsewhere
```

### @resource

Preload resources accessible via `GM_getResourceText`/`GM_getResourceURL` (or `GM.getResourceText`/`GM.getResourceUrl`).

```javascript
// @resource     myCSS    https://example.com/style.css
// @resource     myIcon   https://example.com/icon.png
// @resource     myData   https://example.com/data.json

// With integrity hash
// @resource     secure   https://example.com/file.js#sha256=abc123
```

---

## Updates

### @updateURL

URL to check for updates (requires @version).

```javascript
// @updateURL    https://example.com/script.meta.js
```

### @downloadURL

URL to download updates from. Use `none` to disable.

```javascript
// @downloadURL  https://example.com/script.user.js
// @downloadURL  none
```

### @installURL — legacy alias of @downloadURL

Legacy alias of `@downloadURL` (Greasemonkey wiki). Greasy Fork strips `@installURL` on publish (like `@updateURL` / `@downloadURL` it is rewritten to point at Greasy Fork).

```javascript
// @installURL   https://example.com/script.user.js  // legacy — prefer @downloadURL
```

---

## Catalog-enforced headers

Parsed and displayed by catalogs, mostly ignored by managers — the manager installs the script regardless, but the catalog surfaces these for listing, compliance, and donation UI.

### @license

SPDX name or free-form license. **REQUIRED by OpenUserJS ToS** — if absent, OpenUserJS treats it as implied MIT. Prefer an SPDX identifier (`MIT`, `GPL-3.0-only`, `Apache-2.0`).

```javascript
// @license      MIT
// @license      GPL-3.0-only
```

### @compatible / @incompatible

Browser compatibility hints displayed on Greasy Fork. Format `browser [comment]` — recognized browsers `firefox`, `chrome`, `opera`, `safari`, `edge`, `brave`.

```javascript
// @compatible   firefox Must disable pop-up blocker
// @incompatible safari Broken since FF 23
```

Verify: greasyfork.org/en/help/meta-keys

### @contributionURL / @contributionAmount

Donation page and suggested amount (Scriptish origin), shown on Greasy Fork feedback pages.

```javascript
// @contributionURL    https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=you@example.com&item_name=Greasy+Fork+donation
// @contributionAmount 5.00
```

### @antifeature

Disclose monetisation / author-benefiting behaviour. Greasy Fork requires it; managers largely ignore it.

```javascript
// @antifeature  ads We show advertisements
// @antifeature  tracking Analytics included
// @antifeature:de ads Wir zeigen Werbung an  // :locale i18n variant
```

| Type | Catalog enforcement | Notes |
|------|---------------------|-------|
| `ads` | Tampermonkey docs + Greasy Fork | Advertisements |
| `tracking` | Tampermonkey docs + Greasy Fork | Analytics / user tracking |
| `miner` | Tampermonkey docs + Greasy Fork | Crypto mining / resource use |
| `payment` | Greasy Fork only | Requires payment for full functionality |
| `membership` | Greasy Fork only | Requires membership / account |
| `referral-link` | Greasy Fork only | Affiliate / referral links |

Verify: tampermonkey.net/documentation.php?q=antifeature · greasyfork.org/en/help/antifeatures

---

## Web Request Interception

### @webRequest — Tampermonkey experimental — Firefox MV2 only; broken on Chrome MV3 (Tampermonkey 5.2+); not in Violentmonkey / Greasemonkey 4+ / Safari

Define request-interception rules. See [web-requests.md](web-requests.md) and [managers.md](managers.md) §2.

- **Tampermonkey:** experimental; **Firefox MV2 only**. Broken on Chrome MV3 since Tampermonkey 5.2+ (issue #2209); Chrome MV3 build cannot intercept.
- **Violentmonkey:** not implemented — wontfix (issue #583).
- **Greasemonkey 4+ / Safari:** not implemented.

```javascript
// @webRequest   {"selector": "*://ads.example.com/*", "action": "cancel"}
// @webRequest   {"selector": {"include": "*tracking*"}, "action": {"redirect": "https://example.com/blocked"}}
```

Prefer feature-detection and portable fallbacks (page-level `fetch`/`XHR` patching) when targeting Chrome MV3 or non-Tampermonkey managers — see [web-requests.md](web-requests.md).

---

## Miscellaneous

### @tag — Tampermonkey 5.0+

Add categorisation tags visible in script list.

```javascript
// @tag          productivity
// @tag          social-media
// @tag          utility
```

Other managers parse `@tag` but may not surface it in UI.

### @unwrap

Inject script without wrapper/sandbox (for Scriptlets).

```javascript
// @unwrap
```

### @top-level-await — Violentmonkey since 2.19.2

Enables top-level `await` in the userscript. **Incompatible with `@unwrap`** (no wrapper to make async). Violentmonkey adds an async wrapper around the script when this header is present.

```javascript
// @top-level-await
// await waitForElement('#app');
```

Verify: violentmonkey.github.io/api/metadata-block#top-level-await

---

## Subresource Integrity (SRI)

Ensure external resources haven't been tampered with.

**Manager support:** Tampermonkey yes; Violentmonkey partial; Greasemonkey 4+ none — verify before relying. See [managers.md](managers.md) §3.

**Supported hash algorithms:**
- SHA-256 (native)
- MD5 (native)
- SHA-1, SHA-384, SHA-512 (require window.crypto)

**Hash placement:** pin every `@require` / `@resource` with a suffix `#sha256=...` (primary) or `#md5=...` (acceptable). Multiple hashes are comma- or semicolon-separated; the last currently supported hash wins. Hex or base64 encoding accepted.

**Formats:**
- Hex: `#sha256=e3b0c44298fc1c149...`
- Base64: `#sha256-47DEQpj8HBSa+/TImW...`

```javascript
// Single hash — primary SHA-256
// @require      https://example.com/lib.js#sha256=abc123def456...

// MD5 fallback + SHA-256 (last supported wins)
// @require      https://example.com/lib.js#md5=abc,sha256=def

// Semicolon separator also allowed
// @require      https://example.com/lib.js#md5=abc;sha256=def
```

Source: tampermonkey.net/documentation.php?q=sri. Greasy Fork allows arbitrary `@require` URLs **with** a valid SRI hash and monitors mismatches (greasyfork.org/en/help/external-scripts).
