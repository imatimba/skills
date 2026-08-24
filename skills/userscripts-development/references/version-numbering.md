# Version Numbering

Rules for script version comparison and update detection. Comparison logic is **manager-specific** — never assume a universal comparator. Tampermonkey is the reference implementation documented exhaustively below; other managers differ. See per-manager support in [managers.md](managers.md).

---

## Overview

The `@version` tag determines:

- Whether updates are available
- Version comparison in the script list
- Update check eligibility (required for auto-updates)

```javascript
// @version 1.0.0
```

---

## Version Comparison is Manager-Specific

Do not present any single ordering as universal. Each manager ships its own comparator.

| Manager | Comparator | Notes |
| --- | --- | --- |
| Tampermonkey | Mozilla-toolkit-like comparator (reference implementation) | Exhaustive hierarchy below is the **Tampermonkey reference**. Handles numeric segments, leading zeros, prerelease tags, build metadata, date versions, negative segments, etc. |
| Violentmonkey | Own `compareVersion` implementation | Verified from source (`src/common/util.js`): splits on first `-`; main segments parsed as integers ⇒ trailing zeros equal (`1 == 1.0 == 1.0.0`) and leading zeros equal (`16.04 == 16.4`); `1.9 < 1.10`; hyphenated prerelease orders **below** its release (`1.10.0-alpha < 1.10.0`); build metadata after `+` is ignored. |
| Greasemonkey 4+ | Strict-semver library (bundled `compare-versions` v3.3.0) | Verified from source: requires a complete `X.Y.Z` before a prerelease tag — `1.0-alpha` is INVALID (comparator throws and the script's update checks get disabled), `1.0.0-alpha` is valid and sorts below release. `+build` metadata ignored; 4-part versions like `2018.03.23.1414` supported. |
| Safari Userscripts | String compare | Behaviour is **UNVERIFIED** — treat as string comparison until verified per Safari Userscripts docs |

Violentmonkey is the worked example for this skill; when a concrete comparator must be shown, use the Tampermonkey reference hierarchy and label it, then note Violentmonkey's simpler model as the portable assumption.

### Greasy Fork Site Comparator (verified 2026-08-24)

Greasy Fork itself compares versions using [Mozilla Toolkit version format](https://udn.realityripple.com/docs/Mozilla/Toolkit_version_format) (verified 2026-08-24 via [Greasy Fork source `script_version.rb`](https://raw.githubusercontent.com/greasyfork-org/greasyfork/main/app/models/script_version.rb) `split_version`/`compare_versions`). Each version string is split on `.` into up to 4 parts; each part is parsed as `<number-a><string-b><number-c><string-d>` (numbers may be negative; strings are non-numeric ASCII). Missing parts count as `0`. Comparison uses a 16-element array (4 parts × 4 sub-parts); numeric sub-parts compare as integers, string sub-parts byte-wise, and a string-part that exists is always less than one that does not (e.g. `1.6a < 1.6`). Special cases: `*` in a part is treated as infinity (`1.5.0.*` > `1.5.0`), and `+` in `string-b` increments `number-a` (`1.0+` == `1.1pre`). Greasy Fork enforces `version` length ≤ 200 characters and warns if the version is decremented or not incremented when code changes (`version_not_incremented?` via `compare_versions != 1`). The helper `get_next_version` auto-increments the last numeric component (verified 2026-08-24 via `script_version.rb` lengths, `split_version` regex, and `compare_versions` logic).

### The Portable Subset (TM + VM + GM4+)

The comparator runs inside the manager during update checks — portability comes from choosing an `@version` string all three parse identically. Verified common ground:

- Numeric `X.Y.Z` segments: `1.9 < 1.10`, `1 == 1.0 == 1.0.0`.
- Prerelease **below** its release — attached to a COMPLETE `X.Y.Z`: `1.0.0-alpha < 1.0.0`. Greasemonkey rejects short forms (`1.0-alpha`) outright.
- Build metadata after `+` ignored by all three.

Stay inside this subset and update comparison is portable. Outside it (dates, letter tokens, exotic hierarchies), every manager does its own thing.

---

## Version Comparison Rules — Tampermonkey Reference

The following subsections document **Tampermonkey behaviour** (semver + Tampermonkey rules). They are the most complete public ordering; other managers' prerelease and build-metadata handling may differ — verify per manager docs.

### Basic Numeric Versions (Tampermonkey reference)

```
1.0 < 1.1 < 1.2 < 2.0
1.9 < 1.10 < 1.11
1.0.0 < 1.0.1 < 1.1.0
```

**Note:** `1.9 < 1.10` (numeric comparison, not string) — verified in Tampermonkey and Violentmonkey; Safari string-compare is UNVERIFIED.

### Equivalent Versions (Tampermonkey reference)

These are considered equal in Tampermonkey:

```
1 == 1. == 1.0 == 1.0.0
1.1 == 1.1.0 == 1.1.00
16.4 == 16.04
```

Verified equal in Violentmonkey (its comparator parses segments as integers). Greasemonkey 4+'s semver library normalizes segment count, so the same equality is expected there, though not separately replicated.

### Pre-release Tags (semver + Tampermonkey behaviour)

Pre-release versions are **lower** than their release counterparts in Tampermonkey (and semver):

```
1.0-alpha < 1.0-beta < 1.0
1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0
1.10.0-alpha < 1.10.0
```

Other managers: similar ordering is expected but **verify per manager docs** — prerelease tag ordering and dot-identifier handling may be simpler or absent.

### Alpha vs Release Order (Tampermonkey reference)

```
Alpha-v1 < Alpha-v2 < Alpha-v10 < Beta < 1.0
0.5pre3 < 0.5preliminary < 0.6pre4
```

---

## Key Relations Table (Tampermonkey reference)

Preserved alongside the exhaustive hierarchy — prose decisions rendered as a table per the skill style guide. All relations below are **Tampermonkey reference**; see the comparator matrix above for verified Violentmonkey/Greasemonkey behaviour; Safari remains UNVERIFIED at edges.

| A | Relation | B | Note (Tampermonkey) |
| --- | --- | --- | --- |
| `1.0` | `<` | `1.1` | Numeric segment compare |
| `1.9` | `<` | `1.10` | Numeric, not string |
| `1` | `==` | `1.0.0` | Trailing zeros / dots ignored |
| `16.4` | `==` | `16.04` | Leading zeros ignored |
| `1.0-alpha` | `<` | `1.0` | Prerelease < release |
| `1.0.0-alpha` | `<` | `1.0.0-alpha.1` | Dot-identifier orders |
| `Alpha-v2` | `<` | `Alpha-v10` | Numeric sub-compare inside tag |
| `0.5pre3` | `<` | `0.5preliminary` | Lexical inside prerelease |
| `1.1a` | `<` | `1.1b` | Suffix letters order |
| `1.12+1` | `==` | `1.12+1.0` | Build metadata `+` segment ignored for ordering |
| `2023-08-17.alpha` | `<` | `2023-08-17` | Date + prerelease < date release |
| `2023-08-17_14-04` | `==` | `2023-08-17_14-04.0` | Trailing zero after datetime |

---

## Complete Hierarchy (Tampermonkey Reference)

From lowest to highest — **Tampermonkey reference implementation** (Mozilla-toolkit-like). Preserve this exhaustive ordering when reasoning about Tampermonkey updates; for Violentmonkey, Greasemonkey, and Safari, treat exact equivalence at these edges as UNVERIFIED and test with a minimal `@version` bump comparison.

```
Alpha-v1
Alpha-v2
Alpha-v10
Beta
0.5pre3
0.5preliminary
0.6pre4
0.6pre5
0.7pre4
0.7pre10
1.-1
1 == 1. == 1.0 == 1.0.0
1.1a
1.1aa
1.1ab
1.1b
1.1c
1.1.-1
1.1 == 1.1.0 == 1.1.00
1.1.1.1.1
1.1.1.1.2
1.1.1.1
1.10.0-alpha
1.10 == 1.10.0
1.11.0-0.3.7
1.11.0-alpha
1.11.0-alpha.1
1.11.0-alpha+1
1.12+1 == 1.12+1.0
1.12+1.1 == 1.12+1.1.0
1.12+2
1.12+2.1
1.12+3
1.12+4
1.12
2.0
16.4 == 16.04
2023-08-17.alpha
2023-08-17
2023-08-17_14-04 == 2023-08-17_14-04.0
2023-08-17+alpha
2023-09-11_14-0
```

Violentmonkey: numeric-segment equality holds as listed (source-verified); exotic tokens like `Alpha-v1`, `pre*`, and date-plus-suffix forms follow its own simpler rules — do not assume Tampermonkey's full hierarchy.
Greasemonkey 4+: strict semver — versions without complete `X.Y.Z` before a prerelease tag (e.g. `2023-08-17.alpha`, `1.1a`) may be REJECTED outright, disabling update checks for that script. Prefer plain `X.Y.Z[-pre][+build]`.
Safari Userscripts: string-compare — UNVERIFIED; do not rely on numeric or prerelease semantics.

### Toolkit Special Cases (verified 2026-08-24)

The Mozilla Toolkit format — used by Greasy Fork and as the Tampermonkey reference — has two non-portable special cases not present in semver (verified 2026-08-24 via [Toolkit version format](https://udn.realityripple.com/docs/Mozilla/Toolkit_version_format)):

- `*` == infinity: a version part that is a single `*` is treated as an infinitely-large number (`1.5.0.*` > `1.5.0` and `1.*` < `1.*.1`).
- `+` == increment `number-a`: if `string-b` is `+`, `number-a` is incremented for Firefox 1.0.x compatibility (`1.0+` == `1.1pre` == `1.1pre0`).

Neither `*` nor `+`-as-increment is supported by Violentmonkey or Greasemonkey (`+` after a version is build metadata ignored for ordering in both; `*` is not a valid semver token). Avoid `*` and `+`-increment forms in portable `@version` strings; use plain `X.Y.Z` and semver `+build` only where intended.

---

## Recommended Version Formats

Only the semver family is verified portable across TM / VM / GM4+ (see The Portable Subset above). Date-based formats work in Tampermonkey but are risky elsewhere — labeled below. Always verify that a bump is detected as newer in your target managers.

### Semantic Versioning (Recommended)

```javascript
// Major.Minor.Patch — portable
// @version 1.0.0    // Initial release
// @version 1.0.1    // Bug fix
// @version 1.1.0    // New feature
// @version 2.0.0    // Breaking change
```

### With Pre-release Tags — semver + Tampermonkey behaviour

```javascript
// @version 1.0.0-alpha
// @version 1.0.0-alpha.1
// @version 1.0.0-beta
// @version 1.0.0-rc.1
// @version 1.0.0
```

Pre-release ordering (`-alpha` < `-beta` < release) is verified in Tampermonkey, Violentmonkey, and Greasemonkey 4+ — provided the tag attaches to a complete `X.Y.Z` (all examples above qualify). Never write `1.0-alpha`; Greasemonkey treats it as invalid and disables update checks for the script.

### Date-Based Versions — Tampermonkey-leaning, NOT portable

Greasemonkey's strict-semver comparator may reject these entirely (silently disabling updates); Violentmonkey parses them by its own rules. Use only if you target Tampermonkey specifically.

> **Date-based failure mode on Greasy Fork (verified 2026-08-24):** `YYYY-MM-DD` uses hyphens, which the Toolkit parser treats as negative numbers. `2026-04-12` is parsed with segment `-04` (i.e. −4) and `2026-01-14` with `-01` (−1); since −4 < −1, Greasy Fork considers `2026-04-12 < 2026-01-14` and warns "version not incremented." Greasy Fork's discussion explicitly states "Version must be delimited by dots" for this reason (verified 2026-08-24 via [Greasy Fork discussion #326177](https://greasyfork.org/en/discussions/greasyfork/326177-version-update-not-detected-correctly-when-version-is-yyyy-mm-dd) and `script_version.rb` `split_version`). Prefer dot-delimited forms such as `2026.04.12` or semver `2026.4.12` for portable ordering.

```javascript
// @version 2024-01-15
// @version 2024-01-15.1    // Second release same day
// @version 2024-01-16
```

### Date-Time Based — Tampermonkey-leaning, NOT portable

```javascript
// @version 2024-01-15_14-30
// @version 2024-01-15_16-45
```

---

## Best Practices

### 1. Always Increment

```javascript
// WRONG - same version won't trigger update
// @version 1.0.0  →  @version 1.0.0

// CORRECT
// @version 1.0.0  →  @version 1.0.1
```

### 2. Use Three Segments

```javascript
// GOOD - clear and standard
// @version 1.0.0

// ACCEPTABLE - but less clear
// @version 1.0
// @version 1
```

### 3. Pre-release for Testing — semver + Tampermonkey behaviour

```javascript
// Development versions
// @version 1.1.0-dev
// @version 1.1.0-alpha
// @version 1.1.0-beta

// Release
// @version 1.1.0
```

Violentmonkey: hyphenated prerelease orders below its release (source-verified). Greasemonkey 4+: prerelease valid only on complete `X.Y.Z` (`1.0.0-dev` yes, `1.0-dev` invalid). Safari: UNVERIFIED — test a `-dev` vs release bump before relying.

### 4. Build Metadata — semver + Tampermonkey behaviour

Use `+` for build info (doesn't affect comparison order in Tampermonkey/semver):

```javascript
// @version 1.0.0+build.123
// @version 1.0.0+20240115
```

Build metadata after `+` is ignored by Tampermonkey, Violentmonkey, and Greasemonkey 4+ (all source/doc verified); Safari remains UNVERIFIED.

---

## Update Checking

### Requirements for Auto-Update

1. **@version** must be present
2. **@updateURL** should point to a meta file
3. **@downloadURL** should point to the script file

```javascript
// @version      1.0.0
// @updateURL    https://example.com/script.meta.js
// @downloadURL  https://example.com/script.user.js
```

Per-manager note: default derivation of `@updateURL` / `@downloadURL` when one is omitted **differs per manager** — set both explicitly for portable scripts. Greasemonkey 4+ routes update checks through `about:addons` machinery rather than a standalone manager dashboard.

### Greasy Fork UI Handling (verified 2026-08-24)

- Version is displayed on the script's Greasy Fork info page (verified 2026-08-24 via [Greasy Fork help: meta-keys](https://greasyfork.org/en/help/meta-keys) — "@version … Version is displayed on a script's info page").
- Greasy Fork **strips** `@updateURL`, `@installURL`, and `@downloadURL` on install — scripts installed from Greasy Fork update exclusively from Greasy Fork (same source, verified 2026-08-24).
- `version` length is capped at 200 characters (`validates :version, length: { maximum: 200 }` in `script_version.rb`, verified 2026-08-24).
- `ScriptVersion.get_next_version` can auto-suggest an incremented version (last numeric component +1, verified 2026-08-24 via source).

### OpenUserJS Version Handling (verified 2026-08-24)

OpenUserJS publishes no formal `@version` format specification (verified 2026-08-24 — no version-format page found on [openuserjs.org](https://openuserjs.org/about/Userscript-Beginners-HOWTO); Beginners HOWTO and related docs only advise to "increment @version" generically). In practice OUJS mirrors Greasy Fork's expectation (increment `@version` to publish an update); actual update ordering is determined by the **manager's** comparator, not the site's. For portable scripts, stay inside the semver `X.Y.Z` subset and verify bumps with your target managers.

### Disabling Updates

```javascript
// @downloadURL  none
```

### Update Check Logic

1. The userscript manager fetches the `@updateURL` (or its derived default, which differs per manager)
2. Parses the `@version` from the meta file
3. Compares with installed `@version` using that manager's comparator (see matrix above — Tampermonkey reference vs simpler Violentmonkey/Greasemonkey, string-compare UNVERIFIED for Safari)
4. If remote > local, downloads from `@downloadURL` (or its derived default; Greasemonkey via `about:addons`)

### Update Check Intervals (verified 2026-08-24)

Polling intervals are manager-configured; there is no cross-manager standard. Source-verified defaults where available (first-party GitHub sources):

| Manager | Default interval | Source |
| --- | --- | --- |
| Violentmonkey | 1 day (configurable via `autoUpdate` days; `getUpdateInterval = +val * 86400000`, `TIMEOUT_24HOURS = 86400000`, `autoUpdate: 1` in `options-defaults.js`) | [ Violentmonkey `update.js`](https://raw.githubusercontent.com/violentmonkey/violentmonkey/master/src/background/utils/update.js) / [`consts.js`](https://raw.githubusercontent.com/violentmonkey/violentmonkey/master/src/common/consts.js) / [`options-defaults.js`](https://raw.githubusercontent.com/violentmonkey/violentmonkey/master/src/common/options-defaults.js) |
| Greasemonkey 4+ | Adaptive 3 hours – 7 days (`MIN_UPDATE_IN_MS = 3h`, `MAX_UPDATE_IN_MS = 7 days`, `CHANGE_RATE = 1.25`, with random `fuzz`; short interval after update, longer after no-update) | [ Greasemonkey `src/bg/updater.js`](https://raw.githubusercontent.com/greasemonkey/greasemonkey/master/src/bg/updater.js) (`MIN_UPDATE_IN_MS`/`MAX_UPDATE_IN_MS`/`CHANGE_RATE`) |
| Tampermonkey | No officially published default interval in [Tampermonkey documentation](https://www.tampermonkey.net/documentation.php) (verified 2026-08-24 — docs are JS-rendered and contain no interval promise; GitHub issues [#280](https://github.com/Tampermonkey/tampermonkey/issues/280) and [#588](https://github.com/Tampermonkey/tampermonkey/issues/588) mention throttles such as "never more than once per hour" and "every 6 hours" but these are issue comments, not published docs) | Undocumented — treat as configurable/undisclosed |
| Greasy Fork | Not a manager — does not push updates; it is the version source. Managers poll it. | [Greasy Fork help](https://greasyfork.org/en/help/meta-keys) |

### @updateURL / @downloadURL Derivation Defaults (verified 2026-08-24)

Set both explicitly for portable scripts. Verified per-manager defaults from first-party sources:

| Manager | `@updateURL` default if omitted | `@downloadURL` default if omitted | Notes |
| --- | --- | --- | --- |
| Tampermonkey | Falls back to `@downloadURL` (per docs — `@updateURL` "should point to meta file" but manager uses `downloadURL` as fallback) | Falls back to the script's install URL | See [Tampermonkey documentation `update_url`](https://www.tampermonkey.net/documentation.php); derivation not enumerated in a single matrix doc but fallback behavior is documented |
| Violentmonkey | Resolved via `getScriptUpdateUrl(script, { all, allowedOnly, enabledOnly })` — may return multiple URLs (meta + code); `allowedOnly`/`enabledOnly` filtering and `update` vs `download` URL selection | Same helper; `requestNewer` decides meta vs code path | Verified 2026-08-24 via [Violentmonkey `update.js` `getScriptUpdateUrl`](https://raw.githubusercontent.com/violentmonkey/violentmonkey/master/src/background/utils/update.js) |
| Greasemonkey 4+ | Not separately documented; `downloadUrl` defaults to the page/script URL (`details.downloadUrl = url` in `parseUserScript`) | Defaults to the source page URL (`downloadUrl: url`) | Verified 2026-08-24 via [Greasemonkey `parse-user-script.js`](https://raw.githubusercontent.com/greasemonkey/greasemonkey/master/src/parse-user-script.js) `downloadUrl: url` default |

### Invalid Version Handling per Manager (verified 2026-08-24)

| Manager/site | Input `1.0-alpha` (no `X.Y.Z` before `-`) | Input `1.0.0-alpha` | Invalid input consequence | Source |
| --- | --- | --- | --- | --- |
| Greasemonkey 4+ (`compare-versions` v3.3.0) | THROWS `Error: Invalid argument not valid semver` — `validate()` rejects; `checkForUpdate` rejects and the update is aborted for that cycle | Valid — `1.0.0-alpha < 1.0.0` | Rejected versions abort that update check | [compare-versions `index.js`](https://raw.githubusercontent.com/greasemonkey/greasemonkey/master/third-party/compare-versions/index.js) (`semver` regex + `validate` throw) |
| Violentmonkey | Does **not** throw — `compareVersion` returns `-1`/`0`/`1` via `parseInt(a,10)\|\|0` + `DIGITS_RE` semver branch; `1.0-alpha` is parsed but sorts via its own rule (`1.0-alpha < 1.0`) | Valid — `1.0.0-alpha < 1.0.0` | Never throws; ordering is deterministic but simpler | [Violentmonkey `util.js`](https://raw.githubusercontent.com/violentmonkey/violentmonkey/master/src/common/util.js) `VERSION_RE`/`compareVersion` |
| Greasy Fork | `split_version("1.0-alpha")` does **not** throw but splits differently (hyphen part becomes `number-c`/`string-d`); `compare_versions` returns `nil` if `split_version` returns `nil`, otherwise compares — `YYYY-MM-DD` style is accepted but orders as negative numbers | Accepted | `nil` from `compare_versions` is treated as non-increment (`!= 1`) and triggers the "not incremented" warning | [Greasy Fork `script_version.rb`](https://raw.githubusercontent.com/greasyfork-org/greasyfork/main/app/models/script_version.rb) `split_version`/`compare_versions` |
| Toolkit (reference) | Valid per spec (`<number-a><string-b><number-c><string-d>` per part) | Valid | Most ASCII strings are valid; exotic forms compare via toolkit rules | [Toolkit version format](https://udn.realityripple.com/docs/Mozilla/Toolkit_version_format) |

Prefer plain `X.Y.Z[-pre][+build]` to avoid per-manager rejection.

### Conditional Request Optimization (verified 2026-08-24)

Even when `@version` is bumped, a manager may not re-download immediately due to HTTP caching:

- **Violentmonkey:** `requestNewer(url, opts)` implements `If-None-Match`/`If-Modified-Since` optimization — on scheduled (`AUTO`) checks it first issues a `HEAD` request and reads `etag` / `last-modified` / `date` headers; if the cached `mod` matches (`mod === modOld` in `storage.mod`), it skips the `GET`. `ETag` is checked first, then `last-modified`, then `date`; `storage.mod` caches `[mod, Date.now()]` per URL and `getUpdateInterval()` throttles `AUTO` re-checks. Rate-limited via `requestLimited` for remote URLs (verified 2026-08-24 via [Violentmonkey `storage-fetch.js` `requestNewer`](https://raw.githubusercontent.com/violentmonkey/violentmonkey/master/src/background/utils/storage-fetch.js)).
- **Greasemonkey 4+:** No `ETag` path in the disclosed source; instead it uses an adaptive `updateWindowMs` stored in `chrome.storage.local` (`updateWindow.<uuid>` + `updateNextAt.<uuid>`), multiplied by `CHANGE_RATE` on no-update and reset to `MIN_UPDATE_IN_MS` on update, with `fuzz()` jitter (verified 2026-08-24 via [Greasemonkey `updater.js`](https://raw.githubusercontent.com/greasemonkey/greasemonkey/master/src/bg/updater.js)).
- Implication: bumping `@version` alone does not guarantee an instant poll — the manager's throttling/caching window still applies. "Force update" / "Check for updates" in the manager UI bypasses the throttle.

### Version Downgrade Behaviour (verified 2026-08-24)

- Greasy Fork warns if `@version` is decremented on publish (verified 2026-08-24 via [Greasy Fork help: meta-keys](https://greasyfork.org/en/help/meta-keys) — "will warn if it's decremented" and via `script_version.rb` `version_not_incremented?` using `compare_versions != 1`).
- Managers **do not downgrade**: an update is applied only if `remote > local` (`compareVersions(...) === -1` / `compare_versions == 1` / `compareVersion == 1`). If the remote version is equal or lower, no download occurs (verified 2026-08-24 via Greasemonkey `updater.js` `comparison !== -1` → `abort = true` and Violentmonkey `compareVersion` delta check).

---

## Common Mistakes

### 1. String vs Numeric Comparison

```javascript
// WRONG assumption: "1.9" > "1.10" (as strings)
// CORRECT (Tampermonkey, Violentmonkey, Greasemonkey numeric): 1.9 < 1.10
// UNVERIFIED: Safari string-compare may behave as string — verify per Safari docs
```

### 2. Forgetting to Increment

```javascript
// Users won't get update if version stays same
// Always increment, even for small fixes
```

### 3. Invalid Characters

```javascript
// AVOID special characters in version
// @version 1.0.0-final!     // May cause issues
// @version 1.0.0-final      // OK — Tampermonkey tolerates hyphen tags; others verify
```

### 4. Skipping Versions

```javascript
// This is fine - no need for sequential versions
// @version 1.0.0  →  @version 2.0.0
```

---

## Version Display

The version appears in:

- Userscript manager dashboard (Violentmonkey dashboard as worked example; Tampermonkey dashboard; Greasemonkey via `about:addons`; Safari Userscripts app)
- Script editor header
- Update notifications
- Browser extension popup

Keep it readable and meaningful for users.
