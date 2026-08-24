# Cross-Manager & Cross-Browser Compatibility Guide

Cross-manager & cross-browser compatibility for portable userscripts. Primary compatibility is determined by **userscript manager** (TM / VM / GM4+ / Safari Userscripts); browser differences are a secondary caveat. See `managers.md` — verified source of truth — for normative per-manager facts. Anything not confirmed there is marked UNVERIFIED.

> **Version preamble:** version numbers are Tampermonkey's unless stated (e.g., `VM 2.35.1`, `GM4+`).

---

## Managers vs Browsers

| Dimension | What determines support | Example |
|-----------|------------------------|---------|
| Manager (TM \| VM \| GM4+ \| Safari Userscripts) | Whether a GM API exists at all | `GM_cookie` is TM + VM only; `GM_audio` is TM-only |
| Browser (Chrome / Firefox / Safari / Edge) | How isolation/CSP/containers/MV2-vs-MV3 behave | `cloneInto` is Firefox Xray only; `GM_webRequest` is Firefox MV2 only |

Violentmonkey worked example: build a standard `.user.js` and load the same artifact in Violentmonkey (dashboard → drag-and-drop) and in Tampermonkey to compare — manager differences surface faster than browser differences.

### Platform Reality

| Topic | Fact |
|-------|------|
| Mobile | VM = full features on Firefox Android (AMO). Chromium mobile is volatile — Kiwi browser archived Jan 2025; verify any Chromium-mobile claim before recommending. |
| Chrome MV2 → MV3 | Chrome 138 (Jul 24 2025) disabled MV2 for all users (no re-enable); enterprise `ExtensionManifestV2Availability` policy removed at Chrome 139; final Chrome Web Store MV2 removal Aug 31 2026 ([MV2 deprecation timeline](https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline)). The Chrome Web Store build of Tampermonkey is **MV3**; the Firefox build remains MV2. Several capabilities differ between them (notably `GM_webRequest`). |
| Edge (Chromium) — MV2 divergence | Edge Add-ons retains MV2 as of Edge 139 (verified 2026-08-24); Partner Center timeline: early 2027 enterprise deprecation, TBD store deprecation ([Edge MV3 timeline](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/manifest-v3)). Do not apply Chrome 138/139/Aug 31 2026 dates verbatim to Edge. |
| Firefox | Retains MV2; supports `cloneInto`/`exportFunction`/containers. |
| Firefox Android caveat | Add-on installs from AMO but mobile APIs are reduced vs desktop — no tab grouping/container sidebar; `storage.sync` not synced on Android per [MDN storage.sync](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/sync) and Firefox bug 1625257 — verified 2026-08-24. “Full features” is relative to Chromium mobile, not desktop parity. |
| Other Chromium browsers (Opera/Brave/Vivaldi etc.) | VM officially lists Chrome, Firefox 57+, Edge, Chromium, Brave, Cent, Orion, Opera 15+, Vivaldi, QQBrowser ([VM get-it](https://violentmonkey.github.io/get-it/)); TM FAQ lists Chrome/Edge/Opera/Safari builds ([TM Q406](https://www.tampermonkey.net/faq.php?locale=en&q=Q406)). Opera users install VM from Chrome Web Store. Verified 2026-08-24. |

> **Tier-2 managers (verified 2026-08-24):** AdGuard, FireMonkey, ScriptCat and OrangeMonkey exist but diverge on MV3/CSP and API coverage — FireMonkey uses Firefox's official `userScripts` API (Firefox 65+, Android support experimental v2.12+, see [AMO FireMonkey](https://addons.mozilla.org/en-US/firefox/addon/firemonkey/)) and supports GM3+GM4; ScriptCat offers background/scheduled scripts and richer APIs ([ScriptCat GitHub](https://github.com/scriptscat/scriptcat)); AdGuard is an ad-blocking extension with userscript support ([AdGuard repo](https://github.com/AdguardTeam/AdguardBrowserExtension)). See `managers.md` for full matrix — do not assume TM/VM parity.

---

## API Compatibility (by Manager)

Legend: ✅ supported · ⚠️ partial/experimental · ❌ absent. Versions are that manager's own.

### Storage

| API | TM | VM | GM4+ | Safari Userscripts | Notes |
|-----|----|----|------|-------------------|-------|
| `GM_setValue` / `GM_getValue` / `GM_deleteValue` / `GM_listValues` (sync) | ✅ | ✅ | ❌ removed in 4.0 | ❌ (promise-only) | GM4+ = `GM.*` promises only; Safari = promise subset |
| `GM.setValue` / `getValue` / `deleteValue` / `listValues` (promise) | ✅ | ✅ since 2.12.0 | ✅ only form | ✅ (`getValue`/`setValue`/`listValues`/`deleteValue`) | Safari subset verified |
| Value types | JSON-serialisable incl. objects | JSON-serialisable (no DOM nodes/cycles) | **Strings/numbers/booleans ONLY** — `JSON.stringify` objects yourself | JSON-serialisable (promise subset) | `managers.md` — storage-type limits are manager-enforced, not browser-enforced |
| Batch `GM_getValues` / `GM_setValues` / `GM_deleteValues` (+ `GM.*` promise forms) | ✅ TM 5.3+ | ✅ VM 2.19.1+ | ❌ | ❌ | Include `deleteValues` |
| `GM_cookie` / `GM.cookie` | ✅ stable; `partitionKey` 5.2+ (TM-only), httpOnly beta-gated | ✅ since VM 2.35.1 (no `partitionKey` yet — TM 5.2+ only; VM 2.35.1 release notes "no partitionKey yet"); httpOnly needs both global + per-script toggles | ❌ | ❌ | `partitionKey` is Tampermonkey 5.2+ only |

> **Storage quotas & persistence (verified 2026-08-24):** `GM_*Value` is backed by extension `storage.local` — per-profile, cleared on extension uninstall (Firefox can keep with `keepStorageOnUninstall` for testing, see [MDN storage.local](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local)), quota ~5 MB on Chrome unless `unlimitedStorage` and IndexedDB-global limit on Firefox. `GM_cookie` additionally requires host `cookies` permissions. Sync limits: `storage.sync` 102 400 bytes total / 8 192 per item / 512 items ([MDN storage.sync](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/sync)). See `managers.md` §7 for sync scope.

### Networking

| API | TM | VM | GM4+ | Safari Userscripts | Notes |
|-----|----|----|------|-------------------|-------|
| `GM_xmlhttpRequest` (callback) | ✅ returns `{abort}` | ✅ returns control | ❌ | ✅ legacy `GM_xmlhttpRequest(details)` alias returning `{abort}` (primary is `GM.xmlHttpRequest` custom Promise + `abort`) | Safari exposes both `GM.xmlHttpRequest` (custom Promise + `abort`) and legacy `GM_xmlhttpRequest` alias ([quoid/userscripts README API section](https://github.com/quoid/userscripts#api)) |
| `GM.xmlHttpRequest` (promise) | ✅ (capital H) | ✅ since 2.18.3 | ✅ | ✅ custom promise + `abort` | Shapes differ — feature-detect |
| `GM_addStyle` | ✅ sync returns `<style>` | ✅ sync returns `<style>` | ❌ removed in 4.0 (polyfill `gm4-polyfill.js`) | ❌ deprecated / partial `GM.addStyle` only |  |
| `GM.addStyle` (promise) | ✅ | ✅ since 2.12.0 | ❌ polyfill only | ✅ partial impl | Safari verified: partial `addStyle` |
| `GM_notification` / `GM.notification` | ✅ | ✅ | ✅ (`GM.notification` promise) | ❌ | GM = `GM.notification` promise form |
| `GM_download` / `GM.download` | ✅ | ✅ | ❌ (gist polyfill) | ❌ |  |
| `GM_openInTab` / `GM.openInTab` | ✅ | ✅ | ⚠️ bool/partial opts | ✅ bool arg only (verified) | Safari verified: `openInTab`/`closeTab` |

### DOM & Injection

| API | TM | VM | GM4+ | Safari Userscripts | Notes |
|-----|----|----|------|-------------------|-------|
| `GM_addElement` / `GM.addElement` | ✅ sync + promise | ✅ sync + promise | ❌ (issue #2484) | ❌ | CSP handling differs — see § Sandbox |
| `unsafeWindow` | ✅ needs explicit `@grant unsafeWindow` when other grants exist | ✅ exposed without grant; sandbox off only with `@grant none` (VM ≥2.32) | ✅ (`wrappedJSObject` equiv.) | ❌ **none at all** | Any `@grant` ⇒ Safari forced content world |
| `GM_webRequest` + `@webRequest` | ⚠️ experimental, **Firefox MV2 only**; broken TM Chrome MV3 5.2+ (issue #2209) | ❌ wontfix (issue #583) | ❌ | ❌ | NOT a browser-capability row — manager + manifest matter |
| `GM_audio` (`setMute`/`getState`/`addStateChangeListener`) | ⚠️ **experimental, TM 5.4+** (beta 5.3.6230); current tab only | ❌ | ❌ | ❌ | NOT universal; not 5.0 |

### SPA Navigation & Metadata

| Feature | TM | VM | GM4+ | Safari Userscripts | Notes |
|---------|----|----|------|-------------------|-------|
| `window.onurlchange` (`@grant window.onurlchange`) | ✅ `addEventListener('urlchange', info => info.url)` | ❌ declined (issue #1195) | ❌ | ❌ | Portable fallback: patch `history.pushState`/`replaceState` + `popstate`/`hashchange` (see snippet below); VM also has `@violentmonkey/url` / `VM.onNavigate` |
| `@run-at` defaults | `document-idle` | `document-end` | `document-end` | `document-end` | TM idle vs others end — see pitfalls in `common-pitfalls.md` |
| `@sandbox` | `raw` / `javascript` / `dom` (TM 4.18+) | n/a — uses `@inject-into` | n/a (always sandboxed) | n/a — uses `@inject-into` | VM/Safari: `@inject-into auto/page/content` |
| `@run-in` | `normal-tabs` / `incognito-tabs` / `container-id-N` (TM 5.3+) | ignored (parsed-but-ignored) | ignored | ignored | Firefox containers otherwise unreachable |

---

## Sandbox & Execution Context (Manager-First)

| Aspect | TM | VM | GM4+ | Safari Userscripts |
|--------|----|----|------|-------------------|
| Isolation directive | `@sandbox raw` (page world, default) / `javascript` / `dom` (isolated) | `@inject-into auto` (default; tries page, falls back to content) / `page` / `content` | Always sandboxed (Xray vision in Firefox) | Any `@grant` ⇒ forced content world |
| Page-CSP handling | May strip/relax CSP headers in some modes — **do NOT rely on it** | **Respects page CSP** — falls back to content-world injection if page injection fails; no header stripping | Subject to Firefox sandbox rules | Content world only |
| Reaching page JS from content world | `unsafeWindow` (guard: `typeof unsafeWindow !== 'undefined'`) | Chrome: bridge via `CustomEvent`/`postMessage` or `GM_addElement` data-URI trick; Firefox: `wrappedJSObject`/`cloneInto`/`exportFunction` | Firefox Xray: `wrappedJSObject`/`cloneInto`/`exportFunction` | Not possible — design without page-world access |
| `GM_info` fields | `sandboxMode: 'js'|'raw'|'dom'` (4.18+) | `injectInto: 'auto'|'page'|'content'` (`GM_info.injectInto`) | n/a | `scriptHandler === "Userscripts"` |

> MV3 workaround guard: always test `typeof unsafeWindow !== 'undefined'` before use — Safari has no `unsafeWindow` at all, so unguarded `unsafeWindow.fetch` patches crash there. See snippet below.

---

## Manifest V3 Limitations (Framed by Manager)

Chrome/Edge store builds are MV3; Firefox remains MV2. The restriction is manager-build + browser, not "browser capability" alone.

| Feature | TM MV3 (Chrome) | TM MV2 (Firefox) | VM MV3 (Chrome Web Store, verified 2026-08-24) / VM MV2 (Firefox) | Notes |
|---------|-----------------|------------------|-------------------------------------------------------------------|-------|
| `@webRequest` / `GM_webRequest` | ❌ broken 5.2+ (issue #2209) | ✅ experimental | ❌ wontfix everywhere (VM Chrome Web Store is also MV3 as of 2024, see [VM homepage](https://violentmonkey.github.io/)) | VM declined universally |
| Persistent background pages | ❌ removed in MV3 | ✅ | ❌ removed in MV3 (VM Chrome, MV3 banner verified 2026-08-24) / ✅ in Firefox | VM Chrome store build is MV3 |
| CSP bypass | More restricted in MV3 | Best-effort relaxation | VM respects CSP regardless (both MV3 and MV2) | Never rely on TM stripping |
| `Allow User Scripts` permission (TM 5.5+ on Chrome) | ⚠️ required toggle `chrome://extensions` → “Allow User Scripts” (see [TM changelog](https://www.tampermonkey.net/changelog.php) top banner, verified 2026-08-24) | n/a (MV2) | n/a — VM uses different permission model | Scripts appear broken until permission granted; follow `chrome://extensions` instructions |

### Workarounds (Guarded)

```javascript
// Guard unsafeWindow — Safari has none; check before patching
if (typeof unsafeWindow !== 'undefined' && unsafeWindow.fetch) {
    const originalFetch = unsafeWindow.fetch;
    // @grant unsafeWindow required in TM when other grants exist
    unsafeWindow.fetch = function(...args) {
        console.log('Intercepted fetch:', args[0]);
        return originalFetch.apply(this, args);
    };
}

// XMLHttpRequest interception — same guard
if (typeof unsafeWindow !== 'undefined' && unsafeWindow.XMLHttpRequest) {
    const originalOpen = unsafeWindow.XMLHttpRequest.prototype.open;
    unsafeWindow.XMLHttpRequest.prototype.open = function(method, url) {
        console.log('Intercepted XHR:', method, url);
        return originalOpen.apply(this, arguments);
    };
}

// SPA navigation portable fallback (TM-only window.onurlchange is NOT portable)
function onNavigate(callback) {
    // TM-only fast path capability check
    if (typeof window !== 'undefined' && window.onurlchange === null) {
        window.addEventListener('urlchange', e => callback(e.url));
        return;
    }
    // Portable fallback
    const wrap = (fn) => function(...args) {
        const ret = fn.apply(this, args);
        window.dispatchEvent(new Event('locationchange'));
        return ret;
    };
    history.pushState = wrap(history.pushState);
    history.replaceState = wrap(history.replaceState);
    window.addEventListener('popstate', () => callback(location.href));
    window.addEventListener('hashchange', () => callback(location.href));
    window.addEventListener('locationchange', () => callback(location.href));
    // VM-specific: also available via `VM.onNavigate` from @violentmonkey/url
}
```

---

## Firefox-Specific Bridges (Browser-Scoped, Manager-Filtered)

`cloneInto` / `exportFunction` are **Firefox Xray** features, not manager features. They apply to GM4+ and TM-on-Firefox when running in the Firefox USERSCRIPT_WORLD. They do not exist in Chromium.

```javascript
// Share object with page (Firefox)
function shareWithPage(name, value) {
    if (typeof cloneInto !== 'undefined') {
        // Firefox Xray — must use cloneInto
        unsafeWindow[name] = cloneInto(value, unsafeWindow, {
            cloneFunctions: true
        });
    } else {
        // Chromium — direct assignment (guard Safari)
        if (typeof unsafeWindow !== 'undefined') unsafeWindow[name] = value;
    }
}

// Export function for page to call (Firefox)
function exportToPage(name, fn) {
    if (typeof exportFunction !== 'undefined') {
        // Firefox
        unsafeWindow[name] = exportFunction(fn, unsafeWindow);
    } else {
        if (typeof unsafeWindow !== 'undefined') unsafeWindow[name] = fn;
    }
}
```

**Firefox containers:** the stable, manager-agnostic Firefox mechanism is contextual identities. TM's unrelated `@run-in container-id-N` (TM 5.3+) is a TM-only metadata directive for targeting containers — do not conflate with `GM_info.container` or generic Firefox container tabs. Verify per manager before using `@run-in`.

---

## Safari Userscripts App — Neutral Per-Manager Comparison

Safari uses the third-party "Userscripts" app (by quoid); Tampermonkey on Safari is a separate paid app. The comparison below is neutral per-manager, not "Safari vs Tampermonkey (reference)".

| Aspect | Safari Userscripts (quoid) | TM | VM | GM4+ | Notes |
|--------|---------------------------|----|----|------|-------|
| Installation | Mac App Store → Safari → Extensions → Always Allow | Extension store | Extension store | Extension store |  |
| Script handler literal | `GM_info.scriptHandler === "Userscripts"` | `"Tampermonkey"` | `"Violentmonkey"` | `"Greasemonkey"` | Branch by capability, not name (see `managers.md`) |
| Supported GM subset (verified) | `GM.addStyle` (partial) · `GM.getValue`/`setValue`/`listValues`/`deleteValue` (promise) · `GM.xmlHttpRequest` (promise, custom + `abort`) · `GM.openInTab`/`closeTab` (bool arg) · `GM.setClipboard` (deprecated #655) · `GM.info` (`GM_info`) | Full per § API | Full per § API | Promise-only filtered set | Everything else — including `unsafeWindow`, menu commands (`GM_registerMenuCommand`), notifications, cookies (`GM_cookie`), `GM_addElement`, `GM_webRequest`, `GM_audio` — is ❌ on Safari |
| Unsupported (verified ❌) | `unsafeWindow` (NONE, even with grants) · `GM_notification` · `GM_cookie` · `GM_download` · `GM_webRequest` · `GM_audio` · `window.onurlchange` · `GM_addElement` (full) · menu commands | — | — | — |  |
| Execution model | Any `@grant` ⇒ forced content world (isolated); no page-world access | `@sandbox` selectable | `@inject-into` selectable | Always sandboxed | Design Safari scripts without page-world access |
| Auto-update | Manual | Automatic | Automatic | Automatic |  |

> **Safari platform divergence (verified 2026-08-24):** Userscripts requires iOS 15.1+ / macOS 12+ with Safari 14.1+ ([quoid README](https://github.com/quoid/userscripts/blob/main/README.md), [App Store](https://apps.apple.com/us/app/userscripts/id1463298887) lists iOS 15.0+/macOS 12.0+). macOS has built-in editor at `~/Library/Containers/Userscripts/Data/Documents/scripts`; iOS has **no built-in editor** — edit via external editor or `.user.js` file drop into the chosen directory. Using an iCloud Drive folder for sync between macOS ↔ iOS works but with delays and possible file eviction due to optimization; since macOS 15 / iOS 18 use “Keep Downloaded” to avoid eviction (see [issue #424](https://github.com/quoid/userscripts/issues/424), README iCloud note).

> **Tampermonkey on Safari distinction (verified 2026-08-24):** separate app `net.tampermonkey.SafariWebExt` (Safari + Safari iOS, App Store) vs free GPL quoid Userscripts app (`id1463298887`, © 2018-2026 Justin Wasack). Also `net.tampermonkey.SafariApp` legacy. See [TM Q406](https://www.tampermonkey.net/faq.php?locale=en&q=Q406) ID table. Branch by `GM_info.scriptHandler` capability, not app price/name.

Writing Safari-compatible scripts:

```javascript
// Detect via capability, not UA — but handler literal is "Userscripts" when needed
const handler = (typeof GM_info !== "undefined" ? GM_info : GM.info)?.scriptHandler;

// Use only widely-supported promise APIs
// @grant GM.getValue
// @grant GM.setValue
// @grant GM.xmlHttpRequest

// Feature-detect before use
if (typeof GM !== 'undefined' && GM.xmlHttpRequest) {
    await GM.xmlHttpRequest({ method: 'GET', url: 'https://example.com/data' });
}
```

---

## Cross-Manager Best Practices

### 1. Feature Detection (Prefer Over Handler Checks)

```javascript
// Check if API exists before using
if (typeof GM_notification !== 'undefined' || (typeof GM !== 'undefined' && GM.notification)) {
    (GM.notification ?? GM_notification)({ text: 'Hello!' });
} else {
    alert('Hello!');  // Fallback
}

// Check for Firefox-specific bridges
const isFirefoxXray = typeof cloneInto !== 'undefined';

// Capability checks over scriptHandler
const canBatch = typeof GM !== 'undefined' && typeof GM.getValues === 'function';
const canCookie = typeof GM_cookie !== 'undefined' || (typeof GM !== 'undefined' && GM.cookie);
```

### 2. Graceful Degradation

```javascript
// Provide fallbacks for unsupported managers
async function showNotification(message) {
    if (typeof GM_notification !== 'undefined') {
        GM_notification({ text: message });
    } else if (typeof GM !== 'undefined' && GM.notification) {
        await GM.notification({ text: message });
    } else if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(message);
    } else {
        console.log('Notification:', message);
    }
}
```

### 3. Avoid Browser-Sniffing

```javascript
// Wrong — manager, not browser, determines GM support
if (navigator.userAgent.includes('Firefox')) {
    // Firefox-specific code
}

// Right — feature / manager capability detection
if (typeof exportFunction !== 'undefined') {
    // Use exportFunction
} else if (typeof unsafeWindow !== 'undefined') {
    // Use unsafeWindow bridge
} else {
    // Safari — no page-world access; design around it
}
```

### 4. Test in Multiple Managers First

Before releasing a script (manager-first matrix; Violentmonkey first as owner default):

| Step | Manager | What to verify |
|------|---------|----------------|
| 1 | Violentmonkey (Chrome + Firefox) | Install/enable, storage types (objects ok), batch APIs (2.19.1+), CSP respects page (test `GM_addElement` fallback), `unsafeWindow` exposed |
| 2 | Tampermonkey (Chrome MV3 + Firefox MV2) | Same + `GM_cookie` stable, `GM_audio` 5.4 experimental only, `window.onurlchange` TM-only, `@sandbox`/`@run-in` |
| 3 | Greasemonkey 4+ (Firefox) | Promise-only APIs, primitives-only storage (stringify objects), no `GM_addStyle`/`GM_log`, `GM.notification` shape |
| 4 | Safari Userscripts (macOS/iOS 15.1+) | Promise subset only, no `unsafeWindow`, any `@grant` ⇒ content world; test that fallbacks don't crash |

---

## Manager-Aware Bugs & Workarounds

### `@run-at` Timing & Ready State

`@run-at` defaults differ by manager: TM = `document-idle`, VM/GM4+/Safari = `document-end`. Relying on defaults causes cross-manager drift.

```javascript
// Robust: wait for readyState regardless of manager default
function onReady(callback) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
        callback();
    }
}
// Or explicit metadata: // @run-at document-end
```

### CSP: `GM_addElement` Is Not Universal

- **TM:** may strip/relax CSP headers in some modes — do NOT rely on it.
- **VM:** respects page CSP; if page-world injection fails, VM falls back to content-world injection.
- **GM4+/Safari:** limited; no `GM_addElement` on GM4+/Safari.

Test in VM to surface CSP issues that TM silently hides. See `common-pitfalls.md` Pitfall 5.

### Manager-Sniffing Storage Types

```javascript
// GM4+ stores only strings/numbers/booleans — stringify objects yourself
const isGM4 = (typeof GM_info !== "undefined" ? GM_info : GM.info)?.scriptHandler === "Greasemonkey";
// Better: capability check
try {
    await GM.setValue('testObj', { a: 1 });
    const v = await GM.getValue('testObj');
    if (typeof v !== 'object') throw new Error('no object storage');
} catch {
    await GM.setValue('testObj', JSON.stringify({ a: 1 }));
}
```

---

## Version Requirements (Manager-Qualified)

Version numbers are Tampermonkey's unless stated; GM4+/Safari have no version-gated equivalents for many rows (marked ❌).

| Feature | Minimum Version |
|---------|-----------------|
| `GM.*` async promise APIs (capital-G `GM.*`) | TM 4.x-era additions; GM4+ = promises ONLY (sync `GM_*` removed) |
| `GM_audio` (`setMute`/`getState`/`addStateChangeListener`) | **TM 5.4+ (experimental)** — not 5.0, not universal |
| `@tag` / `GM_notification.tag` | TM 5.0+ |
| Batch `GM_getValues` / `GM_setValues` / `GM_deleteValues` (sync & promise) | **TM 5.3+ / VM 2.19.1+**; GM4+/Safari ❌ |
| `@run-in` (`normal-tabs`/`incognito-tabs`/`container-id-N`) | **TM 5.3+** (TM-only; ignored elsewhere) |
| `@sandbox` (`raw`/`javascript`/`dom`) | **TM 4.18+** (TM-only; VM/Safari use `@inject-into`) |
| `GM_cookie` (`GM_cookie` / `GM.cookie` with `partitionKey`) | **TM stable / VM 2.35.1+**; GM4+/Safari ❌; TM `partitionKey` 5.2+, httpOnly beta-gated |
| `GM_addElement` return value (element) | TM 5.5.0+; VM since early 2.x |

```javascript
// Check the manager version — version is that manager's own
const version = (typeof GM_info !== "undefined" ? GM_info : GM.info)?.version;
console.log('Manager version:', version);

// Feature detection is safer than version checking
if (typeof GM_audio !== 'undefined' || (typeof GM !== 'undefined' && GM.audio)) {
    // TM 5.4+ only
}
if (typeof GM !== 'undefined' && GM.getValues) {
    // Batch available (TM 5.3+ / VM 2.19.1+)
}
```
