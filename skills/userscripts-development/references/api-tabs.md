# Tab API Reference

Documentation for tab management and cross-tab communication. Per-manager facts follow [managers.md](managers.md); when a concrete manager is shown, **Violentmonkey** is the worked example.

---

## Conventions

| Form | Status | Managers | Notes |
| --- | --- | --- | --- |
| `GM_getTab` / `GM_saveTab` / `GM_getTabs` + `GM_openInTab(url, opts)` (callback / sync) | **Legacy** | Tampermonkey | Callback/sync forms are legacy; prefer promise `GM.*` where available (Violentmonkey does **not** implement `GM_getTab`/`GM_saveTab`/`GM_getTabs` at all — use `GM_setValue` + `GM_addValueChangeListener` for cross-tab persistence) |
| `GM.getTab()` / `GM.saveTab(tab)` / `GM.getTabs()` + `GM.openInTab(url, opts)` (promise) | **Preferred** | Tampermonkey ✅, Greasemonkey 4+ ⚠️ promise forms only (tab storage absent — see below), Safari Userscripts `GM.getTab`/`GM.saveTab` ✅ promise (tab-persistent while tab open; no `GM.getTabs`; deprecation planned v5→v6 per quoid/userscripts#667) | Greasemonkey 4+ offers promises **only** — all `GM_*` sync forms were removed in 4.0; Violentmonkey does **not** implement `GM_getTab`/`GM_saveTab`/`GM_getTabs` (absent from https://violentmonkey.github.io/api/gm/, declined in issue #1120) |
| Safari "Userscripts" app | Minimal tab support | `GM_openInTab(url, bool?)` / `GM.openInTab(url, bool?)` and `window.close` bool form, plus `GM.getTab():Promise<Any>` / `GM.saveTab(tabObj):Promise` (persistent while tab open; no legacy `GM_*` sync forms, no `GM.getTabs`; deprecation planned v5→v6 per quoid/userscripts#667) | No `GM_getTabs`; legacy `GM_*` sync forms absent |

Portable baseline is the promise `GM.*` surface; legacy `GM_*` is kept for Tampermonkey-only contexts. Normative matrices: [managers.md](managers.md) §2 Tabs; promise contracts: [api-async.md](api-async.md).

---

## Tab-Persistent Storage

Tab objects persist for the lifetime of the current tab and survive navigations within that tab.

> **Isolation & deprecation (verified 2026-08-24):** Tampermonkey isolates tab objects per script; Safari Userscripts shares the tab object between scripts (can cause cross-script conflicts) and plans deprecation of `GM.getTab`/`GM.saveTab` in v5 with removal in v6 in favour of `sessions.setTabValue`/`getTabValue` (not available in Safari) per [quoid/userscripts#667](https://github.com/quoid/userscripts/issues/667).

### GM_getTab(callback) — sync (callback), legacy

Get an object that persists for the lifetime of the current tab.

| Manager | Support |
| --- | --- |
| Tampermonkey | ✅ sync callback |
| Violentmonkey | ❌ not implemented (absent from https://violentmonkey.github.io/api/gm/, declined in issue #1120) — use `GM_setValue` + `GM_addValueChangeListener` |
| Greasemonkey 4+ | ❌ sync — use `GM.getTab()` promise (where implemented; tab storage absent in Greasemonkey — see below) |
| Safari "Userscripts" | ✅ `GM.getTab():Promise<Any>` promise (no `GM_getTab` sync; persistent while tab open) |

Legacy sync `GM_getTab(cb)` — Tampermonkey-only; prefer promise below.

**Promise form (preferred):**

```javascript
// @grant GM.getTab
// Availability: Tampermonkey ✅, Safari Userscripts ✅ promise (no GM.getTabs; deprecation planned v5→v6 per quoid/userscripts#667); Violentmonkey ❌ not implemented; Greasemonkey 4+ ❌ tab storage not implemented

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

Legacy sync `GM_saveTab(tab, cb?)` — Tampermonkey-only; promise form below is portable baseline.

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

Legacy sync `GM_getTabs(cb)` — Tampermonkey-only; prefer promise below.

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
| **Tampermonkey** | Object **or** boolean (`loadInBackground` legacy alias, opposite of `active`) | `{ active, insert (integer position, default false), setParent, incognito }` | Handle `{ close(), focus(), onclose, closed }` — `close()` closes the tab, `focus()` brings it to front, `onclose` callback, `closed` boolean |
| **Violentmonkey** | Object **or** boolean (`openInBackground`, opposite of `active`) | `{ active, container, insert, pinned }` or boolean | Control object with `close()`, `onclose`, `closed` (same casing as Tampermonkey) |
| **Greasemonkey 4+** | Boolean or partial object | boolean / partial options; prefer `GM.openInTab(url, opts?)` promise | `undefined` ([Greasespot wiki](https://wiki.greasespot.net/GM.openInTab) — no Promise/handle) |
| **Safari "Userscripts"** | **Boolean only** | `true` = background, `false` = foreground — object options not supported | Minimal handle |

For option defaults and handle semantics see [TM docs](https://www.tampermonkey.net/documentation.php?locale=en&q=GM_openInTab) and [Violentmonkey types](https://violentmonkey.github.io/types/interfaces/VMScriptGMTabOptions.html); normative summary in [managers.md](managers.md) §2 Tabs.

> **GM_openInTab portability & permission notes (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?locale=en&q=GM_openInTab, https://violentmonkey.github.io/api/gm/, https://violentmonkey.github.io/types/interfaces/VMScriptGMTabOptions.html, https://wiki.greasespot.net/GM.openInTab, MDN Window.open):**
> - **Popup blocker:** `window.open()` requires transient activation and returns `null` when blocked ([MDN Window.open](https://developer.mozilla.org/en-US/docs/Web/API/Window/open)) (verified 2026-08-25 — same); `GM_openInTab` is privileged and bypasses popup blockers — prefer it for background / outside-click flows (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?locale=en&q=GM_openInTab).
> - **Defaults differ:** Tampermonkey defaults `active:false` (background) and `insert:false` (append at end; integer position when set) per [TM docs](https://www.tampermonkey.net/documentation.php?locale=en&q=GM_openInTab) (verified 2026-08-25 — same); Violentmonkey defaults `active:true` (foreground) and `insert:true` (next to current, sets `openerTab`) per [VM types](https://violentmonkey.github.io/types/interfaces/VMScriptGMTabOptions.html) (verified 2026-08-25 — same). Note type: TM `insert` is integer/false, VM `insert` is boolean.
> - **Lifecycle:** Tampermonkey `setParent:true` makes the new tab a child of the opener — closing the parent may close the child; Violentmonkey `insert:true` sets `openerTab` so closing the child refocuses the opener (verified 2026-08-25 — https://violentmonkey.github.io/types/interfaces/VMScriptGMTabOptions.html, https://www.tampermonkey.net/documentation.php?locale=en&q=GM_openInTab).
> - **Incognito:** `incognito:true` (Tampermonkey) — option verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?locale=en&q=GM_openInTab; silent-failure when private-window permission missing observed in [Tampermonkey #2657](https://github.com/Tampermonkey/tampermonkey/issues/2657) — UNVERIFIED via primary docs (2026-08-25).
> - **Data URLs:** Firefox does not support `data:` URLs for `GM_openInTab` ([VM GM_openInTab](https://violentmonkey.github.io/types/functions/GM_openInTab.html) (verified 2026-08-25 — same)).
> - **Container (Violentmonkey-only, Firefox):** `container` is an integer contextual-identity index, not a name — `0` is the default container (as shown), omit to reuse the opener tab’s container ([VM VMScriptGMTabOptions](https://violentmonkey.github.io/types/interfaces/VMScriptGMTabOptions.html) (verified 2026-08-25 — same)).
> - **Promise rejection:** Promise forms (`GM.openInTab`) reject with an error message on invalid URL or failure — wrap `await GM.openInTab(...)` in `try/catch` (Safari: “rejected with error message if fails” per [quoid/userscripts README](https://raw.githubusercontent.com/quoid/userscripts/main/README.md) `GM.openInTab` entry (verified 2026-08-25 — same); same for Tampermonkey/Violentmonkey).

```javascript
// @grant GM_openInTab

// Portable baseline — works in every manager that supports the API
GM_openInTab('https://example.com/');

// Tampermonkey — manager-specific options (avoid in portable code)
const tmTab = GM_openInTab('https://example.com/', {
    active: true,    // focus the new tab
    insert: 2,       // integer position (default false)
    setParent: true, // parent-child lifecycle
    incognito: false
});

// Violentmonkey (worked example) — manager-specific options (avoid in portable code)
const vmTab = GM_openInTab('https://example.com/', {
    active: true,
    container: 0,  // Firefox container index (Violentmonkey-only)
    insert: true,  // boolean (Tampermonkey insert is integer)
    pinned: false
});
GM_openInTab('https://example.com/', true);  // bool shorthand: background

// Greasemonkey 4+ — prefer promise; Safari — boolean only
// @grant GM.openInTab
await GM.openInTab('https://example.com/', true); // GM promise
GM_openInTab('https://example.com/', false);      // Safari bool

// Handle control (Tampermonkey/Violentmonkey shape; TM also has focus())
vmTab.onclose = () => console.log('closed');
if (vmTab.closed) console.log('already closed');
setTimeout(() => vmTab.close(), 5000);
```

**Promise form (preferred where available):**

```javascript
// @grant GM.openInTab
// Availability: Tampermonkey ✅, Violentmonkey ✅, Greasemonkey 4+ ⚠️ promise, Safari bool-only promise

const handle = await GM.openInTab('https://example.com/', { active: true });
handle.onclose = () => console.log('closed');
```

Portable `GM_closeTab` note: Safari Userscripts exposes `GM.closeTab(tabId?)` with integer `tabId` (not boolean) per [quoid/userscripts README](https://raw.githubusercontent.com/quoid/userscripts/main/README.md) (verified 2026-08-25 — same); elsewhere use the handle `close()`.

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
```

Only script-opened windows are closable and the last tab is always blocked — see [MDN Window.close](https://developer.mozilla.org/en-US/docs/Web/API/Window/close) and [TM window docs](https://www.tampermonkey.net/documentation.php?locale=en&q=window).

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

`window.focus()` may fail due to user settings or missing transient activation — see [MDN Window.focus](https://developer.mozilla.org/en-US/docs/Web/API/Window/focus) and [TM window docs](https://www.tampermonkey.net/documentation.php?locale=en&q=window).

---

## URL Change Detection

### window.onurlchange — Tampermonkey-ONLY

> **Tampermonkey-ONLY (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?locale=en&q=window).** Violentmonkey declined this API (issue #1195); Greasemonkey 4+ and Safari "Userscripts" do not implement it (no page at https://wiki.greasespot.net/GM.closeTab / no VM entry at https://violentmonkey.github.io/api/gm/). Do not feature-test for `onurlchange` as a portable success path — use the portable fallback below.

When `window.onurlchange` is supported, Tampermonkey exposes it as `null` until granted (`// @grant window.onurlchange` required), then fires a `urlchange` event with `info.url` (the new URL) (verified 2026-08-25 — https://www.tampermonkey.net/documentation.php?locale=en&q=window). Example collapsed into the comprehensive handler below — keep `if (window.onurlchange === null)` detection as the Tampermonkey-ONLY path.

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

> **Remote flag & alternatives (verified 2026-08-24):** `GM_addValueChangeListener` fires in every tab including the writer — `remote` is `true` only in tabs *other* than the writer (`false` in the sender), so guard with `if (remote)` to avoid echo. For same-origin pages, `BroadcastChannel` ([MDN BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel)) is a standardized alternative that does not persist storage and avoids quota limits; `GM_setValue` broadcast persists and is subject to storage quotas.

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

Portable promise surface is authoritative in [api-async.md](api-async.md). Minimal tab example:

```javascript
// @grant GM.getTab
// @grant GM.saveTab
// @grant GM.getTabs
// Availability: Tampermonkey ✅; Safari Userscripts ✅ GM.getTab/GM.saveTab promise (no GM.getTabs; deprecation planned v5→v6 per quoid/userscripts#667); Violentmonkey ❌ not implemented; Greasemonkey 4+ ❌ not implemented

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
