# HTTP Requests API Reference

Documentation for `GM_xmlhttpRequest` / `GM.xmlHttpRequest` — cross-origin HTTP requests. Per-manager support in [managers.md](managers.md); header whitelisting in [header-reference.md](header-reference.md).

---

## Overview

`GM_xmlhttpRequest` (callback) and `GM.xmlHttpRequest` (Promise form, Greasemonkey 4.0+) perform background fetches that bypass the page's same-origin/CORS and CSP `connect-src` restrictions. They are dispatched from the manager's background context — Tampermonkey docs: "GM_xmlhttpRequest is dispatched by Tampermonkey's background context" + "If you want to use this method then please also check the documentation about @connect"; wiki.greasespot.net: "allows these requests to cross the same origin policy boundaries"; Violentmonkey API index lists `GM_xmlhttpRequest` (verified 2026-08-25 — violentmonkey.github.io/api/gm#gm_xmlhttprequest). Behaviour is **manager-neutral for core options**; extended options are manager-specific — see the support matrix below.

---

## Background vs Page `fetch` — CORS, CSP & Credentials

`GM_xmlhttpRequest` background fetches skip page-level security checks; use this table when choosing between `GM_xmlhttpRequest` and page `fetch`/`XHR` via `unsafeWindow`.

| Capability | Page `fetch` / `XHR` | `GM_xmlhttpRequest` background |
|---|---|---|
| CORS preflight | Required for non-simple requests | Skipped via background (no OPTIONS preflight) |
| CSP `connect-src` | Enforced — `fetch()` "is controlled by the connect-src directive" (MDN fetch) | Bypassed — uses browser networking stack from background |
| Forbidden headers (`Cookie`, `User-Agent`, `Referer`) | Blocked by browser | Allowed — Tampermonkey docs list `headers e.g. user-agent, referer, ...` and wiki example sets `User-Agent` |
| `@connect` whitelist | N/A | **Required** — `@connect <domain>` / `@connect *` / `@connect self`; both initial and final URL are checked (verified 2026-08-25 — tampermonkey.net/documentation.php?q=connect) |

Portable implication: use `GM_xmlhttpRequest` to bypass page CORS/CSP and to send privileged headers; page `fetch` remains subject to those restrictions. For generic `fetch` defaults, preflight rules, and credentials modes, see MDN [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/fetch), [`Request: credentials`](https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials), and [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) + WHATWG Fetch Living Standard.

> Streaming & payload note: `responseType: 'stream'` + `onloadstart` reader is Tampermonkey-only, not portable — use `blob`/`arraybuffer` portably (see Advanced Features).

---

## Choosing a Request Method

| Need | Portable default | Manager caveat |
| --- | --- | --- |
| Cookie-less / anonymous request | Omit cookies manually or use page-context fetch; `anonymous: true` only where supported | `anonymous` is Tampermonkey + Violentmonkey only (verified 2026-08-25 — violentmonkey.github.io/api/gm); absent in Greasemonkey 4+ / Safari. `unsafeWindow` is absent in Safari — design without page-world access. |

Portable implication: `anonymous`/`cookie` options are Tampermonkey-only (Violentmonkey partially) — don't rely portably; strip cookies manually or branch on capability.

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

## Portable Options (all managers)

Core surface that is manager-neutral — use these portably without guards.

| Option | Notes |
| --- | --- |
| `method` | `GET`, `HEAD`, `POST`, `PUT`, `DELETE`, `PATCH` |
| `url` | String URL — relative URLs allowed (verified 2026-08-25 — violentmonkey.github.io/api/gm + wiki.greasespot.net/GM.xmlHttpRequest); `url` as `Blob`/`File` is Tampermonkey-only, not portable |
| `headers` | Object of request headers — privileged `Cookie`, `User-Agent`, `Referer` allowed in background (blocked in page `fetch`) (verified 2026-08-25 — violentmonkey.github.io/api/gm) |
| `data` | `String` is portable everywhere; `Blob`/`File`/`FormData`/`ArrayBuffer`/`UInt8Array` are not portable to Greasemonkey 4+ (`String` only per wiki.greasespot.net/GM.xmlHttpRequest: "data String Optional") (verified 2026-08-25 — wiki.greasespot.net/GM.xmlHttpRequest + violentmonkey.github.io/api/gm); for form-encoded `data` set `Content-Type: application/x-www-form-urlencoded` per Greasemonkey wiki |
| `timeout` | Milliseconds; triggers `ontimeout` — default `0` means wait forever per Greasemonkey wiki (verified 2026-08-25 — wiki.greasespot.net/GM.xmlHttpRequest) |
| `onload`, `onerror`, `onabort`, `ontimeout` | Callbacks — each receives the response object (`status`/`statusText`/`responseHeaders`/`response`/`responseText` etc.), not a separate Error (verified 2026-08-25 — violentmonkey.github.io/api/gm + wiki.greasespot.net/GM.xmlHttpRequest) |
| `onprogress` | Download progress (`lengthComputable`, `loaded`, `total`) — portable |
| `upload` | `upload: { onprogress }` for upload progress — shape varies per manager; feature-detect if needed |
| `responseType` | `text` (implicit default), `json`, `blob`, `arraybuffer` are portable; `stream`/`document`/`ms-stream` are manager-specific, not portable (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_xmlhttpRequest + violentmonkey.github.io/api/gm + wiki.greasespot.net) |
| `overrideMimeType`, `context`, `user`, `password` | Widely supported; verify `user`/`password` per manager docs if critical |
| `onreadystatechange` | Ready-state changes — portable |
| `synchronous` | Greasemonkey-only, not portable — `synchronous: true` locks Firefox UI until completion (verified 2026-08-25 — wiki.greasespot.net/GM.xmlHttpRequest); Tampermonkey explicitly "synchronous flag is not supported" (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_xmlhttpRequest); Violentmonkey synchronous not supported (verified 2026-08-25 — violentmonkey.github.io/api/gm: "synchronous is not supported") — do not use portably |
| `withCredentials` / `anonymous` | `anonymous` (drop cookies) is Tampermonkey + Violentmonkey only, not portable — prefer omitting cookies manually for portable code |

### Non-portable extensions — Tampermonkey-only, not portable

`binary` nuances beyond compat, `nocache`, `revalidate`, `fetch` mode, `anonymous`/`cookie`/`cookiePartition`, `redirect`, `proxy`, `responseType: 'stream'` + `onloadstart` reader, and `url`/`data` as `Blob`/`File`/`ArrayBuffer` beyond String are Tampermonkey-only (some partially in Violentmonkey) — not portable. Guard with capability checks or avoid for portable scripts. See [managers.md](managers.md) for the authoritative per-manager matrix.

> Per-manager deltas for Violentmonkey, Greasemonkey 4+, and Safari Userscripts app are authoritative in [managers.md](managers.md) — this file keeps only the portable subset.

---

## Minimal Portable Request Shape

```javascript
GM_xmlhttpRequest({
    method: 'GET',                     // portable
    url: 'https://api.example.com/',   // String URL only portably
    headers: { 'Content-Type': 'application/json' },
    data: null,                        // String portably; Blob/FormData not portable to GM4+
    responseType: 'json',              // text/json/blob/arraybuffer portable
    timeout: 30000,                    // 0 = wait forever (verified 2026-08-25 — wiki.greasespot.net/GM.xmlHttpRequest)
    onload: function(response) {},
    onerror: function(response) {},    // receives response object, not Error (verified 2026-08-25 — violentmonkey.github.io/api/gm + wiki.greasespot.net/GM.xmlHttpRequest)
    onprogress: function(progress) {}
});
```

TM-only options (`nocache`, `revalidate`, `fetch`, `anonymous`, `cookie`, `cookiePartition`, `redirect`, `proxy`, `stream`) are not portable — do not include in portable shape.

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
    response.responseXML;     // Parsed XML (if applicable) — only when available (verified 2026-08-25 — violentmonkey.github.io/api/gm)
    response.context;         // Custom context from request
    // Progress fields when available: response.lengthComputable, response.loaded, response.total (verified 2026-08-25 — violentmonkey.github.io/api/gm)
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
| Tampermonkey | **Strict** | Unlisted hosts trigger a user prompt or block. Both the **initial URL** and the **final URL after redirects** are checked (verified 2026-08-25 — tampermonkey.net/documentation.php?q=connect). |
| Violentmonkey | **Declared, not enforced** | Value is recorded but requests are allowed even if the host is not listed |
| Greasemonkey 4+ | **Ignored** | Directive has no effect |
| Safari Userscripts | **n/a** | Not enforced |

Best practice (portable, Tampermonkey-compatible):

1. Declare all known domains explicitly.
2. Optionally add `@connect *` as a fallback — Tampermonkey then offers an "Always allow all domains" button (verified 2026-08-25 — tampermonkey.net/documentation.php?q=connect).
3. Expect both initial and final URLs to be checked where enforcement applies.
4. Subdomain-wildcard coverage — **verify per manager docs**; do not assume identical glob semantics.

> **Tampermonkey `fetch`/`anonymous` caveat:** `anonymous: true` / `fetch: true` enforce fetch mode where `timeout`/`onprogress`/`onloadstart` may not work — avoid combining portably (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_xmlhttpRequest).

> **Blob/File URL distinction:** `url: Blob|File` (Tampermonkey-only, not portable) loads from a Blob as source URL; `data: Blob|File` sends a Blob as body — distinct, don't conflate (verified 2026-08-25 — tampermonkey.net/documentation.php?q=GM_xmlhttpRequest).

---

## Advanced Features

### Aborting Requests

Portable degradation: `GM_xmlhttpRequest` returns a control object with `.abort()` in Tampermonkey / Violentmonkey / Safari; Greasemonkey 4+ documents `undefined` as the return value, so `request.abort()` is not portable there — guard with `if (request && typeof request.abort === 'function')`.

```javascript
const request = GM_xmlhttpRequest({
    method: 'GET',
    url: 'https://api.example.com/large-file',
    onload: response => console.log('Done'),
    onabort: () => console.log('Aborted')
});

setTimeout(() => { if (request && request.abort) request.abort(); }, 5000);
```

Abort semantics for the promise form are the same — see Async/Await section.

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

For uploads, `upload: { onprogress }` shape varies per manager — feature-detect if needed.

### Streaming Response — Tampermonkey-only, not portable

`responseType: 'stream'` and `onloadstart` reader exist only in Tampermonkey — guard with `GM_info.scriptHandler === 'Tampermonkey'` and fall back to `blob`/`arraybuffer` elsewhere.

```javascript
// Tampermonkey-only streaming — guard before use
const supportsStream = typeof GM_info !== 'undefined' && GM_info.scriptHandler === 'Tampermonkey';

if (supportsStream) {
    GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://api.example.com/stream',
        responseType: 'stream',
        onloadstart: function(response) {
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
    // Portable fallback for Violentmonkey / Greasemonkey 4+ / Safari
    GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://api.example.com/stream',
        responseType: 'blob',
        onload: function(response) {
            console.log('Stream fallback: received blob', response.response.size);
        }
    });
}
```

For page `fetch` streaming, see MDN [`Response: body`](https://developer.mozilla.org/en-US/docs/Web/API/Response/body) (`ReadableStream`).

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

Portable binary note: wrap `ArrayBuffer`/`UInt8Array` in `Blob` for portability (`new Blob([buffer], { type: 'application/octet-stream' })`); Greasemonkey 4+ supports `String` only for `data`, so `Blob`/`ArrayBuffer` needs a String fallback there.

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

Use `GM.xmlHttpRequest` (note uppercase **H**) for the promise form. Callback and promise forms coexist in most managers — feature-detect the grant you use.

### Per-manager grant spelling + abort semantics

| Manager | Callback grant | Promise grant | Abort |
| --- | --- | --- | --- |
| Tampermonkey | `GM_xmlhttpRequest` | `GM.xmlHttpRequest` (capital H) | Both return control with `.abort()` |
| Violentmonkey | `GM_xmlhttpRequest` | `GM.xmlHttpRequest` | Same — `control.abort()` |
| Greasemonkey 4+ | ❌ removed | `GM.xmlHttpRequest` (only form) | `await` the promise; control exposes `abort()` where implemented |
| Safari Userscripts | ❌ (promise-only) | `GM.xmlHttpRequest` custom promise with `abort` | Custom promise + `abort` — see [managers.md](managers.md) |

Portable implication: for Greasemonkey 4+ / Safari, use only `GM.xmlHttpRequest`; for TM/VM either works — prefer detecting `typeof GM !== 'undefined' && typeof GM.xmlHttpRequest === 'function'` before `await`.

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

The promise also has an `abort()` function (Tampermonkey / Violentmonkey; Greasemonkey/Safari where implemented):

```javascript
const request = GM.xmlHttpRequest({
    method: 'GET',
    url: 'https://api.example.com/large-file'
});

setTimeout(() => request.abort(), 5000);

try {
    const response = await request;
} catch (error) {
    console.log('Request was aborted or failed');
}
```

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
