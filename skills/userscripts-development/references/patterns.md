# Common Userscript Patterns

Reusable patterns and templates for common userscript tasks. Guidance is manager-agnostic; manager caveats are called out per pattern (see [managers.md](managers.md) for source of truth).

| Need | Pattern | When | Manager caveat |
|------|---------|------|----------------|
| Run after DOM is ready | `readyState` + `DOMContentLoaded` | `@run-at document-start` scripts, or when timing is uncertain | Universal — works in all managers |
| Run after a specific element appears | `waitForElement` / `MutationObserver` | Dynamic frameworks (React/Vue), lazy-loaded content | Universal; store handle and `.disconnect()` on SPA route change |
| React to SPA navigation | History-API patch (`pushState`/`replaceState` + `popstate`/`hashchange`) | SPAs that don't reload | Portable — works everywhere; `window.onurlchange` is Tampermonkey-only (see below) |
| Hide/remove page elements | CSS via `GM_addStyle` / `GM.addStyle` or `element.remove()` | Ads, banners, clutter | `GM_addStyle` absent in Greasemonkey 4+ (no `GM.addStyle` either — use `gm-addstyle` polyfill or `createElement('style')` fallback); check `typeof` before calling |

---

## Sandbox and Scope (IIFE, `@grant none`, `unsafeWindow`, `@inject-into`) — verified 2026-08-25 — https://violentmonkey.github.io/api/gm/#unsafewindow, https://www.tampermonkey.net/documentation.php?locale=en&q=grant, https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Sharing_objects_with_page_scripts

Portable rules that change what you write:

- **Default sandbox (verified 2026-08-25 — https://violentmonkey.github.io/api/gm/#unsafewindow, https://www.tampermonkey.net/documentation.php?locale=en&q=grant):** Tampermonkey and Violentmonkey run scripts **sandboxed** by default — `window` is a wrapper, `window.foo = 123` stays script-scoped. Disable only with `// @grant none`, then no `GM*` APIs are available except `GM_info`/`GM.info`.
- **`unsafeWindow` (requires `// @grant unsafeWindow`):** Access page globals without leaving the sandbox. Avoid calling untrusted functions on it directly — see Greasespot `UnsafeWindow` security note (verified 2026-08-25 — https://wiki.greasespot.net/UnsafeWindow).
- **`@inject-into` (Violentmonkey):** `page` (page context, `unsafeWindow === window`), `content` (DOM-only), `auto` (default: try page, fallback to content when blocked by CSP). Use `// @grant none` vs explicit grants to control sandbox; wrap entry in IIFE `(function () { 'use strict'; /* ... */ })();` to avoid leaking globals across `@require` files.

For full injection models, CSP fallback, Firefox Xray (`cloneInto`/`exportFunction`/`wrappedJSObject`), and `@sandbox` vs `@inject-into` mapping, see [managers.md](managers.md) §4 and [header-reference.md](header-reference.md) `@grant`/`@sandbox`/`@inject-into` (authoritative).

Sources: https://violentmonkey.github.io/api/gm/#unsafewindow, https://www.tampermonkey.net/documentation.php?locale=en&q=grant, https://www.tampermonkey.net/documentation.php?locale=en&q=sandbox, https://violentmonkey.github.io/api/metadata-block/#inject-into, https://wiki.greasespot.net/UnsafeWindow, https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Sharing_objects_with_page_scripts

---

## Page Load Detection

### Wait for DOM Ready

```javascript
// For @run-at document-start scripts
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function init() {
    console.log('DOM is ready');
}
```

### Wait for Specific Element

```javascript
function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
        // Check if already exists
        const existing = document.querySelector(selector);
        if (existing) return resolve(existing);

        // Set up observer
        const observer = new MutationObserver((mutations, obs) => {
            const element = document.querySelector(selector);
            if (element) {
                obs.disconnect();
                resolve(element);
            }
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        // Timeout
        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timeout waiting for ${selector}`));
        }, timeout);
    });
}

// Usage — store the promise; no observer handle to disconnect here (internal)
// For a persistent observer, keep the return value and call .disconnect() on SPA route change
waitForElement('#main-content').then(el => {
    console.log('Found element:', el);
}).catch(err => {
    console.log('Element not found:', err);
});
```

---

## DOM Mutation Observation (verified 2026-08-25 — https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver, https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/disconnect, https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/takeRecords)

### Watch for Dynamic Content

```javascript
function observeDOM(targetSelector, callback, options = {}) {
    const target = document.querySelector(targetSelector) || document.body;

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        callback(node, 'added');
                    }
                });
            }
        }
    });

    observer.observe(target, {
        childList: true,
        subtree: true,
        ...options
    });

    return observer; // store return value; call .disconnect() on SPA route change
}

// Usage - watch for new posts — store handle for cleanup
const feedObserver = observeDOM('#feed', (node, action) => {
    if (node.matches('.post')) {
        console.log('New post added:', node);
        processPost(node);
    }
});
// Later, e.g. on SPA route change:
// feedObserver.disconnect();
```

### Debounced Observer

Debouncing coalesces rapid mutations (common on SPAs) into one handler call — directly affects portable authoring for performance.

```javascript
function observeDOMDebounced(target, callback, delay = 100) {
    let timeout;

    const observer = new MutationObserver(() => {
        clearTimeout(timeout);
        timeout = setTimeout(callback, delay);
    });

    observer.observe(target, { childList: true, subtree: true });
    return observer; // store return value; call .disconnect() when done
}

// Usage - process changes once they settle
const debouncedObserver = observeDOMDebounced(document.body, () => {
    console.log('DOM changes settled');
    processPage();
});
// debouncedObserver.disconnect(); // when navigating away or tearing down
```

### Alternative observers, error handling, and lifetime

- `IntersectionObserver`/`PerformanceObserver`/`ResizeObserver` are standard Web APIs for viewport, performance, and resize observations — prefer them over `MutationObserver` subtree on `document.body` when you only need those signals. See MDN pages for each (verified 2026-08-25 — https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver, https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver).
- `observer.observe()` throws `TypeError` if none of `childList`/`attributes`/`characterData` is `true`; shadow roots must be observed separately. Flush pending records before teardown with `let pending = observer.takeRecords(); observer.disconnect(); if (pending.length) handleMutations(pending);` — pending mutations are discarded on `disconnect()` otherwise. See MDN `MutationObserver.observe`/`takeRecords`.
- Keep observers bounded: one `{ childList: true, subtree: true }` on `document.body` is cheaper than N independent ones; always `takeRecords()` + `disconnect()` + `clearTimeout` on route change or timeout. See MDN `MutationObserver.disconnect`.

Sources: https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe, https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/takeRecords, https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/disconnect, https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver, https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver

---

## SPA Navigation Handling (verified 2026-08-25 — https://developer.mozilla.org/en-US/docs/Web/API/History/pushState, https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState, https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event, https://developer.mozilla.org/en-US/docs/Web/API/Window/hashchange_event, https://www.tampermonkey.net/documentation.php?locale=en&q=window#api:window.onurlchange, https://violentmonkey.github.io/api/matching/)

### URL Change Detection

Portable primary path is History-API patching — it works in every Tier-1 manager (TM, VM, GM4). `window.onurlchange` (`urlchange` event) is **Tampermonkey-only** (`// @grant window.onurlchange`; check `window.onurlchange === null` then `addEventListener('urlchange')`); do not rely on it for portable scripts. For the normative per-manager matrix and alternatives (`window.navigation` `navigate` event, Violentmonkey `@violentmonkey/url` `VM.onNavigate`) see [managers.md](managers.md) §2 and [api-tabs.md](api-tabs.md).

**Portable History-API interception:**

```javascript
let currentUrl = location.href;

function handleUrlChange() {
    if (location.href !== currentUrl) {
        currentUrl = location.href;
        console.log('URL changed:', currentUrl);
        onPageChange();
    }
}

// Primary portable method — patch history + listen popstate/hashchange
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    handleUrlChange();
    return result;
};

history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    handleUrlChange();
    return result;
};

window.addEventListener('popstate', handleUrlChange);
window.addEventListener('hashchange', handleUrlChange);

// Optional enhancement — Tampermonkey-only window.onurlchange (feature-detect)
// Requires: // @grant window.onurlchange  — Tampermonkey only; ignored elsewhere
if (typeof window.onurlchange !== 'undefined' && window.onurlchange === null) {
    window.addEventListener('urlchange', (info) => {
        // info.url is the new URL (Tampermonkey)
        console.log('URL changed (Tampermonkey onurlchange):', info.url);
        handleUrlChange();
    });
}
```

### Route-Based Handlers

```javascript
const routes = {
    '/': homeHandler,
    '/profile': profileHandler,
    '/settings': settingsHandler,
    '/post/:id': postHandler
};

function matchRoute(path) {
    for (const [pattern, handler] of Object.entries(routes)) {
        const regex = new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$');
        const match = path.match(regex);
        if (match) {
            return { handler, params: match.groups || {} };
        }
    }
    return null;
}

function onPageChange() {
    const route = matchRoute(location.pathname);
    if (route) {
        route.handler(route.params);
    }
}

function postHandler(params) {
    console.log('Viewing post:', params.id);
}
```

Route patterns using `(?<name>...)` named groups are ES2018+. For legacy engines use unnamed groups `([^/]+)`.

Site-specific SPA events (`yt-navigate-finish`, `turbo:load`, `pjax:end`, etc.) are page-internal and undocumented — prefer the portable history patch above as the reliable baseline and treat site events as optional fallback only.

---

## Network Request Interception (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?locale=en&q=connect, https://violentmonkey.github.io/api/gm/#gm_xmlhttprequest)

- **Bypass CSP/CORS with `GM_xmlhttpRequest` / `GM.xmlHttpRequest` (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?locale=en&q=connect, https://violentmonkey.github.io/api/gm/#gm_xmlhttprequest):** Privileged XHR for cross-origin fetches. Requires `// @grant GM_xmlhttpRequest` (or `GM.xmlHttpRequest`) and `// @connect <host>` per host; declare `@connect` for portability — Tampermonkey enforces strictly (initial + final URL), Violentmonkey declares but does not enforce, Greasemonkey/Safari ignore. See [managers.md](managers.md) §2 for the normative matrix.
- **Portable observation fallback — page-level monkey-patch:** Works everywhere without grants; use to log or block page-initiated requests.

```javascript
const origFetch = window.fetch;
window.fetch = function(input, init) {
  const url = input instanceof Request ? input.url : String(input);
  console.log('fetch intercept:', url);
  return origFetch.apply(this, arguments);
};
const origOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url, ...rest) {
  this._interceptUrl = url;
  return origOpen.call(this, method, url, ...rest);
};
```

Sources: https://www.tampermonkey.net/documentation.php?locale=en&q=connect, https://violentmonkey.github.io/api/gm/#gm_xmlhttprequest

---

## Element Manipulation (verified 2026-08-25 — https://wiki.greasespot.net/GM_addStyle, https://violentmonkey.github.io/api/gm/#gm_addstyle, https://www.tampermonkey.net/documentation.php?locale=en&q=GM_addStyle, https://developer.mozilla.org/en-US/docs/Web/API/Element/insertAdjacentHTML)

### Inject HTML

```javascript
function injectHTML(targetSelector, html, position = 'beforeend') {
    const target = document.querySelector(targetSelector);
    if (target) {
        target.insertAdjacentHTML(position, html);
    }
}

// Positions: beforebegin, afterbegin, beforeend, afterend
injectHTML('#container', '<div class="injected">Hello</div>', 'afterbegin');
```

`insertAdjacentHTML` throws `TypeError` when the page enforces `require-trusted-types-for 'script'` — use `trustedTypes.createPolicy`/`DOMPurify` or `createElement`/`textContent` fallback. See MDN `Element.insertAdjacentHTML` (verified 2026-08-25 — https://developer.mozilla.org/en-US/docs/Web/API/Element/insertAdjacentHTML).

### Remove Elements

```javascript
function removeElements(selector) {
    document.querySelectorAll(selector).forEach(el => el.remove());
}

// Hide elements with CSS — portable with fallback (GM_addStyle absent in Greasemonkey 4+ / Safari)
// @grant GM_addStyle  // for GM_addStyle path; omit or use GM.addStyle for promise form
function hideElements(selector) {
    const css = `${selector} { display: none !important; }`;
    if (typeof GM_addStyle !== 'undefined') {
        GM_addStyle(css);
    } else if (typeof GM !== 'undefined' && typeof GM.addStyle === 'function') {
        // Violentmonkey/Tampermonkey promise path (Greasemonkey 4 removed GM_addStyle entirely with no GM.addStyle)
        GM.addStyle(css);
    } else {
        // Fallback — works everywhere, no grant needed (or use gm-addstyle polyfill)
        const style = document.createElement('style');
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
    }
}

// Usage
removeElements('.ads, .sponsored, .promoted');
hideElements('[data-ad], .advertisement');
```

---

## Event Delegation (verified 2026-08-25 — https://developer.mozilla.org/en-US/docs/Web/API/Element/closest)

General delegation for dynamic content — one listener on a stable ancestor instead of per-node handlers. `Element.closest(selector)` is Baseline Widely available. See MDN `Element.closest`.

```javascript
// One listener for all current and future ".post" elements
document.body.addEventListener('click', (e) => {
  const post = e.target.closest('.post');
  if (!post) return;
  const likeBtn = e.target.closest('button.like');
  if (likeBtn && post.contains(likeBtn)) {
    handleLike(post, likeBtn);
    return;
  }
  handlePostClick(post);
});

// Also works for delegated submit/change on dynamically added forms
document.addEventListener('submit', (e) => {
  if (e.target.matches('form.ajax-form')) handleAjaxSubmit(e);
});
```

Source: https://developer.mozilla.org/en-US/docs/Web/API/Element/closest

---

## Common Task Patterns — auto-fill, data extraction, keyboard shortcuts

Portable snippets for tasks in the skill's activation contract. Full APIs on MDN.

### Auto-fill forms

```javascript
function autoFill(values) {
  for (const [sel, val] of Object.entries(values)) {
    const el = document.querySelector(sel);
    if (!el) continue;
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
autoFill({ '#email': 'user@example.com', '#name': 'John Doe' });
```
See MDN `HTMLInputElement.value` / `Event`.

### Extract data — tables and links

```javascript
function tableToArray(sel) {
  const t = document.querySelector(sel); if (!t) return [];
  const headers = [...t.querySelectorAll('th')].map(th => th.textContent.trim());
  return [...t.querySelectorAll('tbody tr')].map(tr => {
    const cells = [...tr.querySelectorAll('td')];
    return Object.fromEntries(cells.map((c, i) => [headers[i] || `col${i}`, c.textContent.trim()]));
  });
}
function extractLinks(sel = 'a[href]') {
  return [...document.querySelectorAll(sel)].map(a => ({ text: a.textContent.trim(), href: a.href, title: a.title }));
}
```
See MDN `HTMLTableElement` / `Document.querySelectorAll`.

### Keyboard shortcuts

```javascript
document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, [contenteditable]')) return;
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); saveAction(); }
});
```
See MDN `KeyboardEvent.key` / `EventTarget.addEventListener`.

---

## Storage Caching Patterns (as of Greasemonkey 4+, Violentmonkey 2.12+, verified 2026-08-25 — https://wiki.greasespot.net/GM.getValue, https://wiki.greasespot.net/GM_getValue, https://violentmonkey.github.io/api/gm/#gm_getvalue, https://violentmonkey.github.io/api/gm/#gm)

Portable divergence: `GM_getValue`/`GM_setValue` are synchronous (TM/VM legacy); `GM.getValue`/`GM.setValue` are async promises (GM4+ only form, VM 2.12+ alias). Greasemonkey 4 stores strings/numbers/booleans only — `JSON.stringify` objects. Batch `GM.getValues`/`setValues` is TM 5.3+/VM 2.19.1+ only; `GM_addValueChangeListener` (`remote` flag) is TM/VM only, absent in GM4+/Safari. See [managers.md](managers.md) §2 for the normative storage matrix.

Batch and cache — repeated `GM_getValue` on every mutation is slow (Greasespot: "Doing many gets/many sets can be slow"); keep an in-memory mirror, debounce writes, and sync across tabs via `GM_addValueChangeListener` where available:

```javascript
let cache = {};
let saveTimer;
async function loadCache(defaults) {
  if (typeof GM !== 'undefined' && GM.getValue) {
    const entries = await Promise.all(Object.entries(defaults).map(async ([k, d]) => [k, await GM.getValue(k, d)]));
    cache = Object.fromEntries(entries);
  } else {
    for (const [k, d] of Object.entries(defaults)) cache[k] = GM_getValue(k, d);
  }
}
function queueSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (typeof GM !== 'undefined' && GM.setValue) {
      Promise.all(Object.entries(cache).map(([k, v]) => GM.setValue(k, v)));
    } else {
      for (const [k, v] of Object.entries(cache)) GM_setValue(k, v);
    }
  }, 100);
}
if (typeof GM_addValueChangeListener !== 'undefined') {
  GM_addValueChangeListener((name, oldVal, newVal) => { cache[name] = newVal; });
}
```

Sources: https://wiki.greasespot.net/GM_getValue, https://wiki.greasespot.net/GM.getValue, https://violentmonkey.github.io/api/gm/#gm-getvalue, https://violentmonkey.github.io/api/gm/#gm-addvaluechangelistener
