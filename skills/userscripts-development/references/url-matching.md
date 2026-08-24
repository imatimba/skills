# URL Matching Patterns

Complete guide to @match, @include, and @exclude patterns. For per-manager header support see [managers.md](managers.md) §3.

> **@match base = Chrome match patterns everywhere; Violentmonkey ≥2.10.4 adds a documented superset** (`.tld` and extra host-position wildcards inside `@match`). `@include` globs cover TLDs in all managers. See table below.

---

## @match (Recommended)

The modern, safer way to specify where scripts run.

### Pattern Format

```
<scheme>://<host><path>
```

| Component | Description | Wildcards |
|-----------|-------------|-----------|
| `scheme` | Protocol (http, https, *) | `*` matches http or https |
| `host` | Domain name | See host-wildcard table below |
| `path` | URL path | `*` matches any characters |

### Common Patterns

```javascript
// Exact domain
// @match https://example.com/*

// All subdomains
// @match https://*.example.com/*

// Both HTTP and HTTPS
// @match *://example.com/*

// Specific path
// @match https://example.com/app/*

// Any page on any HTTPS site (use sparingly!)
// @match https://*/*

// Specific file
// @match https://example.com/page.html
```

### Wildcard Rules — Base Grammar vs Violentmonkey Superset

Chrome match-pattern grammar applies in all managers. Violentmonkey ≥2.10.4 extends it inside `@match`.

| Pattern | Base (Chrome) support | Violentmonkey ≥2.10.4 | Matches | Does NOT Match |
|---------|----------------------|------------------------|---------|----------------|
| `https://example.com/*` | ✅ | ✅ | example.com/page | sub.example.com |
| `https://*.example.com/*` | ✅ (`*` only as leftmost label) | ✅ | sub.example.com | example.com, foo.bar.example.com* |
| `*://example.com/*` | ✅ | ✅ | http://example.com, https://example.com | ftp://example.com |
| `https://example.com/app/*` | ✅ | ✅ | example.com/app/page | example.com/other |
| `https://example.*/*` | ❌ not valid `@match` | ✅ (`.tld` wildcard) | example.com, example.co.uk, example.de | — |
| `https://*.example.*/*` | ❌ | ✅ (two host wildcards) | foo.example.com, bar.example.co.uk | — |
| `https://*example.com/*` | ❌ | ✅ (wildcard not at dot boundary) | example.com, myexample.com | — |

* Base `*.example.com` matches the host plus subdomains at any depth per spec (MDN: `*://*.mozilla.org/*` matches `a.b.mozilla.org`).

**Takeaway:** For maximum portability, stay within base Chrome grammar in `@match` and use `@include` for TLD wildcards (or add explicit `@match` lines per TLD). Use the Violentmonkey superset only when targeting Violentmonkey.

### Special Patterns

```javascript
// Match root domain AND all subdomains — need two lines in base grammar
// @match https://example.com/*
// @match https://*.example.com/*

// Match specific subdomains only
// @match https://www.example.com/*
// @match https://api.example.com/*

// Path with wildcard in middle
// @match https://example.com/user/*/profile

// Violentmonkey ≥2.10.4 superset — TLD wildcard directly in @match (not portable)
// @match https://example.*/*
// @match https://*.example.*/*
```

---

## @include (Legacy)

More flexible but less secure than @match. Supports glob patterns and regex.

### Glob Patterns

```javascript
// Standard glob
// @include https://example.com/*

// Multiple wildcards
// @include *://*.example.com/*

// Match any TLD — Greasemonkey + Violentmonkey via @include glob (Tampermonkey regressed per issue #1818; Safari deprecating @include per quoid#650)
// @include https://example.*/*
// Equivalent Violentmonkey ≥2.10.4 @match: https://example.*/*

// Any subdomain + any TLD — Greasemonkey + Violentmonkey via @include glob (Tampermonkey regressed per issue #1818; Safari deprecating @include per quoid#650)
// @include https://*.example.*/*
// Equivalent Violentmonkey ≥2.10.4 @match: https://*.example.*/*
```

### Regular Expressions

Wrap in forward slashes:

```javascript
// Match URLs containing "example"
// @include /example/

// Match specific pattern
// @include /^https:\/\/www\.example\.com\/page\/\d+$/

// Case-insensitive
// @include /example\.com/i
```

### @include vs @match

| Feature | @match | @include |
|---------|--------|----------|
| Security | Stricter | More permissive |
| Regex support | No | Yes (wrapped in `/.../`; quoid/userscripts plans to deprecate `@include`/`@exclude` entirely per issue #650 — prefer `@match` + runtime test) |
| TLD wildcards | Base: No — only Violentmonkey ≥2.10.4 superset (`example.*`) | Yes — `example.*` in Greasemonkey + Violentmonkey (Tampermonkey regressed per issue #1818; Safari deprecating @include entirely per quoid#650) |
| Extra host wildcards (`*.example.*`, `*example.com`) | Base: No — Violentmonkey ≥2.10.4 only | Yes via glob in all managers |
| Recommended | Yes | Legacy |

---

## @exclude

Exclude URLs even if they match @match or @include.

```javascript
// Run on example.com except admin pages
// @match https://example.com/*
// @exclude https://example.com/admin/*
// @exclude https://example.com/api/*

// Exclude with regex
// @exclude /example\.com\/private/

// Exclude specific file
// @exclude https://example.com/login.html
```

### Precedence

1. @exclude is checked first
2. If URL matches @exclude, script doesn't run
3. Otherwise, @match/@include is checked

---

## Common Use Cases

### Single Website

```javascript
// All pages on example.com
// @match https://example.com/*
// @match https://www.example.com/*
```

### Multiple Related Sites

```javascript
// Company's multiple domains — explicit per TLD for portability
// @match https://example.com/*
// @match https://example.co.uk/*
// @match https://example.de/*
// Portable alternative: one @include glob
// @include https://example.*/*
```

### SaaS Application

```javascript
// Customer subdomains
// @match https://*.example.com/*
// @exclude https://api.example.com/*
// @exclude https://static.example.com/*
```

### Social Media Platform

```javascript
// Multiple sections
// @match https://twitter.com/*
// @match https://x.com/*
// @match https://mobile.twitter.com/*
```

### Development & Production

```javascript
// Both environments
// @match https://example.com/*
// @match https://staging.example.com/*
// @match http://localhost:3000/*
// @match http://127.0.0.1:3000/*
```

---

## Testing Patterns

### Verify in Browser

1. Navigate to target page
2. Check if your userscript manager's icon shows the script count
3. Click the icon → see which scripts matched

### Debug Patterns

```javascript
// Add to script to verify matching
console.log('Script matched URL:', location.href);
console.log('Host:', location.host);
console.log('Path:', location.pathname);
```

### Pattern Tester

Test if a URL matches your pattern:

```javascript
// Manual test
const patterns = [
    'https://example.com/*',
    'https://*.example.com/*'
];

const testUrl = 'https://sub.example.com/page';

// Note: This is simplified - actual matching is more complex
patterns.forEach(pattern => {
    const regex = pattern
        .replace(/\*/g, '.*')
        .replace(/\//g, '\\/');
    const matches = new RegExp(`^${regex}$`).test(testUrl);
    console.log(`${pattern}: ${matches}`);
});
```

---

## Common Mistakes

### Mistake 1: Missing www

```javascript
// WRONG - misses www subdomain
// @match https://example.com/*

// RIGHT - include both
// @match https://example.com/*
// @match https://www.example.com/*

// OR use subdomain wildcard (but matches ALL subdomains)
// @match https://*.example.com/*
```

### Mistake 2: HTTP vs HTTPS

```javascript
// WRONG - only matches HTTPS
// @match https://example.com/*

// RIGHT - if site uses both
// @match *://example.com/*
```

### Mistake 3: Trailing Slash

```javascript
// These are different!
// @match https://example.com/    // Only root page
// @match https://example.com/*   // All pages
```

### Mistake 4: Too Broad

`*://*/*` matches only `http`/`https`/`ws` URLs — `<all_urls>` is the pattern covering all supported schemes. Either is overly broad (security risk, performance hit):

```javascript
// WRONG - runs on every http/https/ws site (<all_urls> covers all supported schemes)
// @match *://*/*

// RIGHT - be specific
// @match https://example.com/*
```

### Mistake 5: Query Parameters

Base match-pattern spec matches the URL path **plus** the query string (MDN: path matched against "URL path plus the URL query string... includes the `?`"); fragments (`#`) are ignored. Violentmonkey diverges — it ignores query + hash entirely when matching `@match`/`@include` globs. Use a runtime check or regex `@include` where supported if you need query-aware gating.

```javascript
// Base spec: path includes query string, so this CAN match https://example.com/page?id=123
// Violentmonkey diverges — it ignores query+hash, so test per manager
// @match https://example.com/page?*

// Workaround — regex in @include (supported in Tampermonkey, Violentmonkey, Greasemonkey 4+)
// quoid/userscripts plans to deprecate @include/@exclude entirely (issue #650) — prefer @match + runtime URL check for Safari
// @include /^https:\/\/example\.com\/page\?/
// Runtime fallback (portable):
if (!location.href.includes('?id=')) return;
```

---

## URL Fragment Handling

`@match` ignores URL fragments (`#hash`):

```javascript
// @match https://example.com/*

// Matches all of these:
// https://example.com/page
// https://example.com/page#section1
// https://example.com/page#section2
```

For SPA hash/History navigation, do NOT rely on a manager event beyond Tampermonkey. The portable fallback is patching `history.pushState`/`replaceState` plus `popstate`/`hashchange` (see [managers.md](managers.md) §2 and [patterns.md](patterns.md)).

```javascript
// Tampermonkey-only — window.onurlchange (requires @grant window.onurlchange, Tampermonkey only)
// Violentmonkey declined this API (issue #1195); Greasemonkey 4+ and Safari also do not implement it
// Portable code must feature-detect and fall back to history patching

// @grant window.onurlchange  // Tampermonkey only

if (typeof window.onurlchange !== 'undefined' && window.onurlchange === null) {
    window.addEventListener('urlchange', (info) => {
        console.log('URL changed (Tampermonkey):', info.url);
    });
}

// Portable fallback — works in all managers
let lastUrl = location.href;
function handleUrlChange() {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        console.log('URL changed:', lastUrl);
        onPageChange();
    }
}
const _pushState = history.pushState;
const _replaceState = history.replaceState;
history.pushState = function (...args) { const r = _pushState.apply(this, args); handleUrlChange(); return r; };
history.replaceState = function (...args) { const r = _replaceState.apply(this, args); handleUrlChange(); return r; };
window.addEventListener('popstate', handleUrlChange);
window.addEventListener('hashchange', handleUrlChange);
```

---

## Performance Considerations

> **Heuristic, not a measured guarantee** — manager matching cost depends on engine, pattern count, and regex complexity. Treat the guidance below as ordering hints; benchmark if you target hundreds of patterns.

More URL patterns introduce more matching work at navigation time (heuristic):

```javascript
// Heuristic: many separate patterns introduce more matching overhead
// @match https://site1.com/*
// @match https://site2.com/*
// ... 98 more ...

// Heuristic: fewer broad patterns or a single regex @include may reduce match cost
// @match https://*.example.com/*

// Or use @include with regex for complex patterns (heuristic: one regex may be cheaper than many @match)
// @include /^https:\/\/(site1|site2|site3)\.com/
```

If you need to cover many hosts, prefer wildcards or a single `@include` regex over dozens of individual `@match` lines — but verify per manager, as quoid/userscripts plans to deprecate `@include`/`@exclude` entirely (issue #650).
