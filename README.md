# Agent skills, installable with npx skills.

A small collection of agent skills. Each skill lives in its own directory under `skills/` and ships as a `SKILL.md` plus its reference files.

## Install

Requires Node.js (npx).

Install all skills:

```bash
npx skills add imatimba/skills
```

Install one skill:

```bash
npx skills add imatimba/skills --skill find-pi-packages
```

## Skills

| Skill | What it does | README |
| --- | --- | --- |
| `find-pi-packages` | Search and vet pi packages (extensions, skills, themes, prompts) from npm and GitHub. | [README](skills/find-pi-packages/README.md) |
| `userscripts-development` | Write and debug userscripts for any manager (Violentmonkey, Tampermonkey, Greasemonkey, Safari). **(WIP)** | [README](skills/userscripts-development/README.md) |

## Layout

```
skills/
  <name>/
    SKILL.md        agent-facing contract
    README.md       human-facing overview
    references/     binding rules and tooling
    tests/          test suites
```

`SKILL.md` is the contract agents load. The READMEs are for humans: what each skill does, how to install it, and how to test it.