---
name: find-pi-packages
description: "Trigger: find/search/install a pi package, pi extension, or pi plugin; browse the pi ecosystem. Search and vet npm/git packages for the pi coding agent."
license: MIT
metadata:
  author: imatimba
  version: "0.12.6"
---

## Activation Contract

Load this skill when the user asks to find, search, vet, compare, install, or browse pi coding agent packages (extensions, skills, prompt templates, themes) from npm or git.

Path convention: `<skill-dir>` below is the directory containing this SKILL.md, wherever installed; resolve it to an absolute path before invoking.

## Hard Rules

- Search BOTH keywords on every lookup as separate queries merged afterward: npm `pi-package` + `pi-extension` (plus a loose `keywords:pi` query per term and per sweep — authors use bare `pi`; post-filtered client-side to drop non-pi noise) + GitHub `topic:pi-package` + `topic:pi-extension`. Never fold keywords into one query (`keywords:a,b` ANDs them and silently returns only dual-tagged packages).
- Derive terms from the user's stated need first; expand to 2-4 synonym forms (plural/singular/hyphenated tokenize differently: `subagent`/`subagents`/`sub-agent`) plus a hyphenated compound of the core phrase (`keep cache warm` → `cache-warm`). Keyword-only sweeps bury niche matches.
- Relevance may live in keywords/description rather than the name: never conclude absence from an unpicked top-30; present the script's `[KW]`/`[DESC]` rows (THE Firefox control package may contain neither word in its name).
- Never order results by npm `searchScore` — it measures text relevance, not popularity (690/mo can outscore 43K/mo). Vet the script table in its given downloads-ranked order; never re-sort.
- Never emit raw registry/GitHub JSON into tool output — truncation fabricates complete-looking but partial result sets. npm fan-out runs only through `references/npm-search.mjs`; GitHub calls project fields with `--jq`.
- Fan-out, merge, and ranking run in the script, never in model memory; read only the bounded table it prints.
- Treat the Coverage header as ground truth: report failed queries as gaps. Always merge both no-term keyword sweeps regardless of scoped-hit count — scoped hits are not evidence of coverage.
- Never recommend from raw search output; pass every candidate through vetting first. Precision comes from vetting, not from narrowing queries.
- Stars alone don't prove a GitHub repo is a pi package; require a README pi mention, a `package.json` `pi` key, or a `pi-` name prefix.
    - Any manual download, clone, or build happens in a `/tmp` scratch directory (e.g. `mktemp -d`), never the working directory or user home. Never leave downloaded files behind in the repo or home.
- Never run `pi install` without explicit user approval; state that packages run with full system access, and offer a pre-install scan via an available code-security skill (e.g. `ghost-scan-code`).
- Do not call `https://pi.dev/api/*`; reserved, returns errors.
- Web search only after npm, GitHub, and catalog all return nothing relevant, and only if the session has such a tool; skip silently otherwise.
- After GH backfill, rows that remain `src -`/`repo -` carry `(no repository field — verify source via README, experimental)` — publisher omitted `repository` field, verify via README before install.

## Decision Gates

| Need | Command |
| --- | --- |
| Need-driven search | `node <skill-dir>/references/npm-search.mjs <t1> [t2 t3]` — full fan-out + automatic catalog cross-check; prints Coverage line + ranked union |
| Browse / popular | `node <skill-dir>/references/npm-search.mjs` (no terms) — top 30 by downloads |
| Catalog link / UI | `https://pi.dev/packages?name=<text>&type=<extension\|skill\|theme\|prompt>&page=N` — HTML only; extract: `curl -s "<url>" \| grep -oE 'pi install npm:[^<]+' \| sort -u` |
| Git-only / pre-npm | Per topic: `gh api "search/repositories?q=topic:pi-package+<term>+in:name,description&per_page=30" --jq '.items[] \| [.full_name,.stargazers_count,((.description//"")[0:80])] \| @tsv'`; repeat with `topic:pi-extension`; drop `+<term>` for sweeps |

## Execution Steps

1. Restate the need as 2-4 synonym terms; fire the whole npm fan-out in one call (Decision Gates).
2. In the same parallel batch, run both GitHub topic queries (`--jq`-compacted). If the stars line reports RATE-LIMITED (gh absent + quota exhausted), tell the user and suggest installing GitHub CLI + running `gh auth login`.
3. Vet from the merged tables only, in table order: prefer ≥1K monthly downloads but never hide a lower-download `[EXACT]`/`[KW]`/`[DESC]` intent match — flag it `(experimental, published <6mo)` instead; weigh stars as secondary traction (292/mo on a 95★ shared repo is credible; on a 2★ personal repo it is not); flag publishes older than 6 months; open the repo URL to confirm it addresses the stated need. For dates or "fork of @x/y" lookups append the name (`npm-search.mjs @x/y`) — compact info line, never a raw packument. Rows annotated `(no repository field — verify source via README, experimental)` are repo-less after GH backfill — verify source via README before install.
4. If plausible matches are still missing after the automatic catalog cross-check, try adjacent synonyms before web search.
5. Present findings per Output Contract.
6. On approval, install. **npm form is always preferred** — every script-table row is npm-published by construction: `pi install npm:<pkg>` (`@ver` pins version, `-l` writes project-local, `pi -e` tries once without persisting). Offer `pi install git:github.com/u/r@<ref>` only for candidates proven absent from npm; raw clone+build steps only when package docs demand them (state why).

## Output Contract

Return one numbered block per candidate with exactly these elements:
1. `N. name [EXACT?] — description (↓downloads/mo or git-only, ★stars src, npm|git)` — prefix downloads with `↓` (sorted by monthly downloads, never searchScore) and put `gh` in `src` when the repo is GitHub-hosted, `–` when npm-only/unknown. Mirror the script table's ↓/★/src/legend semantics exactly.
2. Install: `pi install npm:<pkg>` first; a git install line only when the package has no npm presence
3. Links: the full `https://github.com/<owner>/<repo>` URL from the table plus `https://pi.dev/packages?name=<pkg>` — always both, always https
Then follow with the system-access security note offering a pre-install repo scan via an available code-security skill (e.g. `ghost-scan-code`). If nothing passes vetting, try the web-search fallback (when available), then say so and offer direct help without a package. Emit nothing else — no global install-variant preamble or footer; `@ver`/`-l`/`pi -e` are install-time options applied at step 6 on approval, not presentation content.

## References

- `references/npm-search.mjs` — parallel npm fan-out (strict terms × `pi-package`/`pi-extension` + loose `keywords:pi` terms/sweep at size=100 + automatic pi.dev catalog cross-check), relevance tiers (`[EXACT]` name-equality modulo `pi-` prefix / substring / `[KW]` / `[DESC]`), GH search backfill for repo-less picks (`ghNameVariants` + `package.json` name verification, 1-star filter, ≤3 GH + ≤3 verifies per pick), guardrail annotation for remaining repo-less rows, star enrichment (cache → gh → curl), Coverage line, single-package mode for args containing `/`. Requires node + curl; gh optional.
- `references/npm-search-lib.mjs` — pure decision helpers (post-filter, normalization, catalog extraction, tiers, ghSlug, ghNameVariants), unit-tested and importable.
- `tests/npm-search.test.mjs` — deterministic unit suite (no network): `node --test tests/npm-search.test.mjs`.
- `tests/integration.canary.mjs` — live API canary (self-skips unless `RUN_LIVE=1`): `RUN_LIVE=1 node --test tests/integration.canary.mjs`.
- `references/design-notes.md` — measured facts, incident registry, decision rationale, and test mapping behind every rule above.
