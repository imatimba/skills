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
- **Bridge note:** In an isolated world, `window` is the sandbox's window, not the page's. Page variables need a bridge: `unsafeWindow` where available (Tampermonkey requires explicit `@grant unsafeWindow`; Greasemonkey Xray needs `wrappedJSObject`/`cloneInto`/`exportFunction` per [MDN Sharing objects with page scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Sharing_objects_with_page_scripts)); Safari has no `unsafeWindow` — design DOM-only.

### USERSCRIPT_WORLD (Tampermonkey `JavaScript` — Firefox Only; Chrome platform `USER_SCRIPT` separate)

Special context created for userscripts, with enhanced capabilities.

- **Implemented as:** Tampermonkey's `@sandbox JavaScript` creates a Firefox-only `USERSCRIPT_WORLD` (falls back to `raw` on other browsers) and Greasemonkey 4+ internals run in a Firefox sandboxed world. Chrome 120+ separately exposes a platform-level `USER_SCRIPT` world via the `chrome.userScripts` API (`ExecutionWorld.MAIN` | `USER_SCRIPT`; `USER_SCRIPT` exempt from page CSP) which is NOT controlled by `@sandbox`/`@inject-into`. Safari/WebKit exposes no equivalent userscript world. (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?locale=en&q=sandbox, https://developer.chrome.com/docs/extensions/reference/api/userScripts)
- **Pros:** Bypasses CSP; better isolation than MAIN_WORLD; supports `document-start` timing reliably in Firefox.
- **Cons:** Firefox only; need `cloneInto`/`exportFunction` for page communication.

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

When running in USERSCRIPT_WORLD (Firefox), you need special functions to share data with the page. See [MDN Sharing objects with page scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Sharing_objects_with_page_scripts).

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

Portable implication: feature-detect `cloneInto`/`exportFunction` — Firefox USERSCRIPT_WORLD needs them, other worlds use direct assignment. See Best Practices §3 for a portable helper.

---

## Content Security Policy (CSP)

CSP can block inline scripts, `eval`/`new Function`, inline handlers, and non-whitelisted resources — see [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP).

### How Managers Handle CSP (see [managers.md](managers.md) §4)

| Context | Tampermonkey | Violentmonkey | Greasemonkey 4+ / Safari |
|---------|--------------|---------------|---------------------------|
| MAIN_WORLD / `page` | No bypass — subject to page CSP; may relax headers in some modes (do NOT rely on it) | Respects page CSP — injection may fail and fall back to `content` | n/a (page world not used) |
| ISOLATED_WORLD / `content` | Partial — script runs, but injected `<script>` may still be blocked | Script runs isolated; injected scripts still subject to CSP | Subject to Firefox sandbox rules / Content world only |
| USERSCRIPT_WORLD | Yes — bypasses CSP (Firefox) | Yes on Firefox | Firefox sandbox rules |

For Chrome 120+ `USER_SCRIPT` CSP exemption and Firefox-specific fallback details, see [managers.md](managers.md) §4, [Chrome userScripts docs](https://developer.chrome.com/docs/extensions/reference/api/userScripts), and [Violentmonkey inject-into context](https://violentmonkey.github.io/posts/inject-into-context/).

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

**Use `@require` for external scripts:**

```javascript
// Instead of dynamically loading scripts, use @require
// @require https://code.jquery.com/jquery-3.6.0.min.js
```

---

## Tampermonkey: Content Script API Setting — Tampermonkey-only

This setting exists **only in Tampermonkey's dashboard (Settings → Advanced)**. Violentmonkey, Greasemonkey 4+, and Safari expose nothing equivalent.

On Chrome MV3, Tampermonkey's Content Script API selector (Content Script / UserScripts API / UserScripts API Dynamic) determines injection mechanism and `document-start` reliability — it is a per-user dashboard toggle, not a script-declarable header. Portable scripts must not rely on a specific mode; explicitly set `@run-at` and test across managers. See [managers.md](managers.md) §4, [Tampermonkey content_script_api docs](https://www.tampermonkey.net/documentation.php?locale=en&q=content_script_api), and [header-reference.md](header-reference.md).

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
