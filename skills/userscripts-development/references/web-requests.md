# Web Request Interception API Reference

Documentation for `GM_webRequest` — intercept and modify browser requests before they are made. This API is **Tampermonkey-experimental only**; portability is limited — see the manager × browser matrix below. Source of truth for support: [managers.md](managers.md).

---

## Overview

`GM_webRequest` allows userscripts to intercept, block, or redirect web requests before they are sent. Portable scripts must treat it as an optional enhancement — the primary portable pattern is page-level patching (see Cross-manager alternatives).

**Manager × browser matrix:**

| Manager + browser | `GM_webRequest` support | Notes |
| --- | --- | --- |
| Tampermonkey + Firefox MV2 | ✅ experimental | Requires `@grant GM_webRequest` + `@webRequest` header; may change at any time |
| Tampermonkey + Chrome/Edge MV3 | ❌ broken | Broken since Tampermonkey 5.2+ — see Tampermonkey issue #2209 |
| Violentmonkey (any browser) | ❌ wontfix | Declined — see Violentmonkey issue #583; `typeof GM_webRequest === 'undefined'` always |
| Greasemonkey 4+ | ❌ absent | No implementation |
| Safari Userscripts | ❌ absent | No implementation |

Request types the Tampermonkey implementation can intercept (when available): `sub_frame`, `script`, `xhr`, `websocket`. It cannot intercept `main_frame` (top document), images, stylesheets, or fonts. Details under Limitations (Tampermonkey Firefox MV2 only).

---

## Required Setup

```javascript
// @grant GM_webRequest
// Tampermonkey-only grant — verify availability before use (see Best Practices)
```

---

## Basic Usage — Tampermonkey syntax

All snippets in this section use **Tampermonkey syntax** — they have no effect in Violentmonkey, Greasemonkey, or Safari (the symbol is never defined there).

```javascript
// Tampermonkey on Firefox MV2 only
GM_webRequest([
    // Cancel requests to ads
    {
        selector: '*://ads.example.com/*',
        action: 'cancel'
    },

    // Redirect tracking URLs
    {
        selector: '*://tracker.example.com/*',
        action: {
            redirect: 'https://example.com/blocked'
        }
    },

    // Pattern-based redirect
    {
        selector: { match: '*://old.example.com/*' },
        action: {
            redirect: {
                from: '([^:]+)://old.example.com/(.*)',
                to: '$1://new.example.com/$2'
            }
        }
    },

    // Exclude certain paths
    {
        selector: {
            include: '*://example.com/*',
            exclude: '*://example.com/api/*'
        },
        action: 'cancel'
    }
], function(info, message, details) {
    console.log('Action:', info);        // 'cancel' or 'redirect'
    console.log('Message:', message);    // 'ok' or 'error'
    console.log('URL:', details.url);
    console.log('Redirect URL:', details.redirect_url);
});
```

---

## Rule Properties — Tampermonkey syntax

### Selector — Tampermonkey syntax

Defines which URLs the rule matches (Tampermonkey DSL).

| Property | Type | Description |
|----------|------|-------------|
| `selector` | string | Simple URL pattern |
| `selector.include` | string/array | URLs to include |
| `selector.match` | string/array | Match patterns |
| `selector.exclude` | string/array | URLs to exclude |

```javascript
// Tampermonkey syntax — string selector (simplest)
{ selector: '*://ads.example.com/*' }

// Tampermonkey syntax — object selector with include/exclude
{
    selector: {
        include: '*://example.com/*',
        exclude: '*://example.com/api/*'
    }
}

// Tampermonkey syntax — array of patterns
{
    selector: {
        include: ['*://ads1.com/*', '*://ads2.com/*'],
        match: '*://tracker.com/*'
    }
}
```

### Action — Tampermonkey syntax

Defines what to do when a URL matches (Tampermonkey DSL).

| Property | Type | Description |
|----------|------|-------------|
| `action` | string | `'cancel'` to block |
| `action.cancel` | boolean | Block the request |
| `action.redirect` | string/object | Redirect destination |

```javascript
// Tampermonkey syntax — cancel (block) the request
{ action: 'cancel' }
{ action: { cancel: true } }

// Tampermonkey syntax — redirect to static URL
{ action: { redirect: 'https://example.com/blocked' } }

// Tampermonkey syntax — redirect with pattern replacement
{
    action: {
        redirect: {
            from: '([^:]+)://old.com/(.*)',
            to: '$1://new.com/$2'
        }
    }
}
```

---

## @webRequest Header — Tampermonkey syntax

Define rules at script level (applies before script loads). Tampermonkey-only.

```javascript
// @webRequest {"selector": "*://ads.example.com/*", "action": "cancel"}
// @webRequest {"selector": {"include": "*tracking*"}, "action": {"redirect": "about:blank"}}
```

This is useful for blocking resources that load before your script runs — only where supported (Tampermonkey on Firefox MV2).

---

## Listener Callback — Tampermonkey syntax

```javascript
// Tampermonkey-only — listener is invoked per intercepted request
GM_webRequest(rules, function(info, message, details) {
    // info: 'cancel' or 'redirect'
    // message: 'ok' or 'error'
    // details: {
    //     rule: <the triggered rule>,
    //     url: <request URL>,
    //     redirect_url: <where redirected>,
    //     description: <error description if any>
    // }
});
```

---

## Common Use Cases — Tampermonkey syntax

All examples below require Tampermonkey on Firefox MV2. For portable equivalents, see Cross-manager alternatives.

### Block Ads

```javascript
// Tampermonkey-only
GM_webRequest([
    { selector: '*://ads.example.com/*', action: 'cancel' },
    { selector: '*://tracking.example.com/*', action: 'cancel' },
    { selector: '*://analytics.example.com/*', action: 'cancel' }
]);
```

### Redirect Old URLs

```javascript
// Tampermonkey-only
GM_webRequest([
    {
        selector: { match: '*://old-domain.com/*' },
        action: {
            redirect: {
                from: '([^:]+)://old-domain.com/(.*)',
                to: '$1://new-domain.com/$2'
            }
        }
    }
]);
```

### Block Specific Resource Types

```javascript
// Tampermonkey-only — block scripts from untrusted domains
GM_webRequest([
    {
        selector: {
            include: '*://*.untrusted.com/*.js'
        },
        action: 'cancel'
    }
]);
```

### Redirect to Local Resources

```javascript
// Tampermonkey-only
GM_webRequest([
    {
        selector: 'https://cdn.example.com/library.js',
        action: {
            redirect: 'https://my-cdn.com/modified-library.js'
        }
    }
]);
```

---

## Limitations — Tampermonkey Firefox MV2 only

The browser-limitations content below is framed for the **Tampermonkey implementation on Firefox MV2** — other managers have no implementation at all (see matrix above).

### Browser Support (Tampermonkey implementation)

| Browser (Tampermonkey build) | `GM_webRequest` Support |
|---------|----------------------|
| Firefox (MV2) | ✅ Supported (experimental) |
| Chrome (MV3, Tampermonkey 5.2+) | ❌ Not available — broken (issue #2209) |
| Edge (MV3, Tampermonkey 5.2+) | ❌ Not available — broken (issue #2209) |
| Safari (Tampermonkey paid app) | ❌ Not available |

Violentmonkey, Greasemonkey, and Safari Userscripts are absent everywhere — do not feature-detect them as "MV3-limited"; they never defined the API.

### Request Types

Only these request types can be intercepted where the API exists:

- `sub_frame` - iframes
- `script` - JavaScript files
- `xhr` - XMLHttpRequest/fetch
- `websocket` - WebSocket connections

These **cannot** be intercepted even where available:

- Main document (`main_frame`)
- Images
- Stylesheets
- Fonts

---

## Cross-Manager Alternatives (required unless Tampermonkey on Firefox MV2)

`GM_webRequest` is not portable. For scripts that must run in Violentmonkey (the worked example), Greasemonkey, Safari, or Tampermonkey on Chromium MV3, use these as the **primary** portable pattern.

**Decision table:**

| Goal | Portable primary | When to use `GM_webRequest` |
| --- | --- | --- |
| Block or redirect a request **before** it loads | Page-level monkey-patch via `unsafeWindow.fetch` / `unsafeWindow.XMLHttpRequest` (weaker — runs at `document-start` and can be raced) | Only Tampermonkey on Firefox MV2 gives a true pre-load network block/redirect |
| Hide or remove content **after** it loads | CSS hiding via `GM_addStyle`/`GM.addStyle` + DOM removal via `MutationObserver` — works in **all** managers | Never needed; portable approach is preferred |

### Page-Level Interception — PRIMARY portable pattern

Works in Tampermonkey and Violentmonkey with `unsafeWindow`; adapt per [managers.md](managers.md). Safari Userscripts has no `unsafeWindow` — design without page-world access or use the CSS/DOM alternatives below.

```javascript
// @grant unsafeWindow
// Violentmonkey worked example — page-context fetch/XHR patch
// Requires @run-at document-start for best coverage; still weaker than GM_webRequest pre-load block

// Intercept fetch
const originalFetch = unsafeWindow.fetch;
unsafeWindow.fetch = function(...args) {
    const url = args[0]?.url || args[0];
    console.log('Intercepted fetch:', url);

    // Block certain URLs
    if (url.includes('tracking.com')) {
        return Promise.reject(new Error('Blocked'));
    }

    return originalFetch.apply(this, args);
};

// Intercept XMLHttpRequest
const originalOpen = unsafeWindow.XMLHttpRequest.prototype.open;
unsafeWindow.XMLHttpRequest.prototype.open = function(method, url) {
    console.log('Intercepted XHR:', method, url);

    // Block certain URLs
    if (url.includes('tracking.com')) {
        throw new Error('Blocked');
    }

    return originalOpen.apply(this, arguments);
};
```

### Remove Elements After Load

Portable — works in all managers:

```javascript
// Remove ad iframes after they load — portable
const observer = new MutationObserver(() => {
    document.querySelectorAll('iframe[src*="ads"]').forEach(el => el.remove());
});
observer.observe(document.body, { childList: true, subtree: true });
```

### Use CSS to Hide — PRIMARY portable pattern for hide-after-load

Portable — works in all managers (use `GM.addStyle` promise form where needed; Greasemonkey/Safari need fallback):

```javascript
// @grant GM_addStyle
// Violentmonkey: GM_addStyle works; Greasemonkey 4+ needs manual style element

GM_addStyle(`
    iframe[src*="ads"],
    [id*="advertisement"],
    [class*="sponsored"] {
        display: none !important;
    }
`);
```

---

## Best Practices

1. **Be specific with selectors** - Avoid overly broad patterns
2. **Test thoroughly** - Request interception can break sites
3. **Provide fallbacks** - Check if `GM_webRequest` is available (it never exists in Violentmonkey)
4. **Log actions** - Use the listener callback for debugging
5. **Consider portable alternatives first** - Your script may need to work outside Tampermonkey on Firefox MV2

```javascript
// Check if GM_webRequest is available — Violentmonkey never defines it (wontfix #583)
if (typeof GM_webRequest !== 'undefined') {
    GM_webRequest([...rules...]); // Tampermonkey on Firefox MV2 only
} else {
    console.log('GM_webRequest not available, using portable fallback');
    // Use page-level patching / CSS / MutationObserver instead (see above)
}
```
