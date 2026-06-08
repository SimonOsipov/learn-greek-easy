/// <reference types="jest" />
import {
  GRADIENT_HERO,
  GRADIENT_NEWS,
  GRADIENT_SITUATION,
  GRADIENT_QUICKWIN,
  GRADIENT_PALETTE,
  gradientForId,
} from '../gradients';

// ---------------------------------------------------------------------------
// Constant shape — each GRADIENT_* must be a non-empty array of ≥2 string stops
// ---------------------------------------------------------------------------

describe('named gradient constants', () => {
  const constants = [
    ['GRADIENT_HERO', GRADIENT_HERO],
    ['GRADIENT_NEWS', GRADIENT_NEWS],
    ['GRADIENT_SITUATION', GRADIENT_SITUATION],
    ['GRADIENT_QUICKWIN', GRADIENT_QUICKWIN],
  ] as const;

  for (const [name, gradient] of constants) {
    describe(name, () => {
      it('is an array', () => {
        expect(Array.isArray(gradient)).toBe(true);
      });

      it('has at least 2 stops', () => {
        expect(gradient.length).toBeGreaterThanOrEqual(2);
      });

      it('all stops are non-empty strings', () => {
        for (const stop of gradient) {
          expect(typeof stop).toBe('string');
          expect(stop.length).toBeGreaterThan(0);
        }
      });
    });
  }
});

describe('GRADIENT_PALETTE', () => {
  it('contains all four named gradients', () => {
    expect(GRADIENT_PALETTE).toContain(GRADIENT_HERO);
    expect(GRADIENT_PALETTE).toContain(GRADIENT_NEWS);
    expect(GRADIENT_PALETTE).toContain(GRADIENT_SITUATION);
    expect(GRADIENT_PALETTE).toContain(GRADIENT_QUICKWIN);
  });

  it('has exactly 4 entries', () => {
    expect(GRADIENT_PALETTE.length).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// gradientForId — determinism
// ---------------------------------------------------------------------------

describe('gradientForId', () => {
  describe('determinism — same id always returns the same gradient', () => {
    const sampleIds = [
      'deck-abc123',
      'deck-xyz789',
      '',
      'a',
      'greek-news-today',
      'situation-at-the-market',
      'quick-win-verbs',
      '00000000-0000-0000-0000-000000000001',
    ];

    for (const id of sampleIds) {
      it(`is stable for id "${id}"`, () => {
        const first = gradientForId(id);
        // Call 10 more times — must always return the exact same array reference
        for (let i = 0; i < 10; i++) {
          expect(gradientForId(id)).toBe(first);
        }
      });
    }
  });

  describe('return value is a palette member', () => {
    const ids = [
      'alpha',
      'beta',
      'gamma',
      'delta',
      'epsilon',
      'zeta',
      'eta',
      'theta',
    ];

    for (const id of ids) {
      it(`gradientForId("${id}") returns a GRADIENT_PALETTE entry`, () => {
        const result = gradientForId(id);
        expect(GRADIENT_PALETTE).toContain(result);
      });
    }
  });

  describe('distribution — 100 distinct ids hit more than one gradient', () => {
    it('spreads across multiple palette entries', () => {
      const seen = new Set<readonly string[]>();

      for (let i = 0; i < 100; i++) {
        const id = `test-id-${i}`;
        seen.add(gradientForId(id));
      }

      // With 100 ids and 4 palette entries, we should hit more than 1.
      // A good hash will hit all 4; we only assert > 1 to be conservative.
      expect(seen.size).toBeGreaterThan(1);
    });

    it('hits all palette entries with a sufficiently large id set', () => {
      const seen = new Set<readonly string[]>();

      // With 4 palette entries and djb2, 200 varied ids should cover all.
      for (let i = 0; i < 200; i++) {
        seen.add(gradientForId(`id-${i}-suffix-${i * 7}`));
      }

      expect(seen.size).toBe(GRADIENT_PALETTE.length);
    });
  });

  describe('return type is a non-empty array of strings', () => {
    it('returns array with ≥2 stops', () => {
      const result = gradientForId('any-id');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('stops are non-empty strings', () => {
      const result = gradientForId('some-deck');
      for (const stop of result) {
        expect(typeof stop).toBe('string');
        expect(stop.length).toBeGreaterThan(0);
      }
    });
  });
});
