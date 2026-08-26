---
name: find-pi-packages
description: "Trigger: find/search/install a pi package, pi extension, or pi plugin; browse the pi ecosystem. Search and vet npm/git packages for the pi coding agent."
license: MIT
metadata:
  author: imatimba
  version: "0.10.0"
---

## Activation Contract

Load this skill when the user asks to find, search, vet, compare, install, or browse pi coding agent packages (extensions, skills, prompt templates, themes) from npm or git.

Path convention: `<skill-dir>` below is the directory containing this SKILL.md, wherever it is installed (`~/.agents/skills/…`, `.pi/skills/…`, project-local, etc.) — resolve it to an absolute path before invoking.

## Hard Rules

- Search BOTH pi keywords on every lookup, as separate queries merged afterward: npm `pi-package` + `pi-extension` (~34% of packages carry only one), GitHub `topic:pi-package` + `topic:pi-extension` (~56% overlap).
- Never fold both keywords into one registry query (`keywords:pi-package,pi-extension` or two `keywords:` qualifiers): the API ANDs them and silently returns only packages tagged with both.
- Derive search terms from the user's stated need first; popularity-ranked keyword-only sweeps bury niche matches (e.g. a 330/mo prompt-clarifier never appears in any top-100 listing).
- Expand the need into 2-4 synonym variants including morphological forms — plural, singular, hyphenated ("subagent" vs "subagents" vs "sub-agent" tokenize differently to npm) — and always derive a hyphenated compound of the user's core phrase ("keep cache warm" → `cache-warm`). Relevance may live outside a package's name — authors put domain terms in keywords/description (`pire-browser` is THE Firefox extension; its name says neither word) — so never conclude absence from an unpicked top-30; the script tags such rows `[KW]`/`[DESC]`. Precision comes from vetting, not from narrowing queries.
- Never trust npm `searchScore` ordering — it measures text relevance, not popularity (a 690/mo package can outscore a 43K/mo one and vanish past pagination). The fan-out script's table is already the merged union ranked by `downloads.monthly` desc; vet in table order and never re-order by score.
- Never emit raw registry/GitHub JSON into tool output: a size=100 registry response is 200–400KB and truncation fabricates complete-looking but partial result sets. All npm fan-out runs through `references/npm-search.mjs`; GitHub calls project fields with `--jq`.
- Fan-out, dedupe, and ranking run in the script, never in model memory — hand-transcribed merges drift. The model reads only the bounded merged table.
- Treat the coverage header as ground truth: a failed query is a coverage gap to report, not a smaller result set to ignore.
- Always merge in both no-term keyword sweeps as a safety net regardless of how many scoped hits return; scoped-result count is not evidence of coverage.
- Never recommend from raw search output; pass every candidate through the vetting step first.
- Treat GitHub stars alone as insufficient proof a repo is a pi package; require README pi mention, a `package.json` `pi` key, or a `pi-` name prefix.
- Never run `pi install` without explicit user approval; always state that packages run with full system access when recommending third-party installs, and offer to vet the repo first with an available code-security scan skill (e.g. `ghost-scan-code`) or equivalent review.
- Do not call `https://pi.dev/api/*`; it is reserved and returns errors.
- Fall back to the running agent's web search tool only after npm, GitHub, and the catalog all return nothing relevant, and only if such a tool exists in the current session; skip silently and say so otherwise.

## Decision Gates

| Need | Surface | Command |
| --- | --- | --- |
| Need-driven search | bundled fan-out script | `node <skill-dir>/references/npm-search.mjs <t1> [t2 t3]` — terms × both keywords at size=100 + both sweeps + pi.dev catalog cross-check per term (new names auto-probed & merged), all in parallel; prints a single `Coverage:` line (query failures, catalog merges, probe finds, star-resolution incl. rate-limit advisories) + union ranked by downloads with normalized https repo URLs, GitHub-star column, and relevance tags `[EXACT]`/`[KW]`/`[DESC]` |
| Browse / what's popular | same script, zero terms | `node <skill-dir>/references/npm-search.mjs` — keyword sweeps only, top 30 by downloads |
| Catalog link / browse UI | pi.dev/packages | `https://pi.dev/packages?name=<text>&type=extension\|skill\|theme\|prompt&page=N` — case-insensitive substring on name, description, OR author; HTML only, no JSON API; extract with `curl -s "<url>" \| grep -oE 'pi install npm:[^<]+' \| sort -u` |
| Git-only or pre-npm | GitHub topics + text | per topic: `gh api "search/repositories?q=topic:pi-package+<term>+in:name,description&per_page=30" --jq '.items[] \| [.full_name,.stargazers_count,((.description//"")[0:80])] \| @tsv'`, repeat with `topic:pi-extension`; drop `+<term>` for sweeps |
| Last resort: sources empty | Agent web search (if available) | query `<need> pi coding agent extension/package` site-agnostic; vet results by the same gates — many hits will be for other agents' extensions |

## Execution Steps

1. Restate the user's need as 2-4 synonym terms covering plural/singular/hyphenated forms. Fire the whole npm fan-out in one call: `node <skill-dir>/references/npm-search.mjs <t1> <t2> <t3>` — it runs every scoped query plus both safety sweeps in parallel and returns a coverage header plus a deduped union ranked by `downloads.monthly`.
2. In the same parallel batch, run both GitHub topic+text queries (`--jq`-compacted). Check the script's coverage line first: report any FAILED query as a gap instead of silently trusting the pool. If the stars line reports RATE-LIMITED (gh absent + unauthenticated quota exhausted), tell the user and suggest installing the GitHub CLI and running `gh auth login` for reliable star data.
3. Vet candidates from the merged tables only: prefer ≥1K monthly downloads but never drop a candidate for low downloads alone — an `[EXACT]`/`[KW]`/`[DESC]` intent match below 1K gets presented flagged `(experimental, published <6mo)`, not hidden. Weigh repo stars as the secondary traction signal for niche packages (e.g. 292/mo from a 95★ shared extensions repo is credible; a similar count on a 2★ personal repo is not); flag last-publish date older than 6 months; open repo URL to confirm it is a real pi package addressing the stated need. For direct registry lookups — dates or following a "fork of @x/y" clue — append the package name as an argument (`node <skill-dir>/references/npm-search.mjs @x/y`): bare packuments run 200KB+ and must never reach tool output.
4. If plausible matches are still missing after the automatic catalog cross-check, try adjacent synonyms before resorting to web search.
5. Present findings per Output Contract.
6. On approval, install. **npm form is always preferred** — every script-table row is npm-published by construction: `pi install npm:<pkg>` (`@ver` pins version, `-l` writes project-local, `pi -e` tries once without persisting). Offer `pi install git:github.com/u/r@<ref>` only for candidates proven absent from npm, and raw clone+build steps only when package docs demand them (state why).

## Output Contract

Return one numbered block per candidate with exactly these elements:
1. `N. name [EXACT?] — description (downloads/mo or git-only, ★stars, npm|git)`
2. Install: `pi install npm:<pkg>` first; a git install line only when the package has no npm presence
3. Links: the full `https://github.com/<owner>/<repo>` URL from the table plus `https://pi.dev/packages?name=<pkg>` — always both, always https
Then follow with the system-access security note offering a pre-install repo scan via an available code-security skill (e.g. `ghost-scan-code`). If nothing passes vetting, try the web-search fallback (when available), then say so and offer direct help without a package.

## References

- `references/npm-search.mjs` — parallel npm fan-out (synonym terms × both keywords at size=100 + safety sweeps + automatic pi.dev catalog cross-check), four relevance tiers (`[EXACT]` name-equality modulo `pi-` prefix, substring name-match, keyword match, description match), term-as-package probing for index lag, GitHub-star enrichment (cache → gh → unauthenticated curl fallback, rate-limit advisory surfaced in the Coverage line), normalized https repo URLs, dedupe, downloads-ranked bounded table. Args containing `/` fetch single-package info lines instead of raw packuments. Requires node + curl; gh optional but improves star reliability.
