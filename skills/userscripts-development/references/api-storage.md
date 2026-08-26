# Storage API Reference

Portable key-value storage for userscripts. For full manager matrix see `managers.md` §2 Storage.

---

## Overview

Per-script `GM_*` / `GM.*` key-value store that persists across reloads and is isolated per script. Manager-dependent value types change portable code — see matrix below.

### Value-type support (portable subset)

Source of truth: `managers.md` §2 Storage. Gaps = UNVERIFIED — do not assume. (verified 2026-08-25 — wiki.greasespot.net/GM.setValue: "Strings, booleans, and integers"; violentmonkey.github.io/api/gm/#gm_setvalue: JSON-serializable; tampermonkey.net/documentation.php?locale=en: GM_values)

| Manager | Portable value types | Portable handling |
| --- | --- | --- |
| Tampermonkey | Structured-clone-ish with JSON fallback — UNVERIFIED (2026-08-25) — not documented at tampermonkey.net/documentation.php | Objects/arrays work; `Date`/`Map`/`Set` need manual conversion (see Handling Non-Serialisable Data). |
| Violentmonkey | JSON-serialisable (verified 2026-08-25 — violentmonkey.github.io/api/gm/#gm_setvalues: Must be JSON serializable) | No DOM nodes or circular references. |
| Greasemonkey 4+ | **Strings, booleans, and integers ONLY** (floats excluded — wiki: “Strings, booleans, and integers", verified 2026-08-25 — wiki.greasespot.net/GM.setValue) | `JSON.stringify` objects yourself before `GM.setValue`; `JSON.parse` on read. |
| Safari "Userscripts" app | JSON-serialisable — UNVERIFIED (2026-08-25) | Promise-only API. |

> **Portability rule:** write for GM4's string/boolean/integer-only store and JSON-stringify objects; TM/VM will accept the same payload. See `managers.md` §2 for authoritative version gates.

---

## Single Value Operations

Portable surface: `GM.setValue` / `GM.getValue` / `GM.deleteValue` / `GM.listValues` (promise) works on **TM, VM, GM4+, Safari**. Sync `GM_*` works on **TM/VM only** — GM4+ is Promise-only. For version gates see `managers.md` §2.

### GM_setValue(key, value)

```javascript
// @grant GM_setValue
// Portable: use string/boolean/integer or JSON-stringified objects for GM4
GM_setValue('username', 'John');
GM_setValue('count', 42);
GM_setValue('enabled', true);

// Portable object — stringify for GM4, works everywhere
GM_setValue('settings', JSON.stringify({ theme: 'dark', fontSize: 14 }));
// Alternative when targeting TM/VM only (JSON-serialisable):
// GM_setValue('settings', { theme: 'dark', fontSize: 14 });
```

### GM_getValue(key, defaultValue) (verified 2026-08-25 — wiki.greasespot.net/GM.getValue: Returns Promise resolved with String/Integer/Boolean or default/undefined)

```javascript
// @grant GM_getValue

const username = GM_getValue('username', 'Guest');
const count = GM_getValue('count', 0);

// Portable read of stringified object (GM4-safe)
const settings = JSON.parse(GM_getValue('settings', '{}'));

// Missing-key check — prefer null over undefined (undefined round-trip is manager-dependent)
const value = GM_getValue('maybeExists', null);
if (value === null) {
    console.log('Key does not exist');
}
```

### GM_deleteValue(key) (verified 2026-08-25 — wiki.greasespot.net/GM.deleteValue: Promise rejected with no value on failure, Compatibility Greasemonkey 4.0+)

```javascript
// @grant GM_deleteValue

GM_deleteValue('temporaryData');
```

### GM_listValues() (verified 2026-08-25 — wiki.greasespot.net/GM.listValues: Promise resolved with Array of Strings; violentmonkey.github.io/api/gm/#gm_listvalues)

Get an array of all stored keys. No ordering guarantee — `.sort()` if order matters. (ordering guarantee UNVERIFIED (2026-08-25) — not stated at wiki.greasespot.net/GM.listValues)

```javascript
// @grant GM_listValues

const keys = GM_listValues();
console.log('Stored keys:', keys);

keys.forEach(key => {
    console.log(key, '=', GM_getValue(key));
});
```

---

## Batch Operations (verified 2026-08-25 — tampermonkey.net/documentation.php?locale=en: GM_setValues v5.3+; violentmonkey.github.io/api/gm/#gm_setvalues: Since VM2.19.1)

Available on **Tampermonkey + Violentmonkey only**; **not in Greasemonkey 4+ or Safari** (`managers.md` §2). Feature-detect and use `Promise.all` fallback.

### GM_setValues / GM_getValues / GM_deleteValues

```javascript
// @grant GM_setValues
GM_setValues({
    username: 'John',
    theme: 'dark',
    lastLogin: Date.now()
});

// @grant GM_getValues
// Array form — missing keys are undefined (prefer null-safe defaults)
const values = GM_getValues(['username', 'theme', 'nonexistent']);

// Defaults-object form — missing keys get defaults
const values2 = GM_getValues({
    username: 'Guest',
    theme: 'light',
    notifications: true
});

// @grant GM_deleteValues
GM_deleteValues(['cache', 'tempData', 'oldSettings']);
```

### Portable fallback (GM4/Safari)

```javascript
// @grant GM_getValue
// @grant GM_setValue
// @grant GM_deleteValue

// Feature-detect portable degradation
const canBatch = typeof GM !== 'undefined' && typeof GM.getValues === 'function';

async function getValuesFallback(keys) {
    const entries = await Promise.all(keys.map(async k => [k, await GM.getValue(k)]));
    return Object.fromEntries(entries);
}

async function getValuesWithDefaults(defaults) {
    const entries = await Promise.all(
        Object.entries(defaults).map(async ([k, def]) => [k, await GM.getValue(k, def)])
    );
    return Object.fromEntries(entries);
}

async function setValuesFallback(values) {
    await Promise.all(Object.entries(values).map(([k, v]) => GM.setValue(k, v)));
}

async function deleteValuesFallback(keys) {
    await Promise.all(keys.map(k => GM.deleteValue(k)));
}
```

---

## Change Listeners (verified 2026-08-25 — violentmonkey.github.io/api/gm/#gm_addvaluechangelistener, tampermonkey.net/documentation.php?locale=en: GM_addValueChangeListener, wiki.greasespot.net/Greasemonkey_Manual:API — no listener in GM4)

Fires for `GM_setValue`/`GM.setValue` changes only; not for `localStorage`. See `api-tabs.md` for canonical cross-tab broadcast.

### GM_addValueChangeListener(key, callback)

```javascript
// @grant GM_addValueChangeListener

const listenerId = GM_addValueChangeListener('counter', (key, oldValue, newValue, remote) => {
    console.log(`Key: ${key}, old: ${oldValue}, new: ${newValue}, remote: ${remote}`);
    if (remote) {
        updateUI(newValue);
    }
});
```

| Manager | `remote` semantics | Listener support |
| --- | --- | --- |
| Tampermonkey | `boolean` — `true` when change from another tab (verified 2026-08-25 — tampermonkey.net/documentation.php: GM_addValueChangeListener remote boolean) | ✅ |
| Violentmonkey | `boolean` — same as Tampermonkey (verified 2026-08-25 — violentmonkey.github.io/api/gm/#gm_addvaluechangelistener: "true if modified by the userscript instance of another tab") | ✅ |
| Greasemonkey 4+ | Signature differs; `remote` handling **UNVERIFIED** (see `managers.md`) | ⚠️ Verify before relying |
| Safari "Userscripts" app | No listeners | ❌ |

```javascript
// @grant GM_removeValueChangeListener
GM_removeValueChangeListener(listenerId);
```

**Portable degradation:**

```javascript
const canListen = typeof GM_addValueChangeListener === 'function' || typeof GM?.addValueChangeListener === 'function';
if (!canListen) {
    console.warn('GM listeners not supported — polling or tabs broadcast fallback in api-tabs.md');
}
```

---

## Decision Table

| Need | Use | Portability note |
| --- | --- | --- |
| Read/write **one** key | `GM.getValue` / `GM.setValue` (promise) | Simple, works everywhere. Sync `GM_*` is TM/VM only. |
| Read/write **many** keys | Batch `GM.getValues` / `GM.setValues` | TM/VM only; otherwise `Promise.all` fallback above. |
| React to changes **across tabs** | `GM_addValueChangeListener` + `remote` check | TM/VM only; GM4 UNVERIFIED; Safari unsupported. Canonical broadcast in `api-tabs.md`. |

---

## Data Types and Limits (verified 2026-08-25 — wiki.greasespot.net/GM.setValue: Strings/booleans/integers only; violentmonkey.github.io/api/gm/#gm_setvalues: JSON serializable; developer.mozilla.org JSON)

| Type | Portable? | Notes |
|------|-----------|-------|
| string | ✅ | No practical limit; preferred for GM4. |
| number (finite integer) | ✅ | Portable. Floats are integers-only in GM4 — avoid or string-encode. |
| boolean | ✅ | |
| null | ✅ | Prefer `null` over `undefined` for missing-value sentinel. |
| undefined / Infinity / NaN | ⚠️ Not portable | JSON cannot represent them; round-trip is manager-dependent. Use `null` or string encoding (`"Infinity"`). |
| object / array | ⚠️ Portable only if JSON-stringified | Tampermonkey: structured-clone-ish — UNVERIFIED (2026-08-25) — not documented at tampermonkey.net/documentation.php; Violentmonkey/Safari: JSON-serialisable (verified 2026-08-25 — violentmonkey.github.io/api/gm/#gm_setvalue); Greasemonkey 4+: **must `JSON.stringify` yourself** (verified 2026-08-25 — wiki.greasespot.net/GM.setValue) — No DOM nodes or cycles. |
| Date / Map / Set | Manual | Convert to string/array first (see below). |
| Function / Symbol | ❌ | Cannot be serialised. |

> **Portable rule:** `JSON.stringify` on write and `JSON.parse` on read for any object/array; encode `Date` via `toISOString()`, `Map`/`Set` via `Array.from()`. This satisfies GM4 and works on TM/VM/Safari.

### Handling Non-Serialisable Data (portable)

```javascript
// Date — portable
GM_setValue('lastUpdate', new Date().toISOString());
const date = new Date(GM_getValue('lastUpdate'));

// Map — portable (stringify the array for GM4)
const map = new Map([['a', 1], ['b', 2]]);
GM_setValue('myMap', JSON.stringify(Array.from(map.entries())));
const restored = new Map(JSON.parse(GM_getValue('myMap', '[]')));

// Set
const set = new Set([1, 2, 3]);
GM_setValue('mySet', JSON.stringify(Array.from(set)));
const restoredSet = new Set(JSON.parse(GM_getValue('mySet', '[]')));

// Generic object — GM4-safe
GM_setValue('settings', JSON.stringify({ theme: 'dark' }));
const settings = JSON.parse(GM_getValue('settings', '{}'));
```

---

## Sync vs Async Contract & Portable Polyfill (verified 2026-08-25 — greasespot.net/2017/09/greasemonkey-4-for-script-authors.html, wiki.greasespot.net/GM.setValue, violentmonkey.github.io/api/gm/)

- **`GM_*` (underscore) = synchronous** — **Tampermonkey + Violentmonkey only**. **Absent on Greasemonkey 4+**.
- **`GM.*` (dot) = Promise-based async** — available everywhere: **Greasemonkey 4+ is Promise-only**, Violentmonkey and Tampermonkey ship both. Source of truth: `managers.md` §2.

```javascript
// Portable pattern — works on TM, VM, GM4+, Safari
// @grant GM.getValue
// @grant GM.setValue
const v = await GM.getValue('key', null);
await GM.setValue('key', v);
// then() variant when not in async function:
// GM.getValue('key', null).then(v => GM.setValue('key', v));
```

**For GM4 + TM/VM coverage**, grant both names and use the official polyfill when needed:

```javascript
// ==UserScript==
// @grant        GM.getValue
// @grant        GM_getValue
// @grant        GM.setValue
// @grant        GM_setValue
// @require      https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js
// ==/UserScript==
// then use promise form: await GM.getValue(...)
```
(verified 2026-08-25 — greasespot.net/2017/09/greasemonkey-4-for-script-authors.html)

Async batch overloads: `GM.getValues` / `GM_getValues` accept **array of keys** or **defaults object** — see `api-async.md`. All `GM.*` storage promises use standard promise rejection on failure (see Quotas below).

---

## Quotas, Errors & Eviction (verified 2026-08-25 — wiki.greasespot.net/GM.setValue, wiki.greasespot.net/GM.getValue, wiki.greasespot.net/GM.deleteValue, wiki.greasespot.net/GM.listValues)

GM storage is **extension storage**, not Web Storage — limits are manager- and browser-dependent. Never assume a fixed byte count.

- **GM failure mode** (Greasespot, verified 2026-08-25 — wiki.greasespot.net/GM.setValue, wiki.greasespot.net/GM.deleteValue, wiki.greasespot.net/GM.listValues): `GM.setValue` / `GM.deleteValue` / `GM.listValues` return `Promise` rejected with no value on failure (Compatibility: Greasemonkey 4.0+). Always `await` or `.catch()`:

```javascript
// @grant GM.setValue
try {
  await GM.setValue('key', largePayload);
} catch (e) {
  console.warn('GM storage failed — quota or internal error', e);
}
```

> **Do not conflate** GM storage with `localStorage`/`IndexedDB` quotas. Web Storage is page-origin, synchronous, string-only and throws `QuotaExceededError`; GM storage is extension-isolated and async. For Web Storage/IndexedDB details see MDN `Storage quotas and eviction criteria`.

---

## Cross-References

- `managers.md` §2 Storage — authoritative support matrix and version gates
- `api-async.md` — promise overloads and `GM.*` naming
- `api-tabs.md` — canonical cross-tab broadcast and tab-registry patterns
- `api-dom-ui.md` — sandbox / injection notes for `localStorage` access

> **GM listeners vs DOM `StorageEvent`:** `GM_addValueChangeListener` observes GM extension storage and fires in every script instance (`remote === false` locally, `true` from another tab). DOM `StorageEvent` observes `localStorage`/`sessionStorage` and fires only in *other* documents of the same origin. Do not mix them — use GM listeners for GM storage, `window.addEventListener('storage', …)` for Web Storage. (verified 2026-08-25 — violentmonkey.github.io/api/gm/#gm_addvaluechangelistener, developer.mozilla.org/en-US/docs/Web/API/StorageEvent)
