# Common Userscript Pitfalls

Mistakes that break **portable** userscripts and how to avoid them. Scope: portable across TM / VM / GM4+ / Safari Userscripts (tier-2 secondary — see `manager-compat.md`). Manager facts per `managers.md`; anything not confirmed there is UNVERIFIED.

Manager literals for `GM_info.scriptHandler`: `"Tampermonkey"` | `"Violentmonkey"` | `"Greasemonkey"` | `"Userscripts"` (Safari app). Prefer capability checks over handler branching. Manager-specific notes use `> **Manager-specific note:** …` where needed.

> **Pruned generics:** `@match` scope hygiene, observer lifecycle/debouncing, and selector robustness are generic DOM/MDN concerns — see `header-reference.md` (`@match`), `url-matching.md`, and [MDN MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver). Workflow install/test steps are authoritative in `managers.md` §6 and `testing.md`. This file keeps only pitfalls that change what you write for a portable script or how it degrades where a feature is absent.

---

## Pitfall 2: Missing @connect

Cross-origin requests fail silently or show permission dialogs without `@connect` — but enforcement is **manager-specific**.

**Wrong:**
```javascript
// @grant GM_xmlhttpRequest
// No @connect declaration

GM_xmlhttpRequest({
    url: 'https://api.example.com/data',  // Will prompt or fail in TM
    ...
});
```

**Right:**
```javascript
// @grant GM_xmlhttpRequest
// @connect api.example.com
// @connect cdn.example.com

GM_xmlhttpRequest({
    url: 'https://api.example.com/data',
    ...
});
```

| Manager | `@connect` enforcement | Effect of missing entry |
|---------|------------------------|-------------------------|
| TM | **Strict** — unlisted hosts prompt/block (initial + final URL) | Blocked or permission prompt |
| VM | Declared but **NOT enforced** — requests allowed anyway | Allowed (declaration advisory) |
| GM4+ | Ignored / not used | Allowed |
| Safari Userscripts | n/a | Allowed (promise subset) |

**Best practice:** Enumerate known domains for TM compatibility (`// @connect api.example.com` per host). `@connect *` as a fallback is a TM-model concept — it satisfies TM's strict check but is elsewhere advisory; prefer explicit domains and add `*` only when you truly need wildcard. Diagnostic checklist labels this as `[@connect — TM-required]` (see Quick Diagnostic Checklist). (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?locale=en&q=connect — TM checks initial + final URL and supports `*`; https://violentmonkey.github.io/api/metadata-block/ omits @connect confirming VM does not enforce)

---

## Pitfall 3: Not Waiting for Elements

Elements may not exist when your script runs, especially on SPAs or at `document-start`.

**Wrong:**
```javascript
// @run-at document-end

// Element might not exist yet!
document.querySelector('#dynamic-content').textContent = 'Modified';
// TypeError: Cannot read property 'textContent' of null
```

**Right:**
```javascript
// Use waitForElement pattern — guard document.body (null at document-start)
async function init() {
    const element = await waitForElement('#dynamic-content');
    element.textContent = 'Modified';
}

function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);

        const observer = new MutationObserver((_, obs) => {
            const el = document.querySelector(selector);
            if (el) {
                obs.disconnect();
                resolve(el);
            }
        });

        // document.body is null at document-start — fall back to documentElement
        observer.observe(document.body ?? document.documentElement, { childList: true, subtree: true });
        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timeout: ${selector}`));
        }, timeout);
    });
}

init().catch(e => console.error('init failed:', e));

// Portable SPA navigation: no universal window.onurlchange (TM-only). For SPAs,
// patch history + listen popstate/hashchange, or VM.onNavigate from @violentmonkey/url.
// See browser-compatibility.md and managers.md for fallback snippet.
```

Additional guards: (verified 2026-08-25 — https://violentmonkey.github.io/api/metadata-block/#run-at `document-start` body may be null; https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver; https://www.tampermonkey.net/documentation.php?locale=en&q=window#api:window.onurlchange — TM-only)

| Concern | Fix |
|---------|-----|
| `document.body` null at `document-start` | `observer.observe(document.body ?? document.documentElement, …)` |
| Unhandled async failure | `init().catch(e => …)` — don't drop the rejection |
| SPA navigation (no universal `onurlchange`) | History patch (`pushState`/`replaceState` + `popstate`/`hashchange`) or `VM.onNavigate`; `window.onurlchange` is TM-only |

> **Navigation API (modern alternative, as of 2026-08-25):** Chromium 102+ (Chrome/Edge) implements `window.navigation` with `navigate` / `navigatesuccess` / `navigateerror` events as a structured replacement for the history patch (verified 2026-08-25 — MDN Navigation API https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API — `Navigation.navigate()`, `NavigationTransition`). Firefox and Safari do not yet implement it (as of 2026-08-25), so feature-detect before using: `if (window.navigation) navigation.addEventListener('navigatesuccess', handler); else /* history patch fallback */`.

---

## Pitfall 4: Blocking Async Operations

`GM_xmlhttpRequest` is asynchronous — you can't use its return value directly. Which variant exists is **manager-specific**.

**Wrong:**
```javascript
const response = GM_xmlhttpRequest({
    method: 'GET',
    url: 'https://api.example.com/data'
});
console.log(response.responseText);  // undefined! (and GM4+/Safari have no callback form)
```

**Right (callback):**
```javascript
GM_xmlhttpRequest({
    method: 'GET',
    url: 'https://api.example.com/data',
    onload: function(response) {
        console.log(response.responseText);  // Works in TM/VM only
    }
});
```

**Right (async/await with GM.*):**
```javascript
const response = await GM.xmlHttpRequest({
    method: 'GET',
    url: 'https://api.example.com/data'
});
console.log(response.responseText);  // Works where promise form exists
```

| Form | TM | VM | GM4+ | Safari Userscripts | Notes |
|------|----|----|------|-------------------|-------|
| `GM_xmlhttpRequest` (callback) | ✅ returns `{abort}` | ✅ returns control | ❌ | ❌ (promise-only) | GM4+/Safari have no callback form |
| `GM.xmlHttpRequest` (promise) | ✅ (capital H) | ✅ since 2.18.3 | ✅ | ✅ custom promise + `abort` | Shapes differ — feature-detect; Safari promise-only |

**Portable wrapper — feature-detect before calling:** (verified 2026-08-25 — https://violentmonkey.github.io/api/gm/#gm_xmlhttprequest — VM GM.* async since 2.18.3; https://wiki.greasespot.net/GM.xmlHttpRequest — GM4+ promise form; https://www.tampermonkey.net/documentation.php?locale=en&q=GM_xmlhttpRequest)

```javascript
// Prefer promise form where available; fall back to callback form
const req = typeof GM !== 'undefined' && GM.xmlHttpRequest ? GM.xmlHttpRequest : GM_xmlhttpRequest;

// Usage: if promise form exists, await it; else wrap callback in promise
async function fetchText(url) {
    if (typeof GM !== 'undefined' && GM.xmlHttpRequest) {
        const r = await GM.xmlHttpRequest({ method: 'GET', url });
        return r.responseText;
    }
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'GET', url,
            onload: r => resolve(r.responseText),
            onerror: reject,
            ontimeout: () => reject(new Error('timeout'))
        });
    });
}
```

---

## Pitfall 5: CSP Blocking Script Injection

Content Security Policy blocks dynamically created scripts — but whether `GM_addElement` helps depends on **manager**, not just browser.

**Wrong:**
```javascript
const script = document.createElement('script');
script.textContent = 'console.log("blocked by CSP")';
document.head.appendChild(script);  // Blocked on strict-CSP pages!
```

**Right:**
```javascript
// @grant GM_addElement

GM_addElement('script', {
    textContent: 'console.log("bypasses CSP where supported")'
});
```

| Manager | CSP handling | What `GM_addElement` does | How to verify |
|---------|--------------|---------------------------|---------------|
| TM | May strip/relax CSP headers in some modes — **do NOT rely on it** | Bypasses in best-effort modes | Test in VM to surface the real CSP |
| VM | **Respects page CSP** — no header stripping; `@inject-into auto` falls back to content-world if page-world injection fails (auto-mode behavior, not `GM_addElement` itself) | Respects CSP; graceful fallback | **Test in VM** — if it works there, it will work in TM; the reverse is not true |
| GM4+ | Subject to Firefox sandbox; `GM_addElement` ❌ (issue #2484) | No `GM_addElement` — use `@require` or Xray bridges | Verify in GM4+ console |
| Safari Userscripts | Content world only; `GM_addElement` ❌ | No bypass possible | Design without page-world access |

**Best practice:** Test CSP-sensitive injection in Violentmonkey first — TM may hide the CSP failure by stripping headers. If VM works, you have a truly portable solution. (verified 2026-08-25 — https://violentmonkey.github.io/api/gm/#gm_addelement — GM_addElement purpose is circumventing strict CSP)

> **Style CSP also blocks styles (verified 2026-08-25 — MDN CSP https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src and VM GM_addElement https://violentmonkey.github.io/api/gm/#gm_addelement — "circumventing a strict Content-Security-Policy that forbids adding inline code *or style*"):** `style-src` (and `default-src` fallback) blocks inline `<style>` just as `script-src` blocks `<script>` — use `GM_addElement('style', { textContent: '...' })` where supported (TM/VM); elsewhere use `@require` + linked stylesheet or avoid inline style.

---

## Pitfall 6: Sandbox Context Confusion

Whether `unsafeWindow` exists and whether `@grant none` helps depends on **manager** — it is NOT universal.

**Wrong:**
```javascript
// @grant none

// Trying to access page's React app
console.log(window.React);  // undefined in sandbox (and GM_* lost!)
```

**Right:**
```javascript
// @grant unsafeWindow

if (typeof unsafeWindow !== 'undefined') {
    console.log(unsafeWindow.React);  // Works in TM/VM/GM4+ only
} else {
    console.warn('unsafeWindow absent — Safari or no grant model; design without page-world access');
}
```

| Manager | `unsafeWindow` without grants | `unsafeWindow` with other `@grant`s | `@grant none` effect | Safari note |
|---------|-------------------------------|--------------------------------------|----------------------|-------------|
| TM | Not exposed | ✅ needs explicit `@grant unsafeWindow` when other grants exist | Disables sandbox **and loses all `GM_*`/`GM.*` APIs** | — |
| VM ≥2.32 | ✅ exposed (`GM_info` + `unsafeWindow`) | ✅ exposed | Full page context; no sandbox | — |
| VM <2.32 / GM4+ | ✅ | ✅ (`wrappedJSObject` equiv. on Firefox) | Full page context | — |
| Safari Userscripts | ❌ NONE | ❌ NONE | Still ❌ — any `@grant` ⇒ forced content world; `none` does not conjure `unsafeWindow` | Never available — branch around it |

**Fix the incompleteness:** `@grant none` does not just "disable the sandbox entirely" — it disables the sandbox **and removes all `GM_*`/`GM.*` APIs** (you lose storage, XHR, etc.) — but `GM_info` / `GM.info` remains available (verified 2026-08-25 — TM grant docs: "In this mode no GM* function but the GM_info property will be available" — https://www.tampermonkey.net/documentation.php?locale=en&q=grant; VM grant https://violentmonkey.github.io/api/metadata-block/#grant). In Safari, it still does not provide `unsafeWindow` (always ❌). Always guard:

```javascript
if (typeof unsafeWindow !== 'undefined') {
    // page-world access
} else {
    // Safari / content-world fallback: work with DOM only, or GM_addElement bridge where supported
}
```

Safari design note: any `@grant` forces content-world execution; there is no page-world access to design around — build features that work from the isolated DOM.

---

## Pitfall 9: Forgetting Error Handling

Network requests and async operations can fail — handle **both** callback errors and promise rejections. (verified 2026-08-25 — https://wiki.greasespot.net/GM.xmlHttpRequest — onerror/ontimeout/timeout fields; https://violentmonkey.github.io/api/gm/#gm_xmlhttprequest)

**Wrong:**
```javascript
GM_xmlhttpRequest({
    url: 'https://api.example.com/data',
    onload: (r) => {
        const data = JSON.parse(r.responseText);  // Crashes if invalid JSON
        process(data);
    }
});
```

**Right (callback — onerror/ontimeout):**
```javascript
GM_xmlhttpRequest({
    url: 'https://api.example.com/data',
    onload: (r) => {
        try {
            const data = JSON.parse(r.responseText);
            process(data);
        } catch (e) {
            console.error('Failed to parse response:', e);
        }
    },
    onerror: (e) => {
        console.error('Request failed:', e);
    },
    ontimeout: () => {
        console.error('Request timed out');
    }
});
```

**Right (promise — try/catch):**
```javascript
try {
    const r = await GM.xmlHttpRequest({
        method: 'GET',
        url: 'https://api.example.com/data',
        timeout: 10000
    });
    const data = JSON.parse(r.responseText);
    process(data);
} catch (e) {
    // Covers network errors, timeout, and JSON parse failures when awaited
    console.error('Request or parse failed:', e);
}
```

| Form | Error channel | Handler |
|------|---------------|---------|
| Callback (`GM_xmlhttpRequest`) | `onerror` / `ontimeout` + `try/catch` inside `onload` | All three |
| Promise (`GM.xmlHttpRequest`) | Rejection + `try/catch` | `try { await … } catch (e) { … }` |

---

## Pitfall 10: Global Variable Pollution

Whether variables leak to the page depends on **grant mode**, not just IIFE presence.

**Wrong:**
```javascript
// ==UserScript==
// ...
// ==/UserScript==

var myData = 'secret';  // Visible to page as window.myData when @grant none!
function process() { ... }  // Visible to page when @grant none
```

**Right:**
```javascript
// ==UserScript==
// @grant GM_getValue
// ==/UserScript==

// With any grant (sandbox isolated), var is already isolated — but use let/const anyway
let myData = 'secret';  // Private to script sans page leak
function process() { ... }  // Private to script

// For @grant none (page context), wrap in IIFE or use let/const at top-level of module
(function() {
    'use strict';
    let myData2 = 'secret';  // Private even in page context
})();
```

| Grant mode | Execution context | `var` at top level | Leak? | Recommendation |
|------------|-------------------|--------------------|-------|----------------|
| `@grant none` | **Page context** (no sandbox) | `var myData` → `window.myData` | ✅ leaks | IIFE/module wrapper **required**; or use `let`/`const` |
| Any `@grant` (`GM_*`, `unsafeWindow`, etc.) | **Manager sandbox** (isolated) | `var` scoped to sandbox | ❌ isolated (page cannot see) | Still use `let`/`const` always; IIFE chiefly for `none` |
| Safari (any grant) | **Content world** (isolated) | Isolated | ❌ isolated | Use `let`/`const` always |

**Recommendation:** Use `let`/`const` always. Reserve IIFE as the primary defense for `@grant none` (page context) and as defense-in-depth elsewhere.

> **jQuery / `@require` global conflicts (verified 2026-08-25 — VM docs https://violentmonkey.github.io/api/metadata-block/#require — "Require another script to execute before the current one"; sandbox isolation via @grant — https://violentmonkey.github.io/api/metadata-block/#grant):** `@require https://cdn.example.com/jquery.js` executes before your script in the manager sandbox. With a sandbox (`any @grant`) `$` is isolated and does not collide via `unsafeWindow`/`wrappedJSObject`; with `@grant none` it pollutes `window` → collisions. Rule: sandboxed → use sandbox `$`; `none` → `jQuery.noConflict(true)` immediately or avoid `@require` jQuery. See `managers.md` §3.

---

## Pitfall 11: Wrong Timing with @run-at

`@run-at` defaults differ by **manager** — assuming one default breaks portability. Script may run before elements exist.

**Wrong:**
```javascript
// @run-at document-start

document.querySelector('#header').remove();  // null - DOM doesn't exist yet!
```

**Right:**
```javascript
// @run-at document-end — explicit, not relying on manager default

document.querySelector('#header')?.remove();  // Works when DOM ready
```

**Or wait for DOM robustly (works regardless of manager default):**
```javascript
// @run-at document-start — need robust wait, not just DOMContentLoaded single path
function onReady(callback) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
        callback();
    }
}

onReady(() => {
    document.querySelector('#header')?.remove();
});

// Or poll/waitForElement (see Pitfall 3) for elements injected after DOMContentLoaded (SPAs)
```

| Manager | Default `@run-at` | Explicit values available |
|---------|-------------------|---------------------------|
| TM | `document-idle` | `document-start` / `document-end` / `document-idle` / `document-body` |
| VM | `document-end` | `document-start` / `document-end` / `document-body` (2.12.10+) |
| GM4+ | `document-end` | `document-start` / `document-end` (no `document-body`, no `document-idle`) |
| Safari Userscripts | `document-end` | `document-start` / `document-end` (ignores `document-body`) |

**Robust pattern:** Always declare `@run-at` explicitly to match intent, and guard DOM access with `readyState` check or `waitForElement` — don't assume the default matches your timing need. (verified 2026-08-25 — TM default `document-idle` — https://www.tampermonkey.net/documentation.php?locale=en&q=run_at; VM default `document-end` + `document-start` body-null note — https://violentmonkey.github.io/api/metadata-block/#run-at; MDN readyState — https://developer.mozilla.org/en-US/docs/Web/API/Document/readyState)

---

## Pitfall 12: Cross-Browser / Cross-Manager Differences

Conflating browser and manager responsibilities causes subtle bugs. Cross-manager divergences (Xray bridges, `GM_webRequest` availability, containers, storage types/races, logging) live in one place: [manager-compat.md](manager-compat.md).

**Symptom:** Script works in one manager/browser but fails in another — e.g., `GM_webRequest` is `undefined`, `cloneInto` is missing, container isolation differs, stored objects become `[object Object]`, or parallel-tab counters diverge.

**Diagnostic:** Identify the manager + browser + manifest combo you tested vs the target. Check: `typeof GM_webRequest`, `typeof cloneInto`/`exportFunction`, `GM_info.scriptHandler` only as last resort — prefer capability checks (`typeof GM !== 'undefined' && GM.getValues`).

**Fix pointer:** See [manager-compat.md](manager-compat.md) — section “Tier-1 Portable Baseline — Cross-Manager Divergences” for the per-manager matrix and guarded code patterns; apply the fix there, not by branching on `scriptHandler`. (verified 2026-08-25 — section title matches manager-compat.md `## Tier-1 Portable Baseline — Cross-Manager Divergences`)

---

## Quick Diagnostic Checklist

When a script doesn't work — manager-first verification. Check each item against the relevant manager.

| # | Check | Where to look | TM | VM | GM4+ | Safari | Notes |
|---|-------|---------------|----|----|------|--------|-------|
| 5 | `@connect` includes target domains? **[TM-required]** | Metadata block | **Strict** | Advisory | Ignored | n/a | TM blocks without it; split from generic `@grant` check |
| 6 | `@connect *` fallback understood as TM-model? | Metadata block | TM-concept | Advisory | Ignored | n/a | Enumerate domains for TM; `*` is TM fallback |
| 7 | Default `@run-at` matches intent? | Metadata block / `managers.md` | Default `idle` | Default `end` | Default `end` | Default `end` | Wrong default ⇒ DOM not ready |
| 8 | Correct GM variant used? (`GM_*` vs `GM.*`) | Code: `typeof GM !== 'undefined' && GM.xmlHttpRequest` | Both | Both | `GM.*` only | `GM.*` only | `GM_xmlhttpRequest` ❌ on GM4+/Safari |
| 9 | `unsafeWindow` guarded? (`typeof unsafeWindow !== 'undefined'`) | Code | Grant-gated | Exposed | `wrappedJSObject` | ❌ absent | Unguarded ⇒ crash on Safari |
| 10 | Storage value types within GM4 limits? | `GM_setValue` payloads | Objects ok | Objects ok | **Primitives only** — stringify | Objects ok | GM4+ `JSON.stringify` objects |
| 12 | Using async correctly (callbacks/await + `try/catch`)? | `GM_xmlhttpRequest` vs `GM.xmlHttpRequest` | Both | Both | Promise only | Promise only | Callback needs `onerror`/`ontimeout`; promise needs `catch` |
| 13 | `scriptHandler` branching avoided in favor of capability checks? | Code: `if (GM?.getValues)` not `if (handler === "Tampermonkey")` | ✅ | ✅ | ✅ | ✅ | Prefer `typeof` / `in` checks |
| 14 | Manager-specific features gated? (`GM_cookie`, `GM_audio`, `window.onurlchange`) | Code guards | `GM_cookie` ✅ / `GM_audio` 5.4 | `GM_cookie` 2.35.1+ | ❌ | ❌ | Don't assume universal |
| 15 | Browser-specific bridges gated? (`cloneInto`, `exportFunction`) | Firefox Xray check | TM/Firefox ✅ | VM/Firefox ✅ | ✅ | ❌ | Chromium has no Xray |

```
[ ] @connect includes target domains? — TM REQUIRED (others advisory)
[ ] Default @run-at matches intent? (TM idle vs VM/GM/Safari end)
[ ] Correct GM variant used? (callback vs promise per manager)
[ ] unsafeWindow guarded? (Safari ❌)
[ ] Storage value types within GM4 limits? (primitives only)
[ ] Using async correctly (callback onerror/ontimeout vs promise try/catch)?
[ ] scriptHandler branching avoided (capability checks)?
[ ] Manager-specific features gated? (GM_cookie / GM_audio / onurlchange)
[ ] Browser-specific bridges gated? (cloneInto / exportFunction)
```

---

## Scope Closing

Scope: Violentmonkey-first, portable across TM/VM/GM4+/Safari — verify against `managers.md` before claiming support. For manager-neutral typing, see `typescript.md`; for compatibility matrix, see `browser-compatibility.md`. Prefer capability checks (`typeof GM !== 'undefined' && GM.xmlHttpRequest`) over `GM_info.scriptHandler` branching.
