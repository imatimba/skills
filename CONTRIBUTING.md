# Contributing

This repo is a collection of agent skills for the pi coding agent. Each skill lives in its own directory under `skills/`.

## Layout

```
skills/
  <name>/
    SKILL.md        agent contract: activation, rules, gates, output
    README.md       human-facing: what, when, install, layout, testing
    references/     binding rules and tooling
    tests/          test suites
```

`SKILL.md` is what agents load. It is the source of truth for skill behavior. The README is for humans and never restates the contract, so the two cannot drift.

## Modifying a skill

- Change the behavior in `SKILL.md` and its `references/`. The references hold the binding rules; SKILL.md routes to them.
- Update the README only when the user-facing picture changes: what the skill does, how to install it, how to test it.
- Add or update tests for any code the skill ships, including new edge cases covered by the introduced change.
- Bump `metadata.version` in `SKILL.md` with every change.

## Testing

find-pi-packages ships a deterministic unit suite and a live canary:

```bash
cd skills/find-pi-packages
node --test                        # unit suite, no network
RUN_LIVE=1 node --test tests/integration.canary.mjs   # live APIs, may flake
```

CI runs the non-live unit suite on every push and pull request.

New edge cases found while modifying find-pi-packages get a unit test. Record the rationale in `references/design-notes.md`, which maps every rule to a measured failure.

## Commits

Conventional commits with the skill as scope, for example `docs(userscripts): ...`, `fix(find-pi-packages): ...`.