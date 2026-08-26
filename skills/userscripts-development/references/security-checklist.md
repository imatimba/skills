# Security Checklist for Userscripts

Pre-delivery validation to ensure scripts are secure and well-formed. Per-manager facts follow [managers.md](managers.md); when a concrete manager is shown, **Violentmonkey** is the worked example.

---

## Critical Security Checks

These issues can expose users to serious risks. **Preserved at full strength — do not weaken.**

### 1. No Hardcoded Secrets

**Check:** Script contains no API keys, tokens, or passwords.

```javascript
// DANGEROUS - exposed credentials
const API_KEY = 'sk-1234567890abcdef';
const AUTH_TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIs...';

// SAFE - user provides credentials
const API_KEY = GM_getValue('apiKey', '');
if (!API_KEY) {
    alert('Please set your API key in the script settings');
}
```

### 2. @match Not Overly Broad

**Check:** Script doesn't run on all websites unnecessarily.

```javascript
// DANGEROUS - runs everywhere
// @match *://*/*
// @match https://*/*

// SAFE - specific targets
// @match https://example.com/*
// @match https://*.example.com/*
```

### 3. User Input Sanitised (verified 2026-08-25 — developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML#security_considerations, /Web/API/Element/insertAdjacentHTML#security_considerations, /Web/API/Node/textContent, cheatsheetseries.owasp.org/Cross_Site_Scripting_Prevention_Cheat_Sheet#safe-sinks, DOM_based_XSS_Prevention_Cheat_Sheet#rule-6)

**Check:** Sanitise user-provided data before DOM insertion — `innerHTML`/`insertAdjacentHTML`/`outerHTML`/`document.write`/`DOMParser.parseFromString` are XSS sinks; `textContent`/`insertAdjacentText` are safe. Generic XSS hygiene — see MDN Element/innerHTML security considerations and OWASP XSS Prevention Cheat Sheet; portable detail in [api-dom-ui.md](api-dom-ui.md).

### 4. HTTPS for External Requests (verified 2026-08-25 — cheatsheetseries.owasp.org/Cross_Site_Scripting_Prevention_Cheat_Sheet#xss-prevention-rules-summary allow-list https-only for untrusted URLs; MDN CSP/connect-src & mixed-content — http subresources blocked on https pages)

**Check:** All external URLs use HTTPS. **Universal MUST — applies in every manager.**

```javascript
// DANGEROUS - HTTP can be intercepted
// @connect http://api.example.com
GM_xmlhttpRequest({ url: 'http://api.example.com/data' });

// SAFE - HTTPS encrypted
// @connect api.example.com // TM-enforced; advisory elsewhere
GM_xmlhttpRequest({ url: 'https://api.example.com/data' });
```

The `// @connect` annotation above is **TM-enforced; advisory elsewhere** — see `@connect` Validation (enforced by Tampermonkey only).

### 5. No eval() or new Function()

**Check:** Avoid `eval`/`new Function`/string `setTimeout`/`setInterval` — code-injection risk; use callbacks. Generic JS hygiene — see MDN Trusted Types injection sinks and OWASP; portability note: page-context CSP may block `eval` while content world does not (see CSP & Trusted Types).

---

## Header Validation

### Required Headers

Declare minimal descriptive headers (`@name`, `@namespace`, `@version`, `@description`, `@author`, `@match`, `@grant`); starter templates in [header-reference.md](header-reference.md).

### Permission Minimisation (verified 2026-08-25 — tampermonkey.net/documentation.php?q=grant (@grant whitelists GM_*/GM.* and unsafeWindow; @grant none disables sandbox), violentmonkey.github.io/api/metadata-block/#grant and /api/gm/#unsafewindow (sandbox disabled only with @grant none since 2.32))

**Check:** Only necessary @grant statements are included. Least-privilege: grant only the APIs the script actually calls.

```javascript
// BAD - excessive permissions
// @grant GM_setValue
// @grant GM_getValue
// @grant GM_xmlhttpRequest
// @grant GM_notification
// @grant unsafeWindow
// @grant GM_cookie  // TM stable / Violentmonkey since 2.35.1 only — not portable to Greasemonkey 4+ / Safari

// GOOD - only what's needed
// @grant GM_addStyle
// (Script only modifies CSS)
```

Label `GM_cookie` / `GM.cookie` as **Tampermonkey stable / Violentmonkey since 2.35.1 only** — Greasemonkey 4+ and Safari have no cookie API (see [managers.md](managers.md) §2 Browser/OS integration).

### @connect Validation (enforced by Tampermonkey only) (verified 2026-08-25 — tampermonkey.net/documentation.php?q=connect (both initial and final URL checked; domain/subdomain/self/localhost/IP/*); violentmonkey.github.io/api/metadata-block — no @connect enforcement documented, GM_info.script.connect recorded only; greasespot wiki for Greasemonkey 4+ — directive ignored)

**Check:** All `@connect` domains are legitimate and expected. Enforcement is **Tampermonkey-only** — do NOT treat `@connect` as a security boundary outside Tampermonkey.

| Manager | Enforcement | Detail |
| --- | --- | --- |
| Tampermonkey | **Strict — prompt/block** | Unlisted hosts trigger user prompt or block; both initial and final URL after redirects are checked |
| Violentmonkey | Declared but **NOT enforced** | Value recorded but requests allowed even if host not listed |
| Greasemonkey 4+ | **Ignored** | Directive has no effect |
| Safari "Userscripts" | **n/a** | Not enforced |

> **Warning:** `@connect` is a Tampermonkey security boundary only. Outside Tampermonkey it is advisory/hygiene — it does **not** restrict requests. Always validate response and scope `@match` regardless of `@connect`.

```javascript
// Verify each domain is needed
// @connect api.example.com      ✓ Main API — TM-enforced; advisory elsewhere
// @connect cdn.example.com      ✓ CDN resources — TM-enforced; advisory elsewhere
// @connect tracking.ads.com     ✗ Why is this here?
```

See [http-requests.md](http-requests.md) for `@connect` syntax and subdomain-wildcard notes; [managers.md](managers.md) §2 Networking for enforcement source of truth.

### unsafeWindow Availability and Grant Matrix

Scattered `unsafeWindow` mentions are consolidated here — canonical matrix (source: [managers.md](managers.md) §2 DOM & UI, §4 Sandbox).

| Manager | `unsafeWindow` available? | Grant behaviour | Notes |
| --- | --- | --- | --- |
| Tampermonkey | ✅ | Needs explicit `// @grant unsafeWindow` **when any other `@grant` is present** | Check `GM_info.sandboxMode` |
| Violentmonkey | ✅ exposed without grant | Exposed even without grant; sandbox **off only with `// @grant none` (since Violentmonkey 2.32)** | `@inject-into auto/page/content` controls world |
| Greasemonkey 4+ | ✅ (`window.wrappedJSObject` equivalent) | Exposed; Firefox Xray | Use `cloneInto`/`exportFunction` to share |
| Safari "Userscripts" | ❌ **absent entirely** | Any `@grant` forces content world; no page-world access | Design without `unsafeWindow` on Safari |

**Recommendation — typeof-guard before use:**

```javascript
// Portable guard — do not assume unsafeWindow exists (Safari has none)
if (typeof unsafeWindow !== 'undefined' && unsafeWindow !== window) {
    // Safe to read page vars — still validate/sanitise any data you use
    const token = unsafeWindow.pageConfig?.token;
}

// Feature-detect handler if you need manager branching:
const handler = (typeof GM_info !== "undefined" ? GM_info : GM.info).scriptHandler;
// "Violentmonkey" | "Tampermonkey" | "Greasemonkey" | "Userscripts"
```

> **Prototype pollution & cloning (verified 2026-08-25 — developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Sharing_objects_with_page_scripts (wrappedJSObject: "you can no longer rely on any property being what you expect"); developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API#injection_sink_interfaces (Function/eval/AsyncFunction as TrustedScript sinks)):** Any object read via `wrappedJSObject`/`unsafeWindow` is **untrusted** — page code may have redefined prototypes/getters/setters and `Function` constructor / `eval` / `AsyncFunction` escape via `unsafeWindow.Function` if exposed. Validate and sanitize all data from `unsafeWindow`; never expose privileged `GM_*` functions directly via `exportFunction`/`cloneInto` without filtering. Prefer `CustomEvent`/`postMessage` bridge over direct unsafeWindow assignment — and when using `postMessage` always validate `event.origin`/`event.source` (verified 2026-08-25 — developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#security_concerns: "always verify the sender's identity using the origin… Failure to check enables cross-site scripting attacks" and "Always specify an exact targetOrigin, not *"); when you must share, use `cloneInto(obj, window, { cloneFunctions: true })` and `exportFunction` narrowly.

---

## Code Quality Checks

### 1. IIFE Wrapper — Recommended

**Check:** Script is wrapped to prevent global pollution. **Recommended** (not REQUIRED) — managers sandbox scripts; leak risk is mainly under `// @grant none` page-context (Violentmonkey since 2.32, Tampermonkey no-grant vs `none` difference).

```javascript
// Recommended — especially important under @grant none (page context)
(function() {
    'use strict';
    // Script code here
})();
```

Rationale: with a grant sandbox most leaks are contained, but `// @grant none` runs in page context where globals pollute the page and collide with other scripts. Keep the IIFE as hygiene.

### 2. Error Handling

**Check:** Handle async errors (`onload`/`onerror`/`ontimeout`, `try/catch` around `JSON.parse`). Generic hygiene — see MDN `Promise`/`XMLHttpRequest`.

> Core `GM_xmlhttpRequest` is cross-manager; `cookie` / `anonymous` / `fetch` / `stream` options are **Tampermonkey-only** (Violentmonkey supports `anonymous` since 2.10.1 but not the rest — see [http-requests.md](http-requests.md) and [managers.md](managers.md)).

### 3. Null Checks

**Check:** Guard `querySelector` results (`if (el)` / `?.`). Generic DOM hygiene — see MDN `Element`/`Node`; no manager variance.

---

## Performance Checks

Generic performance hygiene (bounded loops, observer cleanup, debouncing/throttling) — no manager variance. See MDN `MutationObserver`/`setTimeout` and [patterns.md](patterns.md); compressed for portability focus.

---

## Pre-Delivery Checklist

Before returning a userscript, verify:

### Critical (Must Pass)

- [ ] No hardcoded API keys, tokens, or passwords
- [ ] @match is specific (not `*://*/*`)
- [ ] All external URLs use HTTPS
- [ ] User input is sanitised before DOM insertion
- [ ] No eval() or string-based setTimeout/setInterval

### Important (Should Pass)

- [ ] Wrapped in IIFE with 'use strict' — **Recommended** (see rationale above; critical only under `@grant none`)
- [ ] All @grant statements are necessary
- [ ] @connect includes all external domains (required for Tampermonkey; advisory elsewhere)
- [ ] Error handling for async operations
- [ ] Null checks before DOM manipulation

### Recommended (Nice to Have)

- [ ] @version follows semantic versioning
- [ ] MutationObservers are cleaned up
- [ ] Frequent operations are debounced
- [ ] Comments explain non-obvious code
- [ ] Tested in target managers (Violentmonkey / Tampermonkey / Greasemonkey / Safari Userscripts)

---

## Security Red Flags

Immediately question scripts that:

| Red Flag | Concern |
|----------|---------|
| `@match *://*/*` | Why does it need to run everywhere? |
| `@grant unsafeWindow` | Does it really need page context? **Check matrix above** — Tampermonkey needs explicit grant, Violentmonkey exposed without grant (sandbox off only with `@grant none` since 2.32), Greasemonkey exposed, **Safari absent entirely** — guard with `typeof unsafeWindow !== 'undefined'` |
| `eval()` or `new Function()` | Code injection risk |
| Hardcoded URLs to unknown domains | Data exfiltration? |
| `@connect *` without explanation | Where is data going? **TM-enforced meaning: allow any host (prompts user) — inert elsewhere** |
| Minified/obfuscated code | What is it hiding? |
| Requests to IP addresses | Suspicious destination |
| localStorage/cookie access without clear purpose | Data harvesting? |

---

## Safe Patterns

### Safe Data Storage

```javascript
// Use GM storage, not localStorage
GM_setValue('userPrefs', { theme: 'dark' });
const prefs = GM_getValue('userPrefs', {});
```

> **Storage nuance (verified 2026-08-25 — violentmonkey.github.io/api/gm/#gm_getvalue / #gm_setvalue (per-script GM storage); MDN browser.storage / WebExtensions storage is unencrypted at rest):** `GM storage` isolates per-script (unlike page `localStorage`) but is still **plaintext in extension storage — not encrypted**. Do not store secrets at rest without user awareness; prompt via `GM_registerMenuCommand` or `GM_getValue('apiKey','')` and avoid logging secrets. Prefer user-provided credentials over bundling.

### Safe External Requests

```javascript
// Validate response before use
GM_xmlhttpRequest({
    url: 'https://api.example.com/data',
    onload: (r) => {
        if (r.status !== 200) {
            console.error('Unexpected status:', r.status);
            return;
        }

        let data;
        try {
            data = JSON.parse(r.responseText);
        } catch (e) {
            console.error('Invalid JSON');
            return;
        }

        if (!data.expected_field) {
            console.error('Missing expected field');
            return;
        }

        process(data);
    }
});
```

> Core `GM_xmlhttpRequest` is cross-manager; `cookie` / `anonymous` / `fetch` / `stream` options are **Tampermonkey-only**.

> **Exfiltration & CSRF hardening (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_xmlhttpRequest (anonymous/cookie/fetch/stream; @connect checks both initial and final URL), violentmonkey.github.io/api/gm/#gm_xmlhttprequest (anonymous since 2.10.1)):** `GM_xmlhttpRequest` bypasses CORS and — unless `anonymous: true` — sends page cookies. Use `anonymous: true` when cookies are not needed. After redirects, validate `r.finalUrl` (both initial and final URL are `@connect`-checked in TM) and inspect `r.responseHeaders` content-type before `JSON.parse`. Example: `GM_xmlhttpRequest({ url: 'https://api.example.com/data', anonymous: true, onload: r => { if (!r.responseHeaders.includes('application/json')) return; /* … */ } })`.

### Safe DOM Insertion

For plain text use `textContent`/`createElement` (safe); for rich HTML sanitize before `innerHTML`/`insertAdjacentHTML` — see [api-dom-ui.md](api-dom-ui.md).

> **Executable sink warning (verified 2026-08-25 — developer.mozilla.org/en-US/docs/Web/API/HTMLScriptElement/textContent#security_considerations, /Web/API/HTMLScriptElement/text, /Web/API/Trusted_Types_API#injection_sink_interfaces (TrustedScript sinks: HTMLScriptElement.text/textContent/innerText, eval, Function, setTimeout string)):** `HTMLScriptElement.textContent`/`text`/`innerText` is a script sink — assigning untrusted code and inserting executes. Never inject untrusted strings via script elements; use `TrustedScript` or avoid creation.

> **Other HTML sinks (verified 2026-08-25 — developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML#security_considerations, /Element/outerHTML, /Element/insertAdjacentHTML#security_considerations, /Document/write, /DOMParser/parseFromString; cheatsheetseries.owasp.org — DOM_based_XSS_Prevention_Cheat_Sheet#example-dangerous-html-methods (innerHTML/outerHTML/document.write/writeln)):** `outerHTML`/`insertAdjacentHTML`/`document.write`/`DOMParser.parseFromString` are HTML sinks (TrustedHTML) — same sanitizing discipline as `innerHTML`.

> **Rich HTML — use a sanitizer (verified 2026-08-25 — developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API#concepts_and_usage, /Web/API/Element/innerHTML#examples (policy.createHTML => DOMPurify.sanitize); cheatsheetseries.owasp.org/Cross_Site_Scripting_Prevention_Cheat_Sheet#html-sanitization (OWASP recommends DOMPurify)):** For rich HTML sanitize via `DOMPurify`/`Trusted Types`: `elem.innerHTML = DOMPurify.sanitize(untrustedHtml)` or `policy.createHTML` → `DOMPurify.sanitize`.

### CSP & Trusted Types Interaction (verified 2026-08-25 — developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API, /Web/HTTP/Reference/Headers/Content-Security-Policy/require-trusted-types-for, violentmonkey.github.io/posts/inject-into-context (content isolated world not subject to page CSP; page context blocked), tampermonkey.net/documentation.php?q=GM_addElement (bypasses CSP when page restricts script/style))

Userscript managers do **not** universally bypass page CSP. Enforcement is context-sensitive:

| Context | CSP effect | Guidance |
| --- | --- | --- |
| Violentmonkey **content** world (`@inject-into content` or `auto` fallback) | **Isolated world — NOT subject to page CSP** | Safe default on CSP-restricted sites (e.g., GitHub) |
| Violentmonkey/Tampermonkey **page** context (`@grant none` or `@inject-into page`) | **Subject to page CSP** — inline scripts/styles blocked on strict sites | Use `GM_addElement` to inject `script`/`style`/`link` bypassing CSP (TM docs: "if the page limits these elements with CSP"; VM `GM_addElement` same), or a `Trusted Types` + `DOMPurify` helper |
| Tampermonkey "Modify CSP" option | Can relax CSP but TM docs flag it "possibly unsecure" — prefer `GM_addElement` |
| Safari "Userscripts" | **Cannot bypass CSP** | Design without page-world access |

> **Trusted Types breakage (verified 2026-08-25 — developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API#using_a_csp_to_enforce_trusted_types (TypeError on string assignment when require-trusted-types-for enforced), /Web/HTTP/Reference/Headers/Content-Security-Policy/require-trusted-types-for, /Web/API/Element/innerHTML#exceptions; violentmonkey/violentmonkey#1873, tampermonkey#1334 where jQuery html() broke; fix via trustedTypes.createPolicy + DOMPurify or GM_addElement):** Strict sites that enforce `require-trusted-types-for 'script'` throw `TypeError` on plain-string assignments to sinks (`innerHTML`, `outerHTML`, `script.text`, `eval`, etc.). Fix: reuse the page's policy or create one via `trustedTypes.createPolicy` with `DOMPurify`, or use `GM_addElement` for `script`/`style` injection.

---

## Supply Chain & External Code

Every `@require` / `@resource` is code you ship but do not host — treat it as supply chain.

### Pin with SRI

- SRI hash format (`#sha256=…` / `#md5=…`, hex/base64, multiple hashes comma/semicolon-separated) — details in [header-reference.md](header-reference.md) and tampermonkey.net documentation.php?q=sri.
- **Scope — Tampermonkey only (verified 2026-08-25 — tampermonkey.net/documentation.php?q=sri (SHA-256/MD5 natively; SHA-384/512 require window.crypto; hash mismatch handling); violentmonkey.github.io/api/metadata-block — no SRI enforcement documented):** SRI hash suffixes are **enforced only by Tampermonkey**. Violentmonkey, Greasemonkey 4+, and Safari "Userscripts" silently **ignore** `#sha256=…`/`#md5=…` and always re-fetch on update. Pinning therefore protects only Tampermonkey users; others need vendor-or-audit mitigations. TM setting: Security → Subresource Integrity: *Validate if possible* / *Enforce*.
- **Version-pin URLs (verified 2026-08-25 — tampermonkey.net/documentation.php?q=sri; Greasy Fork external-scripts rules; greasyfork/JasonBarnabe-greasyfork#1070 mismatch monitoring):** Use fully versioned CDN URLs (`https://cdn.example.com/lib-3.6.0.min.js#sha256=…`) — never `latest`/`jquery-latest.min.js`. A floating URL can drift to new (potentially compromised) code between bumps; Greasy Fork warns against unpinned externals.
- Minimize externals; re-audit every `@require`/`@resource` URL on each bump (managers re-fetch on update). Vendor small deps or use Greasy Fork-hosted libs syncable from GitHub — see [publishing.md](publishing.md) (verified 2026-08-25 — tampermonkey.net/documentation.php?q=sri; greasyfork/JasonBarnabe-greasyfork#1070).

### Catalog context

Catalog rules are workflow trivia — see [publishing.md](publishing.md): Greasy Fork allows arbitrary `@require` with SRI or allowlisted CDN/GF-hosted libs (monitored, see JasonBarnabe/greasyfork#1070); OpenUserJS requires OSI-approved `@license`.

### Incident-derived rules

Supply-chain incidents (Feb 2025 WME account takeover → card-skimming; 2019 GF library compromise via password reuse) illustrate why to pin with SRI, audit sources, and enable 2FA — see greasyfork.org/openuserjs.org; generic OWASP supply-chain guidance applies.

---

## See Also

- [managers.md](managers.md) — normative Support Matrix and enforcement
- [http-requests.md](http-requests.md) — `@connect` syntax, option matrix, `GM_xmlhttpRequest` detail
- [api-dom-ui.md](api-dom-ui.md) — `unsafeWindow` bridges and CSP handling
- [header-reference.md](header-reference.md) — SRI hash format, `@require` / `@resource`
- [publishing.md](publishing.md) — catalog publish & update rules

