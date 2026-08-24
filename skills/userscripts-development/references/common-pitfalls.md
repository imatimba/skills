# Common Userscript Pitfalls

Mistakes that break userscripts and how to avoid them. Scope: Violentmonkey-first, portable across TM / VM / GM4+ / Safari Userscripts. Manager facts per `managers.md`; anything not confirmed there is UNVERIFIED.

Manager literals for `GM_info.scriptHandler`: `"Tampermonkey"` | `"Violentmonkey"` | `"Greasemonkey"` | `"Userscripts"` (Safari app). Prefer capability checks over handler branching. Labeling convention for manager-specific notes follows Pitfall 15 as the model (`> **Manager-specific note:** This pitfall is specific to …`).

---

## Pitfall 1: @match Too Broad

Running on every page slows the browser and causes unexpected behaviour.

**Wrong:**
```javascript
// @match *://*/*
// @match https://*/*
```

**Right:**
```javascript
// @match https://example.com/*
// @match https://*.example.com/*
```

**Why it matters:** Overly broad patterns mean your script runs on thousands of sites, consuming memory and potentially breaking pages.

| Decision | Pattern | When to use |
|----------|---------|-------------|
| Broad | `*://*/*` | Almost never — debugging only |
| Scoped | `https://example.com/*` or `https://*.example.com/*` | Always — limit blast radius |

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

**Best practice:** Enumerate known domains for TM compatibility (`// @connect api.example.com` per host). `@connect *` as a fallback is a TM-model concept — it satisfies TM's strict check but is elsewhere advisory; prefer explicit domains and add `*` only when you truly need wildcard. Diagnostic checklist labels this as `[@connect — TM-required]` (see Quick Diagnostic Checklist).

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

Additional guards:

| Concern | Fix |
|---------|-----|
| `document.body` null at `document-start` | `observer.observe(document.body ?? document.documentElement, …)` |
| Unhandled async failure | `init().catch(e => …)` — don't drop the rejection |
| SPA navigation (no universal `onurlchange`) | History patch (`pushState`/`replaceState` + `popstate`/`hashchange`) or `VM.onNavigate`; `window.onurlchange` is TM-only |

> **Navigation API (modern alternative, as of 2026-08-24):** Chromium 102+ (Chrome/Edge) implements `window.navigation` with `navigate` / `navigatesuccess` / `navigateerror` events as a structured replacement for the history patch (verified via MDN Navigation API — `Navigation.navigate()`, `NavigationTransition`). Firefox and Safari do not yet implement it (as of 2026-08-24), so feature-detect before using: `if (window.navigation) navigation.addEventListener('navigatesuccess', handler); else /* history patch fallback */`. See MDN Navigation API: https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API

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

**Portable wrapper — feature-detect before calling:**

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

**Best practice:** Test CSP-sensitive injection in Violentmonkey first — TM may hide the CSP failure by stripping headers. If VM works, you have a truly portable solution.

> **Style CSP also blocks styles (verified 2026-08-24 via MDN CSP):** `style-src` (and `default-src` fallback) blocks inline `<style>` elements just as `script-src` blocks `<script>`. The same bypass applies — use `GM_addElement('style', { textContent: '...' })` where supported (TM/VM) to circumvent `style-src` restrictions. VM docs describe `GM_addElement` as "circumventing a strict Content-Security-Policy that forbids adding inline code *or style*" (https://violentmonkey.github.io/api/gm/). Where `GM_addElement` is unavailable (GM4+, Safari), inject via `@require` + linked stylesheet or remove the inline-style requirement. Source: MDN CSP fetch directives — `style-src sets allowed sources for CSS stylesheets` (https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP).

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

**Fix the incompleteness:** `@grant none` does not just "disable the sandbox entirely" — it disables the sandbox **and removes all `GM_*`/`GM.*` APIs** (you lose storage, XHR, etc.) — but `GM_info` / `GM.info` remains available (verified 2026-08-24 via TM grant docs: "In this mode no GM* function but the GM_info property will be available" — https://www.tampermonkey.net/documentation.php?locale=en&q=grant). In Safari, it still does not provide `unsafeWindow` (always ❌). Always guard:

```javascript
if (typeof unsafeWindow !== 'undefined') {
    // page-world access
} else {
    // Safari / content-world fallback: work with DOM only, or GM_addElement bridge where supported
}
```

Safari design note: any `@grant` forces content-world execution; there is no page-world access to design around — build features that work from the isolated DOM.

---

## Pitfall 7: Memory Leaks in Observers

MutationObservers that never disconnect consume memory.

**Wrong:**
```javascript
const observer = new MutationObserver(() => {
    processNewContent();
});
observer.observe(document.body ?? document.documentElement, { childList: true, subtree: true });
// Never disconnected - runs forever!
```

**Right:**
```javascript
const observer = new MutationObserver(() => {
    if (shouldStop()) {
        observer.disconnect();
        return;
    }
    processNewContent();
});
observer.observe(document.body ?? document.documentElement, { childList: true, subtree: true });

// Explicit teardown — beforeunload is unreliable (bfcache, SPA navigation may not fire it)
function teardown() { observer.disconnect(); }
// Prefer explicit teardown hooks over beforeunload:
// - SPA: hook history navigation (see Pitfall 3 fallback)
// - Page lifecycle: prefer `visibilitychange` (most reliable, incl. mobile), then `pagehide` (bfcache-compatible but not reliably fired on mobile per MDN), then explicit router hooks
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') teardown();
});
window.addEventListener('pagehide', teardown, { once: true });

// Or disconnect on page unload as best-effort fallback (may not fire in bfcache/SPAs)
window.addEventListener('beforeunload', () => observer.disconnect());
```

> **bfcache/SPA note:** `beforeunload` is unreliable — bfcache restores pages without firing it, and SPAs navigate without unloading. `pagehide` fixes bfcache compatibility but is also "not reliably fired... especially on mobile" (MDN `pagehide` event). Prefer `visibilitychange` as the primary teardown signal, then `pagehide` as next-best, with explicit navigation hooks as the SPA fallback.

---

## Pitfall 8: Overly Aggressive DOM Modifications

Modifying the DOM too frequently causes performance issues.

**Wrong:**
```javascript
// Runs on EVERY mutation
const observer = new MutationObserver(() => {
    document.querySelectorAll('.item').forEach(el => {
        el.style.color = 'red';  // Runs thousands of times
    });
});
```

**Right:**
```javascript
// Debounce modifications
let timeout;
const observer = new MutationObserver(() => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        document.querySelectorAll('.item:not(.processed)').forEach(el => {
            el.style.color = 'red';
            el.classList.add('processed');
        });
    }, 100);
});
observer.observe(document.body ?? document.documentElement, { childList: true, subtree: true });
```

| Strategy | Cost | When to use |
|----------|------|-------------|
| Direct per-mutation | High — thousands of style recalculations | Never for bulk |
| Debounced + `.processed` guard | Low — batches + idempotent | Always for observer-driven styling |

**Event-listener duplication on re-observed/dynamic content (verified 2026-08-24 via MDN `addEventListener`):** Each `addEventListener(type, listener)` call adds a *new* listener — calling it again on the same element without `removeEventListener` or `{ once: true }` stacks duplicates and fires the handler multiple times. A `MutationObserver` callback that does `el.addEventListener('click', handler)` on every mutation will double-bind each re-observed node.

```javascript
// Wrong — duplicates on every mutation
observerCallback(() => {
    document.querySelectorAll('.btn').forEach(el =>
        el.addEventListener('click', onClick) // stacks each time!
    );
});

// Right — guard, once, or AbortSignal
const seen = new WeakSet();
observerCallback(() => {
    document.querySelectorAll('.btn').forEach(el => {
        if (seen.has(el)) return;
        el.addEventListener('click', onClick);
        seen.add(el);
    });
});
// Alternatives: el.addEventListener('click', onClick, { once: true })
// or: el.addEventListener('click', onClick, { signal: controller.signal })
```

Source: MDN `EventTarget.addEventListener()` — `once` option "listener should be invoked at most once ... automatically removed when invoked" and `signal` option "listener will be removed when abort() is called" (https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener).

---

## Pitfall 9: Forgetting Error Handling

Network requests and async operations can fail — handle **both** callback errors and promise rejections.

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

Violentmonkey worked example: trigger airplane mode after `GM.xmlHttpRequest` — promise path must be caught or the unhandled rejection shows in Violentmonkey's console.

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

> **jQuery / `@require` global conflicts (verified 2026-08-24):** `@require https://cdn.example.com/jquery.js` executes *before* your script inside the manager sandbox, defining `$`/`jQuery` only in that sandbox (VM docs: "Require another script to execute before the current one" — https://violentmonkey.github.io/api/metadata-block/). With a sandbox (`any @grant`), the page's own jQuery is isolated via `unsafeWindow`/`wrappedJSObject` and `$` does not collide. With `@grant none` (no sandbox) your `@require`'d jQuery *does* pollute `window` and collides with the page's version.
>
> ```javascript
> // @grant GM_getValue          // sandboxed — $ is isolated, no conflict
> // @require https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js
> console.log(typeof window.$);       // page's $ (via unsafeWindow if needed)
> console.log(typeof $);              // sandbox's jQuery — isolated
>
> // @grant none                 // page context — collision risk!
> // @require https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js
> const jq = jQuery.noConflict(true); // restore page's $/jQuery, keep sandbox ref
> ```
>
> **Rule:** In sandboxed scripts, prefer the sandbox `$` and access page `$` only via `unsafeWindow` guard. In `@grant none`, call `jQuery.noConflict(true)` immediately after load or avoid `@require` jQuery entirely and use `fetch` + isolated DOM helpers.

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

**Robust pattern:** Always declare `@run-at` explicitly to match intent, and guard DOM access with `readyState` check or `waitForElement` — don't assume the default matches your timing need.

---

## Pitfall 12: Cross-Browser / Cross-Manager Differences

Conflating browser and manager responsibilities causes subtle bugs.

**Firefox-only bridges (Xray — not manager features):**
```javascript
// cloneInto and exportFunction only exist in Firefox Xray (GM4+ and TM-on-Firefox)
if (typeof cloneInto !== 'undefined') {
    unsafeWindow.myData = cloneInto(data, unsafeWindow, { cloneFunctions: true });
} else if (typeof unsafeWindow !== 'undefined') {
    unsafeWindow.myData = data;  // Chromium page-world
} else {
    // Safari — no page-world access at all; stay in content world
    console.warn('No page-world bridge available');
}
```

> **Function serialization specifics (verified 2026-08-24):** Assigning a function via `unsafeWindow.fn = myFn` through the structured clone algorithm throws `DataCloneError` on Firefox (MDN: "Function objects cannot be duplicated ... attempting to throws a DataCloneError" — https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm). Xray `cloneInto` strips functions by default because it uses structured clone; pass `{ cloneFunctions: true }` to preserve them. To expose a callable to the page, use `exportFunction` instead — `exportFunction(fn, unsafeWindow, { defineAs: 'fn' })` (MDN Sharing objects with page scripts — https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Sharing_objects_with_page_scripts). On Chromium there is no Xray; direct `unsafeWindow.fn = fn` assignment works but prototype chains are not walked (MDN: "The prototype chain is not walked or duplicated"). Guard accordingly.

**Manifest V3 limitations (framed by manager, not browser):**
```javascript
// @webRequest / GM_webRequest is NOT "Chrome MV3" generically — it's:
// TM experimental, Firefox MV2 only; broken on TM Chrome MV3 5.2+ (issue #2209);
// VM wontfix (issue #583); GM/Safari ❌.
// Don't present as browser capability row — it's manager + manifest.
if (typeof GM_webRequest !== 'undefined') {
    // TM Firefox MV2 only
    GM_webRequest([...], listener);
} else if (typeof unsafeWindow !== 'undefined') {
    // MV3 portable alternative: page-level fetch/XHR patch (guard Safari absent)
    // see browser-compatibility.md workaround snippet
}
```

| Topic | Manager-aware fact | Browser tie |
|-------|-------------------|-------------|
| `cloneInto` / `exportFunction` | Firefox Xray vision — GM4+ and TM-on-Firefox; not a GM API — `cloneInto` without `cloneFunctions:true` strips functions via `DataCloneError` (MDN structured clone) | Firefox only; Chromium has no Xray |
| `GM_webRequest` / `@webRequest` | TM experimental Firefox MV2 only; broken TM Chrome MV3 5.2+; VM wontfix; GM/Safari ❌ | Manifest (MV2 vs MV3) + manager |
| Firefox containers | TM's `@run-in container-id-N` (TM 5.3+) is TM-only; Firefox's native contextual identities are separate | Firefox only |
| Storage types | GM4+ stores **primitives only** — `JSON.stringify` objects yourself; TM/VM/Safari store objects | Manager, not browser |
| Storage race / atomicity | `GM.*` storage is async with no cross-tab transactions — concurrent `GM.getValue` → `GM.setValue` races (file under-covers) | Manager (all) — especially parallel tabs |

> **Storage race & atomicity (verified 2026-08-24 via Greasespot wiki):** `GM.getValue`/`GM.setValue` return promises with no transaction. Concurrent read-modify-write from two tabs races — final value may reflect only one increment (e.g., 64 instead of 100). Wiki stresses "Note awaiting the set -- required so the next get sees this set" (https://wiki.greasespot.net/GM_getValue) and warns "Doing many gets/many sets can be slow. Instead get/set one value ... or use Promise.all()". Mitigations: (1) batch state in a single JSON object behind one key, (2) serialize with `await` ordering, (3) use `GM_addValueChangeListener` to react to external writes, or (4) implement a compare-and-swap loop. See also `GM_setValue` primitives-only note — https://wiki.greasespot.net/GM_setValue.
| Logging | `GM_log` removed in GM4+ — use `console.log` | Manager (GM4+) |

---

## Pitfall 13: Hardcoded Selectors

Page structure changes break scripts.

**Fragile:**
```javascript
document.querySelector('div.sc-1234abcd > div:nth-child(3) > span');
```

**Robust:**
```javascript
// Use stable attributes
document.querySelector('[data-testid="username"]');
document.querySelector('[aria-label="Close"]');

// Or multiple fallbacks
const element = document.querySelector('#username') ||
                document.querySelector('[data-user]') ||
                document.querySelector('.profile-name');
```

| Selector style | Resilience | When to use |
|----------------|------------|-------------|
| Generated class / `:nth-child` chain | ❌ Fragile — breaks on redeploy | Never |
| Stable attributes (`data-testid`, `aria-label`, `id`) | ✅ Robust | Always prefer |
| Multiple fallbacks (try stable, then heuristic) | ✅ Resilient | Production scripts |

---

## Pitfall 14: Not Testing in Target Manager

Scripts that work in one manager may break in another. Browser-only testing hides manager differences (e.g., VM respects CSP while TM may not).

**Manager-first testing matrix — Violentmonkey first (owner default):**

| Step | Manager | What to verify |
|------|---------|----------------|
| 1 | **Violentmonkey** (Chrome + Firefox) | Install via dashboard/drag-and-drop, enable, storage types (objects ok), batch APIs (2.19.1+), CSP behavior (GM_addElement fallback), `unsafeWindow` exposed |
| 2 | Tampermonkey (Chrome MV3 + Firefox MV2) | `GM_cookie` stable, `GM_audio` 5.4 only, `window.onurlchange` TM-only, `@sandbox`/`@run-in` parsing |
| 3 | Greasemonkey 4+ (Firefox) | Promise-only APIs, primitives-only storage, `GM_addStyle`/`GM_log` removed (polyfill or `console.log`), `GM.notification` shape |
| 4 | Safari Userscripts (macOS/iOS 15.1+) | Promise subset only, no `unsafeWindow`, any `@grant` ⇒ content world, `openInTab`/`closeTab` bool only, `setClipboard` deprecated |
| 5 | Private/Incognito | Manager permissions for incognito tabs (`@run-in` where needed), CSP strictness |

Before deploying, also verify:

- [ ] Violentmonkey: build artifact loads in dashboard and survives external-edits reload
- [ ] Manager-specific workarounds (e.g., GM4+ stringify) don't break TM/VM
- [ ] Page CSP tested in VM (strict) not just TM (lenient)

---

## Pitfall 15: Script Not Running After Tampermonkey v5.4.1 Update

> **Manager-specific note:** This pitfall is specific to Tampermonkey. Greasemonkey and Violentmonkey have not (at time of writing) introduced the same per-site injection permission requirement.

Tampermonkey v5.4.1+ requires explicit user permission to inject scripts into pages.

**Symptom:** Script was working, stopped after Tampermonkey updated.

**Fix:** Click the Tampermonkey icon → "Allow extension to access this site" (or configure globally in Dashboard → Settings → Script Injection).

**Why this changed:** Browser vendors (Chrome MV3) now require extensions to request explicit permission before injecting content into pages.

---

## Quick Diagnostic Checklist

When a script doesn't work — manager-first verification. Check each item against the relevant manager.

| # | Check | Where to look | TM | VM | GM4+ | Safari | Notes |
|---|-------|---------------|----|----|------|--------|-------|
| 1 | Console shows errors? (F12 → Console) | Page console + manager console | ✅ | ✅ | ✅ | ✅ | Violentmonkey: page console + sandboxed console |
| 2 | Script is enabled in your manager's dashboard? | Manager dashboard | ✅ | ✅ | ✅ | ✅ | VM: `chrome-extension://<id>/options/index.html#/installed` |
| 3 | `@match`/`@include` pattern matches current URL? | `GM_info.script.matches` / URL bar | ✅ | ✅ | ✅ | ✅ | Safari requires ≥1 rule; prefers `@match` |
| 4 | Required `@grant` statements present? | Metadata block | ✅ | ✅ | ✅ | ✅ | Missing grant ⇒ API undefined |
| 5 | `@connect` includes target domains? **[TM-required]** | Metadata block | **Strict** | Advisory | Ignored | n/a | TM blocks without it; split from generic `@grant` check |
| 6 | `@connect *` fallback understood as TM-model? | Metadata block | TM-concept | Advisory | Ignored | n/a | Enumerate domains for TM; `*` is TM fallback |
| 7 | Default `@run-at` matches intent? | Metadata block / `managers.md` | Default `idle` | Default `end` | Default `end` | Default `end` | Wrong default ⇒ DOM not ready |
| 8 | Correct GM variant used? (`GM_*` vs `GM.*`) | Code: `typeof GM !== 'undefined' && GM.xmlHttpRequest` | Both | Both | `GM.*` only | `GM.*` only | `GM_xmlhttpRequest` ❌ on GM4+/Safari |
| 9 | `unsafeWindow` guarded? (`typeof unsafeWindow !== 'undefined'`) | Code | Grant-gated | Exposed | `wrappedJSObject` | ❌ absent | Unguarded ⇒ crash on Safari |
| 10 | Storage value types within GM4 limits? | `GM_setValue` payloads | Objects ok | Objects ok | **Primitives only** — stringify | Objects ok | GM4+ `JSON.stringify` objects |
| 11 | Element exists when script runs? | `waitForElement` / `readyState` | ✅ | ✅ | ✅ | ✅ | Use `?? document.documentElement` guard |
| 12 | Using async correctly (callbacks/await + `try/catch`)? | `GM_xmlhttpRequest` vs `GM.xmlHttpRequest` | Both | Both | Promise only | Promise only | Callback needs `onerror`/`ontimeout`; promise needs `catch` |
| 13 | `scriptHandler` branching avoided in favor of capability checks? | Code: `if (GM?.getValues)` not `if (handler === "Tampermonkey")` | ✅ | ✅ | ✅ | ✅ | Prefer `typeof` / `in` checks |
| 14 | Manager-specific features gated? (`GM_cookie`, `GM_audio`, `window.onurlchange`) | Code guards | `GM_cookie` ✅ / `GM_audio` 5.4 | `GM_cookie` 2.35.1+ | ❌ | ❌ | Don't assume universal |
| 15 | Browser-specific bridges gated? (`cloneInto`, `exportFunction`) | Firefox Xray check | TM/Firefox ✅ | VM/Firefox ✅ | ✅ | ❌ | Chromium has no Xray |

```
[ ] Console shows errors? (F12 → Console) — per manager
[ ] Script is enabled in your manager's dashboard? — VM dashboard first
[ ] @match pattern matches current URL?
[ ] Required @grant statements present?
[ ] @connect includes target domains? — TM REQUIRED (others advisory)
[ ] Default @run-at matches intent? (TM idle vs VM/GM/Safari end)
[ ] Correct GM variant used? (callback vs promise per manager)
[ ] unsafeWindow guarded? (Safari ❌)
[ ] Storage value types within GM4 limits? (primitives only)
[ ] Element exists when script runs? (readyState / waitForElement)
[ ] Using async correctly (callback onerror/ontimeout vs promise try/catch)?
[ ] scriptHandler branching avoided (capability checks)?
[ ] Manager-specific features gated? (GM_cookie / GM_audio / onurlchange)
[ ] Browser-specific bridges gated? (cloneInto / exportFunction)
```

---

## Scope Closing

Scope: Violentmonkey-first, portable across TM/VM/GM4+/Safari — verify against `managers.md` before claiming support. For manager-neutral typing, see `typescript.md`; for compatibility matrix, see `browser-compatibility.md`. Prefer capability checks (`typeof GM !== 'undefined' && GM.xmlHttpRequest`) over `GM_info.scriptHandler` branching.

