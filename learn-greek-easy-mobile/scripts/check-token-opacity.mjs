/**
 * check-token-opacity.mjs — Guard script for NativeWind v4 native opacity defect (MOB-13).
 *
 * In NativeWind v4.2.4, a colour-utility/<NN> modifier on a var-backed token (e.g. bg-primary/50)
 * routes through unsupported color-mix() and renders DARK on native iOS. The sanctioned fix is
 * explicit full-colour <base>-<NN> rgba tokens used WITHOUT a modifier.
 *
 * This script:
 *   1. Parses tailwind.config.js to build a denylist of var-backed token names.
 *   2. Scans src/**\/*.{js,jsx,ts,tsx,css} for colour-utility/<denylisted-token>/<NN> patterns
 *      (.css covers NativeWind `@apply bg-primary/50` in global.css / CSS modules).
 *   3. Exits 1 (with remediation advice) if any violations are found; exits 0 if clean.
 *
 * See learn-greek-easy-mobile/docs/design-tokens.md for full decision record.
 */

import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// ---------------------------------------------------------------------------
// parseDenylist — extract var-backed token names from raw tailwind.config.js text
// ---------------------------------------------------------------------------

/**
 * Parse the raw text of tailwind.config.js and return an array of var-backed token names.
 * Only tokens whose value matches `'<name>': 'hsl(var(--…))'` are included.
 * Tokens backed by `rgba(...)` are excluded (those are the safe explicit-opacity tokens).
 *
 * @param {string} configText  Raw text of tailwind.config.js
 * @returns {string[]}         List of var-backed token names
 */
export function parseDenylist(configText) {
  const denylist = [];
  // Match both:
  //   'token-name': 'hsl(var(--…))'   (quoted key)
  //   tokenName:    'hsl(var(--…))'   (unquoted key — bare JS identifier or hyphenated via quotes)
  // The value must start with hsl(var( so rgba() tokens are excluded.
  //
  // Two passes: first quoted keys, then unquoted identifier keys.
  const quotedRe = /['"]([^'"]+)['"]\s*:\s*['"]hsl\(var\(--[^)]+\)\)['"]/g;
  let match;
  while ((match = quotedRe.exec(configText)) !== null) {
    denylist.push(match[1]);
  }
  // Unquoted keys: e.g.  primary: 'hsl(var(--primary))'
  const unquotedRe = /(?:^|[,{]\s*)([a-zA-Z][a-zA-Z0-9_-]*)\s*:\s*['"]hsl\(var\(--[^)]+\)\)['"]/gm;
  while ((match = unquotedRe.exec(configText)) !== null) {
    const name = match[1];
    if (!denylist.includes(name)) {
      denylist.push(name);
    }
  }
  return denylist;
}

// ---------------------------------------------------------------------------
// scanContent — find colour-utility/<denylisted-token>/<NN> violations in file text
// ---------------------------------------------------------------------------

// Canonical list of Tailwind colour utility prefixes that can carry the /NN modifier.
const COLOR_UTILITY_PREFIXES = [
  'bg',
  'text',
  'border',
  'ring',
  'fill',
  'stroke',
  'shadow',
  'divide',
  'from',
  'via',
  'to',
  'placeholder',
  'tint',
  'caret',
  'decoration',
  'outline',
];

/**
 * Scan file text for violations: colour-utility/<denylisted-token>/<NN> patterns.
 * Element-level `opacity-NN` / `active:opacity-NN` (RN style.opacity) are NEVER matched.
 * Builds the alternation longest-token-first to avoid prefix shadowing.
 *
 * @param {string[]} denylist  Token names to flag (from parseDenylist)
 * @param {string}   fileText  Source file text to scan
 * @returns {Array<{line:number, col:number, snippet:string, token:string}>}
 */
export function scanContent(denylist, fileText) {
  if (denylist.length === 0) return [];

  // Sort longest first so that e.g. 'primary-2' is tried before 'primary'.
  const sorted = [...denylist].sort((a, b) => b.length - a.length);
  const tokenAlt = sorted.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const prefixAlt = COLOR_UTILITY_PREFIXES.join('|');

  // Match: (optional variant prefix like "active:")? <colour-utility>-<token>/<NN>
  // The (?:^|[\s"'`(]) look-behind equivalent: require a word/class boundary so we don't
  // accidentally match mid-word. We use a non-capturing group that must precede the match.
  // NB: JS regex doesn't support variable-length lookbehinds in all engines, so we capture
  // a leading char and use a capture group offset.
  //
  // Pattern: (start|space|quote|backtick|paren)  (variant:)* (prefix)-(token)/(NN)
  const re = new RegExp(
    `(?:^|[\\s"'\`(,])(?:[\\w-]+:)*(${prefixAlt})-(${tokenAlt})\\/(\\d{1,3})`,
    'g',
  );

  const hits = [];
  const lines = fileText.split('\n');

  lines.forEach((lineText, lineIdx) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(lineText)) !== null) {
      // m[0] includes the leading boundary char; adjust col to point at the utility start.
      const leadingChar = m[0][0];
      const colOffset = /[\s"'`(,]/.test(leadingChar) ? 1 : 0;
      hits.push({
        line: lineIdx + 1,
        col: m.index + colOffset + 1, // 1-indexed
        snippet: m[0].trim(),
        token: m[2],
      });
    }
  });

  return hits;
}

// ---------------------------------------------------------------------------
// CLI entry-point
// ---------------------------------------------------------------------------

/**
 * Walk src/**\/*.{js,jsx,ts,tsx,css} (relative to the script's parent directory),
 * scan each file, and exit 1 with remediation advice if any violations are found.
 */
async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(scriptDir, '..');
  const configPath = path.join(projectRoot, 'tailwind.config.js');

  // Parse denylist from config text (no require() — pure text parsing).
  const configText = readFileSync(configPath, 'utf8');
  const denylist = parseDenylist(configText);

  if (denylist.length === 0) {
    console.log('check-token-opacity: no var-backed tokens found in tailwind.config.js — nothing to check.');
    process.exit(0);
  }

  // Walk src/**/*.{js,jsx,ts,tsx,css}, skip node_modules.
  // .css is included so NativeWind `@apply bg-primary/50` in global.css / CSS modules
  // can't reintroduce the bug uncaught (CodeRabbit #566).
  // Use a manual recursive walk (runtime-independent): fs/promises.glob is Node 22+,
  // and a static import of it throws at link time on Node 20 (CI) — so we avoid it.
  const srcDir = path.join(projectRoot, 'src');

  let allHits = [];
  const files = [];

  function walkSync(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') walkSync(full);
      } else if (/\.(js|jsx|ts|tsx|css)$/.test(entry.name)) {
        files.push(full);
      }
    }
  }
  walkSync(srcDir);

  for (const filePath of files) {
    const fileText = readFileSync(filePath, 'utf8');
    const hits = scanContent(denylist, fileText);
    if (hits.length > 0) {
      for (const hit of hits) {
        const rel = path.relative(projectRoot, filePath);
        console.error(`${rel}:${hit.line}:${hit.col}  ${hit.snippet}`);
        console.error(
          `  Use the explicit \`${hit.token}-<NN>\` rgba token instead of a \`/<NN>\` opacity modifier on a var-backed token — see MOB-13 convention / learn-greek-easy-mobile/docs/design-tokens.md`,
        );
      }
      allHits = allHits.concat(hits.map((h) => ({ ...h, file: filePath })));
    }
  }

  if (allHits.length > 0) {
    console.error(
      `\ncheck-token-opacity: ${allHits.length} violation(s) found. Fix by using explicit rgba tokens (see above).`,
    );
    process.exit(1);
  }

  console.log(
    `✓ check-token-opacity: no /<NN> opacity-modifier violations on var-backed tokens (${files.length} file(s) scanned).`,
  );
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('check-token-opacity: unexpected error:', err);
    process.exit(1);
  });
}
