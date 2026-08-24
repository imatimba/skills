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

### 3. User Input Sanitised

**Check:** User-provided data is sanitised before DOM insertion.

```javascript
// DANGEROUS - XSS vulnerability
const userInput = prompt('Enter name:');
element.innerHTML = `Hello, ${userInput}!`;  // Can inject HTML/JS

// SAFE - use textContent
element.textContent = `Hello, ${userInput}!`;

// SAFE - escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
element.innerHTML = `Hello, ${escapeHtml(userInput)}!`;
```

### 4. HTTPS for External Requests

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

**Check:** Script doesn't execute arbitrary code.

```javascript
// DANGEROUS - code injection risk
eval(userInput);
new Function(userInput)();
setTimeout(userInput, 1000);  // If userInput is a string

// SAFE - use proper callbacks
setTimeout(() => doSomething(), 1000);
```

---

## Header Validation

### Required Headers

```javascript
// ==UserScript==
// @name         ✓ Descriptive and unique
// @namespace    ✓ Your unique identifier
// @version      ✓ Semantic version (1.0.0)
// @description  ✓ Clear description
// @author       ✓ Your name
// @match        ✓ Specific URL patterns
// @grant        ✓ Only needed permissions
// ==/UserScript==
```

### Permission Minimisation

**Check:** Only necessary @grant statements are included.

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

### @connect Validation (enforced by Tampermonkey only)

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

> **Prototype pollution & cloning (verified 2026-08-24, MDN):** Any object read via `wrappedJSObject`/`unsafeWindow` is **untrusted** — page code may have redefined prototypes/getters/setters (MDN: "once you use wrappedJSObject, you can no longer rely on any property being what you expect"). Validate and sanitize all data from `unsafeWindow`; never expose privileged `GM_*` functions directly via `exportFunction`/`cloneInto` without filtering. Prefer `CustomEvent`/`postMessage` bridge over direct unsafeWindow assignment; when you must share, use `cloneInto(obj, window, { cloneFunctions: true })` and `exportFunction` narrowly. Source: developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Sharing_objects_with_page_scripts.

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

**Check:** Async operations have error handlers.

```javascript
// BAD - no error handling
GM_xmlhttpRequest({
    url: 'https://api.example.com/data',
    onload: (r) => process(JSON.parse(r.responseText))
});

// GOOD - comprehensive error handling
GM_xmlhttpRequest({
    url: 'https://api.example.com/data',
    onload: (r) => {
        try {
            const data = JSON.parse(r.responseText);
            process(data);
        } catch (e) {
            console.error('Parse error:', e);
        }
    },
    onerror: (e) => console.error('Request failed:', e),
    ontimeout: () => console.error('Request timed out')
});
```

> Core `GM_xmlhttpRequest` is cross-manager; `cookie` / `anonymous` / `fetch` / `stream` options are **Tampermonkey-only** (Violentmonkey supports `anonymous` since 2.10.1 but not the rest — see [http-requests.md](http-requests.md) and [managers.md](managers.md)).

### 3. Null Checks

**Check:** DOM queries check for null before use.

```javascript
// BAD - crashes if element missing
document.querySelector('#target').click();

// GOOD - safe access
const el = document.querySelector('#target');
if (el) {
    el.click();
}

// BETTER - optional chaining
document.querySelector('#target')?.click();
```

---

## Performance Checks

### 1. No Infinite Loops

**Check:** Loops have proper exit conditions.

```javascript
// DANGEROUS - potential infinite loop
while (true) {
    if (condition) break;
}

// SAFE - bounded iterations
for (let i = 0; i < 1000; i++) {
    if (condition) break;
}
```

### 2. Observer Cleanup

**Check:** MutationObservers are disconnected when done.

```javascript
// BAD - runs forever
const observer = new MutationObserver(callback);
observer.observe(document.body, { childList: true, subtree: true });

// GOOD - disconnects when appropriate
const observer = new MutationObserver((mutations, obs) => {
    if (foundTarget) {
        obs.disconnect();
    }
});
```

### 3. Debounced Operations

**Check:** Frequent operations are throttled.

```javascript
// BAD - runs on every mutation
observer.observe(document.body, { childList: true, subtree: true });

// GOOD - debounced
let timeout;
const observer = new MutationObserver(() => {
    clearTimeout(timeout);
    timeout = setTimeout(processChanges, 100);
});
```

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

> **Storage nuance (verified 2026-08-24):** `GM storage` isolates per-script (unlike page `localStorage`) but is still **plaintext in extension storage — not encrypted**. Do not store secrets at rest without user awareness; prompt via `GM_registerMenuCommand` or `GM_getValue('apiKey','')` and avoid logging secrets. Prefer user-provided credentials over bundling. Sources: violentmonkey.github.io/api/gm/#GM_getValue; MDN `browser.storage` / WebExtensions storage is unencrypted at rest.

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

> **Exfiltration & CSRF hardening (verified 2026-08-24, tampermonkey.net):** `GM_xmlhttpRequest` bypasses CORS and — unless `anonymous: true` — sends page cookies. Use `anonymous: true` when cookies are not needed (Violentmonkey supports `anonymous` since 2.10.1; TM supports all four). After redirects, validate `r.finalUrl` (both initial and final URL are `@connect`-checked in TM) and inspect `r.responseHeaders` content-type before `JSON.parse`. Example: `GM_xmlhttpRequest({ url: 'https://api.example.com/data', anonymous: true, onload: r => { if (!r.responseHeaders.includes('application/json')) return; /* … */ } })`.

### Safe DOM Insertion

```javascript
// Create elements programmatically
const div = document.createElement('div');
div.textContent = userInput;  // Safe - no HTML parsing
div.className = 'my-class';
document.body.appendChild(div);
```

> **Executable sink warning (verified 2026-08-24, MDN):** `element.textContent` is safe on normal elements, but `HTMLScriptElement.textContent` / `text` / `innerText` IS a JavaScript sink — assigning untrusted code to `scriptElement.textContent` and inserting it will execute (`scriptElement.textContent = untrustedCode // shows the alert`). Never inject untrusted strings via script elements; use `TrustedScript` via a `Trusted Types` policy or avoid creating the element. Source: developer.mozilla.org/en-US/docs/Web/API/HTMLScriptElement/textContent.

> **Other HTML sinks (verified 2026-08-24, MDN + OWASP):** `outerHTML`, `insertAdjacentHTML`, `document.write`/`writeln`, and `DOMParser.parseFromString` are equally dangerous HTML sinks alongside `innerHTML` (OWASP DOM XSS Prevention lists them as "Example Dangerous HTML Methods"). Apply the same escaping/sanitizing discipline to all. Sources: developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML, /Element/outerHTML, /Element/insertAdjacentHTML, /Document/write, /DOMParser/parseFromString; cheatsheetseries.owasp.org — DOM_based_XSS_Prevention_Cheat_Sheet.

> **Rich HTML — use a sanitizer (verified 2026-08-24, MDN):** When you must insert HTML (not just text), sanitize via a vetted library. MDN Trusted Types examples use `DOMPurify.sanitize(input)` to create `TrustedHTML` before `innerHTML`/`insertAdjacentHTML`. Pattern: `elem.innerHTML = DOMPurify.sanitize(untrustedHtml)` or via a `Trusted Types` policy `policy.createHTML(input) => DOMPurify.sanitize(input)`. `escapeHtml` (div.textContent → div.innerHTML) is correct for plain text but insufficient for rich HTML.

### CSP & Trusted Types Interaction (verified 2026-08-24)

Userscript managers do **not** universally bypass page CSP. Enforcement is context-sensitive:

| Context | CSP effect | Guidance |
| --- | --- | --- |
| Violentmonkey **content** world (`@inject-into content` or `auto` fallback) | **Isolated world — NOT subject to page CSP** | Safe default on CSP-restricted sites (e.g., GitHub) |
| Violentmonkey/Tampermonkey **page** context (`@grant none` or `@inject-into page`) | **Subject to page CSP** — inline scripts/styles blocked on strict sites | Use `GM_addElement` to inject `script`/`style`/`link` bypassing CSP (TM docs: "if the page limits these elements with CSP"; VM `GM_addElement` same), or a `Trusted Types` + `DOMPurify` helper |
| Tampermonkey "Modify CSP" option | Can relax CSP but TM docs flag it "possibly unsecure" — prefer `GM_addElement` |
| Safari "Userscripts" | **Cannot bypass CSP** | Design without page-world access |

> **Trusted Types breakage (verified 2026-08-24):** Strict sites that enforce `require-trusted-types-for 'script'` throw `TypeError` on plain-string assignments to sinks (`innerHTML`, `outerHTML`, `script.text`, `eval`, etc.). Symptom: `TrustedHTML`/`TrustedScript` required (see violentmonkey/violentmonkey#1873, tampermonkey#1334 where jQuery `html()` broke under Trusted Types). Fix: reuse the page's policy or create one via `trustedTypes.createPolicy` with `DOMPurify`, or use `GM_addElement` for `script`/`style` injection. Sources: developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API, /Web/HTTP/Headers/Content-Security-Policy, violentmonkey.github.io/posts/inject-into-context/, tampermonkey.net/documentation.php?q=GM_addElement.

---

## Supply Chain & External Code

Every `@require` / `@resource` is code you ship but do not host — treat it as supply chain.

### Pin with SRI

- Pin **every** `@require` / `@resource` with an SRI hash suffix: `#sha256=...` (minimum; SHA-256/SHA-384/SHA-512 per W3C SRI). `#md5=...` is cryptographically broken — legacy/migration-only, supported by Tampermonkey for backward compat only. Example: `// @require https://cdn.example.com/lib.js#sha256=abc123...`
- Tampermonkey verifies **SHA-256** and **MD5** natively; **SHA-1 / SHA-384 / SHA-512** require `window.crypto` at install time.
- Multiple hashes: comma- or semicolon-separated, last supported wins (`#md5=...,sha256=...` → `sha256` used). Hex **or** base64 encoding accepted. Source: tampermonkey.net documentation.php?q=sri.
- **Scope — Tampermonkey only (verified 2026-08-24):** SRI hash suffixes are **enforced only by Tampermonkey**. Violentmonkey, Greasemonkey 4+, and Safari "Userscripts" silently **ignore** `#sha256=…`/`#md5=…` and always re-fetch on update. Pinning therefore protects only Tampermonkey users; others need vendor-or-audit mitigations. TM setting: Security → Subresource Integrity: *Validate if possible* / *Enforce*. Source: tampermonkey.net/documentation.php?q=sri; Violentmonkey metadata-block/API — no SRI enforcement documented.
- **Version-pin URLs (verified 2026-08-24):** Use fully versioned CDN URLs (`https://cdn.example.com/lib-3.6.0.min.js#sha256=…`) — never `latest`/`jquery-latest.min.js`. A floating URL can drift to new (potentially compromised) code between bumps; Greasy Fork warns against unpinned externals. See issue greasyfork/JasonBarnabe-greasyfork#1070 for mismatch monitoring context.
- Prefer fewer externals. Review every external URL **before every version bump** — managers silently re-fetch `@require` / `@resource` on update. Greasy Fork now monitors SRI mismatches for hosted scripts; Tampermonkey logs "Hash mismatch for @require" on failure — check install logs after bumping. Vendor small dependencies or prefer Greasy Fork-hosted libraries syncable from GitHub for an audit trail (verified 2026-08-24).

### Catalog context

- **Greasy Fork:** arbitrary `@require` URLs are allowed **with** a valid SRI hash and are monitored for mismatches; CDN allowlist and GF-hosted libraries (syncable from GitHub) are the other allowlisted paths. See Greasy Fork external-scripts rules. Verify: greasyfork.org — github.com/JasonBarnabe/greasyfork issue 1070 for mismatch monitoring.
- **OpenUserJS:** requires an OSI-approved `@license` and safe-harbors reviewed code (reviewed scripts marked as such on the catalog).

### Incident-derived rules

- **Feb 2025 — compromised author account:** popular WME scripts injected card-skimming after account takeover → treat account security (2FA) as part of supply chain; enable 2FA on Greasy Fork / OpenUserJS / GitHub and use strong, unique passwords.
- **2019 — Greasy Fork shared library compromised:** password reuse let an attacker harvest wallet keys from a popular library → never trust a library because it is popular; pin with SRI, audit the source, and prefer well-maintained, narrow-scoped dependencies.

Verify: greasyfork.org · openuserjs.org · tampermonkey.net

---

## See Also

- [managers.md](managers.md) — normative Support Matrix and enforcement
- [http-requests.md](http-requests.md) — `@connect` syntax, option matrix, `GM_xmlhttpRequest` detail
- [api-dom-ui.md](api-dom-ui.md) — `unsafeWindow` bridges and CSP handling
- [header-reference.md](header-reference.md) — SRI hash format, `@require` / `@resource`
- [publishing.md](publishing.md) — catalog publish & update rules

