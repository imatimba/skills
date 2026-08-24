# Cookie API Reference

Documentation for browser cookie manipulation functions.

> **Support banner — GM_cookie is Tampermonkey (stable) & Violentmonkey (since 2.35.1) only. Greasemonkey 4+ and Safari "Userscripts" app: not supported — use `document.cookie` fallback.** See `managers.md` §2 Browser/OS integration → Cookies row and `browser-compatibility.md` for the broader compatibility matrix. **Tampermonkey enforces `@match`/`@include` host access for target URLs** — a script can only list/set/delete cookies for hosts its metadata grants access to.

---

## Overview

The `GM_cookie` / `GM.cookie` API allows userscripts where supported to:
- List cookies from any granted domain
- Set cookies with full control over attributes
- Delete cookies

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

Greasemonkey 4+ and Safari do not implement either form — guard with `typeof GM_cookie !== 'undefined'` or `typeof GM?.cookie !== 'undefined'` and fall back to `document.cookie`.

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

// List all cookies for current domain — callback form
GM_cookie.list({}, function(cookies, error) {
    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log('Cookies:', cookies);
});

// Promise form
const cookies = await GM.cookie.list({});
```

### Filter Options

```javascript
// By domain
GM_cookie.list({ domain: 'example.com' }, callback);
await GM.cookie.list({ domain: 'example.com' });

// By name
GM_cookie.list({ name: 'sessionId' }, callback);

// By path
GM_cookie.list({ path: '/app' }, callback);

// By URL
GM_cookie.list({ url: 'https://example.com/page' }, callback);

// Partitioned cookies — Tampermonkey 5.2+ only (Chrome CHIPS); Violentmonkey ignores
GM_cookie.list({
    partitionKey: { topLevelSite: 'https://example.com' }
}, callback);

// All partitions (empty object) — Tampermonkey 5.2+ only
GM_cookie.list({ partitionKey: {} }, callback);
```

> **Error handling (verified 2026-08-24):** `GM_cookie.list({})` resolves, but `GM_cookie.list()` with no argument never resolves — always pass an object, even if empty (Tampermonkey issue #2244). `GM_cookie.set` with an invalid `sameSite` hangs or rejects with an error string; validate against `"strict"|"lax"|"no_restriction"|"unspecified"` and always handle the `error` callback / rejection.

### Cookie Object Properties

Each element returned by `list` has:

| Property | Type | Manager support | Description |
| --- | --- | --- | --- |
| `name` | string | Tampermonkey, Violentmonkey | Cookie name |
| `value` | string | Tampermonkey, Violentmonkey | Cookie value |
| `domain` | string | Tampermonkey, Violentmonkey | Domain (e.g., `".example.com"`) |
| `path` | string | Tampermonkey, Violentmonkey | Path (e.g., `"/"`) |
| `secure` | boolean | Tampermonkey, Violentmonkey | HTTPS only |
| `httpOnly` | boolean | Tampermonkey, Violentmonkey | Not accessible via `document.cookie`; httpOnly handling is gated (Tampermonkey: Advanced → Security toggle since stable 5.3.1+; Violentmonkey: global + per-script toggles — see Set section) |
| `sameSite` | `"strict"` \| `"lax"` \| `"no_restriction"` \| `"unspecified"` | Tampermonkey, Violentmonkey | SameSite attribute (MDN `cookies.SameSiteStatus` — there is no `"none"`; Tampermonkey issues #2070/#465: using `"none"` hangs/message-port-closed; `no_restriction` requires `secure: true`) |
| `session` | boolean | Tampermonkey, Violentmonkey | `true` if session cookie (no `expirationDate`) |
| `expirationDate` | number | Tampermonkey, Violentmonkey | Unix timestamp **in seconds since epoch** (not ms) |
| `hostOnly` | boolean | Tampermonkey, Violentmonkey | Exact domain match only |
| `firstPartyDomain` | string | **Firefox-specific** (Tampermonkey/Violentmonkey on Firefox) | First-party isolation; absent on Chrome/Edge |
| `partitionKey` | `{ topLevelSite: string }` | **Tampermonkey 5.2+ only** | CHIPS partitioned key; Violentmonkey ignores / does not populate |

```javascript
GM_cookie.list({}, (cookies, error) => {
    cookies.forEach(cookie => {
        console.log(cookie.name);
        console.log(cookie.value);
        console.log(cookie.domain);
        console.log(cookie.path);
        console.log(cookie.secure);
        console.log(cookie.httpOnly);
        console.log(cookie.sameSite);
        console.log(cookie.session);
        console.log(cookie.expirationDate); // seconds since epoch
        console.log(cookie.hostOnly);
        console.log(cookie.firstPartyDomain); // Firefox only
        console.log(cookie.partitionKey);     // Tampermonkey 5.2+ only
    });
});
```

---

## GM_cookie.set(details[, callback])

Create or update a cookie.

### Basic Usage

```javascript
// @grant GM_cookie

// Simple cookie — callback form
GM_cookie.set({
    name: 'myCookie',
    value: 'myValue'
}, function(error) {
    if (error) {
        console.error('Failed to set cookie:', error);
    } else {
        console.log('Cookie set!');
    }
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
    url: 'https://example.com',           // URL to associate with (checked against @match/@include in Tampermonkey)
    domain: '.example.com',               // Cookie domain
    path: '/',                            // Cookie path

    // Optional — security
    secure: true,                         // HTTPS only
    httpOnly: true,                       // gated — Tampermonkey: Advanced → Security toggle (since stable 5.3.1+); Violentmonkey: global + per-script toggles — see note below
    sameSite: 'strict',                   // "strict", "lax", "no_restriction", "unspecified" — there is no "none" ("no_restriction" requires secure: true)

    // Optional — expiry (seconds since epoch — both managers)
    expirationDate: Math.floor(Date.now() / 1000) + 86400,  // 24 hours

    // Optional — partitioning — Tampermonkey 5.2+ only (Chrome CHIPS)
    partitionKey: {
        topLevelSite: 'https://example.com'
    },

    // Optional — first-party isolation — Firefox-specific
    firstPartyDomain: 'example.com'
}, callback);

// Promise form — same details, no callback
await GM.cookie.set({ name: 'x', value: 'y', url: 'https://example.com/' });
```

> **httpOnly — gated in BOTH managers (resolves contradiction with earlier overview):**
> - **Tampermonkey:** enable Config Mode **Advanced** → Security → allow httpOnly cookies (no longer “BETA only” as of stable 5.3.1+).
> - **Violentmonkey:** needs **BOTH** the global httpOnly toggle **and** the per-script toggle enabled.
> - Without these toggles, `httpOnly: true` is ignored or errors. `managers.md` §2 Cookies row is the source of truth.

> **expirationDate — both managers use seconds since epoch** (not milliseconds). Compute with `Math.floor(Date.now() / 1000) + seconds` or `new Date('2025-12-31').getTime() / 1000`.

### Cookie Expiry Examples

```javascript
// Session cookie (no expirationDate)
GM_cookie.set({ name: 'session', value: 'temp' });

// Expire in 1 hour — seconds since epoch
GM_cookie.set({
    name: 'hourly',
    value: 'data',
    expirationDate: Math.floor(Date.now() / 1000) + 3600
});

// Expire in 30 days
GM_cookie.set({
    name: 'monthly',
    value: 'data',
    expirationDate: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
});

// Expire at specific date — seconds since epoch
GM_cookie.set({
    name: 'endOfYear',
    value: 'data',
    expirationDate: new Date('2025-12-31').getTime() / 1000
});
```

---

## GM_cookie.delete(details[, callback])

Remove a cookie. **Callback is optional** — `[, callback]` — consistent with `list` and `set`.

### Basic Usage

```javascript
// @grant GM_cookie

// Callback form — callback is optional
GM_cookie.delete({ name: 'myCookie', url: 'https://example.com/' }, function(error) {
    if (error) {
        console.error('Failed to delete:', error);
    } else {
        console.log('Cookie deleted');
    }
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
// By URL + name — preferred (matches the file's own spec table)
GM_cookie.delete({
    name: 'sessionToken',
    url: 'https://example.com/'
}, callback);

// With partitioning — Tampermonkey 5.2+ only
GM_cookie.delete({
    name: 'sessionToken',
    url: 'https://example.com/',
    partitionKey: { topLevelSite: 'https://example.com' }
}, callback);

// Firefox first-party isolation
GM_cookie.delete({
    name: 'sessionToken',
    url: 'https://example.com/',
    firstPartyDomain: 'example.com'
}, callback);
```

> **Note:** `domain` is **not** a valid delete identifier — use `url` + `name`. The `CookieManager` example below has been fixed accordingly.

> **Delete URL scope (verified 2026-08-24 — MDN `cookies.remove` / RFC 6265bis §5.1.4):** `url` must match the cookie's scope (scheme + host + effective path). If the path/domain used at `set` was `/admin`, `GM_cookie.delete({ name, url: 'https://example.com/' })` will silently fail to match — use the same path/domain scope via `url` (e.g., `https://example.com/admin/`). If no match is found the promise fulfills with `null` / callback receives no error.

---

## Common Patterns

### Read and Modify Cookie

```javascript
async function updateCookie(name, modifier) {
    const cookies = await GM.cookie.list({ name });

    if (cookies.length === 0) {
        console.log('Cookie not found');
        return;
    }

    const cookie = cookies[0];
    const newValue = modifier(cookie.value);

    await GM.cookie.set({
        name: cookie.name,
        value: newValue,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        expirationDate: cookie.expirationDate
    });

    return newValue;
}

// Usage: increment a counter cookie
updateCookie('visitCount', val => String(parseInt(val || '0') + 1));
```

### Cookie Manager Class

```javascript
class CookieManager {
    constructor(domain) {
        this.domain = domain;
        // Derive a URL for delete/set operations that require `url`
        this.baseUrl = `https://${domain}/`;
    }

    async get(name) {
        const cookies = await GM.cookie.list({ domain: this.domain, name });
        return cookies.length > 0 ? cookies[0].value : null;
    }

    async set(name, value, options = {}) {
        await GM.cookie.set({
            name,
            value,
            url: options.url || this.baseUrl,
            domain: this.domain,
            path: options.path || '/',
            secure: options.secure ?? true,
            expirationDate: options.expiresIn
                ? Math.floor(Date.now() / 1000) + options.expiresIn
                : undefined
        });
    }

    async delete(name) {
        // Fixed: delete uses url + name (not domain alone) per spec table above
        await GM.cookie.delete({ name, url: this.baseUrl });
    }

    async getAll() {
        return await GM.cookie.list({ domain: this.domain });
    }

    async clear() {
        const cookies = await this.getAll();
        for (const cookie of cookies) {
            await GM.cookie.delete({ name: cookie.name, url: this.baseUrl });
        }
    }
}

// Usage
const cookies = new CookieManager('example.com');
await cookies.set('theme', 'dark', { expiresIn: 86400 * 30 });
const theme = await cookies.get('theme');
```

### Backup and Restore Cookies

```javascript
async function backupCookies(domain) {
    const cookies = await GM.cookie.list({ domain });
    GM_setValue('cookieBackup', cookies);
    return cookies.length;
}

async function restoreCookies() {
    const backup = GM_getValue('cookieBackup', []);
    for (const cookie of backup) {
        await GM.cookie.set({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            sameSite: cookie.sameSite,
            expirationDate: cookie.expirationDate
        });
    }
    return backup.length;
}
```

### Session Hijacking Prevention Check

```javascript
async function checkSessionSecurity() {
    const cookies = await GM.cookie.list({});
    const issues = [];

    for (const cookie of cookies) {
        if (cookie.name.toLowerCase().includes('session') ||
            cookie.name.toLowerCase().includes('token')) {

            if (!cookie.secure) {
                issues.push(`${cookie.name}: Not secure (sent over HTTP)`);
            }
            if (!cookie.httpOnly) {
                issues.push(`${cookie.name}: Not httpOnly (accessible via JS)`);
            }
            if (cookie.sameSite === 'no_restriction' && !cookie.secure) {
                issues.push(`${cookie.name}: SameSite=no_restriction without Secure (and SameSite=None pairing requires Secure)`);
            }
            if (cookie.sameSite === 'unspecified') {
                issues.push(`${cookie.name}: SameSite unspecified — consider explicit lax/strict/no_restriction`);
            }
        }
    }

    if (issues.length > 0) {
        console.warn('Cookie security issues:', issues);
    }
    return issues;
}
```

### Fallback for unsupported managers

```javascript
// Greasemonkey 4+ / Safari — use document.cookie
function getDocumentCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([$?*|{}\]\\^])/g, '\\$1') + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
}

function setDocumentCookie(name, value, { days = 7, path = '/', secure = true, sameSite = 'Lax' } = {}) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=${path}; SameSite=${sameSite}${secure && location.protocol === 'https:' ? '; Secure' : ''}`;
}
```

---

## HTTP Cookie Semantics & Platform Limits (verified 2026-08-24)

> Sources: MDN `Set-Cookie` / `Using HTTP cookies` / `Document.cookie` / `cookies.Cookie` / `cookies.remove` / `Cookie Store API` / `Partitioned cookies` / `Third-party cookies`; RFC 6265bis draft `httpwg/http-extensions` (Cookie Lifetime Limits §5.5, Limits §6.1, §5.6 parsing, §4.1.3 Cookie Name Prefixes, Privacy §7). Quoted limits below reflect implementations as of 2026-08-24 — re-verify before relying on exact caps.

### Size & count limits

- **Per-cookie:** name+value must be ≤ 4096 octets; longer `set-cookie-string` is ignored (RFC 6265bis §5.6 step 5). `Path`/`attribute-value` > 1024 octets is ignored. Browsers enforce ~4096 bytes for the whole `Set-Cookie` line (name+value+attributes) — MDN describes this as "usually 4KB".
- **Per-domain / total (RFC 6265bis §6.1, Implementation Considerations):** user agents SHOULD provide *at least* 50 cookies per domain and 3000 total; they MAY evict any cookie at any time. In practice MDN notes "generally in the hundreds" per domain. Header limits apply: the `Cookie` header sent on every request is capped (commonly ~8192 octets), and large cookie jars worsen performance.
- **Practical tip:** keep cookies small and few; graceful degradation is expected — `GM_cookie.list` may return fewer entries if evicted.

### Lifetime cap — 400 days

- As of RFC 6265bis §5.5 (verified 2026-08-24) and enforced by Chrome/Firefox/Safari since 2022+, `Expires`/`Max-Age` beyond **400 days (34560000 seconds)** MUST be clamped to 400 days. `managers.md` and this file's expiry examples (30 days, etc.) are within the cap; setting `expirationDate` farther future will be silently capped. User agents MAY use a lower limit via cookie policy (see RFC 6265bis §7.2).

### SameSite defaults & Secure pairing

- If `SameSite` is omitted, modern browsers default to **`Lax`** (MDN `Set-Cookie` `SameSite`: "Some browsers use Lax as the default value if SameSite is not specified"). Lax allows top-level GET navigations only; cookie is not sent on cross-site POST/`fetch`/subresource requests.
- `SameSite=None` **MUST** be paired with `Secure` or the cookie will be rejected (MDN `Set-Cookie` `SameSite=None`: "The Secure attribute must also be set when using this value"). In `GM_cookie` this maps to `sameSite: 'no_restriction'` + `secure: true` — using `sameSite: 'none'` does not exist and, per Tampermonkey #2070/#465, causes "message port closed" hangs.

### Partitioned (CHIPS) cookies

- `Partitioned` **requires `Secure`** (MDN `Set-Cookie` `Partitioned`: "if this is set, the Secure directive must also be set"). Recommended form (MDN `Partitioned cookies`): `Set-Cookie: __Host-example=…; SameSite=None; Secure; Path=/; Partitioned;`.
- In `GM_cookie` this is `partitionKey: { topLevelSite: 'https://example.com' }` (Tampermonkey 5.2+ only; verified 2026-08-24). Violentmonkey 2.35.1 ignored `partitionKey`; current types may list it but underlying support remains Tampermonkey-only as of 2026-08-24 — re-check `violentmonkey.github.io/api/gm` after 2.36.
- Use `__Host-` prefix + `Path=/` + no `Domain` when you don't need subdomain sharing.

### Cookie name prefixes (`__Secure-` / `__Host-`)

- **__Secure-** — requires `Secure` set from a secure (HTTPS) origin (MDN `Set-Cookie` Cookie prefixes; RFC 6265bis §4.1.3).
- **__Host-** — requires `Secure` from HTTPS, **no `Domain`**, and `Path=/` (MDN: "must not have a Domain attribute specified, and the Path attribute must be set to /"). Guarantees host-only, host-wide scope — closest to origin-bound security.
- **__Http- / __HostHttp-** (MDN, newer): require `Secure` + `HttpOnly`; `__HostHttp-` also requires `Path=/` + no `Domain`. Prefix checks are ignored by browsers without support — don't rely on them as sole security.

### Max-Age vs Expires precedence & session definition

- If both `Expires` and `Max-Age` are set, **Max-Age takes precedence** (MDN `Using HTTP cookies`: "Max-Age is less error-prone, and takes precedence when both are set."; MDN `Set-Cookie` `Max-Age`: "If both Expires and Max-Age are set, Max-Age has precedence."). `GM_cookie` exposes only `expirationDate` (seconds since epoch, maps to Max-Age/Expires under the hood) — file's `Math.floor(Date.now()/1000)` formula is correct.
- Absent both attributes → **session cookie** (`session: true`, no `expirationDate`). Session ends when the client shuts down, but browsers with session restore (e.g., Firefox/Chrome restore tabs) will resurrect session cookies "as if the browser was never closed" (MDN `Set-Cookie` `Expires`).

### Path default & matching

- If `Path` is omitted it defaults to the **request URL's path component** (MDN `Set-Cookie` `Path`: e.g., `https://example.com/docs/Web/HTTP/index.html` → default `/docs/Web/HTTP/`). This is not a security boundary — it controls when browsers send `Cookie` headers, not JS readability.
- Matching: `Path=/docs` matches `/docs`, `/docs/`, `/docs/Web/`, `/docs/Web/HTTP` but **not** `/`, `/docsets`, `/fr/docs` (MDN). File's `path: '/'` covers all paths; explicit narrower paths restrict sends.

### Domain default — host-only vs Domain attribute

- **Without `Domain`:** cookie is **host-only** (`hostOnly: true`, returned only to exact host, not subdomains). MDN `Set-Cookie` `Domain`: "If omitted, the cookie is returned only to the host that sent them (i.e., it becomes a 'host-only cookie'). This is more restrictive than setting the host name, as the cookie is not made available to subdomains."
- **With `Domain=.example.com`:** available to that host and all subdomains (MDN: "If a domain is specified, then subdomains are always included. Contrary to earlier specs leading dots are ignored."). `GM_cookie`'s `hostOnly` boolean reflects this distinction — critical for `delete` URL resolution.

### Document.cookie / Cookie Store API visibility vs GM_cookie

- `Document.cookie` **cannot read `httpOnly` cookies** (MDN `Document.cookie`, `Set-Cookie` `HttpOnly`: "Forbids JavaScript from accessing the cookie, for example, through the Document.cookie property"). `Secure` cookies **are** still readable via `Document.cookie` if `httpOnly` is not set, though they are only *sent* over HTTPS (MDN `Set-Cookie` `Secure`). Both flags still cause the browser to send the cookie on `fetch`/`XMLHttpRequest`.
- Modern alternative: **Cookie Store API** (`cookieStore.get/set`, `Window.cookieStore`, `ServiceWorkerRegistration.cookies`) — async, promise-based, available in windows and service workers (MDN `Cookie Store API`, Baseline 2025, newly available since June 2025). Unlike `Document.cookie` it is non-blocking and not tied to `Document`. `GM_cookie` remains the only way to touch `httpOnly` cookies from userscripts (when toggles allow).

### Underlying `storeId` (Firefox containers) — not via GM_cookie

- The browser `cookies.Cookie` type includes `storeId` (MDN `cookies.Cookie` `storeId`: "A string representing the ID of the cookie store containing this cookie, as provided by `cookies.getAllCookieStores()`"). Firefox Multi-Account Containers use distinct `storeId`s per container. `GM_cookie` does **not** expose `storeId` — it operates in the default store. For completeness the file's property table omits `storeId` intentionally (underlying extension API detail, not GM_cookie surface). Verified 2026-08-24 via MDN `cookies.Cookie`.

### Privacy: third-party phase-out & partitioned migration

- CHIPS / `Partitioned` is the **opt-in migration** as browsers phase out **unpartitioned third-party cookies** (MDN `Third-party cookies`: "some have started to block third-party cookies by default"; `Partitioned cookies`: CHIPS gives a separate cookie jar per top-level site). RFC 6265bis §7.1 notes most user agents now limit or block third-party cookies (partition or refuse). `GM_cookie`'s `partitionKey` is the userscript surface for this migration (Tampermonkey 5.2+); prefer partitioned cookies for embedded third-party contexts.

Cross-reference: `managers.md` §2 Cookies row, `browser-compatibility.md`.

## Security Considerations

1. **Access Control**: Tampermonkey checks `@match`/`@include` access to the target URL before allowing cookie operations; Violentmonkey derives cookie access from `@match`/`@include` host permissions (not `@connect` — `@connect` governs `GM_xmlhttpRequest` only). See `managers.md` §2.

2. **httpOnly Cookies**: Gated in **both** managers — Tampermonkey: Advanced → Security toggle (since stable 5.3.1+; no longer “BETA only”); Violentmonkey: global + per-script toggles. `partitionKey` remains Tampermonkey 5.2+ only. Most session cookies are `httpOnly` — without the toggles you cannot read/set them.

3. **Secure Flag**: Always set `secure: true` for sensitive cookies.

4. **SameSite**: Use `sameSite: 'strict'` or `'lax'` to prevent CSRF.

5. **Domain Scope**: Be careful with domain — `.example.com` includes all subdomains.

Cross-reference: `managers.md` §2 Cookies row, `browser-compatibility.md` (Browser Support Matrix).
