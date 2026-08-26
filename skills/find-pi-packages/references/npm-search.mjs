#!/usr/bin/env node
// Parallel pi-package npm registry search — bounded output, resilient merges.
// Usage: node npm-search.mjs <term> [<term>...]   (synonym variants; ascii, no spaces)
// Emits: coverage header + ranked union table (top N by downloads + all name-matches).
// Raw registry JSON is 200-400KB per query; this script NEVER lets it reach stdout.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";
const run = promisify(execFile);

const KWS = ["pi-package", "pi-extension"];
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

// Canonicalize any repo-ish string to an https URL (git+remotes, ssh forms, .git suffixes)
const normRepo = url => {
  if (!url) return "";
  const u = String(url).replace(/^git\+/, "").replace(/^git@github\.com:/i, "https://github.com/").replace(/\.git$/i, "");
  return /^https?:\/\//i.test(u) ? u.replace(/^http:\/\//i, "https://") : u;
};

const queries = [];
for (const t of terms)
  for (const kw of KWS)
    queries.push({ tag: `${kw}+${t}`, url: `https://registry.npmjs.org/-/v1/search?text=keywords:${kw}+${encodeURIComponent(t)}&size=${SIZE}` });
for (const kw of KWS)
  queries.push({ tag: `sweep:${kw}`, url: `https://registry.npmjs.org/-/v1/search?text=keywords:${kw}&size=${SIZE}` });

const pool = new Map();
const failed = [];

await Promise.all(queries.map(async q => {
  try {
    const { stdout } = await run("curl", ["-sf", "--max-time", "25", q.url], { maxBuffer: 16 * 1024 * 1024 });
    const objs = JSON.parse(stdout).objects ?? [];
    for (const o of objs) {
      const p = o.package;
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
  } catch (e) {
    failed.push(q.tag);
    console.error(`FAIL ${q.tag}: ${(e.message ?? e).slice(0, 80)}`);
  }
}));

const nameHit = r => terms.some(t => r.name.toLowerCase().includes(t));
// Relevance can live outside the name: authors put domain terms in keywords/description
// (e.g. pire-browser is THE firefox extension but its name says nothing about firefox).
const kwHit = r => (r.kw ?? []).some(k => terms.includes(k));
const descHit = r => terms.some(t => (r.dfull ?? "").includes(t));
// exact intent match: identity, or modulo the conventional "pi-" prefix
const norm = s => s.replace(/^pi-/, "");
const exactHit = r => terms.some(t => r.name.toLowerCase() === t || norm(r.name.toLowerCase()) === norm(t));

// Catalog cross-check: different matching engine than npm scoring; runs even when
// the npm pool looks healthy — score pathologies and index lag hide from npm only.
const catNew = [];
if (terms.length) await Promise.all([...new Set(terms)].map(async t => {
  try {
    const { stdout } = await run("curl", ["-sf", "--max-time", "20", `https://pi.dev/packages?name=${encodeURIComponent(t)}`], { maxBuffer: 8 * 1024 * 1024 });
    for (const m of new Set([...stdout.matchAll(/pi install npm:([A-Za-z0-9@/._-]+)/g)].map(x => x[1])))
      if (!pool.has(m)) catNew.push(m);
  } catch (e) {
    failed.push(`catalog:${t}`);
    console.error(`FAIL catalog:${t}: ${(e.message ?? e).slice(0, 60)}`);
  }
}));

// Probe catalog-only finds + bare terms that might BE package names.
// Catches search-index lag — brand-new packages can be missing or rank-buried in npm search.
const probes = [...new Set([...catNew, ...terms.filter(t => !pool.has(t))])].filter(n => !pool.has(n));
await Promise.all(probes.map(async name => {
  try {
    const { stdout } = await run("curl", ["-sf", "--max-time", "20", `https://registry.npmjs.org/${encodeURIComponent(name)}`], { maxBuffer: 16 * 1024 * 1024 });
    const j = JSON.parse(stdout);
    const L = j["dist-tags"]?.latest ?? "?";
    const v = j.versions?.[L] ?? {};
    pool.set(name, {
      name,
      dl: -1,
      version: L,
      repo: normRepo(v.repository?.url ?? j.homepage ?? ""),
      desc: (j.description ?? v.description ?? "").replace(/\s+/g, " ").slice(0, 90),
      hits: [`probe${catNew.includes(name) ? "+catalog" : ""}`],
    });
    console.error(`probe ${name}: FOUND (merged)`);
  } catch (e) {
    const notFound = String(e).includes("status 404") || String(e).includes("exit code 22");
    if (!notFound) { failed.push(`probe:${name}`); console.error(`FAIL probe:${name}: ${(e.message ?? e).slice(0, 60)}`); }
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
const ghSlug = url => {
  const m = /github\.com[/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/i.exec(url || "");
  return m ? `${m[1]}/${m[2]}` : null;
};
let ghRateLimited = false; // curl 403 on the unauth fallback ⇒ advise gh install/auth
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
console.log("downloads/mo | name | version | stars | query-hits | repo | description");
for (const r of picks) {
  const slug = ghSlug(r.repo);
  const tag = exactHit(r) ? " [EXACT]" : kwHit(r) ? " [KW]" : descHit(r) ? " [DESC]" : "";
  console.log(`${r.dl < 0 ? "?" : r.dl} | ${r.name}${tag} | ${r.version} | ${slug && starMap.has(slug) ? starMap.get(slug) : "-"} | ${r.hits.length}:${[...new Set(r.hits)].join(",")} | ${r.repo || "-"} | ${r.desc}`);
}
