# URL Matching Patterns

Complete guide to @match, @include, and @exclude patterns for portable userscripts. For per-manager header support see [managers.md](managers.md) §3 and [header-reference.md](header-reference.md).

> **@match base = Chrome match patterns everywhere; Violentmonkey ≥2.10.4 adds a documented superset** (`.tld` and extra host-position wildcards inside `@match`). `@include` globs cover TLDs in all managers. See table below. (verified 2026-08-25 — developer.chrome.com/docs/extensions/develop/concepts/match-patterns; developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns; violentmonkey.github.io/api/matching; github.com/violentmonkey/violentmonkey/releases/tag/v2.10.4; wiki.greasespot.net/Magic_TLD)

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

### Common Patterns — portable subset

```javascript
// Exact domain
// @match https://example.com/*

// All subdomains (covers apex + any depth)
// @match https://*.example.com/*

// Both HTTP and HTTPS
// @match *://example.com/*

// Specific path prefix
// @match https://example.com/app/*
```

> For full Chrome grammar see MDN [Match patterns](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns) and Chrome [Match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns).

### Wildcard Rules — Base Grammar vs Violentmonkey Superset

Chrome match-pattern grammar applies in all managers. Violentmonkey ≥2.10.4 extends it inside `@match`. (verified 2026-08-25 — developer.chrome.com/docs/extensions/develop/concepts/match-patterns; violentmonkey.github.io/api/matching)

| Pattern | Base (Chrome) support | Violentmonkey ≥2.10.4 | Matches |
|---------|----------------------|------------------------|---------|
| `https://example.com/*` | ✅ | ✅ | example.com/page |
| `https://*.example.com/*` | ✅ (`*` only as leftmost label) | ✅ | example.com, sub.example.com, foo.bar.example.com |
| `*://example.com/*` | ✅ | ✅ | http://example.com, https://example.com |
| `https://example.*/*` | ❌ not valid `@match` | ✅ (`.tld` wildcard) | example.com, example.co.uk, example.de |
| `https://*.example.*/*` | ❌ | ✅ (two host wildcards) | foo.example.com, bar.example.co.uk |
| `https://*example.com/*` | ❌ | ✅ (wildcard not at dot boundary) | example.com, myexample.com |

* Base `*.example.com` matches the host plus subdomains at any depth per spec (MDN: `*://*.mozilla.org/*` matches `a.b.mozilla.org`) (verified 2026-08-25 — developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns).

**Takeaway:** For maximum portability, stay within base Chrome grammar in `@match` and use `@include` for TLD wildcards (or add explicit `@match` lines per TLD). Use the Violentmonkey superset only when targeting Violentmonkey.

### Special Patterns — portable vs superset

```javascript
// Match domain AND all subdomains — one line suffices in base grammar
// @match https://*.example.com/*

// Violentmonkey ≥2.10.4 superset — TLD wildcard directly in @match (not portable)
// @match https://example.*/*
// @match https://*.example.*/*
// Portable alternative: explicit per-TLD @match or @include glob (see @include below)
```

### Match-pattern notes (verified 2026-08-25 — developer.chrome.com/docs/extensions/develop/concepts/match-patterns; developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns; violentmonkey.github.io/api/matching; tampermonkey.net/documentation.php?locale=en&q=include)

- **`<all_urls>` vs `*://*/*`** — `<all_urls>` matches all URLs under any supported scheme (`http`, `https`, `ws`, `wss`, `ftp`, `data`, `file`); `*://*/*` covers only `http`/`https`/`ws`/`wss` (verified 2026-08-25 — developer.chrome.com/docs/extensions/develop/concepts/match-patterns; developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns). Treat as broad host permission — use sparingly.
- **Scheme `*://` vs `http*://`** — `*://` is the portable way to cover http+https. `http*://` also matches both but only in Tampermonkey and Violentmonkey ≥2.10.4 (verified 2026-08-25 — tampermonkey.net/documentation.php?locale=en&q=include; violentmonkey.github.io/api/matching; github.com/violentmonkey/violentmonkey/releases/tag/v2.10.4) — prefer `*://` for portability.
- **Host `*` vs `*.`** — `*` alone means any host (`https://*/*` = any HTTPS host); `*.example.com` means that host and subdomains at any depth (verified 2026-08-25 — developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns; developer.chrome.com/docs/extensions/develop/concepts/match-patterns).
- **Port** — host may include `:port` (e.g., `https://example.com:8080/`) (verified 2026-08-25 — developer.chrome.com/docs/extensions/develop/concepts/match-patterns; developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns — Firefox bug 1362809/1468162). Chrome supports it; Firefox does not — test per manager if you gate on port.
- **Path includes query string; fragment never matches** — base spec matches `path + "?" + query` (MDN) (verified 2026-08-25 — developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns). `https://example.com/path` does **not** match `https://example.com/path?foo=1`; `https://example.com/*` does. Violentmonkey diverges: it ignores query + hash for `@match`/`@include` globs (verified 2026-08-25 — violentmonkey.github.io/api/matching) — query-aware gating needs a runtime check or regex `@include` where supported. A pattern containing `#` never matches (verified 2026-08-25 — developer.chrome.com/docs/extensions/develop/concepts/match-patterns; developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns).

---

## @include (Legacy)

More flexible but less secure than @match. Supports glob patterns and regex. Use `@match` for new scripts; reach for `@include` only for TLD coverage or regex gating.

### Glob Patterns

```javascript
// Standard glob
// @include https://example.com/*

// Portable TLD coverage — @include glob works in all managers
// @include https://example.*/*
// Equivalent Violentmonkey ≥2.10.4 @match: https://example.*/*

// Any subdomain + any TLD — portable via @include glob
// @include https://*.example.*/*
```

**Glob semantics (verified 2026-08-25 — wiki.greasespot.net/Include_and_exclude_rules; wiki.greasespot.net/Magic_TLD; violentmonkey.github.io/api/matching):**

- No wildcard → must match entire URL; `*` matches any characters including empty. Case-insensitive; regex anchors `^`/`$` are not supplied.
- If no `@include`/`@match` is provided, `@include *` is assumed (within greaseable schemes).
- `.tld` works only in glob patterns, not regex, and is public-suffix based (covers `co.uk`, `co.jp`) — beware unintended suffixes. Greasemonkey greaseable schemes are only `http`, `https`, `about:blank` even if pattern would otherwise match (verified 2026-08-25 — wiki.greasespot.net/Include_and_exclude_rules).
- **Portability tip:** Tampermonkey's `@include` host segment matching can be overly permissive around `://` (verified 2026-08-25 — tampermonkey.net/documentation.php?locale=en&q=include) — prefer `@match` for precise host gating and keep `@include` for intentional broad/TLD cases.

### Regular Expressions

Wrap in forward slashes:

```javascript
// @include /example/
// @include /^https:\/\/www\.example\.com\/page\/\d+$/
```

Ports to `@match` often need a runtime URL check because regex can test query/hash while base `@match` and Violentmonkey globs handle query/hash differently (see notes above).

### @include vs @match

| Feature | @match | @include |
|---------|--------|----------|
| Regex support | No | Yes (wrapped in `/.../`) |
| TLD wildcards (`example.*`) | Only Violentmonkey ≥2.10.4 superset | Yes — portable via glob |
| Extra host wildcards (`*.example.*`, `*example.com`) | Only Violentmonkey ≥2.10.4 | Yes via glob — portable |
| Recommended | Yes | Legacy — use for TLD/regex only |

> **Conversion note (verified 2026-08-25 — violentmonkey.github.io/api/matching; tampermonkey.net/documentation.php?locale=en&q=include; developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns):** Translating regex `@include` to portable `@match` often needs runtime URL checks for query/hash because base `@match` includes query but Violentmonkey ignores query+hash, and `@include` globs/regex can test query. `<all_urls>` broadens schemes — avoid unless you need `ftp`/`data`/`file`.

---

## @exclude / @exclude-match

Exclude URLs even if they match @match or @include. Violentmonkey adds `@exclude-match` (verified 2026-08-25 — violentmonkey.github.io/api/matching; violentmonkey.github.io/api/metadata-block) — the strict `@match`-grammar counterpart to `@exclude`.

```javascript
// Run on example.com except admin pages
// @match https://example.com/*
// @exclude https://example.com/admin/*

// Portable exclusion — @exclude works everywhere; @exclude-match is VM-only
// @exclude-match https://example.com/admin/*  // VM only — ignored elsewhere
```

### Precedence

1. `@exclude-match` / `@exclude` are checked first (either match → script does not run)
2. If no exclude matches, `@match` (if defined) is checked; otherwise `@include` is checked — `@include` is fallback only when no `@match` exists
3. If neither `@match` nor `@include` is defined, script is assumed to match (Violentmonkey flow, verified 2026-08-25 — violentmonkey.github.io/api/matching)

**Portability:** Always provide a portable `@exclude` alongside any `@exclude-match`. Do not rely on `@include` fallback when `@match` is present.

---

## Portable Patterns

```javascript
// Multiple TLDs — explicit per TLD for portability
// @match https://example.com/*
// @match https://example.co.uk/*
// @match https://example.de/*
// Portable single-line alternative:
// @include https://example.*/*

// SaaS — all subdomains except internal hosts
// @match https://*.example.com/*
// @exclude https://api.example.com/*
// @exclude https://static.example.com/*
```

---

## Common Pitfalls — what changes the @match you write

- **Missing `www`:** `https://example.com/*` does not cover `https://www.example.com/*` — add both or use `https://*.example.com/*` (which also covers apex).
- **Scheme:** `https://example.com/*` misses `http://` — use `*://example.com/*` for both (portable) rather than `http*://` (TM/VM only).
- **Trailing slash:** `https://example.com/` matches only the root; `https://example.com/*` matches all pages.
- **Query string:** base spec includes query in path matching, Violentmonkey ignores it — for query-gated scripts use a broad `@match` plus a runtime `location.href` / `location.search` check or a regex `@include` where supported (Safari's Userscripts app plans to deprecate `@include`/`@exclude`, so prefer the runtime check for Safari portability).

---

## URL Fragment and SPA Navigation

`@match` (and `@include` globs) ignore URL fragments (`#hash`) — `https://example.com/*` matches `https://example.com/page#section`. For SPA `pushState`/`replaceState`/`hashchange` navigation, do not rely on a manager event: `window.onurlchange` is Tampermonkey-only. The portable fallback is `history.pushState`/`replaceState` patching plus `popstate`/`hashchange` listeners — see [managers.md](managers.md) §2 and [patterns.md](patterns.md) for the canonical snippet.

---

## See Also

- Chrome [Match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns) and MDN [Match patterns](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns) for the authoritative base grammar.
- [managers.md](managers.md) §3 and [header-reference.md](header-reference.md) for per-manager header support and precedence.
- [patterns.md](patterns.md) for the portable SPA navigation snippet.
