import { describe, it, expect } from 'vitest';
import { getCEFRBadgeClass, getCEFRLabel, CEFR_LEVELS, CEFR_LEVEL_OPTIONS } from '../cefrColors';

// ---------------------------------------------------------------------------
// getCEFRBadgeClass
// ---------------------------------------------------------------------------

describe('getCEFRBadgeClass', () => {
  it('returns b-blue for A1', () => {
    expect(getCEFRBadgeClass('A1')).toBe('b-blue');
  });

  it('returns b-violet for A2', () => {
    expect(getCEFRBadgeClass('A2')).toBe('b-violet');
  });

  it('returns b-amber for B1', () => {
    expect(getCEFRBadgeClass('B1')).toBe('b-amber');
  });

  it('returns b-green for B2', () => {
    expect(getCEFRBadgeClass('B2')).toBe('b-green');
  });

  it('returns b-red for C1 (forward-compat)', () => {
    expect(getCEFRBadgeClass('C1')).toBe('b-red');
  });

  it('returns b-gray for C2 (forward-compat)', () => {
    expect(getCEFRBadgeClass('C2')).toBe('b-gray');
  });

  it('falls back to b-gray for an unknown level', () => {
    // Cast to bypass TS for the runtime fallback path
    expect(getCEFRBadgeClass('Z9' as never)).toBe('b-gray');
  });
});

// ---------------------------------------------------------------------------
// getCEFRLabel
// ---------------------------------------------------------------------------

describe('getCEFRLabel', () => {
  it('returns full label for A1', () => {
    expect(getCEFRLabel('A1')).toBe('A1 - Beginner');
  });

  it('returns full label for A2', () => {
    expect(getCEFRLabel('A2')).toBe('A2 - Elementary');
  });

  it('returns full label for B1', () => {
    expect(getCEFRLabel('B1')).toBe('B1 - Intermediate');
  });

  it('returns full label for B2', () => {
    expect(getCEFRLabel('B2')).toBe('B2 - Upper-Intermediate');
  });

  it('returns full label for C1', () => {
    expect(getCEFRLabel('C1')).toBe('C1 - Advanced');
  });

  it('returns full label for C2', () => {
    expect(getCEFRLabel('C2')).toBe('C2 - Mastery');
  });

  it('falls back to the raw level string for an unknown level', () => {
    // The function returns the level itself when no mapping is found
    expect(getCEFRLabel('Z9' as never)).toBe('Z9');
  });
});

// ---------------------------------------------------------------------------
// CEFR_LEVELS constant
// ---------------------------------------------------------------------------

describe('CEFR_LEVELS', () => {
  it('contains exactly A1, A2, B1, B2 (live levels only)', () => {
    expect(CEFR_LEVELS).toEqual(['A1', 'A2', 'B1', 'B2']);
  });

  it('does not include C1 or C2', () => {
    expect(CEFR_LEVELS).not.toContain('C1');
    expect(CEFR_LEVELS).not.toContain('C2');
  });
});

// ---------------------------------------------------------------------------
// CEFR_LEVEL_OPTIONS constant
// ---------------------------------------------------------------------------

describe('CEFR_LEVEL_OPTIONS', () => {
  it('has one option per live level', () => {
    expect(CEFR_LEVEL_OPTIONS).toHaveLength(4);
  });

  it('carries correct value, label, and badgeClass for A1', () => {
    const a1 = CEFR_LEVEL_OPTIONS.find((o) => o.value === 'A1');
    expect(a1).toEqual({ value: 'A1', label: 'A1 - Beginner', badgeClass: 'b-blue' });
  });

  it('carries correct value, label, and badgeClass for A2', () => {
    const a2 = CEFR_LEVEL_OPTIONS.find((o) => o.value === 'A2');
    expect(a2).toEqual({ value: 'A2', label: 'A2 - Elementary', badgeClass: 'b-violet' });
  });

  it('carries correct value, label, and badgeClass for B1', () => {
    const b1 = CEFR_LEVEL_OPTIONS.find((o) => o.value === 'B1');
    expect(b1).toEqual({ value: 'B1', label: 'B1 - Intermediate', badgeClass: 'b-amber' });
  });

  it('carries correct value, label, and badgeClass for B2', () => {
    const b2 = CEFR_LEVEL_OPTIONS.find((o) => o.value === 'B2');
    expect(b2).toEqual({ value: 'B2', label: 'B2 - Upper-Intermediate', badgeClass: 'b-green' });
  });
});
