/**
 * pf/CardHead.tsx — unit tests (PRACT2-1-03)
 *
 * Covers:
 * - Renders pf-head container
 * - Shows family badge (pf-fam) with descriptor.label
 * - Shows POS chip (pf-pos) when posLabel is provided
 * - Shows gender-tinted article when gender is present (noun card)
 * - Shows UnwiredDot amber when gender is absent (noun card)
 * - No POS chip when posLabel is null
 * - EN/RU lang switch renders both buttons
 * - Calls onLangChange with 'en' / 'ru'
 * - Pressed state on active lang button
 */

import React from 'react';

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { CardHead } from '../CardHead';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

// Mock dx.css import (no-op in test env)
vi.mock('@/features/decks/dx/dx.css', () => ({}));

// ─── Base props ───────────────────────────────────────────────────────────────

const BASE = {
  cardType: 'meaning_el_to_en',
  posLabel: 'Noun',
  gender: null,
  genderRu: null,
  currentLang: 'en' as const,
  onLangChange: vi.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CardHead', () => {
  it('renders pf-head container', () => {
    const { container } = render(<CardHead {...BASE} />);
    expect(container.querySelector('.pf-head')).not.toBeNull();
  });

  it('renders family badge (pf-fam) with full label', () => {
    render(<CardHead {...BASE} cardType="meaning_el_to_en" />);
    // translation family label = 'Translation'
    const badge = screen.getByTestId('pf-fam-badge');
    expect(badge.textContent).toContain('Translation');
  });

  it('renders grammar family badge for article card', () => {
    render(<CardHead {...BASE} cardType="article" />);
    const badge = screen.getByTestId('pf-fam-badge');
    expect(badge.textContent).toContain('Grammar');
  });

  it('renders POS chip when posLabel is provided', () => {
    render(<CardHead {...BASE} posLabel="Noun" />);
    expect(screen.getByTestId('pf-pos-chip')).not.toBeNull();
  });

  it('does not render POS chip when posLabel is null', () => {
    const { container } = render(<CardHead {...BASE} posLabel={null} />);
    expect(container.querySelector('.pf-pos')).toBeNull();
  });

  describe('Gender-tinted article', () => {
    it('shows masculine article "ο" with data-gender=masculine when gender=masculine', () => {
      render(<CardHead {...BASE} posLabel="Noun" gender="masculine" />);
      const art = screen.getByTestId('pf-article');
      expect(art.textContent).toBe('ο');
      expect(art.getAttribute('data-gender')).toBe('masculine');
    });

    it('shows feminine article "η" with data-gender=feminine when gender=feminine', () => {
      render(<CardHead {...BASE} posLabel="Noun" gender="feminine" />);
      const art = screen.getByTestId('pf-article');
      expect(art.textContent).toBe('η');
      expect(art.getAttribute('data-gender')).toBe('feminine');
    });

    it('shows neuter article "το" with data-gender=neuter when gender=neuter', () => {
      render(<CardHead {...BASE} posLabel="Noun" gender="neuter" />);
      const art = screen.getByTestId('pf-article');
      expect(art.textContent).toBe('το');
      expect(art.getAttribute('data-gender')).toBe('neuter');
    });

    it('renders UnwiredDot (amber) when gender is absent on a noun card', () => {
      render(<CardHead {...BASE} posLabel="Noun" gender={null} />);
      // UnwiredDot renders [data-testid="unwired-dot"]
      expect(screen.getByTestId('unwired-dot')).not.toBeNull();
    });

    it('does NOT render article slot when posLabel is not Noun', () => {
      render(<CardHead {...BASE} posLabel="Verb" gender="masculine" />);
      expect(screen.queryByTestId('pf-article')).toBeNull();
      expect(screen.queryByTestId('unwired-dot')).toBeNull();
    });
  });

  describe('EN/RU language switch', () => {
    it('renders both EN and RU buttons', () => {
      render(<CardHead {...BASE} />);
      expect(screen.getByTestId('pf-lang-en')).not.toBeNull();
      expect(screen.getByTestId('pf-lang-ru')).not.toBeNull();
    });

    it('EN button has aria-pressed=true when currentLang=en', () => {
      render(<CardHead {...BASE} currentLang="en" />);
      expect(screen.getByTestId('pf-lang-en').getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByTestId('pf-lang-ru').getAttribute('aria-pressed')).toBe('false');
    });

    it('RU button has aria-pressed=true when currentLang=ru', () => {
      render(<CardHead {...BASE} currentLang="ru" />);
      expect(screen.getByTestId('pf-lang-ru').getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByTestId('pf-lang-en').getAttribute('aria-pressed')).toBe('false');
    });

    it('calls onLangChange("ru") when RU clicked', () => {
      const onLangChange = vi.fn();
      render(<CardHead {...BASE} onLangChange={onLangChange} />);
      fireEvent.click(screen.getByTestId('pf-lang-ru'));
      expect(onLangChange).toHaveBeenCalledWith('ru');
    });

    it('calls onLangChange("en") when EN clicked', () => {
      const onLangChange = vi.fn();
      render(<CardHead {...BASE} onLangChange={onLangChange} />);
      fireEvent.click(screen.getByTestId('pf-lang-en'));
      expect(onLangChange).toHaveBeenCalledWith('en');
    });
  });

  describe('Gender label (genderRu)', () => {
    it('shows English gender label when currentLang=en and gender is present', () => {
      render(<CardHead {...BASE} gender="masculine" genderRu="Мужской" currentLang="en" />);
      const label = screen.getByTestId('pf-gender-label');
      expect(label.textContent).toBe('masculine');
    });

    it('shows Russian gender label when currentLang=ru and genderRu is present', () => {
      render(<CardHead {...BASE} gender="masculine" genderRu="Мужской" currentLang="ru" />);
      const label = screen.getByTestId('pf-gender-label');
      expect(label.textContent).toBe('Мужской');
    });

    it('falls back to English gender when currentLang=ru but genderRu is null', () => {
      render(<CardHead {...BASE} gender="masculine" genderRu={null} currentLang="ru" />);
      const label = screen.getByTestId('pf-gender-label');
      expect(label.textContent).toBe('masculine');
    });

    it('does not render gender label when gender is absent', () => {
      render(<CardHead {...BASE} gender={null} genderRu={null} currentLang="en" />);
      expect(screen.queryByTestId('pf-gender-label')).toBeNull();
    });
  });
});
