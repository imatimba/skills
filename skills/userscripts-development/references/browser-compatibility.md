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
| Chrome MV2 → MV3 | Chrome 138+ disabled MV2 for all users; the Chrome Web Store build of Tampermonkey is **MV3** while the Firefox build remains MV2 — capabilities differ between them (notably `GM_webRequest`). Timeline: [MV2 deprecation timeline](https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline) (verified 2026-08-25 — https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline). |
| Edge (Chromium) — MV2 divergence | Edge Add-ons retains MV2 as of Edge 139 (verified 2026-08-25 — https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/manifest-v3); timeline differs from Chrome — [Edge MV3 timeline](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/manifest-v3). Do not apply Chrome dates verbatim to Edge. |
| Firefox | Retains MV2; supports `cloneInto`/`exportFunction`/containers. |
| Firefox Android caveat | Add-on installs from AMO but mobile APIs are reduced vs desktop — “Full features” is relative to Chromium mobile, not desktop parity. See [MDN storage.sync](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/sync) for sync limits. |
| Other Chromium browsers (Opera/Brave/Vivaldi etc.) | VM and TM list Chromium-family browsers — VM: Chrome, Firefox 57+, Edge, Chromium, Brave, Opera 15+, Vivaldi etc. ([VM get-it](https://violentmonkey.github.io/get-it/)); TM FAQ lists Chrome/Edge/Opera/Safari builds ([TM Q406](https://www.tampermonkey.net/faq.php?locale=en&q=Q406)). Opera users install VM from Chrome Web Store. Verified 2026-08-24. |

> **Tier-2 managers:** AdGuard, FireMonkey, ScriptCat and OrangeMonkey diverge on MV3/CSP and API coverage — see `managers.md` roster and `manager-compat.md` for the full matrix. Do not assume TM/VM parity. (verified 2026-08-25 — https://addons.mozilla.org/en-US/firefox/addon/firemonkey/)

---

## API Compatibility (by Manager) — Normative Source

See `managers.md` §2 for the normative per-manager API matrix (Storage, Networking, DOM & Injection, SPA Navigation) — it is the verified source of truth and is not duplicated here.

**Browser-relevant takeaway only:** Storage-type limits (e.g., GM4 primitives-only) and API presence (`GM_cookie`, `GM_audio`, `GM_webRequest`, `unsafeWindow`) are manager-enforced, not browser-enforced — they determine portable fallbacks, not browser branching. For quotas/persistence see `managers.md` §7 and [MDN storage.local](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local).

---

## Sandbox & Execution Context — Pointer

See `managers.md` §4 and `sandbox-modes.md` for normative isolation directives. Browser-relevant portable facts only:

- **Safari:** Any `@grant` ⇒ forced content world; no `unsafeWindow` / no page-world access — design without it.
- **Firefox Xray:** `cloneInto`/`exportFunction`/`wrappedJSObject` available on Firefox (GM4+ and TM-on-Firefox); absent in Chromium — see Firefox Bridges below.
- **CSP:** TM may strip/relax CSP headers in some modes — do NOT rely on it; VM respects page CSP and falls back to content-world injection if page injection fails (test in VM to surface CSP issues).

> MV3 workaround guard: always test `typeof unsafeWindow !== 'undefined'` before use — Safari has no `unsafeWindow` at all, so unguarded `unsafeWindow.fetch` patches crash there. See snippet below.

---

## Manifest V3 Limitations (Framed by Manager)

Chrome/Edge store builds are MV3; Firefox remains MV2. The restriction is manager-build + browser, not "browser capability" alone.

| Feature | TM MV3 (Chrome) | TM MV2 (Firefox) | VM MV3 (Chrome Web Store, verified 2026-08-24) / VM MV2 (Firefox) | Notes |
|---------|-----------------|------------------|-------------------------------------------------------------------|-------|
| `@webRequest` / `GM_webRequest` | ❌ broken 5.2+ (issue #2209) | ✅ experimental | ❌ wontfix everywhere (VM Chrome Web Store is also MV3 as of 2024, see [VM homepage](https://violentmonkey.github.io/)) | VM declined universally |
| Persistent background pages | ❌ removed in MV3 | ✅ | ❌ removed in MV3 (VM Chrome, MV3 banner verified 2026-08-24) / ✅ in Firefox | VM Chrome store build is MV3 |
| CSP bypass | More restricted in MV3 | Best-effort relaxation | VM respects CSP regardless (both MV3 and MV2) | Never rely on TM stripping |
| `Allow User Scripts` permission (TM 5.5+ on Chrome) | ⚠️ required toggle `chrome://extensions` → “Allow User Scripts” (see [TM changelog](https://www.tampermonkey.net/changelog.php) top banner) (verified 2026-08-25 — https://developer.chrome.com/docs/extensions/reference/api/userScripts) | n/a (MV2) | n/a — VM uses different permission model | Scripts appear broken until permission granted; follow `chrome://extensions` instructions |

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

`cloneInto` / `exportFunction` are **Firefox Xray** features, not manager features. They apply to GM4+ and TM-on-Firefox when running in the Firefox USERSCRIPT_WORLD. They do not exist in Chromium. (verified 2026-08-25 — https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts and https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Sharing_objects_with_page_scripts)

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

**Portable Safari facts (see `managers.md` §2 for full matrix):** Safari Userscripts exposes a promise-only subset — `GM.addStyle` (partial), `GM.getValue`/`setValue`/`listValues`/`deleteValue`, `GM.xmlHttpRequest` (custom Promise + `abort`), `GM.openInTab`/`closeTab` (bool arg), `GM.setClipboard` (deprecated), `GM.info` — and lacks `unsafeWindow`, `GM_notification`, `GM_cookie`, `GM_download`, `GM_webRequest`, `GM_audio`, `window.onurlchange`, `GM_addElement`, and menu commands. Execution model: any `@grant` ⇒ forced content world (isolated); no page-world access — design without it. Detect via capability, not UA; `GM_info.scriptHandler === "Userscripts"` when handler literal is needed.

> **Safari platform divergence (verified 2026-08-25 — https://github.com/quoid/userscripts/blob/main/README.md):** Userscripts requires iOS 15.1+ / macOS 12+ with Safari 14.1+ ([quoid README](https://github.com/quoid/userscripts/blob/main/README.md), [App Store](https://apps.apple.com/us/app/userscripts/id1463298887)). macOS has a built-in editor; iOS has no built-in editor — edit externally or via `.user.js` file drop. iCloud Drive sync between macOS ↔ iOS works but with delays and possible file eviction — see [issue #424](https://github.com/quoid/userscripts/issues/424).

> **Tampermonkey on Safari distinction (verified 2026-08-24):** separate app `net.tampermonkey.SafariWebExt` vs free GPL quoid Userscripts app (`id1463298887`). See [TM Q406](https://www.tampermonkey.net/faq.php?locale=en&q=Q406) ID table. Branch by `GM_info.scriptHandler` capability, not app price/name.

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

### 1. Feature Detection (Prefer Over Handler Checks) (verified 2026-08-25 — https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/userScripts and https://developer.chrome.com/docs/extensions/reference/api/userScripts — feature-detection guidance: check `typeof` API presence over UA sniffing; https://web.dev/articles/bfcache for page lifecycle events)

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

## Version Requirements — Pointer

Version numbers are Tampermonkey's unless stated; GM4+/Safari have no version-gated equivalents for many rows (marked ❌ in `managers.md` §2).

See `managers.md` §2 API Support Matrix, §3 Header Directive Differences, and Primary Sources for normative version gates. Prefer feature detection over version checks:

```javascript
// Feature detection is safer than version checking
if (typeof GM_audio !== 'undefined' || (typeof GM !== 'undefined' && GM.audio)) {
    // TM 5.4+ only
}
if (typeof GM !== 'undefined' && GM.getValues) {
    // Batch available (TM 5.3+ / VM 2.19.1+)
}
```
