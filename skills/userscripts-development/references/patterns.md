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

- **Default sandbox (verified 2026-08-25 — https://violentmonkey.github.io/api/gm/#unsafewindow, https://www.tampermonkey.net/documentation.php?locale=en&q=grant):** Tampermonkey and Violentmonkey run scripts **sandboxed** by default. `window` inside a userscript is a wrapper — `window.foo = 123` stays script-scoped unless you use `unsafeWindow` (Violentmonkey API docs: "confines modifications like window.foo = 123 to this script's scope"). Disable only with `// @grant none` — then no GM APIs are available except `GM_info`/`GM.info` (Tampermonkey docs: "In case @grant is followed by none the sandbox is disabled. In this mode no GM* function but the GM_info property will be available"). Violentmonkey mirrors this; before v2.32 missing `@grant` also disabled the sandbox.
- **`unsafeWindow` (requires `// @grant unsafeWindow`):** Access page globals (`unsafeWindow.myAppState`) without leaving the sandbox. Avoid calling untrusted functions on it directly — see Greasespot `UnsafeWindow` security warning (verified 2026-08-25 — https://wiki.greasespot.net/UnsafeWindow).
- **`@inject-into` (Violentmonkey as of 2.10.0, verified 2026-08-25 — https://violentmonkey.github.io/api/metadata-block/#inject-into):** `page` (runs in page context, `unsafeWindow === window`), `content` (extension content-script context, DOM-only, no page JS access), `auto` (default: try page, fallback to content when blocked by CSP). Reflected in `GM_info.injectInto`.
- **Firefox Xray vision — `cloneInto` / `exportFunction`:** Content-script scope in Firefox hides page expandos and redefined natives. To share with page scope use `cloneInto(obj, window, { cloneFunctions: true })` and `exportFunction(fn, window, { defineAs: "name" })` (MDN "Sharing objects with page scripts", verified 2026-08-25 — https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Sharing_objects_with_page_scripts). Prefer `wrappedJSObject` only transiently — rewrap with `XPCNativeWrapper`.
- **IIFE isolation:** Wrap entry in `(function () { 'use strict'; /* ... */ })();` to avoid leaking globals across `@require` files even inside the sandbox.

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

### Wait for Multiple Elements

```javascript
async function waitForElements(selectors, timeout = 10000) {
    const results = {};
    await Promise.all(selectors.map(async selector => {
        results[selector] = await waitForElement(selector, timeout);
    }));
    return results;
}

// Usage
const elements = await waitForElements(['#header', '#footer', '.sidebar']);
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

### Alternative Observers: IntersectionObserver and PerformanceObserver (verified 2026-08-25 — https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver, https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver)

- **`IntersectionObserver`** — Baseline Widely available since March 2019 (verified 2026-08-25 — https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver): observe visibility/lazy-load via a sentinel instead of polling DOM. Preferred when you only need "element entered viewport" — cheaper than `MutationObserver` subtree on `document.body`.
- **`PerformanceObserver`** — Baseline Widely available since January 2020 (verified 2026-08-25 — https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver): observe `mark`/`measure`/`resource` entries rather than inferring load from mutations. API: `new PerformanceObserver(cb).observe({ entryTypes: ["resource", "mark"] })`. Listed in MDN "See also" alongside `MutationObserver`.
- Also consider `ResizeObserver` for element resize. See MDN pages for each observer.

Sources: https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver, https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver

### Observe Error Handling and Flush (verified 2026-08-25 — https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe, https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/takeRecords)

- **`observe()` throws `TypeError`** if no `childList`, `attributes`, or `characterData` is `true` (MDN `MutationObserver.observe`: "At a minimum, one of childList, attributes, and/or characterData must be true... Otherwise, a TypeError will be thrown"). Guard options or feature-detect before calling.
- **Flush pending records:** pending mutations are discarded on `disconnect()` unless you call `takeRecords()` first. Pattern for teardown:

```javascript
let pending = observer.takeRecords();
observer.disconnect();
if (pending.length) handleMutations(pending);
```

See MDN `MutationObserver.takeRecords`: "most common use case... immediately prior to disconnecting" (verified 2026-08-25 — https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/takeRecords). Shadow roots must be observed separately — `document.body` subtree does not enter `shadowRoot`.

Sources: https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe, https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/takeRecords

### Observer Lifetime and Memory (verified 2026-08-25 — https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/disconnect)

- Subtree observers on `document.body` retain every added node until handled — on large SPAs N concurrent `waitForElement` observers or a long-lived body observer can OOM. Prefer a single shared observer, and always clean up: `takeRecords()` + `disconnect()` + `clearTimeout` on route change or timeout. One `{ childList: true, subtree: true }` on body is cheaper than 10 independent ones.

---

## SPA Navigation Handling (verified 2026-08-25 — https://developer.mozilla.org/en-US/docs/Web/API/History/pushState, https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState, https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event, https://developer.mozilla.org/en-US/docs/Web/API/Window/hashchange_event, https://www.tampermonkey.net/documentation.php?locale=en&q=window#api:window.onurlchange, https://violentmonkey.github.io/api/matching/)

### URL Change Detection

SPAs change URL via `history.pushState`/`replaceState` without a full load. Detection must be manager-agnostic.

| Manager | `window.onurlchange` | Portable fallback | Notes |
|---------|----------------------|-------------------|-------|
| Tampermonkey | ✅ (`@grant window.onurlchange`; check `window.onurlchange === null` then `addEventListener('urlchange')`) | History patch works | Only manager implementing this event |
| Violentmonkey | ❌ declined (issue #1195) | History patch; also browser Navigation API (`window.navigation` `navigate` event, Baseline 2026 limited) or `@violentmonkey/url` (`VM.onNavigate`) | Do not feature-test for `onurlchange` as success path |
| Greasemonkey 4+ | ❌ | History patch | — |
| Safari | ❌ | History patch | — |

**Portable primary path — History API interception (works in all managers):**

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

See [managers.md](managers.md) §2 for SPA navigation matrix and alternatives (browser Navigation API `window.navigation`, `@violentmonkey/url` `VM.onNavigate`).

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

> **Route pattern version note (ES2018, verified 2026-08-25 — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions/Groups_and_backreferences):** The `(?<$1>[^/]+)` template uses **named capturing groups** (`(?<name>...)` + `match.groups`). This is ES2018+ — Baseline Widely available as of 2026-08-24 (MDN "Groups and backreferences"). On pre-2018 engines it throws `SyntaxError` at parse time. If you must support legacy, use unnamed groups `([^/]+)` and index access.

Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions/Groups_and_backreferences

> **Site-specific SPA events caveat (verified 2026-08-25 — https://violentmonkey.github.io/api/matching/, https://developer.mozilla.org/en-US/docs/Web/API/History_API/Working_with_the_History_API):** Events like YouTube `yt-navigate-finish`, GitHub `turbo:load`, or `pjax:end` are **page-internal, undocumented, and unverifiable** against first-party specs — they can change without notice. The portable history-API patch above (`pushState`/`replaceState` + `popstate`/`hashchange`, plus Tampermonkey `window.onurlchange` where available) is the reliable baseline. Violentmonkey docs note userscripts run only on hard navigations — soft SPA navigations must be observed. If you do listen to a site event, keep the history patch as fallback.

Source: https://violentmonkey.github.io/api/matching/ (SPA note), MDN History.

---

## Network Request Interception (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?locale=en&q=connect, https://violentmonkey.github.io/api/gm/#gm_xmlhttprequest)

- **Bypass CSP/CORS with `GM_xmlhttpRequest` / `GM.xmlHttpRequest` (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?locale=en&q=connect, https://violentmonkey.github.io/api/gm/#gm_xmlhttprequest):** Use the privileged XHR for cross-origin fetches without page CSP. Requires `// @grant GM_xmlhttpRequest` (or `GM.xmlHttpRequest`) **and** `// @connect <host>` per host (Tampermonkey `@connect` docs: accepts domain, `self`, `localhost`, `*`; both initial and final URLs checked). Add e.g. `// @connect api.example.com` + `// @connect self`. Works without page CORS headers.
- **Page-level monkey-patch for observation:** Wrap `fetch` and `XMLHttpRequest.prototype.open/send` to log or block page-initiated requests. For `fetch`, handle `Request` cloning and preserve `this`:

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

> **CSP / Trusted Types note (verified 2026-08-25 — https://developer.mozilla.org/en-US/docs/Web/API/Element/insertAdjacentHTML):** `insertAdjacentHTML` throws `TypeError` when the page enforces `require-trusted-types-for 'script'` without a default policy and you pass a plain string (MDN `Element.insertAdjacentHTML`: "Thrown if the property is set to a string when Trusted Types are enforced"). On such sites (common with strict CSP) use `TrustedHTML` via `trustedTypes.createPolicy` + `DOMPurify`, or fall back to `textContent`/`createElement`. Sampling via `typeof trustedTypes !== 'undefined'` before string injection.

Source: https://developer.mozilla.org/en-US/docs/Web/API/Element/insertAdjacentHTML

### Remove Elements

```javascript
function removeElements(selector) {
    document.querySelectorAll(selector).forEach(el => el.remove());
}

// Hide elements with CSS — portable with fallback (see below)
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

### Replace Text

```javascript
function replaceText(find, replace, root = document.body) {
    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    const textNodes = [];
    while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
    }

    textNodes.forEach(node => {
        if (node.nodeValue.includes(find)) {
            node.nodeValue = node.nodeValue.replace(new RegExp(find, 'g'), replace);
        }
    });
}

// Usage
replaceText('old term', 'new term');
```

---

## Form Enhancement

### Auto-Fill Forms

```javascript
function autoFill(fieldValues) {
    for (const [selector, value] of Object.entries(fieldValues)) {
        const field = document.querySelector(selector);
        if (field) {
            field.value = value;
            // Trigger change event for reactive frameworks
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
}

// Usage
autoFill({
    '#email': 'user@example.com',
    '#name': 'John Doe',
    'input[name="phone"]': '555-1234'
});
```

### Form Validation Enhancement

```javascript
function enhanceValidation(formSelector) {
    const form = document.querySelector(formSelector);
    if (!form) return;

    form.addEventListener('submit', (e) => {
        const email = form.querySelector('[type="email"]');
        const password = form.querySelector('[type="password"]');

        let valid = true;

        if (email && !email.value.includes('@')) {
            showError(email, 'Invalid email address');
            valid = false;
        }

        if (password && password.value.length < 8) {
            showError(password, 'Password must be at least 8 characters');
            valid = false;
        }

        if (!valid) {
            e.preventDefault();
        }
    });
}

function showError(field, message) {
    let error = field.nextElementSibling;
    if (!error || !error.classList.contains('field-error')) {
        error = document.createElement('span');
        error.className = 'field-error';
        error.style.color = 'red';
        field.parentNode.insertBefore(error, field.nextSibling);
    }
    error.textContent = message;
}
```

---

## Keyboard Shortcuts

### Simple Keyboard Handler

```javascript
document.addEventListener('keydown', (e) => {
    // Ignore when typing in inputs
    if (e.target.matches('input, textarea, [contenteditable]')) return;

    // Ctrl+Shift+S
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        saveAction();
    }

    // Alt+D
    if (e.altKey && e.key === 'd') {
        e.preventDefault();
        toggleDarkMode();
    }
});
```

### Keyboard Shortcut Manager

```javascript
const shortcuts = new Map();

function registerShortcut(combo, callback, description) {
    shortcuts.set(combo.toLowerCase(), { callback, description });
}

document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, [contenteditable]')) return;

    const parts = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');
    parts.push(e.key.toLowerCase());

    const combo = parts.join('+');
    const shortcut = shortcuts.get(combo);

    if (shortcut) {
        e.preventDefault();
        shortcut.callback();
    }
});

// Usage
registerShortcut('ctrl+shift+d', toggleDarkMode, 'Toggle dark mode');
registerShortcut('alt+s', openSettings, 'Open settings');
```

---

## Event Delegation (verified 2026-08-25 — https://developer.mozilla.org/en-US/docs/Web/API/Element/closest)

General delegation for dynamic content — one listener on a stable ancestor instead of per-node handlers.

```javascript
// One listener for all current and future ".post" elements (verified 2026-08-25 — https://developer.mozilla.org/en-US/docs/Web/API/Element/closest — Element.closest since April 2017)
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

- `Element.closest(selector)` traverses `e.target` and its parents until a match (Baseline Widely available, April 2017, MDN). Guards when `e.target` is a child icon inside a button.
- Prefer delegation over `querySelectorAll('.post').forEach(el => el.addEventListener(...))` when nodes are created after load.

Source: https://developer.mozilla.org/en-US/docs/Web/API/Element/closest

---

## Data Extraction

### Table to Array

```javascript
function tableToArray(tableSelector) {
    const table = document.querySelector(tableSelector);
    if (!table) return [];

    const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
    const rows = Array.from(table.querySelectorAll('tbody tr'));

    return rows.map(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        const obj = {};
        cells.forEach((cell, i) => {
            obj[headers[i] || `col${i}`] = cell.textContent.trim();
        });
        return obj;
    });
}

// Usage
const data = tableToArray('#results-table');
console.log(JSON.stringify(data, null, 2));
```

### Extract Links

```javascript
function extractLinks(selector = 'a[href]') {
    return Array.from(document.querySelectorAll(selector)).map(a => ({
        text: a.textContent.trim(),
        href: a.href,
        title: a.title || ''
    }));
}

// Filter external links
const externalLinks = extractLinks().filter(link =>
    !link.href.includes(location.hostname)
);
```

---

## Storage Caching Patterns (as of Greasemonkey 4+, Violentmonkey 2.12+, verified 2026-08-25 — https://wiki.greasespot.net/GM.getValue, https://wiki.greasespot.net/GM_getValue, https://violentmonkey.github.io/api/gm/#gm_getvalue, https://violentmonkey.github.io/api/gm/#gm)

- **Sync vs async (verified 2026-08-25 — https://wiki.greasespot.net/GM.getValue, https://violentmonkey.github.io/api/gm/#gm):** `GM_getValue`/`GM_setValue` are synchronous (Violentmonkey/Tampermonkey legacy); `GM.getValue`/`GM.setValue` are async promises in Greasemonkey 4+ and Violentmonkey aliases (VM 2.12.0+). Greasemonkey 4 wiki: `GM.getValue(name, defaultValue)` "Returns a Promise". Do not `await` the sync form; do not treat the promise form as sync.
- **Batch and cache (verified 2026-08-25 — https://wiki.greasespot.net/GM_getValue — "Doing many gets/many sets can be slow"):** Greasespot notes "Doing many gets/many sets can be slow. Instead get/set one value... or use Promise.all()". Repeated `GM_getValue` on every mutation is slow — keep an in-memory mirror, debounce writes, and sync across tabs via `GM_addValueChangeListener`:

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

Sources: https://wiki.greasespot.net/GM_getValue, https://wiki.greasespot.net/GM.getValue, https://violentmonkey.github.io/api/gm/#gm-getvalue, https://violentmonkey.github.io/api/gm/#gm-addvaluechangelistener (and Greasespot "Doing many gets/many sets" note)

---

## Performance Patterns (verified 2026-08-25 — https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback, https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver)

### Throttle Function

```javascript
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Usage
const throttledScroll = throttle(() => {
    console.log('Scrolled');
}, 100);

window.addEventListener('scroll', throttledScroll);
```

### Debounce Function

```javascript
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Usage
const debouncedSearch = debounce((query) => {
    console.log('Searching:', query);
}, 300);

input.addEventListener('input', (e) => debouncedSearch(e.target.value));
```

### Lazy Execution

```javascript
function lazyExecute(callback, delay = 0) {
    if ('requestIdleCallback' in window) {
        requestIdleCallback(callback);
    } else {
        setTimeout(callback, delay);
    }
}

// Usage - run non-critical code when browser is idle
lazyExecute(() => {
    console.log('Running low-priority task');
    collectAnalytics();
});
```

---

## Error Handling

### Safe Wrapper

```javascript
function safe(fn, fallback = null) {
    return function(...args) {
        try {
            return fn.apply(this, args);
        } catch (error) {
            console.error('Error in userscript:', error);
            return fallback;
        }
    };
}

// Usage
const safeParseJSON = safe(JSON.parse, {});
const data = safeParseJSON(maybeInvalidJSON);
```

### Retry Pattern

```javascript
async function retry(fn, maxAttempts = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === maxAttempts) throw error;
            console.log(`Attempt ${attempt} failed, retrying...`);
            await new Promise(r => setTimeout(r, delay * attempt));
        }
    }
}

// Usage
const data = await retry(() => fetchData(url), 3, 1000);
```
