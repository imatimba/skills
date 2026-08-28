# Testing Userscripts

No manager vendor publishes an official testing guide. The pattern below is community practice, not vendor doctrine.

Managers run scripts inside isolated worlds with GM APIs — unit tests should bypass the manager and exercise your logic as plain JS. Keep side-effects behind small seams you can mock.

## Headless End-to-End: Manager Extension in Browser Automation

Requires a real browser with the manager extension installed — not happy-dom (verified 2026-08-25 — playwright.dev/docs/chrome-extensions, pptr.dev/guides/chrome-extensions).

- Playwright (`playwright.dev/docs/chrome-extensions`) (verified 2026-08-25 — playwright.dev/docs/chrome-extensions): extensions only in Chromium with a persistent context — `chromium.launchPersistentContext(userDataDir, { channel: 'chromium', args: ['--disable-extensions-except=<path>', '--load-extension=<path>'] })`. `channel: 'chromium'` allows headless; otherwise use `headless: false` safe default. Get MV3 service worker via `context.serviceWorkers()` or `context.waitForEvent('serviceworker')`.
- Puppeteer (`pptr.dev/guides/chrome-extensions`) (verified 2026-08-25 — pptr.dev/guides/chrome-extensions): `puppeteer.launch({ enableExtensions: [path] })` or runtime `browser.installExtension(path)` with `enableExtensions: true`.
- Headless/CI (as of Chrome 112+, verified 2026-08-25 — developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing): use `--headless=new` (`developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing`) — old headless does not support extensions. On Linux CI use `xvfb-run` when headed is required.
- MV3 service-worker suspension (verified 2026-08-25 — playwright.dev/docs/chrome-extensions, developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing): Chrome suspends MV3 workers after ~30s idle; Playwright keeps the same `Worker` object alive — `await sw.evaluate(...)` resumes automatically, in-flight evaluates throw "Service worker restarted".

## Non-headless / Real-Profile Testing — Manual Testing in Your Actual Browser Profile

What it is: a **visible browser** using your actual persistent profile — `user-data-dir` (Chrome/Edge) or Firefox profile — retaining cookies, storage, permissions, and installed extensions/manager state. Unlike headless/synthetic profiles that start clean, real-profile surfaces stateful flakes.

Why it matters for **portable userscripts**: CSP headers, storage (`GM_getValue`/`GM_setValue` vs `GM.*` promises), `@connect` prompts, and manager UI behave differently with real state; headless may hide flakes. Verify degradation on TM/VM/GM4+/Safari with real profile.

How to:

Agent bridge (AI-driven): to let an AI agent drive that visible real-profile browser (instead of manual clicks), you need a harness/MCP bridge — an extension or MCP server that exposes your browser's tabs to the agent via CDP/MCP (Chrome DevTools Protocol / Model Context Protocol). The user should launch Chrome with `--remote-debugging-port=9222` or install a harness extension; any bridge that keeps your `user-data-dir`/profile intact satisfies the real-profile requirement. Examples (as of 2026, not exhaustive — verify against each harness's docs):
- <https://github.com/ChromeDevTools/chrome-devtools-mcp> — official Chrome team
- <https://github.com/hangwin/mcp-chrome> — community Chrome MCP
- <https://github.com/fitchmultz/pi-agent-browser-native> — Pi-ecosystem native bridge
- <https://github.com/narumiruna/pi-extensions/tree/main/packages/pi-chrome-devtools> — Pi Chrome DevTools variant
- <https://github.com/ryenwang/pire-browser> — Pi browser harness for Firefox, one of the few that works with Firefox
Any harness that launches Chrome with your `user-data-dir` and exposes the debugging/MCP channel works — the mechanism, not the name, is the portability requirement.

When to prefer which: **headless** for CI/automation (fast, reproducible); **real profile** for manual verification of CSP/storage/permission and logged in websites. If real profile diverges, see [debugging.md](debugging.md) for troubleshooting.

## Live-Profile Interference (agent-driven testing in the real profile)

When an agent drives the real-profile browser (snapshot/eval/click harness), the tested page may already host an **active userscript instance** — a stale installed version or an unrelated script. With `@grant none` the script runs in the page world: the same world the automation harness evals into. Every observer callback, auto-click, or AJAX-triggered DOM mutation races the harness's measurements, silently polluting any snapshot/eval taken before detection (e.g. element counts drifting between reads, nodes vanishing mid-scan).

**Version-collision rule:** never live-test a new version while an older installed version still matches the same `@match`. Let the user install the new version and **reload the tab** first — a running page keeps the old instance (its observers, its queued callbacks) until re-injection at page load; saving the file or updating the manager entry is not enough.

**Dev-update loop (Violentmonkey worked example):** install from a `file://` URL with **Track external edits** enabled — VM re-reads the file when the editor saves (verified 2026-08-25 — violentmonkey.github.io; community practice). The page still needs a reload to re-inject the updated source.

**Pre-flight pollution probe** — run BEFORE the first snapshot/eval batch on any page that may have matching scripts installed:

1. Version probe: eval `typeof GM_info !== "undefined" && GM_info.script` in the page world. `GM_info` stays available under `@grant none` in TM and VM ≥2.32 (see [managers.md](managers.md) §2) — it yields the active script's name and version. Assert exactly one active instance whose version equals the `@version` in the file being tested; any mismatch means a stale install — fix it (install + reload) before measuring.
2. Marker probe: check script-identifying DOM side-effects — `data-*` attributes the script sets, injected `<style>`/`<link>` tags, `window.__SCRIPT_*` globals. Use these when the script is third-party or predates your edit.
3. If a foreign or stale instance is detected, all prior and pending measurements for that page are polluted — discard them; they are not evidence.

## Unit Setup

Use Vitest with the `happy-dom` environment — both officially support the integration (vitest.dev/guide/environment and happy-dom wiki "Setup as Test Environment") (verified 2026-08-25 — vitest.dev/guide/environment, github.com/capricorn86/happy-dom/wiki/Setup-as-Test-Environment).

Install `vitest` + `happy-dom` as dev deps; run `vitest run` with `environment: 'happy-dom'` (≤10 lines) — see [Vitest environment docs](https://vitest.dev/guide/environment) and [happy-dom wiki](https://github.com/capricorn86/happy-dom/wiki/Setup-as-Test-Environment) for options.

> Generic runner/coverage details (`happy-dom` vs `jsdom` trade-offs, Jest `@happy-dom/jest-environment`, Vitest coverage `v8`/`istanbul`/`--coverage` thresholds) are general testing docs — see Vitest/happy-dom docs; they don't change portable userscript code or manager degradation.

## Mocking GM APIs

Use `mock-violentmonkey` (github.com/melusc/mock-violentmonkey) for isolated `GM_*` / `GM.*` mocks — no manager needed.

```js
import { vi } from 'vitest';
import { GM } from 'mock-violentmonkey'; // or mock GM_* globals

test('persists setting', async () => {
  await GM.setValue('theme', 'dark');
  expect(await GM.getValue('theme')).toBe('dark');
});
```

- Keep DOM-dependent logic behind small seams (e.g. `renderPanel(root)` takes a container) so tests can pass a `happy-dom` document.
- Feature-detect manager APIs in code (`typeof GM?.getValue === 'function'`) — mocks should mirror that shape.
- Test `@match` / URL logic as pure functions — pairs with url-matching.md (pass a URL string, return a boolean).

### Mock scope and maintenance (as of mock-violentmonkey 8.2.1, archived 2026-06-27, verified 2026-08-25 — github.com/melusc/mock-violentmonkey, registry.npmjs.org/package/mock-violentmonkey)

`mock-violentmonkey` is Violentmonkey-only and archived/maintenance-mode — owner states "stopped active development … consider the library complete … will provide updates for dependencies and bugs" (`github.com/melusc/mock-violentmonkey`). TM-only APIs and mock limitations are out of scope — see README support table.

### Async vs sync pitfall (verified 2026-08-25 — violentmonkey.github.io/api/gm)

Violentmonkey `GM.*` (`GM.getValue`) returns `Promise` (added in VM2.12.0, `violentmonkey.github.io/api/gm`); legacy `GM_*` was historically sync. The mock's `GM` wrappers are async — always `await` and feature-detect both shapes.

## What NOT to test

Do not unit-test manager-owned behaviour — it requires a real manager:

- Install / update flow (`@updateURL`, `@downloadURL`, `.user.js` MIME handling)
- Real CSP interaction or injection-world fallback (`@inject-into`, `@sandbox`)
- `GM_download`, `GM_notification`, `GM_openInTab` / `GM_getTab`/`GM_saveTab`/`GM_getTabs` side-effects beyond their mock contracts (`GM_openInTab` is Violentmonkey-supported; tab-storage family is Tampermonkey-only, declined in Violentmonkey #1120)
- Cross-origin `GM.xmlHttpRequest` enforcement (`@connect` prompts in Tampermonkey)

- Sandbox isolation (`@grant none` disables sandbox; otherwise `unsafeWindow` is a wrapper; Firefox `wrappedJSObject`/`cloneInto`/`exportFunction`) — manager-owned, smoke-test only — see [managers.md](managers.md) §4 for authoritative matrix (verified 2026-08-25 — violentmonkey.github.io/api/gm, violentmonkey.github.io/posts/inject-into-context/)

For those, do a manual smoke run in the target manager (Violentmonkey as worked example: load the built `.user.js` via dashboard or `http://localhost:8080/script.user.js` with Track external edits) (verified 2026-08-25 — violentmonkey.github.io, community practice; no vendor testing guide found).

## See Also

- url-matching.md — testable `@match` logic
- typescript.md — `happy-dom` + bundler setup
- debugging.md — manager-side smoke checklist
