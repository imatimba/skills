// integration.canary.mjs — LIVE canary against the real npm/pi.dev/GitHub APIs.
// Run: node --test tests/integration.canary.mjs   (network required; may be flaky under rate limits)
// Skips itself when RUN_LIVE is not set, so unit-only runs stay deterministic:
//   node --test tests/  → canary self-skips
//   RUN_LIVE=1 node --test tests/  → canary runs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";

const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, "..", "references", "npm-search.mjs");

const search = async (...args) => {
  const { stdout } = await run("node", [SCRIPT, ...args], { maxBuffer: 1024 * 1024, timeout: 240_000 });
  return stdout;
};

test("live canary", { skip: process.env.RUN_LIVE !== "1" }, async () => {
  // Incident #11: crof fan-out must surface pi-crof-provider with real downloads.
  const fan = await search("crof", "nahcrof", "crofai", "crof-ai");
  const row = fan.split("\n").find(l => l.includes("| pi-crof-provider"));
  assert.ok(row, "pi-crof-provider missing from crof fan-out:\n" + fan);
  const dl = row.split("|")[0].trim().replace(/,/g, "");
  assert.ok(/^\d+$/.test(dl) && Number(dl) > 0, `pi-crof-provider downloads not real: ${row}`);
  // Incident #12: GitHub-enrichment backfill — repo-less pi-crof-provider must now resolve to GH repo.
  assert.ok(row.includes("github.com/monotykamary/pi-crofai-provider"), `pi-crof-provider row missing GH repo link: ${row}`);
  assert.ok(/\| gh \|/.test(row), `pi-crof-provider row src not gh: ${row}`);
  assert.ok(/\| 4 \| gh/.test(row) || /\| 4 \|/.test(row), `pi-crof-provider stars not 4: ${row}`);

  // Coverage line must not report phantom FAILs (probe 404-classification fix).
  const cov = fan.split("\n").find(l => l.startsWith("Coverage:"));
  assert.ok(cov && !cov.includes("FAILED"), `coverage gaps present:\n${cov}`);

  // No @stdlib math-pi noise in the fan-out table.
  const stdlib = fan.split("\n").filter(l => l.includes("@stdlib/"));
  assert.equal(stdlib.length, 0, `@stdlib noise leaked into table:\n${stdlib.join("\n")}`);

  // Exact-name lookup still works and carries the [EXACT] tag.
  const exact = await search("pi-crof-provider");
  assert.ok(exact.includes("pi-crof-provider [EXACT]"), "exact-name lookup lost [EXACT] tag");
  // Incident #12: exact lookup must also be GH-enriched (repo-less backfill)
  const exactRow = exact.split("\n").find(l => l.includes("| pi-crof-provider"));
  assert.ok(exactRow && exactRow.includes("github.com/monotykamary/pi-crofai-provider"), `exact pi-crof-provider row missing GH repo: ${exactRow}`);
  assert.ok(exactRow && /\| gh \|/.test(exactRow), `exact pi-crof-provider src not gh: ${exactRow}`);

  // Output stays bounded (MAX_LINES=70 cap; ~50KB generous bound for 15-query fan-out).
  assert.ok(Buffer.byteLength(fan) < 50_000, `fan-out output too large: ${Buffer.byteLength(fan)}B`);

  // Regression E8: pire-browser must still surface as [KW] for firefox terms.
  const e8 = await search("firefox", "firefox-profile", "browser-control", "browser-automation");
  assert.ok(e8.includes("pire-browser [KW]"), "E8 regression: pire-browser [KW] missing");
});
