#!/usr/bin/env node
// Parallel pi-package npm registry search — bounded output, resilient merges.
// Usage: node npm-search.mjs <term> [<term>...]   (synonym variants; ascii, no spaces)
// Emits: coverage header + ranked union table (top N by downloads + all name-matches).
// Raw registry JSON is 200-400KB per query; this script NEVER lets it reach stdout.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";
import { normRepo, isLoosePiCandidate, normCatalogTerm, extractCatalogCandidates, exactNameMatch, keywordMatch, descMatch, ghSlug, ghNameVariants, searchResetWaitMs, probeRecordFromSearch } from "./npm-search-lib.mjs";
const run = promisify(execFile);

// HTTP transport: Node built-in fetch (Node 18+). Keep-alive connections and gzip
// come free, no subprocess per request; curl's --max-time becomes AbortSignal.timeout
// and res.status replaces the trailing-http_code parsing. Callers check res.ok/status;
// a fetch rejection (network, DNS, timeout) still surfaces through each try/catch below.
const UA = "find-pi-packages-search (https://github.com/imatimba/skills)";
// GitHub token, resolved ONCE per run (best-effort `gh auth token`); every GitHub
// REST call below reuses it via ghFetch instead of spawning `gh api` per call.
let ghToken = null;
async function httpGet(url, opts = {}) {
  return fetch(url, {
    headers: { "user-agent": UA },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 12000),
  });
}
// GitHub REST over keep-alive fetch: authed (5K/hr) when a token resolved,
// unauthenticated (60/hr/IP) otherwise. Callers keep the 403/429 → ghRateLimited
// backstop; a fetch rejection (network, DNS, timeout) surfaces via try/catch.
async function ghFetch(url, opts = {}) {
  const headers = { "user-agent": UA, accept: "application/vnd.github+json" };
  if (ghToken) headers.authorization = `Bearer ${ghToken}`;
  return fetch(url, {
    headers,
    signal: AbortSignal.timeout(opts.timeoutMs ?? 10000),
  });
}
async function httpGetText(url, opts = {}) {
  const res = await httpGet(url, opts);
  return { status: res.status, body: await res.text() };
}
if (typeof fetch !== "function") {
  console.error("ERROR: this script needs Node 18+ (built-in fetch). Node 18 or newer is required.");
  process.exit(3);
}

const STRICT_KWS = ["pi-package", "pi-extension"];
const LOOSE_KW = "pi";
const SIZE = 100;
const TOP = 30;        // always show the TOP heaviest packages
const MAX_LINES = 70;  // hard output bound

const args = process.argv.slice(2).map(s => s.trim()).filter(Boolean);
if (args.some(a => a.startsWith("-"))) {
  console.error("usage: node npm-search.mjs [term...] [pkg...]  no flags; zero terms = sweeps only; args containing '/' = direct package lookups");
  process.exit(2);
}
const pkgs = [...new Set(args.filter(a => a.includes("/")))];
const terms = [...new Set(args.filter(a => !a.includes("/")).map(t => t.toLowerCase()))];

const queries = [];
// Strict scoped queries (term × 2)
for (const t of terms)
  for (const kw of STRICT_KWS)
    queries.push({ tag: `${kw}+${t}`, url: `https://registry.npmjs.org/-/v1/search?text=keywords:${kw}+${encodeURIComponent(t)}&size=${SIZE}`, loose: false });
// Loose scoped queries (term × 1) — safety net for authors using bare `pi` keyword
for (const t of terms)
  queries.push({ tag: `loose:pi+${t}`, url: `https://registry.npmjs.org/-/v1/search?text=keywords:${LOOSE_KW}+${encodeURIComponent(t)}&size=${SIZE}`, loose: true });
// Strict sweeps (unconditional)
for (const kw of STRICT_KWS)
  queries.push({ tag: `sweep:${kw}`, url: `https://registry.npmjs.org/-/v1/search?text=keywords:${kw}&size=${SIZE}`, loose: false });
// Loose sweep (unconditional) — post-filtered
queries.push({ tag: `loose:sweep:pi`, url: `https://registry.npmjs.org/-/v1/search?text=keywords:${LOOSE_KW}&size=${SIZE}`, loose: true });

const pool = new Map();
const failed = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Bounded concurrency for npm search (registry rate-limits bursts of 15+ parallel searches).
async function runLimited(items, fn, limit = 3) {
  let idx = 0;
  const out = Array.from({ length: items.length });
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= items.length) break;
      out[i] = await fn(items[i], i);
      // tiny stagger to smooth bursts
      if (i % limit === limit - 1) await sleep(300);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

const catNew = [];
const fetchCatalogHtml = async term => {
  // pi.dev always returns 200 HTML; non-2xx still counts as a coverage gap
  const res = await httpGet(`https://pi.dev/packages?name=${encodeURIComponent(term)}`, { timeoutMs: 15000 });
  if (!res.ok) throw new Error(`http ${res.status}`);
  return await res.text();
};
const runCatalogCrossCheck = async () => {
  if (!terms.length) return;
  await Promise.all([...new Set(terms)].map(async t => {
    try {
      const html = await fetchCatalogHtml(t);
      const cands = extractCatalogCandidates(html);
      let added = 0;
      for (const m of new Set(cands)) {
        // for git URLs, keep them as catNew but they will be excluded from probes later
        if (!pool.has(m) && !catNew.includes(m)) { catNew.push(m); added++; }
      }
      // second query with normalized term when first added nothing
      if (added === 0) {
        const nt = normCatalogTerm(t);
        if (nt && nt !== t) {
          try {
            const html2 = await fetchCatalogHtml(nt);
            const cands2 = extractCatalogCandidates(html2);
            for (const m of new Set(cands2)) {
              if (!pool.has(m) && !catNew.includes(m)) catNew.push(m);
            }
          } catch (e2) {
            // second catalog query failure is also a coverage gap but don't double-count if first succeeded
            // only report if both failed? We'll report silently; first success means we have some coverage.
            const msg = (e2.message ?? String(e2)).slice(0, 60);
            // don't push failed for norm retry unless it's the only attempt? Keep quiet to reduce noise.
            console.error(`note catalog:${nt} (norm of ${t}): ${msg}`);
          }
        }
      }
    } catch (e) {
      failed.push(`catalog:${t}`);
      console.error(`FAIL catalog:${t}: ${(e.message ?? e).slice(0, 60)}`);
    }
  }));
};

const npmTask = runLimited(queries, async q => {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { status, body } = await httpGetText(q.url, { timeoutMs: 12000 });
      if (status === 429 || (status >= 500 && status < 600)) {
        if (attempt < 3) { await sleep(1500 * attempt); continue; }
        throw new Error(`http ${status}`);
      }
      if (status !== 200) throw new Error(`http ${status}`);
      const objs = JSON.parse(body).objects ?? [];
      for (const o of objs) {
        const p = o.package;
        // Post-filter loose hits: drop noise before it enters the pool. Strict hits bypass.
        // If the name already exists (strict already inserted), keep the loose hit tag unconditionally.
        if (q.loose && !pool.has(p.name) && !isLoosePiCandidate(p)) continue;
        const rec = pool.get(p.name) ?? {
          name: p.name,
          dl: o.downloads?.monthly ?? 0,
          version: p.version,
          repo: normRepo(p.links?.repository ?? p.links?.homepage ?? ""),
          desc: (p.description ?? "").replace(/\s+/g, " ").slice(0, 90),
          kw: (p.keywords ?? []).map(k => String(k).toLowerCase()),
          dfull: (p.description ?? "").toLowerCase(),
          hits: [],
        };
        rec.hits.push(q.tag);
        pool.set(p.name, rec);
      }
      console.error(`ok   ${q.tag}: ${objs.length} rows`);
      break;
    } catch (e) {
      const msg = (e.message ?? String(e)).slice(0, 80);
      // Retry once on transient (429/5xx/network)
      if (attempt < 3 && (msg.includes("http 429") || msg.includes("http 5") || msg.includes("timed out") || msg.includes("Network"))) {
        await sleep(1500 * attempt);
        continue;
      }
      if (attempt < 3 && !msg.includes("http 4")) { await sleep(800); continue; }
      failed.push(q.tag);
      console.error(`FAIL ${q.tag}: ${msg}`);
      break;
    }
  }
}, 6);

await Promise.all([npmTask, runCatalogCrossCheck()]);

const nameHit = r => terms.some(t => r.name.toLowerCase().includes(t));
// Relevance can live outside the name: authors put domain terms in keywords/description
// (e.g. pire-browser is THE firefox extension but its name says nothing about firefox).
const kwHit = r => keywordMatch(r.kw, terms);
const descHit = r => descMatch(r.dfull, terms);
// exact intent match: identity, or modulo the conventional "pi-" prefix
const exactHit = r => exactNameMatch(r.name, terms);

// Catalog cross-check: different matching engine than npm scoring; runs even when
// the npm pool looks healthy — score pathologies and index lag hide from npm only.
// Extraction now captures both npm: and github installs; second query tries norm(term)
// (strip pi- prefix and -provider suffix) when first returns nothing new.

// Probe catalog-only finds + bare terms that might BE package names.
// Catches search-index lag — brand-new packages can be missing or rank-buried in npm search.
// Synthesis (C-lite): when bare term not in pool, also try pi-${term}, pi-${term}-provider, pi-${term}ai
const synth = [];
for (const t of terms) {
  if (!pool.has(t)) {
    const base = t.toLowerCase();
    synth.push(`pi-${base}`);
    synth.push(`pi-${base}-provider`);
    synth.push(`pi-${base}ai`);
  }
}
const rawCandidates = [...catNew, ...terms.filter(t => !pool.has(t)), ...synth];
const probes = [...new Set(rawCandidates)].filter(n => !pool.has(n) && !n.includes("://"));


async function fetchDownloadsForProbe(name) {
  try {
    const res = await httpGet(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(name)}`, { timeoutMs: 10000 });
    if (!res.ok) return -1;
    const j = await res.json();
    if (typeof j.downloads === "number") return j.downloads;
  } catch {}
  return -1;
}

// Probe fast-path: one ~5KB search-index lookup first; indexed packages skip
// the packument + downloads-point pair entirely. probeRecordFromSearch enforces
// exact name equality (search ships fuzzy neighbors); a miss means index lag
// or a truly absent name, and falls through to the packument pair below.
async function fetchProbeSearchHit(name) {
  try {
    const res = await httpGet(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(name)}&size=5`, { timeoutMs: 12000 });
    if (!res.ok) return null;
    const j = await res.json();
    return probeRecordFromSearch(j.objects ?? [], name);
  } catch { return null; }
}

await runLimited(probes, async name => {
  const fast = await fetchProbeSearchHit(name);
  if (fast) {
    pool.set(name, fast);
    console.error(`probe ${name}: FOUND (search) dl=${fast.dl}`);
    return;
  }
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      // Fetch the packument and its download count in parallel: two independent
      // endpoints, one RTT saved per probe. fetchDownloadsForProbe never rejects.
      const [regRes, dl] = await Promise.all([
        httpGetText(`https://registry.npmjs.org/${encodeURIComponent(name)}`, { timeoutMs: 15000 }),
        fetchDownloadsForProbe(name),
      ]);
      const { status, body } = regRes;
      if (status === 200) {
        const j = JSON.parse(body);
        const L = j["dist-tags"]?.latest ?? "?";
        const v = j.versions?.[L] ?? {};
        const kwFromPack = (v.keywords ?? j.keywords ?? []).map(k => String(k).toLowerCase());
        const descFromPack = (j.description ?? v.description ?? "");
        pool.set(name, {
          name,
          dl,
          version: L,
          repo: normRepo(v.repository?.url ?? j.repository?.url ?? v.homepage ?? j.homepage ?? ""),
          desc: descFromPack.replace(/\s+/g, " ").slice(0, 90),
          kw: kwFromPack,
          dfull: descFromPack.toLowerCase(),
          hits: [`probe${catNew.includes(name) ? "+catalog" : ""}`],
        });
        console.error(`probe ${name}: FOUND (merged) dl=${dl}`);
        break;
      } else if (status === 404) {
        // silent not-found — expected for synthesized/nonexistent terms
        break;
      } else if (status >= 500 && status < 600) {
        if (attempt < 2) { await sleep(400); continue; }
        failed.push(`probe:${name}`);
        console.error(`FAIL probe:${name}: http ${status}`);
        break;
      } else {
        // other 4xx (e.g. 429, 400) — treat as real gap
        failed.push(`probe:${name}`);
        console.error(`FAIL probe:${name}: http ${status}`);
        break;
      }
    } catch (e) {
      // network/timeout from fetch
      const msg = (e.message ?? String(e)).slice(0, 80);
      // fetch rejects on network/timeout without a status; treat as transient
      if (attempt < 2) { await sleep(400); continue; }
      failed.push(`probe:${name}`);
      console.error(`FAIL probe:${name}: ${msg}`);
      break;
    }
  }
}, 6);
const ranked = [...pool.values()].sort((a, b) => b.dl - a.dl);
const picks = ranked.slice(0, TOP);
for (const r of ranked) if (!picks.includes(r) && exactHit(r) && picks.length < MAX_LINES) picks.push(r); // exact intent beats popularity
for (const r of ranked)
  if (!picks.includes(r) && nameHit(r) && picks.length < MAX_LINES) picks.push(r);
for (const r of ranked) if (!picks.includes(r) && kwHit(r) && picks.length < MAX_LINES) picks.push(r);
for (const r of ranked) if (!picks.includes(r) && !kwHit(r) && descHit(r) && picks.length < MAX_LINES) picks.push(r);
picks.sort((a, b) => b.dl - a.dl);

// GitHub-search backfill for repo-less picks (incident #12)
// Bounded: ≤3 GH search calls + ≤3 raw package.json verifies per repo-less pick.
// Verify via raw package.json name equality before backfilling; cache verified slugs per-run.
// Respects ghRateLimited flag to avoid hammering when rate-limited.
const repoLessPicks = picks.filter(p => !p.repo && ghNameVariants(p.name).length);
let ghRateLimited = false;
const verifiedCache = new Map(); // slug -> rawName (string|null) cache per run
// Resolve the GitHub token ONCE per run (best-effort); every GitHub REST call
// below reuses it. No per-call `gh api` subprocess spawns.
try {
  const { stdout } = await run("gh", ["auth", "token"], { maxBuffer: 1024 * 1024 });
  const t = stdout.trim();
  if (t) ghToken = t;
} catch { /* no gh or unauthenticated — REST calls proceed unauthenticated */ }
// gh search quota is 30 req/min shared across every search call. Read it
// only when backfill will actually run, then pace so a large fan-out does not
// exhaust the window mid-run (403 backstop below still applies when unauthenticated).
let ghSearchBudget = null;
if (repoLessPicks.length) {
  try {
    const rateRes = await ghFetch("https://api.github.com/rate_limit", { timeoutMs: 10000 });
    if (rateRes.ok) {
      const rateJson = await rateRes.json();
      const remaining = rateJson?.resources?.search?.remaining;
      const reset = rateJson?.resources?.search?.reset;
      if (typeof remaining === "number" && typeof reset === "number") ghSearchBudget = { remaining, reset };
    }
  } catch { /* offline or unauthenticated, 403 backstop below still applies */ }
}
const settleSearchBudget = async () => {
  if (!ghSearchBudget) return true; // unknown, let the 403 backstop decide
  if (ghSearchBudget.remaining > 12) return true; // plenty left, no pacing
  if (ghSearchBudget.remaining > 2) {
    // approaching the 30/min shared quota: pace gently to stay inside it
    await sleep(1500);
    return true;
  }
  const waitMs = searchResetWaitMs(ghSearchBudget.remaining, ghSearchBudget.reset, Date.now() / 1000);
  if (waitMs > 0) {
    await sleep(waitMs);
    ghSearchBudget = { remaining: 28, reset: Math.floor(Date.now() / 1000) + 60 }; // refilled by the wait
    return true;
  }
  return false; // reset too far away, skip backfill rather than hammer
};
const backfillOne = async pick => {
  const variants = ghNameVariants(pick.name).slice(0, 3);
  let enriched = false;
  let verifies = 0;
  variantLoop: for (const variant of variants) {
    if (ghRateLimited || verifies >= 3 || enriched) break;
    if (!(await settleSearchBudget())) { ghRateLimited = true; break; }
    if (ghSearchBudget) ghSearchBudget.remaining--;
    let slugsFromSearch = [];
    try {
      const searchRes = await ghFetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(variant)}+in:name&per_page=5`, { timeoutMs: 10000 });
      if (searchRes.status === 403 || searchRes.status === 429) { ghRateLimited = true; continue; }
      if (!searchRes.ok) continue;
      const searchJson = await searchRes.json();
      for (const it of searchJson.items ?? []) {
        if (it.full_name) slugsFromSearch.push({ slug: it.full_name, stars: typeof it.stargazers_count === "number" ? it.stargazers_count : 0 });
      }
    } catch {
      continue; // network/timeout — transient, next variant still tries
    }
    for (const { slug, stars } of slugsFromSearch) {
      if (verifies >= 3 || enriched) break;
      // 0-star forks are noise — require at least 1 star to consider credible (guards pi-crofai control case)
      if (stars === 0) {
        if (!verifiedCache.has(slug)) verifiedCache.set(slug, null);
        continue;
      }
      // check cache first (cache stores rawName)
      if (verifiedCache.has(slug)) {
        const cachedName = verifiedCache.get(slug);
        if (cachedName === pick.name) {
          pick.repo = normRepo(`https://github.com/${slug}`);
          enriched = true;
          break;
        }
        continue;
      }
      verifies++;
      try {
        const { status, body } = await httpGetText(`https://raw.githubusercontent.com/${slug}/main/package.json`, { timeoutMs: 10000 });
        if (status !== 200) { verifiedCache.set(slug, null); continue; }
        let j;
        try { j = JSON.parse(body); } catch { verifiedCache.set(slug, null); continue; }
        const rawName = j.name;
        verifiedCache.set(slug, rawName);
        // Critical guard: package.json name must match npm name; stars already >0
        if (rawName === pick.name) {
          pick.repo = normRepo(`https://github.com/${slug}`);
          enriched = true;
          break;
        }
      } catch {
        continue;
      }
    }
    if (enriched) break variantLoop;
  }
}
// Star enrichment for the final table only (bounded): secondary credibility signal
// for niche packages where npm downloads understate traction. Deduped — many pi
// packages share one monorepo. Single REST transport (ghFetch, authed at 5K/hr
// when a token resolved, else 60/hr/IP), results cached 24h in /tmp so repeat
// fan-outs cost nothing.
const STAR_CACHE = `${process.env.TMPDIR ?? "/tmp"}/pi-pkg-star-cache-${process.getuid?.() ?? "u"}.json`;
const DAY = 86_400_000;
let starCache = {};
try {
  starCache = JSON.parse(readFileSync(STAR_CACHE, "utf8"));
  for (const k of Object.keys(starCache)) if (Date.now() - starCache[k].t > DAY) delete starCache[k];
} catch { /* first run or corrupt cache */ }
// ghRateLimited shared with the backfill above; any 403/429 on GitHub REST sets
// it and feeds the actionable advisory in the coverage line.
async function fetchStars(slug) {
  const c = starCache[slug];
  if (c && Date.now() - c.t < DAY) return c.s;
  try {
    const res = await ghFetch(`https://api.github.com/repos/${slug}`, { timeoutMs: 10000 });
    if (res.status === 403 || res.status === 429) { ghRateLimited = true; return null; }
    if (!res.ok) return null;
    const s = (await res.json()).stargazers_count;
    if (typeof s === "number") return s;
  } catch { /* network down etc. */ }
  return null;
}
const starMap = new Map();
const attemptedSlugs = new Set();
async function resolveStar(slug) {
  attemptedSlugs.add(slug);
  const s = await fetchStars(slug);
  if (s !== null) { starMap.set(slug, s); starCache[slug] = { t: Date.now(), s }; }
}
// Overlap: stars for already-known repos resolve CONCURRENTLY with the GH backfill
// pass (independent work); only newly-backfilled repos fetch stars afterwards.
const knownSlugs = [...new Set(picks.map(r => ghSlug(r.repo)).filter(Boolean))];
await Promise.all([
  runLimited(knownSlugs, resolveStar, 5),
  runLimited(repoLessPicks, backfillOne, 3),
]);
const slugs = [...new Set(picks.map(r => ghSlug(r.repo)).filter(Boolean))];
await runLimited(slugs.filter(s => !attemptedSlugs.has(s)), resolveStar, 5);
try { writeFileSync(STAR_CACHE, JSON.stringify(starCache)); } catch { /* cache is best-effort */ }

await Promise.all(pkgs.map(async name => {
  try {
    const res = await httpGet(`https://registry.npmjs.org/${encodeURIComponent(name)}`, { timeoutMs: 25000 });
    if (!res.ok) throw new Error(`http ${res.status}`);
    const j = await res.json();
    const L = j["dist-tags"]?.latest ?? "?";
    console.log(`PKG ${name} | latest ${L} | last-publish ${j.time?.[L] ?? "?"} | modified ${j.time?.modified ?? "?"} | ${(j.description ?? "").slice(0, 90)}`);
  } catch (e) {
    failed.push(`pkg:${name}`);
    console.error(`FAIL pkg:${name}: ${(e.message ?? e).slice(0, 80)}`);
  }
}));

const probeFound = ranked.filter(r => r.hits.some(h => h.startsWith("probe"))).length;
const missing = slugs.length - starMap.size;
let starsBit = `Stars: ${slugs.length ? `${starMap.size}/${slugs.length} repos resolved` : "none applicable"}`;
if (slugs.length && ghRateLimited)
  starsBit += ` (${missing} rate-limited mid-run — inform user: install gh and run 'gh auth login' for reliable counts)`;
else if (slugs.length && missing > 0)
  starsBit += " (- = non-GitHub or unknown repo)";
const failBit = failed.length ? `, FAILED: ${failed.join(", ")} (each is a coverage gap — report it, never treat the partial pool as complete)` : "";
console.log(`Coverage: ${queries.length - failed.length}/${queries.length} npm queries ok${failBit} | catalog cross-check: ${catNew.length} new name(s) merged | probes found: ${probeFound} | ${starsBit}.`);
console.log(`Pool: ${pool.size} unique pkgs; showing top ${TOP} by downloads${terms.length ? " + exact/substring name-matches" : ""}; max ${MAX_LINES} rows. Install npm-first: every listed row exists on npm (git-only packages cannot enter this pool).`);
console.log("↓ downloads/mo | name | version | ★ stars | src | query-hits | repo | description");
for (const r of picks) {
  const slug = ghSlug(r.repo);
  const tag = exactHit(r) ? " [EXACT]" : kwHit(r) ? " [KW]" : descHit(r) ? " [DESC]" : "";
      const dl = r.dl < 0 ? "?" : r.dl.toLocaleString("en-US");
      const stars = slug && starMap.has(slug) ? String(starMap.get(slug)) : "-";
      const src = slug ? "gh" : "-";
      const displayDesc = slug ? r.desc : `${r.desc} (no repository field — verify source via README, experimental)`;
      console.log(`${dl} | ${r.name}${tag} | ${r.version} | ${stars} | ${src} | ${r.hits.length}:${[...new Set(r.hits)].join(",")} | ${r.repo || "-"} | ${displayDesc}`);
}
console.log("Legend: ↓ = sorted by monthly downloads desc (never searchScore) · ★ = GitHub stars · src gh = GitHub-hosted, - = npm-only/unknown · [EXACT]/[KW]/[DESC] = exact-name/keyword/description match · (no repository field — verify source via README, experimental) = publisher omitted repository field, verify via README before install");

