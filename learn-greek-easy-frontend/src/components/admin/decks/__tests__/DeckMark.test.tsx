// src/components/admin/decks/__tests__/DeckMark.test.tsx
//
// Vitest + RTL unit tests for DeckMark atom (DKDR-02).
// Covers: 3-word code derivation, single-word fallback, tone class selection,
// isSystem override, culture/vocabulary types, and Greek uppercase correctness.

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DeckMark, deriveCode } from '../DeckMark';

describe('deriveCode (exported)', () => {
  it('returns first-letter initials for 3+ word names', () => {
    expect(deriveCode('Alpha Beta Gamma')).toBe('ABG');
  });

  it('returns first 3 chars of single word', () => {
    expect(deriveCode('Verbs')).toBe('VER');
  });

  it('handles two-word names by using first 3 chars of first word', () => {
    expect(deriveCode('Hello World')).toBe('HEL');
  });

  it('uppercases Greek names correctly via el-GR locale', () => {
    expect(deriveCode('Καθημερινά Ρήματα Α')).toBe('ΚΡΑ');
  });
});

describe('DeckMark', () => {
  // ── Code derivation ──────────────────────────────────────────────────────

  it('derives code from first letters of first 3 words (uppercase)', () => {
    const { container } = render(<DeckMark name="Alpha Beta Gamma" type="vocabulary" />);
    const el = container.querySelector('.deck-mark');
    expect(el?.textContent).toBe('ABG');
  });

  it('falls back to first 3 chars of first word when fewer than 3 words', () => {
    const { container } = render(<DeckMark name="Verbs" type="vocabulary" />);
    const el = container.querySelector('.deck-mark');
    expect(el?.textContent).toBe('VER');
  });

  // ── Tone class selection ─────────────────────────────────────────────────

  it('applies mk-amber when isSystem is true (overrides type)', () => {
    const { container } = render(
      <DeckMark name="Culture Deck One" type="culture" isSystem={true} />
    );
    const el = container.querySelector('.deck-mark');
    expect(el?.classList.contains('mk-amber')).toBe(true);
    expect(el?.classList.contains('mk-cyan')).toBe(false);
  });

  it('applies mk-cyan for type="culture"', () => {
    const { container } = render(<DeckMark name="Culture Deck One" type="culture" />);
    const el = container.querySelector('.deck-mark');
    expect(el?.classList.contains('mk-cyan')).toBe(true);
  });

  it('applies mk-violet for type="vocabulary"', () => {
    const { container } = render(<DeckMark name="Alpha Beta Gamma" type="vocabulary" />);
    const el = container.querySelector('.deck-mark');
    expect(el?.classList.contains('mk-violet')).toBe(true);
  });

  // ── Greek uppercase ──────────────────────────────────────────────────────

  it('uppercases Greek deck name correctly via el-GR locale', () => {
    // Καθημερινά Ρήματα Α → first letters: Κ, Ρ, Α → ΚΡΑ
    const { container } = render(<DeckMark name="Καθημερινά Ρήματα Α" type="vocabulary" />);
    const el = container.querySelector('.deck-mark');
    expect(el?.textContent).toBe('ΚΡΑ');
  });
});
