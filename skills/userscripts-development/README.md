# userscripts-development

Writes and debugs userscripts for any manager: Violentmonkey, Tampermonkey, Greasemonkey, ScriptCat, and the Safari Userscripts app. Covers metadata headers, GM APIs, matching, sandboxing, publishing, and testing.

## When to use

Ask for this skill when you want to modify a page with a userscript, fix or extend an existing script, port one between managers, or write any `.user.js` with `@match`, `@grant`, or GM APIs.

## Install

```bash
npx skills add imatimba/skills --skill userscripts-development
```

## What's inside

`SKILL.md` is a router. The binding rules live in `references/`, organized in three groups:

- **Core** covers managers, header reference, URL matching, sandbox modes, and patterns.
- **APIs** has one file per GM API area: storage, HTTP, DOM, tabs, cookies, audio.
- **Quality & tooling** covers pitfalls, publishing, debugging, testing, browser compatibility, security, versioning, and TypeScript.

## Testing

No manager publishes an official testing guide. The pattern below is community practice.

Split tests in two layers:

- **End-to-end (recommended)** in a real manager. Load the manager extension into headless Chromium and drive it with Playwright or Puppeteer. Old headless mode does not support extensions, use `--headless=new` or `xvfb-run`.

For stateful behavior (CSP, storage, `@connect` prompts, logged-in pages), test in a real browser profile. If an AI agent drives that browser, install a bridge that exposes it over CDP or MCP:

- chrome-devtools-mcp, the official Chrome team MCP server
- pi-agent-browser-native, a pi-ecosystem native bridge
- pire-browser, a pi harness for Firefox

Launch Chrome with `--remote-debugging-port=9222` or install a harness extension. Any bridge that keeps your profile intact works.

- **Unit tests** for script logic. Use Vitest with the happy-dom environment and mock the GM APIs with mock-violentmonkey (archived). No manager involved, your logic runs as plain JS.

Details live in `references/testing.md`.