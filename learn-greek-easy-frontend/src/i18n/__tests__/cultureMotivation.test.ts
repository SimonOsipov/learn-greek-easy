/**
 * DASH2-02-02 — `cultureMotivation` i18n key-set + placeholder SHAPE test.
 *
 * RED-first (test-first:yes). `cultureMotivation` does not exist yet in either
 * locale's mockExam.json — this file must FAIL on missing/undefined leaves,
 * not on an import/parse error. It goes GREEN once DASH2-02-02 authors the 27
 * keys in both locales (same subtask).
 *
 * Verifies, against BOTH src/i18n/locales/en/mockExam.json and .../ru/mockExam.json:
 *  1. Exactly 27 leaf key-paths exist under a TOP-LEVEL `cultureMotivation`
 *     object (24 returning = 3 directions × 4 verdicts × 2 variants, + 3 new-user),
 *     with en and ru exposing IDENTICAL leaf-path sets.
 *  2. Every `{{token}}` placeholder in each leaf is a member of the BE-emitted
 *     param set for its family — verified against `_compute_motivation` in
 *     culture_question_service.py: new-user emits only `{questionsTotal}`;
 *     returning emits `{currentPercent, previousPercent, delta, questionsTotal,
 *     questionsLearned}`.
 *  3. Every leaf is a string, not a nested object (catches wrong nesting depth).
 *
 * Copy tone / translation quality is explicitly OUT of scope here — that
 * stays on the visual gate.
 */
import { describe, it, expect } from 'vitest';

import en from '../locales/en/mockExam.json';
import ru from '../locales/ru/mockExam.json';

type Bundle = { cultureMotivation?: unknown };

const RETURNING_DIRECTIONS = ['improving', 'stagnant', 'declining'] as const;
const VERDICTS = ['notReady', 'gettingThere', 'ready', 'thoroughlyPrepared'] as const;
const RETURNING_VARIANTS = ['1', '2'] as const;
const NEW_USER_VARIANTS = ['1', '2', '3'] as const;

const NEW_USER_PARAMS = new Set(['questionsTotal']);
const RETURNING_PARAMS = new Set([
  'currentPercent',
  'previousPercent',
  'delta',
  'questionsTotal',
  'questionsLearned',
]);

const PLACEHOLDER_RE = /\{\{\s*(\w+)\s*\}\}/g;

// Build the expected 27 leaf-paths programmatically from the 3×4×2 + 3 combos
// (never hand-list them — that would let a typo in both the source and the
// test agree with each other silently).
const EXPECTED_LEAF_PATHS: string[] = [
  ...RETURNING_DIRECTIONS.flatMap((direction) =>
    VERDICTS.flatMap((verdict) =>
      RETURNING_VARIANTS.map((variant) => `${direction}.${verdict}.${variant}`)
    )
  ),
  ...NEW_USER_VARIANTS.map((variant) => `newUser.${variant}`),
];

function getCultureMotivation(bundle: unknown): Record<string, unknown> {
  const cm = (bundle as Bundle).cultureMotivation;
  return cm !== null && typeof cm === 'object' && !Array.isArray(cm)
    ? (cm as Record<string, unknown>)
    : {};
}

function getAtPath(root: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((node, segment) => {
    if (
      node !== null &&
      typeof node === 'object' &&
      !Array.isArray(node) &&
      segment in (node as Record<string, unknown>)
    ) {
      return (node as Record<string, unknown>)[segment];
    }
    return undefined;
  }, root);
}

/** Collects every terminal (non-object) node's dotted path under `node`. */
function collectLeafPaths(node: unknown, prefix = ''): string[] {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    return prefix ? [prefix] : [];
  }
  const entries = Object.entries(node as Record<string, unknown>);
  const out: string[] = [];
  for (const [key, value] of entries) {
    out.push(...collectLeafPaths(value, prefix ? `${prefix}.${key}` : key));
  }
  return out;
}

describe('EXPECTED_LEAF_PATHS sanity', () => {
  it('is exactly 27 paths (24 returning + 3 new-user)', () => {
    expect(EXPECTED_LEAF_PATHS).toHaveLength(27);
    expect(new Set(EXPECTED_LEAF_PATHS).size).toBe(27); // no accidental dupes
  });
});

describe.each([['en', en] as const, ['ru', ru] as const])(
  '%s/mockExam.json cultureMotivation',
  (locale, bundle) => {
    const cm = getCultureMotivation(bundle);

    it(`${locale}: has a top-level "cultureMotivation" object (sibling to "readiness")`, () => {
      expect(
        (bundle as Bundle).cultureMotivation,
        `${locale}/mockExam.json has no top-level "cultureMotivation" object yet`
      ).toBeTypeOf('object');
    });

    it(`${locale}: all 27 expected leaves resolve to non-empty strings`, () => {
      const problems: string[] = [];
      for (const path of EXPECTED_LEAF_PATHS) {
        const value = getAtPath(cm, path);
        if (typeof value !== 'string' || value.trim().length === 0) {
          problems.push(`${path} -> ${JSON.stringify(value)}`);
        }
      }
      expect(
        problems,
        `${locale}: missing/empty/non-string cultureMotivation leaves:\n${problems.join('\n')}`
      ).toEqual([]);
    });

    it(`${locale}: has no leaf keys beyond the expected 27 (and exactly 27 total)`, () => {
      const actual = collectLeafPaths(cm);
      const extra = actual.filter((p) => !EXPECTED_LEAF_PATHS.includes(p)).sort();
      expect(
        extra,
        `${locale}: unexpected extra cultureMotivation leaves:\n${extra.join('\n')}`
      ).toEqual([]);
      expect(actual, `${locale}: expected exactly 27 cultureMotivation leaves`).toHaveLength(27);
    });

    it(`${locale}: every leaf is a string, not an object (wrong-depth guard)`, () => {
      const leafPaths = collectLeafPaths(cm);
      // Guard against a vacuous pass: if cultureMotivation is missing/empty,
      // leafPaths is [] and a bare "every non-string is []" filter would pass
      // silently. Assert the count explicitly so absence is a hard failure.
      expect(
        leafPaths.length,
        `${locale}: expected 27 cultureMotivation leaves to inspect, found ${leafPaths.length} (cultureMotivation may be missing or nested wrong)`
      ).toBe(27);
      const nonString = leafPaths.filter((p) => typeof getAtPath(cm, p) !== 'string');
      expect(
        nonString,
        `${locale}: non-string (object) leaves at:\n${nonString.join('\n')}`
      ).toEqual([]);
    });

    it(`${locale}: every {{placeholder}} is in the BE-emitted param set for its family`, () => {
      const checkedPaths: string[] = [];
      const violations: string[] = [];
      for (const path of EXPECTED_LEAF_PATHS) {
        const value = getAtPath(cm, path);
        if (typeof value !== 'string') continue; // reported by the leaf-string tests above
        checkedPaths.push(path);
        const isNewUser = path.startsWith('newUser.');
        const allowed = isNewUser ? NEW_USER_PARAMS : RETURNING_PARAMS;
        const tokens = [...value.matchAll(PLACEHOLDER_RE)].map((m) => m[1]);
        for (const token of tokens) {
          if (!allowed.has(token)) {
            violations.push(
              `${path}: {{${token}}} not allowed (family=${isNewUser ? 'newUser' : 'returning'}, allowed=[${[...allowed].join(', ')}])`
            );
          }
        }
      }
      // Guard against a vacuous pass: this test must have actually inspected all
      // 27 leaves as strings, not silently no-op because cultureMotivation is
      // missing (which would leave `violations` empty by finding nothing to check).
      expect(
        checkedPaths.length,
        `${locale}: expected to check placeholders on all 27 leaves, only ${checkedPaths.length} resolved to strings`
      ).toBe(27);
      expect(violations, `${locale}: disallowed placeholders:\n${violations.join('\n')}`).toEqual(
        []
      );
    });
  }
);

describe('en ↔ ru cultureMotivation parity', () => {
  it('en and ru expose IDENTICAL cultureMotivation leaf-path sets', () => {
    const enLeaves = new Set(collectLeafPaths(getCultureMotivation(en)));
    const ruLeaves = new Set(collectLeafPaths(getCultureMotivation(ru)));

    // Guard against a vacuous pass: two empty sets are trivially "identical".
    expect(enLeaves.size, 'en cultureMotivation has zero leaves — likely missing entirely').toBe(
      27
    );
    expect(ruLeaves.size, 'ru cultureMotivation has zero leaves — likely missing entirely').toBe(
      27
    );

    const enNotRu = [...enLeaves].filter((k) => !ruLeaves.has(k)).sort();
    const ruNotEn = [...ruLeaves].filter((k) => !enLeaves.has(k)).sort();
    expect(enNotRu, `en-only cultureMotivation leaves: ${enNotRu.join(', ')}`).toEqual([]);
    expect(ruNotEn, `ru-only cultureMotivation leaves: ${ruNotEn.join(', ')}`).toEqual([]);
  });
});
