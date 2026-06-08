/**
 * pf/TopBar.tsx — unit tests (PRACT2-1-02)
 *
 * Covers:
 * - Deck label: title line shows "{deckName} · Practice"
 * - Deck label: meta line shows counts from totals props
 * - Fallback to "Practice" when deckName is null
 * - Exit button renders and fires onExit
 * - TopBar renders without crashing
 */

import { render, screen, fireEvent } from '@testing-library/react';
import i18n from 'i18next';
import { describe, it, expect, vi } from 'vitest';

import type { StudyQueueCard } from '@/services/studyAPI';

import { TopBar } from '../TopBar';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/components/i18n', () => ({
  LanguageSwitcher: () => <button aria-label="language">lang</button>,
}));

vi.mock('@/components/theme', () => ({
  ThemeSwitcher: () => <button aria-label="theme">theme</button>,
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeCard(id: string, cardType = 'meaning_el_to_en'): StudyQueueCard {
  return {
    card_record_id: id,
    word_entry_id: `we-${id}`,
    deck_id: 'deck-1',
    deck_name: 'Test Deck',
    card_type: cardType as StudyQueueCard['card_type'],
    variant_key: null,
    front_content: {},
    back_content: {},
    status: 'new',
    is_new: true,
    is_early_practice: false,
    due_date: null,
    easiness_factor: null,
    interval: null,
    audio_url: null,
    example_audio_url: null,
    translation_ru: null,
    translation_ru_plural: null,
    sentence_ru: null,
    example_el: null,
    example_en: null,
  };
}

const CARDS = [makeCard('c1'), makeCard('c2'), makeCard('c3')];
const BASE_PROPS = {
  onExit: vi.fn(),
  deckName: 'Greek Basics',
  cards: CARDS,
  currentIndex: 0,
  totalNew: 5,
  totalReview: 10,
  streak: 0,
  ratings: [null, null, null],
  showStreak: false,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TopBar', () => {
  it('renders without crashing', () => {
    const { container } = render(<TopBar {...BASE_PROPS} />);
    expect(container.querySelector('[data-testid="pf-top-bar"]')).not.toBeNull();
  });

  describe('Deck label', () => {
    it('shows "{deckName} · Practice" on the first line', () => {
      render(<TopBar {...BASE_PROPS} />);
      expect(screen.getByText('Greek Basics · Practice')).not.toBeNull();
    });

    it('falls back to "Practice · Practice" when deckName is null', () => {
      render(<TopBar {...BASE_PROPS} deckName={null} />);
      expect(screen.getByText('Practice · Practice')).not.toBeNull();
    });

    it('shows total cards count in meta line', () => {
      render(<TopBar {...BASE_PROPS} />);
      // CARDS.length = 3
      expect(screen.getByText(/3 cards/)).not.toBeNull();
    });

    it('shows totalReview count in meta line', () => {
      render(<TopBar {...BASE_PROPS} totalReview={10} />);
      expect(screen.getByText(/10 review/)).not.toBeNull();
    });

    it('shows totalNew count in meta line', () => {
      render(<TopBar {...BASE_PROPS} totalNew={5} />);
      expect(screen.getByText(/5 new/)).not.toBeNull();
    });
  });

  describe('Exit button', () => {
    it('calls onExit when exit button is clicked', () => {
      const onExit = vi.fn();
      render(<TopBar {...BASE_PROPS} onExit={onExit} />);
      fireEvent.click(screen.getByTestId('pf-exit-button'));
      expect(onExit).toHaveBeenCalledTimes(1);
    });
  });

  describe('RU locale meta counts', () => {
    it('shows RU meta counts (карт. / повтор. / нов.) when language is ru', async () => {
      await i18n.changeLanguage('ru');
      render(<TopBar {...BASE_PROPS} />);
      // RU translation: "{{cards}} карт. · {{review}} повтор. · {{new}} нов."
      const meta = document.querySelector('.pf-deck-label__meta');
      expect(meta?.textContent).toMatch(/карт\./);
      expect(meta?.textContent).toMatch(/повтор\./);
      // afterEach in test-setup resets language back to 'en'
    });
  });
});
