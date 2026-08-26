# Synchronous GM_* API Reference — Sync UI / Info / Menu / Tab Reference

This reference covers the synchronous `GM_*` surface for UI, script info, menu, and tab helpers. It is **not** an exhaustive `GM_*` catalogue — storage, networking, web-request, cookies, and richer DOM/UI or tab storage details live in dedicated references. For promise-based `GM.*` equivalents see [api-async.md](api-async.md).

> **Portability floor:** synchronous `GM_*` is **Tampermonkey / Violentmonkey only** — Greasemonkey 4+ removed every sync form and Safari exposes only a promise subset. For portable scripts use `GM.*` promises with feature detection and degrade when `GM.*` is absent. Manager facts below follow [managers.md](managers.md); when a concrete manager is shown, **Violentmonkey** is the worked example. (verified 2026-08-25 — violentmonkey.github.io/api/gm Since tags VM2.19.1/VM2.13.1/VM2.12.5, tampermonkey.net/documentation.php?q=GM_values batch v5.3+, wiki.greasespot.net/GM.setValue primitives-only)

> **Disambiguation — “sync” = synchronous, not cloud sync:** This file documents **synchronous** `GM_*` APIs (`GM_setValue`/`GM_getValue` etc., which persist **locally** per extension storage / IndexedDB) — they are **not** cloud/browser-synced. Cloud sync of saved scripts/settings across devices is a separate manager feature; see [Cloud Sync](#cloud-sync-how-managers-sync-scripts-settings-across-devices) below (verified 2026-08-25 — wiki.greasespot.net/GM.setValue, tampermonkey.net/documentation.php?q=GM_values, violentmonkey.github.io/api/gm).

## Scope & Related References

| Topic | Canonical reference | What lives there vs here |
| --- | --- | --- |
| Storage (`GM_getValue`/`setValue`/`listValues`, batch `getValues`/`setValues`/`deleteValues`, listeners) | [api-storage.md](api-storage.md) | Full sync + async patterns, batch availability, value-type rules |
| HTTP (`GM_xmlhttpRequest` / `GM.xmlHttpRequest`) | [http-requests.md](http-requests.md) | Full option matrix, `@connect` enforcement, streaming, abort semantics |
| Request interception (`GM_webRequest`) | [web-requests.md](web-requests.md) | `@webRequest` header, Firefox MV2-only, VM/GM/Safari support |
| Cookies (`GM_cookie` / `GM.cookie`) | [api-cookies.md](api-cookies.md) | `list`/`set`/`delete`, filter differences, `partitionKey` support |
| DOM & UI (`unsafeWindow`, `GM_addStyle`, `GM_addElement` deep dive) | [api-dom-ui.md](api-dom-ui.md) | Canonical `unsafeWindow` grant matrix, CSP bypass details, UI patterns |
| Tabs & cross-tab (`GM_openInTab` full options, `GM_getTab`/`saveTab`/`getTabs`, `onurlchange`) | [api-tabs.md](api-tabs.md) | Canonical `GM_openInTab` option sets and handles, tab-persistent storage, SPA navigation |

---

## GM_info

Get information about the script and the userscript manager. No `@grant` required. `GM_info` is sync — do not `await` it.

```javascript
// Portable — works in every manager (GM_info vs GM.info fallback)
const info = typeof GM_info !== "undefined" ? GM_info : GM.info;
console.log(info.script.name);
console.log(info.scriptHandler); // "Tampermonkey" | "Violentmonkey" | "Greasemonkey" | "Userscripts"
console.log(info.version);
```

### Key properties (portable subset)

| Property | Type | Notes |
|----------|------|-------|
| `script.name` / `version` / `description` / `namespace` | string | Portable metadata |
| `script.matches` / `includes` / `excludes` / `grant` | string[] | Portable header mirrors |
| `scriptHandler` | string | Exact literal — see table below |
| `version` | string | Manager version |
| `isIncognito` / `downloadMode` | boolean/string | Present in TM/VM; absent in GM4+/Safari — feature-detect |
| `sandboxMode` | string | **Tampermonkey-only** (`js` \| `raw` \| `dom`) |
| `injectInto` | string | **Violentmonkey-only** (`auto` \| `page` \| `content`) |
| `container` / `isFirstPartyIsolation` / `userAgentData` / `script.options` | object/boolean | **Tampermonkey-only** — do not branch on without detection |

### scriptHandler literals

| Literal | Manager |
| --- | --- |
| `"Tampermonkey"` | Tampermonkey |
| `"Violentmonkey"` | Violentmonkey |
| `"Greasemonkey"` | Greasemonkey 4+ |
| `"Userscripts"` | Safari "Userscripts" app (quoid/userscripts) |

### Per-manager field differences (portability)

| Manager | Notes |
| --- | --- |
| Tampermonkey | Fullest surface (`sandboxMode`, extended `script` metadata). |
| Violentmonkey | `injectInto` + `platform` instead of `sandboxMode`. |
| Greasemonkey 4+ | `GM.info` promise world, **fewer fields** — sandbox/injection fields absent. |
| Safari (Userscripts) | **Subset** — `script` metadata + `scriptHandler` + `version` only; any `@grant` forces content-world. |

**Feature-detect guidance:** prefer `typeof GM_info !== "undefined" ? GM_info : GM.info` and test field existence (`if ("injectInto" in info)`) over `scriptHandler` branching. Capability checks (`typeof GM?.getValues === "function"`) are more portable than handler checks.

> (verified 2026-08-25 — violentmonkey.github.io/api/gm#gm_info, tampermonkey.net/documentation.php?q=GM_info, wiki.greasespot.net/GM.info)

---

## GM_log(message)

Log a message to the console.

```javascript
// @grant GM_log
GM_log('Debug message');
```

Portability: Tampermonkey and Violentmonkey support `GM_log` (alias for `console.log`). Greasemonkey 4+ removed it — use `console.log` there. Safari has no `GM_log`. For portable code prefer `console.log` and reserve `GM_log` for legacy scripts. (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_log, violentmonkey.github.io/api/gm)

---

## GM_addStyle(css)

Add CSS styles to the document.

```javascript
// @grant GM_addStyle
const styleEl = GM_addStyle(`.my-class { display: none !important; }`);
if (styleEl) styleEl.dataset.owner = "my-script"; // feature-detect return value
```

### Availability

| Manager | Sync `GM_addStyle(css)` | Portable fallback |
| --- | --- | --- |
| Tampermonkey | ✅ Returns `<style>` element | Feature-detect return value before `.remove()` |
| Violentmonkey | ✅ Returns `<style>` element | Same contract as Tampermonkey |
| Greasemonkey 4+ | ❌ Removed in 4.0 | Use `GM.addStyle` promise or `document.createElement('style')` |
| Safari (Userscripts) | ❌ Deprecated | Prefer promise `GM.addStyle(css)` (partial impl) |

For removal/toggle patterns see [api-dom-ui.md](api-dom-ui.md). (verified 2026-08-25 — violentmonkey.github.io/api/gm#gm_addstyle, tampermonkey.net/documentation.php?q=GM_addStyle)

---

## GM_addElement(tag_name, attributes)
## GM_addElement(parent_node, tag_name, attributes)

Create and inject HTML elements. CSP bypass is **Tampermonkey / Violentmonkey only**.

```javascript
// @grant GM_addElement
// Portable feature-detect — CSP bypass only where supported
if (typeof GM_addElement !== "undefined") {
  GM_addElement('script', { textContent: 'window.myVar = "injected";' });
} else {
  const s = document.createElement('script');
  s.textContent = 'window.myVar = "injected";';
  document.head.appendChild(s);
}
```

### Availability

| Manager | Support | Return value | Async form |
| --- | --- | --- | --- |
| Tampermonkey | ✅ | Returns element | `GM.addElement(...)` promise also available |
| Violentmonkey | ✅ | Returns element (sync) | Also `GM.addElement(...)` promise |
| Greasemonkey 4+ | ❌ | — | ❌ |
| Safari (Userscripts) | ❌ | — | ❌ |

CSP-bypass note: the ability to inject `<script>`/`<style>` past a strict page CSP is a **Tampermonkey / Violentmonkey** implementation detail. Greasemonkey and Safari do not offer it via this API. For CSP discussion and `page` vs `content` injection fallbacks see [managers.md](managers.md) §4 and [api-dom-ui.md](api-dom-ui.md). (verified 2026-08-25 — violentmonkey.github.io/api/gm#gm_addelement Since VM2.13.1, tampermonkey.net/documentation.php?q=GM_addElement, tampermonkey.net/changelog.php v5.5.0 rework)

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
| `onclick` | function | Click handler (`event.preventDefault()` may suppress default) |
| `ondone` | function | Close/dismiss handler |

```javascript
// @grant GM_notification — portable core (use callbacks for click detection)
GM_notification({
  text: 'Download complete!',
  title: 'My Script',
  timeout: 5000,
  onclick: (e) => e.preventDefault(),
  ondone: () => console.log('Closed')
});
```

### Manager extras (affects degradation)

| Manager | Extra fields | Notes |
| --- | --- | --- |
| Tampermonkey | `highlight`, `silent`, `url`, `tag` | Most feature-rich; promise `GM.notification` → `Promise<boolean>` is TM-only |
| Violentmonkey | `silent`, `tag`, `zombieTimeout`, `zombieUrl` | Returns control object; promise form exists |
| Greasemonkey 4+ | — (core fields only) | Use `GM.notification` promise; also accepts positional args |
| Safari (Userscripts) | ❌ | No notification API at all |

Positional-args legacy form `GM_notification('text','title','image', onclick)` is compat-only — prefer the object form for new portable code.

`await GM.notification(details)` → `Promise<boolean>` (`true` if clicked) is **Tampermonkey-only**. Violentmonkey and Greasemonkey 4+ promise forms resolve `void` — rely on `onclick`/`ondone` callbacks for portable click detection. See [api-async.md](api-async.md) for the async contract. (verified 2026-08-25 — violentmonkey.github.io/api/gm#gm_notification, tampermonkey.net/documentation.php?q=GM_notification v5.0+ tag/url)

---

## GM_openInTab(url, options)
## GM_openInTab(url, loadInBackground)

Open a new browser tab. Canonical option/handle table lives in [api-tabs.md](api-tabs.md) — this section is a manager-qualified summary.

```javascript
// @grant GM_openInTab
// Portable baseline (works everywhere that supports the API)
GM_openInTab('https://example.com/');

// Feature-detect handle before using
const tab = GM_openInTab('https://example.com/', { active: true, insert: true });
if (tab && typeof tab.close === "function") tab.close();
```

### Per-manager option sets (summary)

| Manager | Accepted second arg | Notes |
| --- | --- | --- |
| Tampermonkey | Object **or** boolean | `{ active, insert, setParent, incognito }` → handle `{ close, onclose, closed }` |
| Violentmonkey | Object **or** boolean | `{ active, container, insert, pinned }` → control object |
| Greasemonkey 4+ | Boolean or partial object; promise form preferred | `GM.openInTab(url, opts?)` → `Promise` |
| Safari (Userscripts) | Boolean only | `GM_openInTab(url, bool?)` — object options not supported |

For the complete matrix, `loadInBackground` legacy alias, and `window.close` / `window.focus` grants see [api-tabs.md](api-tabs.md). (verified 2026-08-25 — violentmonkey.github.io/api/gm#gm_openintab Since VM2.11.0/VM2.12.5, tampermonkey.net/documentation.php?q=GM_openInTab)

---

## GM_registerMenuCommand(name, callback, options_or_accessKey)

Add an entry to the userscript manager's menu.

```javascript
// @grant GM_registerMenuCommand
// Portable — object form degrades to legacy string key where unsupported
const menuId = GM_registerMenuCommand('Say Hello', () => alert('Hello!'));
const menuId2 = GM_registerMenuCommand('Toggle', () => {}, { accessKey: 't', autoClose: true, title: 'Toggle' });
```

### Availability

| Manager | Support | Notes |
| --- | --- | --- |
| Tampermonkey | ✅ | Options include `accessKey`, `autoClose`, `id`, `title` |
| Violentmonkey | ✅ | Options include `autoClose`, `icon`, `id`, `title`, `accessKey` (compat) |
| Greasemonkey 4+ | ⚠️ Async-only | `GM.registerMenuCommand` promise form only |
| Safari (Userscripts) | ❌ | No menu command API |

**Returns:** menu command ID for later removal (where supported). (verified 2026-08-25 — violentmonkey.github.io/api/gm#gm_registermenucommand Since VM2.15.9, tampermonkey.net/documentation.php?q=GM_registerMenuCommand v4.20/v5.0)

---

## GM_unregisterMenuCommand(menuCmdId)

Remove a menu command.

```javascript
// @grant GM_unregisterMenuCommand
const menuId = GM_registerMenuCommand('Temporary', () => {});
GM_unregisterMenuCommand(menuId);
```

Portability mirrors `GM_registerMenuCommand` above: Tampermonkey and Violentmonkey support sync removal; Greasemonkey 4+ exposes `GM.unregisterMenuCommand` (promise); Safari has no menu API. (verified 2026-08-25 — violentmonkey.github.io/api/gm#gm_unregistermenucommand, tampermonkey.net/documentation.php?q=GM_unregisterMenuCommand)

---

## GM_setClipboard(data, info, cb)

Copy data to the clipboard.

```javascript
// @grant GM_setClipboard
// Portable — branch on promise surface, otherwise plain string type
if (typeof GM !== "undefined" && typeof GM.setClipboard === "function") {
  await GM.setClipboard('Hello', 'text');
} else {
  GM_setClipboard('Hello', 'text');
}
```

### Per-manager signatures

| Manager | Sync form | Async form | Notes |
| --- | --- | --- | --- |
| Tampermonkey | ✅ `GM_setClipboard(data, info, cb?)` | ✅ `GM.setClipboard` | `info` may be `{ type, mimetype }` or `"text"` \| `"html"` |
| Violentmonkey | ✅ `GM_setClipboard(data, type?)` | ✅ `GM.setClipboard` | `type` optional string (`"text"` default) |
| Greasemonkey 4+ | ❌ | ✅ `GM.setClipboard(data, type?)` → `Promise<void>` | Promise only |
| Safari (Userscripts) | ❌ | ✅ `GM.setClipboard` → `Promise<void>` | Promise-only subset |

(verified 2026-08-25 — violentmonkey.github.io/api/gm#gm_setclipboard, tampermonkey.net/documentation.php?q=GM_setClipboard, github.com/quoid/userscripts README for Safari GM.setClipboard subset)

---

## GM_download(details)
## GM_download(url, name)

Download a file.

```javascript
// @grant GM_download
// Portable feature-detect — TM/VM only; GM4/Safari have no download API
if (typeof GM_download === "function") {
  GM_download({ url: 'https://example.com/file.pdf', name: 'document.pdf', saveAs: true, onload: () => console.log('done'), onerror: e => console.error(e.error) });
} else if (typeof GM !== "undefined" && typeof GM.download === "function") {
  await GM.download({ url: 'https://example.com/file.pdf', name: 'document.pdf' });
}
```

### Availability

| Manager | Support | Notes |
| --- | --- | --- |
| Tampermonkey | ✅ | Whitelist + `conflictAction`; extension-gated `Blob`/`File` URL and `anonymous` — see TM docs |
| Violentmonkey | ✅ | `conflictAction` only in browser download mode |
| Greasemonkey 4+ | ❌ | No native download API |
| Safari (Userscripts) | ❌ | — |

Tampermonkey dashboard whitelist and error enum (`not_enabled` / `not_whitelisted` / `not_permitted` / `not_supported` / `not_succeeded`) are TM-specific — handle `onerror` generically for portability. (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_download url Blob/File v5.4.6226+, tampermonkey.net/changelog.php v5.5.0 anonymous, violentmonkey.github.io/api/gm Since VM2.9.5)

---

## GM_getResourceText(name)

Get text content of a preloaded `@resource`.

```javascript
// @resource myCSS https://example.com/style.css
// @grant GM_getResourceText
// @grant GM_addStyle
if (typeof GM_getResourceText === "function") {
  const css = GM_getResourceText('myCSS');
  GM_addStyle(css);
} else {
  const url = await GM.getResourceUrl('myCSS'); // portable fallback where available
  const css = await fetch(url).then(r => r.text());
}
```

Portability: Tampermonkey and Violentmonkey support sync `GM_getResourceText`. Greasemonkey 4+ does NOT implement it — use `fetch(await GM.getResourceUrl(name)).then(r => r.text())` there. Safari does not implement `@resource` at all. (verified 2026-08-25 — violentmonkey.github.io/api/gm#gm_getresourcetext, tampermonkey.net/documentation.php?q=GM_getResourceText)

---

## GM_getResourceURL(name)

Get a data URL for a preloaded `@resource`.

```javascript
// @resource myIcon https://example.com/icon.png
// @grant GM_getResourceURL
if (typeof GM_getResourceURL === "function") {
  const iconUrl = GM_getResourceURL('myIcon');
  document.body.appendChild(Object.assign(document.createElement('img'), { src: iconUrl }));
}
```

Portability: Tampermonkey (`data:` URL) and Violentmonkey support it. Greasemonkey 4+ has no sync form; Safari has no resources. Promise form is `GM.getResourceUrl` (lowercase `rl`) — see [managers.md](managers.md) and [api-async.md](api-async.md). (verified 2026-08-25 — violentmonkey.github.io/api/gm#gm_getresourceurl Since VM2.13.1, tampermonkey.net/documentation.php?q=GM_getResourceURL)

---

## unsafeWindow

Access the page's actual window object (not the sandbox). **Canonical detail — including the grant matrix and injection bridges — lives in [api-dom-ui.md](api-dom-ui.md).** This section is a portable summary.

```javascript
// @grant unsafeWindow
// Portable guard — absent in Safari
if (typeof unsafeWindow !== "undefined") {
  console.log(unsafeWindow.pageConfig);
}
```

### Grant / exposure differences (summary)

| Manager | Grant behaviour | Notes |
| --- | --- | --- |
| Tampermonkey | Needs explicit `@grant unsafeWindow` when other `@grant`s present | `@sandbox` controls world |
| Violentmonkey | Exposed without explicit grant; sandbox off only with `@grant none` | `@inject-into` controls world |
| Greasemonkey 4+ | Exposed without grant (Xray) | Use `wrappedJSObject`/`cloneInto` bridges |
| Safari (Userscripts) | ❌ **Absent entirely** | Any `@grant` forces content world |

For the full grant table, page-CSP handling, and `CustomEvent`/`postMessage` / `wrappedJSObject` / `cloneInto` bridges see [api-dom-ui.md](api-dom-ui.md) and [managers.md](managers.md) §4. (verified 2026-08-25 — violentmonkey.github.io/api/gm#unsafewindow, tampermonkey.net/documentation.php?q=GM_info, github.com/quoid/userscripts README Safari no unsafeWindow)

---

## Promise Equivalents

Every API above has a `GM.*` promise counterpart where the manager supports it. For portability, **prefer `GM.*` promises** — they are the only form Greasemonkey 4+ implements. For async contracts see [api-async.md](api-async.md): (verified 2026-08-25 — violentmonkey.github.io/api/gm GM.* aliases Since VM2.12.0, tampermonkey.net/documentation.php, github.com/quoid/userscripts README)

| Sync (`GM_*`) | Promise (`GM.*`) | Portable note |
| --- | --- | --- |
| `GM_notification` | `GM.notification` | `Promise<boolean>` is Tampermonkey-only; others resolve `void` — use callbacks |
| `GM_openInTab` | `GM.openInTab` | Option sets differ — see [api-tabs.md](api-tabs.md) |
| `GM_registerMenuCommand` | `GM.registerMenuCommand` | Greasemonkey 4+ async-only |
| `GM_setClipboard` | `GM.setClipboard` | Signature variants per manager — see table above |
| `GM_download` | `GM.download` | Tampermonkey + Violentmonkey only |
| `GM_addStyle` | `GM.addStyle` | Safari partial impl |
| `GM_addElement` | `GM.addElement` | TM + Violentmonkey only |
| `GM_getResourceText` / `GM_getResourceURL` | `GM.getResourceText` / `GM.getResourceUrl` | Lowercase `rl` in promise form |

Feature-detect the promise surface rather than branching on `scriptHandler`:

```javascript
const canNotify = typeof GM !== "undefined" && typeof GM.notification === "function";
const canDownload = typeof GM !== "undefined" && typeof GM.download === "function";
```

---

## Cloud Sync — How Managers Sync Scripts & Settings Across Devices

> File-name note: `api-sync.md` = **synchronous** APIs, not cloud sync. The section below is the cloud-sync companion so the confusing name does not mislead (verified 2026-08-25 — tampermonkey.net/faq.php?q=Q105, violentmonkey.github.io/faq/).

Portable scripts must assume **GM storage is local-only** and not cloud-synced; implement app-level sync via network if needed. Manager-level script sync is dashboard-controlled, not script-controlled.

| Fact | Detail |
| --- | --- |
| `GM_setValue` / `GM_getValue` storage is **local only** | Values persist per extension storage / IndexedDB on that browser profile. No native cross-device sync. (verified 2026-08-25 — `github.com/Tampermonkey/tampermonkey/issues/453`) |
| `GM_saveBlob` **does not exist** | No such API — use `GM_download(Blob\|File)` (TM 5.4.6226+) or encode to string. (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_values / q=GM_download, violentmonkey.github.io/api/gm/ list no such API) |
| `GM_addValueChangeListener` `remote` is **cross-tab**, not cloud | `remote === true` means another tab’s instance changed the value. (verified 2026-08-25 — violentmonkey.github.io/types/types/VMScriptGMValueChangeCallback.html + tampermonkey.net/documentation.php?q=GM_values) |

For manager-specific sync services, frequencies, conflict rules, and tab-scoped storage (`GM_getTab`/`saveTab`/`getTabs` — Tampermonkey-only, Violentmonkey WONTFIX #1120) see [managers.md](managers.md) §7, [api-tabs.md](api-tabs.md), and the manager FAQs: [tampermonkey.net/faq.php?q=Q105](https://www.tampermonkey.net/faq.php?q=Q105) · [violentmonkey.github.io/faq/](https://violentmonkey.github.io/faq/).

---

## See Also

- [managers.md](managers.md) — normative Support Matrix, injection/sandbox models, and detection snippet
- [api-async.md](api-async.md) — promise-based `GM.*` reference
- [api-storage.md](api-storage.md) — storage sync + batch
- [http-requests.md](http-requests.md) — `GM_xmlhttpRequest` full matrix
- [api-tabs.md](api-tabs.md) — tab handles, `GM_getTab`/`saveTab`/`getTabs`
- [api-dom-ui.md](api-dom-ui.md) — `unsafeWindow`, CSP, `GM_addStyle`/`GM_addElement` patterns
- [api-cookies.md](api-cookies.md) — `GM_cookie` / `GM.cookie`
