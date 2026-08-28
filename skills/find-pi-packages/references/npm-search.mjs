#!/usr/bin/env node
// Parallel pi-package npm registry search — bounded output, resilient merges.
// Usage: node npm-search.mjs <term> [<term>...]   (synonym variants; ascii, no spaces)
// Emits: coverage header + ranked union table (top N by downloads + all name-matches).
// Raw registry JSON is 200-400KB per query; this script NEVER lets it reach stdout.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";
import { normRepo, isLoosePiCandidate, normName, normCatalogTerm, extractCatalogCandidates, exactNameMatch, keywordMatch, descMatch, ghSlug, ghNameVariants } from "./npm-search-lib.mjs";
const run = promisify(execFile);

const STRICT_KWS = ["pi-package", "pi-extension"];
const LOOSE_KW = "pi";
const KWS = STRICT_KWS; // legacy alias — keep for external refs
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
  const out = new Array(items.length);
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

await runLimited(queries, async q => {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { stdout } = await run("curl", ["-sS", "--max-time", "25", "-w", "\n%{http_code}", q.url], { maxBuffer: 16 * 1024 * 1024 });
      const nl = stdout.lastIndexOf("\n");
      if (nl === -1) throw new Error("no http_code in search response");
      const status = parseInt(stdout.slice(nl + 1).trim(), 10);
      const body = stdout.slice(0, nl);
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
});

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
const catNew = [];
const fetchCatalogHtml = async term => {
  // pi.dev always returns 200 HTML; use -sf for simplicity but classify failures as gap
  const { stdout } = await run("curl", ["-sf", "--max-time", "20", `https://pi.dev/packages?name=${encodeURIComponent(term)}`], { maxBuffer: 8 * 1024 * 1024 });
  return stdout;
};
if (terms.length) await Promise.all([...new Set(terms)].map(async t => {
  try {
    const html = await fetchCatalogHtml(t);
    const cands = extractCatalogCandidates(html);
    let added = 0;
    for (const m of [...new Set(cands)]) {
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
          for (const m of [...new Set(cands2)]) {
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
    const { stdout } = await run("curl", ["-sS", "--max-time", "15", `https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(name)}`], { maxBuffer: 1024 * 1024 });
    const j = JSON.parse(stdout);
    if (typeof j.downloads === "number") return j.downloads;
  } catch {}
  return -1;
}

await Promise.all(probes.map(async name => {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { stdout } = await run("curl", ["-sS", "--max-time", "20", "-w", "\n%{http_code}", `https://registry.npmjs.org/${encodeURIComponent(name)}`], { maxBuffer: 16 * 1024 * 1024 });
      const nl = stdout.lastIndexOf("\n");
      if (nl === -1) throw new Error("no http_code in probe response");
      const status = parseInt(stdout.slice(nl + 1).trim(), 10);
      const body = stdout.slice(0, nl);
      if (status === 200) {
        let dl = -1;
        dl = await fetchDownloadsForProbe(name);
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
      // network/timeout/curl non-zero
      const msg = (e.message ?? String(e)).slice(0, 80);
      // execFile errors for curl network failures don't yield http_code; treat as transient
      if (attempt < 2) { await sleep(400); continue; }
      failed.push(`probe:${name}`);
      console.error(`FAIL probe:${name}: ${msg}`);
      break;
    }
  }
}));
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
let ghRateLimited = false;
const verifiedCache = new Map(); // slug -> rawName (string|null) cache per run
for (const pick of picks) {
  if (pick.repo) continue;
  if (ghRateLimited) break;
  const variants = ghNameVariants(pick.name).slice(0, 3);
  if (!variants.length) continue;
  let enriched = false;
  let verifies = 0;
  variantLoop: for (const variant of variants) {
    if (ghRateLimited || verifies >= 3 || enriched) break;
    let slugsFromSearch = [];
    try {
      const { stdout } = await run("gh", ["api", `search/repositories?q=${variant}+in:name&per_page=5`, "--jq", ".items[] | [.full_name,.stargazers_count,.html_url] | @tsv"], { maxBuffer: 1024 * 1024 });
      const lines = stdout.trim().split("\n").filter(Boolean);
      for (const line of lines) {
        const parts = line.split("\t");
        const full = (parts[0] || "").trim();
        const starsRaw = (parts[1] || "").trim();
        const starsNum = parseInt(starsRaw, 10);
        if (full) slugsFromSearch.push({ slug: full, stars: Number.isNaN(starsNum) ? 0 : starsNum });
      }
    } catch (e) {
      const msg = (e.message ?? String(e)).toLowerCase();
      if (msg.includes("403") || msg.includes("429") || msg.includes("rate limit") || msg.includes("api rate limit")) ghRateLimited = true;
      continue;
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
        const { stdout } = await run("curl", ["-sS", "--max-time", "15", "-w", "\n%{http_code}", `https://raw.githubusercontent.com/${slug}/main/package.json`], { maxBuffer: 1024 * 1024 });
        const nl = stdout.lastIndexOf("\n");
        if (nl === -1) { verifiedCache.set(slug, null); continue; }
        const status = parseInt(stdout.slice(nl + 1).trim(), 10);
        const body = stdout.slice(0, nl);
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
// packages share one monorepo. gh preferred (5K/hr authed), unauthenticated REST as
// fallback (60/hr/IP), results cached 24h in /tmp so repeat fan-outs cost nothing.
const STAR_CACHE = "/tmp/pi-pkg-star-cache.json";
const DAY = 86_400_000;
let starCache = {};
try {
  starCache = JSON.parse(readFileSync(STAR_CACHE, "utf8"));
  for (const k of Object.keys(starCache)) if (Date.now() - starCache[k].t > DAY) delete starCache[k];
} catch { /* first run or corrupt cache */ }
// ghRateLimited already declared above for backfill; reused for star enrichment (curl 403 ⇒ advise gh install/auth)
async function fetchStars(slug) {
  const c = starCache[slug];
  if (c && Date.now() - c.t < DAY) return c.s;
  try {
    const { stdout } = await run("gh", ["api", `repos/${slug}`, "--jq", ".stargazers_count"], { maxBuffer: 1024 * 1024 });
    const s = parseInt(stdout.trim(), 10);
    if (!Number.isNaN(s)) return s;
  } catch { /* no gh or unauthenticated */ }
  try {
    // no -f: we need the HTTP status ourselves — -s would swallow it and -f hides the body
    const { stdout } = await run("curl", ["-sS", "--max-time", "15", "-w", "\n%{http_code}", `https://api.github.com/repos/${slug}`], { maxBuffer: 1024 * 1024 });
    const nl = stdout.lastIndexOf("\n");
    const status = parseInt(stdout.slice(nl + 1), 10);
    if (status === 403 || status === 429) { ghRateLimited = true; return null; }
    if (status !== 200) return null;
    const s = JSON.parse(stdout.slice(0, nl)).stargazers_count;
    if (typeof s === "number") return s;
  } catch { /* network down etc. */ }
  return null;
}
const slugs = [...new Set(picks.map(r => ghSlug(r.repo)).filter(Boolean))];
const starMap = new Map();
await Promise.all(slugs.map(async slug => {
  const s = await fetchStars(slug);
  if (s !== null) { starMap.set(slug, s); starCache[slug] = { t: Date.now(), s }; }
}));
try { writeFileSync(STAR_CACHE, JSON.stringify(starCache)); } catch { /* cache is best-effort */ }

await Promise.all(pkgs.map(async name => {
  try {
    const { stdout } = await run("curl", ["-sf", "--max-time", "25", `https://registry.npmjs.org/${encodeURIComponent(name)}`], { maxBuffer: 16 * 1024 * 1024 });
    const j = JSON.parse(stdout);
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

