# find-pi-packages: design notes

This file records the rationale behind the rules in `SKILL.md`. Every hard rule traces to a measured failure or a measured fact, and this file is the evidence. Written at v0.10.0, updated since.

## Core design idea

Division of labor: the script (`references/npm-search.mjs`) owns **mechanics** (query fan-out, merging, dedupe, ranking, output bounding, star enrichment, rate-limit detection); the model (`SKILL.md`) owns **judgment** (term derivation, relevance vetting, security gating, presentation, install approval). Every failure class found during development traces back to violating this split: model-improvised mechanics caused truncation-fabricated results; ranking-decided relevance caused intent-blind misses.

## Measured facts (verified live, 2026-08)

| Fact | Value | Rule it forces |
| --- | --- | --- |
| Dual-keyword gap | ~34% of npm packages carry only ONE of `pi-package`/`pi-extension`; ~44% of GitHub repos carry one topic | Search both keywords, separate queries |
| Bare-`pi` population | ~35% of `keywords:pi` hits carry NEITHER `pi-package` nor `pi-extension` (live 2026-08-27: 100-row `keywords:pi` sample → 65 dual-tagged, ~35 bare-`pi`-only incl. `@earendil-works/pi-protocol`, `@ai-sdk/harness-pi`; registry has no keyword OR; bare `pi` is the natural author choice per npm docs) | Loose `keywords:pi` + client-side post-filter; strict hits bypass filter |
| Registry keyword AND | `keywords:a,b` returns only dual-tagged packages (verified 50/50); no OR syntax exists | Never fold keywords into one query |
| `searchScore` semantics | Text relevance, NOT popularity: 690/mo package outscored the 43K/mo original and vanished past pagination | Downloads-ranked union; never re-sort by score |
| Response sizes | size=100 search: 200 to 400KB; bare packument: 200KB+ (measured 200,225 B) | Script-bounded table (MAX_LINES=70 ≈ 14KB worst case); single-package mode |
| pi.dev catalog | Server-side substring on name+description+author via `?name=&type=&page=`; HTML only, `/api/*` reserved; page 1 = 50 rows/term | Automatic cross-check per term; page-2+ blind spot documented, accepted |
| GitHub topics | ~56% first-page overlap between `pi-package`/`pi-extension`; unqualified text terms do NOT search readme; stars ≠ identity proof | Manual gh gate; README/`pi` key/name-prefix proof rule |

## Incident registry (incident → root cause → fix)

| # | Incident | Root cause | Fix |
| --- | --- | --- | --- |
| 1 | 43K/mo `@tintinweb/pi-subagents` missed for "subagents" | npm scored it rank 74 to 75 behind low-download text matches; size=20 paginated it out; sweep fallback was conditional | size=100 + unconditional sweeps + downloads re-rank |
| 2 | Same package invisible even at size=100 on one keyword | Pagination depth varies per query; sweeps are the real guarantee | Sweeps became the guarantee, never optional |
| 3 | 2-day-old exact-intent match missed ("keep cache warm") | Compound term split into `cache`+`warm`; popularity filled slots first | Hyphenated-compound term rule + `[EXACT]` tier bypassing popularity |
| 4 | Stars column all `-` on second run | Unauthenticated GitHub API 60/hr/IP exhausted | Cache → gh → curl ladder with 24h cache |
| 5 | Rate limit undetectable | curl `-s` suppresses errors; execFile puts stderr on `e.stderr`, not `e.message` | Capture status via `-w "\n%{http_code}"`, classify 403/429 explicitly |
| 6 | Single stray 403 triggered full alarm | Severity not scope-matched | Strong advisory only at 0/N resolved; soft suffix otherwise |
| 7 | Date vetting fetched bare packuments | The skill's own no-raw-JSON rule reintroduced through vetting | Single-package compact mode |
| 8 | THE Firefox control extension missed because its name says neither "firefox" nor any derived term | All tiers were name-based; relevance lived in keywords/description | `[KW]`/`[DESC]` tiers from stored keywords/full description + tags |
| 9 | Transient failures returned `pool: 0`, looking like an empty ecosystem | Network flakiness indistinguishable from true emptiness | Coverage header with ok/x + FAILED list; hard rule forces gap reporting |
| 10 | Hand-written merges drifted between turns | Model memory is lossy for 300+ row unions | Merges moved into the script; model reads final table only |
| 11 | `pi-crof-provider` (4,819/mo, ★3) missed for `crof|crofai` fan-out; top CrofAI provider invisible | Keyword gate assumed authors use `pi-package`/`pi-extension`; package uses bare `pi` (`keywords:["pi","extension",…]`). Rescue layers name-bound (no `pi-${term}` synthesis, catalog regex missed `pi install https://github.com/...`) and probe 404-classification bug (`String(e).includes("exit code 22")` never matches Node `execFile` errors; `e.code` holds the exit code, so every 404 probe reported phantom `FAIL`) masked probe health | Loose `keywords:pi` per term + sweep with client-side post-filter (`pi-` prefix / `@scope/pi-…` / `pi` keywords / `pi coding agent|pi extension|for pi\b`); probe status-classification via `curl -sS -w "%{http_code}"` (404 silent, 5xx/timeout one retry → FAILED), real downloads via `api.npmjs.org`; probe synthesis `pi-${term}`, `pi-${term}-provider`, `pi-${term}ai`; catalog regex `pi install (?:npm:…|https://github.com/…)` + `?name=norm(term)` retry (`pi-`/`-provider` strip) |
| 12 | `pi-crof-provider` (4,812/mo, ★4) GitHub-enrichment miss: repo-less npm package, name-mismatched GH repo (`pi-crof-provider` vs `pi-crofai-provider`), silent `src -`/`repo -` gap | Enrichment single-channel (`p.links.repository`/`homepage` only); name-mismatch hides `gh api search` fallback; catalog `pi.dev/packages?name=pi-crof-provider` has no per-package github link; coverage stays green (enrichment gap, not query gap) | GH search backfill for repo-less picks: synthesize variants (`npm name`, `normCatalogTerm`, `pi-${norm}`, `crof`↔`crofai` alias) ≤3 GH `search/repositories?q=<variant>+in:name` calls + ≤3 `raw.githubusercontent.com/<slug>/main/package.json` verifies (name equality, 1-star credibility filter, per-run cache), then star enrichment picks up new repo; guardrail annotation `(no repository field; verify source via README, experimental)` for rows that remain repo-less after backfill (legend updated) |

## Decisions & rejected ideas

| Decision | Why |
| --- | --- |
| Ship a script inside the skill | LLM-improvised curl pipelines caused every truncation/drift failure; a script is reviewable once and deterministic forever |
| Bounded merged table, not raw JSON | Truncated JSON fabricates complete-looking partial result sets, which is worse than no data |
| Unconditional safety sweeps | 20 healthy-looking scoped hits can hide rank-75 gold; coverage is never conditional |
| npm-first install preference | Structural: only registry-probed packages enter the pool, so every table row IS on npm; git installs only for proven-absent candidates |
| gh optional with graceful degradation | node+curl stay portable; gh lifts quota 60/hr → 5K/hr; ladder ends in an actionable advisory, never silent dashes |
| Catalog cross-check automatic | Conditional-on-thin-results failed when pools looked healthy; the catalog's engine differs and catches score pathologies + index lag |
| `<skill-dir>` path convention | Skills install to multiple roots; hardcoded paths break relocation and the whole fan-out |
| Security posture | Packages execute with full system access (official warning): explicit user approval mandatory, security note mandatory, pre-install SAST scan offered |
| Manual downloads in /tmp | Any manual clone/download/build during vetting or install runs in a `mktemp -d` scratch dir, never cwd or home: agents drift toward saving files where they sit, and stray repos in user directories are worse than the package being scanned |
| Web search last resort only | Noisiest surface; cannot feed downloads/date vetting; gated on tool existence for agent portability |

Rejected on purpose. Do not resurrect without new evidence:
disk caching of search pools (stale-data risk outweighs latency), multi-page catalog crawling (complexity not worth it; npm-side tiers mitigate), scripting the GitHub gate (gh auth/topology varies more than npm; candidates from there need manual vetting anyway).

## Tests (v0.12.3)

The decision logic lives in `references/npm-search-lib.mjs` (pure, no I/O) so it is unit-testable; `references/npm-search.mjs` imports it and stays the only network-touching surface.

```bash
# Unit suite: deterministic, no network (29 tests). Covers post-filter, name/catalog norm,
# exact/[KW]/[DESC] tiers, catalog extraction, ghSlug, repo norm, ghNameVariants.
node --test tests/npm-search.test.mjs
# same via auto-discovery (unit files only; canary not matched by default patterns)
node --test

# Lint gate (CI): zero-config oxlint, warnings fail the build.
npx oxlint --deny-warnings

# Live integration canary. Hits real npm/pi.dev/GitHub APIs; may flake under rate limits.
# Asserts: pi-crof-provider surfaces with real downloads (incident #11), GH-enriched
# repo link + gh src (incident #12), no phantom FAILED coverage gaps, no @stdlib noise,
# [EXACT] exact-name mode, output bound, E8 pire-browser.
RUN_LIVE=1 node --test tests/integration.canary.mjs
```

Test-to-incident mapping: post-filter → #11, exact tiers → #3, [KW]/[DESC] → #8, probe/canary coverage → #9, output bound → #7, name-vs-keyword relevance → #8/#11, GH backfill + guardrail → #12. The canary doubles as the §8 CI smoke test against live registry APIs.
