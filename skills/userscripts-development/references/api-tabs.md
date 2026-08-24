# Tab API Reference

Documentation for tab management and cross-tab communication. Per-manager facts follow [managers.md](managers.md); when a concrete manager is shown, **Violentmonkey** is the worked example. Version numbers are manager-qualified (for example Tampermonkey 5.3+, Violentmonkey since 2.12.0).

---

## Conventions

| Form | Status | Managers | Notes |
| --- | --- | --- | --- |
| `GM_getTab` / `GM_saveTab` / `GM_getTabs` + `GM_openInTab(url, opts)` (callback / sync) | **Legacy** | Tampermonkey | Callback/sync forms are legacy; prefer promise `GM.*` where available (Violentmonkey does **not** implement `GM_getTab`/`GM_saveTab`/`GM_getTabs` at all — use `GM_setValue` + `GM_addValueChangeListener` for cross-tab persistence) |
| `GM.getTab()` / `GM.saveTab(tab)` / `GM.getTabs()` + `GM.openInTab(url, opts)` (promise) | **Preferred** | Tampermonkey ✅, Greasemonkey 4+ ⚠️ promise forms only (tab storage absent — see below), Safari Userscripts `GM.getTab`/`GM.saveTab` ✅ promise (tab-persistent while tab open; no `GM.getTabs`; deprecation planned v5→v6 per quoid/userscripts#667) | Greasemonkey 4+ offers promises **only** — all `GM_*` sync forms were removed in 4.0; Violentmonkey does **not** implement `GM_getTab`/`GM_saveTab`/`GM_getTabs` (absent from https://violentmonkey.github.io/api/gm/, declined in issue #1120) |
| Safari "Userscripts" app | Minimal tab support | `GM_openInTab(url, bool?)` / `GM.openInTab(url, bool?)` and `window.close` bool form, plus `GM.getTab():Promise<Any>` / `GM.saveTab(tabObj):Promise` (persistent while tab open; no legacy `GM_*` sync forms, no `GM.getTabs`; deprecation planned v5→v6 per quoid/userscripts#667) | No `GM_getTabs`; legacy `GM_*` sync forms absent |

> **Greasemonkey 4+:** promise-only. Every example below that uses `GM_getTab(callback)` has a `GM.getTab()` promise equivalent. **Safari Userscripts:** provides `GM.getTab():Promise<Any>` and `GM.saveTab(tabObj):Promise` (persistent while tab open; no legacy `GM_*` sync forms, no `GM.getTabs`; deprecation planned v5→v6 per quoid/userscripts#667) plus `openInTab`/`closeTab` with a boolean argument. **Violentmonkey:** does not implement `GM_getTab`/`GM_saveTab`/`GM_getTabs` at all — use `GM_setValue` + `GM_addValueChangeListener` for cross-tab persistence. See [managers.md](managers.md) §2 Tabs and [api-async.md](api-async.md) for promise contracts.

---

## Tab-Persistent Storage

Tab objects persist for the lifetime of the current tab and survive navigations within that tab.

### GM_getTab(callback) — sync (callback), legacy

Get an object that persists for the lifetime of the current tab.

| Manager | Support |
| --- | --- |
| Tampermonkey | ✅ sync callback |
| Violentmonkey | ❌ not implemented (absent from https://violentmonkey.github.io/api/gm/, declined in issue #1120) — use `GM_setValue` + `GM_addValueChangeListener` |
| Greasemonkey 4+ | ❌ sync — use `GM.getTab()` promise (where implemented; tab storage absent in Greasemonkey — see below) |
| Safari "Userscripts" | ✅ `GM.getTab():Promise<Any>` promise (no `GM_getTab` sync; persistent while tab open) |

```javascript
// @grant GM_getTab

GM_getTab(function(tab) {
    console.log('Tab object:', tab);

    // Tab object is initially empty {}
    tab.visitCount = (tab.visitCount || 0) + 1;
    tab.lastVisit = Date.now();

    // Data persists across page navigations within this tab
    console.log('Visits in this tab:', tab.visitCount);
});
```

**Promise form (preferred):**

```javascript
// @grant GM.getTab
// Availability: Tampermonkey ✅, Safari Userscripts ✅ promise (`GM.getTab():Promise<Any>` persistent while tab open; no `GM.getTabs`; deprecation planned v5→v6 per quoid/userscripts#667); Violentmonkey ❌ not implemented; Greasemonkey 4+ ❌ tab storage not implemented

const tab = await GM.getTab();
tab.visitCount = (tab.visitCount || 0) + 1;
console.log('Visits:', tab.visitCount);
```

### GM_saveTab(tab) — sync (callback), legacy

Save changes to the tab object. You must call save after mutating the tab object in the sync form; promise form is `GM.saveTab(tab)`.

| Manager | Support |
| --- | --- |
| Tampermonkey | ✅ sync callback `GM_saveTab(tab, cb?)` |
| Violentmonkey | ❌ not implemented (absent from https://violentmonkey.github.io/api/gm/, declined in issue #1120) — use `GM_setValue` + `GM_addValueChangeListener` |
| Greasemonkey 4+ | ❌ sync — use `GM.saveTab(tab)` promise (where implemented; tab storage absent in Greasemonkey — see below) |
| Safari "Userscripts" | ✅ `GM.saveTab(tabObj):Promise` promise (no `GM_saveTab` sync; persistent while tab open) |

```javascript
// @grant GM_saveTab
// @grant GM_getTab

GM_getTab(function(tab) {
    tab.userData = {
        preferences: { theme: 'dark' },
        history: ['page1', 'page2']
    };

    GM_saveTab(tab, function() {
        console.log('Tab data saved');
    });
});
```

**Promise form (preferred):**

```javascript
// @grant GM.saveTab
// @grant GM.getTab

const tab = await GM.getTab();
tab.userData = { preferences: { theme: 'dark' } };
await GM.saveTab(tab);
console.log('Tab data saved');
```

### GM_getTabs(callback) — sync (callback), legacy

Get tab objects from all tabs running the script.

| Manager | Support |
| --- | --- |
| Tampermonkey | ✅ sync callback |
| Violentmonkey | ❌ not implemented (absent from https://violentmonkey.github.io/api/gm/, declined in issue #1120) — use `GM_setValue` + `GM_addValueChangeListener` |
| Greasemonkey 4+ | ❌ sync — use `GM.getTabs()` promise (⚠️ partial; tab storage absent in Greasemonkey — see below) |
| Safari "Userscripts" | ❌ not implemented (no `GM.getTabs`; `GM.getTab`/`GM.saveTab` promise only) |

```javascript
// @grant GM_getTabs

GM_getTabs(function(tabs) {
    console.log('All tabs:', tabs);

    // tabs is an object: { tabId1: tabData1, tabId2: tabData2, ... }
    for (const [tabId, tabData] of Object.entries(tabs)) {
        console.log(`Tab ${tabId}:`, tabData);
    }

    const tabCount = Object.keys(tabs).length;
    console.log(`Script running in ${tabCount} tabs`);
});
```

**Promise form (preferred):**

```javascript
// @grant GM.getTabs
// Availability: Tampermonkey ✅; Violentmonkey ❌ not implemented — use GM_setValue + GM_addValueChangeListener; Greasemonkey 4+ ❌ not implemented; Safari ❌ (no GM.getTabs)

const tabs = await GM.getTabs();
for (const [tabId, tabData] of Object.entries(tabs)) {
    console.log(`Tab ${tabId}:`, tabData);
}
```

See [managers.md](managers.md) §2 Tabs for the normative matrix and [api-async.md](api-async.md) for promise contracts.

---

## Window Control

### GM_openInTab(url, options) — canonical

Open a new browser tab. This file is the **canonical home** for per-manager option sets; [api-sync.md](api-sync.md) holds only a summary linking here.

| Manager | Accepted second arg | Recognised options | Returned handle |
| --- | --- | --- | --- |
| **Tampermonkey** | Object **or** boolean (`loadInBackground` legacy alias, opposite of `active`) | `{ active, insert (integer position, default false), setParent, incognito }` | Handle `{ close(), focus(), onclose, closed }` — `close()` closes the tab, `focus()` brings it to front (changelog “Add a focus method to the return value of GM_openInTab”), `onclose` callback, `closed` boolean |
| **Violentmonkey** | Object **or** boolean (`openInBackground`, opposite of `active`) | `{ active, container, insert, pinned }` or boolean | Control object with `close()`, `onclose`, `closed` (same casing as Tampermonkey) |
| **Greasemonkey 4+** | Boolean or partial object | boolean / partial options; prefer `GM.openInTab(url, opts?)` promise | `undefined` (https://wiki.greasespot.net/GM.openInTab — no Promise/handle; handle/close semantics are Tampermonkey/Violentmonkey extensions) |
| **Safari "Userscripts"** | **Boolean only** | `true` = background, `false` = foreground — object options not supported | Minimal handle |

Normalize `closed` / `onclose` casing consistently (lowercase) across examples.

```javascript
// @grant GM_openInTab

// Portable baseline — works in every manager that supports the API
GM_openInTab('https://example.com/');

// --- Tampermonkey ---
const tmTab = GM_openInTab('https://example.com/', {
    active: true,       // focus the new tab (opposite of loadInBackground)
    insert: 2,          // integer position (default false), not boolean — e.g. 2 inserts at position 2
    setParent: true,    // current tab is parent (closing parent may close this tab)
    incognito: false    // open in private/incognito mode
});

// --- Violentmonkey (worked example) ---
const vmTab = GM_openInTab('https://example.com/', {
    active: true,       // focus the new tab
    container: 0,       // Firefox container index (Violentmonkey-only)
    insert: true,       // Violentmonkey insert as boolean (Tampermonkey `insert` is integer position, default false)
    pinned: false       // pin the new tab
});
// Boolean shorthand also works in Violentmonkey/Tampermonkey:
GM_openInTab('https://example.com/', true);  // background — same as { active: false }

// --- Greasemonkey 4+ — prefer promise form ---
// @grant GM.openInTab
await GM.openInTab('https://example.com/', true);

// --- Safari — boolean only ---
// @grant GM_openInTab
GM_openInTab('https://example.com/', false); // false = foreground

// Control the opened tab — same handle shape (Tampermonkey/Violentmonkey) — Tampermonkey handle also exposes focus()
tmTab.onclose = function() {
    console.log('New tab was closed');
};

if (tmTab.closed) {
    console.log('Tab is already closed');
}

setTimeout(() => {
    tmTab.close();
}, 5000);
```

**Promise form (preferred where available):**

```javascript
// @grant GM.openInTab
// Availability: Tampermonkey ✅, Violentmonkey since 2.12.0, Greasemonkey 4+ ⚠️ promise, Safari bool-only promise

const handle = await GM.openInTab('https://example.com/', { active: true });
handle.onclose = () => console.log('closed');
```

### window.close

Close the current tab.

| Manager | Grant | Notes |
| --- | --- | --- |
| Tampermonkey | **Requires** `// @grant window.close` (Tampermonkey treats `window.close` as a grant) | Last-tab close may still be blocked by the browser |
| Violentmonkey | `window.focus` exposed without grant (issue #1195); `window.close` exposed natively — **no grant needed** | Last-tab close may still be blocked |
| Greasemonkey 4+ | No privileged grant — standard `window.close()` restrictions apply (cannot close non-script-opened tabs; not a Greasemonkey grant) | Last-tab close may still be blocked |
| Safari "Userscripts" | Boolean `openInTab` handle has `close()`; `window.close` bool form | Object options not supported |

```javascript
// Tampermonkey — grant required:
// @grant window.close
// Violentmonkey / Greasemonkey — no grant needed

if (confirm('Close this tab?')) {
    window.close();
}

// Note: Cannot close the last tab in a window (security restriction) — all managers
```

### window.focus

Bring the window to the front.

| Manager | Grant | Notes |
| --- | --- | --- |
| Tampermonkey | **Requires** `// @grant window.focus` | Unlike `unsafeWindow.focus()`, this works regardless of browser focus settings |
| Violentmonkey | Exposed natively — **no grant needed** (provides `window.focus` without grant per issue #1195) | — |
| Greasemonkey 4+ | No privileged grant — standard `window.focus()` (not a Greasemonkey grant) | — |
| Safari "Userscripts" | No special grant | — |

```javascript
// Tampermonkey:
// @grant window.focus
// Violentmonkey / Greasemonkey — no grant

window.focus();
```

---

## URL Change Detection

### window.onurlchange — Tampermonkey-ONLY

> **Tampermonkey-ONLY.** Violentmonkey declined this API (issue #1195); Greasemonkey 4+ and Safari "Userscripts" do not implement it. Do not feature-test for `onurlchange` as a portable success path — use the portable fallback below.

When `window.onurlchange` is supported, Tampermonkey exposes it as `null` until granted, then fires a `urlchange` event with `info.url` (the new URL).

```javascript
// @grant window.onurlchange  // Tampermonkey-ONLY grant; ignored elsewhere

// Check Tampermonkey support — window.onurlchange === null means available
if (window.onurlchange === null) {
    window.addEventListener('urlchange', function(info) {
        console.log('URL changed to:', info.url);  // info.url — Tampermonkey idiom

        if (info.url.includes('/profile')) {
            modifyProfilePage();
        } else if (info.url.includes('/settings')) {
            modifySettingsPage();
        }
    });
}
```

### Comprehensive SPA handler — Tampermonkey onurlchange + portable fallback

```javascript
// @grant window.onurlchange  // Tampermonkey-ONLY; ignored elsewhere

(function() {
    'use strict';

    handlePage(location.href);

    // Tampermonkey-only enhancement
    if (window.onurlchange === null) {
        window.addEventListener('urlchange', (info) => handlePage(info.url));
    }

    function handlePage(url) {
        setTimeout(() => {
            if (url.includes('/dashboard')) {
                enhanceDashboard();
            } else if (url.includes('/search')) {
                enhanceSearch();
            }
        }, 100);
    }
})();
```

### Portable History-API interception fallback (all managers)

Use this as the primary portable path. Works in Tampermonkey, Violentmonkey, Greasemonkey 4+, and Safari.

```javascript
let currentUrl = location.href;

function handleUrlChange() {
    if (location.href !== currentUrl) {
        currentUrl = location.href;
        console.log('URL changed:', currentUrl);
        onPageChange();
    }
}

// Patch history
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    handleUrlChange();
    return result;
};

history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    handleUrlChange();
    return result;
};

window.addEventListener('popstate', handleUrlChange);
window.addEventListener('hashchange', handleUrlChange);

function onPageChange() {
    // Re-run modifications for new route
    console.log('Handling page:', location.href);
}
```

See [patterns.md](patterns.md) (SPA Navigation Handling) for the full portable pattern and [managers.md](managers.md) §2 SPA navigation row.

---

## Cross-Tab Communication — canonical

> **Canonical reference** for broadcast / registry / leader-election patterns. [api-storage.md](api-storage.md) links here for cross-tab coordination; storage primitives (`GM_setValue` etc.) are documented there.

| Need | Pattern | When to choose |
| --- | --- | --- |
| One-shot broadcast to all tabs | `GM_setValue` + `GM_addValueChangeListener` (`remote` check) | Notify all tabs of a settings change or refresh signal |
| Persistent registry of active tabs | `GM_getTab` / `GM_saveTab` / `GM_getTabs` | Track which tabs have the page open, deduplicate, enumerate |
| Single actor across tabs (avoid duplicate work) | Leader election (heartbeat + `GM_setValue('leader')`) | Only one tab should poll, sync, or write |

### Using GM_setValue / GM_addValueChangeListener (broadcast)

```javascript
// @grant GM_setValue
// @grant GM_getValue
// @grant GM_addValueChangeListener

const TAB_ID = Math.random().toString(36).substr(2, 9);

function broadcast(type, data) {
    GM_setValue('broadcast', {
        type: type,
        data: data,
        sender: TAB_ID,
        timestamp: Date.now()
    });
}

GM_addValueChangeListener('broadcast', (key, oldVal, newVal, remote) => {
    if (remote && newVal && newVal.sender !== TAB_ID) {
        console.log('Received:', newVal.type, newVal.data);
        handleMessage(newVal.type, newVal.data);
    }
});

function handleMessage(type, data) {
    switch (type) {
        case 'REFRESH':
            location.reload();
            break;
        case 'SETTINGS_CHANGED':
            applySettings(data);
            break;
        case 'PING':
            broadcast('PONG', { respondingTo: data.from });
            break;
    }
}

broadcast('SETTINGS_CHANGED', { theme: 'dark' });
```

### Tab Registry

```javascript
// @grant GM_getTab
// @grant GM_saveTab
// @grant GM_getTabs
// @grant GM_addValueChangeListener

function registerTab() {
    GM_getTab(tab => {
        tab.id = tab.id || Math.random().toString(36).substr(2, 9);
        tab.registered = Date.now();
        tab.url = location.href;
        GM_saveTab(tab);
    });
}

function getActiveTabs(callback) {
    GM_getTabs(tabs => {
        const activeTabs = Object.entries(tabs)
            .filter(([id, data]) => data.registered)
            .map(([id, data]) => ({
                id: data.id,
                url: data.url,
                age: Date.now() - data.registered
            }));
        callback(activeTabs);
    });
}

function isDuplicateTab(callback) {
    GM_getTab(currentTab => {
        GM_getTabs(allTabs => {
            const duplicates = Object.values(allTabs).filter(
                t => t.url === location.href && t.id !== currentTab.id
            );
            callback(duplicates.length > 0, duplicates);
        });
    });
}

registerTab();
isDuplicateTab((isDuplicate, others) => {
    if (isDuplicate) {
        console.log('Another tab has this page open:', others);
    }
});
```

### Leader Election

```javascript
// @grant GM_setValue
// @grant GM_getValue
// @grant GM_addValueChangeListener

const TAB_ID = Math.random().toString(36).substr(2, 9);
let isLeader = false;

async function electLeader() {
    const leader = GM_getValue('leader', null);
    const now = Date.now();

    if (leader && now - leader.timestamp < 5000 && leader.id !== TAB_ID) {
        isLeader = false;
        return;
    }

    GM_setValue('leader', { id: TAB_ID, timestamp: now });

    await new Promise(r => setTimeout(r, 100));

    const currentLeader = GM_getValue('leader');
    isLeader = currentLeader && currentLeader.id === TAB_ID;

    console.log(isLeader ? 'This tab is the leader' : 'Another tab is leader');
}

setInterval(() => {
    if (isLeader) {
        GM_setValue('leader', { id: TAB_ID, timestamp: Date.now() });
    }
}, 3000);

GM_addValueChangeListener('leader', () => {
    setTimeout(electLeader, 100);
});

electLeader();

function doLeaderOnlyTask() {
    if (!isLeader) return;
    console.log('Performing leader-only task');
}
```

---

## Async Versions (promise forms — preferred)

```javascript
// @grant GM.getTab
// @grant GM.saveTab
// @grant GM.getTabs
// Availability: Tampermonkey ✅; Safari Userscripts ✅ `GM.getTab`/`GM.saveTab` promise (no `GM.getTabs`; deprecation planned v5→v6 per quoid/userscripts#667); Violentmonkey ❌ not implemented; Greasemonkey 4+ ❌ not implemented

const tab = await GM.getTab();
tab.data = 'value';
await GM.saveTab(tab);

const tabs = await GM.getTabs();

// GM.openInTab promise — see canonical table above
const handle = await GM.openInTab('https://example.com/', { active: true });
```

---

## See Also

- [managers.md](managers.md) — normative Support Matrix (§2 Tabs, §2 SPA navigation)
- [api-storage.md](api-storage.md) — storage primitives and listener semantics (`remote` flag)
- [api-async.md](api-async.md) — promise-based `GM.*` contracts
- [patterns.md](patterns.md) — portable SPA navigation fallback

