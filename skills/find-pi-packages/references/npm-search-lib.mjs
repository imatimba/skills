// npm-search-lib.mjs — pure helpers for the find-pi-packages npm search.
// Extracted from npm-search.mjs so the skill's decision logic is unit-testable
// (tests/npm-search.test.mjs) without network. No I/O here by design.

/** Canonicalize any repo-ish string to an https URL (git+ remotes, ssh forms, .git suffixes). */
export const normRepo = url => {
  if (!url) return "";
  const u = String(url).replace(/^git\+/, "").replace(/^git@github\.com:/i, "https://github.com/").replace(/\.git$/i, "");
  return /^https?:\/\//i.test(u) ? u.replace(/^http:\/\//i, "https://") : u;
};

/**
 * Loose-hit post-filter: keep only if plausibly a pi package.
 * Drops @stdlib math-pi noise; strict hits bypass this (they already proved provenance).
 * @param {{name?: string, keywords?: unknown[], description?: string}} pkg
 */
export const isLoosePiCandidate = pkg => {
  const name = (pkg.name ?? "").toLowerCase();
  if (name.startsWith("pi-")) return true;
  if (/^@[^/]+\/pi-/i.test(name)) return true;
  const kws = (pkg.keywords ?? []).map(k => String(k).toLowerCase());
  const desc = (pkg.description ?? "").toLowerCase();
  const descMatch = /pi[- ]coding[- ]agent|pi[- ]extension|for pi\b/.test(desc);
  if (kws.includes("pi-package") || kws.includes("pi-extension")) return true;
  if (descMatch) return true;
  // Bare "pi" keyword: keep for pi ecosystem, but drop @stdlib math-pi noise
  // (verified 2026-08-27: @stdlib/* math-pi packages carry keyword "pi" but are not pi coding-agent extensions).
  if (kws.includes("pi")) {
    if (name.startsWith("@stdlib/")) return false;
    return true;
  }
  return false;
};

/** Name modulo the conventional `pi-` prefix (both directions). */
export const normName = s => s.replace(/^pi-/, "");

/** Catalog term modulo `pi-` prefix and `-provider` suffix. */
export const normCatalogTerm = s => s.replace(/^pi-/, "").replace(/-provider$/, "");

/**
 * Exact-intent name match: identity, or modulo the conventional `pi-` prefix.
 * @param {string} name package name
 * @param {string[]} terms user terms
 */
export const exactNameMatch = (name, terms) =>
  terms.some(t => name.toLowerCase() === t || normName(name.toLowerCase()) === normName(t));

/** Relevance tier [KW]: term appears verbatim among the package keywords. */
export const keywordMatch = (kw, terms) => (kw ?? []).some(k => terms.includes(k));

/** Relevance tier [DESC]: term appears verbatim in the full lowercase description. */
export const descMatch = (dfull, terms) => terms.some(t => (dfull ?? "").includes(t));

/**
 * Extract install candidates from a pi.dev catalog HTML page.
 * Captures both `pi install npm:NAME` and `pi install (git:)?https://github.com/...`
 * forms; github URLs are kept as git-only candidates and a `pi-`-prefixed repo base
 * is derived as an npm-name guess (e.g. repo `pi-foo` → candidate `pi-foo`).
 * @param {string} html
 * @returns {string[]} unique candidate names/URLs
 */
export const extractCatalogCandidates = html => {
  const out = [];
  const re = /pi install (?:npm:([A-Za-z0-9@/._-]+)|((?:git:)?https?:\/\/github\.com\/[^\s"<>]+))/g;
  for (const m of html.matchAll(re)) {
    if (m[1]) out.push(m[1]);
    else if (m[2]) {
      let url = m[2];
      if (url.startsWith("git:")) url = url.slice(4);
      if (!/^https?:\/\//i.test(url)) url = "https://" + url.replace(/^\/\//, "");
      // keep git URL as git-only candidate (never probed against registry)
      out.push(url);
      // also derive repo base as npm guess when plausible (e.g. pi-foo)
      const slug = /github\.com\/[^/]+\/([A-Za-z0-9_.-]+)/i.exec(url);
      if (slug) {
        let base = slug[1].replace(/\.git$/i, "");
        if (/^pi-/i.test(base) && !out.includes(base)) out.push(base);
      }
    }
  }
  return [...new Set(out)];
};

/**
 * Extract a GitHub `owner/repo` slug from any repo-ish URL.
 * @param {string} url
 * @returns {string|null} slug or null when not a GitHub URL
 */
export const ghSlug = url => {
  const m = /github\.com[/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/i.exec(url || "");
  return m ? `${m[1]}/${m[2]}` : null;
};

/**
 * Synthesize GitHub search name variants for a repo-less npm package.
 * Deduped, order: npm name, normCatalogTerm, pi+norm, plus crof/crofai aliases.
 * The crof/crofai alias (insert/remove "ai" after "crof") is ONLY generated
 * when the original npm name contains "crof" (case-insensitive).
 * Caller should bound to ≤3 variants per pick before GH search.
 * @param {string} npmName
 * @returns {string[]} deduped variants
 */
export const ghNameVariants = npmName => {
  const seen = new Set();
  const out = [];
  const add = v => {
    if (!v || seen.has(v.toLowerCase())) return;
    seen.add(v.toLowerCase());
    out.push(v);
  };
  const base = String(npmName || "").trim();
  if (!base) return out;
  add(base);
  const norm = normCatalogTerm(base);
  if (norm && norm.toLowerCase() !== base.toLowerCase()) add(norm);
  if (norm) {
    const piNorm = `pi-${norm}`;
    if (piNorm.toLowerCase() !== base.toLowerCase()) add(piNorm);
  }
  // crof/crofai alias — only when base contains crof (case-insensitive)
  if (/crof/i.test(base)) {
    const snapshot = [...out];
    for (const v of snapshot) {
      let alias = null;
      if (/crofai/i.test(v)) {
        alias = v.replace(/crofai/gi, m => (m[0] === m[0].toUpperCase() && m[0] !== m[0].toLowerCase() ? "Crof" : "crof"));
      } else if (/crof/i.test(v)) {
        alias = v.replace(/crof/gi, m => (m[0] === m[0].toUpperCase() && m[0] !== m[0].toLowerCase() ? "Crofai" : "crofai"));
      }
      if (alias && alias.toLowerCase() !== v.toLowerCase()) add(alias);
    }
  }
  return out;
};

/**
 * Probe fast-path: build a pool record from a /-/v1/search response.
 * Search returns fuzzy neighbors alongside exact hits, so the caller MUST match
 * on exact `package.name === probedName` — enforced here by returning null when
 * no object carries the probed name (index lag or truly absent → packument fallback).
 * Field mapping mirrors the search-fan-out pool insertion (name, downloads.monthly,
 * version, repo via normRepo, desc ≤90 chars, lowercased kw, dfull).
 * @param {Array} objects search response `.objects`
 * @param {string} probedName exact package name being probed
 * @param {string} hitTag pool hit tag (default `probe+search`)
 * @returns {object|null} pool record or null when no exact hit
 */
export const probeRecordFromSearch = (objects, probedName, hitTag = "probe+search") => {
  const hit = (objects ?? []).find(o => o?.package?.name === probedName);
  if (!hit) return null;
  const p = hit.package;
  const desc = p.description ?? "";
  return {
    name: p.name,
    dl: hit.downloads?.monthly ?? 0,
    version: p.version,
    repo: normRepo(p.links?.repository ?? p.links?.homepage ?? ""),
    desc: desc.replace(/\s+/g, " ").slice(0, 90),
    kw: (p.keywords ?? []).map(k => String(k).toLowerCase()),
    dfull: desc.toLowerCase(),
    hits: [hitTag],
  };
};

/**
 * How long to wait for the gh search quota to reset, when it is nearly exhausted.
 * gh search is 30 req/min shared across every `gh api search` call; a fan-out can
 * exhaust it mid-run. Returns ms to sleep, or 0 when the reset is too far away to
 * wait for (caller should skip backfill instead).
 * @param {number} remaining search calls left
 * @param {number} resetEpoch reset timestamp (epoch seconds)
 * @param {number} nowEpoch current time (epoch seconds)
 * @returns {number} ms to wait, or 0 when waiting is not worthwhile
 */
export const searchResetWaitMs = (remaining, resetEpoch, nowEpoch) => {
  if (remaining > 2) return 0;
  const waitMs = (resetEpoch - nowEpoch) * 1000;
  return waitMs > 0 && waitMs <= 60_000 ? waitMs + 1000 : 0;
};
