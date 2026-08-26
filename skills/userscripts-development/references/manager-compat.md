# Tier-2 Manager Compatibility

A tier-2 manager is one whose divergence from the portable baseline (TM/VM/GM4+/Safari — see [managers.md](managers.md)) justifies dedicated notes; coverage depth follows divergence, not popularity. The portable baseline's own cross-manager divergences are owned here to keep [common-pitfalls.md](common-pitfalls.md) slim — see the Tier-1 section immediately below.

---

## Tier-1 Portable Baseline — Cross-Manager Divergences

Divergences among the portable baseline managers (Tampermonkey / Violentmonkey / Greasemonkey 4+ / Safari Userscripts). [common-pitfalls.md Pitfall 12](common-pitfalls.md#pitfall-12-cross-browser--cross-manager-differences) keeps only symptom → diagnostic → pointer; this section is the single home for the matrix (verified 2026-08-24 where noted).

### Firefox-only Xray bridges (not GM APIs)

`cloneInto` and `exportFunction` exist only in Firefox Xray (GM4+ and TM-on-Firefox); they are not GM APIs.

```javascript
// cloneInto and exportFunction only exist in Firefox Xray (GM4+ and TM-on-Firefox)
if (typeof cloneInto !== 'undefined') {
    unsafeWindow.myData = cloneInto(data, unsafeWindow, { cloneFunctions: true });
} else if (typeof unsafeWindow !== 'undefined') {
    unsafeWindow.myData = data;  // Chromium page-world
} else {
    // Safari — no page-world access at all; stay in content world
    console.warn('No page-world bridge available');
}
```

> **Function serialization specifics (verified 2026-08-24):** Assigning a function via `unsafeWindow.fn = myFn` through the structured clone algorithm throws `DataCloneError` on Firefox (MDN: "Function objects cannot be duplicated ... attempting to throws a DataCloneError" — https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm). Xray `cloneInto` strips functions by default because it uses structured clone; pass `{ cloneFunctions: true }` to preserve them. To expose a callable to the page, use `exportFunction` instead — `exportFunction(fn, unsafeWindow, { defineAs: 'fn' })` (MDN Sharing objects with page scripts — https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Sharing_objects_with_page_scripts). On Chromium there is no Xray; direct `unsafeWindow.fn = fn` assignment works but prototype chains are not walked (MDN: "The prototype chain is not walked or duplicated"). Guard accordingly.

### Manifest V3 limitations (framed by manager, not browser)

```javascript
// @webRequest / GM_webRequest is NOT "Chrome MV3" generically — it's:
// TM experimental, Firefox MV2 only; broken on TM Chrome MV3 5.2+ (issue #2209);
// VM wontfix (issue #583); GM/Safari ❌.
// Don't present as browser capability row — it's manager + manifest.
if (typeof GM_webRequest !== 'undefined') {
    // TM Firefox MV2 only
    GM_webRequest([...], listener);
} else if (typeof unsafeWindow !== 'undefined') {
    // MV3 portable alternative: page-level fetch/XHR patch (guard Safari absent)
    // see browser-compatibility.md workaround snippet
}
```

### Summary matrix — manager-aware facts

| Topic | Manager-aware fact | Browser tie |
|-------|-------------------|-------------|
| `cloneInto` / `exportFunction` | Firefox Xray vision — GM4+ and TM-on-Firefox; not a GM API — `cloneInto` without `cloneFunctions:true` strips functions via `DataCloneError` (MDN structured clone) | Firefox only; Chromium has no Xray |
| `GM_webRequest` / `@webRequest` | TM experimental Firefox MV2 only; broken TM Chrome MV3 5.2+; VM wontfix; GM/Safari ❌ | Manifest (MV2 vs MV3) + manager |
| Firefox containers | TM's `@run-in container-id-N` (TM 5.3+) is TM-only; Firefox's native contextual identities are separate | Firefox only |
| Storage types | GM4+ stores **primitives only** — `JSON.stringify` objects yourself; TM/VM/Safari store objects | Manager, not browser |
| Storage race / atomicity | `GM.*` storage is async with no cross-tab transactions — concurrent `GM.getValue` → `GM.setValue` races | Manager (all) — especially parallel tabs |
| Logging | `GM_log` removed in GM4+ — use `console.log` | Manager (GM4+) |

> **Storage race & atomicity (verified 2026-08-24 via Greasespot wiki):** `GM.getValue`/`GM.setValue` return promises with no transaction. Concurrent read-modify-write from two tabs races — final value may reflect only one increment (e.g., 64 instead of 100). Wiki stresses "Note awaiting the set -- required so the next get sees this set" (https://wiki.greasespot.net/GM_getValue) and warns "Doing many gets/many sets can be slow. Instead get/set one value ... or use Promise.all()". Mitigations: (1) batch state in a single JSON object behind one key, (2) serialize with `await` ordering, (3) use `GM_addValueChangeListener` to react to external writes, or (4) implement a compare-and-swap loop. See also `GM_setValue` primitives-only note — https://wiki.greasespot.net/GM_setValue.

---

## ScriptCat

ScriptCat — Chromium + Edge + Firefox desktop (MV3, historically MV2); no mobile. Current builds are MV3 (`background.service_worker` + `chrome.userScripts.register` per `docs/ARCHITECTURE.md`).

| Area | ScriptCat divergence |
| --- | --- |
| API parity | ScriptCat — full `GM_*` sync AND `GM.*` promise parity, including batch `GM.getValues` / `GM.setValues` / `GM.deleteValues` |
| `@inject-into` | ScriptCat — supports ONLY `page` \| `content` (default `page`) — NO `auto`; ScriptCat docs state it does not auto-check CSP like Tampermonkey's `auto` |
| `unsafeWindow` | ScriptCat — available only in `page` mode |
| `@storageName` | ScriptCat — enables cross-script storage sharing |
| `GM_setValue` delete | ScriptCat — `GM_setValue(key, undefined)` DELETES the key (differs from Tampermonkey) |
| `GM_log` | ScriptCat — `GM_log(msg, level)` accepts `debug` \| `info` \| `warn` \| `error` |
| Notifications | ScriptCat — extends `GM_notification` with `progress` field + `buttons` array (max 2 buttons, Firefox unsupported); adds `GM_closeNotification(id)` / `GM_updateNotification(id, details)` |
| `@connect` + download | ScriptCat — `@connect` enforced for native-mode `GM_download` (undeclared hosts prompt) |
| Background / schedule | ScriptCat — headers `@background` / `@crontab` exist for background/scheduled scripts |
| `CAT_*` APIs | ScriptCat — `CAT_fileStorage`, `CAT_userConfig`, and other `CAT_*` extension APIs exist — beyond this skill's scope — see official docs |
| `@run-at` / `@allFrames` | ScriptCat — `@run-at` defaults to `document-idle` (verified 2026-08-24 via `src/app/service/service_worker/utils.ts` fallback `document_idle` and `gm_info.ts`); `@allFrames` defaults `true` (no `@noframes` → `allFrames: true`, verified 2026-08-24) — matches TM/VM defaults |
| Version history | ScriptCat — `@inject-into` added v1.2 (verified 2026-08-24 via docs `v1.2` changelog); native `GM_download` honors `@connect` since PR #1506 (verified 2026-08-24) |

Verify: docs.scriptcat.org

---

## AdGuard

| Area | AdGuard divergence |
| --- | --- |
| Distribution | AdGuard — desktop apps (Windows/Mac/Android) act as system-level cross-browser userscript managers; AdGuard — browser extension supports userscripts since v5.2 via Chrome User Scripts API |
| Enable toggle | AdGuard — requires Developer mode toggle (<Chrome 138) or "Allow user scripts" (Chrome 138+) in `chrome://extensions` |
| Supported GM subset | AdGuard — documented: `GM.info`/`GM_info`, `GM.setValue`/`getValue`/`listValues`/`deleteValue`, `GM.getResourceUrl`, `GM.setClipboard`, `GM.xmlHttpRequest`, `GM.openInTab`, `GM.notification`, `unsafeWindow`, `GM.getResourceText`, `GM.addStyle`, `GM.log`, `GM.addElement`, `window.onurlchange` |
| Not supported | AdGuard — per official KB: `GM_cookie`, httpOnly cookie access, `xmlHttpRequest` streaming; AdGuard — `@unwrap` ignored; omitted APIs (`GM_cookie`, `GM_addValueChangeListener`, etc.) imply unsupported — supported list is finite and version-sensitive (verified 2026-08-24 via adguard.com/kb/general/extensions/) — Violentmonkey `GM_cookie` httpOnly entries listed only when HTTP-only option enabled globally + per-script (verified 2026-08-24 via violentmonkey.github.io/api/gm/) |
| `GM_` vs `GM.` | AdGuard — both `GM_` and `GM.` forms work (`GM_` deprecated-but-supported) |
| Portable baseline gap | Greasemonkey 4 — `GM_addStyle` removed as of GM 4.0 and `GM.getResourceText` does not exist (verified 2026-08-24 via wiki.greasespot.net) — present in TM/VM/SC/AdGuard; see `managers.md` baseline |

Verify: adguard.com

---

## FireMonkey

FireMonkey — Firefox-only (v3.x needs FF 128+; experimental Firefox Android via Nightly + temporary add-on sideload). Built on Firefox `userScripts.register` / `contentScripts.register`.

| Area | FireMonkey divergence |
| --- | --- |
| `GM_` vs `GM.` | FireMonkey — supports both `GM_` and `GM.` (recommends `GM.`) |
| `@grant` semantics | FireMonkey — `@grant NONE` or ABSENT both mean page-context injection (unlike TM/VM where absent grant ≠ `none` semantics differ); FireMonkey — ANY `@grant` switches to sandboxed execution with GM APIs |
| CSP | FireMonkey — page-mode injection blocked by page CSP |
| `@allFrames` | FireMonkey — defaults `FALSE` (TM/VM default `true`) |
| `@run-at` defaults | FireMonkey — `document-idle` for JS, `document-start` for CSS |
| `GM.*` async parity | FireMonkey — `GM.xmlHttpRequest` updated v3.0 to return `Promise` (breaking, verified 2026-08-24 via `erosman/firemonkey/releases/tag/v3.0`); `GM.getResourceUrl` returns synchronously (also works with `await`) — not fully Promise-native across all APIs (verified 2026-08-24) |
| Missing / removed APIs | FireMonkey — `GM_cookie` added v3.0; `GM.getTab`/`GM.getTabs`/`GM.saveTab`, `GM.createObjectURL`, `GM.import` removed or `not working` per API comparison table (verified 2026-08-24 via `erosman.github.io/firemonkey`) |
| `GM_info` deltas | FireMonkey — v3.0 removed a few `GM_info` properties, moved `GM.info.script.injectInto` → `GM.info.injectInto` to match Violentmonkey, added `GM.info.script.grant`/`require`/`runAt`; `GM.info.isIncognito` shows `No support at the moment` for MV3 (verified 2026-08-24) |
| Version history | FireMonkey — v3.0 breaking: `GM` APIs now depend on `@grant` (any `@grant` enables sandbox), `@grant none` injects into page, `@inject-into page` concatenates `@require` (verified 2026-08-24) |

Verify: erosman.github.io

---

## Mobile Managers

| Manager | Mobile support |
| --- | --- |
| Violentmonkey | Violentmonkey on Firefox Android — fully supported (AMO Android listing; Android 121+) |
| Tampermonkey | Tampermonkey on Android — fragmented: official Firefox Android build works; Chromium requires Edge Canary manual extension-load path (per Tampermonkey issues 2241/2416); Kiwi Browser archived Jan 2025 — do not recommend |
| MV3 toggles | Desktop Chrome/Edge — MV3 "Allow user scripts" / Developer-mode toggles apply; mobile support varies by browser UI |

Verify: violentmonkey.github.io

---

## OrangeMonkey — UNVERIFIED

| Area | Status |
| --- | --- |
| Browsers | OrangeMonkey — Chromium-only Violentmonkey fork, large user base |
| GM parity claim | UNVERIFIED — OrangeMonkey claims full `GM_*` availability; independent parity UNVERIFIED (no public API docs) — verify against its own docs before claiming support |

Verify: chrome.google.com

---
