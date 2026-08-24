# Testing Userscripts

No manager vendor publishes an official testing guide. The pattern below is community practice, not vendor doctrine.

Managers run scripts inside isolated worlds with GM APIs — unit tests should bypass the manager and exercise your logic as plain JS. Keep side-effects behind small seams you can mock.

## Unit Setup

Use Vitest with the `happy-dom` environment — both officially support the integration (vitest.dev/guide/environment and happy-dom wiki "Setup as Test Environment").

```js
// vitest.config.js — ≤10 lines
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'happy-dom', // or 'jsdom'
    globals: true
  }
});
```

Install: `vitest` + `happy-dom` as dev deps; run with `vitest run`.

### happy-dom vs jsdom trade-offs (verified 2026-08-24)

`vitest.dev/guide/environment` notes `happy-dom` is faster but lacks some APIs — prefer `jsdom` when you need fuller DOM fidelity. For timers, happy-dom wiki "Setup as Test Environment" (verified 2026-08-24) documents that `happyDOM.waitUntilComplete()` and timer methods need rebinding via `PropertySymbol` workaround — see wiki snippet. The wiki notes "Hopefully this can be fixed soon" — treat the workaround as version-sensitive.

### Jest alternative (verified 2026-08-24)

happy-dom provides `@happy-dom/jest-environment` (`github.com/capricorn86/happy-dom/wiki/Setup-as-Test-Environment`). Set `testEnvironment: '@happy-dom/jest-environment'` in Jest config; same trade-offs above apply. Vitest is the worked example here, not the only runner.

### Coverage and CI (verified 2026-08-24)

Vitest coverage via `v8` (default) or `istanbul` (`vitest.dev/guide/coverage`): install `@vitest/coverage-v8` and set `test.coverage: { enabled: true, provider: 'v8' }`. Run `vitest run --coverage` in CI and `vitest` (watch) locally — `vitest run` disables watch (`vitest.dev/guide/cli`). Prefer `--run` in CI and lint-staged hooks; configure `coverage.thresholds` and `coverage.include` to enforce thresholds.

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

### Mock scope and maintenance (as of mock-violentmonkey 8.2.1, archived 2026-06-27, verified 2026-08-24)

`mock-violentmonkey` is Violentmonkey-only and archived/maintenance-mode — owner states "stopped active development … consider the library complete … will provide updates for dependencies and bugs" (`github.com/melusc/mock-violentmonkey`). Tampermonkey-only APIs (`GM_getTab` family, `GM_cookie`) and some mock limitations are out of scope: `GM_getResourceURL` returns an object URL not fetchable in Node (use `GM_getResourceText`), `GM_setClipboard` doesn't set real clipboard, `GM_download`/`GM_xmlhttpRequest` require `setBaseUrl` (see README support table).

### Async vs sync pitfall (verified 2026-08-24)

Violentmonkey `GM.*` (`GM.getValue`) returns `Promise` (added in VM2.12.0, `violentmonkey.github.io/api/gm`); legacy `GM_*` was historically sync. The mock's `GM` wrappers are async — always `await` and feature-detect both shapes.

### Isolation helpers (verified 2026-08-24)

Use `violentMonkeyContext(t => { ... })` for per-test storage isolation and `tabContext(() => { ... })` for cross-tab `remote` flag on value listeners (`github.com/melusc/mock-violentmonkey` README). For location-sensitive code call `setBaseUrl(url)` before `GM_xmlhttpRequest`/`GM_download`/`getWindow`; for `@resource` use `await setResource(name, url)`.

## What NOT to test

Do not unit-test manager-owned behaviour — it requires a real manager:

- Install / update flow (`@updateURL`, `@downloadURL`, `.user.js` MIME handling)
- Real CSP interaction or injection-world fallback (`@inject-into`, `@sandbox`)
- `GM_download`, `GM_notification`, `GM_openInTab` / `GM_getTab`/`GM_saveTab`/`GM_getTabs` side-effects beyond their mock contracts (`GM_openInTab` is Violentmonkey-supported; tab-storage family is Tampermonkey-only, declined in Violentmonkey #1120)
- Cross-origin `GM.xmlHttpRequest` enforcement (`@connect` prompts in Tampermonkey)

- Sandbox isolation (`@grant none` disables sandbox; otherwise `unsafeWindow` is a wrapper; Firefox `wrappedJSObject`/`cloneInto`/`exportFunction`) — manager-owned, smoke-test only (`violentmonkey.github.io/api/gm` and `/posts/inject-into-context/`, verified 2026-08-24)

For those, do a manual smoke run in the target manager (Violentmonkey as worked example: load the built `.user.js` via dashboard or `http://localhost:8080/script.user.js` with Track external edits).

## End-to-End: Manager Extension in Browser Automation

Requires a real browser with the manager extension installed — not happy-dom (verified 2026-08-24).

- Playwright (`playwright.dev/docs/chrome-extensions`): extensions only in Chromium with a persistent context — `chromium.launchPersistentContext(userDataDir, { channel: 'chromium', args: ['--disable-extensions-except=<path>', '--load-extension=<path>'] })`. `channel: 'chromium'` allows headless; otherwise use `headless: false` safe default. Get MV3 service worker via `context.serviceWorkers()` or `context.waitForEvent('serviceworker')`.
- Puppeteer (`pptr.dev/guides/chrome-extensions`): `puppeteer.launch({ enableExtensions: [path] })` or runtime `browser.installExtension(path)` with `enableExtensions: true`.
- Headless/CI (as of Chrome 112+, verified 2026-08-24): use `--headless=new` (`developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing`) — old headless does not support extensions. On Linux CI use `xvfb-run` when headed is required.
- MV3 service-worker suspension (verified 2026-08-24): Chrome suspends MV3 workers after ~30s idle; Playwright keeps the same `Worker` object alive — `await sw.evaluate(...)` resumes automatically, in-flight evaluates throw "Service worker restarted".

## See Also

- url-matching.md — testable `@match` logic
- typescript.md — `happy-dom` + bundler setup
- debugging.md — manager-side smoke checklist
