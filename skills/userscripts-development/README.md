# Write portable userscripts that work on any manager

This skill helps you ship one .user.js that runs on Tampermonkey, Violentmonkey, Greasemonkey 4 and Safari Userscripts without forking. It is for authors and maintainers who want the portable subset up front and the manager traps labeled clearly. The subset matters because Tampermonkey enforces @connect strictly, Violentmonkey respects page CSP and falls back from page to content, Greasemonkey 4 ships only GM.* promises and stores primitives as strings, numbers or booleans, and Safari forces content world as soon as you request any GM API.

## Quick path

1. Read the core digest in SKILL.md. It lists the four managers, their API style and the one-line divergence you will hit first.
2. Follow touch to reference routing. Before you write storage, network, DOM, SPA or sandbox code, open the one owning file from the table. Do not read cover to cover.
3. Run the pre-delivery gates against the final code. Check the checklist below, then run the security checklist section that matches what you touched. Ship only when all gates pass.

## Details

| Topic | Decision |
|---|---|
| Persistent storage | Use await GM.getValue and GM.setValue. Sync GM_* is missing on Greasemonkey 4 and Safari. Greasemonkey 4 stores primitives only, so JSON.stringify objects on write and JSON.parse on read. Read more in [api-storage.md](references/api-storage.md) and [managers.md](references/managers.md). |
| Network | Use GM.xmlHttpRequest for cross origin requests that need to skip page CORS and CSP. Page fetch stays subject to both. Declare @connect per host for Tampermonkey compatibility, Violentmonkey records it but does not enforce. Read more in [http-requests.md](references/http-requests.md) and [header-reference.md](references/header-reference.md). |
| DOM injection | Try GM.addStyle or GM_addStyle, then fall back to createElement style. Both create a style element that CSP style-src can still block, so attach to document.head or document.documentElement and consider @run-at document-start. Read more in [api-dom-ui.md](references/api-dom-ui.md). |
| SPA navigation | Patch history pushState and replaceState and listen for popstate and hashchange. Tampermonkey-only window.onurlchange is optional, Violentmonkey declined it. Read more in [patterns.md](references/patterns.md) and [managers.md](references/managers.md). |
| Sandbox | Tampermonkey uses @sandbox raw, JavaScript or DOM, Violentmonkey and Safari use @inject-into page, content or auto, Greasemonkey 4 ignores both and stays sandboxed. @grant none disables the sandbox where supported, Safari has no unsafeWindow at all. Read more in [sandbox-modes.md](references/sandbox-modes.md) and [managers.md](references/managers.md). |

The portable fix works everywhere. The manager guard explains the degradation when it cannot. I still test the CSP fallback on Violentmonkey first, it shows the exact content-world behavior Safari will force.

## Reference map

### Core

- [managers.md](references/managers.md), the portable matrix for Tampermonkey, Violentmonkey, Greasemonkey 4 and Safari plus workflows and primary sources
- [manager-compat.md](references/manager-compat.md), tier-2 deltas for ScriptCat, AdGuard, FireMonkey and OrangeMonkey
- [header-reference.md](references/header-reference.md), starter templates and every header tag with portability notes
- [url-matching.md](references/url-matching.md), @match and @include grammar and precedence
- [sandbox-modes.md](references/sandbox-modes.md), worlds, @sandbox versus @inject-into, @grant none and CSP handling
- [patterns.md](references/patterns.md), load detection, MutationObserver, SPA history patch and element helpers

### APIs

- [api-async.md](references/api-async.md), promise GM.* surface, the preferred form
- [api-sync.md](references/api-sync.md), sync GM_* surface and its absence on Greasemonkey 4 and Safari
- [api-storage.md](references/api-storage.md), GM.getValue and GM.setValue, batch limits and GM4 stringify rule
- [http-requests.md](references/http-requests.md), GM.xmlHttpRequest options, @connect enforcement and fallback to page fetch
- [web-requests.md](references/web-requests.md), GM_webRequest scope, Firefox MV2 only
- [api-cookies.md](references/api-cookies.md), GM_cookie with partitionKey and httpOnly gates
- [api-dom-ui.md](references/api-dom-ui.md), GM_addStyle, GM_addElement and unsafeWindow matrix
- [api-tabs.md](references/api-tabs.md), GM_openInTab and cross-tab helpers
- [api-audio.md](references/api-audio.md), Tampermonkey-only GM_audio with feature detect

### Quality and tooling

- [common-pitfalls.md](references/common-pitfalls.md), the 12 pitfalls to scan before delivery
- [security-checklist.md](references/security-checklist.md), HTTPS only, no secrets, sanitize before DOM insertion
- [debugging.md](references/debugging.md), manager-specific inspect steps
- [testing.md](references/testing.md), Vitest with happy-dom, mock-violentmonkey and the new real-profile section with agent bridges
- [browser-compatibility.md](references/browser-compatibility.md), Firefox Xray, Chrome userScripts world and CSP notes
- [version-numbering.md](references/version-numbering.md), portable X.Y.Z, why Greasemonkey needs full semver and how Violentmonkey compares
- [publishing.md](references/publishing.md), Greasy Fork and OpenUserJS rules
- [typescript.md](references/typescript.md), bundler and type setup

## Checklist

- [ ] @match is scoped, never *://*/*, and at least one @match or @include exists
- [ ] All URLs are HTTPS, no secrets are embedded, DOM insertion sanitizes untrusted data
- [ ] Every manager-specific API is labeled by owner and guarded by typeof
- [ ] Async GM.* is preferred, sync GM_* has a documented fallback
- [ ] Only declared @grant APIs are called, @grant none is explicit when you want page world
- [ ] @run-at is set explicitly, do not rely on TM document-idle versus VM document-end defaults
- [ ] @connect lists each cross origin host, @version is X.Y.Z and was incremented
- [ ] common-pitfalls.md sections for touched APIs were read this task, security-checklist.md was checked against the final code

## Next step

References live in [references/](references/). To propose a change, edit the single owning file, keep any verified stamps verbatim, and keep the diff focused on portable behavior. I run a per-file worker loop, one file at a time, verify the primary source link, and do not re-add detail that the prune removed unless it changes portable code. If you touch a manager-only exception, label the owner, add the typeof guard and note the native extension escalation path.
