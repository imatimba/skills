# Async GM.* API Reference — Promise-Based Surface

Promise-based `GM.*` equivalents of the `GM_*` sync APIs. Use with `async`/`await`. Manager facts follow [managers.md](managers.md); when a concrete manager is exemplified, **Violentmonkey** is the worked example. For sync contracts see [api-sync.md](api-sync.md).

## Scope & Related References

| Topic | Canonical reference | What lives there vs here |
| --- | --- | --- |
| Storage full patterns (sync + async, batch, listeners) | [api-storage.md](api-storage.md) | Canonical value-type rules, batch guidance, cross-tab patterns |
| HTTP full matrix (`GM_xmlhttpRequest` options, `@connect`, streaming) | [http-requests.md](http-requests.md) | Full option matrix, abort semantics, `@connect` enforcement |
| Cookies (`GM_cookie` / `GM.cookie` filters) | [api-cookies.md](api-cookies.md) | Full filter set, `partitionKey`, httpOnly gating |
| Tabs (`GM_getTab`/`saveTab`/`getTabs`, `GM_openInTab` handles) | [api-tabs.md](api-tabs.md) | Canonical tab storage + `openInTab` option sets |
| DOM/UI (`unsafeWindow`, `GM_addStyle`/`GM_addElement` deep dive) | [api-dom-ui.md](api-dom-ui.md) | Injection models, CSP, `unsafeWindow` bridges |
| Audio (`GM_audio` / `GM.audio` full guide) | [api-audio.md](api-audio.md) | Experimental audio control, state/listeners, mute reasons |

---

## Overview

The `GM.*` API provides promise-based versions of `GM_*` functions.

**Key differences from `GM_*`:**
- Return `Promise` instead of immediate values/callbacks
- Use `await` or `.then()` for results
- Some names differ in capitalisation (see table below) — conventions come from Greasemonkey 4 and Tampermonkey respectively

> **GM.info is synchronous — not part of the async surface (verified 2026-08-24):** `GM.info` / `GM_info` is a plain object — Tampermonkey `GM_info` docs describe a `ScriptGetInfo` object, Violentmonkey `GM_info: {...}` object, and Greasemonkey Manual:API lists `GM.info` as an object (verified 2026-08-24 via wiki.greasespot.net, tampermonkey.net/documentation.php?q=GM_info, violentmonkey.github.io/api/gm/). Do not `await` it; access properties directly — e.g. `GM.info.scriptHandler` / `GM_info.scriptHandler`.

---

## Naming Conventions

| Sync (`GM_*`) | Async (`GM.*`) | Casing origin | Per-manager availability |
|---------------|----------------|---------------|--------------------------|
| `GM_getValue` | `GM.getValue` | — | Tampermonkey + Violentmonkey: both forms; Greasemonkey 4+: `GM.*` only; Safari: promise subset only |
| `GM_setValue` | `GM.setValue` | — | Tampermonkey + Violentmonkey: both; Greasemonkey 4+: `GM.*` only; Safari: ✅ |
| `GM_deleteValue` | `GM.deleteValue` | — | Tampermonkey + Violentmonkey: both; Greasemonkey 4+: `GM.*` only; Safari: ✅ |
| `GM_listValues` | `GM.listValues` | — | Tampermonkey + Violentmonkey: both; Greasemonkey 4+: `GM.*` only; Safari: ✅ |
| `GM_getValues` / `GM_setValues` / `GM_deleteValues` (batch) | `GM.getValues` / `GM.setValues` / `GM.deleteValues` | — | **Tampermonkey 5.3+, Violentmonkey since 2.19.1** — both forms there; **Greasemonkey 4+ / Safari: not supported — use `Promise.all` over individual calls** |
| `GM_getResourceURL` | `GM.getResourceUrl` | Lowercase `rl` — **Greasemonkey 4 convention** (carried by Violentmonkey since 2.12.0) | Greasemonkey 4+ is the origin of the lowercase spelling; Tampermonkey accepts both but documents `getResourceUrl` for promise |
| `GM_xmlhttpRequest` | `GM.xmlHttpRequest` | Capital `H` — **Tampermonkey convention** | Violentmonkey since 2.18.3, Greasemonkey 4+, Safari custom promise all use the capital-H spelling |
| `GM_notification` | `GM.notification` | — | See notification section — `Promise<boolean>` is Tampermonkey-only |
| `GM_setClipboard` | `GM.setClipboard` | — | Signature variants per manager — see clipboard section |
| `GM_openInTab` | `GM.openInTab` | — | Per-manager option sets — see [api-tabs.md](api-tabs.md) |
| `GM_addStyle` | `GM.addStyle` | — | Tampermonkey + Violentmonkey since 2.12.0; Greasemonkey 4+ via `gm4-polyfill.js` only; Safari partial impl |
| `GM_addElement` | `GM.addElement` | — | Tampermonkey + Violentmonkey since 2.13.1; Greasemonkey 4+ / Safari: not supported |
| `GM_download` | `GM.download` | — | Tampermonkey + Violentmonkey since 2.18.3 (verified 2026-08-24) — async `GM.download` returns `Promise<Blob>` with `abort()` per Violentmonkey types `download(): void \| Promise<Blob>` and Tampermonkey docs “If GM.download is used it returns a promise … also has an abort function”; sync `GM_download` uses callbacks / handle `abort()` |

> **Note:** `GM.addValues` does not exist in any manager — the batch helpers are `getValues`/`setValues`/`deleteValues` only. Do not call `GM.addValues`/`GM_addValues`.

Feature-detect the promise surface rather than branching on handler names:

```javascript
const canBatch = typeof GM !== "undefined" && typeof GM.getValues === "function";
const canXhrPromise = typeof GM !== "undefined" && typeof GM.xmlHttpRequest === "function";
```

> **Grant strings are distinct for the promise forms (verified 2026-08-24):** `@grant GM.getValue` does not imply `@grant GM_getValue` and vice versa — Greasemonkey Manual:API notes “API methods need to be specified with @grant”. Declare each promise API you `await` explicitly — e.g. `// @grant GM.getValue`, `// @grant GM.xmlHttpRequest`, `// @grant GM.download` — or list both forms when a script supports sync and async paths.

---

## Storage Functions

### GM.getValue(key, defaultValue)

```javascript
// @grant GM.getValue

const username = await GM.getValue('username', 'Anonymous');
const settings = await GM.getValue('settings', { theme: 'dark', lang: 'en' });
```

### GM.setValue(key, value)

```javascript
// @grant GM.setValue

await GM.setValue('username', 'John');
await GM.setValue('settings', { theme: 'light', lang: 'fr' });
await GM.setValue('lastVisit', Date.now());
```

### GM.deleteValue(key)

```javascript
// @grant GM.deleteValue

await GM.deleteValue('tempData');
```

### GM.listValues()

```javascript
// @grant GM.listValues

const keys = await GM.listValues();
console.log('Stored keys:', keys);
```

### GM.getValues(keysOrDefaults) — batch

```javascript
// @grant GM.getValues
// Availability: Tampermonkey 5.3+, Violentmonkey since 2.19.1; Greasemonkey 4+ / Safari: not supported

// With array of keys
const values = await GM.getValues(['foo', 'bar', 'baz']);

// With default values
const values2 = await GM.getValues({
    foo: 1,
    bar: 'default',
    baz: null
});
```

### GM.setValues(values) — batch

```javascript
// @grant GM.setValues
// Availability: Tampermonkey 5.3+, Violentmonkey since 2.19.1; Greasemonkey 4+ / Safari: not supported

await GM.setValues({
    username: 'John',
    theme: 'dark',
    lastLogin: Date.now()
});
```

### GM.deleteValues(keys) — batch

```javascript
// @grant GM.deleteValues
// Availability: Tampermonkey 5.3+, Violentmonkey since 2.19.1; Greasemonkey 4+ / Safari: not supported

await GM.deleteValues(['tempData', 'cache', 'oldSettings']);
```

**Batch availability**

| Manager | `GM.getValues` / `setValues` / `deleteValues` |
| --- | --- |
| Tampermonkey | ✅ **since Tampermonkey 5.3+** (both `GM_` and `GM.` forms) |
| Violentmonkey | ✅ **since Violentmonkey 2.19.1+** (both forms) |
| Greasemonkey 4+ | ❌ Not supported — use `Promise.all` over individual calls |
| Safari (Userscripts) | ❌ Not supported — use `Promise.all` over individual calls |

Polyfill for Greasemonkey 4+ / Safari (and any manager without batch):

```javascript
// Portable replacement for GM.getValues
async function getValuesPolyfill(keysOrDefaults) {
    if (typeof GM !== "undefined" && typeof GM.getValues === "function") {
        return GM.getValues(keysOrDefaults);
    }
    const isArray = Array.isArray(keysOrDefaults);
    const keys = isArray ? keysOrDefaults : Object.keys(keysOrDefaults);
    const defaults = isArray ? {} : keysOrDefaults;
    const entries = await Promise.all(
        keys.map(async (k) => [k, await GM.getValue(k, defaults[k])])
    );
    return Object.fromEntries(entries);
}
```

> `GM.addValues` does not exist in any manager — do not use it. If you see it in older examples, replace it with `GM.setValues` (batch) or a loop / `Promise.all` of `GM.setValue`.

### GM.addValueChangeListener(key, callback)

```javascript
// @grant GM.addValueChangeListener

const listenerId = await GM.addValueChangeListener('counter', (key, oldValue, newValue, remote) => {
    console.log(`${key} changed from ${oldValue} to ${newValue}`);
    if (remote) console.log('Change came from another tab');
});
```

Per-manager notes: Tampermonkey and Violentmonkey fire `remote === true` for changes from another tab; Greasemonkey 4+ signature differs and `remote` handling is UNVERIFIED per [managers.md](managers.md); Safari does not support listeners. See [api-storage.md](api-storage.md) for canonical listener patterns.

### GM.removeValueChangeListener(listenerId)

```javascript
// @grant GM.removeValueChangeListener

await GM.removeValueChangeListener(listenerId);
```

### Promise rejection and value-type portability (verified 2026-08-24)

- **Rejection:** Every `GM.*` promise rejects on error and resolves on success — Greasemonkey wiki `GM.getValue` (“A Promise, rejected in case of error”) and `GM.setValue` (“A Promise, resolved … on success, rejected … on failure”) per wiki.greasespot.net/GM.getValue and /GM.setValue (verified 2026-08-24). Wrap `await` in `try/catch` or `.catch()`; storage and network failures surface as rejections, not callback errors.
- **Value types — version-sensitive:** Greasemonkey 4+ allows only `string`, `boolean`, and `integer` — “Any other type may cause undefined behavior, including crashes” per wiki `GM.setValue` (as of Greasemonkey 4.0+, verified 2026-08-24). Tampermonkey and Violentmonkey accept any JSON-serialisable value including `null`, `object`, `undefined`, and numbers per Tampermonkey `GM_values` docs (verified 2026-08-24). For portability serialize objects with `JSON.stringify` or guard via feature detection; canonical rules live in [api-storage.md](api-storage.md).

---

## Resource Functions

### GM.getResourceText(name)

```javascript
// @resource myCSS https://example.com/style.css
// @grant GM.getResourceText

const cssText = await GM.getResourceText('myCSS');
```

### GM.getResourceUrl(name)

**Note:** lowercase `rl` in `Url` — Greasemonkey 4 convention (see naming table).

```javascript
// @resource myIcon https://example.com/icon.png
// @grant GM.getResourceUrl

const iconUrl = await GM.getResourceUrl('myIcon');
img.src = iconUrl;
```

Portability: Tampermonkey and Violentmonkey since 2.12.0 support the promise form; Greasemonkey 4+ supports `GM.getResourceUrl` (lowercase `rl`); Safari has no `@resource` implementation.

> **Return-type difference (verified 2026-08-24):** `GM.getResourceText` is synchronous `string` in Violentmonkey (`getResourceText: (name) => string` per Violentmonkey `VMScriptGMObject` types at violentmonkey.github.io/types/) while Tampermonkey provides both `GM_getResourceText(name): string` and `await GM.getResourceText(name): string` (docs show `const scriptText2 = await GM.getResourceText("myscript.js")` at tampermonkey.net/documentation.php?q=GM_getResource). `GM.getResourceUrl` is promise-based `Promise<string>` in all managers that implement it (Violentmonkey `getResourceUrl: (name, isBlobUrl?) => Promise<string>`, Tampermonkey `await GM.getResourceUrl`). Feature-detect before `await`ing `getResourceText` when targeting Violentmonkey.

---

## Network Requests

### GM.xmlHttpRequest(details)

**Note:** uppercase `H` in `Http` — Tampermonkey convention (see naming table).

```javascript
// @grant GM.xmlHttpRequest
// @connect api.example.com

try {
    const response = await GM.xmlHttpRequest({
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: { 'Accept': 'application/json' }
    });
    const data = JSON.parse(response.responseText);
    console.log(data);
} catch (error) {
    console.error('Request failed:', error);
}
```

The promise also exposes `abort()`, but semantics differ per manager:

```javascript
const request = GM.xmlHttpRequest({
    method: 'GET',
    url: 'https://api.example.com/large-file'
});

// Cancel after 5 seconds — check that abort exists; Greasemonkey/Safari promises differ
if (typeof request.abort === "function") request.abort();

try {
    const response = await request;
} catch (error) {
    console.log('Request was aborted or failed');
}
```

### abort() semantics

| Manager | What `abort()` is | Notes |
| --- | --- | --- |
| Tampermonkey | Control object with `abort()` on the returned handle | Sync `GM_xmlhttpRequest` also returns `{ abort }` |
| Violentmonkey | Control object with `abort()` | Since promise form added in Violentmonkey 2.18.3 |
| Greasemonkey 4+ | `undefined` per wiki (`GM.xmlHttpRequest` “Returns undefined”) — no documented abort control; feature-detect `abort()` if present | Wiki documents `Returns undefined`; do not rely on abort |
| Safari (Userscripts) | Custom promise with `abort` | Safari-specific promise shape; still `request.abort()` when present — feature-detect before calling |

> **Fetch vs XHR mode (verified 2026-08-24):** Tampermonkey `GM_xmlhttpRequest` `details.fetch: true` switches to `fetch` (enforced automatically when `details.anonymous` or `details.redirect` is set as of build 6180+). In fetch mode `details.timeout` and `onprogress` do not work and `onreadystatechange` receives only `readyState DONE (4)` — per Tampermonkey `GM_xmlhttpRequest` docs at tampermonkey.net/documentation.php?q=GM_xmlhttpRequest (verified 2026-08-24). No first-party source documents `AbortController` integration for `GM.xmlHttpRequest` as of 2026-08-24; use the returned promise’s `abort()` handle instead.

For the full option matrix (`anonymous`, `cookie`, `responseType: 'stream'`, `redirect`, `proxy`, `@connect` enforcement, `response` shape) see [http-requests.md](http-requests.md) — that file is canonical.

---

## UI Functions

### GM.notification(details)

**`Promise<boolean>` is Tampermonkey-only.** Violentmonkey returns `VMScriptGMNotificationControl` (`{ remove(): Promise<void> }`) — not `Promise<void>`; Greasemonkey 4+ promises resolve `void` — rely on `onclick`/`ondone` callbacks for click detection. Safari has no notification API.

```javascript
// @grant GM.notification

// Portable — use callbacks, not the boolean, for cross-manager code
await GM.notification({
    text: 'Click me!',
    title: 'Notification',
    timeout: 10000,
    onclick: () => console.log('clicked (portable)'),
    ondone: () => console.log('done')
});

// Tampermonkey-only boolean path (feature-detect if you use it)
const handler = (typeof GM_info !== "undefined" ? GM_info : GM.info).scriptHandler;
if (handler === "Tampermonkey") {
    const wasClicked = await GM.notification({ text: 'Click me!', title: 'Notification', timeout: 10000 });
    console.log(wasClicked ? 'clicked' : 'dismissed');
}
```

| Manager | `await GM.notification(...)` resolves to | Extras |
| --- | --- | --- |
| Tampermonkey | `boolean` — `true` if clicked, `false` otherwise | `highlight`, `silent`, `url`/`tag` since Tampermonkey 5.0+ |
| Violentmonkey | `VMScriptGMNotificationControl` — `{ remove(): Promise<void> }` control object (not `Promise<void>`) — use `onclick`/`ondone` | `silent`, `tag`, `zombieTimeout`, `zombieUrl`; returns control |
| Greasemonkey 4+ | `void` — use callbacks; also supports positional args | Core fields only |
| Safari | ❌ No notification API | — |

See [api-sync.md](api-sync.md) for the sync `GM_notification` field breakdown.

### GM.setClipboard(data, type)

Per-manager signatures mirror [api-sync.md](api-sync.md). Prefer manager-qualified calls:

| Manager | Promise signature | Notes |
| --- | --- | --- |
| Tampermonkey | `GM.setClipboard(data, { type, mimetype } \| "text" \| "html") → Promise<void>` | Accepts object or string; callback form is sync-only |
| Violentmonkey | `GM.setClipboard(data, type?) → void` (synchronous — types show `(data, type?) => void`) | `type` optional string, defaults to `"text"` |
| Greasemonkey 4+ | `GM.setClipboard(data, type?) → undefined` | Returns `undefined` per wiki |
| Safari | `GM.setClipboard(data, type?) → Promise<void>` | Deprecated upstream #655 but present in promise subset; only Tampermonkey’s promise form reliably returns `Promise<void>` |

```javascript
// @grant GM.setClipboard

// Portable baseline — plain string type
await GM.setClipboard('Copied text', 'text');

// Tampermonkey — HTML with mimetype object (also works as "html" string)
await GM.setClipboard('<b>Bold</b>', 'html');
// or await GM.setClipboard('data', { type: 'text', mimetype: 'text/plain' });

console.log('Copied');
```

---

## Tab Functions

Sync vs promise duality — canonical handles and option sets live in [api-tabs.md](api-tabs.md).

| Form | API | Managers |
| --- | --- | --- |
| Sync callback | `GM_getTab(cb)` / `GM_saveTab(tab, cb)` / `GM_getTabs(cb)` / `GM_openInTab(url, opts)` | Tampermonkey (Violentmonkey does not implement tab storage — use `GM_setValue` + `GM_addValueChangeListener`) |
| Promise | `GM.getTab()` / `GM.saveTab(tab)` / `GM.getTabs()` / `GM.openInTab(url, opts)` | Tampermonkey; Safari Userscripts `GM.getTab`/`GM.saveTab` promise only (no `GM.getTabs`; deprecation planned v5→v6 per quoid/userscripts#667); Violentmonkey ❌ tab storage not implemented; Greasemonkey 4+ ❌ tab storage not implemented |

### GM.getTab()

```javascript
// @grant GM.getTab

const tab = await GM.getTab();
console.log('Tab data:', tab);
```

### GM.saveTab(tab)

```javascript
// @grant GM.saveTab

const tab = await GM.getTab();
tab.customData = { lastAction: 'click', timestamp: Date.now() };
await GM.saveTab(tab);
```

### GM.getTabs()

```javascript
// @grant GM.getTabs

const tabs = await GM.getTabs();
for (const [tabId, tabData] of Object.entries(tabs)) {
    console.log(`Tab ${tabId}:`, tabData);
}
```

Portability: `GM.getTab`/`saveTab`/`getTabs` promises are available in Tampermonkey; Safari Userscripts provides `GM.getTab`/`GM.saveTab` promise only (persistent while tab open; no `GM.getTabs`; deprecation planned v5→v6 per quoid/userscripts#667); Violentmonkey does not implement tab storage (absent from https://violentmonkey.github.io/api/gm/, declined in issue #1120) — use `GM_setValue` + `GM_addValueChangeListener`; Greasemonkey 4+ does not implement `GM_getTab`/`GM_saveTab`/`GM_getTabs` at all (wiki API list omits them). `GM_openInTab` option sets differ per manager — see [api-tabs.md](api-tabs.md) and the summary in [api-sync.md](api-sync.md).

---

## Cookie Functions

**`GM.cookie` is Tampermonkey + Violentmonkey (since Violentmonkey 2.35.1) ONLY.** Greasemonkey 4+ and Safari have no cookie API.

```javascript
// @grant GM.cookie

const cookies = await GM.cookie.list({ domain: 'example.com' });
await GM.cookie.set({ name: 'myCookie', value: 'myValue', domain: 'example.com', path: '/', secure: true });
await GM.cookie.delete({ name: 'myCookie' });
```

### Availability

| Manager | `GM.cookie` / `GM_cookie` |
| --- | --- |
| Tampermonkey | ✅ Stable; `partitionKey` since Tampermonkey 5.2+; `httpOnly` beta-gated (Config Mode Advanced → Security) |
| Violentmonkey | ✅ **since Violentmonkey 2.35.1**; httpOnly needs both global + per-script toggles |
| Greasemonkey 4+ | ❌ |
| Safari | ❌ |

Filter differences: Tampermonkey supports `partitionKey` (5.2+), `firstPartyDomain`, and broader `url`/`domain`/`name`/`path` filters; Violentmonkey follows Tampermonkey's filter set since 2.35.1 but verify `partitionKey` edge cases against [managers.md](managers.md). For the full filter matrix, cookie object shape, and `httpOnly` gating see [api-cookies.md](api-cookies.md).

### GM.cookie.list(details)

```javascript
// @grant GM.cookie

const cookies = await GM.cookie.list({ domain: 'example.com' });
console.log('Cookies:', cookies);
```

### GM.cookie.set(details)

```javascript
// @grant GM.cookie

await GM.cookie.set({
    name: 'myCookie',
    value: 'myValue',
    domain: 'example.com',
    path: '/',
    secure: true
});
```

### GM.cookie.delete(details)

```javascript
// @grant GM.cookie

await GM.cookie.delete({ name: 'myCookie' });
```

---

## Audio Functions — ⚠️ Tampermonkey-Only Experimental

> **Tampermonkey-only experimental** — available **since Tampermonkey beta 5.3.6230 / stable 5.4**. No other manager implements `GM_audio` / `GM.audio`. Scope is the **current tab only** (muting another tab is not supported). The API is experimental and may change; **feature-detect before use**.

Full guide: [api-audio.md](api-audio.md).

```javascript
// Feature-detect — do not assume GM or GM.audio exists
const canAudio = typeof GM !== "undefined" && typeof GM.audio !== "undefined";
const canAudioSync = typeof GM_audio !== "undefined" || canAudio;
if (!canAudio) {
    console.log('Tab audio control not available in this manager');
}
```

### GM.audio.setMute(details)

```javascript
// @grant GM.audio

await GM.audio.setMute({ isMuted: true });
console.log('Tab muted (current tab only)');
```

### GM.audio.getState()

```javascript
// @grant GM.audio

const state = await GM.audio.getState();
console.log(`Muted: ${state.isMuted}, Audible: ${state.isAudible}, Reason: ${state.muteReason}`);
```

### GM.audio.addStateChangeListener(listener)

```javascript
// @grant GM.audio

await GM.audio.addStateChangeListener((event) => {
    if ('muted' in event) console.log('Mute changed:', event.muted);
    if ('audible' in event) console.log('Audible changed:', event.audible);
});
```

See [api-audio.md](api-audio.md) for `removeStateChangeListener`, `muteReason` values (`user` \| `capture` \| `extension`), and error handling.

---

## Combining Async Operations

Use the storage and networking promise surface; patterns below complement [api-storage.md](api-storage.md) — that file is canonical for storage change-listener, cross-tab, and cache patterns.

| Goal | Pattern | When to choose |
| --- | --- | --- |
| Sequential dependencies | `const a = await GM.getValue(...); const r = await GM.xmlHttpRequest(...); await GM.setValue(...)` | Each step needs the previous result (e.g. fetch-then-cache) |
| Parallel independent reads/writes | `await Promise.all([GM.getValue('a'), GM.getValue('b'), GM.getValue('c')])` | Independent keys; also the polyfill for missing `GM.getValues` batch |
| Parallel with error isolation | `await Promise.allSettled([...])` then inspect `.status` | One failure must not abort the others |
| Fail-fast with retry | `try { await GM.xmlHttpRequest(...) } catch { await GM.notification(...) }` | Network with user-visible fallback |

For worked storage patterns (settings manager, cache with expiry, cross-tab broadcast, migration, persistent counter) see [api-storage.md](api-storage.md). For HTTP retry with exponential backoff, streaming, and responseType handling see [http-requests.md](http-requests.md).

---

## See Also

- [managers.md](managers.md) — normative Support Matrix, injection models, and detection snippet
- [api-sync.md](api-sync.md) — sync `GM_*` reference (UI/info/menu/tab)
- [api-storage.md](api-storage.md) — storage patterns and value-type rules
- [http-requests.md](http-requests.md) — `GM_xmlhttpRequest` full matrix
- [api-tabs.md](api-tabs.md) — `GM_openInTab` handles and tab storage
- [api-cookies.md](api-cookies.md) — cookie filters and `partitionKey`
- [api-audio.md](api-audio.md) — Tampermonkey-only experimental audio control
