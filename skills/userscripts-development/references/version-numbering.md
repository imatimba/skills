# Version Numbering

Rules for script version comparison and update detection. Comparison logic is **manager-specific** — never assume a universal comparator. Tampermonkey serves as the reference comparator; behaviour is labelled per manager where it matters. See per-manager support in [managers.md](managers.md).

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
| Tampermonkey | Mozilla-toolkit-like comparator (reference implementation) | Comparisons labelled **Tampermonkey reference** below follow this model. Handles numeric segments, leading zeros, prerelease tags, build metadata, date versions, negative segments, etc. |
| Violentmonkey | Own `compareVersion` implementation | Verified from source (`src/common/util.js`): splits on first `-`; main segments parsed as integers ⇒ trailing zeros equal (`1 == 1.0 == 1.0.0`) and leading zeros equal (`16.04 == 16.4`); `1.9 < 1.10`; hyphenated prerelease orders **below** its release (`1.10.0-alpha < 1.10.0`); build metadata after `+` is ignored. |
| Greasemonkey 4+ | Strict-semver library (bundled `compare-versions` v3.3.0) | Verified from source: requires a complete `X.Y.Z` before a prerelease tag — `1.0-alpha` is INVALID (comparator throws and the script's update checks get disabled), `1.0.0-alpha` is valid and sorts below release. `+build` metadata ignored; 4-part versions like `2018.03.23.1414` supported. |
| Safari Userscripts | String compare | Behaviour is **UNVERIFIED** — treat as string comparison until verified per Safari Userscripts docs |

Violentmonkey is the worked example for this skill; when a concrete comparator must be shown, use the labelled Tampermonkey-reference comparisons and note Violentmonkey's simpler model as the portable assumption.

### The Portable Subset (TM + VM + GM4+)

The comparator runs inside the manager during update checks — portability comes from choosing an `@version` string all three parse identically. Verified common ground:

- Numeric `X.Y.Z` segments: `1.9 < 1.10`, `1 == 1.0 == 1.0.0`.
- Prerelease **below** its release — attached to a COMPLETE `X.Y.Z`: `1.0.0-alpha < 1.0.0`. Greasemonkey rejects short forms (`1.0-alpha`) outright.
- Build metadata after `+` ignored by all three.

Stay inside this subset and update comparison is portable. Outside it (dates, letter tokens, exotic hierarchies), every manager does its own thing. Avoid non-semver tokens: toolkit-style `*` (infinity) and `+`-increment forms are not supported by Violentmonkey or Greasemonkey — use plain `X.Y.Z` and semver `+build` only where intended.

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

> **Date-based failure mode on Greasy Fork (verified 2026-08-25 — Greasy Fork discussion #326177 + script_version.rb split_version):** `YYYY-MM-DD` uses hyphens, which the Toolkit parser treats as negative numbers. `2026-04-12` is parsed with segment `-04` (i.e. −4) and `2026-01-14` with `-01` (−1); since −4 < −1, Greasy Fork considers `2026-04-12 < 2026-01-14` and warns "version not incremented." Greasy Fork's discussion explicitly states "Version must be delimited by dots" for this reason (verified 2026-08-25 via [Greasy Fork discussion #326177](https://greasyfork.org/en/discussions/greasyfork/326177-version-update-not-detected-correctly-when-version-is-yyyy-mm-dd) and `script_version.rb` `split_version` — https://raw.githubusercontent.com/greasyfork-org/greasyfork/main/app/models/script_version.rb). Prefer dot-delimited forms such as `2026.04.12` or semver `2026.4.12` for portable ordering.

```javascript
// @version 2024-01-15
// @version 2024-01-15.1    // Second release same day
// @version 2024-01-15_14-30 // Date-time variant — same caveats
// @version 2024-01-16
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

Per-manager note: default derivation of `@updateURL` / `@downloadURL` when one is omitted **differs per manager** — set both explicitly for portable scripts.

### Disabling Updates

```javascript
// @downloadURL  none
```

### Throttling and Caching

Managers throttle and cache update checks on their own schedules, so a freshly bumped `@version` may not be detected immediately; use the manager's dashboard "force update" / "check for updates" action to bypass the throttle.

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
