/**
 * pf/CardHead.tsx — unit tests (PRACT2-5-07)
 *
 * Covers:
 * - Renders pf-head container
 * - Shows family badge (pf-fam / pf-fam-badge) with descriptor.label
 * - Family badge cases: 'meaning_el_to_en' → 'Translation', 'article' → 'Grammar'
 * - Positive guard: pf-fam-badge present AND pf-pos-chip / pf-pos / pf-lang-switch / pf-lang-en / pf-lang-ru absent
 */

import React from 'react';

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { CardHead } from '../CardHead';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock dx.css import (no-op in test env)
// CardHead no longer imports dx.css directly, but keep in case a transitive import does.

// ─── Base props ───────────────────────────────────────────────────────────────

const BASE = { cardType: 'meaning_el_to_en' };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CardHead', () => {
  it('renders pf-head container', () => {
    const { container } = render(<CardHead {...BASE} />);
    expect(container.querySelector('.pf-head')).not.toBeNull();
  });

  it('renders family badge (pf-fam) with full label for meaning_el_to_en', () => {
    render(<CardHead {...BASE} cardType="meaning_el_to_en" />);
    // translation family label = 'Translation'
    const badge = screen.getByTestId('pf-fam-badge');
    expect(badge.textContent).toContain('Translation');
  });

  it('renders grammar family badge for article card', () => {
    render(<CardHead {...BASE} cardType="article" />);
    // article maps to 'grammar' family → label = 'Grammar'
    const badge = screen.getByTestId('pf-fam-badge');
    expect(badge.textContent).toContain('Grammar');
  });

  it('positive guard: pf-fam-badge is present and removed elements are absent', () => {
    const { container } = render(<CardHead {...BASE} />);
    // Family badge must be present
    expect(container.querySelector('.pf-fam')).not.toBeNull();
    expect(screen.getByTestId('pf-fam-badge')).not.toBeNull();
    // POS chip, POS label, lang-switch buttons — all removed in PRACT2-5
    expect(screen.queryByTestId('pf-pos-chip')).toBeNull();
    expect(container.querySelector('.pf-pos')).toBeNull();
    expect(screen.queryByTestId('pf-lang-switch')).toBeNull();
    expect(container.querySelector('[data-testid="pf-lang-en"]')).toBeNull();
    expect(container.querySelector('[data-testid="pf-lang-ru"]')).toBeNull();
  });
});
