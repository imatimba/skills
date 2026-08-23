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

## What NOT to test

Do not unit-test manager-owned behaviour — it requires a real manager:

- Install / update flow (`@updateURL`, `@downloadURL`, `.user.js` MIME handling)
- Real CSP interaction or injection-world fallback (`@inject-into`, `@sandbox`)
- `GM_download`, `GM_notification`, `GM_tabs` side-effects beyond their mock contracts
- Cross-origin `GM.xmlHttpRequest` enforcement (`@connect` prompts in Tampermonkey)

For those, do a manual smoke run in the target manager (Violentmonkey as worked example: load the built `.user.js` via dashboard or `http://localhost:8080/script.user.js` with Track external edits).

## See Also

- url-matching.md — testable `@match` logic
- typescript.md — `happy-dom` + bundler setup
- debugging.md — manager-side smoke checklist
