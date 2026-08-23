---
name: userscripts-development
description: "Trigger: userscript, Violentmonkey, Tampermonkey, Greasemonkey, userscript manager, .user.js, @match, @grant, GM.* APIs. Write and debug userscripts for ANY manager: page modification, element hiding, auto-fill, scraping, SPA handling."
license: MIT
metadata:
  author: imatimba
  version: 2.1.0
---

# Userscript Development

> **This file is a router.** The binding rules live in its references. Acting on a step without reading that reference is acting without the skill.

## Activation Contract

Load when the user mentions userscripts or any userscript manager (Violentmonkey, Tampermonkey, Greasemonkey, ScriptCat, Safari "Userscripts" app), `.user.js` files, metadata headers (`@match`, `@grant`, `@run-at`), or GM APIs; when they want JS/CSS running in a page: modify pages, hide elements, auto-fill forms, scrape data, shortcuts, request interception, SPA navigation; or when they want an EXISTING userscript improved — debugged, fixed, extended, refactored, or ported between managers.

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

### Touch → Reference Routing

Before writing code in an area, READ its reference first — no exceptions:

| Touch | Read first |
| --- | --- |
| Claim manager support | [managers.md](references/managers.md) §2 API Support Matrix |
| Write `@match`/`@include` or URL logic | [url-matching.md](references/url-matching.md) |
| Persist settings/storage | [api-storage.md](references/api-storage.md) |
| Make cross-origin requests | [http-requests.md](references/http-requests.md) + common-pitfalls.md Pitfall 2 |
| Insert data into the DOM | [api-dom-ui.md](references/api-dom-ui.md) + security-checklist.md §3 |
| Watch mutations/elements (Observer) | [patterns.md](references/patterns.md) (Mutation Observation) + common-pitfalls.md Pitfalls 7–8 |
| Handle SPA navigation | patterns.md (SPA Navigation) + api-tabs.md (`onurlchange`) |
| Call ANY `GM.*`/`GM_*` API | its api-*.md / http-requests.md page — never write the call from memory |
| Debug a failing script | debugging.md + full common-pitfalls.md scan |

## Execution Steps

1. **Read FIRST**: load [managers.md](references/managers.md) before any other step — every later step assumes it.
2. **Scope**: Read [url-matching.md](references/url-matching.md) before deriving `@match`/`@exclude`; set `@run-at` explicitly.
3. **Permissions**: Read [sandbox-modes.md](references/sandbox-modes.md) before choosing `@grant` or injection directives (VM `@inject-into`, TM `@sandbox`).
4. **Headers**: Read [header-reference.md](references/header-reference.md) (starter templates at top) before writing any header.
5. **Implement**: Read [patterns.md](references/patterns.md) before writing script logic; apply the Touch → Reference Routing table for every area touched; guard manager-specific calls with feature detection.
6. **Verify**: run Pre-Delivery Gates; read [security-checklist.md](references/security-checklist.md) against the final code. TypeScript/bundler work: [typescript.md](references/typescript.md).
7. **Deliver** per Output Contract.

## Output Contract

Every delivered userscript includes:

1. 1–2 sentence explanation.
2. Complete script with ALL headers in one code block.
3. Install steps naming the target manager (default Violentmonkey: Dashboard → ➕ → paste, or drag/serve the `.user.js`).
4. Safe customisation points (selectors, timeouts, domains).
5. Every `@grant` with one-line justification.
6. Explicit per-manager notes for anything not portable.

## Pre-Delivery Gates

All MUST pass before returning code.

**Process gates** — prove the reads happened:

- [ ] [common-pitfalls.md](references/common-pitfalls.md) sections covering every API/pattern touched were read THIS task.
- [ ] security-checklist.md was checked against the FINAL code, not from memory.

**Artifact gates:**

- [ ] Scoped `@match`; HTTPS resources; no secrets; DOM input sanitised.
- [ ] Every manager-specific API labeled AND `typeof`-guarded.
- [ ] Async `GM.*` preferred; sync fallback documented.
- [ ] Only declared-grant APIs called; version string present (`X.Y.Z`).

## References

Core: [managers.md](references/managers.md) · [header-reference.md](references/header-reference.md) · [url-matching.md](references/url-matching.md) · [sandbox-modes.md](references/sandbox-modes.md) · [patterns.md](references/patterns.md)

APIs: [api-sync.md](references/api-sync.md) · [api-async.md](references/api-async.md) (preferred) · [api-storage.md](references/api-storage.md) · [http-requests.md](references/http-requests.md) · [web-requests.md](references/web-requests.md) · [api-cookies.md](references/api-cookies.md) · [api-dom-ui.md](references/api-dom-ui.md) · [api-tabs.md](references/api-tabs.md) · [api-audio.md](references/api-audio.md)

Quality & tooling: [common-pitfalls.md](references/common-pitfalls.md) · [debugging.md](references/debugging.md) · [browser-compatibility.md](references/browser-compatibility.md) · [security-checklist.md](references/security-checklist.md) · [version-numbering.md](references/version-numbering.md) · [typescript.md](references/typescript.md)
