---
name: userscripts-development
description: "Trigger: userscript, Violentmonkey, Tampermonkey, Greasemonkey, userscript manager, .user.js, @match, @grant, GM.* APIs. Write and debug userscripts for ANY manager: page modification, element hiding, auto-fill, scraping, SPA handling."
license: MIT
metadata:
  author: imatimba
  version: 2.0.0
---

# Userscript Development

## Activation Contract

Load when the user mentions userscripts or any userscript manager (Violentmonkey, Tampermonkey, Greasemonkey, ScriptCat, Safari "Userscripts" app), `.user.js` files, metadata headers (`@match`, `@grant`, `@run-at`), or GM APIs — or wants JS/CSS running in a page: modify pages, hide elements, auto-fill forms, scrape data, shortcuts, request interception, SPA navigation.

Do NOT use for Selenium/Puppeteer/Playwright automation, browser extensions (WebExtensions/MV3), or server-side scripts.

## Hard Rules

1. **Manager-neutral by default.** Label every manager-specific API/header with its owner (e.g. "Tampermonkey-only") and feature-detect it (`typeof GM.getValue === "function"`). Verify support against [managers.md](references/managers.md) before claiming it.
2. **Prefer `GM.*` promise APIs** — Greasemonkey 4+ ships ONLY those (sync `GM_*` removed; storage limited to strings/numbers/booleans).
3. **Never invent APIs, signatures, or version numbers.** Unverifiable claims stay marked UNVERIFIED.
4. **Scope tightly:** specific `@match` (never `*://*/*`), declared `@connect` per cross-origin host (enforced by TM only), HTTPS-only URLs, no embedded secrets, sanitise data before DOM insertion.
5. **Violentmonkey is the worked example** for concrete UI/workflow steps; other managers appear as labeled table rows.
6. Preserve existing behaviour when editing a user's script; relabel rather than erase manager-specific knowledge.

## Decision Gates

| Need | Portable default | Manager caveat |
| --- | --- | --- |
| Persistent settings | `await GM.getValue/setValue` | GM4+: primitives only; batch `GM.getValues/setValues`: TM 5.3+/VM 2.19.1+ |
| Cross-origin request | `GM.xmlHttpRequest` (+ legacy `GM_xmlhttpRequest`) | `@connect` enforced by TM only; `stream`/`anonymous`/`cookie` options TM-only |
| Inject CSS | `GM.addStyle`; fallback `createElement('style')` | Sync `GM_addStyle`: TM/VM only (removed in GM4) |
| SPA navigation | History-API interception (`pushState`/`replaceState` patch + `popstate`) | `window.onurlchange`: Tampermonkey-only |
| Page context | `unsafeWindow` behind `typeof` guard | Absent in Safari app |
| Menu / notification / clipboard | Feature-detect; degrade silently | Absent in Safari app; GM4 async-only |
| Injection timing | Set `@run-at` explicitly | Defaults differ: TM `document-idle`; GM/VM/Safari `document-end` |

Any fork not listed here: check [managers.md](references/managers.md) first.

## Execution Steps

1. **Scope**: derive `@match`/`@exclude` ([url-matching.md](references/url-matching.md)); set `@run-at` explicitly.
2. **Permissions**: minimal `@grant` set; know the sandbox model ([sandbox-modes.md](references/sandbox-modes.md); VM `@inject-into`, TM `@sandbox`).
3. **Headers**: build from [header-reference.md](references/header-reference.md) (starter templates at top).
4. **Implement** via [patterns.md](references/patterns.md); guard manager-specific calls with feature detection.
5. **Verify**: Pre-Delivery Gates + [security-checklist.md](references/security-checklist.md). TypeScript/bundler work: [typescript.md](references/typescript.md).
6. **Deliver** per Output Contract.

## Output Contract

Every delivered userscript includes:

1. 1–2 sentence explanation.
2. Complete script with ALL headers in one code block.
3. Install steps naming the target manager (default Violentmonkey: Dashboard → ➕ → paste, or drag/serve the `.user.js`).
4. Safe customisation points (selectors, timeouts, domains).
5. Every `@grant` with one-line justification.
6. Explicit per-manager notes for anything not portable.

## Pre-Delivery Gates

All MUST pass before returning code:

- [ ] Scoped `@match`; HTTPS resources; no secrets; DOM input sanitised.
- [ ] Every manager-specific API labeled AND `typeof`-guarded.
- [ ] Async `GM.*` preferred; sync fallback documented.
- [ ] Only declared-grant APIs called; version string present (`X.Y.Z`).

## References

**Core:** [managers.md](references/managers.md) (per-manager matrix, sandbox/CSP, workflows — load FIRST) · [header-reference.md](references/header-reference.md) · [url-matching.md](references/url-matching.md) · [sandbox-modes.md](references/sandbox-modes.md) · [patterns.md](references/patterns.md)

**APIs:** [api-sync.md](references/api-sync.md) · [api-async.md](references/api-async.md) (preferred) · [api-storage.md](references/api-storage.md) · [http-requests.md](references/http-requests.md) · [web-requests.md](references/web-requests.md) · [api-cookies.md](references/api-cookies.md) · [api-dom-ui.md](references/api-dom-ui.md) · [api-tabs.md](references/api-tabs.md) · [api-audio.md](references/api-audio.md)

**Quality & tooling:** [common-pitfalls.md](references/common-pitfalls.md) · [debugging.md](references/debugging.md) · [browser-compatibility.md](references/browser-compatibility.md) · [security-checklist.md](references/security-checklist.md) · [version-numbering.md](references/version-numbering.md) · [typescript.md](references/typescript.md)
