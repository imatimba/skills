# Tier-2 Manager Compatibility

A tier-2 manager is one whose divergence from the portable baseline (TM/VM/GM4+/Safari — see [managers.md](managers.md)) justifies dedicated notes; coverage depth follows divergence, not popularity.

---

## ScriptCat

ScriptCat — Chromium + Edge + Firefox desktop (MV2); no mobile.

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

Verify: docs.scriptcat.org

---

## AdGuard

| Area | AdGuard divergence |
| --- | --- |
| Distribution | AdGuard — desktop apps (Windows/Mac/Android) act as system-level cross-browser userscript managers; AdGuard — browser extension supports userscripts since v5.2 via Chrome User Scripts API |
| Enable toggle | AdGuard — requires Developer mode toggle (<Chrome 138) or "Allow user scripts" (Chrome 138+) in `chrome://extensions` |
| Supported GM subset | AdGuard — documented: `GM.info`/`GM_info`, `GM.setValue`/`getValue`/`listValues`/`deleteValue`, `GM.getResourceUrl`, `GM.setClipboard`, `GM.xmlHttpRequest`, `GM.openInTab`, `GM.notification`, `unsafeWindow`, `GM.getResourceText`, `GM.addStyle`, `GM.log`, `GM.addElement`, `window.onurlchange` |
| Not supported | AdGuard — per official KB: `GM_cookie`, httpOnly cookie access, `xmlHttpRequest` streaming; AdGuard — `@unwrap` ignored |
| `GM_` vs `GM.` | AdGuard — both `GM_` and `GM.` forms work (`GM_` deprecated-but-supported) |

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
