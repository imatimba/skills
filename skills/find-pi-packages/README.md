# find-pi-packages

Finds, vets, and compares packages for the pi coding agent: extensions, skills, prompt templates, and themes, from npm and GitHub.

## When to use

Ask for this skill when you need to find, search, install, or browse pi packages, or compare candidates before installing.

## Install

```bash
npx skills add imatimba/skills --skill find-pi-packages
```

## What's inside

| Path | Purpose |
| --- | --- |
| `SKILL.md` | The agent contract: activation, hard rules, decision gates, output format. |
| `references/npm-search.mjs` | npm fan-out search script. Needs Node 18+ (built-in fetch); logged-in gh recommended for avoiding rate limits. |
| `references/npm-search-lib.mjs` | Pure decision helpers, unit-tested. |
| `references/design-notes.md` | Measured facts and rationale behind the rules. |
| `tests/npm-search.test.mjs` | Deterministic unit suite, no network. |
| `tests/integration.canary.mjs` | Live API canary; self-skips unless `RUN_LIVE=1`. |

## Getting better results

The search runs against npm, the pi.dev catalog, and GitHub topics, and ranks by monthly downloads. What comes back depends mostly on how you phrase the need.

- **Describe the task, not a package name.** "I need to keep the pi cache warm between sessions" beats "search for cache-warm". The skill derives search terms from your need and expands them into synonyms (subagent, subagents, sub-agent).
- **Add synonyms and context.** Alternate phrasings plus the surrounding context (language, environment, what it integrates with) give the skill more terms to work with.
- **Name your constraints.** Download volume, age, stars, or "must be actively maintained" changes how candidates are vetted.
- **If you already know a candidate, say so.** The skill can check a specific name directly instead of searching.
- **Relevance often lives in the description, not the name.** A package named after its internals can still be the right pick. Results are ranked by downloads, not by name match.

## Scanning before install

Packages run with full system access. Before installing, you can have an agent scan the candidate with a code-security skill, for example [ghost-scan-code](https://github.com/ghostsecurity/skills), a SAST scanner that audits source for injection, XSS, SSRF, and similar issues.

## Testing

```bash
node --test tests/npm-search.test.mjs
RUN_LIVE=1 node --test tests/integration.canary.mjs
npx oxlint --deny-warnings
```

CI runs the unit suite and lint on every push and pull request.