---
name: userscripts-development
description: "Trigger: userscript, Violentmonkey, Tampermonkey, Greasemonkey, userscript manager, .user.js, @match, @grant, GM.* APIs. Write and debug userscripts for ANY manager: page modification, element hiding, auto-fill, scraping, SPA handling."
license: MIT
metadata:
  author: imatimba
  version: 2.5.0
---

# Userscript Development

> **This file is a router.** The binding rules live in its references. Acting on a step without reading that reference is acting without the skill.

## Activation Contract

Load when the user mentions userscripts or any userscript manager (Violentmonkey, Tampermonkey, Greasemonkey, ScriptCat, Safari "Userscripts" app), `.user.js` files, metadata headers (`@match`, `@grant`, `@run-at`), or GM APIs; when they want JS/CSS running in a page: modify pages, hide elements, auto-fill forms, scrape data, shortcuts, request interception, SPA navigation; or when they want an EXISTING userscript improved — debugged, fixed, extended, refactored, or ported between managers.

Do NOT use for external browser automation frameworks (Selenium/Puppeteer/Playwright), browser extensions (WebExtensions/MV3), or server-side scripts.

## Hard Rules

1. **Manager-neutral by default.** Label every manager-specific API/header with its owner (e.g. "Tampermonkey-only") and feature-detect it (`typeof GM.getValue === "function"`). Verify support against [managers.md](references/managers.md) before claiming it.
2. **Prefer `GM.*` promise APIs** — Greasemonkey 4+ ships ONLY those (sync `GM_*` removed; storage limited to strings/numbers/booleans).
3. **Never invent APIs, signatures, or version numbers.** Unverifiable claims stay marked UNVERIFIED.
4. **Scope tightly:** specific `@match` (never `*://*/*`), declared `@connect` per cross-origin host (enforced by TM only), HTTPS-only URLs, no embedded secrets, sanitise data before DOM insertion.
5. **Violentmonkey is the UI-workflow example** (FOSS, stable dashboard) for install/dashboard steps only — this implies nothing about API precedence. Other managers appear as labeled table rows; tier-2 divergences live in [manager-compat.md](references/manager-compat.md).
6. Preserve existing behaviour when editing a user's script; relabel rather than erase manager-specific knowledge.
7. **Live-profile testing hygiene:** never live-test a new version while an older installed version still matches the same `@match` — let the user install/update the new version, **reload the tab**, then run the pre-flight pollution probe ([testing.md](references/testing.md) — Live-Profile Interference). A `@grant none` script shares the page world with automation evals, so a stale or foreign active script silently pollutes every snapshot/eval measurement taken before detection.

## Core Digest

Start here. Open a full reference only when the Execution Steps trigger fires.

| Manager | API style | Divergence | Ref |
| --- | --- | --- | --- |
| Violentmonkey | `GM_*` sync + `GM.*` promise (VM 2.12.0+) | `@inject-into auto` default (tries page → content on CSP fall-back) | [managers.md](references/managers.md) §1–2 |
| Tampermonkey | `GM_*` sync + `GM.*` promise | Largest surface; `@connect` strictly enforced; Chrome MV3 (TM 5.2+) breaks `GM_webRequest` | [managers.md](references/managers.md) §1–2 |
| Greasemonkey 4+ (Firefox-only) | `GM.*` promise ONLY (sync removed 4.0; storage primitives only) | Always sandboxed (Xray); no `@sandbox`/`@inject-into` | [managers.md](references/managers.md) §2–4 |
| Safari "Userscripts" | `GM.*` promise SUBSET | Any `@grant` forces `content` world; no `unsafeWindow` | [managers.md](references/managers.md) §1–4 |

- `@run-at`: set explicitly — TM defaults `document-idle`, VM/GM4+/Safari default `document-end`; `document-body` invalid in GM4, `context-menu` TM-only — details in [header-reference.md](references/header-reference.md) + [managers.md](references/managers.md) §3.
- `@grant`/`@sandbox`/`@inject-into`: TM uses `@sandbox raw|JavaScript|DOM` (default `raw`); VM/Safari use `@inject-into page|content|auto` (VM default `auto`); GM4+ ignores both — see [sandbox-modes.md](references/sandbox-modes.md) + [managers.md](references/managers.md) §4.
- `@grant none` disables sandbox in TM and VM ≥2.32 (no `GM.*` except `GM_info`); no-grant = minimal sandbox in VM ≥2.32, enabled sandbox in TM — see [sandbox-modes.md](references/sandbox-modes.md).
- `unsafeWindow` needs `@grant unsafeWindow` in TM; available without grant in VM (<2.32) and minimal-sandbox in VM ≥2.32; absent in Safari — see [sandbox-modes.md](references/sandbox-modes.md).
- `@match` = Chrome match-pattern base everywhere (VM ≥2.10.4 adds `.tld`/extra wildcards); `@include` globs add `.tld` portably — see [url-matching.md](references/url-matching.md).
- Header templates (no-APIs `grant none` + promise `GM.*` starter) live at top of [header-reference.md](references/header-reference.md).
- If digest conflicts with observed behaviour, or task touches edge cases, open the owning reference ([managers.md](references/managers.md)/[url-matching.md](references/url-matching.md)/[sandbox-modes.md](references/sandbox-modes.md)/[header-reference.md](references/header-reference.md)) — see Execution Steps.

## Decision Gates

| Need | Portable default | Manager caveat |
| --- | --- | --- |
| Persistent settings | `await GM.getValue/setValue` | GM4+: primitives only; batch `GM.getValues/setValues`: TM 5.3+/VM 2.19.1+ |
| Cross-origin request | `GM.xmlHttpRequest` (+ legacy `GM_xmlhttpRequest`) | `@connect` enforced by TM only; `stream`/`cookie` TM-only; `anonymous` also VM since 2.10.1 |
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
| Target a tier-2 manager (ScriptCat/AdGuard/FireMonkey/mobile) | [manager-compat.md](references/manager-compat.md) |
| Write `@match`/`@include` or URL logic | [url-matching.md](references/url-matching.md) |
| Persist settings/storage | [api-storage.md](references/api-storage.md) |
| Make cross-origin requests | [http-requests.md](references/http-requests.md) + common-pitfalls.md Pitfall 2 |
| Insert data into the DOM | [api-dom-ui.md](references/api-dom-ui.md) + security-checklist.md §3 |
| Watch mutations/elements (Observer) | [patterns.md](references/patterns.md) (Mutation Observation) |
| Handle SPA navigation | [patterns.md](references/patterns.md) (SPA Navigation) + [api-tabs.md](references/api-tabs.md) (`onurlchange`) |
| Call ANY `GM.*`/`GM_*` API | its api-*.md / http-requests.md page — never write the call from memory |
| Debug a failing script | debugging.md + testing.md + full common-pitfalls.md scan |
| Live-test in a real profile (agent-driven) | [testing.md](references/testing.md) (Live-Profile Interference + Non-headless / Real-Profile Testing) |

## Execution Steps

Digest-first: start from Core Digest + Touch → Reference Routing. A full reference read is CONDITIONAL — open the file only when (a) observed behaviour conflicts with the digest, (b) the task touches edge cases (tier-2 manager, Firefox MV3/USER_SCRIPT world, cross-origin/`@connect`, CSP/injection world), or (c) you need depth beyond the digest.

1. **Scope**: consult digest for `@match`/`@exclude` + `@run-at` defaults; open [url-matching.md](references/url-matching.md) only on trigger; set `@run-at` explicitly.
2. **Permissions**: consult digest for `@grant`/`@sandbox`/`@inject-into` choice; open [sandbox-modes.md](references/sandbox-modes.md) only on trigger (add full read when injection world or `unsafeWindow`/CSP matters).
3. **Headers**: copy starter template at top of [header-reference.md](references/header-reference.md) (digest pointer); open rest of that file only on trigger (e.g. new directive, SRI, `@webRequest`).
4. **Implement**: use [patterns.md](references/patterns.md) via Touch → Reference Routing only for areas you touch; open section-scoped, not cover-to-cover; guard manager-specific calls with feature detection.
5. **Verify**: run Pre-Delivery Gates; read [security-checklist.md](references/security-checklist.md) section-scoped against the FINAL code (full read only on trigger — e.g. DOM insertion, cross-origin, storage).
6. **Deliver** per Output Contract. TypeScript/bundler work: [typescript.md](references/typescript.md) only if touched.

## Output Contract

Every delivered userscript includes:

1. 1–2 sentence explanation.
2. Install steps naming the TARGET manager; if the user never specified one, ask which manager they use instead of assuming.
3. Safe customisation points (selectors, timeouts, domains).
4. Every `@grant` with one-line justification.
5. Explicit per-manager notes for anything not portable.

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

Core: [managers.md](references/managers.md) · [manager-compat.md](references/manager-compat.md) · [header-reference.md](references/header-reference.md) · [url-matching.md](references/url-matching.md) · [sandbox-modes.md](references/sandbox-modes.md) · [patterns.md](references/patterns.md)

APIs: [api-sync.md](references/api-sync.md) · [api-async.md](references/api-async.md) (preferred) · [api-storage.md](references/api-storage.md) · [http-requests.md](references/http-requests.md) · [web-requests.md](references/web-requests.md) · [api-cookies.md](references/api-cookies.md) · [api-dom-ui.md](references/api-dom-ui.md) · [api-tabs.md](references/api-tabs.md) · [api-audio.md](references/api-audio.md)

Quality & tooling: [common-pitfalls.md](references/common-pitfalls.md) · [publishing.md](references/publishing.md) · [debugging.md](references/debugging.md) · [testing.md](references/testing.md) · [browser-compatibility.md](references/browser-compatibility.md) · [security-checklist.md](references/security-checklist.md) · [version-numbering.md](references/version-numbering.md) · [typescript.md](references/typescript.md)
