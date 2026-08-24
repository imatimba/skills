# Synchronous GM_* API Reference — Sync UI / Info / Menu / Tab Reference

This reference covers the synchronous `GM_*` surface for UI, script info, menu, and tab helpers. It is **not** an exhaustive `GM_*` catalogue — storage, networking, web-request, cookies, and richer DOM/UI or tab storage details live in dedicated references. For promise-based `GM.*` equivalents see [api-async.md](api-async.md).

> **Disambiguation — “sync” = synchronous, not cloud sync:** This file documents **synchronous** `GM_*` APIs (`GM_setValue`/`GM_getValue` etc., which persist **locally** per extension storage / IndexedDB) — they are **not** cloud/browser-synced. Cloud sync of saved scripts/settings across devices is a separate manager feature; see [Cloud Sync](#cloud-sync--how-managers-sync-scripts--settings-across-devices) below (verified 2026-08-24).

## Scope & Related References

| Topic | Canonical reference | What lives there vs here |
| --- | --- | --- |
| Storage (`GM_getValue`/`setValue`/`listValues`, batch `getValues`/`setValues`/`deleteValues`, listeners) | [api-storage.md](api-storage.md) | Full sync + async patterns, batch availability, value-type rules |
| HTTP (`GM_xmlhttpRequest` / `GM.xmlHttpRequest`) | [http-requests.md](http-requests.md) | Full option matrix, `@connect` enforcement, streaming, abort semantics |
| Request interception (`GM_webRequest`) | [web-requests.md](web-requests.md) | `@webRequest` header, Firefox MV2-only, VM/GM/Safari support |
| Cookies (`GM_cookie` / `GM.cookie`) | [api-cookies.md](api-cookies.md) | `list`/`set`/`delete`, filter differences, `partitionKey` support |
| DOM & UI (`unsafeWindow`, `GM_addStyle`, `GM_addElement` deep dive) | [api-dom-ui.md](api-dom-ui.md) | Canonical `unsafeWindow` grant matrix, CSP bypass details, UI patterns |
| Tabs & cross-tab (`GM_openInTab` full options, `GM_getTab`/`saveTab`/`getTabs`, `onurlchange`) | [api-tabs.md](api-tabs.md) | Canonical `GM_openInTab` option sets and handles, tab-persistent storage, SPA navigation |

Manager facts below follow [managers.md](managers.md). When a concrete manager is shown, **Violentmonkey** is the worked example. Version numbers are manager-qualified (for example Tampermonkey 5.3+, Violentmonkey since 2.12.0).

---

## GM_info

Get information about the script and the userscript manager. No `@grant` required.

```javascript
// Works in every manager (GM_info vs GM.info fallback)
const info = typeof GM_info !== "undefined" ? GM_info : GM.info;
console.log(info.script.name);       // Script name
console.log(info.script.version);    // Script version
console.log(info.scriptHandler);     // "Tampermonkey" | "Violentmonkey" | "Greasemonkey" | "Userscripts"
console.log(info.version);           // Manager version
```

### Key properties (common subset)

| Property | Type | Description |
|----------|------|-------------|
| `script.name` | string | Script name |
| `script.version` | string | Script version |
| `script.description` | string | Script description |
| `script.namespace` | string | Script namespace |
| `script.matches` | string[] | `@match` patterns |
| `script.includes` | string[] | `@include` patterns |
| `script.excludes` | string[] | `@exclude` patterns |
| `script.grant` | string[] | Granted permissions |
| `scriptHandler` | string | Manager identifier — exact literal, see row below |
| `version` | string | Manager version |
| `isIncognito` | boolean | Running in private mode |
| `sandboxMode` | string | `js` \| `raw` \| `dom` (Tampermonkey 4.18+) |
| `injectInto` | string | `auto` \| `page` \| `content` (Violentmonkey) |
| `downloadMode` | string | `native` \| `disabled` \| `browser` |
| `container` | object | **Tampermonkey-only since 5.3+ Firefox only** — `{ id: string, name?: string }` (Firefox container) |
| `isFirstPartyIsolation` | boolean | **Tampermonkey-only** — Firefox First-Party Isolation flag |
| `userAgentData` | object | **Tampermonkey-only since 4.19+** — `UADataValues` (`brands`, `mobile`, `platform`, `architecture`, `bitness`) |
| `script.options` | object | **Tampermonkey-only** — run-time options (`check_for_updates`, `comment`, `sandbox`, `noframes`, `run_at`, `run_in` since 5.3+, `unwrap`, `override` with `use_*/orig_*`/`merge_*`) |

### scriptHandler literals

| Literal | Manager |
| --- | --- |
| `"Tampermonkey"` | Tampermonkey |
| `"Violentmonkey"` | Violentmonkey |
| `"Greasemonkey"` | Greasemonkey 4+ |
| `"Userscripts"` | Safari "Userscripts" app (quoid/userscripts) |

Always compare with exact literals:

```javascript
const handler = (typeof GM_info !== "undefined" ? GM_info : GM.info).scriptHandler;
if (handler === "Tampermonkey") { /* TM-only path */ }
```

### Per-manager field differences

| Manager | Notes |
| --- | --- |
| Tampermonkey | Fullest surface. `sandboxMode` (`js` \| `raw` \| `dom`) since Tampermonkey 4.18+. `isIncognito`, `downloadMode`, and extended `script` metadata present. |
| Violentmonkey | Adds `injectInto` (`auto` \| `page` \| `content`) and `platform` (e.g. `chrome` \| `firefox`). `sandboxMode` is not used — check `injectInto` instead. Otherwise similar breadth to Tampermonkey. |
| Greasemonkey 4+ | `GM.info` (promise world) with **fewer fields** — `sandboxMode`/`injectInto`/`downloadMode` absent; `script` subset only. No `GM_info` global in the old sync sense. |
| Safari (Userscripts) | **Subset** — `script` metadata + `scriptHandler === "Userscripts"` + `version`. Sandbox/injection fields absent; any `@grant` forces content-world. |

**Feature-detect guidance:** prefer `typeof GM_info !== "undefined" ? GM_info : GM.info` and test field existence (`if ("injectInto" in info)`, `if ("sandboxMode" in info)`) over `scriptHandler` branching. See [managers.md](managers.md) §5 for the canonical detection snippet. Capability checks (`typeof GM?.getValues === "function"`) are more portable than handler checks when deciding which API to call.

---

## GM_log(message)

Log a message to the console.

```javascript
// @grant GM_log

GM_log('Debug message');
GM_log('User ID: ' + userId);
```

Portability: Tampermonkey and Violentmonkey support `GM_log` (alias for `console.log`). Greasemonkey 4+ removed it — use `console.log` there. Safari has no `GM_log`. For portable code prefer `console.log` and reserve `GM_log` for legacy scripts.

---

## GM_addStyle(css)

Add CSS styles to the document.

```javascript
// @grant GM_addStyle

// Add styles — capture the element only after feature-detecting the return value
const styleEl = GM_addStyle(`
    .my-class { background: #f0f0f0; padding: 10px; }
    #hide-element { display: none !important; }
`);
// styleEl may be undefined in managers/versions that do not return it
if (styleEl) styleEl.dataset.owner = "my-script";
```

### Availability

| Manager | Sync `GM_addStyle(css)` | Notes |
| --- | --- | --- |
| Tampermonkey | ✅ Returns `<style>` element | Stable; element return is portable to feature-detect |
| Violentmonkey | ✅ Returns `<style>` element | Same contract as Tampermonkey |
| Greasemonkey 4+ | ❌ Removed in 4.0 | Use `gm4-polyfill.js` shim or `GM.addStyle` promise form; otherwise `document.createElement('style')` |
| Safari (Userscripts) | ❌ Deprecated | Prefer promise `GM.addStyle(css)` (partial impl); sync form is deprecated upstream |

**Return-value caveat:** only Tampermonkey and Violentmonkey guarantee the injected `<style>` element is returned. Feature-detect before relying on it:

```javascript
const el = GM_addStyle("body { color: red; }");
if (el && el.parentNode) { /* safe to keep a handle for later .remove() */ }
```

For full removal/toggle patterns see [api-dom-ui.md](api-dom-ui.md).

---

## GM_addElement(tag_name, attributes)
## GM_addElement(parent_node, tag_name, attributes)

Create and inject HTML elements. CSP bypass is **Tampermonkey / Violentmonkey only** — other managers do not bypass page CSP with this API.

```javascript
// @grant GM_addElement

// Add script to page (CSP bypass — TM/VM only)
GM_addElement('script', {
    textContent: 'window.myVar = "injected";'
});

// Add external script
GM_addElement('script', {
    src: 'https calorimeter placeholder — use https://example.com/script.js',
    type: 'text/javascript'
});

// Add image to specific parent
GM_addElement(document.body, 'img', {
    src: 'https://example.com/image.png',
    alt: 'My Image'
});

// Add style to shadow DOM
GM_addElement(shadowRoot, 'style', {
    textContent: 'div { color: blue; }'
});
```

**Returns:** the injected element where supported (see table).

### Availability

| Manager | Support | Return value | Async form |
| --- | --- | --- | --- |
| Tampermonkey | ✅ | Returns injected element **since Tampermonkey 5.5.0**; earlier versions returned `undefined` | `GM.addElement(...)` promise also available |
| Violentmonkey | ✅ | Returns element (sync) | Also `GM.addElement(...)` promise **since Violentmonkey 2.13.1** (both sync and async exist) |
| Greasemonkey 4+ | ❌ | — (tracked as greasemonkey/greasemonkey#2484) | ❌ |
| Safari (Userscripts) | ❌ | — | ❌ |

CSP-bypass note: the ability to inject `<script>`/`<style>` past a strict page CSP is a **Tampermonkey / Violentmonkey** implementation detail. Greasemonkey and Safari do not offer it via this API. For CSP discussion and `page` vs `content` injection fallbacks see [managers.md](managers.md) §4 and [api-dom-ui.md](api-dom-ui.md).

---

## GM_notification(details, ondone)
## GM_notification(text, title, image, onclick)

Display desktop notifications.

### Universal core (portable)

These fields work wherever `GM_notification` exists (Tampermonkey, Violentmonkey, Greasemonkey 4+):

| Property | Type | Description |
|----------|------|-------------|
| `text` | string | Notification body |
| `title` | string | Notification title |
| `image` | string | Icon URL |
| `timeout` | number | Auto-close time in ms |
| `onclick` | function | Click handler (`event.preventDefault()` may suppress default action) |
| `ondone` | function | Close/dismiss handler |

```javascript
// @grant GM_notification — portable core

GM_notification({
    text: 'Download complete!',
    title: 'My Script',
    image: 'https://example.com/icon.png',
    timeout: 5000,
    onclick: (event) => {
        event.preventDefault();
        console.log('Clicked!');
    },
    ondone: () => console.log('Closed')
});
```

### Manager extras

| Manager | Extra fields | Return / control | Notes |
| --- | --- | --- | --- |
| Tampermonkey | `highlight` (flash tab), `silent` (suppress sound), `url` (open on click, Tampermonkey 5.0+), `tag` (update existing, Tampermonkey 5.0+) | Sync returns `undefined`; **promise `GM.notification` resolves `Promise<boolean>` (clicked?) — Tampermonkey-only** | Most feature-rich |
| Violentmonkey | `silent`, `tag`, `zombieTimeout`, `zombieUrl` | Returns a control object (close handle); promise form exists | No `highlight`/`url` |
| Greasemonkey 4+ | — (core fields only) | Both object and **positional-args form** supported: `GM.notification("text","title","image", onclick)` | Sync `GM_notification` removed; use `GM.notification` |
| Safari (Userscripts) | ❌ | ❌ No notification API at all | — |

### Positional-args (legacy) form

```javascript
// Greasemonkey-style positional signature (also accepted by TM/VM for compat)
GM_notification('Message', 'Title', 'https://example.com/icon.png', () => {
    console.log('Clicked!');
});
// Equivalent object form (preferred for portability):
GM_notification({ text: 'Message', title: 'Title', image: 'https://example.com/icon.png', onclick: () => {} });
```

For the full decision on object vs positional, see [Decision Tables](#decision-tables) below.

### Promise return — Tampermonkey-only

`await GM.notification(details)` → `Promise<boolean>` (`true` if clicked) is **Tampermonkey-only**. Violentmonkey and Greasemonkey 4+ promise forms resolve `void` — rely on `onclick`/`ondone` callbacks for portable click detection. See [api-async.md](api-async.md) for the async contract.

---

## GM_openInTab(url, options)
## GM_openInTab(url, loadInBackground)

Open a new browser tab. Canonical option/handle table lives in [api-tabs.md](api-tabs.md) — this section is a manager-qualified summary.

```javascript
// @grant GM_openInTab

// Portable baseline (works everywhere that supports the API)
GM_openInTab('https://example.com/');

// Violentmonkey worked example — options object
const tab = GM_openInTab('https://example.com/', {
    active: true,   // focus the new tab
    insert: true,   // insert next to current tab
    setParent: true // (Tampermonkey) or container/pinned (Violentmonkey) — see table
});
tab.close();
tab.onclose = () => console.log('Tab closed');
```

### Per-manager option sets (summary)

| Manager | Accepted second arg | Options / behaviour | Return handle |
| --- | --- | --- | --- |
| Tampermonkey | Object **or** boolean (`loadInBackground`) | `{ active, insert, setParent, incognito }` → handle `{ close(), onclose, closed }` | Object with `close`/`onclose`/`closed` |
| Violentmonkey | Object **or** boolean | `{ active, container, insert, pinned }` or boolean `active` → control object | Control object (`close` etc.) |
| Greasemonkey 4+ | Boolean or partial object; promise form preferred | `GM.openInTab(url, opts?)` returns `Promise` | Promise-based |
| Safari (Userscripts) | Boolean only | `GM_openInTab(url, bool?)` / `GM.openInTab(url, bool?)` — object options not supported | Minimal handle |

For the complete matrix, `loadInBackground` legacy alias, and `window.close` / `window.focus` grants see [api-tabs.md](api-tabs.md).

For the decision on object vs boolean, see [Decision Tables](#decision-tables) below.

---

## GM_registerMenuCommand(name, callback, options_or_accessKey)

Add an entry to the userscript manager's menu.

```javascript
// @grant GM_registerMenuCommand

// Simple usage (all managers that support menus)
const menuId = GM_registerMenuCommand('Say Hello', () => {
    alert('Hello!');
});

// With options — Tampermonkey 4.20+ / 5.0+ qualifiers apply
const menuId2 = GM_registerMenuCommand('Toggle Feature', (event) => {
    console.log('Clicked with:', event);
}, {
    accessKey: 't',       // Keyboard shortcut (Tampermonkey 4.20+, Violentmonkey)
    autoClose: true,      // Close menu after click (both)
    title: 'Enable or disable the feature',  // Tooltip — Tampermonkey 5.0+, Violentmonkey
    id: existingId        // Update existing command — Tampermonkey 5.0+, Violentmonkey
});

// Legacy access-key string (portable fallback)
const menuId3 = GM_registerMenuCommand('Quick Action', callback, 'q');
```

### Availability & options

| Manager | Support | Options shape | Notes |
| --- | --- | --- | --- |
| Tampermonkey | ✅ | `{ accessKey, autoClose }` **since Tampermonkey 4.20**; `{ id, title }` **since Tampermonkey 5.0** | Version qualifiers are Tampermonkey versions |
| Violentmonkey | ✅ | `{ autoClose, icon, id, title }` (also `accessKey` via compat) | `icon` is Violentmonkey-specific |
| Greasemonkey 4+ | ⚠️ Async-only re-added | `GM.registerMenuCommand` promise form only (issues greasemonkey/greasemonkey#2714 / #2770) | Sync `GM_registerMenuCommand` removed in 4.0 |
| Safari (Userscripts) | ❌ | — | No menu command API |

**Returns:** menu command ID for later removal (where supported).

---

## GM_unregisterMenuCommand(menuCmdId)

Remove a menu command.

```javascript
// @grant GM_unregisterMenuCommand

const menuId = GM_registerMenuCommand('Temporary', callback);
// Later...
GM_unregisterMenuCommand(menuId);
```

Portability mirrors `GM_registerMenuCommand` above: Tampermonkey and Violentmonkey support sync removal; Greasemonkey 4+ exposes `GM.unregisterMenuCommand` (promise); Safari has no menu API.

---

## GM_setClipboard(data, info, cb)

Copy data to the clipboard.

```javascript
// @grant GM_setClipboard

// Portable text copy (works in TM/VM; GM4/Safari use GM.setClipboard — see table)
GM_setClipboard('Hello, World!', 'text');

// Violentmonkey — simple type string
GM_setClipboard('Hello from VM', 'text');

// Tampermonkey — full info object or type string + optional callback
GM_setClipboard('<b>Bold</b>', 'html');
GM_setClipboard('Copied text', 'text', () => console.log('Clipboard set!'));
GM_setClipboard('Data', { type: 'text', mimetype: 'text/plain' });
```

### Per-manager signatures

| Manager | Sync form | Async form | Signature detail |
| --- | --- | --- | --- |
| Tampermonkey | ✅ `GM_setClipboard(data, info, cb?)` | ✅ `GM.setClipboard` also available | `info` may be `{ type, mimetype }` **or** `"text"` \| `"html"`; optional callback `cb` |
| Violentmonkey | ✅ `GM_setClipboard(data, type?)` | ✅ `GM.setClipboard` | `type` is optional string (`"text"` default); no `mimetype` object or callback in VM |
| Greasemonkey 4+ | ❌ | ✅ `GM.setClipboard(data, type?)` → `Promise<void>` | Promise only; no sync form |
| Safari (Userscripts) | ❌ | ✅ `GM.setClipboard` (deprecated upstream #655 but present) → `Promise<void>` | Promise-only subset |

If you need a single portable helper, branch on `typeof GM?.setClipboard === "function"` for the promise path and otherwise call `GM_setClipboard` with a plain string type.

---

## GM_download(details)
## GM_download(url, name)

Download a file.

```javascript
// @grant GM_download

// Simple download
GM_download('https://example.com/file.pdf', 'document.pdf');

// With options
const dl = GM_download({
    url: 'https://example.com/file.zip',
    name: 'archive.zip',
    saveAs: true,              // Prompt for location
    headers: { 'Authorization': 'Bearer token123' },
    onload: () => console.log('Complete!'),
    onerror: (error) => console.error('Failed:', error.error),
    onprogress: (progress) => console.log(`${progress.loaded}/${progress.total}`),
    ontimeout: () => console.log('Timed out')
});

// Cancel
dl.abort();
```

### Availability

| Manager | Support | Notes |
| --- | --- | --- |
| Tampermonkey | ✅ | Full `GM_download` / `GM.download`; `conflictAction` since Tampermonkey 4.18+; `url` accepts `Blob`/`File` since Tampermonkey 5.4.6226+; `anonymous` option since Tampermonkey 5.5.0 |
| Violentmonkey | ✅ since Violentmonkey 2.9.5 | `conflictAction` only in **browser download mode** (otherwise ignored) |
| Greasemonkey 4+ | ❌ | No native download API; a polyfill gist exists but is not built-in |
| Safari (Userscripts) | ❌ | — |

**Tampermonkey-only extensions (confirmed via documentation.php?q=GM_download and changelog):**

| Detail | Support | Notes |
|--------|---------|-------|
| `url` as `Blob` / `File` | Tampermonkey-only since 5.4.6226+ (changelog 5.4.0) | `url` may be a string URL **or** a `Blob`/`File` object |
| `anonymous` | Tampermonkey-only since 5.5.0 | Don't send cookies; uses initiator tab's cookie store (changelog "GM_download now uses the initiator tab’s cookie store and got an anonymous option") |

Verify: tampermonkey.net/documentation.php?q=GM_download · tampermonkey.net/changelog.php

**Whitelist requirement (Tampermonkey):** file extensions must be whitelisted in the Tampermonkey dashboard (Settings → Security / Downloads) or the download is blocked. This is a **Tampermonkey dashboard setting**, not a script header.

**Error enum (Tampermonkey):**

| Value | Meaning |
| --- | --- |
| `not_enabled` | Download feature disabled in dashboard |
| `not_whitelisted` | Extension not allowed by whitelist |
| `not_permitted` | Missing permission |
| `not_supported` | Browser does not support downloads |
| `not_succeeded` | Download failed |

Violentmonkey surfaces a subset of these errors; always handle `onerror` generically.

---

## GM_getResourceText(name)

Get text content of a preloaded `@resource`.

```javascript
// @resource myCSS https://example.com/style.css
// @grant GM_getResourceText
// @grant GM_addStyle

const css = GM_getResourceText('myCSS');
GM_addStyle(css);
```

Portability: Tampermonkey and Violentmonkey support sync `GM_getResourceText`. Greasemonkey 4+ does NOT implement it (nor a promise form) — greasemonkey/greasemonkey#2548 remains open; use `fetch(await GM.getResourceUrl(name)).then(r => r.text())` there. Safari does not implement `@resource` at all. Promise form `GM.getResourceText` exists where noted in [managers.md](managers.md).

---

## GM_getResourceURL(name)

Get a data URL for a preloaded `@resource`.

```javascript
// @resource myIcon https://example.com/icon.png
// @grant GM_getResourceURL

const iconUrl = GM_getResourceURL('myIcon');
const img = document.createElement('img');
img.src = iconUrl;
document.body.appendChild(img);
```

Portability: Tampermonkey (`data:` URL) and Violentmonkey (`isBlobUrl` since Violentmonkey 2.13.1) support it. Greasemonkey 4+ has no sync form; Safari has no resources. Promise form is `GM.getResourceUrl` (note lowercase `rl`) — see [managers.md](managers.md) and [api-async.md](api-async.md).

---

## unsafeWindow

Access the page's actual window object (not the sandbox). **Canonical detail — including the grant matrix and injection bridges — lives in [api-dom-ui.md](api-dom-ui.md).** This section is a portable summary.

```javascript
// @grant unsafeWindow

// Access page variables
console.log(unsafeWindow.pageConfig);

// Call page functions
unsafeWindow.showModal('Hello from userscript!');

// Modify page globals
unsafeWindow.DEBUG_MODE = true;
```

**Warning:** use carefully — can break if page structure changes.

### Grant / exposure differences (summary)

| Manager | Grant behaviour | Notes |
| --- | --- | --- |
| Tampermonkey | Needs **explicit `@grant unsafeWindow`** when any other `@grant` is present; otherwise sandbox rules apply | `@sandbox raw` / `javascript` / `dom` (Tampermonkey 4.18+) controls world |
| Violentmonkey | Exposed **without** an explicit grant; sandbox is only fully disabled with `@grant none` (since Violentmonkey 2.32) | `@inject-into auto` / `page` / `content` controls world |
| Greasemonkey 4+ | Exposed without grant (`window.wrappedJSObject` equivalent, Xray vision) | Always sandboxed; use `wrappedJSObject`/`cloneInto`/`exportFunction` bridges |
| Safari (Userscripts) | ❌ **Absent entirely** — no `unsafeWindow` at all; any `@grant` forces content world | Design without page-world access |

For the full grant table, page-CSP handling, and `CustomEvent`/`postMessage` / `wrappedJSObject` / `cloneInto` bridges see [api-dom-ui.md](api-dom-ui.md) and [managers.md](managers.md) §4.

---

## Decision Tables

### Notification: object syntax vs positional syntax

| Use | Syntax | When to choose |
| --- | --- | --- |
| Preferred (portable) | `GM_notification({ text, title, image, timeout, onclick, ondone, ... })` | Always for new code; supports all manager extras and is the only form Greasemonkey 4+ documents for object style |
| Legacy / compat | `GM_notification(text, title, image, onclick)` | Only when targeting very old scripts or when mirroring Greasemonkey positional examples; wrap in a helper that normalises to the object form |

### openInTab: options object vs boolean

| Use | Syntax | When to choose |
| --- | --- | --- |
| Preferred (portable future-proof) | `GM_openInTab(url, { active: true, insert: true })` | When you need to control focus/insert/container/incognito; Violentmonkey worked example |
| Minimal / Safari-compat | `GM_openInTab(url, true)` or `GM_openInTab(url, false)` | When only focus matters and you must stay compatible with Safari / Greasemonkey bool shims; document that object options are ignored there |

---

## Promise Equivalents

Every API above has a `GM.*` promise counterpart where the manager supports it. For the async contracts, availability, and abort/return semantics see [api-async.md](api-async.md):

| Sync (`GM_*`) | Promise (`GM.*`) | Note |
| --- | --- | --- |
| `GM_notification` | `GM.notification` | `Promise<boolean>` is Tampermonkey-only; others resolve `void` |
| `GM_openInTab` | `GM.openInTab` | Manager option sets differ — see [api-tabs.md](api-tabs.md) |
| `GM_registerMenuCommand` | `GM.registerMenuCommand` | Greasemonkey 4+ async-only |
| `GM_setClipboard` | `GM.setClipboard` | Signature variants per manager — see table above |
| `GM_download` | `GM.download` | Tampermonkey + Violentmonkey only |
| `GM_addStyle` | `GM.addStyle` | Safari partial impl |
| `GM_addElement` | `GM.addElement` | TM + Violentmonkey 2.13.1+ |
| `GM_getResourceText` / `GM_getResourceURL` | `GM.getResourceText` / `GM.getResourceUrl` | Lowercase `rl` in promise form |

---

## Cloud Sync — How Managers Sync Scripts & Settings Across Devices

> File-name note: `api-sync.md` = **synchronous** APIs, not cloud sync. The section below is the cloud-sync companion so the confusing name does not mislead (verified 2026-08-24).

### What is NOT cloud-synced

| Fact | Detail | Source |
| --- | --- | --- |
| `GM_setValue` / `GM_getValue` storage is **local only** | Values persist per extension storage / IndexedDB on that browser profile. No native cross-device sync. Use Google Drive / WebDAV etc. **from script code** to sync data yourself. Tampermonkey issue #453: “storage.sync is severely limited … not suited for anything that can grow unpredictably … use Google Drive or similar to sync data by your own” | `github.com/Tampermonkey/tampermonkey/issues/453` (verified 2026-08-24) |
| `GM_saveBlob` **does not exist** | No `GM_saveBlob` in Tampermonkey, Violentmonkey, or Greasemonkey. Confusable with `GM_download(Blob\|File)` (Tampermonkey 5.4.6226+ accepts Blob/File) or `GM_setValue` binary handling. If you need blob persistence, store via `GM_download` or encode to string | Tampermonkey docs API list (`documentation.php?q=GM_values`, `q=GM_download`) and `violentmonkey.github.io/api/gm/` list no such API — omission is the proof (verified 2026-08-24) |
| `GM_addValueChangeListener` `remote` is **cross-tab**, not cloud | Callback `(key, oldValue, newValue, remote)` — `remote === true` means another tab’s script instance changed the value. Useful for multi-tab coordination, not for cloud sync | `violentmonkey.github.io/types/types/VMScriptGMValueChangeCallback.html` + `tampermonkey.net/documentation.php?q=GM_values` (verified 2026-08-24) |

### Tampermonkey — Script Sync (cloud)

| Topic | Detail | Source |
| --- | --- | --- |
| **Supported sync services** (as of 2026-08-24) | **Google Drive**, **Dropbox**, **WebDAV** (incl. proprietary **TamperDAV** speedups), **Browser Sync** (browser-internal). OneDrive appears in changelog for *backup/restore* but FAQ Q105 does **not** list it as a Script Sync target — treat as backup-only | `tampermonkey.net/faq.php?q=Q105` (verified 2026-08-24) |
| **Enablement** | Dashboard → **Settings** tab → set **Config Mode** to **Beginner** or **Advanced** → **Script Sync** section → choose service → **Enable Script Sync** → **Save** | `faq.php?q=Q105` steps 1-5 (verified 2026-08-24) |
| **Frequency** | **WebDAV / TamperDAV:** remote changes within **~1 s**, local changes within **~1 min**, script-update triggers a pre-executed sync. **Other clouds (Drive/Dropbox/Browser):** poll every **~10 min**. Background quotas prevent faster polling on Drive/Dropbox | `github.com/Tampermonkey/tampermonkey/issues/2414` derjanb comment (verified 2026-08-24) |
| **Conflict resolution** | “In case of a conflict the change with the most recent **modification date** will win.” (FAQ Q105 final line; also #2414/#2659) | `faq.php?q=Q105` + issues #2414, #2659 (verified 2026-08-24) |
| **What is synced vs not** | **Synced:** full script sources (code + metadata + resources) for Drive/Dropbox/WebDAV. **Browser Sync only:** list of **download URLs** ( `http`/`https` `@downloadURL` ) — not sources. **Not synced:** `GM_setValue` storage (#825, #453), per-device **enabled/disabled** state (#2414 “enabled state is not synced”), local edits without a remote URL when using Browser Sync (#2659 “nothing. They are not synced.”) | `faq.php?q=Q105` + issues #2659, #2414, #825 (verified 2026-08-24) |
| **Browser Sync limitations** | Very limited quota; requires browser sign-in; needs a publicly accessible URL per script (`@downloadURL` http/https); local modifications are **lost** if you rely on Browser Sync. Prefer Drive/Dropbox/WebDAV for edited scripts | `faq.php?q=Q105` + issue #2659 “Yes, exactly … only sync of the list of downloadUrls … local modifications: nothing” (verified 2026-08-24) |
| **Backup vs Sync** | **Script Sync** = continuous background sync (section above). **Utilities → Cloud Export** = **manual** zip/JSON backup/restore to Drive/Dropbox/OneDrive/WebDAV — triggered only by explicit Export/Import clicks | issue #2414 “Utilities > Cloud > Export, then yes [manual]” + FAQ Q105 scope (verified 2026-08-24) |
| **Security / privacy** | Google Drive: uses hidden **appDataFolder** (not visible in Drive UI, per OAuth app-data scope). Dropbox: files **visible** in your Dropbox. WebDAV: Tampermonkey will **not run scripts at the server’s URLs** while sync is enabled | `faq.php?q=Q105` (“special folder which solely contains app data” / Dropbox note / WebDAV note) + `github.com/violentmonkey/violentmonkey/discussions/1155` (verified 2026-08-24) |

### Violentmonkey — Sync

| Topic | Detail | Source |
| --- | --- | --- |
| **Services** | **Dropbox**, **OneDrive**, **Google Drive**, **WebDAV**, **S3-compatible** (S3 added since Violentmonkey 2.37.4 via #2521) | `violentmonkey.github.io` homepage (“Sync to Dropbox, OneDrive, Google Drive, or a WebDAV service.”) + `github.com/violentmonkey/violentmonkey` releases v2.37.4 / `src/background/sync/s3.js` + `src/options/views/tab-settings/vm-sync.vue` (verified 2026-08-24) |
| **Why third-party, not `browser.storage.sync`** | `browser.storage.sync` is for small preferences: **~100 KB** quota (smaller than a feature-rich script), **same-browser only**, and absent in some browsers. Third-party gives larger quota + cross-browser (Chrome ↔ Firefox ↔ Vivaldi etc.) | `violentmonkey.github.io/faq/` “Why are third-party sync services used instead of native ones?” (verified 2026-08-24) |
| **Behaviour** | Same model as Tampermonkey: enable in Violentmonkey settings → Authorize OAuth (Drive/Dropbox/OneDrive) or enter WebDAV/S3 credentials → changes propagate on same ~poll intervals as TM (check Violentmonkey sync docs for current frequency). App-data folder hidden for Google Drive, visible for Dropbox (discussion #1155) | `violentmonkey.github.io/faq/` + discussion #1155 + `violentmonkey.github.io/api/gm/` (verified 2026-08-24) |

### Tab-scoped storage — `GM_getTab` / `GM_saveTab` / `GM_getTabs` (Tampermonkey-only)

| API | Detail | Source |
| --- | --- | --- |
| `GM_getTab(callback)` / `GM.getTab()` | Returns an object **persistent as long as this tab is open** (isolated per script). Survives navigation but not tab close | `tampermonkey.net/documentation.php?q=GM_tabs` (verified 2026-08-24) |
| `GM_saveTab(tab)` / `GM.saveTab(tab)` | Persists the modified tab object for later `GM_getTab` / `GM_getTabs` reads | same doc (verified 2026-08-24) |
| `GM_getTabs(callback)` / `GM.getTabs()` | Returns map `{ tabId: tabObject }` of all tabs running the script — for multi-tab coordination | same doc (verified 2026-08-24) |
| Violentmonkey | **WONTFIX** — “There's just 24 scripts on greasyfork that use `GM_getTab` so we won't implement it.” Approximate with `GM_setValue` + `GM_addValueChangeListener(remote)` if needed | `github.com/violentmonkey/violentmonkey/issues/1120` (verified 2026-08-24) |
| Greasemonkey / Safari | No support; Greasemonkey #2484 family / Userscripts #667 deprecation | wiki.greasespot.net + `github.com/quoid/userscripts/issues/667` (verified 2026-08-24) |

---

## See Also

- [managers.md](managers.md) — normative Support Matrix, injection/sandbox models, and detection snippet
- [api-async.md](api-async.md) — promise-based `GM.*` reference
- [api-storage.md](api-storage.md) — storage sync + batch
- [http-requests.md](http-requests.md) — `GM_xmlhttpRequest` full matrix
- [api-tabs.md](api-tabs.md) — tab handles, `GM_getTab`/`saveTab`/`getTabs`
- [api-dom-ui.md](api-dom-ui.md) — `unsafeWindow`, CSP, `GM_addStyle`/`GM_addElement` patterns
- [api-cookies.md](api-cookies.md) — `GM_cookie` / `GM.cookie`
