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
  if (/^@[^\/]+\/pi-/i.test(name)) return true;
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
      const slug = /github\.com\/[^\/]+\/([A-Za-z0-9_.-]+)/i.exec(url);
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
