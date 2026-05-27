import { describe, expect, it } from 'vitest';

import { NEWS_THUMB_GRADIENTS, pickNewsThumb } from '../newsThumbs';

describe('NEWS_THUMB_GRADIENTS', () => {
  it('exports exactly 9 gradient strings', () => {
    expect(NEWS_THUMB_GRADIENTS).toHaveLength(9);
  });

  it('each entry is a non-empty string', () => {
    for (const g of NEWS_THUMB_GRADIENTS) {
      expect(typeof g).toBe('string');
      expect(g.length).toBeGreaterThan(0);
    }
  });
});

describe('pickNewsThumb', () => {
  it('returns the same gradient for the same id (deterministic)', () => {
    const id = 'abc-123';
    expect(pickNewsThumb(id)).toBe(pickNewsThumb(id));
  });

  it('returns a value that is one of the 9 gradients', () => {
    expect(NEWS_THUMB_GRADIENTS).toContain(pickNewsThumb('some-id'));
  });

  it('works with an empty string id', () => {
    const result = pickNewsThumb('');
    expect(NEWS_THUMB_GRADIENTS).toContain(result);
  });

  it('spreads across at least 6 distinct gradients given 9 sufficiently-distinct ids', () => {
    const ids = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india'];
    const distinct = new Set(ids.map((id) => pickNewsThumb(id)));
    expect(distinct.size).toBeGreaterThanOrEqual(6);
  });
});
