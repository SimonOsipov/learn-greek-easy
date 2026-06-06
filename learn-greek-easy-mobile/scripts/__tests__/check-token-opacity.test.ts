/**
 * ATDD tests for check-token-opacity.mjs (NWOPA-04, MOB-13).
 *
 * These tests encode the acceptance criteria for the guard script and were
 * authored RED (before the real implementation) per the ATDD workflow.
 * The script is imported via a jest moduleNameMapper that routes
 * `*.mjs` → babel-jest transform (see jest.config.js).
 *
 * Acceptance criteria tested:
 *   AC#1 — scanContent returns a non-empty hit for a var-backed token/NN modifier.
 *   AC#2 — scanContent does NOT flag bare element-level opacity-NN / active:opacity-NN.
 *   AC#3 — parseDenylist includes var-backed tokens and excludes explicit-rgba tokens.
 *   AC#4 — (bonus) multi-token: var-backed on-photo-scrim with /42 is caught;
 *           the explicit-rgba on-photo-scrim-42 (used without a modifier) is never in
 *           the denylist and therefore never matched.
 */

// Import is resolved via jest.config.js transform entry for .mjs files
import { parseDenylist, scanContent } from '../check-token-opacity.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FULL_TAILWIND_SNIPPET = `
  colors: {
    'bg': 'hsl(var(--bg))',
    'primary': 'hsl(var(--primary))',
    'primary-2': 'hsl(var(--primary-2))',
    'on-photo': 'hsl(var(--on-photo-fg))',
    'on-photo-scrim': 'hsl(var(--on-photo-scrim))',
    'danger': 'hsl(var(--danger))',
    'badge-recommended': 'hsl(var(--badge-recommended))',
    'danger-soft': 'hsl(var(--danger-soft))',
    'primary-15': 'rgba(36,99,235,0.15)',
    'on-photo-scrim-42': 'rgba(8,11,20,0.42)',
    'danger-18': 'rgba(239,68,68,0.18)',
    'danger-55': 'rgba(239,68,68,0.55)',
    'badge-recommended-25': 'rgba(255,149,10,0.25)',
  }
`;

// ---------------------------------------------------------------------------
// AC#1 — TRUE POSITIVE: colour-utility + var-backed token + /NN modifier IS caught
// ---------------------------------------------------------------------------

describe('scanContent — true positives (AC#1)', () => {
  it('flags bg-primary/50 in a JSX className', () => {
    const denylist = ['primary', 'danger', 'on-photo-scrim'];
    const fileText = '<View className="bg-primary/50" />';
    const hits = scanContent(denylist, fileText);

    expect(hits.length).toBeGreaterThan(0);
  });

  it('returns a hit with the correct token name for bg-primary/50', () => {
    const denylist = ['primary'];
    const fileText = '<View className="bg-primary/50" />';
    const [hit] = scanContent(denylist, fileText);

    expect(hit).toBeDefined();
    expect(hit.token).toBe('primary');
  });

  it('returns a hit with a line number ≥ 1', () => {
    const denylist = ['primary'];
    const fileText = '<View className="bg-primary/50" />';
    const [hit] = scanContent(denylist, fileText);

    expect(hit).toBeDefined();
    expect(hit.line).toBeGreaterThanOrEqual(1);
  });

  it('flags text-danger/70 on a denylisted token', () => {
    const denylist = ['danger'];
    const fileText = '<Text className="text-danger/70">Error</Text>';
    const hits = scanContent(denylist, fileText);

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].token).toBe('danger');
  });

  it('flags border-on-photo-scrim/42 on a denylisted token', () => {
    const denylist = ['on-photo-scrim'];
    const fileText = '<View className="border-on-photo-scrim/42" />';
    const hits = scanContent(denylist, fileText);

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].token).toBe('on-photo-scrim');
  });
});

// ---------------------------------------------------------------------------
// AC#2 — TRUE NEGATIVE: bare element-level opacity-NN MUST NOT be flagged
// ---------------------------------------------------------------------------

describe('scanContent — true negatives / AC#2 guard (AC#2)', () => {
  it('does NOT flag bare opacity-50 (element-level — RN style.opacity)', () => {
    const denylist = ['primary', 'danger', 'on-photo-scrim'];
    const fileText = '<View className="opacity-50" />';
    const hits = scanContent(denylist, fileText);

    expect(hits).toHaveLength(0);
  });

  it('does NOT flag active:opacity-50 (variant + element-level opacity)', () => {
    const denylist = ['primary', 'danger', 'on-photo-scrim'];
    const fileText = '<View className="opacity-50 active:opacity-50" />';
    const hits = scanContent(denylist, fileText);

    expect(hits).toHaveLength(0);
  });

  it('does NOT flag opacity-100 (full opacity — clearly element-level)', () => {
    const denylist = ['primary'];
    const fileText = '<View className="opacity-100 bg-primary" />';
    const hits = scanContent(denylist, fileText);

    // bg-primary without /NN is fine; opacity-100 is element-level
    expect(hits).toHaveLength(0);
  });

  it('does NOT flag a token that is not in the denylist', () => {
    const denylist = ['danger']; // primary not in denylist
    const fileText = '<View className="bg-primary/50" />';
    const hits = scanContent(denylist, fileText);

    expect(hits).toHaveLength(0);
  });

  it('does NOT flag text without any opacity modifier', () => {
    const denylist = ['primary', 'danger'];
    const fileText = '<View className="bg-primary text-danger border-card" />';
    const hits = scanContent(denylist, fileText);

    expect(hits).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC#3 — Denylist derivation: var-backed tokens INCLUDED, explicit-rgba EXCLUDED
// ---------------------------------------------------------------------------

describe('parseDenylist (AC#3)', () => {
  it('includes primary (var-backed) in the denylist', () => {
    const denylist = parseDenylist(FULL_TAILWIND_SNIPPET);
    expect(denylist).toContain('primary');
  });

  it('includes badge-recommended (var-backed) in the denylist', () => {
    const denylist = parseDenylist(FULL_TAILWIND_SNIPPET);
    expect(denylist).toContain('badge-recommended');
  });

  it('excludes primary-15 (explicit rgba) from the denylist', () => {
    const denylist = parseDenylist(FULL_TAILWIND_SNIPPET);
    expect(denylist).not.toContain('primary-15');
  });

  it('excludes badge-recommended-25 (explicit rgba) from the denylist', () => {
    const denylist = parseDenylist(FULL_TAILWIND_SNIPPET);
    expect(denylist).not.toContain('badge-recommended-25');
  });

  it('excludes on-photo-scrim-42 (explicit rgba) from the denylist', () => {
    const denylist = parseDenylist(FULL_TAILWIND_SNIPPET);
    expect(denylist).not.toContain('on-photo-scrim-42');
  });

  it('excludes danger-18 (explicit rgba) from the denylist', () => {
    const denylist = parseDenylist(FULL_TAILWIND_SNIPPET);
    expect(denylist).not.toContain('danger-18');
  });

  it('includes on-photo-scrim (var-backed) in the denylist', () => {
    const denylist = parseDenylist(FULL_TAILWIND_SNIPPET);
    expect(denylist).toContain('on-photo-scrim');
  });

  it('includes danger (var-backed) in the denylist', () => {
    const denylist = parseDenylist(FULL_TAILWIND_SNIPPET);
    expect(denylist).toContain('danger');
  });

  it('returns an array (not null/undefined)', () => {
    const denylist = parseDenylist(FULL_TAILWIND_SNIPPET);
    expect(Array.isArray(denylist)).toBe(true);
  });

  it('parses the minimal example from the spec (primary included, primary-15 excluded)', () => {
    const snippet = `colors: {
      'primary': 'hsl(var(--primary))',
      'primary-15': 'rgba(36,99,235,0.15)',
      'badge-recommended': 'hsl(var(--badge-recommended))',
      'badge-recommended-25': 'rgba(255,149,10,0.25)'
    }`;
    const denylist = parseDenylist(snippet);
    expect(denylist).toContain('primary');
    expect(denylist).toContain('badge-recommended');
    expect(denylist).not.toContain('primary-15');
    expect(denylist).not.toContain('badge-recommended-25');
  });
});

// ---------------------------------------------------------------------------
// AC#4 — Multi-token scan (bonus): on-photo-scrim/42 caught; on-photo-scrim-42
//         (explicit-rgba, not in denylist) never matched
// ---------------------------------------------------------------------------

describe('scanContent — multi-token and explicit-rgba safety (AC#4)', () => {
  it('catches on-photo-scrim/42 when on-photo-scrim is in the denylist', () => {
    const denylist = ['on-photo-scrim', 'primary'];
    const fileText = '<View className="bg-on-photo-scrim/42 text-primary" />';
    const hits = scanContent(denylist, fileText);

    const scrimHit = hits.find((h) => h.token === 'on-photo-scrim');
    expect(scrimHit).toBeDefined();
  });

  it('does NOT catch bg-on-photo-scrim-42 (the explicit-rgba token, used without /NN)', () => {
    // on-photo-scrim-42 is an explicit rgba token — parseDenylist must exclude it,
    // so scanContent will never match it regardless of the file content.
    const denylist = parseDenylist(FULL_TAILWIND_SNIPPET);
    // Sanity: on-photo-scrim-42 must NOT be in the denylist
    expect(denylist).not.toContain('on-photo-scrim-42');

    // Even if someone wrote bg-on-photo-scrim-42 in a class, it has no /NN modifier
    // and the denylist doesn't contain the name, so no hit.
    const fileText = '<View className="bg-on-photo-scrim-42" />';
    const hits = scanContent(denylist, fileText);
    expect(hits).toHaveLength(0);
  });

  it('catches multiple violations in a single file', () => {
    const denylist = ['primary', 'danger'];
    const fileText = [
      '<View className="bg-primary/50" />',
      '<Text className="text-danger/18">Error</Text>',
    ].join('\n');
    const hits = scanContent(denylist, fileText);

    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it('returns correct line numbers for a multi-line file', () => {
    const denylist = ['primary'];
    const fileText = ['<View />', '<View className="bg-primary/50" />', '<Text />'].join('\n');
    const hits = scanContent(denylist, fileText);

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].line).toBe(2); // line 2 (1-indexed)
  });
});

// ---------------------------------------------------------------------------
// Adversarial / edge coverage (Mode B — QA-added, MOB-13 NWOPA-04)
// ---------------------------------------------------------------------------

describe('adversarial edge cases (QA Mode B)', () => {
  // Adv-1: longest-first / prefix-collision guard
  // 'primary-2' and 'primary' are both in the denylist. When the string
  // 'bg-primary-2/40' is scanned, the hit's token must be 'primary-2'
  // (longer match wins), not 'primary' (shorter prefix). Also confirms
  // the full snippet includes the /NN modifier.
  it('Adv-1: resolves prefix collision — bg-primary-2/40 hits token primary-2 not primary', () => {
    const denylist = ['primary-2', 'primary'];
    const fileText = '<View className="bg-primary-2/40" />';
    const hits = scanContent(denylist, fileText);

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].token).toBe('primary-2');
    // Snippet must contain the full violated class including /NN
    expect(hits[0].snippet).toContain('bg-primary-2/40');
  });

  // Adv-2: multiple utilities in one className string → two distinct hits
  it('Adv-2: returns TWO hits for bg-card/50 and text-fg/80 in one className', () => {
    const denylist = ['card', 'fg', 'primary'];
    const fileText = '<View className="rounded-xl bg-card/50 px-2 text-fg/80" />';
    const hits = scanContent(denylist, fileText);

    expect(hits.length).toBe(2);
    const tokens = hits.map((h) => h.token).sort();
    expect(tokens).toEqual(['card', 'fg']);
  });

  // Adv-3: no false-positive on a substring token with no /NN modifier
  // Denylist containing 'border' must NOT flag bare 'border' (no /NN) or
  // 'border-2' style classes (not a color utility match). The /NN suffix
  // is required for a violation to be reported.
  it('Adv-3: no false-positive — bare "border" and "border-2" with no /NN not flagged', () => {
    const denylist = ['border'];
    // 'border' and 'border-2' have no /NN modifier — must NOT be flagged.
    const fileText = '<View className="border rounded border-2 border-solid" />';
    const hits = scanContent(denylist, fileText);

    expect(hits).toHaveLength(0);
  });

  // Adv-4: explicit-rgba token never matched; var-backed base name IS matched
  // parseDenylist must exclude 'on-photo-scrim-42' (rgba) but include
  // 'on-photo-scrim' (hsl var). Then:
  //   - scanContent on 'bg-on-photo-scrim-42' (no /NN) → empty
  //   - scanContent on 'bg-on-photo-scrim/42' (/NN on var-backed) → hit
  it('Adv-4a: parseDenylist excludes on-photo-scrim-42 (rgba) but includes on-photo-scrim (hsl)', () => {
    const denylist = parseDenylist(FULL_TAILWIND_SNIPPET);
    expect(denylist).not.toContain('on-photo-scrim-42');
    expect(denylist).toContain('on-photo-scrim');
  });

  it('Adv-4b: bg-on-photo-scrim-42 (no /NN, explicit-rgba class) is NOT flagged', () => {
    const denylist = parseDenylist(FULL_TAILWIND_SNIPPET);
    const fileText = '<View className="bg-on-photo-scrim-42" />';
    const hits = scanContent(denylist, fileText);
    expect(hits).toHaveLength(0);
  });

  it('Adv-4c: bg-on-photo-scrim/42 (var-backed with /NN) IS flagged as a violation', () => {
    const denylist = parseDenylist(FULL_TAILWIND_SNIPPET);
    const fileText = '<View className="bg-on-photo-scrim/42" />';
    const hits = scanContent(denylist, fileText);

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].token).toBe('on-photo-scrim');
  });
});
