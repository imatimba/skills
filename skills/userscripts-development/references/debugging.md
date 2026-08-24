# Debugging Userscripts

How to troubleshoot and fix broken userscripts. Per-manager facts follow [managers.md](managers.md); when a concrete manager is shown, **Violentmonkey** is the worked example.

---

## Quick Diagnostic Checklist

When a script doesn't work, check these first — consolidated from the sections below:

```
[ ] 1. Is the script enabled in your manager's dashboard? (see Violentmonkey worked example below)
[ ] 2. Does the @match / @include pattern match the current URL? (log location.href)
[ ] 3. Are there errors in the console? (F12 on Windows/Linux, Cmd+Opt+J / Cmd+Opt+I on macOS/Safari — filter by script name)
[ ] 4. Are all required @grant statements present? ("GM_xxx is not defined" = missing @grant)
[ ] 5. Does @connect include all external domains? (Tampermonkey-enforced; advisory elsewhere)
[ ] 6. Is the element present when the script runs? (log element, waitForElement if needed)
[ ] 7. Is @run-at timing correct? (try document-idle or readyState check)
```

---

## Viewing Script Errors

### Browser Console (Recommended)

1. Open DevTools — **F12** (Windows/Linux) or **Cmd+Opt+I** (macOS) / **Cmd+Opt+J** for Console, **Safari: Cmd+Opt+I** → Web Inspector
2. Go to **Console** tab
3. Look for red error messages
4. Filter by **script name** (type the script name in the Console filter) rather than a magic string

### Userscript Manager Dashboard — Violentmonkey Worked Example

Violentmonkey is the worked example for concrete UI steps (manager-neutral guidance; other managers follow the Manager × Browser table below).

1. Open the **Violentmonkey Dashboard** — extension options page:
   - Chrome/Edge: `chrome-extension://<id>/options/index.html#/installed`
   - Firefox: `moz-extension://<id>/options/index.html#/installed`
   - Or click the Violentmonkey toolbar icon → **Dashboard**
2. Look for scripts with error indicators; click script name → **Editor** (CodeMirror modal with **Code / Settings / Storage** tabs) to see inline errors.
3. **External editing:** serve the file locally and let Violentmonkey track it:
   ```bash
   npx http-server -c5 .
   # open http://localhost:8080/script.user.js in browser, install, then enable "Track external edits" in dashboard
   ```
   The dashboard reloads the script on every save. See [managers.md](managers.md) §6 Violentmonkey workflow.

Other managers: Tampermonkey has its own dashboard/editor via toolbar icon; Greasemonkey 4+ uses `about:addons` → Greasemonkey; Safari "Userscripts" app uses Safari → Settings → Extensions. See the Manager × Browser table for debugging entry points.

### Logging: console.log vs GM_log (verified 2026-08-24)

- **Violentmonkey / Tampermonkey:** both `console.log` and `GM_log` work. `GM_log` is Tampermonkey-documented as "Log a message to the console" — https://www.tampermonkey.net/documentation.php?locale=en&q=GM_log — and Violentmonkey-typed as `GM_log(...args: any): void` — https://violentmonkey.github.io/types/functions/GM_log.html. Prefer `console.log` for object inspection (preserves structure); use `GM_log` only when you need Tampermonkey's grant-gated logger.
- **Greasemonkey 4.0+:** `GM_log` removed — "As of Greasemonkey 4.0, this method has been removed. You should use the console instead." — https://wiki.greasespot.net/GM_log (verified 2026-08-24). Use `console.log` only; `GM_log` will throw `ReferenceError`.
- Cross-manager portability: guard: `if (typeof GM_log !== 'undefined') GM_log('msg'); else console.log('msg');` or just use `console.log`.

### Tampermonkey Debug Logging Toggle (verified 2026-08-24)

Tampermonkey hides verbose logs unless enabled. Before expecting output: Dashboard → **Settings** tab → **Logging Level** → **Debug** ("Before getting the output you have to enable debug output. Just click at the Tampermonkey icon, choose \"Dashboard\", select the \"Settings\" tab and set \"Logging Level\" to \"Debug\"" — https://www.tampermonkey.net/faq.php?locale=en&q=Q600). In advanced Config mode this surfaces as **Debug scripts** (Dashboard → Settings → General → Config mode: Advanced → Debug scripts, as of TM 4.10+). Without this, `console.log` from userscripts may be suppressed in Tampermonkey's own consoles.

---

## Testing if Script Runs

### Method 1: Alert (Most Obvious)

```javascript
// ==UserScript==
// @name         Test Script
// @match        https://example.com/*
// ==/UserScript==

alert('Script is running!');  // Will definitely show if script loads
```

### Method 2: Console Log

```javascript
console.log('=== USERSCRIPT LOADED ===');
console.log('URL:', location.href);
console.log('Time:', new Date().toISOString());
```

### Method 3: Visual Indicator

```javascript
// @grant GM_addStyle

GM_addStyle(`
    body::before {
        content: 'Script Active';
        position: fixed;
        top: 0;
        right: 0;
        background: green;
        color: white;
        padding: 5px 10px;
        z-index: 999999;
        font-size: 12px;
    }
`);
```

---

## Common Error Messages

### "Cannot read property 'X' of null"

**Cause:** Element doesn't exist when script runs.

```javascript
// Error
document.querySelector('#missing').textContent = 'Hi';

// Fix: Check if element exists
const el = document.querySelector('#missing');
if (el) {
    el.textContent = 'Hi';
} else {
    console.log('Element not found');
}

// Better fix: Wait for element
waitForElement('#missing').then(el => {
    el.textContent = 'Hi';
});
```

### "GM_xxx is not defined"

**Cause:** Missing @grant statement.

```javascript
// Error - forgot @grant
GM_setValue('key', 'value');  // ReferenceError

// Fix - add @grant
// @grant GM_setValue
GM_setValue('key', 'value');  // Works
```

### "Access to XMLHttpRequest blocked by CORS"

**Cause:** Using native fetch/XHR instead of GM_xmlhttpRequest.

| Manager | Fix | Notes |
| --- | --- | --- |
| Tampermonkey | `GM_xmlhttpRequest` + `// @connect api.example.com` | `@connect` **enforced** — unlisted hosts prompt/block (initial + final URL) |
| Violentmonkey | `GM_xmlhttpRequest` + `// @connect api.example.com` | `@connect` declared but **not enforced** (still declare for Tampermonkey compat) |
| Greasemonkey 4+ | `await GM.xmlHttpRequest(...)` | No `@connect` needed; promise-only API |
| Safari "Userscripts" | `await GM.xmlHttpRequest(...)` | Runs in content world; `unsafeWindow` not available |

```javascript
// Error - blocked by CORS
fetch('https://api.example.com/data');

// Fix - use GM_xmlhttpRequest (Tampermonkey/Violentmonkey sync form)
// @grant GM_xmlhttpRequest
// @connect api.example.com  // TM-enforced; advisory elsewhere

GM_xmlhttpRequest({
    url: 'https://api.example.com/data',
    onload: (r) => console.log(r.responseText)
});

// Greasemonkey 4+ / Safari — promise form
// @grant GM.xmlHttpRequest
// @connect api.example.com
const response = await GM.xmlHttpRequest({ method: 'GET', url: 'https://api.example.com/data' });
console.log(response.responseText);
```

See [http-requests.md](http-requests.md) for the full option matrix and [managers.md](managers.md) §2 Networking for enforcement.

### "Content Security Policy" errors

**Cause:** Site's CSP blocks inline scripts.

| Manager | Behaviour | Fix |
| --- | --- | --- |
| Violentmonkey | **Respects page CSP** — no header stripping; page-world injection falls back to content world if CSP blocks it | `GM_addElement` helps only where page-world injection succeeds; otherwise design for content-world DOM |
| Tampermonkey | May **relax/strip CSP headers** in some modes (best-effort, do not rely on it) | `GM_addElement` may bypass CSP in Tampermonkey, but verify per page |
| Greasemonkey 4+ / Safari | No `GM_addElement` CSP bypass | Use content-world DOM; `GM_addElement` not supported |

Do NOT present `GM_addElement` as a universal bypass.

```javascript
// Error - may be blocked by CSP
const script = document.createElement('script');
script.textContent = 'console.log("blocked")';
document.head.appendChild(script);

// Tampermonkey / Violentmonkey — may bypass CSP where page-world injection succeeds
// @grant GM_addElement
if (typeof GM_addElement !== 'undefined') {
    GM_addElement('script', { textContent: 'console.log("via GM_addElement")' });
} else {
    // Greasemonkey/Safari fallback — still subject to CSP
    const s = document.createElement('script');
    s.textContent = 'console.log("fallback")';
    document.head.appendChild(s);
}
```

See [managers.md](managers.md) §4 Sandbox/CSP and [api-dom-ui.md](api-dom-ui.md) for `GM_addElement` support matrix.

---

## Debugging Techniques

### 1. Isolate the Problem

Comment out sections to find what's breaking:

```javascript
console.log('Step 1');
// doSomething();

console.log('Step 2');
// doSomethingElse();

console.log('Step 3');
// maybeBroken();  // Uncomment one at a time
```

### 2. Log Variables

```javascript
const element = document.querySelector('#target');
console.log('Element:', element);
console.log('Element exists:', !!element);
console.log('Element HTML:', element?.outerHTML);
```

### 3. Breakpoints

```javascript
// Pause execution here
debugger;

// Or set breakpoints in DevTools:
// 1. Open DevTools — F12 (Windows/Linux) or Cmd+Opt+I (macOS/Safari)
// 2. Find your script via the Manager × Browser path below (search for script name)
// 3. Click line number to set breakpoint
```

Per-manager breakpoint path — see the Manager × Browser Decision Table below. Summary:
- **Violentmonkey (Chrome/Firefox):** Sources → **Violentmonkey** tree; `@inject-into` controls realm.
- **Tampermonkey Chrome:** Sources → **Content Scripts**; Firefox: `about:debugging` → This Firefox → Tampermonkey → Inspect; console from sandbox appears in page console.
- **Greasemonkey 4+:** `about:debugging` → Extensions → Inspect.
- **Safari:** Web Inspector; GM only in content world.

### 4. Network Tab

For `GM_xmlhttpRequest` / `GM.xmlHttpRequest` issues:

1. Open DevTools → **Network** tab (F12 / Cmd+Opt+I → Network)
2. Look for your request
3. Check **Headers**, **Response**, **Timing** — red = failed

> **Caveat:** `GM_xmlhttpRequest` often runs **out-of-page via the manager** (especially in Tampermonkey/Violentmonkey) and **may NOT appear in the page Network tab**. Rely on `onload`/`onerror`/`ontimeout` logging as the ground truth. Any stronger claim about Network visibility is **UNVERIFIED** — verify against your manager's docs.

```javascript
GM_xmlhttpRequest({
    url: 'https://api.example.com/data',
    onload: (r) => console.log('Success:', r.status, r.responseText.substring(0, 200)),
    onerror: (e) => console.log('Error:', e),
    ontimeout: () => console.log('Timeout'),
    onabort: () => console.log('Aborted')
});
```

### 5. Test @match Pattern

```javascript
// Log when script runs to verify @match
console.log('Script matched:', location.href);

// Test pattern manually:
// @match https://example.com/*
// Should match: https://example.com/page
// Should NOT match: https://other.com/example.com
```

---

## Debugging Async Code

### Problem: Callback Not Firing

```javascript
GM_xmlhttpRequest({
    url: 'https://api.example.com/data',
    onload: (response) => {
        console.log('Response received');  // Never logs
    }
});

// Debug: Add all callbacks
GM_xmlhttpRequest({
    url: 'https://api.example.com/data',
    onload: (r) => console.log('Success:', r.status),
    onerror: (e) => console.log('Error:', e),
    ontimeout: () => console.log('Timeout'),
    onabort: () => console.log('Aborted')
});
```

### Problem: Promise Never Resolves

```javascript
// Stuck promise
const data = await someAsyncFunction();  // Never continues

// Debug: Add timeout
const data = await Promise.race([
    someAsyncFunction(),
    new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout after 10s')), 10000)
    )
]);
```

---

## Debugging Element Waiting

### Check if Element Ever Appears

```javascript
// Watch for element in console
const observer = new MutationObserver((mutations) => {
    const el = document.querySelector('#target');
    if (el) {
        console.log('FOUND:', el);
        observer.disconnect();
    }
});
observer.observe(document.body, { childList: true, subtree: true });

// After 30 seconds, report if not found
setTimeout(() => {
    if (document.querySelector('#target') === null) {
        console.log('Element never appeared after 30s');
        console.log('Current DOM:', document.body.innerHTML.substring(0, 1000));
    }
}, 30000);
```

---

## Debugging Storage

| Manager | API to use | Notes |
| --- | --- | --- |
| Tampermonkey | `GM_setValue` / `GM_getValue` (sync) **or** `GM.setValue` / `GM.getValue` (promise) | Both forms work |
| Violentmonkey | `GM_setValue` / `GM_getValue` (sync) **or** `GM.setValue` / `GM.getValue` (promise since 2.12.0) | Both forms work; worked example: Dashboard → script → **Storage** tab |
| Greasemonkey 4+ | `await GM.setValue` / `await GM.getValue` **only** | Sync `GM_*Value` removed in 4.0; values limited to strings/numbers/booleans — `JSON.stringify` objects |
| Safari "Userscripts" | `await GM.setValue` / `await GM.getValue` (promise subset) | `GM_listValues` / `GM_deleteValue` via `GM.*` promises where available |

### Verify Values Are Saved

```javascript
// Tampermonkey / Violentmonkey — sync
GM_setValue('test', { foo: 'bar' });
console.log('Saved (sync)');
const value = GM_getValue('test');
console.log('Retrieved:', value);
console.log('Type:', typeof value);
const keys = GM_listValues();
console.log('All keys:', keys);
```

```javascript
// Greasemonkey 4+ / Safari — promise (also works in TM/VM)
await GM.setValue('test', { foo: 'bar' });  // Greasemonkey: await GM.setValue('test', JSON.stringify({foo:'bar'}))
console.log('Saved (promise)');
const value = await GM.getValue('test');
console.log('Retrieved:', value);
const keys = await GM.listValues();
console.log('All keys:', keys);
```

### Clear Storage for Fresh Start

```javascript
// Tampermonkey / Violentmonkey — sync
GM_listValues().forEach(key => {
    console.log('Deleting:', key);
    GM_deleteValue(key);
});

// Promise — portable (Greasemonkey 4+ / Safari / TM / VM)
const keys = await GM.listValues();
for (const key of keys) {
    console.log('Deleting:', key);
    await GM.deleteValue(key);
}
```

See [api-storage.md](api-storage.md) for value-type rules and batch helpers (`GM_getValues`/`GM_setValues` since Tampermonkey 5.3+, Violentmonkey since 2.19.1).

---

## SourceURL, SourceMaps, Exception Breakpoints, and Console Realms (verified 2026-08-24)

### Debugger Source Naming via `//# sourceURL` (verified 2026-08-24)

Violentmonkey names each userscript with a synthetic `//# sourceURL=` suffix (`'\\n//# sourceURL=' + browser.extension.getURL(`${name}.user.js#${scriptId}`)` — https://github.com/Tampermonkey/tampermonkey/issues/831 comment, Violentmonkey behavior) so it appears as a distinct file under **Sources → Violentmonkey**. Tampermonkey MV3 uses `userscript.html?name=<encoded name>&id=<uuid>` (same issue). Add `debugger;` anywhere — DevTools pauses there even inside `eval` sources (https://firefox-source-docs.mozilla.org/devtools-user/debugger/how_to/debug_eval_sources/ — "The debugger will also stop at debugger; statements in unnamed eval sources").

### Inline SourceMaps (`//# sourceMappingURL`) and Wrapper Offsets (verified 2026-08-24)

If you bundle with `vite-plugin-monkey`, `webpack`, or `esbuild`, emit an inline `//# sourceMappingURL=data:application/json;base64,...` comment — Chrome DevTools (https://developer.chrome.com/docs/devtools/javascript/source-maps — "With source maps ready and enabled... breakpoints will automatically map") and Firefox Debugger (https://firefox-source-docs.mozilla.org/devtools-user/debugger/ — "Use a source map") will map minified/bundled code back to originals.

Known offset bug (verified 2026-08-24 via official repos): both Violentmonkey and Tampermonkey wrap userscript code before evaluation, shifting line numbers by N lines. This breaks sourcemap line mapping — "userscript sourcemap is mapping wrong variable" (https://github.com/violentmonkey/violentmonkey/issues/1616 and https://github.com/Tampermonkey/tampermonkey/issues/1621). As of VM 2.13.x / TM 4.18+ the wrapper offset differs per manager (VM 0 lines vs TM 2 lines reported in issue #1616 comments); `vite-plugin-monkey` exposes a `sourcemap offset` config to prefix `;` to `mappings` to compensate. Verify your bundler's offset for your target manager — do not assume universal alignment.

### Exception Breakpoints & Stack Traces (verified 2026-08-24)

Don't rely only on `console.log`. Use **Break on exceptions** (pause on caught/uncaught throws) and inspect stack traces:

- **Chrome/Edge:** Sources panel → right pane → **Breakpoints** → ☑ **Pause on exceptions** (and ☑ **Pause on caught exceptions**). See https://developer.chrome.com/docs/devtools/javascript/breakpoints — table row "Exception | Pause on the line of code that is throwing a caught or uncaught exception."
- **Firefox:** Debugger → toolbar → **Pause on exceptions** (icon with pause + exception). See https://firefox-source-docs.mozilla.org/devtools-user/debugger/ — "Break on exceptions" under Pause execution.

Stack traces then show the `sourceURL`-named userscript file, not just `VMXXX` eval frames.

### Console Realms: Where `console.log` Actually Appears (verified 2026-08-24)

- **Violentmonkey caveat (as of 2.20.0, verified 2026-08-24):** when `@inject-into page` + any `@grant` other than `none`, `console.log` from the sandbox may be **silent** in the page console — "console.log wont print anything for @grant non-nones" (https://github.com/violentmonkey/violentmonkey/issues/2143). Workaround: `unsafeWindow.console.log(...)` or switch `@inject-into` to `auto`/`content`. With `@grant none` (no sandbox) or `inject-into content/auto` the log appears in the page console as expected.
- **Tampermonkey 3 consoles (verified 2026-08-24 via https://www.tampermonkey.net/faq.php?locale=en&q=Q600):** **Background Context Console** (service-worker DevTools via `chrome://extensions` → Details → service worker / `about:debugging` → This Firefox → Inspect), **Option Page Console** (Dashboard tab's own DevTools), and **Web Page Console** (normal page DevTools). Userscript `console.log` under default sandbox appears in the **Web Page Console**, but errors thrown in the background context (e.g., GM_xmlhttpRequest failures managed out-of-page) may surface only in the Background console.

### Keep the Toolbox Closed When Testing Background Behavior (verified 2026-08-24)

FAQ Q600 notes for Firefox: "Keeping the Toolbox open prevents background scripts from unloading. Close it when testing is complete." and for Chrome/Edge/Opera: "Inspecting the service worker keeps it active. Always close DevTools afterward to test normal termination behavior." (same FAQ). If you leave `about:debugging` Toolbox or `chrome://extensions` service-worker DevTools open, background timeouts/unloads won't reproduce — close it before measuring lifecycle bugs.

---

## Browser-Specific Debugging — Manager × Browser Decision Table

| Manager | Browser | How to open script sources / debugger | Console / realm notes |
| --- | --- | --- | --- |
| **Violentmonkey** | Chrome / Edge | Add `debugger;` statement → DevTools (F12 / Cmd+Opt+I) → **Sources** → **Violentmonkey** tree | `@inject-into` (`auto`/`page`/`content`) controls realm; console from sandbox appears in page console; **respects page CSP** (no header stripping — falls back to content world if page injection fails) |
| **Violentmonkey** | Firefox | Same — `debugger;` → DevTools → Sources → **Violentmonkey** tree | Same; Firefox also exposes `wrappedJSObject`/`cloneInto` bridges |
| **Tampermonkey** | Chrome / Edge (MV3) | DevTools → **Sources** → **Content Scripts** → Tampermonkey | **May relax CSP headers** in some modes (best-effort); `GM_info.sandboxMode` (`js`/`raw`/`dom`) indicates world |
| **Tampermonkey** | Firefox (MV2) | `about:debugging` → **This Firefox** → **Tampermonkey** → **Inspect** | Console from sandbox appears in page console; MV2-only features differ (`GM_webRequest` Firefox-only) |
| **Greasemonkey 4+** | Firefox only | `about:debugging` → **This Firefox** → **Extensions** → Inspect (Greasemonkey) | **Async-only APIs** — every `GM_*` is `await GM.*`; `GM_log` removed — use `console.log` |
| **Safari "Userscripts"** | Safari (macOS/iOS) | **Safari Web Inspector** (Develop → Show Web Inspector; enable Develop menu in Safari → Settings → Advanced) | **GM only in content world**; any `@grant` forces content world; `scriptHandler === "Userscripts"`; `unsafeWindow` absent entirely |

> **Chrome DevTools-only features:** **Application → Storage** (extension storage) and **Snippets** (quick code test) are Chrome DevTools-only — not available in Firefox or Safari. Use them only when debugging in Chrome.

Platform keys: **Windows/Linux:** F12, Ctrl+Shift+I (DevTools), Ctrl+Shift+J (Console). **macOS:** Cmd+Opt+I (DevTools), Cmd+Opt+J (Console), Cmd+Opt+C (Inspect). **Safari:** Cmd+Opt+I (Web Inspector).

---

## Getting Help

If you can't solve the issue:

1. **Check the userscript manager's forums/help** — Search for similar issues
2. **Provide minimal reproduction** — Smallest script that shows the bug
3. **Include browser + manager + version** — Found in `GM_info` (see snippet below)
4. **Share console errors** — Copy the exact error message

```javascript
// Get debug info to share
console.log('Browser:', navigator.userAgent);
console.log('Manager:', GM_info.scriptHandler, GM_info.version);  // "Violentmonkey" | "Tampermonkey" | "Greasemonkey" | "Userscripts" + version
console.log('Script:', GM_info.script.name, GM_info.script.version);
```

See [managers.md](managers.md) §5 for runtime detection (`GM_info.scriptHandler` literals: `"Violentmonkey"` / `"Tampermonkey"` / `"Greasemonkey"` / `"Userscripts"`).

### GM_info for Realm & Platform Diagnosis (verified 2026-08-24)

When filing a bug, include realm/platform fields beyond `scriptHandler`:

```javascript
console.log('injectInto:', GM_info.injectInto); // Violentmonkey: "auto" | "page" | "content" — https://violentmonkey.github.io/api/gm/ — GM_info.injectInto
console.log('platform:', GM_info.platform);       // Violentmonkey: {arch, browserName, browserVersion, os, ...} — reliable vs spoofable navigator.userAgent — https://violentmonkey.github.io/api/gm/ — "Unlike navigator.userAgent, which can be overriden... GM_info.platform is more reliable"
console.log('sandboxMode:', GM_info.sandboxMode); // Tampermonkey 4.18+: "js" | "raw" | "dom" — https://www.tampermonkey.net/documentation.php?locale=en&q=GM_info — sandboxMode: SandboxMode // 4.18+
console.log('userAgentData:', GM_info.userAgentData); // Chromium 90+ high-entropy brands, from extension background (both VM and TM expose it)
```

`navigator.userAgent` / `navigator.userAgentData` can be spoofed by other extensions or DevTools device emulation; `GM_info.platform` / `GM_info.userAgentData` are fetched from the extension background via `browser.runtime.getPlatformInfo` and are not affected by page spoofing (Violentmonkey docs quoted above).

> **No `// @debugFlag` metadata exists (verified 2026-08-24).** No Violentmonkey (https://violentmonkey.github.io/api/metadata-block/ — full key list contains @name, @namespace, @match, @grant, @inject-into, @run-at, etc., but no @debugFlag) nor Tampermonkey (https://www.tampermonkey.net/documentation.php?locale=en — documentation index lists all @grant/@sandbox/@run-at keys, no @debugFlag) defines such a key. If you need debug-only behavior, gate it yourself: `if (GM_info.script.version.includes('debug')) ...` or a stored flag via `GM_getValue`.

