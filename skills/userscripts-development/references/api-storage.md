# Storage API Reference

Complete documentation for persistent data storage functions.

---

## Overview

Userscript managers provide a per-script key-value store that:
- Persists across page reloads and browser sessions
- Is isolated per script (scripts cannot access each other's data)
- Supports manager-dependent value types (see matrix below)
- Can notify listeners of changes across tabs where supported

### Value-type support by manager

Source of truth: `managers.md` §2 Storage. Gaps = UNVERIFIED — do not assume.

| Manager | Value types | Notes |
| --- | --- | --- |
| Tampermonkey | Structured-clone-ish with JSON fallback | Objects/arrays work; `Date`/`Map`/`Set` need manual conversion (see Handling Non-Serialisable Data). |
| Violentmonkey | JSON-serialisable | No DOM nodes or circular references. Use `JSON.stringify`/`parse` patterns for complex types. |
| Greasemonkey 4+ | **Strings, booleans, and integers ONLY** (floats excluded — wiki: “Strings, booleans, and integers”) | `JSON.stringify` objects yourself before `GM.setValue`; `JSON.parse` on read. |
| Safari "Userscripts" app | JSON-serialisable | Promise-only API. |

> **Violentmonkey worked example:** install a script with `// @grant GM_setValue` / `GM_getValue`, open the Violentmonkey Dashboard → your script → **Storage** tab to inspect keys, or query via DevTools console on any matched page with `await GM.getValue('key')`.

---

## Single Value Operations

### GM_setValue(key, value)

Store a value. **Note:** Greasemonkey 4+ has **no** sync `GM_*` forms — Promise-only `GM.setValue`/`GM.getValue` (see Async Versions below).

```javascript
// @grant GM_setValue

// Primitive values — portable everywhere (prefer null over undefined)
GM_setValue('username', 'John');
GM_setValue('count', 42);
GM_setValue('enabled', true);
GM_setValue('lastVisit', Date.now());

// Objects and arrays — see value-type matrix; Greasemonkey 4+ requires manual JSON
GM_setValue('settings', {
    theme: 'dark',
    fontSize: 14,
    notifications: true
});

GM_setValue('history', ['page1', 'page2', 'page3']);

// Nested objects
GM_setValue('userData', {
    profile: { name: 'John', age: 30 },
    preferences: { lang: 'en', timezone: 'UTC' }
});
```

### GM_getValue(key, defaultValue)

Retrieve a value. Returns `defaultValue` if key does not exist.

```javascript
// @grant GM_getValue

const username = GM_getValue('username', 'Guest');
const count = GM_getValue('count', 0);
const settings = GM_getValue('settings', { theme: 'light' });

// Check if value exists — prefer null-safe primitives (see Data Types note)
const value = GM_getValue('maybeExists', null);
if (value === null) {
    console.log('Key does not exist');
}
```

### GM_deleteValue(key)

Remove a stored value.

```javascript
// @grant GM_deleteValue

GM_deleteValue('temporaryData');
GM_deleteValue('cache');
```

### GM_listValues()

Get an array of all stored keys. No ordering guarantee — `.sort()` if order matters.

```javascript
// @grant GM_listValues

const keys = GM_listValues();
console.log('Stored keys:', keys);
// ['username', 'settings', 'history']

// Iterate all stored data
keys.forEach(key => {
    console.log(key, '=', GM_getValue(key));
});
```

---

## Batch Operations (Tampermonkey 5.3+, Violentmonkey 2.19.1+)

More efficient for multiple operations — reduces overhead. **Not supported in Greasemonkey 4+ or Safari** (`managers.md` §2). Use the `Promise.all` fallback below for those managers.

### GM_setValues(values) — Tampermonkey 5.3+, Violentmonkey 2.19.1+

Store multiple values at once.

```javascript
// @grant GM_setValues

GM_setValues({
    username: 'John',
    theme: 'dark',
    lastLogin: Date.now(),
    settings: { notifications: true, sound: false }
});
```

### GM_getValues(keysOrDefaults) — Tampermonkey 5.3+, Violentmonkey 2.19.1+

Retrieve multiple values at once. Overload matches `api-async.md`: pass an **array of keys** or a **defaults object**.

```javascript
// @grant GM_getValues

// With array — returns object with keys (undefined for missing; prefer null-safe defaults)
const values = GM_getValues(['username', 'theme', 'nonexistent']);
// { username: 'John', theme: 'dark', nonexistent: undefined }

// With defaults object — missing keys get default values
const values2 = GM_getValues({
    username: 'Guest',
    theme: 'light',
    notifications: true
});
// { username: 'John', theme: 'dark', notifications: true }
```

### GM_deleteValues(keys) — Tampermonkey 5.3+, Violentmonkey 2.19.1+

Delete multiple values at once. Part of the batch trio (`getValues` / `setValues` / `deleteValues`).

```javascript
// @grant GM_deleteValues

GM_deleteValues(['cache', 'tempData', 'oldSettings']);
```

### Fallback for managers without batch support

```javascript
// @grant GM_getValue
// @grant GM_setValue
// @grant GM_deleteValue
// Works in Greasemonkey 4+, Safari, and as generic fallback

// getValues fallback — array form
async function getValuesFallback(keys) {
    const entries = await Promise.all(keys.map(async k => [k, await GM.getValue(k)]));
    return Object.fromEntries(entries);
}

// getValues fallback — defaults-object form
async function getValuesWithDefaults(defaults) {
    const entries = await Promise.all(
        Object.entries(defaults).map(async ([k, def]) => [k, await GM.getValue(k, def)])
    );
    return Object.fromEntries(entries);
}

// setValues fallback
async function setValuesFallback(values) {
    await Promise.all(Object.entries(values).map(([k, v]) => GM.setValue(k, v)));
}

// deleteValues fallback
async function deleteValuesFallback(keys) {
    await Promise.all(keys.map(k => GM.deleteValue(k)));
}
```

See also `managers.md` §2 Storage row for the full support matrix.

---

## Change Listeners

Listen for value changes, including from other tabs/windows where supported.

### GM_addValueChangeListener(key, callback)

```javascript
// @grant GM_addValueChangeListener

const listenerId = GM_addValueChangeListener('counter', (key, oldValue, newValue, remote) => {
    console.log(`Key: ${key}`);
    console.log(`Old value: ${oldValue}`);
    console.log(`New value: ${newValue}`);
    console.log(`Remote change: ${remote}`);

    if (remote) {
        // Another tab changed this value
        updateUI(newValue);
    }
});
```

**Callback parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | The key that changed |
| `oldValue` | any | Previous value |
| `newValue` | any | New value |
| `remote` | boolean (TM/VM) | `true` if change was from another tab |

**Per-manager `remote` / listener support:**

| Manager | `remote` semantics | Listener support |
| --- | --- | --- |
| Tampermonkey | `boolean` — `true` when change originated in another tab | ✅ `GM_addValueChangeListener` |
| Violentmonkey | `boolean` — same as Tampermonkey | ✅ `GM_addValueChangeListener` |
| Greasemonkey 4+ | Signature differs; `remote` handling **UNVERIFIED** (see `managers.md`) | ⚠️ Verify against official docs before relying |
| Safari "Userscripts" app | No listeners | ❌ Not supported |

### GM_removeValueChangeListener(listenerId)

```javascript
// @grant GM_removeValueChangeListener

GM_removeValueChangeListener(listenerId);
```

---

## Common Patterns

### Decision table

| Need | Use | Notes |
| --- | --- | --- |
| Read/write **one** key | `GM_getValue` / `GM_setValue` (or `GM.getValue` / `GM.setValue`) | Simple, portable everywhere. |
| Read/write **many** keys at once | Batch `GM_getValues` / `GM_setValues` / `GM_deleteValues` | Tampermonkey 5.3+, Violentmonkey 2.19.1+ only; otherwise `Promise.all` fallback above. |
| React to changes **across tabs** | `GM_addValueChangeListener` + `remote` check | Tampermonkey/Violentmonkey only; Greasemonkey UNVERIFIED; Safari unsupported. Canonical cross-tab broadcast lives in `api-tabs.md`. |

### Settings Manager

```javascript
// @grant GM_getValue
// @grant GM_setValue
// @grant GM_registerMenuCommand

const DEFAULT_SETTINGS = {
    enabled: true,
    theme: 'auto',
    fontSize: 14,
    notifications: true
};

class Settings {
    constructor() {
        this.data = GM_getValue('settings', DEFAULT_SETTINGS);
    }

    get(key) {
        return this.data[key] ?? DEFAULT_SETTINGS[key];
    }

    set(key, value) {
        this.data[key] = value;
        GM_setValue('settings', this.data);
    }

    reset() {
        this.data = { ...DEFAULT_SETTINGS };
        GM_setValue('settings', this.data);
    }
}

const settings = new Settings();

// Menu commands
GM_registerMenuCommand('Toggle Feature', () => {
    settings.set('enabled', !settings.get('enabled'));
    location.reload();
});
```

### Cache with Expiry

```javascript
// @grant GM_getValue
// @grant GM_setValue

function getCached(key, fetchFn, maxAgeMs = 3600000) {
    const cached = GM_getValue(`cache_${key}`);

    if (cached && Date.now() - cached.timestamp < maxAgeMs) {
        return Promise.resolve(cached.data);
    }

    return fetchFn().then(data => {
        GM_setValue(`cache_${key}`, {
            data: data,
            timestamp: Date.now()
        });
        return data;
    });
}

// Usage
getCached('userData', () => fetchUserData(), 60000)  // 1 minute cache
    .then(data => console.log(data));
```

### Cross-Tab Communication

> **Canonical reference:** full broadcast / leader-election patterns live in `api-tabs.md` (Cross-Tab Communication). The snippet below is the minimal storage-side primitive; for tab registry, broadcast channels, and deduplication, see `api-tabs.md`.

```javascript
// @grant GM_setValue
// @grant GM_addValueChangeListener

// Sender (any tab)
function broadcast(channel, message) {
    GM_setValue(`broadcast_${channel}`, {
        message: message,
        timestamp: Date.now()
    });
}

// Receiver — filter on remote (Tampermonkey/Violentmonkey boolean semantics)
GM_addValueChangeListener('broadcast_main', (key, oldVal, newVal, remote) => {
    if (remote && newVal) {
        console.log('Received:', newVal.message);
        handleMessage(newVal.message);
    }
});

broadcast('main', { action: 'refresh', data: { userId: 123 } });
```

### Migration Between Versions

```javascript
// @grant GM_getValue
// @grant GM_setValue
// @grant GM_deleteValue

const CURRENT_VERSION = 3;

function migrateStorage() {
    const version = GM_getValue('storageVersion', 1);

    if (version < 2) {
        // v1 -> v2: Rename key
        const oldData = GM_getValue('userData');
        if (oldData) {
            GM_setValue('user', oldData);
            GM_deleteValue('userData');
        }
    }

    if (version < 3) {
        // v2 -> v3: Convert settings format
        const settings = GM_getValue('settings', {});
        if (typeof settings.theme === 'boolean') {
            settings.theme = settings.theme ? 'dark' : 'light';
            GM_setValue('settings', settings);
        }
    }

    GM_setValue('storageVersion', CURRENT_VERSION);
}

migrateStorage();
```

### Persistent Counter

```javascript
// @grant GM_getValue
// @grant GM_setValue

function incrementCounter(key, amount = 1) {
    const current = GM_getValue(key, 0);
    const newValue = current + amount;
    GM_setValue(key, newValue);
    return newValue;
}

// Track page visits
const visitCount = incrementCounter('pageVisits');
console.log(`You've visited this page ${visitCount} times`);
```

---

## Data Types and Limits

### Supported Types

| Type | Support | Notes |
|------|---------|-------|
| string | ✅ Portable | No practical size limit; preferred for Greasemonkey 4+. |
| number (finite) | ✅ Portable | Use finite numbers; see caution below for `Infinity`/`NaN`. |
| boolean | ✅ Portable | |
| null | ✅ Portable | Prefer `null` over `undefined` for missing-value sentinel. |
| undefined | ⚠️ Manager-dependent | Round-trip not guaranteed — some managers drop the key or coerce to `null`. **Recommend `null` instead.** |
| Infinity / NaN | ⚠️ Manager-dependent | JSON cannot represent them; managers that JSON-serialise may coerce to `null` or drop. **Recommend null-safe primitives or string encoding.** |
| object | ⚠️ Manager-dependent | Tampermonkey: structured-clone-ish with JSON fallback; Violentmonkey/Safari: JSON-serialisable; Greasemonkey 4+: **must `JSON.stringify` yourself** (integers-only primitive store). No DOM nodes or cycles. |
| array | ⚠️ Manager-dependent | Same as object. |
| Date | Manual | Stored as string — `toISOString()` on write, `new Date()` on read. |
| Map/Set | Manual | Convert to array/object first (see below). |
| Function / Symbol | ❌ | Cannot be serialised. |

> **Caution — undefined / Infinity / NaN:** their round-trip is manager-dependent. Tampermonkey's structured-clone path may preserve some, but Violentmonkey's JSON path and Greasemonkey 4+ string/boolean/integer-only store will not. **Recommend:** use `null` to represent absence, and encode `Infinity`/`NaN` as strings (e.g., `"Infinity"`, `"NaN"`) or avoid storing them.

### Handling Non-Serialisable Data

```javascript
// Date objects — portable
GM_setValue('lastUpdate', new Date().toISOString());
const date = new Date(GM_getValue('lastUpdate'));

// Map — portable (Greasemonkey 4+: JSON.stringify the array first)
const map = new Map([['a', 1], ['b', 2]]);
GM_setValue('myMap', Array.from(map.entries()));
const restored = new Map(GM_getValue('myMap'));

// Set
const set = new Set([1, 2, 3]);
GM_setValue('mySet', Array.from(set));
const restoredSet = new Set(GM_getValue('mySet'));

// Greasemonkey 4+ explicit JSON handling for objects
GM_setValue('settings', JSON.stringify({ theme: 'dark' }));
const settings = JSON.parse(GM_getValue('settings', '{}'));
```

---

## Async Versions

All storage functions have `GM.*` async equivalents. See `api-async.md`.

Overload for `GM.getValues` / `GM_getValues` is identical to sync: pass an **array of keys** (`['a','b']`) or a **defaults object** (`{ a: 1, b: 'default' }`) — see `api-async.md` for the promise forms.

```javascript
// Async equivalents — manager support per managers.md §2
const value = await GM.getValue('key', 'default');
await GM.setValue('key', 'value');
await GM.deleteValue('key');
const keys = await GM.listValues();
// Batch — Tampermonkey 5.3+, Violentmonkey 2.19.1+; otherwise Promise.all fallback
await GM.setValues({ a: 1, b: 2 });
const values = await GM.getValues(['a', 'b']);           // array overload
const values2 = await GM.getValues({ a: 1, b: 'hi' });   // defaults-object overload
await GM.deleteValues(['a', 'b']);
```

Cross-reference: `managers.md` §2 Storage, `api-async.md` (promise overloads), `api-tabs.md` (canonical cross-tab broadcast).
