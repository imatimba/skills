# Web Request Interception API Reference

Documentation for `GM_webRequest` — intercept and modify browser requests before they are made. This API is **Tampermonkey-experimental only, not portable** (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_webRequest) — **do not rely on it in portable scripts; use the page-level patch fallback as the primary pattern**. Source of truth for support: [managers.md](managers.md).

---

## Overview — TM-only, not portable

`GM_webRequest` allows userscripts to intercept, block, or redirect web requests before they are sent. **Portable scripts must treat it as an optional enhancement — the primary portable pattern is page-level patching (see Cross-manager alternatives). For portable scripts, use page-level `fetch`/`XHR` patching, not `GM_webRequest`.**

**Manager × browser matrix:**

| Manager + browser | `GM_webRequest` support | Notes |
| --- | --- | --- |
| Tampermonkey + Firefox MV2 | ✅ experimental | Requires `@grant GM_webRequest` to call `GM_webRequest(rules, listener)` OR `@webRequest` header for declarative pre-load rules (both only for pre-load + runtime listener); may change at any time (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_webRequest + tampermonkey.net/documentation.php?q=webRequest) |
| Tampermonkey + Chrome/Edge MV3 | ❌ broken | Broken since Tampermonkey 5.2+ — see Tampermonkey issue #2209 (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_webRequest + github.com/Tampermonkey/tampermonkey/issues/2209) |
| Violentmonkey (any browser) | ❌ wontfix | Declined — see Violentmonkey issue #583; `typeof GM_webRequest === 'undefined'` always (verified 2026-08-25 — github.com/violentmonkey/violentmonkey/issues/583) |
| Greasemonkey 4+ | ❌ absent | No implementation |
| Safari Userscripts | ❌ absent | No implementation |

Request types the Tampermonkey implementation can intercept (when available): `sub_frame`, `script`, `xhr`, `websocket` (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_webRequest). It cannot intercept `main_frame` (top document), images, stylesheets, or fonts — only those four types proceed per that doc. Details under Limitations (Tampermonkey Firefox MV2 only).

---

## Required Setup

```javascript
// @grant GM_webRequest
// Tampermonkey-only grant — verify availability before use (see Best Practices)
```

---

## Tampermonkey-only Syntax — Not Portable (compressed reference)

All `GM_webRequest` syntax below is **Tampermonkey on Firefox MV2 only** — no effect in Violentmonkey, Greasemonkey, or Safari. For portable scripts this section is informational only; do not rely on it. Full DSL is documented at [tampermonkey.net/documentation.php?q=GM_webRequest](https://www.tampermonkey.net/documentation.php?q=GM_webRequest) and [tampermonkey.net/documentation.php?q=webRequest](https://www.tampermonkey.net/documentation.php?q=webRequest).

Selectors (`selector` / `selector.include` / `selector.match` / `selector.exclude`) and actions (`action: 'cancel'` / `action.cancel` / `action.redirect` with `redirect` string or `{from, to}` pattern) are a Tampermonkey DSL — note that redirect targets must be covered by `@match`/`@include` (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_webRequest). The `@webRequest` header (`// @webRequest {"selector": "...", "action": "cancel"}`) defines pre-load rules before script load (verified 2026-08-25 — tampermonkey.net/documentation.php?q=webRequest: takes JSON matching `GM_webRequest` `rule` param; same experimental + MV3 5.2+ note). Listener shape `info` (`cancel`/`redirect`), `message` (`ok`/`error`), `details.{rule,url,redirect_url,description}` and that the listener cannot impact rule action are likewise TM-only (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_webRequest; listener cannot impact rule action per docs).

Minimal TM-only example (Firefox MV2 only — for portable fallback see Cross-manager alternatives):

```javascript
// Tampermonkey on Firefox MV2 only — feature-detect before use
if (typeof GM_webRequest !== 'undefined') {
  GM_webRequest([
    { selector: '*://ads.example.com/*', action: 'cancel' },
    { selector: { include: '*://example.com/*', exclude: '*://example.com/api/*' }, action: 'cancel' },
    { selector: '*://old.example.com/*', action: { redirect: 'https://new.example.com/' } }
  ], function(info, message, details) {
    console.log(info, message, details.url);
  });
}
```

> Examples such as block-ads, pattern redirect, or resource-type blocking are all TM-only — see TM docs for full rule syntax. Portable equivalents are in Cross-manager alternatives below.

---

## Limitations — Tampermonkey Firefox MV2 only

The browser-limitations content below is framed for the **Tampermonkey implementation on Firefox MV2** — other managers have no implementation at all (see matrix above).

**Browser support:** Authoritative matrix is in [managers.md](managers.md) §2 — `GM_webRequest` is experimental Firefox MV2 only; broken on Chrome/Edge MV3 (TM 5.2+, issue #2209) (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_webRequest + github.com/Tampermonkey/tampermonkey/issues/2209); Violentmonkey wontfix (verified 2026-08-25 — github.com/violentmonkey/violentmonkey/issues/583); Greasemonkey/Safari absent.

### Request Types

Only these request types can be intercepted where the API exists (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_webRequest: proceeds only `sub_frame`, `script`, `xhr` and `websocket`):

- `sub_frame` - iframes
- `script` - JavaScript files
- `xhr` - XMLHttpRequest/fetch
- `websocket` - WebSocket connections

These **cannot** be intercepted even where available (verified 2026-08-25 — same doc: only those four types proceed, so `main_frame`, images, stylesheets, fonts excluded):

- Main document (`main_frame`)
- Images
- Stylesheets
- Fonts

---

## Cross-Manager Alternatives (required unless Tampermonkey on Firefox MV2)

`GM_webRequest` is not portable. For scripts that must run in Violentmonkey (the worked example), Greasemonkey, Safari, or Tampermonkey on Chromium MV3, use these as the **primary** portable pattern (verified 2026-08-25 — github.com/violentmonkey/violentmonkey/issues/583 wontfix + tampermonkey.net/documentation.php?q=GM_webRequest MV3 unavailable).

**Decision table:**

| Goal | Portable primary | When to use `GM_webRequest` |
| --- | --- | --- |
| Block or redirect a request **before** it loads | Page-level monkey-patch via `unsafeWindow.fetch` / `unsafeWindow.XMLHttpRequest` (weaker — runs at `document-start` and can be raced) | Only Tampermonkey on Firefox MV2 gives a true pre-load network block/redirect |
| Hide or remove content **after** it loads | CSS hiding via `GM_addStyle`/`GM.addStyle` + DOM removal via `MutationObserver` — works in **all** managers | Never needed; portable approach is preferred |

### Page-Level Interception — PRIMARY portable pattern

Works in Tampermonkey and Violentmonkey with `unsafeWindow`; adapt per [managers.md](managers.md). Safari Userscripts has no `unsafeWindow` — design without page-world access or use the CSS/DOM alternatives below.

```javascript
// @grant unsafeWindow
// Violentmonkey worked example — page-context fetch/XHR patch
// Requires @run-at document-start for best coverage; still weaker than GM_webRequest pre-load block

// Intercept fetch
const originalFetch = unsafeWindow.fetch;
unsafeWindow.fetch = function(...args) {
    const url = args[0]?.url || args[0];
    console.log('Intercepted fetch:', url);

    // Block certain URLs
    if (url.includes('tracking.com')) {
        return Promise.reject(new Error('Blocked'));
    }

    return originalFetch.apply(this, args);
};

// Intercept XMLHttpRequest
const originalOpen = unsafeWindow.XMLHttpRequest.prototype.open;
unsafeWindow.XMLHttpRequest.prototype.open = function(method, url) {
    console.log('Intercepted XHR:', method, url);

    // Block certain URLs
    if (url.includes('tracking.com')) {
        throw new Error('Blocked');
    }

    return originalOpen.apply(this, arguments);
};
```

### Remove Elements After Load

Portable — works in all managers:

```javascript
// Remove ad iframes after they load — portable
const observer = new MutationObserver(() => {
    document.querySelectorAll('iframe[src*="ads"]').forEach(el => el.remove());
});
observer.observe(document.body, { childList: true, subtree: true });
```

### Use CSS to Hide — PRIMARY portable pattern for hide-after-load

Portable — works in all managers (use `GM.addStyle` promise form where needed; Greasemonkey/Safari need fallback):

```javascript
// @grant GM_addStyle
// Violentmonkey: GM_addStyle works; Greasemonkey 4+ needs manual style element

GM_addStyle(`
    iframe[src*="ads"],
    [id*="advertisement"],
    [class*="sponsored"] {
        display: none !important;
    }
`);
```

---

## Best Practices

1. **Provide fallbacks** - Check if `GM_webRequest` is available (it never exists in Violentmonkey)
2. **Consider portable alternatives first** - Your script may need to work outside Tampermonkey on Firefox MV2

```javascript
// Check if GM_webRequest is available — Violentmonkey never defines it (wontfix #583) (verified 2026-08-25 — github.com/violentmonkey/violentmonkey/issues/583)
if (typeof GM_webRequest !== 'undefined') {
    GM_webRequest([...rules...]); // Tampermonkey on Firefox MV2 only
} else {
    console.log('GM_webRequest not available, using portable fallback');
    // Use page-level patching / CSS / MutationObserver instead (see above)
}
```

---

> **Background requests, CORS & credentials → [http-requests.md](http-requests.md):** `GM_xmlhttpRequest` / `GM.xmlHttpRequest` mechanics, `@connect` enforcement, background-vs-page CORS/CSP bypass, and page `fetch` fundamentals (`mode`, `credentials`, preflight, `keepalive`/`sendBeacon`, streaming) are owned by [http-requests.md](http-requests.md) — see its sections “Background vs Page `fetch` — CORS, CSP & Credentials” and “keepalive & sendBeacon for Unload” (verified 2026-08-25 — http-requests.md owns those sections; pointer only, no re-import).

---

## MV3 declarativeNetRequest Boundary — Why GM_webRequest Is Unavailable

`GM_webRequest` is unavailable on Tampermonkey MV3 (Chrome/derivates) since TM 5.2+ — see issue #2209 reporting "currently not supported in MV3" (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_webRequest + github.com/Tampermonkey/tampermonkey/issues/2209). MV3 replaces blocking `webRequest` with `declarativeNetRequest` (declarative static rules, no per-request JS callback) — cannot replicate `GM_webRequest` dynamic patching. For portable scripts on Chromium MV3, use the portable fallbacks above. Details: MDN [`webRequest`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest) and [`declarativeNetRequest`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/declarativeNetRequest).

---

## Page-Level Patch Coverage Gaps & Cache Caveat (verified 2026-08-25 — MDN webRequest/handlerBehaviorChanged + MDN Using Fetch + MDN CSP connect-src)

Monkey-patching `unsafeWindow.fetch` / `unsafeWindow.XMLHttpRequest` (requires `@grant unsafeWindow` + `@run-at document-start`) is weaker than `GM_webRequest` in three ways:

1. **Can be raced** — `document-start` is the earliest injection but resources may already be fetched.
2. **Cannot intercept non-fetch resource loads** without additional patching — `<img>`, `<link rel="stylesheet">`, `<script>` tag insertion, `navigator.sendBeacon()`, and `new WebSocket()` are separate APIs (each controlled by CSP `connect-src` per MDN `connect-src` directive) and are not covered by a `fetch`/`XHR` wrapper.
3. **Still subject to constraints** — page `fetch` remains gated by CSP `connect-src`; `ReadableStream` bodies are one-shot and require `request.clone()` before second use ("Body has already been consumed" — MDN Using Fetch, verified 2026-08-25).

**Cache caveat:** Even `webRequest` blocking can be skipped for cached responses. MDN `webRequest.handlerBehaviorChanged()` documents: "events will not be triggered for the request" when a page is reloaded from the in-memory cache, requiring `handlerBehaviorChanged()` to flush the cache. Tampermonkey issue #397 discussion notes the same `fromCache` limitation for `onResponseStarted` (verified 2026-08-25 — developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/handlerBehaviorChanged). Treat "blocking before load" as best-effort when caching is involved.
