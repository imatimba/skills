# Userscript Managers — Support Matrix & Workflows

Per-manager facts for writing portable userscripts. Normative guidance stays manager-neutral; when a concrete manager must be exemplified, use **Violentmonkey** (the skill owner's manager). Every manager-specific fact below is labeled. Anything not confirmed against official docs is marked **UNVERIFIED** — do not present it as fact.

Managers covered: **TM** = Tampermonkey · **VM** = Violentmonkey · **GM4+** = Greasemonkey 4 and later · **Safari** = Safari "Userscripts" app (quoid/userscripts). Other managers (ScriptCat, AdGuard, FireMonkey, mobile, OrangeMonkey) are tier-2 — see [manager-compat.md](manager-compat.md) for divergences; verify against their own docs before claiming support.

---

## 1. Manager Roster

| Manager | Browsers | Script model | Notes |
| --- | --- | --- | --- |
| Violentmonkey | Chrome/Edge/Firefox (+ Firefox Android) | `GM_*` sync AND `GM.*` promises | Owner default. Open source. |
| Tampermonkey | Chrome/Edge (MV3), Firefox (MV2), Safari (paid app) | `GM_*` sync AND `GM.*` promises | Largest feature surface; several TM-only APIs below. |
| Greasemonkey 4+ | Firefox only | `GM.*` promises ONLY | All sync `GM_*` removed in 4.0. Storage values limited to strings/numbers/booleans. |
| Safari "Userscripts" app | Safari (macOS + iOS 15.1+) | Async `GM.*` promise SUBSET | Open source. Any `@grant` forces content-world execution; no page-world access. |

### Tier-2 snapshot (verified 2026-08-24) — see [manager-compat.md](manager-compat.md) for full divergences

| Manager | Browsers (verified 2026-08-24) | License (verified 2026-08-24) | GM compatibility | Notes |
| --- | --- | --- | --- | --- |
| ScriptCat | Chrome, Edge, Firefox | GPL-3.0 | Full TM compatibility + background & scheduled scripts, rich APIs | Active — 1,589 commits, v1.4.0 (Jul 2026); Chrome Web Store + AMO + Edge Add-ons; docs at https://docs.scriptcat.org |
| AdGuard | Windows / Android / Mac apps + Browser Extension (Chrome 138+ requires Developer mode + Allow user scripts) | Proprietary | Supports `GM_*` and `GM.*` for `getValue`/`setValue`/`deleteValue`/`listValues`/`getResourceText`/`getResourceURL`/`addStyle`/`log`/`setClipboard`/`xmlHttpRequest`/`openInTab`/`registerMenuCommand`/`addElement`/`window.onurlchange` (per https://adguard.com/kb/general/extensions/) | Acts as userscript manager; User Scripts API required on Chrome MV3 5.2+ (https://adguard.com/kb/adguard-browser-extension/user-scripts-api/) |
| FireMonkey | Firefox (Firefox for Android experimental since 2.12) | MPL-2.0 | Supports GM3 (`GM_*`) & GM4 (`GM.*`) + `fetch` | Firefox native `userScripts` API (Firefox 65+); lightweight manager for scripts + styles; https://erosman.github.io/firemonkey/ |
| OrangeMonkey | Chromium only | Proprietary | All `GM_*` functions (fork of Violentmonkey) | Lightweight VM fork, v2.0.16 (Aug 2026); Chrome Web Store only; https://chromewebstore.google.com/detail/orangemonkey/ekmeppjgajofkpiofbebgcbohbmfldaf |

Core manager licenses & status (verified 2026-08-24): Violentmonkey MIT — active, 3,888 commits; Tampermonkey proprietary (Jan Biniok) — active, MV3 migration 2025–2026; Greasemonkey MIT — maintenance mode, 795 commits, Firefox-only; Userscripts (Safari) GPL-3.0 — active, 1,320 commits.

---

## 2. API Support Matrix

Legend: ✅ supported · ⚠️ partial/experimental · ❌ absent. Versions are that manager's own.

### Storage

| API | TM | VM | GM4+ | Safari |
| --- | --- | --- | --- | --- |
| `GM_setValue` / `GM_getValue` / `GM_deleteValue` / `GM_listValues` (sync) | ✅ | ✅ | ❌ removed in 4.0 | ❌ (promise-only) |
| `GM.setValue` / `getValue` / `deleteValue` / `listValues` (promise) | ✅ | ✅ since 2.12.0 | ✅ only form | ✅ |
| Value types | JSON-serialisable incl. objects | JSON-serialisable (no DOM nodes/cycles) | **Strings/numbers/booleans ONLY** — `JSON.stringify` objects yourself | JSON-serialisable |
| Batch `GM.getValues` / `setValues` / `deleteValues` (+ `GM_` forms) | ✅ 5.3+ | ✅ since 2.19.1 | ❌ | ❌ |
| `GM.addValueChangeListener` (cross-tab broadcast) | ✅ (`remote` flag = other tab) | ✅ (same semantics) | ⚠️ signature differs; `remote` handling UNVERIFIED | ❌ |
| Key ordering (`listValues`) | No ordering guarantee | None | None | None — always `.sort()` if order matters |

### Networking

| API | TM | VM | GM4+ | Safari |
| --- | --- | --- | --- | --- |
| `GM_xmlhttpRequest` (callback) | ✅ returns `{abort}` | ✅ returns control | ❌ | ✅ legacy `GM_xmlhttpRequest(details)` alias returning `{abort}` (primary is `GM.xmlHttpRequest` custom Promise + `abort`) |
| `GM.xmlHttpRequest` (promise) | ✅ (capital H) | ✅ since 2.18.3 | ✅ | ✅ custom promise + `abort` |
| `@connect` enforcement | **Strict** — unlisted hosts prompt/block (initial + final URL) | Declared but **NOT enforced** (requests allowed) | Ignored/not used | Not enforced |
| `anonymous` (drop cookies) | ✅ | ✅ since 2.10.1 | ❌ | ❌ |
| `cookie` option (patched cookies) | ✅ | ❌ | ❌ | ❌ |
| `responseType`: `arraybuffer`/`blob`/`json` | ✅ | ✅ | ✅ | ✅ standard XHR types |
| `responseType: 'stream'` + `onloadstart` reader | ✅ 5.4+ | ❌ | ❌ (`ms-stream` instead) | ❌ |
| `binary: true` (legacy send mode) | ✅ | ✅ compat | ✅ | ⚠️ deprecated — pass Blob/ArrayBuffer directly |
| `onprogress` / `upload.onprogress` | ✅ | ✅ upload since 2.32.0 | ✅ | ✅ |
| `redirect` option | ✅ (build 6180+) | ❌ | ❌ | ❌ |
| `proxy` option | ✅ Firefox-only builds | ❌ | ❌ | ❌ |

### DOM & UI

| API | TM | VM | GM4+ | Safari |
| --- | --- | --- | --- | --- |
| `GM_addStyle(css)` sync | ✅ returns `<style>` | ✅ returns `<style>` | ❌ removed (polyfill) | ❌ deprecated |
| `GM.addStyle(css)` promise | ✅ | ✅ since 2.12.0 | ❌ polyfill only (`gm4-polyfill.js`) | ✅ partial impl |
| `GM_addElement(tag, attrs)` / `(parent, tag, attrs)` | ✅ (returns element since 5.5.0) | ✅ sync | ❌ (issue #2484) | ❌ |
| `GM.addElement` promise | ✅ | ✅ since 2.13.1 | ❌ | ❌ |
| `unsafeWindow` | ✅ needs explicit `@grant unsafeWindow` when other grants exist | ✅ exposed without grant; sandbox off only with `@grant none` (since 2.32) | ✅ (`window.wrappedJSObject` equivalent) | ❌ **none at all** |
| `GM_getResourceText(name)` sync | ✅ | ✅ | ❌ **not implemented** (GM 4.0–4.14; greasemonkey/greasemonkey#2548 still open; wiki: "does not exist" since 4.0) | ❌ resources not implemented |
| `GM.getResourceText` | ✅ promise | ✅ sync-typed | ❌ not implemented — polyfill via `fetch(await GM.getResourceUrl(name)).then(r => r.text())` | ❌ |
| `GM_getResourceURL(name[, isBlobUrl])` | ✅ data: URL | ✅ `isBlobUrl` since 2.13.1 | ❌ sync form | ❌ |
| `GM.getResourceUrl(name)` promise (lowercase rl!) | ✅ | ✅ since 2.12.0 | ✅ | ❌ |

### Browser/OS integration

| API | TM | VM | GM4+ | Safari |
| --- | --- | --- | --- | --- |
| Menu commands: `GM_registerMenuCommand` / `GM.registerMenuCommand` | ✅ options `{accessKey, autoClose}` 4.20+, `{id,title}` 5.0+ | ✅ options `{autoClose, icon, id, title}` | ⚠️ async-only, re-added after 4.0 (issues #2714/#2770) | ❌ |
| Notifications: `GM_notification` / `GM.notification` | ✅ extras: `tag`, `url` (5.0+), `highlight`, `silent`; promise resolves boolean (clicked) | ✅ extras: `silent`, `tag`, `zombieTimeout`, `zombieUrl`; returns control | ✅ `GM.notification(details)` or positional args | ❌ |
| Clipboard: `GM_setClipboard` / `GM.setClipboard` | ✅ `(data, {type,mimetype}\|"text"\|"html", cb?)` | ✅ `(data, type?)` | ✅ promise form | ✅ promise (deprecated upstream #655) |
| Tabs: `GM_openInTab(url, opts)` | ✅ opts `{active, insert, setParent, incognito}` → handle `{close, onclose, closed}` | ✅ opts `{active, container, insert, pinned}` or bool → control | ⚠️ bool/partial opts; `GM.openInTab` promise | ✅ bool arg only |
| `GM_getTab` / `GM_saveTab` / `GM_getTabs` (+ promise forms) | ✅ | ✅ promise since 2.12.0 | ⚠️ promise forms | ❌ |
| Downloads: `GM_download` / `GM.download` | ✅ `conflictAction` 4.18+; errors: `not_enabled/not_whitelisted/not_permitted/not_supported/not_succeeded` | ✅ since 2.9.5 (`conflictAction` only in browser download mode) | ❌ (polyfill gist exists) | ❌ |
| Cookies: `GM_cookie.list/set/delete` / `GM.cookie.*` | ✅ stable; `partitionKey` 5.2+; **httpOnly beta-gated** (setting: Config Mode Advanced → Security) | ✅ since 2.35.1; httpOnly needs BOTH global + per-script toggles | ❌ | ❌ |
| Tab audio: `GM_audio.setMute/getState/addStateChangeListener` | ⚠️ **experimental**, beta 5.3.6230 / stable 5.4; current tab only; `getState` → `{isMuted, muteReason, isAudible}` | ❌ | ❌ | ❌ |
| Request interception: `GM_webRequest(rules, listener)` + `@webRequest` header | ⚠️ experimental; **Firefox MV2 only**; broken on Chrome MV3 (TM 5.2+, issue #2209) | ❌ wontfix (issue #583) | ❌ | ❌ |
| Logging: `GM_log` / `GM.log` | ✅ (= console.log) | ✅ | ❌ removed — use `console.log` | ❌ |

### SPA navigation & metadata

| Feature | TM | VM | GM4+ | Safari |
| --- | --- | --- | --- | --- |
| `window.onurlchange` grant/event | ✅ check `window.onurlchange === null` then `addEventListener('urlchange', info => info.url)` | ❌ declined (issue #1195) | ❌ | ❌ |
| Portable SPA fallback | Patch `history.pushState/replaceState` + listen `popstate`/`hashchange` — works everywhere | Also: `navigation` event, MutationObserver, or `@violentmonkey/url` package (`VM.onNavigate`) | History patch | History patch |

---

## 3. Header Directive Differences

| Directive | portable? | Differences |
| --- | --- | --- |
| `@run-at` | core values yes | `document-start` all; `document-end` all (**default in GM/VM/Safari**); `document-idle` all (**default in TM only**); `document-body` TM + VM (2.12.10+), invalid enum in GM4, ignored by Safari; `context-menu` **TM-only** |
| `@include` / `@exclude` | yes | Glob + `/regex/` (case-insensitive) everywhere; no `@include` ⇒ matches everything (except Safari requires ≥1 rule); quoid/Userscripts plans to deprecate `@include`/`@exclude` entirely (issue #650) — prefer `@match` + runtime URL test |
| `@match` | yes | Chrome match-pattern grammar everywhere; VM adds extensions since 2.10.4 (`.tld`, wildcards in extra host positions like `https://*.example.*/*`) |
| `@connect` | declare anyway | Enforced strictly by TM only; VM does not enforce; GM ignores; Safari n/a |
| `@run-in normal-tabs/incognito-tabs/container-id-N` | ❌ TM-only 5.3+ | Parsed-but-ignored elsewhere; Firefox containers otherwise unreachable |
| `@sandbox raw/javascript/dom` | ❌ TM-only 4.18+ | VM/Safari use `@inject-into page/content/auto` instead; GM has no directive (always sandboxed) |
| `@noframes` | ✅ universal | Top-level frames only when present |
| no `@grant` vs `@grant none` | subtle | **TM:** different — empty grants keep sandbox enabled, `none` disables it. **VM ≥2.32:** different — no-grant = minimal sandbox (only `GM_info` + `unsafeWindow`), `none` = full page context. **GM/Safari:** equivalent |
| `@require` SRI hashes | varies | TM supports `#sha256=...`; VM partial; GM none. Verify before relying. |
| `@updateURL` / `@downloadURL` | mostly | Default derivation differs per manager; explicit values are portable |

---

## 4. Sandbox / Injection Models & CSP

| Aspect | TM | VM | GM4+ | Safari |
| --- | --- | --- | --- | --- |
| Isolation directive | `@sandbox raw` (page world, default) / `javascript` / `dom` (isolated) | `@inject-into auto` (default; tries page, falls back to content) / `page` / `content` | Always sandboxed (Xray vision in Firefox) | Any `@grant` ⇒ forced content world |
| Page-CSP handling | May strip/relax CSP headers in some modes (do NOT rely on it) | **Respects page CSP** — falls back to content-world injection if page injection fails; no header stripping | Subject to Firefox sandbox rules | Content world only |
| Reaching page JS from content world | `unsafeWindow` | Chrome: bridge via `CustomEvent`/`postMessage` or `GM_addElement` data:-URI trick; Firefox: `wrappedJSObject`/`cloneInto`/`exportFunction` | Firefox Xray: `wrappedJSObject`/`cloneInto`/`exportFunction` | Not possible — design without page-world access |
| `GM_info.sandboxMode` | `'js'\|'raw'\|'dom'` (4.18+) | use `GM_info.injectInto` (`auto\|page\|content`) instead | n/a | n/a |

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

### Violentmonkey (worked example)

- **Dashboard**: extension options page (`chrome-extension://<id>/options/index.html#/installed`, `moz-extension://<id>/...` on Firefox). Routes: `#/installed`, `#/settings`.
- **Create**: ➕ button, "Install from URL", drag-and-drop a `.user.js`, or install from GreasyFork/OpenUserJS links.
- **Editor**: CodeMirror modal with **Code / Settings / Storage** tabs.
- **External editor**: serve the file locally (`npx http-server -c5 .`) and open `http://localhost:8080/script.user.js`, then enable **Track external edits** — the dashboard reloads the script on every save.
- **Sync**: Dropbox, OneDrive, Google Drive, WebDAV, S3-compatible (Settings → Sync).
- **Backup**: ZIP export/import (scripts as `.user.js` + optional `.storage.json`; imports Tampermonkey-format files too).
- **Debugging**: drop a `debugger;` statement → DevTools → Sources → **Violentmonkey** tree. Console output lands in the page console; the sandboxed console is captured separately.
- **Mobile**: full features on Firefox for Android (AMO). Chromium-based mobile browsers are a volatile ecosystem (Kiwi archived Jan 2025; successor path via Microsoft Edge Canary with `Extension install by id` per https://github.com/kiwibrowser/src.next, verified 2026-08-24) — verify before recommending.

### Tampermonkey (brief)

- Own dashboard/editor via toolbar icon; settings modes from Simple to Advanced (many TM-only toggles live under Advanced).
- Chrome store build is **MV3** (Chrome 138 — Jul 24 2025 — disabled MV2 for all users, no re-enable; enterprise `ExtensionManifestV2Availability` removed at Chrome 139; final Chrome Web Store MV2 removal Aug 31 2026 per [MV2 deprecation timeline](https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline)); Firefox build remains MV2. Several capabilities differ between them (`GM_webRequest` is MV2/Firefox-only).
- **Tampermonkey v5.4.1+ injection permission**: users must allow script injection per-site or globally (dashboard → Settings → Script Injection). Scripts cannot bypass this; surface it in troubleshooting.
- Firefox debugging: `about:debugging` → This Firefox → Tampermonkey → Inspect.

### Greasemonkey 4+ (brief)

- Firefox only; manage/update scripts via `about:addons` → Greasemonkey.
- Debugging: `about:debugging` → This Firefox → Extensions → Inspect.
- Migration: every `GM_*` call becomes `await GM.*`; objects in storage must be stringified manually; `GM_addStyle`/`GM_log` need polyfill or replacement (`gm4-polyfill.js` provides shims).

### Safari "Userscripts" app (brief)

- Install from macOS/iOS App Store; enable under Settings → Safari → Extensions (set to Always Allow on sites).
- Promise-only subset: `addStyle` (partial), `getValue/setValue/listValues/deleteValue`, `xmlHttpRequest`, `openInTab/closeTab`, `setClipboard` (deprecated), `info`. Everything else — including `unsafeWindow`, menu commands, notifications, cookies — does not exist there.
- Debugging via Safari Web Inspector; `GM_info.scriptHandler === "Userscripts"`.

---

## 7. Universal Limitations (all managers)

- No local filesystem access via any GM API. Adjacent capabilities don't change this: `GM_download` writes only through the browser's download subsystem; `GM_xmlhttpRequest` blob/arraybuffer responses stay in memory; `@require`/`@resource` are network-only fetches by default — Tampermonkey accepts `file://` requires only after the user opts in to local file access (FAQ Q402). The "allow file URLs" extension toggle grants permission to run scripts on local pages — it is not a filesystem API.
- Cross-origin iframe DOM is unreachable from the top frame (browser same-origin policy), regardless of manager. To affect iframe content, match the iframe's own URL — every manager injects separate script instances into frames whose URLs match; `@noframes` = top-frame-only.
- GM storage values are per-browser-profile and never cloud-synced: manager sync features (TM TESLA/GDrive/Dropbox/WebDAV, VM Dropbox/OneDrive/GDrive/WebDAV/S3, Greasemonkey Firefox Sync, Safari iCloud folder) cover scripts and settings only.
- Very strict CSP can still defeat injection (VM degrades to content world; TM relaxation is best-effort; neither guarantees bypass; Safari CSP example: https://github.com/quoid/userscripts/issues/106, verified 2026-08-24).
- A userscript in an isolated/content world observes the DOM but shares no JS scope with the page — page variables require the bridges in §4. (Edge case: DOM prototypes such as `Element.prototype` live in the shared native realm — prototype mutations are visible cross-world.)

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
