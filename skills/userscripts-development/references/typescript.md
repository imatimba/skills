# TypeScript Userscript Development

Writing userscripts in TypeScript with full type safety. The `@types/tampermonkey` npm package is the de-facto typings source for the standard `GM_*` / `GM.*` APIs and exports the global namespace `Tampermonkey`. Typings ≠ execution target — they type-check against a manager-agnostic `.user.js` artifact you load in any manager (Violentmonkey worked example below). See `managers.md` for per-manager runtime support.

---

## Setup

### Install Type Definitions

```bash
# @types/tampermonkey — npm package name; provides the `Tampermonkey` global namespace
# De-facto typings for GM_* AND GM.* across managers
npm install --save-dev @types/tampermonkey
# or
pnpm add -D @types/tampermonkey
```

Current at time of writing: 5.0.5 — verify with `npm view @types/tampermonkey version`. Published 2025-10-17, actively maintained on DefinitelyTyped (latest verified 5.5.0 as of 2026-08-20).

**Supplemental / alternative typings:**

| Package | npm name | Version / status | Notes |
|---------|----------|------------------|-------|
| Violentmonkey types | `@violentmonkey/types` | 0.3.x (0.3.4 latest) | Complementary; README notes "should be almost same as Tampermonkey, so @types/tampermonkey should also work" |
| Greasemonkey types | `@types/greasemonkey` | 4.0.7 (2023) | Exists but stale — no recent updates |
| Hand-rolled | ambient `*.d.ts` | — | Viable for libraries or custom APIs — declare `declare namespace Tampermonkey { ... }` / global `GM_*` as needed |

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "strict": true,
    "types": ["tampermonkey"],  // npm package: @types/tampermonkey
    "outDir": "./dist"
  },
  "include": ["src/**/*.ts"]
}
```

---

## Bundler Setup

Any standards-compliant userscript manager requires a single `.user.js` file. Use a bundler to compile TypeScript into one output. The output `.user.js` is manager-agnostic — load the same artifact in Violentmonkey/Tampermonkey/Greasemonkey.

### esbuild (recommended — fastest)

```bash
pnpm add -D esbuild
```

```json
// package.json
{
  "scripts": {
    "build": "esbuild src/index.ts --bundle --outfile=dist/script.user.js --platform=browser",
    "watch": "esbuild src/index.ts --bundle --outfile=dist/script.user.js --platform=browser --watch"
  }
}
```

Output `.user.js` is manager-agnostic — load the same artifact in Violentmonkey/Tampermonkey/Greasemonkey. Violentmonkey worked example: build, then drag `dist/script.user.js` into the Violentmonkey dashboard or serve via `npx http-server` and install from `http://localhost:8080/dist/script.user.js` with Track external edits enabled.

For the metadata block with esbuild, prepend a banner file containing `// ==UserScript==` … `// ==/UserScript==` or use an `esbuild --banner` / small prepend script — header generation is not built-in.

### Vite with vite-plugin-monkey

`vite-plugin-monkey` (maintainer lisonge) is manager-neutral: supports TM, Violentmonkey, Greasemonkey, and ScriptCat; emits a standard `.user.js` with auto-grants derived from the `userscript` config.

```bash
pnpm add -D vite vite-plugin-monkey
```

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: 'My Script',
        namespace: 'https://example.com/',
        match: ['https://example.com/*'],
        grant: ['GM.getValue', 'GM.setValue'],
      },
    }),
  ],
});
```

Output `.user.js` is manager-agnostic — load the same artifact in Violentmonkey/Tampermonkey/Greasemonkey. Violentmonkey worked example: run `pnpm dev`/`vite`, install the dev-server URL, or drag the built `dist/script.user.js` into the dashboard.

### Tooling Decision Table

| Need | Tool | Notes |
|------|------|-------|
| Fast single-file build | esbuild (+ banner/meta prepend) | Fastest; you manage the `==UserScript==` header via banner file or prepend step; output `.user.js` is manager-agnostic |
| Auto-header + dev server | vite-plugin-monkey (lisonge) | Manager-neutral (TM/VM/GM/ScriptCat); auto-generates grants and header; dev server with HMR |
| Webpack | webpack-monkey (guanss, early-stage 0.2.1) | Early-stage; manager-neutral output; alternative `webpack-tampermonkey` (npm package `webpack-tampermonkey` 2.0.0, 2019) exists and emits a standard `.user.js` — output is manager-agnostic if you use it — but is older/unmaintained; esbuild-banner pattern is the fallback if neither fits |

---

## Writing TypeScript Userscripts

### Full Template

```typescript
// ==UserScript==
// @name         My TypeScript Script
// @namespace    https://example.com/scripts/
// @version      1.0.0
// @description  Brief description
// @author       Your Name
// @match        https://example.com/*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.xmlHttpRequest
// @connect      api.example.com
// @run-at       document-idle
// ==/UserScript==

(async () => {
    'use strict';

    // GM_info is always available, no @grant needed
    // `Tampermonkey.ScriptInfo` is the type from @types/tampermonkey's `Tampermonkey` global namespace
    const info: Tampermonkey.ScriptInfo = GM_info;
    console.log('Script version:', info.script.version);

    // Type-safe storage
    const theme = await GM.getValue<string>('theme', 'dark');
    await GM.setValue('lastRun', Date.now());

    // Type-safe HTTP request
    const response = await GM.xmlHttpRequest({
        method: 'GET',
        url: 'https://api.example.com/data',
    });
    const data: ApiResponse = JSON.parse(response.responseText);
})();

interface ApiResponse {
    items: string[];
    total: number;
}
```

### Key Type Definitions

```typescript
// Script info
// `Tampermonkey.*` are the TypeScript types exported by the @types/tampermonkey package
GM_info: Tampermonkey.ScriptInfo
GM_info.script: Tampermonkey.ScriptMetadata
GM_info.scriptMetaStr: string | null
GM_info.sandboxMode: 'raw' | 'js' | 'dom'

// Storage
GM.getValue<T>(key: string, defaultValue: T): Promise<T>
GM.setValue(key: string, value: any): Promise<void> // not generic; sync GM_setValue uses Tampermonkey.StorageValue
// Batch storage — in @types/tampermonkey typed only as sync globals (not GM.*):
// GM_getValues<T extends Record<string, unknown>>(defaults: T): T
// GM_setValues(values: Record<string, unknown>): void
// GM_deleteValues(...names: string[]): void
// Runtime also exposes promise forms GM.getValues/GM.setValues (TM 5.3+/VM 2.19.1+), untyped in DT

// HTTP request — returns PromiseWithAbort (Promise & { abort(): void }), generic TContext
GM.xmlHttpRequest<TContext>(details: Tampermonkey.Request<TContext>): Tampermonkey.PromiseWithAbort<Tampermonkey.Response<TContext>>

// Notification — two overloads, optional ondone callback
GM.notification(text: string, title?: string, image?: string, ondone?: () => void): Promise<void>
GM.notification(details: Tampermonkey.NotificationDetails, ondone?: () => void): Promise<void>
```

---

## Handling the Userscript Header in TypeScript

The `// ==UserScript==` block must appear in the final compiled output. Do NOT rely on bundlers preserving a leading `// ==UserScript==` comment — esbuild and Vite do not guarantee this through bundling. Instead use `esbuild --banner:js` (or a prepend/banner file) or `vite-plugin-monkey` header injection to emit the block.

Alternatively, use `vite-plugin-monkey` (lisonge, manager-neutral, supports TM/VM/GM/ScriptCat; emits standard `.user.js` with auto-grants) or `webpack-tampermonkey` (npm package `webpack-tampermonkey` — factual package name, manager-neutral output: standard `.user.js` loadable in any manager) which inject the header automatically from configuration. For webpack, `webpack-monkey` (guanss, early-stage) is the actively referenced alternative; if neither fits, use the esbuild banner/meta-prepend pattern.

Output `.user.js` from any of these tools is manager-agnostic — verify in Violentmonkey by loading the built artifact.

---

## Common TypeScript Patterns

### Type-Safe Settings Object

```typescript
interface Settings {
    theme: 'light' | 'dark';
    fontSize: number;
    enabled: boolean;
}

const defaultSettings: Settings = {
    theme: 'dark',
    fontSize: 14,
    enabled: true,
};

// Load all settings at once — batch runtime: TM 5.3+/VM 2.19.1+; typed in DT as GM_getValues sync global (see Key Type Definitions)
// Runtime promise form (untyped in DT): await (GM as any).getValues(defaultSettings)
// Typed sync form: GM_getValues<Settings>(defaultSettings)
const settings = GM_getValues<Settings>(defaultSettings);
```

### Type-Safe Cross-Origin Fetch

```typescript
async function fetchJson<T>(url: string): Promise<T> {
    const response = await GM.xmlHttpRequest({
        method: 'GET',
        url,
        responseType: 'json',
    });
    return response.response as T;
}

interface User {
    id: number;
    name: string;
}

const user = await fetchJson<User>('https://api.example.com/user/1');
console.log(user.name);
```

### DOM Utilities with Types

```typescript
function waitForElement<T extends Element>(selector: string, timeout = 10000): Promise<T> {
    return new Promise((resolve, reject) => {
        const el = document.querySelector<T>(selector);
        if (el) return resolve(el);

        const observer = new MutationObserver((_, obs) => {
            const found = document.querySelector<T>(selector);
            if (found) {
                obs.disconnect();
                resolve(found);
            }
        });

        observer.observe(document.documentElement, { childList: true, subtree: true });
        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timeout: ${selector}`));
        }, timeout);
    });
}

// Usage with type inference
const button = await waitForElement<HTMLButtonElement>('#submit-btn');
button.click();
```

---

## Notes

- The `@types/tampermonkey` npm package covers both GM_* and GM.* APIs (the `Tampermonkey` global namespace is exported globally) — typings are de-facto for standard APIs across managers, not an execution-target lock
- `GM_info` is typed as `Tampermonkey.ScriptInfo` and available without `@grant` in all managers
- For `unsafeWindow`, cast carefully: `(unsafeWindow as Window & { myLib: MyLib }).myLib` — guard with `typeof unsafeWindow !== 'undefined'` (absent in Safari Userscripts regardless of grants; see `managers.md`)
- When using `@grant none`, the sandbox is disabled and `GM_*`/`GM.*` functions are unavailable — TypeScript won't catch this at compile time; any `@grant` vs `@grant none` semantics differ per manager (see `managers.md` and `common-pitfalls.md`)
- `@connect` and network APIs are manager-enforced differently (TM strict, VM not enforced, GM ignores); declare domains for TM compatibility
- Output `.user.js` is manager-agnostic — build once, load in Violentmonkey/Tampermonkey/Greasemonkey/Safari Userscripts (within each manager's supported API subset)
