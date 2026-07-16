/**
 * WEDGE-13-04 (Mode A — RED): Caddyfile SPA-fallback directive revert-guard.
 *
 * This is NOT a test of Caddy runtime behaviour — a vitest process never runs
 * Caddy. It is a cheap, deterministic guard that reads the real `Caddyfile`
 * off disk and asserts the SPA-fallback `handle {}` block's `try_files`
 * directive keeps its 3-alternative form. Its only job: make a future
 * revert/edit of this one line fail loudly in CI (every push), since nothing
 * else in the per-push lane can see it — the CI E2E lane runs the Vite dev
 * server, never Caddy (see task-1313 §0).
 *
 * Runtime serving correctness (`/ru/` -> RU doc, `/ru` -> RU doc, `/` ->
 * EN doc, sitemap/robots real content-types) is verified separately, against
 * a real deployed Caddy, in `scripts/release-web-verify.cjs` (Phase 3.5 only —
 * not on draft-PR CI, and out of vitest's reach entirely).
 *
 * Current state (verified 2026-07-16, pre-fix): `Caddyfile:305` is
 * `try_files {path} /index.html` — missing the `{path}/index.html`
 * alternative, so `/ru` (a directory, no trailing slash) falls through to the
 * EN root document instead of resolving to `/ru/index.html`. This test is RED
 * now; the executor's one-line fix (Stage 3) turns it green. Not touched by
 * QA — editing `Caddyfile` is explicitly the executor's job, not test
 * authoring's.
 *
 * Mirrors the `build/__tests__/localeHtml.test.ts` idiom (WEDGE-13-02):
 * `build/**\/*.ts` is in `tsconfig.node.json`'s `include`, whose
 * `types: ["node"]` carries no vitest globals — hence the explicit
 * `import { describe, it, expect } from 'vitest'` below. Bare globals compile
 * fine under vitest's own runtime (globals: true in vitest.config.ts) but fail
 * `tsc -b --force` with TS2593 (Cannot find name 'describe').
 *
 * AC -> test name map:
 *   AC-1/6  caddyfile_spa_fallback_tries_directory_index
 *   AC-1/6  caddyfile_spa_fallback_try_files_appears_exactly_once
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { describe, it, expect } from 'vitest';

const CADDYFILE_PATH = resolve(__dirname, '../../Caddyfile');

/**
 * Extracts the SPA-fallback block: the file's only BARE `handle {}` (no path
 * or named matcher after `handle`). Every other `handle` block in this file
 * is qualified — `handle /healthz {`, `handle @static {`, `handle /api/* {`,
 * etc. — so matching the literal, unqualified `handle {` immediately followed
 * by a newline uniquely identifies the SPA catch-all (verified against the
 * real Caddyfile, 2026-07-16: exactly one match). This scoping matters: a
 * naive whole-file `.toContain('try_files ...')` would also pass if the
 * 3-alternative form were pasted into an unrelated comment, or into a
 * DIFFERENT handle block that never reaches the SPA fallback in Caddy's
 * specificity-sorted directive order.
 */
function extractSpaFallbackBlock(caddyfile: string): string {
  const match = caddyfile.match(/\nhandle \{\n([\s\S]*?)\n\}\n/);
  if (!match) {
    throw new Error(
      'Could not find the bare `handle {}` SPA-fallback block in Caddyfile — has it been restructured?'
    );
  }
  return match[1];
}

describe('Caddyfile — SPA-fallback try_files directive (revert-guard, AC-1/AC-6)', () => {
  const caddyfile = readFileSync(CADDYFILE_PATH, 'utf8');

  it('caddyfile_spa_fallback_tries_directory_index', () => {
    const spaBlock = extractSpaFallbackBlock(caddyfile);

    // The fix: try_files must offer the directory-index alternative BETWEEN
    // the bare path and the final index.html fallback, so a directory request
    // like `/ru` (no trailing slash — Caddy's try_files file matcher does not
    // do directory-index resolution on its own) resolves to
    // `/ru/index.html` instead of falling straight through to the EN root
    // document. Order matters: {path} first (serves real files/assets
    // untouched), then {path}/index.html (the fix), then /index.html (the
    // final SPA catch-all).
    expect(spaBlock).toContain('try_files {path} {path}/index.html /index.html');
  });

  it('caddyfile_spa_fallback_try_files_appears_exactly_once', () => {
    // Guards the "this file's only try_files" claim in AC-1 directly — if a
    // second try_files directive were ever added elsewhere, the block-scoped
    // assertion above could stay green while a stray, unfixed try_files
    // elsewhere shipped the bug at a different route. Counted over the WHOLE
    // file (not just the extracted block) so it also fails if a duplicate
    // were added outside handle {}.
    const occurrences = (caddyfile.match(/try_files\s/g) ?? []).length;
    expect(occurrences).toBe(1);
  });
});
