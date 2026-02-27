import { describe, it, expect } from 'vitest';
import { getWeakestCategory } from '../cultureReadinessUtils';
import type { CategoryReadiness } from '@/services/cultureDeckAPI';

const makeCategory = (
  category: string,
  readiness: number,
  mastered: number,
  total: number,
  deckIds: string[] = ['deck-1']
): CategoryReadiness => ({
  category: category as CategoryReadiness['category'],
  readiness_percentage: readiness,
  questions_mastered: mastered,
  questions_total: total,
  deck_ids: deckIds,
  accuracy_percentage: null,
  needs_reinforcement: false,
});

describe('getWeakestCategory', () => {
  it('returns null for empty array', () => {
    expect(getWeakestCategory([])).toBeNull();
  });

  it('returns single category with wasTieBroken=false', () => {
    const cats = [makeCategory('geography', 45, 9, 20)];
    const result = getWeakestCategory(cats);
    expect(result?.category.category).toBe('geography');
    expect(result?.wasTieBroken).toBe(false);
  });

  it('returns clear weakest with wasTieBroken=false', () => {
    const cats = [
      makeCategory('geography', 30, 6, 20),
      makeCategory('history', 60, 12, 20),
      makeCategory('politics', 80, 16, 20),
    ];
    const result = getWeakestCategory(cats);
    expect(result?.category.category).toBe('geography');
    expect(result?.wasTieBroken).toBe(false);
  });

  it('tie-breaks by NEW count descending', () => {
    const cats = [
      makeCategory('geography', 30, 12, 40), // NEW = 28
      makeCategory('history', 30, 5, 50), // NEW = 45
    ];
    const result = getWeakestCategory(cats);
    expect(result?.category.category).toBe('history');
    expect(result?.wasTieBroken).toBe(true);
  });

  it('falls back alphabetically when NEW count tied', () => {
    const cats = [
      makeCategory('geography', 30, 10, 40), // NEW = 30
      makeCategory('history', 30, 20, 50), // NEW = 30
    ];
    const result = getWeakestCategory(cats);
    expect(result?.category.category).toBe('geography');
    expect(result?.wasTieBroken).toBe(true);
  });

  it('handles all at 100% (wasTieBroken=true)', () => {
    const cats = [makeCategory('culture', 100, 20, 20), makeCategory('geography', 100, 20, 20)];
    const result = getWeakestCategory(cats);
    expect(result?.wasTieBroken).toBe(true);
  });

  it('float precision: 30.1 vs 30.9 not treated as tied', () => {
    const cats = [makeCategory('geography', 30.1, 6, 20), makeCategory('history', 30.9, 6, 20)];
    const result = getWeakestCategory(cats);
    expect(result?.category.category).toBe('geography');
    expect(result?.wasTieBroken).toBe(false);
  });
});
