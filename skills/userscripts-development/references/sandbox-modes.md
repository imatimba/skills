# Sandbox Modes

Understanding script execution contexts and security sandboxing. Normative guidance is manager-agnostic; Violentmonkey is the worked example where a concrete UI path is needed. For verified per-manager facts see [managers.md](managers.md) §4.

---

## Overview

Userscript managers can inject userscripts into different execution contexts (worlds). The context affects:
- What the script can access
- Security isolation
- CSP (Content Security Policy) restrictions
- How to communicate with the page

---

## Execution Worlds

### MAIN_WORLD (Page Context)

Script runs in the same context as the page's JavaScript.

- **Implemented as:** Tampermonkey `@sandbox raw` or Violentmonkey/Safari `@inject-into page` (page world). Greasemonkey 4+ and Safari-with-grants never use this world. (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?locale=en&q=sandbox, https://violentmonkey.github.io/api/metadata-block/)
- **Pros:** Direct access to page variables and functions; no need for `unsafeWindow`; can modify page objects directly.
- **Cons:** Subject to page's CSP; can be detected by the page; security risks if page is malicious.

### ISOLATED_WORLD (Content Script Context)

Script runs in an isolated context, separate from the page.

- **Implemented as:** Tampermonkey `@sandbox DOM` or Violentmonkey/Safari `@inject-into content` (isolated/content world). Safari forces this world whenever any `@grant` is present. Greasemonkey 4+ always uses a sandboxed isolated world (Xray vision). (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?locale=en&q=sandbox, https://violentmonkey.github.io/api/metadata-block/, https://wiki.greasespot.net/Greasemonkey_Manual:Environment)
- **Pros:** Protected from page scripts; can't be detected easily; safer execution.
- **Cons:** Cannot directly access page variables — requires `unsafeWindow` bridge (unavailable in Safari) or DOM-only approach; some page APIs need explicit bridging.
- **Clarification on `unsafeWindow` vs page vars:** In an isolated world, `window` is the sandbox's window, not the page's. Page variables (`window.pageVariable`) are `undefined` without a bridge. `unsafeWindow` (where available — Tampermonkey with explicit `@grant unsafeWindow`, Violentmonkey without grant before 2.32 and with grant handling after, Greasemonkey 4+ provides `unsafeWindow` but it is Xray-wrapped — page-defined properties require `window.wrappedJSObject`, sharing requires `cloneInto`/`exportFunction` per [MDN Sharing objects with page scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Sharing_objects_with_page_scripts)) provides a reference to the page's `window`. In Safari, `unsafeWindow` does not exist — design DOM-only.

### USERSCRIPT_WORLD (Tampermonkey `JavaScript` — Firefox Only; Chrome platform `USER_SCRIPT` separate)

Special context created for userscripts, with enhanced capabilities.

- **Implemented as:** Tampermonkey's `@sandbox JavaScript` creates a Firefox-only `USERSCRIPT_WORLD` (falls back to `raw` on other browsers) and Greasemonkey 4+ internals run in a Firefox sandboxed world. Chrome 120+ separately exposes a platform-level `USER_SCRIPT` world via the `chrome.userScripts` API (`ExecutionWorld.MAIN` | `USER_SCRIPT`; `USER_SCRIPT` exempt from page CSP) which is NOT controlled by `@sandbox`/`@inject-into`. Safari/WebKit exposes no equivalent userscript world. (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?locale=en&q=sandbox, https://developer.chrome.com/docs/extensions/reference/api/userScripts)
- **Pros:** Bypasses CSP; better isolation than MAIN_WORLD; supports `document-start` timing reliably in Firefox.
- **Cons:** Firefox only; need `cloneInto`/`exportFunction` for page communication.
- **Chrome 120+ note (verified 2026-08-25):** Chrome MV3 separately requires the extension to request the `userScripts` permission plus host permissions AND the user to enable a toggle — Developer Mode (< Chrome 138) or Allow User Scripts per-extension (≥ Chrome 138). `USER_SCRIPT` is exempt from the page's CSP via `chrome.userScripts.configureWorld({ csp: ... })`; Tampermonkey's Settings → Advanced → Content Script API selector chooses whether it injects via content-script or via the `userScripts` API. Sources: https://developer.chrome.com/docs/extensions/reference/api/userScripts, https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts/ExecutionWorld.

---

## Injection directives (manager-specific)

Each manager exposes its own directive; none is universal. Use the one your target manager honors.

| Intent | Tampermonkey (`@sandbox`, Tampermonkey 4.18+) | Violentmonkey / Safari (`@inject-into`) | Greasemonkey 4+ |
|--------|-----------------------------------------------|------------------------------------------|----------------|
| Full page context (MAIN_WORLD) | `raw` (Tampermonkey default) | `page` | n/a — always sandboxed |
| Need `unsafeWindow` / may use user-script world | `JavaScript` | `auto` (Violentmonkey default — tries `page`, falls back to `content`) | n/a |
| DOM-only, most isolated | `DOM` | `content` (forced in Safari when any `@grant` exists) | Always sandboxed (Xray vision) |

- Tampermonkey honors `@sandbox` and ignores `@inject-into`.
- Violentmonkey and Safari honor `@inject-into` and ignore `@sandbox`.
- Greasemonkey 4+ ignores both directives (always sandboxed).
- Values are not 1:1 equivalents — each manager enforces its own fallback and CSP behavior. See [managers.md](managers.md) §4 and [header-reference.md](header-reference.md).

> **Injection directive defaults (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?locale=en&q=sandbox, https://violentmonkey.github.io/api/metadata-block/, https://violentmonkey.github.io/posts/inject-into-context/):** `@sandbox` defaults to `raw` (Tampermonkey); `@inject-into` defaults to `auto` (Violentmonkey). `raw`/`page` = MAIN_WORLD, `DOM`/`content` = ISOLATED_WORLD, `JavaScript`/`auto` = conditional as tabled.

```javascript
// Tampermonkey — page context
// @sandbox      raw
console.log(window.pageVariable); // direct access

// Tampermonkey — need unsafeWindow, may use USERSCRIPT_WORLD (Firefox)
// @sandbox      JavaScript
console.log(unsafeWindow.pageVariable);

// Tampermonkey — DOM only
// @sandbox      DOM
document.querySelector('#element').textContent = 'Modified';

// Violentmonkey — force page world (subject to page CSP; falls back to content on failure)
// @inject-into  page

// Violentmonkey — default: try page, fall back to content automatically
// @inject-into  auto

// Violentmonkey / Safari — force isolated/content world
// @inject-into  content
document.querySelector('#element').textContent = 'Modified';
// Access page via unsafeWindow where available (not in Safari):
// console.log(unsafeWindow.pageVariable);

// Greasemonkey 4+ — no directive needed; always isolated
// (no header required)
```

---

## @grant none

Disables or minimizes the sandbox depending on manager. `GM_info` / `GM.info` remains available in all cases without a grant.

| Declaration | Tampermonkey | Violentmonkey ≥2.32 | Greasemonkey 4+ / Safari |
|-------------|--------------|---------------------|---------------------------|
| No `@grant` line | Sandbox **enabled** — GM APIs require explicit `@grant` per API | Minimal sandbox — only `GM_info` + `unsafeWindow` available | Sandbox enabled — Greasemonkey 4+ requires `@grant` per promise API; Safari forced content world if any grant exists, but no-grant and `none` are equivalent |
| `@grant none` | Sandbox **disabled** — runs in page context; no `GM_*`/`GM.*` except `GM_info` | Full page context — no sandbox; no `GM_*`/`GM.*` except `GM_info` | Equivalent to no-grant (both keep sandbox/content-world) |
| `@grant GM.getValue` etc. | Sandbox enabled — listed APIs exposed | Sandbox enabled — listed APIs exposed | Sandbox enabled — promise APIs exposed |

> **@grant none / no-grant sandbox (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?locale=en&q=grant, https://violentmonkey.github.io/api/metadata-block/):** No `@grant` line: Tampermonkey sandbox enabled; Violentmonkey ≥2.32 minimal sandbox (`GM_info` + `unsafeWindow`), <2.32 assumed `none` (no sandbox); Greasemonkey/Safari always sandboxed/content-world. `@grant none` disables sandbox where supported (Tampermonkey, Violentmonkey ≥2.32) — only `GM_info` remains.

```javascript
// @grant none — Tampermonkey: page context, Violentmonkey ≥2.32: page context, Greasemonkey 4+/Safari: no extra privilege

// Runs in page context where sandbox is disabled (TM / VM ≥2.32)
// No GM_* functions available (except GM_info / GM.info)
console.log(window.pageVariable);  // Direct access where page context applies
console.log(typeof GM_info !== 'undefined' ? GM_info.script.version : GM.info.script.version);
```

> **unsafeWindow matrix — precise (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?locale=en&q=grant, https://violentmonkey.github.io/api/metadata-block/, https://violentmonkey.github.io/api/gm/, https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Sharing_objects_with_page_scripts, https://github.com/quoid/userscripts/issues/252):** Tampermonkey requires explicit `// @grant unsafeWindow` to expose it; Violentmonkey < 2.32 disabled sandbox when no `@grant` was present so `unsafeWindow === window` with no grant needed, ≥ 2.32 exposes `unsafeWindow` in a minimal sandbox (`GM_info` + `unsafeWindow`) even with no `@grant`; Greasemonkey 4+ provides `unsafeWindow` but it is Xray-wrapped — page-defined expando properties require `window.wrappedJSObject` and sharing requires `cloneInto`/`exportFunction` (see Firefox section). Safari/Userscripts has no `unsafeWindow` (open issue #252, verified 2026-08-25).

> **Privileged window APIs — grant-gated (verified 2026-08-25):** `window.close`, `window.focus`, and `window.onurlchange` are not `GM_*` but still require explicit grants: `// @grant window.close` (Tampermonkey, Violentmonkey ≥2.6.2) and `// @grant window.focus` (Tampermonkey, Violentmonkey ≥2.12.10) / `// @grant window.onurlchange` (Tampermonkey). Without the grant the call is silently ignored or throws. Sources: https://www.tampermonkey.net/documentation.php?locale=en&q=grant, https://violentmonkey.github.io/api/metadata-block/.

> **Safari page-context limit (verified 2026-08-25):** As of quoid/userscripts issue #265, `content` is the default (`auto`/`page` reverted to `content` when any `@grant` is present); users can still force `page` but “GM APIs are only available when using content” — page context has no `GM_*`/`GM.*` access. Sources: https://github.com/quoid/userscripts/issues/265.

**When to use:**
- Simple scripts that don't need `GM_*` / `GM.*` APIs
- Direct page integration needed
- Smallest footprint

**What you lose (where sandbox is disabled):**
- All `GM_*` / `GM.*` functions (except `GM_info`)
- Cross-origin `GM.xmlHttpRequest`
- Persistent `GM.*Value` storage
- CSP bypass that the isolated/user-script worlds provide

---

## Firefox: cloneInto and exportFunction

When running in USERSCRIPT_WORLD (Firefox), you need special functions to share data with the page.

### cloneInto

Clone an object so the page can access it.

```javascript
// Share data with page
const data = { name: 'John', count: 42 };
unsafeWindow.myData = cloneInto(data, unsafeWindow);

// Clone with functions
const obj = { getValue: () => 42 };
unsafeWindow.myObj = cloneInto(obj, unsafeWindow, { cloneFunctions: true });
```

### exportFunction

Export a function so the page can call it.

```javascript
// Export a function
function myHandler(arg) {
    console.log('Called with:', arg);
    return 'response';
}

unsafeWindow.myHandler = exportFunction(myHandler, unsafeWindow);

// Page can now call: myHandler('hello')
```

> **Xray unwrapping — transitive; rewrap and Promise limit (verified 2026-08-25):** `window.wrappedJSObject` unwrapping is transitive — every property of the unwrapped object is itself unwrapped and therefore untrusted. Rewrap once you have the object you need: `XPCNativeWrapper(window.wrappedJSObject.foo)`. A `Promise` cannot be cloned directly via `cloneInto` (structured-clone algorithm does not support `Promise`); use `new window.Promise((resolve) => { const val = {…}; resolve(cloneInto(val, window)); })` instead (see MDN Promise cloning section). Sources: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Sharing_objects_with_page_scripts.

### Complete Example

```javascript
// Tampermonkey on Firefox: @sandbox JavaScript
// Violentmonkey on Firefox: @inject-into auto or page

// Async APIs preferred — works in Greasemonkey 4+ as well
// @grant        GM.getValue
// @grant        GM.setValue

// Create an API for the page
const scriptAPI = {
    version: '1.0.0',
    getData: async function () {
        return GM.getValue('data', null);
    },
    setData: async function (data) {
        await GM.setValue('data', data);
    }
};

// Export to page
if (typeof cloneInto !== 'undefined') {
    // Firefox USERSCRIPT_WORLD — need to export
    unsafeWindow.ScriptAPI = cloneInto(scriptAPI, unsafeWindow, {
        cloneFunctions: true
    });
} else {
    // Chrome or MAIN_WORLD — direct assignment works (unsafeWindow available in TM/VM, not Safari)
    if (typeof unsafeWindow !== 'undefined') {
        unsafeWindow.ScriptAPI = scriptAPI;
    }
}
```

### Legacy wrapper: `@unwrap` (verified 2026-08-25)

Greasemonkey ≤0.9 wrapped every userscript in an anonymous function `(function(){ /* script */ })()` to avoid collisions with the sandbox; `var` and function declarations stayed local, unqualified `i = 5` landed on the sandbox global (`this`) not `window`. `// @unwrap` disabled that wrapper (debug-only, strongly discouraged). As of Greasemonkey 1.0 (2012-08-24) unwrapped is the default and `@unwrap` is obsolete; Violentmonkey still records `unwrap?: boolean` in `GM_info.script.unwrap` for compatibility. Sources: https://wiki.greasespot.net/Greasemonkey_Manual:Environment.

---

## Content Security Policy (CSP)

### What CSP Blocks

CSP can prevent:
- Inline `<script>` tags
- `eval()` and `new Function()`
- Inline event handlers
- Loading scripts from non-whitelisted domains

### How Managers Handle CSP (see [managers.md](managers.md) §4)

| Context | Tampermonkey | Violentmonkey | Greasemonkey 4+ / Safari |
|---------|--------------|---------------|---------------------------|
| MAIN_WORLD / `page` | No bypass — subject to page CSP; may relax headers in some modes (do NOT rely on it) | Respects page CSP — injection may fail and fall back to `content` | n/a (page world not used) |
| ISOLATED_WORLD / `content` | Partial — script runs, but injected `<script>` may still be blocked | Script runs isolated; injected scripts still subject to CSP | Subject to Firefox sandbox rules / Content world only |
| USERSCRIPT_WORLD | Yes — bypasses CSP (Firefox) | Yes on Firefox | Firefox sandbox rules |

> **Chrome MV3 vs Firefox CSP nuance (verified 2026-08-25):** Violentmonkey's documented “injection fails in Firefox on sites with strict CSP” is Firefox-specific (page-context → content fallback). Chrome MV3 has a distinct split: content scripts run in an isolated world but opaque `<script>` injection is still page-CSP-bound; `USER_SCRIPT` world (Chrome 120+ `chrome.userScripts` / `ExecutionWorld.USER_SCRIPT`) is exempt from the page's CSP via `configureWorld({ csp })`. Sources: https://developer.chrome.com/docs/extensions/reference/api/userScripts, https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts, https://violentmonkey.github.io/posts/inject-into-context/.

**Use `GM_addElement` / `GM.addElement` instead of `createElement` for scripts:**

```javascript
// This may be blocked by CSP:
const script = document.createElement('script');
script.textContent = 'console.log("blocked")';
document.head.appendChild(script);

// This bypasses CSP where supported (Tampermonkey, Violentmonkey):
GM_addElement('script', {
    textContent: 'console.log("works")'
});
// Promise form (Violentmonkey ≥2.13.1, Tampermonkey):
// await GM.addElement('script', { textContent: '...' });
```

> **blob: vs data: nuance (verified 2026-08-25):** `GM.getResourceURL(name)` returns a `blob:` URL by default (short, cacheable) or a `data:` URL when `isBlobUrl=false` (long, synchronous decode). On strict CSP sites that forbid `blob:` or `data:`, resource URLs may still be blocked. Workaround in Chrome is `GM_addElement`/`GM.addElement`; in Firefox you must disable CSP via `about:config` or an extension that modifies headers. Sources: https://violentmonkey.github.io/api/gm/ (GM_getResourceURL / GM_addElement docs).

**Use `@require` for external scripts:**

```javascript
// Instead of dynamically loading scripts, use @require
// @require https://code.jquery.com/jquery-3.6.0.min.js
```

---

## Tampermonkey: Content Script API Setting — Tampermonkey-only (Chrome MV3 modes)

This setting exists **only in Tampermonkey's dashboard (Settings → Advanced)**. Violentmonkey, Greasemonkey 4+, and Safari expose nothing equivalent.

Tampermonkey on Chrome MV3 exposes three injection modes:

### Content Script (Default)

- Scripts injected via content script API
- Retrieved via messaging
- No true `document-start` support in this mode

### UserScripts API

- Uses browser's UserScripts API
- Chrome: via messaging, no `document-start`
- Firefox: instant execution, `document-start` works

### UserScripts API Dynamic

- Both wrapper and script injected via API
- True `document-start` support
- Most compatible on supporting browsers

Other managers: no comparable toggle. Violentmonkey handles world selection per script via `@inject-into`; Greasemonkey 4+ always sandboxed; Safari always content-world when grants exist.

> **Document-start reliability (verified 2026-08-25):** Tampermonkey `@run-at document-start` only reliably fires early when using Firefox with UserScripts API or UserScripts API Dynamic (Chrome's UserScripts API is message-based and has no true `document-start`). Violentmonkey on MV2 needs the default `page` mode plus Synchronous page mode (Chrome/Firefox) or Alternative page mode (Firefox-only, on by default), non-incognito, cookies not blocked for the site, and the site's CSP not blocking the inline injection — otherwise `document-start` degrades to `document-end`/`document-body`. Sources: https://www.tampermonkey.net/documentation.php?locale=en&q=content_script_api, https://violentmonkey.github.io/api/metadata-block/ (@run-at document-start / Synchronous page mode note).

---

## Detecting the Current Context

```javascript
// Check if in Firefox USERSCRIPT_WORLD
const isFirefoxUserScriptWorld = typeof cloneInto !== 'undefined';

// Tampermonkey — GM_info.sandboxMode (Tampermonkey 4.18+): 'js' | 'raw' | 'dom'
// Violentmonkey — GM_info.injectInto (`auto` | `page` | `content`)
// Greasemonkey 4+ / Safari — neither field is defined; feature-detect instead
const tmSandbox = typeof GM_info !== 'undefined' ? GM_info.sandboxMode : undefined;
const vmInjectInto = typeof GM_info !== 'undefined' ? GM_info.injectInto : undefined;

// Feature-detect, don't branch on string names alone
if (tmSandbox) {
    console.log('Tampermonkey sandboxMode:', tmSandbox);
} else if (vmInjectInto) {
    console.log('Violentmonkey injectInto:', vmInjectInto);
} else {
    console.log('Sandbox mode not exposed — assume isolated/content world or Greasemonkey 4+/Safari');
}

// Check if page objects are directly accessible (only true in page/MAIN_WORLD)
const hasDirectAccess = typeof unsafeWindow !== 'undefined'
    ? typeof unsafeWindow.somePageVariable !== 'undefined'
    : false;
```

> **Firefox `globalThis` vs `window` (verified 2026-08-25):** In regular web pages `globalThis === window`, but in Firefox content scripts `globalThis` is a distinct object inheriting from `window`. The difference is usually invisible except when a global shadows a standard API (e.g., `structuredClone`) — `window.structuredClone` vs `globalThis.structuredClone` may diverge. Prefer `window.*` for page-bridge checks and feature-detect `window.structuredClone` vs `window.wrappedJSObject`. Source: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts (Content script environment — Xray vision / globalThis note).

---

## Best Practices

### 1. Start isolated — add page access only when needed

- **Violentmonkey / Safari:** start with `@inject-into content` (isolated/content world).
- **Tampermonkey:** start with `@sandbox DOM` (isolated).
- This is the safest default — DOM manipulation works everywhere without exposing page scope.

```javascript
// Violentmonkey / Safari — most isolated
// @inject-into  content

// Tampermonkey — most isolated
// @sandbox      DOM
```

### 2. When you need page JavaScript

- **Violentmonkey:** `@inject-into page` (full page context) or `auto` if you want fallback.
- **Tampermonkey:** `@sandbox raw` (MAIN_WORLD) or `@sandbox JavaScript` + `unsafeWindow` bridge.
- **Safari:** no page-world access — design without it (DOM-only or `GM.*` APIs).
- **Greasemonkey 4+:** use `wrappedJSObject` / `cloneInto` / `exportFunction` bridge from the sandboxed world.

```javascript
// Violentmonkey — full page access
// @inject-into  page
console.log(window.pageVariable); // direct

// Tampermonkey — via unsafeWindow
// @sandbox      JavaScript
// @grant        unsafeWindow
console.log(unsafeWindow.pageVariable);

// Greasemonkey 4+ / Firefox — wrappedJSObject
// console.log(window.wrappedJSObject.pageVariable);
```

### 3. Handle cross-browser differences

```javascript
// Works in all contexts where unsafeWindow exists (not Safari)
function shareWithPage(name, value) {
    if (typeof unsafeWindow === 'undefined') {
        console.warn('unsafeWindow not available — page bridge not possible on this manager');
        return;
    }
    if (typeof cloneInto !== 'undefined') {
        // Firefox USERSCRIPT_WORLD
        unsafeWindow[name] = cloneInto(value, unsafeWindow, {
            cloneFunctions: true
        });
    } else {
        // Chrome or MAIN_WORLD
        unsafeWindow[name] = value;
    }
}
```

### 4. Test in multiple browsers

Different managers handle CSP, timing, and world selection differently. Test in at least:
- Chrome with Violentmonkey and Tampermonkey (noting MV3 differences)
- Firefox with Violentmonkey / Greasemonkey 4+ / Tampermonkey
- Safari with Userscripts app if you target Safari — confirm content-world-only limits
