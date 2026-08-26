# Cookie API Reference

Documentation for browser cookie manipulation functions.

> **Support banner — GM_cookie is Tampermonkey (stable) & Violentmonkey (since 2.35.1) only. Greasemonkey 4+ and Safari "Userscripts" app: not supported — use `document.cookie` fallback.** (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_cookie; violentmonkey.github.io/api/gm#gm_cookie @since VM2.35.1; wiki.greasespot.net/Greasemonkey_Manual:API — no GM_cookie entry as of 2026-08-09; Safari Userscripts app: UNVERIFIED 2026-08-25 — no primary source in listed set) See `managers.md` §2 Browser/OS integration → Cookies row and `browser-compatibility.md` for the broader compatibility matrix. **Tampermonkey enforces `@match`/`@include` host access for target URLs** — a script can only list/set/delete cookies for hosts its metadata grants access to (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_cookie: "Tampermonkey checks if the script has @include or @match access to given details.url arguments!").

---

## Overview

The `GM_cookie` / `GM.cookie` API allows userscripts where supported to list, set, and delete cookies with full attribute control.

**Required grant:**

```javascript
// @grant GM_cookie   // sync callback form
// @grant GM.cookie   // promise form (Tampermonkey & Violentmonkey expose both)
// Both grants resolve to the same permission; pick the form you call.
```

**Sync-callback vs promise duality:**

| Form | Manager support | Signature |
| --- | --- | --- |
| `GM_cookie.list/set/delete(details[, callback])` | Tampermonkey (stable), Violentmonkey since 2.35.1 — callback style | `callback(result, error)` or `callback(error)` for set/delete |
| `GM.cookie.list/set/delete(details)` | Same managers — promise style | `await GM.cookie.list(details)` → `Promise<Cookie[]>` |

Greasemonkey 4+ and Safari do not implement either form — guard with `typeof GM_cookie !== 'undefined'` or `typeof GM?.cookie !== 'undefined'` and fall back to `document.cookie` (verified 2026-08-25 — GM4 absence: wiki.greasespot.net/Greasemonkey_Manual:API lists GM_info/GM_getValue etc. with no GM_cookie as of 2026-08-09; VM/TM support above).

---

## GM_cookie.list(details[, callback])

Retrieve cookies matching specified criteria.

### Decision table — filters

| Need | Filter to use | Notes |
| --- | --- | --- |
| Scope to host/domain | `domain` or `url` | `url` requires a full URL (`https://example.com/path`); `domain` matches domain scope (`.example.com` includes subdomains). Tampermonkey checks `@match`/`@include` for the target. |
| Filter by name/path | `name`, `path` | Exact match. |
| CHIPS partitioned cookies | `partitionKey: { topLevelSite: 'https://...' }` | **Tampermonkey 5.2+ (Chrome CHIPS) only**; Violentmonkey ignores this key. Empty `partitionKey: {}` lists all partitions where supported. |

### Basic Usage

```javascript
// @grant GM_cookie

// Callback form
GM_cookie.list({}, function(cookies, error) {
    if (error) return console.error('Error:', error);
    console.log('Cookies:', cookies);
});

// Promise form
const cookies = await GM.cookie.list({});

// Filter examples
await GM.cookie.list({ domain: 'example.com' });
await GM.cookie.list({ name: 'sessionId' });
await GM.cookie.list({ url: 'https://example.com/page' });
await GM.cookie.list({ partitionKey: { topLevelSite: 'https://example.com' } }); // Tampermonkey 5.2+ only
```

> **Error handling (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_cookie shows promise example `await GM.cookie.list()`; callback no-arg hang: UNVERIFIED 2026-08-25 — primary set listed above does not document issue #2244; sameSite hang: UNVERIFIED 2026-08-25 — primary TM/VM docs do not enumerate invalid-sameSite behaviour):** `GM_cookie.list({})` resolves, but `GM_cookie.list()` with no argument never resolves — always pass an object, even if empty (Tampermonkey issue #2244 — UNVERIFIED via listed primaries). `GM_cookie.set` with an invalid `sameSite` hangs or rejects with an error string; validate against `"strict"|"lax"|"no_restriction"|"unspecified"` (valid values per extension cookies.SameSiteStatus — MDN cookies.SameSiteStatus) and always handle the `error` callback / rejection.

### Cookie Object Properties

Each element returned by `list` has:

| Property | Type | Manager support | Description |
| --- | --- | --- | --- |
| `name` | string | Tampermonkey, Violentmonkey | Cookie name |
| `value` | string | Tampermonkey, Violentmonkey | Cookie value |
| `domain` | string | Tampermonkey, Violentmonkey | Domain (e.g., `".example.com"`) |
| `path` | string | Tampermonkey, Violentmonkey | Path (e.g., `"/"`) |
| `secure` | boolean | Tampermonkey, Violentmonkey | HTTPS only |
| `httpOnly` | boolean | Tampermonkey, Violentmonkey | Not accessible via `document.cookie`; gated — see Set section |
| `sameSite` | `"strict"` \| `"lax"` \| `"no_restriction"` \| `"unspecified"` | Tampermonkey, Violentmonkey | SameSite attribute (MDN `cookies.SameSiteStatus` — there is no `"none"`; `no_restriction` requires `secure: true`) |
| `session` | boolean | Tampermonkey, Violentmonkey | `true` if session cookie (no `expirationDate`) |
| `expirationDate` | number | Tampermonkey, Violentmonkey | Unix timestamp **in seconds since epoch** (not ms) |
| `hostOnly` | boolean | Tampermonkey, Violentmonkey | Exact domain match only |
| `firstPartyDomain` | string | **Firefox-specific** (Tampermonkey/Violentmonkey on Firefox) | First-party isolation; absent on Chrome/Edge |
| `partitionKey` | `{ topLevelSite: string }` | **Tampermonkey 5.2+ only** | CHIPS partitioned key; Violentmonkey ignores / does not populate |

---

## GM_cookie.set(details[, callback])

Create or update a cookie.

### Basic Usage

```javascript
// @grant GM_cookie

// Callback form
GM_cookie.set({ name: 'myCookie', value: 'myValue' }, function(error) {
    if (error) console.error('Failed to set cookie:', error);
});

// Promise form
await GM.cookie.set({ name: 'myCookie', value: 'myValue' });
```

### Full Options

```javascript
GM_cookie.set({
    // Required
    name: 'sessionToken',
    value: 'abc123xyz',

    // Optional — domain and path (or url)
    url: 'https://example.com',           // checked against @match/@include in Tampermonkey
    domain: '.example.com',
    path: '/',

    // Optional — security
    secure: true,
    httpOnly: true,                       // gated — see note below
    sameSite: 'strict',                   // "strict" | "lax" | "no_restriction" | "unspecified" — no "none" (no_restriction requires secure: true)

    // Optional — expiry (seconds since epoch — both managers)
    expirationDate: Math.floor(Date.now() / 1000) + 86400,  // 24 hours

    // Optional — partitioning — Tampermonkey 5.2+ only (Chrome CHIPS)
    partitionKey: { topLevelSite: 'https://example.com' },

    // Optional — first-party isolation — Firefox-specific
    firstPartyDomain: 'example.com'
}, callback);

// Promise form — same details, no callback
await GM.cookie.set({ name: 'x', value: 'y', url: 'https://example.com/' });
```

> **httpOnly — gated in BOTH managers (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_cookie still states "httpOnly cookies are supported at the BETA versions of Tampermonkey only for now" in 5.3.1 docs; violentmonkey.github.io/api/gm#gm_cookie: "httpOnly cookies are listed/allowed only when the HTTP-only option is enabled for the script and globally in the extension"):**
> - **Tampermonkey:** primary docs still mark httpOnly as BETA-only as of 2026-08-25; Advanced → Security toggle location claimed since stable 5.3.1+ is UNVERIFIED (2026-08-25) — not enumerated in listed primary TM API page.
> - **Violentmonkey:** needs **BOTH** the global httpOnly toggle **and** the per-script toggle enabled (verified 2026-08-25 — violentmonkey.github.io/api/gm#gm_cookie).
> - Without these toggles, `httpOnly: true` is ignored or errors. `managers.md` §2 Cookies row is the source of truth.

> **expirationDate — both managers use seconds since epoch** (not milliseconds). Compute with `Math.floor(Date.now() / 1000) + seconds` or `new Date('2025-12-31').getTime() / 1000`. Omit `expirationDate` for a session cookie (`session: true`).

---

## GM_cookie.delete(details[, callback])

Remove a cookie. **Callback is optional** — `[, callback]` — consistent with `list` and `set`.

### Basic Usage

```javascript
// @grant GM_cookie

// Callback form — callback is optional
GM_cookie.delete({ name: 'myCookie', url: 'https://example.com/' }, function(error) {
    if (error) console.error('Failed to delete:', error);
});

// Without callback
GM_cookie.delete({ name: 'myCookie', url: 'https://example.com/' });

// Promise form
await GM.cookie.delete({ name: 'myCookie', url: 'https://example.com/' });
```

### Delete Options

| Property | Required | Notes |
| --- | --- | --- |
| `name` | Yes | Cookie name |
| `url` | Recommended | URL associated with the cookie — **preferred identifier** (checked against `@match`/`@include` in Tampermonkey) |
| `firstPartyDomain` | No | Firefox-specific |
| `partitionKey` | No | **Tampermonkey 5.2+ only** (Chrome CHIPS); Violentmonkey ignores |

```javascript
// Preferred: url + name
GM_cookie.delete({ name: 'sessionToken', url: 'https://example.com/' }, callback);

// Partitioned — Tampermonkey 5.2+ only
GM_cookie.delete({ name: 'sessionToken', url: 'https://example.com/', partitionKey: { topLevelSite: 'https://example.com' } }, callback);

// Firefox first-party isolation
GM_cookie.delete({ name: 'sessionToken', url: 'https://example.com/', firstPartyDomain: 'example.com' }, callback);
```

> **Note:** `domain` is **not** a valid delete identifier — use `url` + `name`.

> **Delete URL scope (verified 2026-08-25 — MDN `cookies.remove` / RFC 6265bis §5.1.4; tampermonkey.net/documentation.php?q=GM_cookie delete details require `url`+`name`):** `url` must match the cookie's scope (scheme + host + effective path). If the path/domain used at `set` was `/admin`, `GM_cookie.delete({ name, url: 'https://example.com/' })` will silently fail to match — use the same path/domain scope via `url` (e.g., `https://example.com/admin/`). If no match is found the promise fulfills with `null` / callback receives no error.

---

## Portable Patterns

### Feature-detection and fallback for unsupported managers

GM_cookie is TM + VM only. Gate every call and degrade to `document.cookie` on GM4+/Safari:

```javascript
// Feature-detect — prefer capability check over handler sniffing
const canUseGMCookie = typeof GM_cookie !== 'undefined' || typeof GM?.cookie !== 'undefined';

async function getCookieValue(name, domain) {
    if (typeof GM_cookie !== 'undefined') {
        return new Promise((resolve, reject) => {
            GM_cookie.list({ name, domain }, (cookies, error) => {
                if (error) return reject(error);
                resolve(cookies[0]?.value ?? null);
            });
        });
    }
    if (typeof GM?.cookie?.list === 'function') {
        const cookies = await GM.cookie.list({ name, domain });
        return cookies[0]?.value ?? null;
    }
    // Greasemonkey 4+ / Safari — use document.cookie (cannot read httpOnly)
    const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([$?*|{}\]\\^])/g, '\\$1') + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
}

function setDocumentCookie(name, value, { days = 7, path = '/', secure = true, sameSite = 'Lax' } = {}) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=${path}; SameSite=${sameSite}${secure && location.protocol === 'https:' ? '; Secure' : ''}`;
}
```

`document.cookie` cannot read `httpOnly` cookies — `GM_cookie` is the only way to touch them where supported (and only when the httpOnly toggles above are enabled). See also `managers.md` §2 Cookies row.

---

## Platform Limits & HTTP Semantics (verified 2026-08-25)

Condensed portability-relevant limits — full tutorial belongs to MDN `Set-Cookie` / `Using HTTP cookies` / RFC 6265bis. Re-verify exact caps before relying (verified 2026-08-25 — MDN Set-Cookie HttpOnly/SameSite/Partitioned/Secure; MDN Document.cookie).

| Concern | Portable rule |
| --- | --- |
| Size & count limits (verified 2026-08-25 — MDN Set-Cookie / RFC 6265bis §5.6, §6.1) | Per-cookie name+value ≤ 4096 octets; longer `set-cookie-string` ignored (RFC 6265bis §5.6 step 5). Whole `Set-Cookie` line ~4 KB (MDN "usually 4KB"). Per-domain ≥ 50, total ≥ 3000 per RFC 6265bis §6.1; browsers MAY evict any cookie. Keep cookies small — `list` may return fewer if evicted. `Cookie` header commonly capped ~8192 octets. |
| Lifetime cap — 400 days (verified 2026-08-25 — RFC 6265bis §5.5; MDN Set-Cookie Expires/Max-Age) | `expirationDate` beyond **400 days (34560000 s)** is clamped to 400 days (Chrome/Firefox/Safari since 2022+ per RFC 6265bis §5.5). Do not set farther future — will be silently capped. File's 30-day example is within cap. |
| SameSite defaults & Secure pairing (verified 2026-08-25 — MDN Set-Cookie SameSite/Secure) | Omitted `sameSite` → browsers default `Lax` (top-level GET only). `sameSite: 'no_restriction'` (≡ `SameSite=None`) **requires** `secure: true` or rejected. There is no `"none"` — use `"no_restriction"` (invalid `"none"` hangs per TM #2070 — UNVERIFIED 2026-08-25). |
| Partitioned (CHIPS) cookies (verified 2026-08-25 — MDN Set-Cookie Partitioned/Secure; tampermonkey.net/documentation.php?q=GM_cookie partitionKey v5.2+) | `partitionKey` requires `Secure` (and `SameSite=None`). TM 5.2+ only; VM ignores. Use `__Host-` + `Path=/` + no `Domain` for host-only partitions. |
| Cookie name prefixes (`__Secure-` / `__Host-`) (verified 2026-08-25 — MDN Set-Cookie Cookie prefixes; RFC 6265bis §4.1.3) | `__Secure-` requires `Secure` on HTTPS; `__Host-` requires `Secure` + `Path=/` + no `Domain` (host-only). Unsupported browsers ignore prefixes — do not rely on them as sole security. |
| Max-Age vs Expires precedence & session definition (verified 2026-08-25 — MDN Set-Cookie Max-Age/Expires; MDN Using HTTP cookies) | `GM_cookie` exposes only `expirationDate` (seconds since epoch, maps to Max-Age/Expires; `Math.floor(Date.now()/1000)` formula correct per tampermonkey.net/documentation.php?q=GM_cookie). Omit `expirationDate` → session cookie (`session: true`), but session-restore may resurrect it. |
| Path default & matching (verified 2026-08-25 — MDN Set-Cookie Path) | Omitted `Path` defaults to request URL's directory (e.g., `/docs/Web/HTTP/` for `/docs/Web/HTTP/index.html`). `Path=/` covers all paths; not a security boundary. |
| Domain default — host-only vs Domain attribute (verified 2026-08-25 — MDN Set-Cookie Domain) | No `Domain` → host-only (`hostOnly: true`, exact host, not subdomains). `Domain=.example.com` → host + subdomains (leading dot ignored). Reflected in `hostOnly`; affects `delete` URL scope. |
| Document.cookie / Cookie Store API visibility vs GM_cookie (verified 2026-08-25 — MDN Document.cookie; MDN Set-Cookie HttpOnly/Secure; MDN Cookie Store API) | `document.cookie` cannot read `httpOnly` cookies; `Secure` cookies readable if not `httpOnly`. Cookie Store API (`cookieStore.get/set`) is modern async alternative but not `GM_cookie` replacement — only `GM_cookie` touches `httpOnly` where toggles allow. |
| Underlying `storeId` (Firefox containers) — not via GM_cookie (verified 2026-08-25 — MDN cookies.Cookie storeId) | `storeId` not exposed via `GM_cookie` — operates in default store only. Intentionally omitted from property table. |
| Privacy: third-party phase-out & partitioned migration (verified 2026-08-25 — MDN Third-party cookies / Partitioned cookies; RFC 6265bis §7.1) | Browsers increasingly block unpartitioned third-party cookies; prefer `Partitioned` (CHIPS) for embedded third-party contexts. `GM_cookie` surface is `partitionKey` (TM 5.2+). |

Cross-reference: `managers.md` §2 Cookies row (authoritative per-manager matrix), `browser-compatibility.md`, MDN `Set-Cookie`.

---

## Security Considerations

1. **Access control**: Tampermonkey checks `@match`/`@include` host access for the target `url`/`domain`; Violentmonkey derives from `@match`/`@include` (not `@connect`). See `managers.md` §2. (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_cookie: `@include`/`@match` access check)
2. **httpOnly**: Gated in **both** managers — see Set section / `managers.md` §2 Cookies row. Most session cookies are `httpOnly`; without the toggles you cannot read/set them.
3. **Secure / SameSite / Domain**: Set `secure: true` for sensitive cookies; use `sameSite: 'strict'`/`'lax'` to mitigate CSRF; `.example.com` scope includes all subdomains — restrict narrowly.

