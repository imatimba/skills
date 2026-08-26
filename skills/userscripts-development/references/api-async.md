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

The `GM.*` API provides promise-based versions of `GM_*` functions (verified 2026-08-25 — greasespot.net/2017/09/greasemonkey-4-for-script-authors.html, wiki.greasespot.net/GM.getValue, violentmonkey.github.io/api/gm/#gm). Greasemonkey 4+ ships ONLY `GM.*` promises — sync `GM_*` removed, return values are `Promise` (verified 2026-08-25 — greasespot.net/2017/09/greasemonkey-4-for-script-authors.html: "only one object provided … named GM" + "return values are Promises").

**Key differences from `GM_*`:**
- Return `Promise` instead of immediate values/callbacks
- Use `await` or `.then()` for results
- Some names differ in capitalisation (see table below) — conventions come from Greasemonkey 4 and Tampermonkey respectively

> **GM.info is synchronous — not part of the async surface (verified 2026-08-25 — wiki.greasespot.net/GM.info, tampermonkey.net/documentation.php?q=GM_info, violentmonkey.github.io/api/gm/#gm_info):** `GM.info` / `GM_info` is a plain object — Tampermonkey `GM_info` docs describe a `ScriptGetInfo` object, Violentmonkey `GM_info: {...}` object, and Greasemonkey Manual:API lists `GM.info` as an object (verified 2026-08-25 — wiki.greasespot.net/GM.info, tampermonkey.net/documentation.php?q=GM_info, violentmonkey.github.io/api/gm/#gm_info). Do not `await` it; access properties directly — e.g. `GM.info.scriptHandler` / `GM_info.scriptHandler`.

---

## Naming Conventions

| Sync (`GM_*`) | Async (`GM.*`) | Per-manager availability |
|---------------|----------------|--------------------------|
| `GM_getValue` | `GM.getValue` | Tampermonkey + Violentmonkey: both forms; Greasemonkey 4+: `GM.*` only; Safari: promise subset only |
| `GM_setValue` | `GM.setValue` | Tampermonkey + Violentmonkey: both; Greasemonkey 4+: `GM.*` only; Safari: ✅ |
| `GM_deleteValue` | `GM.deleteValue` | Tampermonkey + Violentmonkey: both; Greasemonkey 4+: `GM.*` only; Safari: ✅ |
| `GM_listValues` | `GM.listValues` | Tampermonkey + Violentmonkey: both; Greasemonkey 4+: `GM.*` only; Safari: ✅ |
| `GM_getValues` / `GM_setValues` / `GM_deleteValues` (batch) | `GM.getValues` / `GM.setValues` / `GM.deleteValues` | **Tampermonkey 5.3+, Violentmonkey since 2.19.1** — both forms there; **Greasemonkey 4+ / Safari: not supported — use `Promise.all` over individual calls** (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_values#api:GM_getValues `v5.3+`, violentmonkey.github.io/api/gm/#gm_getvalues `Since VM2.19.1`, wiki.greasespot.net/GM.getValue `Promise.all()`) |
| `GM_getResourceURL` | `GM.getResourceUrl` | Lowercase `rl` — **Greasemonkey 4 convention**; Tampermonkey accepts both but documents `getResourceUrl` for promise |
| `GM_xmlhttpRequest` | `GM.xmlHttpRequest` | Capital `H` — **Tampermonkey convention**; all managers with promise support use the capital-H spelling |
| `GM_notification` | `GM.notification` | See notification section — `Promise<boolean>` is Tampermonkey-only |
| `GM_setClipboard` | `GM.setClipboard` | Signature variants per manager — see clipboard section |
| `GM_openInTab` | `GM.openInTab` | Per-manager option sets — see [api-tabs.md](api-tabs.md) |
| `GM_addStyle` | `GM.addStyle` | Tampermonkey + Violentmonkey; Greasemonkey 4+ via `gm4-polyfill.js` only; Safari partial impl |
| `GM_addElement` | `GM.addElement` | Tampermonkey + Violentmonkey; Greasemonkey 4+ / Safari: not supported |
| `GM_download` | `GM.download` | Tampermonkey + Violentmonkey (verified 2026-08-25 — violentmonkey.github.io/api/gm/#gm `GM.download (async since VM2.18.3)`, tampermonkey.net/documentation.php?q=GM_download) — async `GM.download` returns `Promise<Blob>` with `abort()`; sync `GM_download` uses callbacks / handle `abort()` |

> **Note:** `GM.addValues` does not exist in any manager — the batch helpers are `getValues`/`setValues`/`deleteValues` only. Do not call `GM.addValues`/`GM_addValues`.

Feature-detect the promise surface rather than branching on handler names:

```javascript
const canBatch = typeof GM !== "undefined" && typeof GM.getValues === "function";
const canXhrPromise = typeof GM !== "undefined" && typeof GM.xmlHttpRequest === "function";
```

> **Grant strings are distinct for the promise forms (verified 2026-08-25 — greasespot.net/2017/09/greasemonkey-4-for-script-authors.html, wiki.greasespot.net/Greasemonkey_Manual:API):** `@grant GM.getValue` does not imply `@grant GM_getValue` and vice versa — Greasemonkey Manual:API notes “API methods need to be specified with @grant”. Declare each promise API you `await` explicitly — e.g. `// @grant GM.getValue`, `// @grant GM.xmlHttpRequest`, `// @grant GM.download` — or list both forms when a script supports sync and async paths.

---

## Storage Functions

Portable single-value storage via promises works on **TM, VM, GM4+, Safari**. Batch and listeners degrade per manager — see matrices below. Canonical value-type rules and listener patterns live in [api-storage.md](api-storage.md).

### Single-value: GM.getValue / setValue / deleteValue / listValues

```javascript
// @grant GM.getValue
// @grant GM.setValue
// @grant GM.deleteValue
// @grant GM.listValues

const username = await GM.getValue('username', 'Anonymous');
await GM.setValue('username', 'John');
await GM.deleteValue('tempData');
const keys = await GM.listValues();
```

### Batch: GM.getValues / setValues / deleteValues

Availability: Tampermonkey 5.3+, Violentmonkey since 2.19.1; Greasemonkey 4+ / Safari: not supported — use `Promise.all` polyfill.

| Manager | `GM.getValues` / `setValues` / `deleteValues` |
| --- | --- |
| Tampermonkey | ✅ **since Tampermonkey 5.3+** (both `GM_` and `GM.` forms) |
| Violentmonkey | ✅ **since Violentmonkey 2.19.1+** (both forms) |
| Greasemonkey 4+ | ❌ Not supported — use `Promise.all` over individual calls |
| Safari (Userscripts) | ❌ Not supported — use `Promise.all` over individual calls |

*Batch gates verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_values#api:GM_getValues (`v5.3+`), violentmonkey.github.io/api/gm/#gm_getvalues (`Since VM2.19.1`); `Promise.all` batching verified 2026-08-25 — wiki.greasespot.net/GM.getValue (`Promise.all()` recommendation).*

```javascript
// @grant GM.getValues
// Availability: Tampermonkey 5.3+, Violentmonkey since 2.19.1; Greasemonkey 4+ / Safari: not supported
const values = await GM.getValues(['foo', 'bar', 'baz']);
const values2 = await GM.getValues({ foo: 1, bar: 'default', baz: null });
await GM.setValues({ username: 'John', theme: 'dark' });
await GM.deleteValues(['tempData', 'cache']);
```

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

> `GM.addValues` does not exist in any manager — do not use it.

### GM.addValueChangeListener / GM.removeValueChangeListener

```javascript
// @grant GM.addValueChangeListener
// @grant GM.removeValueChangeListener

const listenerId = await GM.addValueChangeListener('counter', (key, oldValue, newValue, remote) => {
    if (remote) console.log('Change from another tab:', key, newValue);
});
await GM.removeValueChangeListener(listenerId);
```

Portability: Tampermonkey and Violentmonkey fire `remote === true` for changes from another tab; Greasemonkey 4+ signature differs and `remote` handling is UNVERIFIED per [managers.md](managers.md); Safari does not support listeners. See [api-storage.md](api-storage.md) for canonical listener patterns.

### Promise rejection and value-type portability (verified 2026-08-25 — wiki.greasespot.net/GM.getValue, wiki.greasespot.net/GM.setValue)

- **Rejection:** Every `GM.*` promise rejects on error and resolves on success — wrap `await` in `try/catch`. See canonical rejection wording at wiki.greasespot.net/GM.getValue and /GM.setValue (verified 2026-08-25 — wiki.greasespot.net/GM.getValue, wiki.greasespot.net/GM.setValue).
- **Value types:** Greasemonkey 4+ allows only `string`, `boolean`, and `integer` — other types may cause undefined behavior (verified 2026-08-25 — wiki.greasespot.net/GM.setValue). Tampermonkey and Violentmonkey accept JSON-serialisable values. For portability serialize objects with `JSON.stringify` — canonical rules live in [api-storage.md](api-storage.md).

---

## Resource Functions

```javascript
// @resource myCSS https://example.com/style.css
// @resource myIcon https://example.com/icon.png
// @grant GM.getResourceText
// @grant GM.getResourceUrl

const cssText = await GM.getResourceText('myCSS');
const iconUrl = await GM.getResourceUrl('myIcon'); // lowercase `rl` — Greasemonkey 4 convention
img.src = iconUrl;
```

Portability: Tampermonkey and Violentmonkey support the promise forms; Greasemonkey 4+ supports `GM.getResourceUrl` (lowercase `rl`); Safari has no `@resource` implementation.

> **Return-type difference (verified 2026-08-25 — violentmonkey.github.io/types/, tampermonkey.net/documentation.php?q=GM_getResource, violentmonkey.github.io/api/gm/#gm_getresourcetext):** `GM.getResourceText` is synchronous `string` in Violentmonkey while Tampermonkey provides both sync and promise forms. `GM.getResourceUrl` is `Promise<string>` where implemented. Feature-detect before `await`ing `getResourceText` when targeting Violentmonkey.

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

The promise also exposes `abort()` where available — feature-detect before calling:

```javascript
const request = GM.xmlHttpRequest({
    method: 'GET',
    url: 'https://api.example.com/large-file'
});
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
| Greasemonkey 4+ | `undefined` per wiki (`GM.xmlHttpRequest` “Returns undefined”) — no documented abort control; feature-detect `abort()` if present (verified 2026-08-25 — wiki.greasespot.net/GM.xmlHttpRequest) | Wiki documents `Returns undefined`; do not rely on abort |
| Safari (Userscripts) | Custom promise with `abort` | Safari-specific promise shape; still `request.abort()` when present — feature-detect before calling |

> **Fetch vs XHR mode (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_xmlhttpRequest):** Tampermonkey `details.fetch: true` switches to `fetch` (enforced automatically when `details.anonymous` or `details.redirect` is set as of build 6180+). In fetch mode `details.timeout` and `onprogress` do not work. For option details see [http-requests.md](http-requests.md).

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
| Violentmonkey | `GM.setClipboard(data, type?) → void` (synchronous) | `type` optional string, defaults to `"text"` |
| Greasemonkey 4+ | `GM.setClipboard(data, type?) → undefined` | Returns `undefined` per wiki |
| Safari | `GM.setClipboard(data, type?) → Promise<void>` | Only Tampermonkey’s promise form reliably returns `Promise<void>` |

```javascript
// @grant GM.setClipboard

// Portable baseline — plain string type
await GM.setClipboard('Copied text', 'text');

// Tampermonkey — HTML with mimetype object (also works as "html" string)
await GM.setClipboard('<b>Bold</b>', 'html');
```

---

## Tab Functions

Sync vs promise duality — canonical handles and option sets live in [api-tabs.md](api-tabs.md).

| Form | API | Managers |
| --- | --- | --- |
| Sync callback | `GM_getTab(cb)` / `GM_saveTab(tab, cb)` / `GM_getTabs(cb)` / `GM_openInTab(url, opts)` | Tampermonkey (Violentmonkey does not implement tab storage — use `GM_setValue` + `GM_addValueChangeListener`) |
| Promise | `GM.getTab()` / `GM.saveTab(tab)` / `GM.getTabs()` / `GM.openInTab(url, opts)` | Tampermonkey; Safari Userscripts `GM.getTab`/`GM.saveTab` promise only (no `GM.getTabs`; deprecation planned v5→v6 per quoid/userscripts#667); Violentmonkey ❌ tab storage not implemented; Greasemonkey 4+ ❌ tab storage not implemented |

```javascript
// @grant GM.getTab
// @grant GM.saveTab
// @grant GM.getTabs

const tab = await GM.getTab();
tab.customData = { lastAction: 'click' };
await GM.saveTab(tab);

const tabs = await GM.getTabs();
for (const [tabId, tabData] of Object.entries(tabs)) {
    console.log(`Tab ${tabId}:`, tabData);
}
```

Portability: `GM.getTab`/`saveTab`/`getTabs` promises are available in Tampermonkey; Safari Userscripts provides `GM.getTab`/`GM.saveTab` promise only (persistent while tab open; no `GM.getTabs`; deprecation planned v5→v6 per quoid/userscripts#667); Violentmonkey does not implement tab storage — use `GM_setValue` + `GM_addValueChangeListener`; Greasemonkey 4+ does not implement tab storage. `GM_openInTab` option sets differ per manager — see [api-tabs.md](api-tabs.md).

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
| Tampermonkey | ✅ Stable; `partitionKey` since Tampermonkey 5.2+; `httpOnly` beta-gated |
| Violentmonkey | ✅ **since Violentmonkey 2.35.1**; httpOnly needs both global + per-script toggles |
| Greasemonkey 4+ | ❌ |
| Safari | ❌ |

For the full filter matrix, cookie object shape, and `httpOnly` gating see [api-cookies.md](api-cookies.md).

---

## Audio Functions — ⚠️ Tampermonkey-Only Experimental

> **Tampermonkey-only experimental** — available **since Tampermonkey beta 5.3.6230 / stable 5.4**. No other manager implements `GM_audio` / `GM.audio`. Scope is the **current tab only**. The API is experimental and may change; **feature-detect before use**. Full guide: [api-audio.md](api-audio.md).

```javascript
// Feature-detect — do not assume GM or GM.audio exists
const canAudio = typeof GM !== "undefined" && typeof GM.audio !== "undefined";
if (!canAudio) {
    console.log('Tab audio control not available in this manager');
} else {
    await GM.audio.setMute({ isMuted: true });
    const state = await GM.audio.getState();
    console.log(`Muted: ${state.isMuted}, Audible: ${state.isAudible}`);
}
```

See [api-audio.md](api-audio.md) for `setMute`/`getState`/`addStateChangeListener` details, `muteReason` values, and element-level fallback (`HTMLMediaElement.muted`).

---

## Combining Async Operations

Use `async`/`await` and `Promise.all` / `Promise.allSettled` per MDN. For portable storage batching use `Promise.all` over `GM.getValue`/`GM.setValue` when `GM.getValues` is unavailable — see polyfill above. For worked storage patterns (settings manager, cache with expiry, cross-tab broadcast) see [api-storage.md](api-storage.md); for HTTP retry, streaming, and `responseType` handling see [http-requests.md](http-requests.md).

---

## See Also

- [managers.md](managers.md) — normative Support Matrix, injection models, and detection snippet
- [api-sync.md](api-sync.md) — sync `GM_*` reference (UI/info/menu/tab)
- [api-storage.md](api-storage.md) — storage patterns and value-type rules
- [http-requests.md](http-requests.md) — `GM_xmlhttpRequest` full matrix
- [api-tabs.md](api-tabs.md) — `GM_openInTab` handles and tab storage
- [api-cookies.md](api-cookies.md) — cookie filters and `partitionKey`
- [api-audio.md](api-audio.md) — Tampermonkey-only experimental audio control
