/**
 * FeedCards — deck cover photo rendering (deck-covers-always-available)
 *
 * The resume hero front tile (.db-cover-3) and the deck card illustration
 * block (.db-deck-illo) paint the deck's real cover photo when coverImageUrl
 * is present, and fall back to the gradient tile / Greek-letter mark otherwise.
 */

import { describe, it, expect, vi } from 'vitest';

import { renderWithProviders } from '@/lib/test-utils';
import type { Deck } from '@/types/deck';

import { FeedCard } from '../FeedCards';
import type { FeedItem } from '../lib/composeFeed';

const COVER_URL = 'https://cdn.example.com/deck-cover.jpg';

function makeDeck(overrides: Partial<Deck> = {}): Deck {
  return {
    id: 'deck-x',
    title: 'Greetings',
    titleGreek: 'Χαιρετισμοί',
    description: '',
    level: 'A1',
    category: 'vocabulary',
    tags: [],
    cardCount: 12,
    estimatedTime: 8,
    isPremium: false,
    thumbnail: '',
    createdBy: 'Greeklish',
    createdAt: new Date(),
    updatedAt: new Date(),
    nameEn: 'Greetings',
    nameRu: 'Приветствия',
    progress: {
      deckId: 'deck-x',
      status: 'in-progress',
      cardsTotal: 10,
      cardsNew: 5,
      cardsLearning: 3,
      cardsReview: 2,
      cardsMastered: 2,
      dueToday: 2,
      streak: 0,
      totalTimeSpent: 0,
      accuracy: 50,
    },
    ...overrides,
  };
}

const resumeItem = (deck: Deck, siblings: Deck[] = []): FeedItem => ({
  id: `resume-${deck.id}`,
  type: 'resume',
  span: 'hero',
  tone: 'primary',
  deck,
  siblings,
});

const deckItem = (deck: Deck): FeedItem => ({
  id: `deck-${deck.id}`,
  type: 'deck',
  span: 'side',
  tone: 'primary',
  deck,
  illo: 'deck',
});

function renderCard(item: FeedItem) {
  return renderWithProviders(
    <FeedCard item={item} onOpenDeck={vi.fn()} onStartReview={vi.fn()} onStartQuick={vi.fn()} />
  );
}

describe('FeedDeck cover rendering', () => {
  it('paints the cover photo and hides the letter mark when coverImageUrl is set', () => {
    const { container } = renderCard(deckItem(makeDeck({ coverImageUrl: COVER_URL })));

    const illo = container.querySelector('.db-deck-illo') as HTMLElement;
    expect(illo).not.toBeNull();
    expect(illo.classList.contains('has-cover')).toBe(true);
    expect(illo.style.backgroundImage).toContain(COVER_URL);
    expect(container.querySelector('.db-deck-illo-mark')).toBeNull();
  });

  it('falls back to the gradient + Greek-letter mark when there is no cover', () => {
    const { container } = renderCard(deckItem(makeDeck({ coverImageUrl: undefined })));

    const illo = container.querySelector('.db-deck-illo') as HTMLElement;
    expect(illo.classList.contains('has-cover')).toBe(false);
    expect(illo.style.backgroundImage).toBe('');
    expect(container.querySelector('.db-deck-illo-mark')).not.toBeNull();
  });
});

describe('FeedHeroResume cover rendering', () => {
  it('paints the cover photo on the front tile when coverImageUrl is set', () => {
    const { container } = renderCard(resumeItem(makeDeck({ coverImageUrl: COVER_URL })));

    const front = container.querySelector('.dx-cover-3') as HTMLElement;
    expect(front).not.toBeNull();
    expect(front.classList.contains('has-cover')).toBe(true);
    const img = front.querySelector('.dx-cover-img') as HTMLElement;
    expect(img).not.toBeNull();
    expect(img.style.backgroundImage).toContain(COVER_URL);
  });

  it('keeps the gradient tile when there is no cover', () => {
    const { container } = renderCard(resumeItem(makeDeck({ coverImageUrl: undefined })));

    const front = container.querySelector('.dx-cover-3') as HTMLElement;
    expect(front.classList.contains('has-cover')).toBe(false);
    expect(front.querySelector('.dx-cover-img')).toBeNull();
  });

  it('renders sibling cover tiles behind the front when 2+ siblings exist', () => {
    const sib1 = makeDeck({ id: 's1', coverImageUrl: 'https://cdn.example.com/s1.jpg' });
    const sib2 = makeDeck({ id: 's2', coverImageUrl: 'https://cdn.example.com/s2.jpg' });
    const { container } = renderCard(
      resumeItem(makeDeck({ coverImageUrl: COVER_URL }), [sib1, sib2])
    );

    expect(container.querySelector('.dx-cover-1')).not.toBeNull();
    expect(container.querySelector('.dx-cover-2')).not.toBeNull();
    // front + 2 siblings all paint a cover image
    expect(container.querySelectorAll('.dx-cover-img')).toHaveLength(3);
  });

  it('omits sibling tiles when fewer than 2 siblings exist', () => {
    const sib1 = makeDeck({ id: 's1', coverImageUrl: 'https://cdn.example.com/s1.jpg' });
    const { container } = renderCard(resumeItem(makeDeck({ coverImageUrl: COVER_URL }), [sib1]));

    expect(container.querySelector('.dx-cover-1')).toBeNull();
    expect(container.querySelector('.dx-cover-2')).toBeNull();
    expect(container.querySelectorAll('.dx-cover-img')).toHaveLength(1);
  });
});
