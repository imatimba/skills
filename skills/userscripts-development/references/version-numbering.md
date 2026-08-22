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
| Violentmonkey | Simpler segment-numeric compare, semver-like prerelease handling | Numeric dot-separated segments compared numerically; prerelease identifiers compare lexically / semver-like. Exact edge divergences from Tampermonkey are **UNVERIFIED** — verify per Violentmonkey docs. |
| Greasemonkey 4+ | Similar simple comparator | Also segment-numeric; exact edge divergences are **UNVERIFIED** |
| Safari Userscripts | String compare | Behaviour is **UNVERIFIED** — treat as string comparison until verified per Safari Userscripts docs |

Violentmonkey is the worked example for this skill; when a concrete comparator must be shown, use the Tampermonkey reference hierarchy and label it, then note Violentmonkey's simpler model as the portable assumption.

---

## Version Comparison Rules — Tampermonkey Reference

The following subsections document **Tampermonkey behaviour** (semver + Tampermonkey rules). They are the most complete public ordering; other managers' prerelease and build-metadata handling may differ — verify per manager docs.

### Basic Numeric Versions (Tampermonkey reference)

```
1.0 < 1.1 < 1.2 < 2.0
1.9 < 1.10 < 1.11
1.0.0 < 1.0.1 < 1.1.0
```

**Note:** `1.9 < 1.10` (numeric comparison, not string) — holds in Tampermonkey and Violentmonkey; Safari string-compare is UNVERIFIED.

### Equivalent Versions (Tampermonkey reference)

These are considered equal in Tampermonkey:

```
1 == 1. == 1.0 == 1.0.0
1.1 == 1.1.0 == 1.1.00
16.4 == 16.04
```

Violentmonkey/Greasemonkey likely behave the same for numeric equivalence, but edge cases (trailing dots, leading zeros) are UNVERIFIED.

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

Preserved alongside the exhaustive hierarchy — prose decisions rendered as a table per the skill style guide. All relations below are **Tampermonkey reference**; Violentmonkey/Greasemonkey/Safari may differ at edges (UNVERIFIED).

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

Violentmonkey: expects the same broad ordering for simple semver/date versions, but the full edge list above is not guaranteed — verify per Violentmonkey docs.
Greasemonkey 4+: similar simple comparator — UNVERIFIED edges.
Safari Userscripts: string-compare — UNVERIFIED; do not rely on numeric or prerelease semantics.

---

## Recommended Version Formats

Formats below are portable; comparison semantics remain manager-specific, so always verify that a bump is detected as newer in your target managers.

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

Pre-release ordering (`-alpha` < `-beta` < release) is Tampermonkey and semver behaviour; other managers expect similar but verify per manager docs.

### Date-Based Versions

```javascript
// @version 2024-01-15
// @version 2024-01-15.1    // Second release same day
// @version 2024-01-16
```

### Date-Time Based

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

Other managers: pre-release tags are available but ordering is UNVERIFIED at edges — test a `-dev` vs release bump before relying.

### 4. Build Metadata — semver + Tampermonkey behaviour

Use `+` for build info (doesn't affect comparison order in Tampermonkey/semver):

```javascript
// @version 1.0.0+build.123
// @version 1.0.0+20240115
```

Other managers may ignore or string-compare the `+` suffix — verify per manager docs; build metadata is **UNVERIFIED** outside Tampermonkey.

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

### Disabling Updates

```javascript
// @downloadURL  none
```

### Update Check Logic

1. The userscript manager fetches the `@updateURL` (or its derived default, which differs per manager)
2. Parses the `@version` from the meta file
3. Compares with installed `@version` using that manager's comparator (see matrix above — Tampermonkey reference vs simpler Violentmonkey/Greasemonkey, string-compare UNVERIFIED for Safari)
4. If remote > local, downloads from `@downloadURL` (or its derived default; Greasemonkey via `about:addons`)

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
