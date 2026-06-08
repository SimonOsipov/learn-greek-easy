/**
 * CultureHero Component Tests — DVP-01
 *
 * Covers the sibling-gate decoupling:
 * - Front cover always renders when coverDeck is present (0, 1, or 2+ siblings)
 * - Sibling covers (stack-1 / stack-2) render only when siblingDecks.length >= 2
 * - Deck-detail usage: coverDeck set, no siblings → front cover shown, siblings absent
 * - No coverDeck → right column absent
 */

import { describe, it, expect } from 'vitest';

import { render } from '@/lib/test-utils';

import { CultureHero } from '../CultureHero';
import type { CultureHeroProps } from '../CultureHero';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const coverDeck: CultureHeroProps['coverDeck'] = {
  id: 'deck-1',
  level: 'A1',
  category: 'culture',
  coverImageUrl: undefined,
};

const makeSibling = (id: string): NonNullable<CultureHeroProps['siblingDecks']>[number] => ({
  id,
  level: 'A1',
  category: 'culture',
  coverImageUrl: undefined,
  title: `Sibling ${id}`,
});

const sibling1 = makeSibling('s1');
const sibling2 = makeSibling('s2');

const baseProps: CultureHeroProps = {
  kicker: 'Culture',
  title: 'Ancient Greece',
  coverDeck,
};

// ── Helper ────────────────────────────────────────────────────────────────────

function renderHero(props: Partial<CultureHeroProps> = {}) {
  return render(<CultureHero {...baseProps} {...props} />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CultureHero — sibling gate (DVP-01)', () => {
  // ── Deck-detail usage: coverDeck present, no siblings ─────────────────────

  it('renders the front cover (dx-cover-stack + dx-cover-3) when coverDeck is set and siblingDecks is empty', () => {
    const { container } = renderHero({ siblingDecks: [] });

    expect(container.querySelector('.dx-cover-stack')).toBeInTheDocument();
    expect(container.querySelector('.dx-cover-3')).toBeInTheDocument();
  });

  it('does NOT render sibling covers when siblingDecks is empty', () => {
    const { container } = renderHero({ siblingDecks: [] });

    expect(container.querySelector('.dx-cover-1')).not.toBeInTheDocument();
    expect(container.querySelector('.dx-cover-2')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.dx-cover').length).toBe(1);
  });

  // ── Hub usage: 1 sibling — still only front cover ─────────────────────────

  it('renders only the front cover (1 sibling provided — below threshold)', () => {
    const { container } = renderHero({ siblingDecks: [sibling1] });

    expect(container.querySelector('.dx-cover-stack')).toBeInTheDocument();
    expect(container.querySelector('.dx-cover-3')).toBeInTheDocument();
    expect(container.querySelector('.dx-cover-1')).not.toBeInTheDocument();
    expect(container.querySelector('.dx-cover-2')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.dx-cover').length).toBe(1);
  });

  // ── Hub usage: 2 siblings — full stack ───────────────────────────────────

  it('renders 3 covers (front + 2 siblings) when siblingDecks.length >= 2', () => {
    const { container } = renderHero({ siblingDecks: [sibling1, sibling2] });

    expect(container.querySelector('.dx-cover-stack')).toBeInTheDocument();
    expect(container.querySelector('.dx-cover-1')).toBeInTheDocument();
    expect(container.querySelector('.dx-cover-2')).toBeInTheDocument();
    expect(container.querySelector('.dx-cover-3')).toBeInTheDocument();
    expect(container.querySelectorAll('.dx-cover').length).toBe(3);
  });

  // ── No coverDeck → right column absent ───────────────────────────────────

  it('does NOT render the right column when coverDeck is absent', () => {
    const { container } = render(<CultureHero kicker="Culture" title="Ancient Greece" />);

    expect(container.querySelector('.dx-cover-stack')).not.toBeInTheDocument();
    expect(container.querySelector('.dx-cover-3')).not.toBeInTheDocument();
  });
});
