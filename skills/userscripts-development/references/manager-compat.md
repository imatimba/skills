# Tier-2 Manager Compatibility

A tier-2 manager is one whose divergence from the portable baseline (TM/VM/GM4+/Safari — see [managers.md](managers.md)) justifies dedicated notes; coverage depth follows divergence, not popularity. The portable baseline's own cross-manager divergences are owned here to keep [common-pitfalls.md](common-pitfalls.md) slim — see the Tier-1 section immediately below.

---

## Tier-1 Portable Baseline — Cross-Manager Divergences

Authoritative matrix for TM / VM / GM4+ / Safari lives in [managers.md](managers.md) (§2 API Support Matrix, §3 Header Differences, §4 Sandbox/Injection). [common-pitfalls.md Pitfall 12](common-pitfalls.md#pitfall-12-cross-browser--cross-manager-differences) keeps only symptom → diagnostic → pointer.

This section previously duplicated that matrix (including `cloneInto`/`exportFunction` Xray bridges, `GM_webRequest`/`@webRequest` manifest framing, containers, storage primitives/race, and `GM_log`). For portability decisions, consult [managers.md](managers.md) directly — no manager-specific code change is needed beyond what that matrix already prescribes (guard `unsafeWindow`, feature-detect `GM.*` vs `GM_*`, `JSON.stringify` for GM4+ storage, `console.log` over `GM_log`, and avoid `GM_webRequest` portably).

---

## ScriptCat

ScriptCat — Chromium + Edge + Firefox desktop (MV3, historically MV2); no mobile. Current builds are MV3 (`background.service_worker` + `chrome.userScripts.register` — verified 2026-08-25 — https://raw.githubusercontent.com/scriptscat/scriptcat/main/src/manifest.json).

| Area | ScriptCat divergence — portable impact |
| --- | --- |
| API parity | ScriptCat — full `GM_*` sync AND `GM.*` promise parity, including batch `GM.getValues` / `GM.setValues` / `GM.deleteValues` (verified 2026-08-25 — https://docs.scriptcat.org/docs/dev/api#gm_setvalues--gm_getvalues--gm_deletevalues-) — portable: batch not available on GM4+/Safari; feature-detect before use |
| `@inject-into` | ScriptCat — supports ONLY `page` \| `content` (default `page`) — NO `auto`; ScriptCat docs state it does not auto-check CSP like Tampermonkey's `auto` (verified 2026-08-25 — https://docs.scriptcat.org/docs/dev/meta#inject-into) — portable: declare `page` or `content` explicitly; avoid `auto` |
| `unsafeWindow` | ScriptCat — available only in `page` mode (verified 2026-08-25 — https://docs.scriptcat.org/docs/dev/meta#inject-into — content-mode `unsafeWindow` is content `window`, not page `window`) — portable: guard `typeof unsafeWindow !== 'undefined'`; don't assume it in `content` mode |
| `@connect` + download | ScriptCat — `@connect` enforced for native-mode `GM_download` (undeclared hosts prompt) (verified 2026-08-25 — https://docs.scriptcat.org/docs/dev/api#gm_download) — portable: always declare `@connect` for download hosts |
| Non-portable SC-only | ScriptCat — `@storageName` (verified 2026-08-25 — https://docs.scriptcat.org/docs/dev/meta#storagename-), `@background`/`@crontab` (verified 2026-08-25 — https://docs.scriptcat.org/docs/dev/meta#background and #crontab), `CAT_*` extension APIs (verified 2026-08-25 — https://docs.scriptcat.org/docs/dev/api — `CAT_*` namespace) — all SC-only; avoid in portable scripts; see ScriptCat docs |

Verify: docs.scriptcat.org (https://docs.scriptcat.org/docs/dev/meta, https://docs.scriptcat.org/docs/dev/api)

---

## AdGuard

| Area | AdGuard divergence — portable impact |
| --- | --- |
| Supported GM subset | AdGuard — documented: `GM.info`/`GM_info`, `GM.setValue`/`getValue`/`listValues`/`deleteValue`, `GM.getResourceUrl`, `GM.setClipboard`, `GM.xmlHttpRequest`, `GM.openInTab`, `GM.notification`, `unsafeWindow`, `GM.getResourceText`, `GM.addStyle`, `GM.log`, `GM.addElement`, `window.onurlchange` (verified 2026-08-25 — https://adguard.com/kb/general/extensions/#supported-gm-functions) — if not listed (e.g., `GM_cookie`, `GM_addValueChangeListener`, streaming), treat as unsupported portably |
| Not supported | AdGuard — per official KB: `GM_cookie`, httpOnly cookie access, `xmlHttpRequest` streaming; AdGuard — `@unwrap` ignored; omitted APIs imply unsupported — supported list is finite and version-sensitive (verified 2026-08-25 — https://adguard.com/kb/general/extensions/#unsupported-properties and #supported-gm-functions) — Violentmonkey `GM_cookie` httpOnly entries listed only when HTTP-only option enabled globally + per-script (verified 2026-08-25 — https://violentmonkey.github.io/api/gm/#gm_cookie) |

Verify: adguard.com/kb/general/extensions/ (https://adguard.com/kb/general/extensions/)

---

## FireMonkey

FireMonkey — Firefox-only (v3.x needs FF 128+; experimental Firefox Android via Nightly + temporary add-on sideload). Built on Firefox `userScripts.register` / `contentScripts.register` (verified 2026-08-25 — https://github.com/erosman/firemonkey — manifest `v3.8` + https://erosman.github.io/firemonkey/src/content/about.html — "Increased minimum version to Firefox 128").

| Area | FireMonkey divergence — portable impact |
| --- | --- |
| `@grant` semantics | FireMonkey — `@grant NONE` or ABSENT both mean page-context injection (unlike TM/VM where absent grant ≠ `none` semantics differ); FireMonkey — ANY `@grant` switches to sandboxed execution with GM APIs (verified 2026-08-25 — https://erosman.github.io/firemonkey/src/content/help.html#grant) — portable: be explicit with `@grant` |
| `@allFrames` | FireMonkey — defaults `FALSE` (TM/VM default `true`) (verified 2026-08-25 — https://erosman.github.io/firemonkey/src/content/help.html — "FireMonkey conforms to the Firefox and Chrome userScripts and content_scripts API defaults" + metadata table `@allFrames` default false) — portable: set `@allFrames` explicitly when frame injection matters |
| `@run-at` defaults | FireMonkey — `document-idle` for JS, `document-start` for CSS (verified 2026-08-25 — https://erosman.github.io/firemonkey/src/content/help.html#run-at) — portable: set `@run-at` explicitly; don't rely on defaults |
| `GM.*` async parity | FireMonkey — `GM.xmlHttpRequest` updated v3.0 to return `Promise` (breaking, verified 2026-08-25 — https://erosman.github.io/firemonkey/src/content/help.html#user-script-api-comparison — `GM.xmlHttpRequest` `pass async v3.0`); `GM.getResourceUrl` returns synchronously (also works with `await`) — not fully Promise-native across all APIs (verified 2026-08-25 — same table — `GM.getResourceUrl` `pass sync (different)`) — portable: `await` but don't assume uniform Promise shape; feature-detect |
| Missing / removed APIs | FireMonkey — `GM_cookie` added v3.0; `GM.getTab`/`GM.getTabs`/`GM.saveTab`, `GM.createObjectURL`, `GM.import` removed or `not working` per API comparison table (verified 2026-08-25 — https://erosman.github.io/firemonkey/src/content/help.html#user-script-api-comparison) — portable: feature-detect; degrade if absent |

Verify: https://erosman.github.io/firemonkey/src/content/help.html + https://github.com/erosman/firemonkey

---

## Mobile Managers

No API delta vs desktop — portability is about availability, not code. Violentmonkey works on Firefox Android; Tampermonkey on Android is fragmented (Firefox build works; Chromium requires Edge Canary manual load; Kiwi Browser archived Jan 2025) — UNVERIFIED (2026-08-25) — issues 2241/2416 and AMO listings not fetched from primary sources; verify at https://violentmonkey.github.io + https://addons.mozilla.org. MV3 "Allow user scripts" toggle is browser-level, not a script header change.

---

## OrangeMonkey — UNVERIFIED

| Area | Status |
| --- | --- |
| Browsers / parity | OrangeMonkey — Chromium-only Violentmonkey fork, claims full `GM_*` availability; large user base — UNVERIFIED (2026-08-25) — no primary OrangeMonkey docs/repo located; chrome.google.com listing not verified — verify against its own docs before claiming support |

Verify: UNVERIFIED (2026-08-25) — no primary OrangeMonkey docs/repo located; chrome.google.com listing not verified

---
