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

Current at time of writing: 5.5.0 — verify with `npm view @types/tampermonkey version` (verified 2026-08-25 — https://registry.npmjs.org/@types/tampermonkey). Published 2025-10-17 for 5.0.5 and 2026-08-20 for 5.5.0 latest, actively maintained on DefinitelyTyped.

**Supplemental / alternative typings:**

| Package | npm name | Version / status | Notes |
|---------|----------|------------------|-------|
| Violentmonkey types | `@violentmonkey/types` | 0.3.x (0.3.4 latest, verified 2026-08-25 — https://registry.npmjs.org/@violentmonkey/types) | Complementary; README notes "should be almost same as Tampermonkey, so @types/tampermonkey should also work" |
| Greasemonkey types | `@types/greasemonkey` | 4.0.7 (2023-11-07, verified 2026-08-25 — https://registry.npmjs.org/@types/greasemonkey) | Exists but stale — no recent updates |
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

**`module` / `moduleResolution` for bundlers (verified 2026-08-25 — https://www.typescriptlang.org/tsconfig/module, https://www.typescriptlang.org/tsconfig/moduleResolution):** Bundler mode details → TS handbook (`module: ESNext`/`Preserve`, `moduleResolution: bundler`/`node`, plus `isolatedModules`/`esModuleInterop`/`allowSyntheticDefaultImports` as needed; `target` controls downleveling — `ES2022` enables top-level `await`). See https://www.typescriptlang.org/tsconfig/module, https://www.typescriptlang.org/tsconfig/moduleResolution, https://www.typescriptlang.org/tsconfig/isolatedModules, https://www.typescriptlang.org/tsconfig/esModuleInterop, https://www.typescriptlang.org/tsconfig/target.

**`types` array suppresses auto-inclusion (verified 2026-08-25 — https://www.typescriptlang.org/tsconfig/types):** `"types": ["tampermonkey"]` limits globals to that package — other `node_modules/@types/*` are excluded. Add `"node"` explicitly if tooling needs it: `"types": ["tampermonkey", "node"]`. See https://www.typescriptlang.org/tsconfig/types.

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

Output `.user.js` is manager-agnostic — load the same artifact in Violentmonkey/Tampermonkey/Greasemonkey. See `managers.md` for install workflows.

For the metadata block with esbuild, prepend a banner file containing `// ==UserScript==` … `// ==/UserScript==` or use `esbuild --banner` / small prepend script — header generation is not built-in.

**Output format for userscripts (verified 2026-08-25 — https://esbuild.github.io/api/#platform, https://esbuild.github.io/api/#format):**
When `bundle: true`, esbuild defaults to `iife` for `--platform=browser` and to `esm` for `--platform=neutral` (see https://esbuild.github.io/api/ — default output format). Userscript managers execute the `.user.js` in a sandbox wrapper and expect a single-file global script — use `format: iife` and `splitting: false`. `@require`'d external bundles must also be IIFE/UMD, not ESM with `export`; Vite library-mode ESM output will break `@require`. Disable code splitting (`splitting: false` / single `outfile`) to keep one artifact.

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

Output `.user.js` is manager-agnostic — load the same artifact in Violentmonkey/Tampermonkey/Greasemonkey. See `managers.md` for install workflows.

**Typed userscript header (verified 2026-08-25 — https://registry.npmjs.org/vite-plugin-monkey, https://raw.githubusercontent.com/lisonge/vite-plugin-monkey/main/README.md):** `vite-plugin-monkey` exports a `MonkeyUserScript` interface for the `userscript` option, so `@match`/`@grant`/`@connect`/`@run-at` etc. are type-checked in `vite.config.ts`. See `MonkeyOption.userscript?: MonkeyUserScript` in https://raw.githubusercontent.com/lisonge/vite-plugin-monkey/main/README.md and https://github.com/lisonge/vite-plugin-monkey (latest 8.1.0 as of 2026-07-20 via `npm view vite-plugin-monkey version` — verified 2026-08-25 — https://registry.npmjs.org/vite-plugin-monkey).

### Tooling Decision Table

| Need | Tool | Notes |
|------|------|-------|
| Fast single-file build | esbuild (+ banner/meta prepend) | Fastest; you manage the `==UserScript==` header via banner file or prepend step; output `.user.js` is manager-agnostic |
| Auto-header + dev server | vite-plugin-monkey (lisonge) | Manager-neutral (TM/VM/GM/ScriptCat); auto-generates grants and header; dev server with HMR |
| Webpack | webpack-monkey (guanss, early-stage 0.2.1, verified 2026-08-25 — https://registry.npmjs.org/webpack-monkey) | Early-stage; manager-neutral output; alternative `webpack-tampermonkey` (npm package `webpack-tampermonkey` 2.0.0, 2019-03-28, verified 2026-08-25 — https://registry.npmjs.org/webpack-tampermonkey) exists and emits a standard `.user.js` — output is manager-agnostic if you use it — but is older/unmaintained; esbuild-banner pattern is the fallback if neither fits |

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

**Sync `GM_*` vs promisified `GM.*` (verified 2026-08-25 — https://raw.githubusercontent.com/DefinitelyTyped/DefinitelyTyped/master/types/tampermonkey/index.d.ts, https://violentmonkey.github.io/api/gm/):**
`@types/tampermonkey` exposes both: sync globals like `GM_getValue<T>(name, default): T` and `GM_setValue(name, value: Tampermonkey.StorageValue)` (see https://raw.githubusercontent.com/DefinitelyTyped/DefinitelyTyped/master/types/tampermonkey/index.d.ts), and promisified `GM.getValue<T>(name, default?): Promise<T>` / `GM.setValue(name, value: any): Promise<void>` (see https://violentmonkey.github.io/api/gm/ — `GM.*` aliases added in VM 2.12.0). Do not confuse `GM.getValue` (Promise) with `GM_getValue` (sync). `GM.xmlHttpRequest` returns `Tampermonkey.PromiseWithAbort` (Promise & `{ abort(): void }`), not plain `Promise`.

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

### Declaration Merging and Ambient Augmentation

To extend page globals or manager types, use declaration merging (see https://www.typescriptlang.org/docs/handbook/declaration-merging.html):

```typescript
// Augment the page window
declare global {
  interface Window { myLib: { version: string } }
}
// Ambient module for vite-plugin-monkey ESM GM imports
declare module '$' {
  export * from 'vite-plugin-monkey/dist/client';
}
// Augment unsafeWindow with page libs
declare var unsafeWindow: Window & { myLib: Window['myLib'] };
```

Pattern mirrors the table's "Hand-rolled ambient *.d.ts: declare namespace Tampermonkey { ... }" — extend `Tampermonkey` namespace or `Window` as needed. (verified 2026-08-25 — https://www.typescriptlang.org/docs/handbook/declaration-merging.html, https://raw.githubusercontent.com/DefinitelyTyped/DefinitelyTyped/master/types/tampermonkey/index.d.ts)

### Top-Level Await and Async Wrapper

Userscript entry files run as plain scripts, not ES modules — top-level `await` is invalid unless the bundler emits ESM. `vite-plugin-monkey` supports top-level `await` and `dynamic import()` in a single file (it switches to `systemjs`/`iife` as needed; see https://raw.githubusercontent.com/lisonge/vite-plugin-monkey/main/README.md). esbuild supports bundling top-level `await` only with `format: esm` (see https://esbuild.github.io/content-types/ — bundling top-level await only supported when output format is `esm`). Otherwise wrap in `(async () => { ... })()` and avoid duplicate `'use strict'` if the bundler already injects it. Requires `target` ≥ `ES2017` for async/await downleveling (see https://www.typescriptlang.org/tsconfig/target). (verified 2026-08-25 — https://esbuild.github.io/content-types/, https://www.typescriptlang.org/tsconfig/target, https://raw.githubusercontent.com/lisonge/vite-plugin-monkey/main/README.md)

*Generic TypeScript patterns (typed fetch wrappers, DOM `waitForElement<T>` utilities, source maps) → TypeScript handbook / MDN — they do not affect manager portability beyond the portable `GM.*` and bundler patterns above. For source maps see https://www.typescriptlang.org/tsconfig/sourceMap and https://esbuild.github.io/api/#sourcemap.*

---

## Notes

- The `@types/tampermonkey` npm package covers both GM_* and GM.* APIs (the `Tampermonkey` global namespace is exported globally) — typings are de-facto for standard APIs across managers, not an execution-target lock
- `GM_info` is typed as `Tampermonkey.ScriptInfo` and available without `@grant` in all managers
- For `unsafeWindow`, cast carefully: `(unsafeWindow as Window & { myLib: MyLib }).myLib` — guard with `typeof unsafeWindow !== 'undefined'` (absent in Safari Userscripts regardless of grants; see `managers.md`)
- When using `@grant none`, the sandbox is disabled and `GM_*`/`GM.*` functions are unavailable — TypeScript won't catch this at compile time; any `@grant` vs `@grant none` semantics differ per manager (see `managers.md` and `common-pitfalls.md`)
- `@connect` and network APIs are manager-enforced differently (TM strict, VM not enforced, GM ignores); declare domains for TM compatibility
- Output `.user.js` is manager-agnostic — build once, load in Violentmonkey/Tampermonkey/Greasemonkey/Safari Userscripts (within each manager's supported API subset)
- `unsafeWindow` typing per manager (verified 2026-08-25 — https://raw.githubusercontent.com/DefinitelyTyped/DefinitelyTyped/master/types/tampermonkey/index.d.ts, https://raw.githubusercontent.com/violentmonkey/types/master/index.d.ts): Tampermonkey types it as `declare var unsafeWindow: Window & Omit<typeof globalThis, ...GM APIs...>` (see https://raw.githubusercontent.com/DefinitelyTyped/DefinitelyTyped/master/types/tampermonkey/index.d.ts line ~683), Violentmonkey as `declare const unsafeWindow: Window` (see https://raw.githubusercontent.com/violentmonkey/types/master/index.d.ts). Greasemonkey context differs. Some managers require `@grant unsafeWindow`; guard with `typeof unsafeWindow !== 'undefined'` and avoid leaking GM APIs via the page window — see `managers.md` and https://violentmonkey.github.io/api/gm/#unsafeWindow
