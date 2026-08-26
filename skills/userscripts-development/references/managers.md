# Userscript Managers — Support Matrix & Workflows

Per-manager facts for writing portable userscripts. Normative guidance stays manager-neutral; when a concrete manager must be exemplified, use **Violentmonkey** (the skill owner's manager). Every manager-specific fact below is labeled. Anything not confirmed against official docs is marked **UNVERIFIED** — do not present it as fact.

Managers covered: **TM** = Tampermonkey · **VM** = Violentmonkey · **GM4+** = Greasemonkey 4 and later · **Safari** = Safari "Userscripts" app (quoid/userscripts). Other managers (ScriptCat, AdGuard, FireMonkey, mobile, OrangeMonkey) are tier-2 — see [manager-compat.md](manager-compat.md) for divergences; verify against their own docs before claiming support.

---

## 1. Manager Roster

| Manager | Browsers | Script model | Notes |
| --- | --- | --- | --- |
| Violentmonkey | Chrome/Edge/Firefox (+ Firefox Android) | `GM_*` sync AND `GM.*` promises | Owner default. Open source. | (verified 2026-08-25 — https://violentmonkey.github.io/api/gm/ — GM.* Since VM2.12.0)
| Tampermonkey | Chrome/Edge (MV3), Firefox (MV2), Safari (paid app) | `GM_*` sync AND `GM.*` promises | Largest feature surface; several TM-only APIs below. | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php, https://www.tampermonkey.net/changelog.php)
| Greasemonkey 4+ | Firefox only | `GM.*` promises ONLY | All sync `GM_*` removed in 4.0. Storage values limited to strings/numbers/booleans. | (verified 2026-08-25 — https://wiki.greasespot.net/GM.setValue — strings/booleans/integers ONLY; https://www.greasespot.net/2017/09/greasemonkey-4-for-script-authors.html — async-only GM.)
| Safari "Userscripts" app | Safari (macOS + iOS 15.1+) | Async `GM.*` promise SUBSET | Open source. Any `@grant` forces content-world execution; no page-world access. | (verified 2026-08-25 — https://github.com/quoid/userscripts#api & #metadata: iOS 15.1+ / macOS 12+ Safari 14.1+, content-world only when using GM APIs)

### Tier-2 snapshot — see [manager-compat.md](manager-compat.md) for full divergences

| Manager | Browsers | Portable GM subset | Notes |
| --- | --- | --- | --- |
| ScriptCat | Chrome, Edge, Firefox | Full TM compatibility including `GM.*` batch APIs | Background/scheduled scripts (`@background`/`@crontab`), `@inject-into page`/`content` only (no `auto`); `@storageName` for cross-script sharing |
| AdGuard | Chrome (MV3 User Scripts API) + Windows/Mac/Android apps | `GM_*`/`GM.*` for `getValue`/`setValue`/`deleteValue`/`listValues`/`getResourceText`/`getResourceURL`/`addStyle`/`log`/`setClipboard`/`xmlHttpRequest`/`openInTab`/`registerMenuCommand`/`addElement`/`window.onurlchange` | System-level manager; finite allow-list — missing `GM_cookie`, `GM_addValueChangeListener`, streaming, etc. implies unsupported |
| FireMonkey | Firefox (desktop + Android experimental) | `GM_*` & `GM.*` (prefers `GM.*`); `fetch` | Firefox `userScripts` API; `@grant NONE`/absent = page context, any `@grant` = sandboxed; `@allFrames` defaults `false` (`true` elsewhere) |
| OrangeMonkey | Chromium only | All `GM_*` (VM fork) | Lightweight VM fork — verify against store listing; no independent API docs |

Tier-2 details (storage sharing, `@inject-into` defaults, `@allFrames`/`@run-at` deltas, `CAT_*`): see [manager-compat.md](manager-compat.md).

---

## 2. API Support Matrix

Legend: ✅ supported · ⚠️ partial/experimental · ❌ absent. Versions are that manager's own.

### Storage

| API | TM | VM | GM4+ | Safari |
| --- | --- | --- | --- | --- |
| `GM_setValue` / `GM_getValue` / `GM_deleteValue` / `GM_listValues` (sync) | ✅ | ✅ | ❌ removed in 4.0 | ❌ (promise-only) | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=GM_values, https://violentmonkey.github.io/api/gm/#gm_getvalue, https://www.greasespot.net/2017/09/greasemonkey-4-for-script-authors.html)
| `GM.setValue` / `getValue` / `deleteValue` / `listValues` (promise) | ✅ | ✅ since 2.12.0 | ✅ only form | ✅ | (verified 2026-08-25 — https://violentmonkey.github.io/api/gm/#gm — Since VM2.12.0)
| Value types | JSON-serialisable incl. objects | JSON-serialisable (no DOM nodes/cycles) | **Strings/numbers/booleans ONLY** — `JSON.stringify` objects yourself | JSON-serialisable | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=GM_values, https://violentmonkey.github.io/api/gm/#gm_setvalue — JSON serializable, https://wiki.greasespot.net/GM.setValue — strings/booleans/integers ONLY, https://github.com/quoid/userscripts#api — Any JSON-serializable)
| Batch `GM.getValues` / `setValues` / `deleteValues` (+ `GM_` forms) | ✅ 5.3+ | ✅ since 2.19.1 | ❌ | ❌ | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=GM_values — v5.3+, https://violentmonkey.github.io/api/gm/#gm_getvalues — Since VM2.19.1)
| `GM.addValueChangeListener` (cross-tab broadcast) | ✅ (`remote` flag = other tab) | ✅ (same semantics) | ⚠️ signature differs; `remote` handling UNVERIFIED (2026-08-25) | ❌ | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=GM_values — remote flag; VM docs — same semantics)

### Networking

| API | TM | VM | GM4+ | Safari |
| --- | --- | --- | --- | --- |
| `GM_xmlhttpRequest` (callback) | ✅ returns `{abort}` | ✅ returns control | ❌ | ✅ legacy `GM_xmlhttpRequest(details)` alias returning `{abort}` (primary is `GM.xmlHttpRequest` custom Promise + `abort`) | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=GM_xmlhttpRequest, https://violentmonkey.github.io/api/gm/#gm_xmlhttprequest, https://github.com/quoid/userscripts#api — GM.xmlHttpRequest custom Promise + abort)
| `GM.xmlHttpRequest` (promise) | ✅ (capital H) | ✅ since 2.18.3 | ✅ | ✅ custom promise + `abort` | (verified 2026-08-25 — https://violentmonkey.github.io/api/gm/ — async since VM2.18.3, capital H)
| `@connect` enforcement | **Strict** — unlisted hosts prompt/block (initial + final URL) | Declared but **NOT enforced** (requests allowed) | Ignored/not used | Not enforced |
| `anonymous` (drop cookies) | ✅ | ✅ since 2.10.1 | ❌ | ❌ | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=GM_xmlhttpRequest — anonymous; https://violentmonkey.github.io/api/gm/#gm_xmlhttprequest — since VM2.10.1)
| `cookie` option (patched cookies) | ✅ | ❌ | ❌ | ❌ | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=GM_xmlhttpRequest — cookie)
| `responseType`: `arraybuffer`/`blob`/`json` | ✅ | ✅ | ✅ | ✅ standard XHR types | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=GM_xmlhttpRequest, https://violentmonkey.github.io/api/gm/#gm_xmlhttprequest)
| `responseType: 'stream'` + `onloadstart` reader | ✅ 5.4+ | ❌ | ❌ (`ms-stream` instead) | ❌ | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=GM_xmlhttpRequest — responseType stream, https://www.tampermonkey.net/changelog.php — experimental stream in 5.4.0)
| `onprogress` / `upload.onprogress` | ✅ | ✅ upload since 2.32.0 | ✅ | ✅ | (verified 2026-08-25 — https://violentmonkey.github.io/api/gm/#gm_xmlhttprequest — upload since VM2.32.0)
| `redirect` option | ✅ (build 6180+) | ❌ | ❌ | ❌ | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=GM_xmlhttpRequest — redirect build 6180+)
| `proxy` option | ✅ Firefox-only builds | ❌ | ❌ | ❌ | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=GM_xmlhttpRequest — proxy Firefox-only)

### DOM & UI

| API | TM | VM | GM4+ | Safari |
| --- | --- | --- | --- | --- |
| `GM_addStyle(css)` sync | ✅ returns `<style>` | ✅ returns `<style>` | ❌ removed (polyfill) | ❌ deprecated | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=GM_addStyle — returns style element; https://violentmonkey.github.io/api/gm/#gm_addstyle)
| `GM.addStyle(css)` promise | ✅ | ✅ since 2.12.0 | ❌ polyfill only (`gm4-polyfill.js`) | ✅ partial impl | (verified 2026-08-25 — https://violentmonkey.github.io/api/gm/ — Since VM2.12.0)
| `GM_addElement(tag, attrs)` / `(parent, tag, attrs)` | ✅ (returns element since 5.5.0) | ✅ sync | ❌ (issue #2484) | ❌ | (verified 2026-08-25 — https://www.tampermonkey.net/changelog.php — 5.5.0 reworked GM_addElement to always return created element)
| `GM.addElement` promise | ✅ | ✅ since 2.13.1 | ❌ | ❌ | (verified 2026-08-25 — https://violentmonkey.github.io/api/gm/#gm_addelement — Since VM2.13.1)
| `unsafeWindow` | ✅ needs explicit `@grant unsafeWindow` when other grants exist | ✅ exposed without grant; sandbox off only with `@grant none` (since 2.32) | ✅ (`window.wrappedJSObject` equivalent) | ❌ **none at all** | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=unsafeWindow, https://violentmonkey.github.io/api/gm/#unsafewindow — only @grant none disables sandbox since 2.32, https://github.com/quoid/userscripts#api — no unsafeWindow)
| `GM_getResourceText(name)` sync | ✅ | ✅ | ❌ **not implemented** (GM 4.0–4.14; greasemonkey/greasemonkey#2548 still open; wiki: "does not exist" since 4.0) | ❌ resources not implemented | (verified 2026-08-25 — https://www.greasespot.net/2017/09/greasemonkey-4-for-script-authors.html — no support for GM_getResourceText; https://github.com/quoid/userscripts#api — resources not implemented)
| `GM.getResourceText` | ✅ promise | ✅ sync-typed | ❌ not implemented — polyfill via `fetch(await GM.getResourceUrl(name)).then(r => r.text())` | ❌ | (verified 2026-08-25 — https://violentmonkey.github.io/api/gm/#gm_getresourcetext)
| `GM_getResourceURL(name[, isBlobUrl])` | ✅ data: URL | ✅ `isBlobUrl` since 2.13.1 | ❌ sync form | ❌ | (verified 2026-08-25 — https://violentmonkey.github.io/api/gm/#gm_getresourceurl — isBlobUrl since VM2.13.1)
| `GM.getResourceUrl(name)` promise (lowercase rl!) | ✅ | ✅ since 2.12.0 | ✅ | ❌ | (verified 2026-08-25 — https://wiki.greasespot.net/GM.getResourceUrl — GM.getResourceUrl; https://violentmonkey.github.io/api/gm/#gm — Since VM2.12.0, misspelled until 2.13.0)

### Browser/OS integration

| API | TM | VM | GM4+ | Safari |
| --- | --- | --- | --- | --- |
| Menu commands: `GM_registerMenuCommand` / `GM.registerMenuCommand` | ✅ options `{accessKey, autoClose}` 4.20+, `{id,title}` 5.0+ | ✅ options `{autoClose, icon, id, title}` | ⚠️ async-only, re-added after 4.0 (issues #2714/#2770) | ❌ | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=GM_registerMenuCommand, https://violentmonkey.github.io/api/gm/#gm_registermenucommand)
| Notifications: `GM_notification` / `GM.notification` | ✅ extras: `tag`, `url` (5.0+), `highlight`, `silent`; promise resolves boolean (clicked) | ✅ extras: `silent`, `tag`, `zombieTimeout`, `zombieUrl`; returns control | ✅ `GM.notification(details)` or positional args | ❌ | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=GM_notification, https://violentmonkey.github.io/api/gm/#gm_notification)
| Clipboard: `GM_setClipboard` / `GM.setClipboard` | ✅ `(data, {type,mimetype}\|"text"\|"html", cb?)` | ✅ `(data, type?)` | ✅ promise form | ✅ promise (deprecated upstream #655) | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=GM_setClipboard, https://github.com/quoid/userscripts#api — deprecated #655)
| Tabs: `GM_openInTab(url, opts)` | ✅ opts `{active, insert, setParent, incognito}` → handle `{close, onclose, closed}` | ✅ opts `{active, container, insert, pinned}` or bool → control | ⚠️ bool/partial opts; `GM.openInTab` promise | ✅ bool arg only | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=GM_openInTab, https://violentmonkey.github.io/api/gm/#gm_openintab — container since VM2.12.5, pinned since VM2.12.5)
| `GM_getTab` / `GM_saveTab` / `GM_getTabs` (+ promise forms) | ✅ | ✅ promise since 2.12.0 | ⚠️ promise forms | ❌ | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=GM_tabs, https://violentmonkey.github.io/api/gm/ — GM.getTab promise since 2.12.0)
| Downloads: `GM_download` / `GM.download` | ✅ `conflictAction` 4.18+; errors: `not_enabled/not_whitelisted/not_permitted/not_supported/not_succeeded` | ✅ since 2.9.5 (`conflictAction` only in browser download mode) | ❌ (polyfill gist exists) | ❌ | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=GM_download — conflictAction; https://violentmonkey.github.io/api/gm/ — since VM2.9.5)
| Cookies: `GM_cookie.list/set/delete` / `GM.cookie.*` | ✅ stable; `partitionKey` 5.2+; **httpOnly beta-gated** (setting: Config Mode Advanced → Security) | ✅ since 2.35.1; httpOnly needs BOTH global + per-script toggles | ❌ | ❌ | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=GM_cookie — partitionKey v5.2+, httpOnly BETA; https://violentmonkey.github.io/api/gm/#gm_cookie — Since VM2.35.1)
| Tab audio: `GM_audio.setMute/getState/addStateChangeListener` | ⚠️ **experimental**, beta 5.3.6230 / stable 5.4; current tab only; `getState` → `{isMuted, muteReason, isAudible}` | ❌ | ❌ | ❌ | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=GM_audio — experimental; https://www.tampermonkey.net/changelog.php — 5.4.0 experimental GM_audio)
| Request interception: `GM_webRequest(rules, listener)` + `@webRequest` header | ⚠️ experimental; **Firefox MV2 only**; broken on Chrome MV3 (TM 5.2+, issue #2209) | ❌ wontfix (issue #583) | ❌ | ❌ | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=GM_webRequest — experimental, not available at MV3 TM 5.2+)
| Logging: `GM_log` / `GM.log` | ✅ (= console.log) | ✅ | ❌ removed — use `console.log` | ❌ | (verified 2026-08-25 — https://www.greasespot.net/2017/09/greasemonkey-4-for-script-authors.html — no support for GM_log)

### SPA navigation & metadata

| Feature | TM | VM | GM4+ | Safari |
| --- | --- | --- | --- | --- |
| `window.onurlchange` grant/event | ✅ check `window.onurlchange === null` then `addEventListener('urlchange', info => info.url)` | ❌ declined (issue #1195) | ❌ | ❌ | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=window.onurlchange, https://github.com/violentmonkey/violentmonkey/issues/1195)
| Portable SPA fallback | Patch `history.pushState/replaceState` + listen `popstate`/`hashchange` — works everywhere | Also: `navigation` event, MutationObserver, or `@violentmonkey/url` package (`VM.onNavigate`) | History patch | History patch |

---

## 3. Header Directive Differences

| Directive | portable? | Differences |
| --- | --- | --- |
| `@run-at` | core values yes | `document-start` all; `document-end` all (**default in GM/VM/Safari**); `document-idle` all (**default in TM only**); `document-body` TM + VM (2.12.10+), invalid enum in GM4, ignored by Safari; `context-menu` **TM-only** | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=run_at — document-idle default; https://violentmonkey.github.io/api/metadata-block/#run-at — document-end default, document-body since v2.12.10; https://github.com/quoid/userscripts#metadata — document-end default)
| `@include` / `@exclude` | yes | Glob + `/regex/` (case-insensitive) everywhere; no `@include` ⇒ matches everything (except Safari requires ≥1 rule); quoid/Userscripts plans to deprecate `@include`/`@exclude` entirely (issue #650) — prefer `@match` + runtime URL test | (verified 2026-08-25 — https://wiki.greasespot.net/Include_and_exclude_rules, https://github.com/quoid/userscripts#metadata — All userscripts need at least 1 @match or @include)
| `@match` | yes | Chrome match-pattern grammar everywhere; VM adds extensions since 2.10.4 (`.tld`, wildcards in extra host positions like `https://*.example.*/*`) | (verified 2026-08-25 — https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns, https://violentmonkey.github.io/api/matching/)
| `@connect` | declare anyway | Enforced strictly by TM only; VM does not enforce; GM ignores; Safari n/a |
| `@run-in normal-tabs/incognito-tabs/container-id-N` | ❌ TM-only 5.3+ | Parsed-but-ignored elsewhere; Firefox containers otherwise unreachable | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=run_in — v5.3+)
| `@sandbox raw/javascript/dom` | ❌ TM-only 4.18+ | VM/Safari use `@inject-into page/content/auto` instead; GM has no directive (always sandboxed) | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=sandbox — 4.18+ raw/javascript/dom; https://violentmonkey.github.io/api/metadata-block/#inject-into — auto default)
| `@noframes` | ✅ universal | Top-level frames only when present |
| no `@grant` vs `@grant none` | subtle | **TM:** different — empty grants keep sandbox enabled, `none` disables it. **VM ≥2.32:** different — no-grant = minimal sandbox (only `GM_info` + `unsafeWindow`), `none` = full page context. **GM/Safari:** equivalent | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=grant, https://violentmonkey.github.io/api/gm/#unsafewindow — disabled only if @grant none, before v2.32 also when no @grant)
| `@require` SRI hashes | varies | TM supports `#sha256=...`; VM partial; GM none. Verify before relying. |
| `@updateURL` / `@downloadURL` | mostly | Default derivation differs per manager; explicit values are portable |

---

## 4. Sandbox / Injection Models & CSP

| Aspect | TM | VM | GM4+ | Safari |
| --- | --- | --- | --- | --- |
| Isolation directive | `@sandbox raw` (page world, default) / `javascript` / `dom` (isolated) | `@inject-into auto` (default; tries page, falls back to content) / `page` / `content` | Always sandboxed (Xray vision in Firefox) | Any `@grant` ⇒ forced content world | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=sandbox, https://violentmonkey.github.io/api/metadata-block/#inject-into — auto default, https://github.com/quoid/userscripts#metadata — GM APIs only available when using content)
| Page-CSP handling | May strip/relax CSP headers in some modes (do NOT rely on it) | **Respects page CSP** — falls back to content-world injection if page injection fails; no header stripping | Subject to Firefox sandbox rules | Content world only | (verified 2026-08-25 — https://github.com/quoid/userscripts/issues/106 — CSP content-world fallback)
| Reaching page JS from content world | `unsafeWindow` | Chrome: bridge via `CustomEvent`/`postMessage` or `GM_addElement` data:-URI trick; Firefox: `wrappedJSObject`/`cloneInto`/`exportFunction` | Firefox Xray: `wrappedJSObject`/`cloneInto`/`exportFunction` | Not possible — design without page-world access |
| `GM_info.sandboxMode` | `'js'\|'raw'\|'dom'` (4.18+) | use `GM_info.injectInto` (`auto\|page\|content`) instead | n/a | n/a | (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?q=GM_info — sandboxMode 4.18+)

---

## 5. Runtime Manager Detection

```javascript
// GM_info needs no dedicated grant anywhere.
const handler = (typeof GM_info !== "undefined" ? GM_info : GM.info).scriptHandler;
// Literal values: "Tampermonkey" | "Violentmonkey" | "Greasemonkey" | "Userscripts"

// Prefer capability checks over name checks:
const canBatch = typeof GM?.getValues === "function";
const canMuteTab = typeof GM_audio !== "undefined" || typeof GM?.audio !== "undefined"; // TM-only
```

---

## 6. Workflows

| Manager | Install / Manage | Debugging | Portable note |
| --- | --- | --- | --- |
| Violentmonkey | Dashboard at extension options (`#/installed`); install via GreasyFork/openUserJS link, drag-and-drop `.user.js`, or "Install from URL" | `debugger;` → DevTools → **Violentmonkey** source tree; external-editor via local server + **Track external edits** | Owner example for UI steps; page-CSP is respected (see §4) |
| Tampermonkey | Toolbar → Dashboard/Editor (settings modes Simple→Advanced) | Chrome: `chrome://extensions` → Inspect; Firefox: `about:debugging` → This Firefox → Inspect | Chrome store = **MV3**, Firefox = MV2; `GM_webRequest` Firefox-MV2 only; **Settings → Script Injection** must be allowed (TM 5.4.1+) or scripts silently fail |
| Greasemonkey 4+ | `about:addons` → Greasemonkey | `about:debugging` → Inspect | `GM_*` → `await GM.*`; objects in storage must be `JSON.stringify`'d; `GM_addStyle`/`GM_log` need polyfill |
| Safari "Userscripts" | App Store → Safari → Extensions → Always Allow | Safari Web Inspector | Promise-only subset — `addStyle` (partial), `getValue`/`setValue`/`listValues`/`deleteValue`, `xmlHttpRequest`, `openInTab`/`closeTab`, `setClipboard` (deprecated), `info` |

---

## 7. Universal Limitations (all managers)

- **No filesystem API** — `GM_download` writes via browser downloads only; `@require`/`@resource` are network fetches (TM-only: `file://` requires explicit opt-in per [FAQ Q402](https://www.tampermonkey.net/faq.php#Q402)); the "allow file URLs" toggle is for running on `file://` pages, not filesystem access.
- **No cross-origin iframe DOM** — browser same-origin policy (see [MDN same-origin policy](https://developer.mozilla.org/en-US/docs/Web/API/Same-origin_policy)); `@noframes` = top-frame only; match the iframe URL to inject there.
- **GM storage is per-profile, never cloud-synced** — manager sync covers scripts/settings only.
- **Strict CSP can still defeat injection** — VM falls back to content world; TM relaxation is best-effort; neither is guaranteed.
- **Isolated/content world shares DOM, not JS scope** — page variables need a bridge (§4); prototype mutations on native objects (e.g., `Element.prototype`) are visible cross-world.

---

## 8. Primary Sources

Official documentation roots (consult these before adding new claims):

- Tampermonkey: <https://www.tampermonkey.net/documentation.php> · changelog: <https://www.tampermonkey.net/changelog.php>
- Violentmonkey: <https://violentmonkey.github.io/api/gm/> · metadata: <https://violentmonkey.github.io/api/metadata-block/> · matching: <https://violentmonkey.github.io/api/matching/> · injection contexts: <https://violentmonkey.github.io/posts/inject-into-context/> · external editors: <https://violentmonkey.github.io/posts/how-to-edit-scripts-with-your-favorite-editor/>
- Greasemonkey: <https://wiki.greasespot.net/Greasemonkey_Manual:API> · GM4 migration: <https://www.greasespot.net/2017/09/greasemonkey-4-for-script-authors.html>
- Safari Userscripts app: <https://github.com/quoid/userscripts>
- AdGuard userscript support: <https://adguard.com/kb/general/extensions/> · User Scripts API: <https://adguard.com/kb/adguard-browser-extension/user-scripts-api/>
- ScriptCat: <https://scriptcat.org/en> · docs: <https://docs.scriptcat.org> · repo: <https://github.com/scriptscat/scriptcat>
- FireMonkey: <https://erosman.github.io/firemonkey/> · AMO: <https://addons.mozilla.org/en-US/firefox/addon/firemonkey/>
- OrangeMonkey: <https://chromewebstore.google.com/detail/orangemonkey/ekmeppjgajofkpiofbebgcbohbmfldaf>
- Chrome MV2 removal timeline: <https://developer.chrome.com/docs/webplatform/mv2-deprecation-timeline>

Key decision records: VM declined `window.onurlchange` (violentmonkey/violentmonkey#1195) and `GM_webRequest` (violentmonkey/violentmonkey#583); TM MV3 dropped `GM_webRequest` (Tampermonkey/tampermonkey#2209).
