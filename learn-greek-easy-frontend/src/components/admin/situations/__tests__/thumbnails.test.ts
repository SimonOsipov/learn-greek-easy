// src/components/admin/situations/__tests__/thumbnails.test.ts

import { describe, expect, it } from 'vitest';

import { formatDuration, pickSitTone } from '../thumbnails';

describe('pickSitTone', () => {
  it('is deterministic — same id yields same tone across two calls', () => {
    const id = 'test-stability-id';
    expect(pickSitTone(id)).toBe(pickSitTone(id));
  });

  it('returns one of the six valid tones', () => {
    const valid = ['blue', 'amber', 'violet', 'cyan', 'green', 'red'];
    for (let i = 0; i < 50; i++) {
      expect(valid).toContain(pickSitTone(`id-${i}`));
    }
  });

  it('covers all 6 tones across a range of ids', () => {
    const tones = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tones.add(pickSitTone(`id-${i}`));
    }
    expect(tones.size).toBe(6);
  });

  it('empty-string id returns a valid tone', () => {
    const valid = ['blue', 'amber', 'violet', 'cyan', 'green', 'red'];
    expect(valid).toContain(pickSitTone(''));
  });
});

describe('formatDuration', () => {
  it('formats 0 seconds as 0:00', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  it('formats 125 seconds as 2:05', () => {
    expect(formatDuration(125)).toBe('2:05');
  });

  it('formats 60 seconds as 1:00', () => {
    expect(formatDuration(60)).toBe('1:00');
  });

  it('formats 59 seconds as 0:59', () => {
    expect(formatDuration(59)).toBe('0:59');
  });

  it('formats 3661 seconds as 61:01', () => {
    expect(formatDuration(3661)).toBe('61:01');
  });

  it('pads seconds with leading zero when < 10', () => {
    expect(formatDuration(65)).toBe('1:05');
  });
});
