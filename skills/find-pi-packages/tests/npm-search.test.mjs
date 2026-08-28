// npm-search.test.mjs — deterministic unit tests for the find-pi-packages lib.
// Run: node --test tests/npm-search.test.mjs  (no network needed)
// Live integration canary lives in tests/integration.canary.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normRepo,
  isLoosePiCandidate,
  normName,
  normCatalogTerm,
  exactNameMatch,
  keywordMatch,
  descMatch,
  extractCatalogCandidates,
  ghSlug,
  ghNameVariants,
  searchResetWaitMs,
} from "../references/npm-search-lib.mjs";

// ---- normRepo --------------------------------------------------------------

test("normRepo: canonicalizes repo URLs to https", () => {
  assert.equal(normRepo("git+https://github.com/a/b.git"), "https://github.com/a/b");
  assert.equal(normRepo("git@github.com:a/b.git"), "https://github.com/a/b");
  assert.equal(normRepo("http://github.com/a/b"), "https://github.com/a/b");
  assert.equal(normRepo("https://github.com/a/b"), "https://github.com/a/b");
  assert.equal(normRepo(""), "");
  assert.equal(normRepo(undefined), "");
});

// ---- isLoosePiCandidate (incident #11 — bare-pi population) -----------------

const pkg = (name, keywords, description) => ({ name, keywords, description });

test("isLoosePiCandidate: pi- prefix admits", () => {
  assert.equal(isLoosePiCandidate(pkg("pi-crof-provider", ["pi", "extension", "crofai"], "CrofAI provider")), true);
});

test("isLoosePiCandidate: @scope/pi- name admits", () => {
  assert.equal(isLoosePiCandidate(pkg("@earendil-works/pi-protocol", ["pi"], "")), true);
});

test("isLoosePiCandidate: strict keywords admit", () => {
  assert.equal(isLoosePiCandidate(pkg("anything", ["pi-package"], "")), true);
  assert.equal(isLoosePiCandidate(pkg("anything", ["pi-extension"], "")), true);
});

test("isLoosePiCandidate: bare pi keyword admits non-stdlib", () => {
  assert.equal(isLoosePiCandidate(pkg("some-tool", ["pi"], "")), true);
});

test("isLoosePiCandidate: @stdlib math-pi noise rejected", () => {
  assert.equal(isLoosePiCandidate(pkg("@stdlib/constants-float64-pi", ["pi", "math"], "Pi constant")), false);
});

test("isLoosePiCandidate: description mentions pi coding agent", () => {
  assert.equal(isLoosePiCandidate(pkg("crofai", [], "A pi coding agent provider extension")), true);
  assert.equal(isLoosePiCandidate(pkg("crofai", [], "pi extension for models")), true);
  assert.equal(isLoosePiCandidate(pkg("crofai", [], "Pi constant math library")), false);
});

test("isLoosePiCandidate: nothing relevant rejects", () => {
  assert.equal(isLoosePiCandidate(pkg("math-lib", ["math"], "Constants")), false);
});

// ---- normName / normCatalogTerm ----------------------------------------------

test("normName: strips pi- prefix", () => {
  assert.equal(normName("pi-crof"), "crof");
  assert.equal(normName("crof"), "crof");
});

test("normCatalogTerm: strips pi- and -provider", () => {
  assert.equal(normCatalogTerm("pi-crof-provider"), "crof");
  assert.equal(normCatalogTerm("pi-crof"), "crof");
  assert.equal(normCatalogTerm("crof"), "crof");
  assert.equal(normCatalogTerm("pi-crofai-provider"), "crofai");
});

// ---- exactNameMatch (E3 cache-warm [EXACT] tier) -----------------------------

test("exactNameMatch: identity", () => {
  assert.equal(exactNameMatch("cache-warm", ["cache-warm"]), true);
});

test("exactNameMatch: modulo pi- prefix", () => {
  assert.equal(exactNameMatch("pi-crofai", ["crofai"]), true);
  assert.equal(exactNameMatch("crofai", ["pi-crofai"]), true);
});

test("exactNameMatch: -provider suffix does NOT count as exact (incident #11)", () => {
  // pi-crof-provider is not an exact name match for term `crof` — it enters via
  // the loose-keyword tier, never by pretending the suffix is identity.
  assert.equal(exactNameMatch("pi-crof-provider", ["crof"]), false);
});

test("exactNameMatch: no match", () => {
  assert.equal(exactNameMatch("pi-mcp-adapter", ["crof"]), false);
});

// ---- keywordMatch / descMatch (E8 pire-browser [KW]/[DESC] tiers) ------------

test("keywordMatch: term appears verbatim among keywords", () => {
  assert.equal(keywordMatch(["firefox", "browser"], ["firefox"]), true);
  assert.equal(keywordMatch(["firefox"], ["browser"]), false);
  assert.equal(keywordMatch(undefined, ["browser"]), false);
});

test("descMatch: term appears in full lowercase description", () => {
  assert.equal(descMatch("cross-platform pi extension for firefox control", ["firefox"]), true);
  assert.equal(descMatch("math constants", ["firefox"]), false);
});

// ---- extractCatalogCandidates -------------------------------------------------

test("extractCatalogCandidates: npm: form", () => {
  const html = '<span>pi install npm:pi-crofai</span><span>pi install npm:pi-free</span>';
  assert.deepEqual(extractCatalogCandidates(html), ["pi-crofai", "pi-free"]);
});

test("extractCatalogCandidates: github https install kept as git-only candidate", () => {
  const html = 'pi install https://github.com/monotykamary/pi-crofai-provider';
  const out = extractCatalogCandidates(html);
  assert.ok(out.includes("https://github.com/monotykamary/pi-crofai-provider"));
});

test("extractCatalogCandidates: git: prefix normalized to https", () => {
  const html = 'pi install git:https://github.com/a/pi-foo.git';
  const out = extractCatalogCandidates(html);
  assert.ok(out.includes("https://github.com/a/pi-foo.git"));
});

test("extractCatalogCandidates: pi- repo base derived as npm guess", () => {
  const html = 'pi install https://github.com/owner/pi-great';
  const out = extractCatalogCandidates(html);
  assert.ok(out.includes("https://github.com/owner/pi-great"));
  assert.ok(out.includes("pi-great"));
});

test("extractCatalogCandidates: non-pi repo base not derived", () => {
  const html = 'pi install https://github.com/owner/crofai';
  const out = extractCatalogCandidates(html);
  assert.deepEqual(out, ["https://github.com/owner/crofai"]);
});

test("extractCatalogCandidates: dedupes", () => {
  const html = 'pi install npm:pi-a pi install npm:pi-a';
  assert.deepEqual(extractCatalogCandidates(html), ["pi-a"]);
});

// ---- ghSlug -------------------------------------------------------------------

test("ghSlug: extracts owner/repo", () => {
  assert.equal(ghSlug("https://github.com/nicobailon/pi-mcp-adapter"), "nicobailon/pi-mcp-adapter");
  assert.equal(ghSlug("https://github.com/a/b.git"), "a/b");
  assert.equal(ghSlug("git@github.com:a/b"), "a/b");
});

test("ghSlug: non-GitHub returns null", () => {
  assert.equal(ghSlug("https://gitlab.com/a/b"), null);
  assert.equal(ghSlug(""), null);
  assert.equal(ghSlug(undefined), null);
});

// ---- ghNameVariants (incident #12 — GitHub-enrichment backfill) ------------------

test("ghNameVariants: pi-crof-provider includes stripped and alias forms", () => {
  const v = ghNameVariants("pi-crof-provider");
  assert.ok(v.includes("pi-crof-provider"));
  assert.ok(v.includes("crof"));
  assert.ok(v.includes("pi-crof"));
  assert.ok(v.includes("pi-crofai-provider"));
  assert.ok(v.includes("crofai"));
  assert.ok(v.includes("pi-crofai"));
  // deduped
  assert.equal(v.length, new Set(v.map(s => s.toLowerCase())).size);
});

test("ghNameVariants: pi-crofai-provider alias inverse", () => {
  const v = ghNameVariants("pi-crofai-provider");
  assert.ok(v.includes("pi-crofai-provider"));
  assert.ok(v.includes("crofai"));
  assert.ok(v.includes("pi-crofai"));
  assert.ok(v.includes("pi-crof-provider"));
  assert.ok(v.includes("crof"));
});

test("ghNameVariants: non-crof name does not get alias", () => {
  const v = ghNameVariants("pi-mcp-adapter");
  assert.ok(v.includes("pi-mcp-adapter"));
  assert.ok(v.includes("mcp-adapter"));
  assert.ok(!v.some(s => /crof/i.test(s)));
  assert.equal(v.length, new Set(v.map(s => s.toLowerCase())).size);
});

test("ghNameVariants: crof-provider stripped and alias", () => {
  const v = ghNameVariants("crof-provider");
  assert.ok(v.includes("crof-provider"));
  assert.ok(v.includes("crof"));
  assert.ok(v.includes("pi-crof"));
  assert.ok(v.includes("crofai-provider"));
});

test("ghNameVariants: dedupes case-insensitively", () => {
  const v = ghNameVariants("pi-crof");
  // pi-crof + crof + aliases
  assert.ok(v.includes("pi-crof"));
  assert.ok(v.includes("crof"));
  assert.ok(v.includes("pi-crofai"));
  assert.ok(v.includes("crofai"));
});

// ---- searchResetWaitMs (gh search 30/min quota pacing) ------------------------

test("searchResetWaitMs: healthy remaining waits nothing", () => {
  assert.equal(searchResetWaitMs(30, 1_800_000, 1_799_000), 0);
  assert.equal(searchResetWaitMs(3, 1_800_000, 1_799_000), 0);
});

test("searchResetWaitMs: low remaining with close reset waits until reset + 1s", () => {
  // reset in 30s -> 31_000 ms
  assert.equal(searchResetWaitMs(2, 1_800_030, 1_800_000), 31_000);
  assert.equal(searchResetWaitMs(0, 1_800_060, 1_800_000), 61_000);
});

test("searchResetWaitMs: low remaining with far reset waits nothing", () => {
  // reset in 5 minutes -> too far, caller should skip backfill
  assert.equal(searchResetWaitMs(1, 1_800_300, 1_800_000), 0);
  assert.equal(searchResetWaitMs(0, 1_800_000, 1_799_000), 0); // wait > 60s
});
