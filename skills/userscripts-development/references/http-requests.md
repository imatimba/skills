# HTTP Requests API Reference

Documentation for `GM_xmlhttpRequest` / `GM.xmlHttpRequest` — cross-origin HTTP requests. Per-manager support in [managers.md](managers.md); header whitelisting in [header-reference.md](header-reference.md).

---

## Overview

`GM_xmlhttpRequest` (callback) and `GM.xmlHttpRequest` (Promise form, Greasemonkey 4.0+) perform background fetches that bypass the page's same-origin/CORS and CSP `connect-src` restrictions. They are dispatched from the manager's background context — Tampermonkey docs: "GM_xmlhttpRequest is dispatched by Tampermonkey's background context" + "If you want to use this method then please also check the documentation about @connect"; wiki.greasespot.net: "allows these requests to cross the same origin policy boundaries"; Violentmonkey API index lists `GM_xmlhttpRequest` (verified 2026-08-25 — violentmonkey.github.io/api/gm#gm_xmlhttprequest). Behaviour is **manager-neutral for core options**; extended options are manager-specific — see the support matrix below.

Manager-neutral voice: every manager-specific option or version below is qualified with its owner (for example, "Tampermonkey build 6180+").

---

## Background vs Page `fetch` — CORS, CSP & Credentials (verified 2026-08-25 — MDN + WHATWG Fetch Living Standard)

`GM_webRequest` blocks/redirects at the extension layer; `GM_xmlhttpRequest` background fetches skip page-level security checks (see contrast). Use this section when choosing between `GM_xmlhttpRequest` and page `fetch`/`XHR` via `unsafeWindow`.

| Capability | Page `fetch` / `XHR` | `GM_xmlhttpRequest` background |
|---|---|---|
| CORS preflight | Required for non-simple requests | Skipped via background (no OPTIONS preflight) |
| CSP `connect-src` | Enforced — `fetch()` "is controlled by the connect-src directive" (MDN fetch) | Bypassed — uses browser networking stack from background |
| Forbidden headers (`Cookie`, `User-Agent`, `Referer`) | Blocked by browser | Allowed — Tampermonkey docs list `headers e.g. user-agent, referer, ...` and wiki example sets `User-Agent` |
| `@connect` whitelist | N/A | **Required** — `@connect <domain>` / `@connect *` / `@connect self`; both initial and final URL are checked (verified 2026-08-25 — tampermonkey.net/documentation.php?q=connect) |

Streaming & payload controls (as of TM 5.4+): `responseType` supports `arraybuffer`, `blob`, `json`, `stream`; `onprogress` / `onloadstart` provide chunk access and `stream` object. Native `fetch` equivalent is `Response.body` → `ReadableStream` (`response.body.getReader()`) — MDN `Response: body` and TM docs (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_xmlhttpRequest + MDN Web/API/Response/body). See Basic Examples for `GM_xmlhttpRequest` usage with `User-Agent` and promise form.

**Page `fetch` fundamentals (when not using background):**
- **Defaults:** `mode: "cors"` and `credentials: "same-origin"` (MDN `Request: credentials`; WHATWG Fetch §5.4) — verified 2026-08-25 — MDN Web/API/Request/credentials + WHATWG Fetch Living Standard §3.5.
- **Simple vs. preflighted:** *Simple* only if method `GET`/`HEAD`/`POST`, headers limited to CORS-safelisted (`Accept`, `Accept-Language`, `Content-Language`, `Content-Type`, `Range`) with `Content-Type` in `application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`, and no `ReadableStream` body nor `xhr.upload` listeners. Otherwise `OPTIONS` preflight with `Access-Control-Request-Method`/`Headers` (MDN Web/HTTP/CORS, verified 2026-08-25 — MDN CORS). Background skips preflight.
- **Credentials + CORS (CSRF):** `credentials: "include"` cross-origin needs *both* `Access-Control-Allow-Credentials: true` and explicit `Access-Control-Allow-Origin` (not `*`); default `same-origin` sends cookies only same-origin; `omit` never sends — MDN `RequestInit` credentials (verified 2026-08-25 — MDN Web/HTTP/CORS + WHATWG Fetch §3.3.5).

---

## Choosing a Request Method

| Need | Portable default | Manager caveat |
| --- | --- | --- |
| Cookie-less / anonymous request | Tampermonkey: `anonymous: true` (fetch mode). Elsewhere: omit cookies manually or use page-context fetch via `unsafeWindow` | `anonymous` is Tampermonkey and Violentmonkey 2.10.1+ only (verified 2026-08-25 — violentmonkey.github.io/api/gm); absent in Greasemonkey 4+ / Safari. `unsafeWindow` is absent in Safari — design without page-world access. |

---

## Required Setup

```javascript
// @grant GM_xmlhttpRequest
// @connect api.example.com
// @connect *.googleapis.com
```

Declare every cross-origin host with `@connect`. Enforcement differs per manager — see the `@connect` enforcement matrix below. Declaring hosts is best practice for Tampermonkey compatibility and good hygiene everywhere. Full header syntax is in [header-reference.md](header-reference.md); this file covers only the XHR-specific delta (initial + final URL checking, subdomain wildcard rule).

---

## Basic Examples

### GET Request

```javascript
GM_xmlhttpRequest({
    method: 'GET',
    url: 'https://api.example.com/data',
    onload: function(response) {
        console.log('Status:', response.status);
        console.log('Response:', response.responseText);
    },
    onerror: function(error) {
        console.error('Request failed');
    }
});
```

### POST Request with JSON

```javascript
GM_xmlhttpRequest({
    method: 'POST',
    url: 'https://api.example.com/submit',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    data: JSON.stringify({
        name: 'John',
        email: 'john@example.com'
    }),
    onload: function(response) {
        const result = JSON.parse(response.responseText);
        console.log('Success:', result);
    }
});
```

---

## Per-Manager Options Support

Standard options work in all four managers (Tampermonkey, Violentmonkey, Greasemonkey 4+, Safari Userscripts app). Extended options are manager-specific and must be feature-guarded.

### Standard (all four managers)

| Option | Notes |
| --- | --- |
| `method` | `GET`, `HEAD`, `POST`, `PUT`, `DELETE`, `PATCH` |
| `url` | String URL — relative URLs allowed (Violentmonkey explicitly; Greasemonkey "May be relative to the current page" per wiki.greasespot.net, verified 2026-08-25 — violentmonkey.github.io/api/gm + wiki.greasespot.net/GM.xmlHttpRequest); Tampermonkey 5.4.6226+ also accepts `Blob`/`File` objects as URL source — distinct from `data` `Blob`/`File` (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_xmlhttpRequest) |
| `headers` | Object of request headers — privileged `Cookie`, `Host`, `Origin`, `Referer`, `User-Agent` explicitly allowed in Violentmonkey (verified 2026-08-25 — violentmonkey.github.io/api/gm); Tampermonkey notes some special headers not supported on Safari/Android (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_xmlhttpRequest) |
| `data` | `String` — all managers; `Blob`, `File`, `FormData`, `URLSearchParams`, `ArrayBuffer`, `UInt8Array` — Tampermonkey / Violentmonkey / Safari only (Greasemonkey 4+ supports `String` only per wiki.greasespot.net/GM.xmlHttpRequest: "data String Optional"); for form-encoded `data` set `Content-Type: application/x-www-form-urlencoded` per Greasemonkey wiki (verified 2026-08-25 — wiki.greasespot.net/GM.xmlHttpRequest + violentmonkey.github.io/api/gm) |
| `timeout` | Milliseconds; triggers `ontimeout` — default `0` means wait forever per Greasemonkey wiki (verified 2026-08-25 — wiki.greasespot.net/GM.xmlHttpRequest); Tampermonkey/Violentmonkey treat absence as no timeout |
| `onload`, `onerror`, `onabort`, `ontimeout` | Callbacks — each receives the response object (`status`/`statusText`/`responseHeaders`/`response`/`responseText` etc.), not a separate Error (verified 2026-08-25 — violentmonkey.github.io/api/gm + wiki.greasespot.net/GM.xmlHttpRequest) |
| `onprogress` | Download progress (`lengthComputable`, `loaded`, `total`) — top-level download |
| `upload` | `upload: { onabort, onerror, onload, onloadend, onloadstart, onprogress }` for upload progress — `upload.onprogress` since Violentmonkey 2.32.0 (verified 2026-08-25 — violentmonkey.github.io/api/gm); Greasemonkey `upload` supports `onabort`/`onerror`/`onload`/`onprogress` per wiki (verified 2026-08-25 — wiki.greasespot.net/GM.xmlHttpRequest) |
| `onloadend`, `onloadstart` | Lifecycle — `onloadend`/`onloadstart` in Violentmonkey types (verified 2026-08-25 — violentmonkey.github.io/api/gm, `onloadstart` since Violentmonkey 2.12.5); `onloadstart` for `stream` in Tampermonkey 5.4+ (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_xmlhttpRequest) |
| `responseType` `arraybuffer` \| `blob` \| `json` \| `text` (`text` is implicit default) | `text`/`json`/`blob`/`arraybuffer` in all managers; Tampermonkey enumerates `arraybuffer`, `blob`, `json`, `stream` (`text` is implicit default) — see deltas below for `stream`/`document` (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_xmlhttpRequest + violentmonkey.github.io/api/gm + wiki.greasespot.net) |
| `overrideMimeType`, `context`, `user`, `password` | Widely supported (verify `user`/`password` per manager docs if critical) |
| `onreadystatechange` | Ready-state changes |
| `synchronous` | `false` by default — Greasemonkey only: `synchronous: true` locks the Firefox UI until completion (verified 2026-08-25 — wiki.greasespot.net/GM.xmlHttpRequest); Tampermonkey explicitly "synchronous flag is not supported" (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_xmlhttpRequest); Violentmonkey synchronous not supported (verified 2026-08-25 — violentmonkey.github.io/api/gm: "synchronous is not supported") |
| `withCredentials` / `mozAnon` / `anonymous` aliases | Historical Greasemonkey aliases: `mozAnon` (Gecko `LOAD_ANONYMOUS`) and `anonymous` added in Greasemonkey 3.8beta3 (verified 2026-08-25 — greasemonkey/greasemonkey#2330); `withCredentials` is the standard XHR equivalent per MDN (verified 2026-08-25 — MDN Web/API/XMLHttpRequest/withCredentials); Violentmonkey/Tampermonkey use `anonymous` (Violentmonkey 2.10.1+) with inverted `withCredentials` fallback |

### Tampermonkey-only extensions

Must be guarded or documented as Tampermonkey-only. Versions are Tampermonkey versions unless noted.

| Option | Version / Build | Notes |
| --- | --- | --- |
| `binary` nuances beyond compat | — | Compat flag works elsewhere; Tampermonkey-specific send-mode nuances |
| `nocache`, `revalidate` | — | Force cache bypass / revalidation |
| `fetch` mode + `anonymous` enforcing fetch | — | `anonymous` drops cookies and enforces fetch mode |
| `cookie` (patched cookie string) | — | Inject a custom `Cookie` header at the manager level |
| `cookiePartition` | Tampermonkey 5.2+ | `{ topLevelSite: 'https://example.com' }` partitioned cookies |
| `redirect` | Tampermonkey build 6180+ | `follow` \| `error` \| `manual` |
| `responseType: 'stream'` + `onloadstart` reader | Tampermonkey 5.4+ | `ReadableStream` via `response.response.getReader()` |
| `proxy` | Tampermonkey Firefox builds 5.5.6233+ (Tampermonkey 5.5.x line) | `http`/`https`/`socks`/`socks4`/`direct`; Firefox-only |
| `url` as `Blob`/`File` | Tampermonkey 5.4.6226+ (Tampermonkey 5.4.x line) | Blob/File URL source |
| `data` as `ArrayBuffer`/`UInt8Array` direct | Tampermonkey 5.4+ | Portable in modern managers but introduced in Tampermonkey 5.4+ |

### Violentmonkey deltas

| Option | Support |
| --- | --- |
| `anonymous` | ✅ since Violentmonkey 2.10.1 (drops cookies); since Violentmonkey 2.12.5 response cookies from an anonymous request are ignored |
| `upload.onprogress` | ✅ since Violentmonkey 2.32.0 (download `onprogress` earlier) |
| `responseType` | `text` \| `json` \| `blob` \| `arraybuffer` \| `document` — **no** `stream` |
| `binary` | ✅ compat mode |
| `cookie`, `cookiePartition`, `redirect`, `proxy`, `stream` | ❌ absent |

### Greasemonkey 4+ deltas

| Option | Support |
| --- | --- |
| `responseType` | `""`, `arraybuffer`, `blob`, `document`, `json`, `text`, `ms-stream` — includes `document` and `ms-stream` (Tampermonkey uses `stream` instead) |
| `binary: true` | ✅ compat |
| `anonymous`, `cookie`, `cookiePartition`, `redirect`, `proxy`, `stream` | ❌ absent |

### Safari Userscripts app deltas

| Option | Support |
| --- | --- |
| `responseType` | Standard XHR types (`text`, `json`, `blob`, `arraybuffer`) |
| `binary` | ⚠️ DEPRECATED — Violentmonkey issue #708 pattern: pass `Blob`/`ArrayBuffer` directly instead — UNVERIFIED (2026-08-25: Safari Userscripts `binary` deprecation not found in primary docs) |

Verify subdomain-wildcard and option behaviour per manager docs before relying — gaps marked UNVERIFIED in [managers.md](managers.md).

---

## Full Options Reference

Annotated — lines marked with their owner. Standard lines work everywhere; manager-marked lines must be guarded.

```javascript
GM_xmlhttpRequest({
    // Request configuration — standard (all managers)
    method: 'POST',                    // GET, HEAD, POST, PUT, DELETE, PATCH
    url: 'https://api.example.com/',   // Target URL (Tampermonkey 5.4.6226+ / 5.4.x+: also Blob/File)
    headers: {                         // Custom headers
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token123',
        'X-Custom-Header': 'value'
    },
    data: 'request body',              // String — all managers; Blob, File, FormData, URLSearchParams, ArrayBuffer, UInt8Array — Tampermonkey / Violentmonkey / Safari only (Greasemonkey 4+ supports String only)

    // Request modifiers
    timeout: 30000,                    // Timeout in milliseconds — standard (default 0 = wait forever per Greasemonkey wiki, verified 2026-08-25 — wiki.greasespot.net/GM.xmlHttpRequest)
    synchronous: false,                // Greasemonkey only: true locks Firefox UI; Tampermonkey/Violentmonkey not supported (verified 2026-08-25 — wiki.greasespot.net + tampermonkey.net + violentmonkey.github.io/api/gm)
    binary: false,                     // Send data in binary mode — compat everywhere; Tampermonkey has nuances beyond compat
    nocache: false,                    // Tampermonkey only — don't cache the resource
    revalidate: false,                 // Tampermonkey only — revalidate cached content
    anonymous: false,                  // Tampermonkey + Violentmonkey 2.10.1+ only — don't send cookies (enforces fetch mode in Tampermonkey; VM ignores response cookies since 2.12.5)
    fetch: false,                      // Tampermonkey only — use fetch instead of XMLHttpRequest (at Chrome: details.timeout and onprogress do not work, onreadystatechange only DONE per tampermonkey.net, verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_xmlhttpRequest)

    // Authentication
    user: 'username',                  // Basic auth username — standard
    password: 'password',              // Basic auth password — standard
    cookie: 'name=value',              // Tampermonkey only — cookie to include
    cookiePartition: {                 // Tampermonkey 5.2+ only — partitioned cookies
        topLevelSite: 'https://example.com'
    },

    // Response handling
    responseType: 'json',              // arraybuffer, blob, json, text — standard (text is implicit default; Tampermonkey documents arraybuffer, blob, json, stream); Greasemonkey supports "", arraybuffer, blob, document, json, text, ms-stream
    overrideMimeType: 'text/plain',    // Override response MIME type — standard

    // Redirect handling
    redirect: 'follow',                // Tampermonkey build 6180+ only — follow, error, manual

    // Context for callbacks
    context: { custom: 'data' },       // Passed to response object — standard

    // Proxy — Tampermonkey Firefox builds 5.5.6233+ (Tampermonkey 5.5.x line) only
    proxy: {
        type: 'http',                  // direct, http, https, socks, socks4
        host: 'proxy.example.com',
        port: 8080,
        username: 'proxyuser',
        password: 'proxypass',
        proxyDNS: true,
        failoverTimeout: 5,
        proxyAuthorizationHeader: 'Basic ...',
        connectionIsolationKey: 'key'
    },

    // Callbacks — standard except onloadstart/onloadend; each receives the response object (verified 2026-08-25 — violentmonkey.github.io/api/gm + wiki.greasespot.net)
    onload: function(response) {},
    onerror: function(response) {},      // receives response object with status/statusText, not a separate Error
    onabort: function(response) {},
    ontimeout: function(response) {},
    onprogress: function(progress) {},   // download; for upload use `upload: { onprogress }` (see below)
    onreadystatechange: function(response) {},
    onloadstart: function(response) {},  // Tampermonkey 5.4+ for stream; Violentmonkey since 2.12.5 (verified 2026-08-25 — violentmonkey.github.io/api/gm)
    onloadend: function(response) {},    // Violentmonkey (verified 2026-08-25 — violentmonkey.github.io/api/gm); Greasemonkey upload onloadend via upload object
    upload: {                            // Upload progress — per-manager shape
        onprogress: function(e) {},      // Violentmonkey 2.32.0+ (verified 2026-08-25 — violentmonkey.github.io/api/gm), Greasemonkey supports onabort/onerror/onload/onprogress (verified 2026-08-25 — wiki.greasespot.net)
        onloadend: function(e) {},
        onloadstart: function(e) {}
    }
});
```

---

## Response Object

```javascript
onload: function(response) {
    response.finalUrl;        // Final URL after redirects
    response.readyState;      // XMLHttpRequest readyState (4 = DONE)
    response.status;          // HTTP status code (200, 404, etc.)
    response.statusText;      // HTTP status text ("OK", "Not Found")
    response.responseHeaders; // Response headers as CRLF-delimited string per wiki.greasespot.net (verified 2026-08-25 — wiki.greasespot.net/GM.xmlHttpRequest) — parse via headers.trim().split(/[\r\n]+/)
    response.response;        // Parsed response when responseType set — type depends on responseType; null if not yet complete or incompatible (verified 2026-08-25 — MDN Web/API/XMLHttpRequest/response)
    response.responseText;    // Raw response text — only provided when available per Violentmonkey docs (verified 2026-08-25 — violentmonkey.github.io/api/gm)
    response.responseXML;     // Parsed XML (if applicable) — since Violentmonkey 2.13.4, only when available (verified 2026-08-25 — violentmonkey.github.io/api/gm)
    response.context;         // Custom context from request
    // Progress fields when available: response.lengthComputable, response.loaded, response.total (Violentmonkey, verified 2026-08-25 — violentmonkey.github.io/api/gm)
}
```

> **Parsing `responseHeaders`:** `getAllResponseHeaders()`-style CRLF string (e.g. `content-type: text/html\r\n…`). Exclude `Set-Cookie` in modern browsers per MDN (verified 2026-08-25 — MDN Web/API/XMLHttpRequest/getAllResponseHeaders). Mapping example: `Object.fromEntries(headers.trim().split(/[\r\n]+/).map(l => { const i=l.indexOf(':'); return [l.slice(0,i).trim().toLowerCase(), l.slice(i+1).trim()]; }))`.

> **Conditional availability:** `response`/`responseText`/`responseXML` and progress fields may be `undefined`/`null` until the relevant `readyState`/event — guard with `if (response.responseText !== undefined)` per Violentmonkey "only provided when available" (verified 2026-08-25 — violentmonkey.github.io/api/gm).

---

## @connect Directive

Whitelist domains for `GM_xmlhttpRequest`. Canonical syntax and additional values (`self`, `localhost`, `127.0.0.1`, IP, `*`) are documented in [header-reference.md](header-reference.md).

```javascript
// Specific domain — subdomain handling varies; verify per manager docs (see matrix below)
// @connect api.example.com

// Subdomain wildcard — verify per manager docs; Tampermonkey treats a declared domain as covering subdomains of that declared entry
// @connect *.googleapis.com

// Current page's domain
// @connect self

// Localhost
// @connect localhost
// @connect 127.0.0.1

// Any IP address
// @connect 192.168.1.1

// Allow all (prompts user in Tampermonkey)
// @connect *
```

### @connect enforcement matrix

| Manager | Enforcement | Detail |
| --- | --- | --- |
| Tampermonkey | **Strict** | Unlisted hosts trigger a user prompt or block. Both the **initial URL** and the **final URL after redirects** are checked. A declared host covers subdomains of that declared entry — verify per manager docs. |
| Violentmonkey | **Declared, not enforced** | Value is recorded but requests are allowed even if the host is not listed |
| Greasemonkey 4+ | **Ignored** | Directive has no effect |
| Safari Userscripts | **n/a** | Not enforced |

Best practice (portable, Tampermonkey-compatible, good hygiene):

1. Declare all known domains explicitly.
2. Optionally add `@connect *` as a fallback to let users allow unlisted hosts — Tampermonkey then offers an "Always allow all domains" button (verified 2026-08-25 — tampermonkey.net/documentation.php?q=connect); users may also whitelist `*` in script settings.
3. Expect both initial and final URLs to be checked where enforcement applies.
4. Subdomain-wildcard coverage (`*` and bare-domain subdomain inclusion) — **verify per manager docs**; do not assume identical glob semantics.

> **Tampermonkey `fetch`/`anonymous` caveat:** `anonymous: true` and `fetch: true` enforce fetch mode — at Chrome `details.timeout` and `xhr.onprogress` do not work and `onreadystatechange` receives only `DONE` (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_xmlhttpRequest). Avoid combining `anonymous`/`fetch` with `timeout`/`onprogress`/`stream` where this matters.

> **Blob/File URL distinction (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_xmlhttpRequest):** `url: Blob|File` (Tampermonkey 5.4.6226+) loads from a Blob/File as the source URL; `data: Blob|File` sends a Blob/File as the request body. They are independent — do not conflate.

---

## Advanced Features

### Aborting Requests

Tampermonkey / Violentmonkey / Safari only — `GM_xmlhttpRequest` returns a control object with `.abort()`; Greasemonkey 4+ documents `undefined` as the return value (wiki.greasespot.net/GM.xmlHttpRequest), so `request.abort()` is not portable there.

```javascript
// Tampermonkey / Violentmonkey / Safari only — Greasemonkey 4+ returns undefined
const request = GM_xmlhttpRequest({
    method: 'GET',
    url: 'https://api.example.com/large-file',
    onload: response => console.log('Done'),
    onabort: () => console.log('Aborted')
});

// Cancel after 5 seconds (Tampermonkey / Violentmonkey / Safari only)
setTimeout(() => request.abort(), 5000);
```

Abort semantics differ for the promise form — see the Async/Await section.

### Progress Tracking

```javascript
GM_xmlhttpRequest({
    method: 'GET',
    url: 'https://example.com/large-file.zip',
    onprogress: function(progress) {
        if (progress.lengthComputable) {
            const percent = (progress.loaded / progress.total * 100).toFixed(2);
            console.log(`Downloaded: ${percent}%`);
        }
    },
    onload: response => console.log('Complete')
});
```

`upload.onprogress` is available since Violentmonkey 2.32.0; Tampermonkey supports it directly. For uploads, use `GM_xmlhttpRequest({ method: 'POST', data: blob, onprogress, upload: { onprogress } })` where supported, or feature-detect `upload`.

### Streaming Response (Tampermonkey 5.4+ only — capability guard + blob fallback for Violentmonkey/Greasemonkey/Safari)

`responseType: 'stream'` and `onloadstart` exist only in Tampermonkey. Violentmonkey, Greasemonkey, and Safari do not support `stream` — use `blob`/`arraybuffer` and consume incrementally if needed. Prefix any version mention with "Tampermonkey" (Tampermonkey 5.4+, Tampermonkey 5.4.6226+, Tampermonkey build 6180+, Tampermonkey 5.2+, Tampermonkey Firefox builds 5.5.6233+ / 5.5.x).

```javascript
// Tampermonkey-only streaming — guard before use
const supportsStream = typeof GM_info !== 'undefined' && GM_info.scriptHandler === 'Tampermonkey';

if (supportsStream) {
    GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://api.example.com/stream',
        responseType: 'stream', // Tampermonkey 5.4+ only
        onloadstart: function(response) { // Tampermonkey 5.4+ only
            const reader = response.response.getReader();

            function read() {
                reader.read().then(({ done, value }) => {
                    if (done) return;
                    console.log('Chunk:', new TextDecoder().decode(value));
                    read();
                });
            }

            read();
        }
    });
} else {
    // Fallback for Violentmonkey / Greasemonkey 4+ / Safari: use blob and process after load
    GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://api.example.com/stream',
        responseType: 'blob',
        onload: function(response) {
            // response.response is a Blob in all managers
            console.log('Stream fallback: received blob', response.response.size);
        }
    });
}
```

Greasemonkey 4+ offers `responseType: 'ms-stream'` as its own streaming variant — verify per Greasemonkey docs; not portable.

Native `fetch` streaming equivalent is `Response.body` → `ReadableStream` (`response.body.getReader()` or `getReader({mode:"byob"})` for zero-copy) — MDN `Response: body` (verified 2026-08-25 — MDN Web/API/Response/body).

### keepalive & sendBeacon for Unload (verified 2026-08-25 — MDN Web/API/Request/keepalive + MDN Web/API/Navigator/sendBeacon)

When sending analytics or pings during page unload, `GM_xmlhttpRequest` is not tied to the page lifecycle. Page `fetch` equivalents are:

- **keepalive:** `fetch(url, { keepalive: true })` persists past page unload (e.g., analytics on `visibilitychange`) but payload is limited to **64 KiB** (MDN `RequestInit: keepalive`: "The body size for keepalive requests is limited to 64 kibibytes", defaults `false`; verified 2026-08-25 — MDN Web/API/Request/RequestInit + WHATWG Fetch).
- **sendBeacon alternative:** `navigator.sendBeacon(url, data)` also caps at ~64 KiB, sends asynchronously without blocking unload, and is listed alongside `fetch` under CSP `connect-src` (MDN `Navigator: sendBeacon` — verified 2026-08-25 — MDN Web/API/Navigator/sendBeacon). Prefer `fetch` + `keepalive` when you need custom methods/headers or access to the response Promise; fall back to `sendBeacon` for fire-and-forget before unload.

---

## Common Patterns

### REST API Client

```javascript
// @grant GM_xmlhttpRequest
// @connect api.example.com

const api = {
    baseUrl: 'https://api.example.com',
    token: null,

    request(method, endpoint, data = null) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: method,
                url: this.baseUrl + endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.token ? `Bearer ${this.token}` : ''
                },
                data: data ? JSON.stringify(data) : null,
                onload: response => {
                    if (response.status >= 200 && response.status < 300) {
                        resolve(JSON.parse(response.responseText));
                    } else {
                        reject(new Error(`HTTP ${response.status}`));
                    }
                },
                onerror: reject
            });
        });
    },

    get(endpoint) { return this.request('GET', endpoint); },
    post(endpoint, data) { return this.request('POST', endpoint, data); },
    put(endpoint, data) { return this.request('PUT', endpoint, data); },
    delete(endpoint) { return this.request('DELETE', endpoint); }
};

// Usage
api.token = 'your-api-token';
api.get('/users/123').then(user => console.log(user));
```

### Form Data Upload

```javascript
const formData = new FormData();
formData.append('file', blob, 'filename.txt');
formData.append('description', 'My file');

GM_xmlhttpRequest({
    method: 'POST',
    url: 'https://api.example.com/upload',
    data: formData,
    onload: response => console.log('Uploaded!')
});
```

### Binary Data Upload (Tampermonkey 5.4+ only — capability guard + blob fallback for Violentmonkey/Greasemonkey/Safari)

`ArrayBuffer` and `UInt8Array` as `data` were introduced in Tampermonkey 5.4+. Modern managers accept blobs directly — prefer `Blob`/`ArrayBuffer` over legacy `binary: true` (Safari deprecates `binary` — see Violentmonkey issue #708 pattern: pass `Blob`/`ArrayBuffer` directly).

```javascript
// Send raw binary data — Tampermonkey 5.4+ path; fallback uses Blob
const buffer = new ArrayBuffer(256);
const view = new Uint8Array(buffer);
// ... populate buffer ...

const supportsBinaryBody = true; // All modern managers accept ArrayBuffer/Blob as data; Tampermonkey documents this since 5.4+
// For maximum portability, wrap in Blob where needed:
const body = buffer instanceof ArrayBuffer ? new Blob([buffer], { type: 'application/octet-stream' }) : buffer;

GM_xmlhttpRequest({
    method: 'POST',
    url: 'https://api.example.com/binary',
    headers: { 'Content-Type': 'application/octet-stream' },
    data: body,   // Blob works everywhere; ArrayBuffer/UInt8Array is Tampermonkey 5.4+ documented
    onload: response => console.log('Binary sent!')
});
```

### Retry with Exponential Backoff

```javascript
function requestWithRetry(options, maxRetries = 3) {
    return new Promise((resolve, reject) => {
        let attempt = 0;

        function tryRequest() {
            GM_xmlhttpRequest({
                ...options,
                onload: resolve,
                onerror: (error) => {
                    if (++attempt < maxRetries) {
                        const delay = Math.pow(2, attempt) * 1000;
                        console.log(`Retry ${attempt} in ${delay}ms`);
                        setTimeout(tryRequest, delay);
                    } else {
                        reject(error);
                    }
                }
            });
        }

        tryRequest();
    });
}
```

### Handle Different Response Types

```javascript
// JSON response
GM_xmlhttpRequest({
    url: 'https://api.example.com/data.json',
    responseType: 'json',
    onload: r => console.log(r.response)  // Already parsed
});

// Binary data
GM_xmlhttpRequest({
    url: 'https://example.com/image.png',
    responseType: 'blob',
    onload: response => {
        const url = URL.createObjectURL(response.response);
        img.src = url;
    }
});

// ArrayBuffer
GM_xmlhttpRequest({
    url: 'https://example.com/data.bin',
    responseType: 'arraybuffer',
    onload: response => {
        const view = new DataView(response.response);
        console.log(view.getUint32(0));
    }
});
```

---

## Async/Await Version

Use `GM.xmlHttpRequest` (note uppercase **H**) for the promise form. Callback and promise forms coexist in most managers but differ per manager — feature-detect the grant you use.

### Per-manager grant spelling + abort semantics

| Manager | Callback grant | Promise grant | Abort semantics |
| --- | --- | --- | --- |
| Tampermonkey | `GM_xmlhttpRequest` (`@grant GM_xmlhttpRequest`) | `GM.xmlHttpRequest` (`@grant GM.xmlHttpRequest`, capital H) | Both return a control object with `.abort()` — `const ctrl = GM_xmlhttpRequest({...}); ctrl.abort()` and `const ctrl = GM.xmlHttpRequest({...}); ctrl.abort()` |
| Violentmonkey | `GM_xmlhttpRequest` | `GM.xmlHttpRequest` since Violentmonkey 2.18.3 | Same as Tampermonkey — `control.abort()` |
| Greasemonkey 4+ | ❌ removed | `GM.xmlHttpRequest` (only form — `await GM.xmlHttpRequest({...})`) | `await` the promise; the returned control exposes `abort()` where implemented — verify per Greasemonkey docs |
| Safari Userscripts | ❌ (promise-only) | `GM.xmlHttpRequest` custom promise with `abort` | Custom promise that also exposes `.abort()` — see [managers.md](managers.md) |

```javascript
// @grant GM.xmlHttpRequest
// @connect api.example.com

try {
    const response = await GM.xmlHttpRequest({
        method: 'GET',
        url: 'https://api.example.com/data'
    });
    const data = JSON.parse(response.responseText);
    console.log(data);
} catch (error) {
    console.error('Request failed:', error);
}
```

The promise also has an `abort()` function (Tampermonkey / Violentmonkey — `control.abort()`; Greasemonkey 4+ via `await GM.xmlHttpRequest`; Safari custom promise with `abort`):

```javascript
const request = GM.xmlHttpRequest({
    method: 'GET',
    url: 'https://api.example.com/large-file'
});

// Cancel after 5 seconds
setTimeout(() => request.abort(), 5000);

try {
    const response = await request;
} catch (error) {
    console.log('Request was aborted or failed');
}
```

For Violentmonkey as the worked example (skill owner's manager), verify `GM.xmlHttpRequest` availability with `typeof GM !== 'undefined' && typeof GM.xmlHttpRequest === 'function'` before `await`.

---

## Error Handling

Always include error handlers. All callbacks receive the **response object** (`status`/`statusText`/`responseHeaders`/`response` etc.), not a separate `Error` instance — `onerror`/`onabort`/`ontimeout` likewise get the response object (verified 2026-08-25 — violentmonkey.github.io/api/gm + wiki.greasespot.net/GM.xmlHttpRequest). Inspect `response.status` and `response.statusText` to distinguish HTTP errors from network failures.

```javascript
GM_xmlhttpRequest({
    url: 'https://api.example.com/data',
    onload: (response) => {
        if (response.status >= 200 && response.status < 300) {
            try {
                const data = JSON.parse(response.responseText); // guard: responseText only when available (see Response Object)
                processData(data);
            } catch (e) {
                console.error('Invalid JSON:', e);
            }
        } else {
            console.error('HTTP error:', response.status, response.statusText);
        }
    },
    onerror: (response) => {
        console.error('Network error:', response.status, response.statusText, response.responseHeaders);
    },
    ontimeout: (response) => {
        console.error('Request timed out', response.statusText);
    }
});
```

> **Timeout note:** `timeout: 0` (default per Greasemonkey) means wait forever; omit or set `0` to disable timeout (verified 2026-08-25 — wiki.greasespot.net/GM.xmlHttpRequest).
