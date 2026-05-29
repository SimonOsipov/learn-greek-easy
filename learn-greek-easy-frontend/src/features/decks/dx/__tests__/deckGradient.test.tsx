/**
 * DX-02 Tests — deckGradient util + DxCover gradient primitive
 *
 * Covers:
 * - deckGradient(): determinism, distinctness, regex shape
 * - deckGradientStack(): 3 distinct strings, front === deckGradient()
 * - DxCover: sets expected --dx-* custom property per variant,
 *            renders children, emits NO <img>,
 *            renders cover image layer when coverImageUrl is set (gradient fallback otherwise)
 */

import React from 'react';

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { DeckCategory, DeckLevel } from '@/types/deck';

import { DxCover } from '../DxCover';
import { deckGradient, deckGradientStack } from '../deckGradient';

// ─── Shared test fixtures ────────────────────────────────────────────────────

const LEVELS: DeckLevel[] = ['A1', 'A2', 'B1', 'B2'];
const CATEGORIES: DeckCategory[] = ['vocabulary', 'grammar', 'phrases', 'culture'];

// All 16 level×category combinations
const ALL_COMBOS = LEVELS.flatMap((level) => CATEGORIES.map((category) => ({ level, category })));

// ─── deckGradient() ──────────────────────────────────────────────────────────

describe('deckGradient()', () => {
  it('matches the expected shape: linear-gradient(135deg, hsl(...), hsl(...))', () => {
    ALL_COMBOS.forEach(({ level, category }) => {
      const grad = deckGradient({ level, category });
      expect(grad).toMatch(/^linear-gradient\(135deg, hsl\(.+\), hsl\(.+\)\)$/);
    });
  });

  it('is deterministic — same input produces byte-identical output', () => {
    ALL_COMBOS.forEach(({ level, category }) => {
      const first = deckGradient({ level, category });
      const second = deckGradient({ level, category });
      expect(first).toBe(second);
    });
  });

  it('is distinct — no two different category combos share the same gradient', () => {
    LEVELS.forEach((level) => {
      const gradients = CATEGORIES.map((cat) => deckGradient({ level, category: cat }));
      const unique = new Set(gradients);
      expect(unique.size).toBe(CATEGORIES.length);
    });
  });

  it('is distinct — no two different level combos share the same gradient', () => {
    CATEGORIES.forEach((category) => {
      const gradients = LEVELS.map((lvl) => deckGradient({ level: lvl, category }));
      const unique = new Set(gradients);
      expect(unique.size).toBe(LEVELS.length);
    });
  });

  it('no collisions across ALL 16 level×category combinations', () => {
    const gradients = ALL_COMBOS.map(({ level, category }) => deckGradient({ level, category }));
    const unique = new Set(gradients);
    expect(unique.size).toBe(ALL_COMBOS.length);
  });
});

// ─── deckGradientStack() ─────────────────────────────────────────────────────

describe('deckGradientStack()', () => {
  const deck = { level: 'A1' as DeckLevel, category: 'vocabulary' as DeckCategory };

  it('returns an object with front, behind1, behind2', () => {
    const stack = deckGradientStack(deck);
    expect(stack).toHaveProperty('front');
    expect(stack).toHaveProperty('behind1');
    expect(stack).toHaveProperty('behind2');
  });

  it('front === deckGradient(deck)', () => {
    const stack = deckGradientStack(deck);
    expect(stack.front).toBe(deckGradient(deck));
  });

  it('returns 3 distinct strings', () => {
    const stack = deckGradientStack(deck);
    const unique = new Set([stack.front, stack.behind1, stack.behind2]);
    expect(unique.size).toBe(3);
  });

  it('is deterministic for stack', () => {
    const a = deckGradientStack(deck);
    const b = deckGradientStack(deck);
    expect(a.front).toBe(b.front);
    expect(a.behind1).toBe(b.behind1);
    expect(a.behind2).toBe(b.behind2);
  });

  it('each string matches the gradient shape', () => {
    const stack = deckGradientStack(deck);
    [stack.front, stack.behind1, stack.behind2].forEach((g) => {
      expect(g).toMatch(/^linear-gradient\(135deg, hsl\(.+\), hsl\(.+\)\)$/);
    });
  });
});

// ─── DxCover ─────────────────────────────────────────────────────────────────

describe('DxCover', () => {
  const baseDeck = {
    id: 'test-deck-1',
    level: 'B1' as DeckLevel,
    category: 'grammar' as DeckCategory,
  };

  it('sets --dx-grad custom property for variant="card" (default)', () => {
    const { container } = render(<DxCover deck={baseDeck} />);
    const host = container.querySelector('.dx-cover-host') as HTMLElement;
    expect(host).not.toBeNull();
    const style = host.getAttribute('style') ?? '';
    expect(style).toContain('--dx-grad');
  });

  it('sets --dx-cover-grad custom property for variant="stack-front"', () => {
    const { container } = render(<DxCover deck={baseDeck} variant="stack-front" />);
    const host = container.querySelector('.dx-cover-host') as HTMLElement;
    const style = host.getAttribute('style') ?? '';
    expect(style).toContain('--dx-cover-grad');
  });

  it('sets --dx-cover-grad-1 custom property for variant="stack-1"', () => {
    const { container } = render(<DxCover deck={baseDeck} variant="stack-1" />);
    const host = container.querySelector('.dx-cover-host') as HTMLElement;
    const style = host.getAttribute('style') ?? '';
    expect(style).toContain('--dx-cover-grad-1');
  });

  it('sets --dx-cover-grad-2 custom property for variant="stack-2"', () => {
    const { container } = render(<DxCover deck={baseDeck} variant="stack-2" />);
    const host = container.querySelector('.dx-cover-host') as HTMLElement;
    const style = host.getAttribute('style') ?? '';
    expect(style).toContain('--dx-cover-grad-2');
  });

  it('sets data-variant attribute matching the variant prop', () => {
    const variants = ['card', 'stack-front', 'stack-1', 'stack-2'] as const;
    variants.forEach((variant) => {
      const { container } = render(<DxCover deck={baseDeck} variant={variant} />);
      const host = container.querySelector('.dx-cover-host');
      expect(host).toHaveAttribute('data-variant', variant);
    });
  });

  it('renders children inside the host', () => {
    const { getByText } = render(
      <DxCover deck={baseDeck}>
        <span>Hello Cover</span>
      </DxCover>
    );
    expect(getByText('Hello Cover')).not.toBeNull();
  });

  it('emits NO <img> element', () => {
    const { container } = render(
      <DxCover deck={baseDeck}>
        <span>content</span>
      </DxCover>
    );
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(0);
  });

  it('forwards className to the host element', () => {
    const { container } = render(<DxCover deck={baseDeck} className="my-class" />);
    const host = container.querySelector('.dx-cover-host');
    expect(host?.classList.contains('my-class')).toBe(true);
  });

  it('the gradient value in the style attribute matches deckGradient()', () => {
    const { container } = render(<DxCover deck={baseDeck} variant="card" />);
    const host = container.querySelector('.dx-cover-host') as HTMLElement;
    const styleAttr = host.getAttribute('style') ?? '';
    const expected = deckGradient(baseDeck);
    // The style attr should contain the gradient string
    expect(styleAttr).toContain(expected);
  });

  // ─── Cover image layer ──────────────────────────────────────────────────────

  const coverUrl = 'https://example.com/deck-cover.png';

  it('renders the cover image layer when coverImageUrl is set', () => {
    const { container } = render(<DxCover deck={{ ...baseDeck, coverImageUrl: coverUrl }} />);
    const img = container.querySelector('.dx-cover-img') as HTMLElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute('style') ?? '').toContain(`url("${coverUrl}")`);
    // Decorative layer — hidden from the a11y tree.
    expect(img.getAttribute('aria-hidden')).toBe('true');
  });

  it('does NOT render the cover image layer when coverImageUrl is absent (gradient fallback)', () => {
    const { container } = render(<DxCover deck={baseDeck} />);
    expect(container.querySelector('.dx-cover-img')).toBeNull();
    // Gradient is still applied as the fallback.
    const host = container.querySelector('.dx-cover-host') as HTMLElement;
    expect(host.getAttribute('style') ?? '').toContain('--dx-grad');
  });

  it('still emits NO <img> element even when coverImageUrl is set', () => {
    const { container } = render(<DxCover deck={{ ...baseDeck, coverImageUrl: coverUrl }} />);
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('keeps the gradient custom property as fallback when a cover image is present', () => {
    const { container } = render(<DxCover deck={{ ...baseDeck, coverImageUrl: coverUrl }} />);
    const host = container.querySelector('.dx-cover-host') as HTMLElement;
    expect(host.getAttribute('style') ?? '').toContain(deckGradient(baseDeck));
  });

  it('adds the has-cover class (stronger scrim) only when a cover image is present', () => {
    const withImg = render(<DxCover deck={{ ...baseDeck, coverImageUrl: coverUrl }} />);
    expect(withImg.container.querySelector('.dx-cover-host')?.classList.contains('has-cover')).toBe(
      true
    );

    const noImg = render(<DxCover deck={baseDeck} />);
    expect(noImg.container.querySelector('.dx-cover-host')?.classList.contains('has-cover')).toBe(
      false
    );
  });
});
