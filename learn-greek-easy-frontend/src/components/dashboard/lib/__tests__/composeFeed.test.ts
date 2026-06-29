// src/components/dashboard/lib/__tests__/composeFeed.test.ts
// RED specs for composeFeed / countByFilter / filterFeed / FEED_FILTERS.
// Test-first (DASH2-01-06): authored BEFORE the executor implements the function bodies.
// Expected result: composeFeed/countByFilter tests fail on assertions; FEED_FILTERS test passes
// (it tests a correctly-defined constant); filterFeed('cards'/'news'/'practice') tests fail.

import { describe, it, expect } from 'vitest';

import type { Deck } from '@/types/deck';
import type { LearnerSituationListItem } from '@/types/situation';
import type { NewsItemResponse } from '@/services/adminAPI';

import {
  composeFeed,
  countByFilter,
  filterFeed,
  FEED_FILTERS,
  type FeedItem,
  type FeedSources,
} from '../composeFeed';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeDeck(
  id: string,
  opts: {
    dueToday?: number;
    cardsReview?: number;
    lastStudied?: Date;
  } = {}
): Deck {
  return {
    id,
    title: `Deck ${id}`,
    titleGreek: `Ελ ${id}`,
    description: '',
    level: 'A1',
    category: 'vocabulary',
    tags: [],
    cardCount: 20,
    estimatedTime: 10,
    isPremium: false,
    createdBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    progress: {
      deckId: id,
      status: 'in-progress',
      cardsTotal: 20,
      cardsNew: 0,
      cardsLearning: 5,
      cardsReview: opts.cardsReview ?? 2,
      cardsMastered: 10,
      dueToday: opts.dueToday ?? 0,
      streak: 1,
      lastStudied: opts.lastStudied,
      totalTimeSpent: 20,
      accuracy: 80,
    },
  };
}

function makeSituation(id: string): LearnerSituationListItem {
  return {
    id,
    scenario_el: 'Στο εστιατόριο',
    scenario_en: 'At the restaurant',
    scenario_ru: 'В ресторане',
    status: 'ready',
    has_audio: true,
    has_dialog: true,
    exercise_total: 8,
    exercise_completed: 0,
    source_image_url: null,
    domain: 'everyday',
  };
}

function makeNews(id: string): NewsItemResponse {
  return {
    id,
    title_el: 'Τίτλος νέου',
    title_en: 'News title',
    title_ru: 'Заголовок новости',
    description_el: 'Περιγραφή',
    description_en: 'Description',
    description_ru: 'Описание',
    publication_date: '2026-06-29',
    original_article_url: `https://example.com/news/${id}`,
    image_url: null,
    audio_url: null,
    audio_generated_at: null,
    audio_duration_seconds: null,
    audio_file_size_bytes: null,
    created_at: '2026-06-29T00:00:00Z',
    updated_at: '2026-06-29T00:00:00Z',
    country: 'greece',
    title_el_a2: null,
    description_el_a2: null,
    audio_a2_url: null,
    audio_a2_duration_seconds: null,
    audio_a2_generated_at: null,
    audio_a2_file_size_bytes: null,
    has_a2_content: false,
    alt_text: null,
    photo_credit: null,
    status: 'published',
    linked_situation: null,
    image_variants: null,
  };
}

// ─── Shared fixtures ──────────────────────────────────────────────────────────

// Deck A: most recently studied → becomes the resume deck
const deckA = makeDeck('A', {
  lastStudied: new Date('2026-06-28T12:00:00Z'),
  dueToday: 3,
  cardsReview: 3,
});
// Deck B: active (in-progress, has due cards), not the resume candidate
const deckB = makeDeck('B', {
  lastStudied: new Date('2026-06-27T12:00:00Z'),
  dueToday: 0,
  cardsReview: 2,
});
// Deck C: active (cardsReview > 0), oldest studied → also not resume candidate
const deckC = makeDeck('C', { dueToday: 0, cardsReview: 1 });

const sit1 = makeSituation('S1');
const n1 = makeNews('N1');
const n2 = makeNews('N2');

const fullSources: FeedSources = {
  decks: [deckA, deckB, deckC],
  cardsDue: 3,
  currentStreak: 7,
  longestStreak: 14,
  news: [n1, n2],
  situations: [sit1],
  queueCount: 5,
};

// ─── composeFeed specs ────────────────────────────────────────────────────────

describe('composeFeed', () => {
  // AC F/D1 — fixed priority order
  it('orders_types_in_fixed_priority', () => {
    // 3 decks (A=resume, B+C=deck items), 1 situation, 2 news → 10 items in exact priority order
    const items = composeFeed(fullSources);
    expect(items.map((i) => i.type)).toEqual([
      'resume',
      'review',
      'situation',
      'wordOfDay',
      'deck', // deckB
      'deck', // deckC
      'milestone',
      'news', // n1
      'news', // n2
      'quick',
    ]);
  });

  // AC F — resume deck excluded from deck items (D-RESUME-DUP: resume appears once as resume card)
  it('resume_deck_excluded_from_deck_items', () => {
    const items = composeFeed(fullSources);

    const resumeItems = items.filter((i) => i.type === 'resume');
    const deckItems = items.filter((i) => i.type === 'deck');

    // Exactly one resume item pointing at deckA
    expect(resumeItems).toHaveLength(1);
    const resumeCard = resumeItems[0] as Extract<FeedItem, { type: 'resume' }>;
    expect(resumeCard.deck.id).toBe('A');

    // deckA must NOT appear as a deck item
    const deckIds = deckItems.map((i) => (i as Extract<FeedItem, { type: 'deck' }>).deck.id);
    expect(deckIds).not.toContain('A');

    // deckB and deckC must each appear once as deck items
    expect(deckIds).toContain('B');
    expect(deckIds).toContain('C');
    expect(deckItems).toHaveLength(2);
  });

  // AC F/D-WOTD — wordOfDay always emitted, even with completely empty sources
  it('wordOfDay_always_present_after_situation_before_deck', () => {
    const items = composeFeed({
      decks: [],
      cardsDue: 0,
      currentStreak: 0,
      longestStreak: 0,
      news: [],
      situations: [],
      queueCount: 0,
    });

    // With empty sources the only item is wordOfDay
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('wordOfDay');
    expect(items[0].span).toBe('compact');
  });

  // AC F — correct span assigned per type (resume=hero, review/deck=side, rest=compact)
  it('assigns_correct_span_per_type', () => {
    const items = composeFeed(fullSources);
    // Use a Map so duplicate types (deck, news) don't overwrite each other for span checks
    const byType = new Map(items.map((i) => [i.type, i]));

    expect(byType.get('resume')?.span).toBe('hero');
    expect(byType.get('review')?.span).toBe('side');
    expect(byType.get('situation')?.span).toBe('compact');
    expect(byType.get('wordOfDay')?.span).toBe('compact');
    expect(byType.get('deck')?.span).toBe('side');
    expect(byType.get('milestone')?.span).toBe('compact');
    expect(byType.get('news')?.span).toBe('compact');
    expect(byType.get('quick')?.span).toBe('compact');
  });

  // AC F — items only emitted when source data is present (except wordOfDay which is always present)
  it('presence_gated_by_data', () => {
    // wordOfDay is ALWAYS present (D-WOTD)
    const emptyItems = composeFeed({
      decks: [],
      cardsDue: 0,
      currentStreak: 0,
      longestStreak: 0,
      news: [],
      situations: [],
      queueCount: 0,
    });
    expect(emptyItems.some((i) => i.type === 'wordOfDay')).toBe(true);

    // cardsDue=0 → no review card
    const noReview = composeFeed({ ...fullSources, cardsDue: 0 });
    expect(noReview.some((i) => i.type === 'review')).toBe(false);

    // currentStreak=0 → no milestone card
    const noMilestone = composeFeed({ ...fullSources, currentStreak: 0 });
    expect(noMilestone.some((i) => i.type === 'milestone')).toBe(false);

    // queueCount=0 → no quick card
    const noQuick = composeFeed({ ...fullSources, queueCount: 0 });
    expect(noQuick.some((i) => i.type === 'quick')).toBe(false);

    // situations=[] → no situation card
    const noSit = composeFeed({ ...fullSources, situations: [] });
    expect(noSit.some((i) => i.type === 'situation')).toBe(false);

    // news=[n1, n2] → exactly two news items (1:1 mapping)
    const withNews = composeFeed({ ...fullSources, news: [n1, n2] });
    expect(withNews.filter((i) => i.type === 'news')).toHaveLength(2);
  });

  // AC F — all ids are unique and stable across calls with the same sources
  it('ids_are_unique_and_stable', () => {
    const items = composeFeed(fullSources);
    const ids = items.map((i) => i.id);

    // Every id must be unique
    expect(new Set(ids).size).toBe(ids.length);

    // resume id format: resume-${deck.id}
    const resumeItem = items.find((i) => i.type === 'resume');
    expect(resumeItem?.id).toBe(`resume-${deckA.id}`);

    // situation id format: situation-${sit.id}
    const sitItem = items.find((i) => i.type === 'situation');
    expect(sitItem?.id).toBe(`situation-${sit1.id}`);

    // wordOfDay constant id
    const wordItem = items.find((i) => i.type === 'wordOfDay');
    expect(wordItem?.id).toBe('word-of-day');

    // news ids: news-${item.id} in source order
    const newsItems = items.filter((i) => i.type === 'news');
    expect(newsItems[0]?.id).toBe(`news-${n1.id}`);
    expect(newsItems[1]?.id).toBe(`news-${n2.id}`);
  });
});

// ─── FEED_FILTERS spec ────────────────────────────────────────────────────────

describe('FEED_FILTERS', () => {
  // AC F — FEED_FILTERS matches CD dashboard.jsx:522-527
  // NOTE: this test verifies a correctly-defined constant and will PASS against the stub.
  it('FEED_FILTERS_matches_CD', () => {
    expect(FEED_FILTERS).toHaveLength(4);

    const all = FEED_FILTERS.find((f) => f.k === 'all')!;
    const cards = FEED_FILTERS.find((f) => f.k === 'cards')!;
    const news = FEED_FILTERS.find((f) => f.k === 'news')!;
    const practice = FEED_FILTERS.find((f) => f.k === 'practice')!;

    expect(all.types).toBeNull();
    expect(cards.types).toEqual(['resume', 'review', 'deck']);
    expect(news.types).toEqual(['news']);
    expect(practice.types).toEqual(['situation', 'quick']);
  });
});

// ─── countByFilter + filterFeed specs ────────────────────────────────────────

// Pre-built item array (10 items matching §6 spec) for pure filter/count tests.
// Constructed directly as literals so these tests don't depend on composeFeed.
const ten: FeedItem[] = [
  { id: 'resume-A', type: 'resume', span: 'hero', tone: 'primary', deck: deckA },
  { id: 'review', type: 'review', span: 'side', tone: 'blue', cardsDue: 3, dueDecks: [deckA] },
  { id: 'situation-S1', type: 'situation', span: 'compact', tone: 'cyan', situation: sit1 },
  { id: 'word-of-day', type: 'wordOfDay', span: 'compact', tone: 'amber' },
  { id: 'deck-B', type: 'deck', span: 'side', tone: 'primary', deck: deckB, illo: 'deck' },
  { id: 'deck-C', type: 'deck', span: 'side', tone: 'violet', deck: deckC, illo: 'deck' },
  {
    id: 'milestone',
    type: 'milestone',
    span: 'compact',
    tone: 'amber',
    currentStreak: 7,
    longestStreak: 14,
  },
  { id: 'news-N1', type: 'news', span: 'compact', tone: 'blue', news: n1 },
  { id: 'news-N2', type: 'news', span: 'compact', tone: 'blue', news: n2 },
  { id: 'quick', type: 'quick', span: 'compact', tone: 'green', queueCount: 5 },
];

describe('countByFilter', () => {
  // AC F — countByFilter buckets correctly
  it('countByFilter_buckets_correctly', () => {
    const counts = countByFilter(ten);

    // all = 10 items total
    expect(counts.all).toBe(10);

    // cards = resume(1) + review(1) + deck(2) = 4
    expect(counts.cards).toBe(4);

    // news = 2
    expect(counts.news).toBe(2);

    // practice = situation(1) + quick(1) = 2
    expect(counts.practice).toBe(2);
  });

  // AC F — wordOfDay and milestone counted only under 'all', not under any tab
  it('word_and_milestone_only_in_all', () => {
    const counts = countByFilter(ten);

    // Sum of all per-tab counts (excluding 'all') = cards + news + practice = 4+2+2 = 8
    // This is less than all=10 because wordOfDay(1) + milestone(1) are not in any tab
    const nonAllSum = counts.cards + counts.news + counts.practice;
    expect(nonAllSum).toBe(8);
    expect(counts.all).toBe(10);
    expect(counts.all - nonAllSum).toBe(2); // exactly wordOfDay + milestone
  });
});

describe('filterFeed', () => {
  // AC F — filterFeed returns the correct subset per filter key
  it('filterFeed_returns_subset_by_type', () => {
    // 'all' → all 10 items unchanged
    expect(filterFeed(ten, 'all')).toHaveLength(10);

    // 'cards' → resume(1) + review(1) + deck(2) = 4 items only
    const cards = filterFeed(ten, 'cards');
    expect(cards).toHaveLength(4);
    expect(cards.every((i) => ['resume', 'review', 'deck'].includes(i.type))).toBe(true);

    // 'news' → 2 news items only
    const newsFiltered = filterFeed(ten, 'news');
    expect(newsFiltered).toHaveLength(2);
    expect(newsFiltered.every((i) => i.type === 'news')).toBe(true);

    // 'practice' → situation(1) + quick(1) = 2 items only
    const practice = filterFeed(ten, 'practice');
    expect(practice).toHaveLength(2);
    expect(practice.every((i) => ['situation', 'quick'].includes(i.type))).toBe(true);
  });
});

// ─── Adversarial / edge / boundary tests (QA Mode B additions) ───────────────

describe('composeFeed — adversarial', () => {
  // Edge: partial sources — only news + quick present (no decks, no streak, etc.)
  // Verify that the fixed emission ORDER is upheld even when most types are absent.
  // Expected order: wordOfDay (always) → news items → quick
  it('partial_sources_maintain_fixed_order', () => {
    const items = composeFeed({
      decks: [],
      cardsDue: 0,
      currentStreak: 0,
      longestStreak: 0,
      news: [n1, n2],
      situations: [],
      queueCount: 3,
    });
    expect(items.map((i) => i.type)).toEqual(['wordOfDay', 'news', 'news', 'quick']);
  });

  // Edge: grammar and culture deck categories → correct illo values
  it('illo_assigned_from_deck_category', () => {
    const grammarDeck: Deck = {
      ...makeDeck('grammar-1', { cardsReview: 1, lastStudied: undefined }),
      category: 'grammar',
    };
    const cultureDeck: Deck = {
      ...makeDeck('culture-1', { cardsReview: 1, lastStudied: undefined }),
      category: 'culture',
    };
    const vocabDeck: Deck = {
      ...makeDeck('vocab-1', { cardsReview: 1, lastStudied: undefined }),
      category: 'vocabulary',
    };
    // Use a second vocab deck as the resume (most recently studied),
    // so grammar/culture/vocab all appear as deck items
    const resumeDeckX = makeDeck('resume-x', {
      lastStudied: new Date('2026-06-28'),
      cardsReview: 1,
    });
    const items = composeFeed({
      decks: [resumeDeckX, grammarDeck, cultureDeck, vocabDeck],
      cardsDue: 0,
      currentStreak: 0,
      longestStreak: 0,
      news: [],
      situations: [],
      queueCount: 0,
    });
    const deckItems = items.filter((i) => i.type === 'deck') as Extract<
      FeedItem,
      { type: 'deck' }
    >[];
    const byId = Object.fromEntries(deckItems.map((i) => [i.deck.id, i.illo]));
    expect(byId['grammar-1']).toBe('verbs');
    expect(byId['culture-1']).toBe('culture');
    expect(byId['vocab-1']).toBe('deck');
  });

  // Edge: only 1 of 3 situations emitted (first only)
  it('situations_uses_first_only', () => {
    const s2 = makeSituation('S2');
    const s3 = makeSituation('S3');
    const items = composeFeed({ ...fullSources, situations: [sit1, s2, s3] });
    const sitItems = items.filter((i) => i.type === 'situation');
    expect(sitItems).toHaveLength(1);
    const first = sitItems[0] as Extract<FeedItem, { type: 'situation' }>;
    expect(first.situation.id).toBe('S1');
  });

  // Edge: 4 active (non-resume) decks → tones cycle primary→violet→cyan→green
  it('deck_tones_cycle_over_four_decks', () => {
    const EXPECTED_TONES = ['primary', 'violet', 'cyan', 'green'];
    const resumeDeckR = makeDeck('R', { lastStudied: new Date('2026-06-28'), cardsReview: 1 });
    const d1 = makeDeck('D1', { cardsReview: 1 });
    const d2 = makeDeck('D2', { cardsReview: 1 });
    const d3 = makeDeck('D3', { cardsReview: 1 });
    const d4 = makeDeck('D4', { cardsReview: 1 });
    const items = composeFeed({
      decks: [resumeDeckR, d1, d2, d3, d4],
      cardsDue: 0,
      currentStreak: 0,
      longestStreak: 0,
      news: [],
      situations: [],
      queueCount: 0,
    });
    const deckItems = items.filter((i) => i.type === 'deck') as Extract<
      FeedItem,
      { type: 'deck' }
    >[];
    expect(deckItems).toHaveLength(4);
    deckItems.forEach((item, i) => {
      expect(item.tone).toBe(EXPECTED_TONES[i]);
    });
  });
});

describe('countByFilter — adversarial', () => {
  // Boundary: empty feed → all counts are 0
  it('countByFilter_empty_feed_returns_all_zeros', () => {
    const counts = countByFilter([]);
    expect(counts).toEqual({ all: 0, cards: 0, news: 0, practice: 0 });
  });

  // Edge: feed with ONLY wordOfDay and milestone → all=2, everything else=0
  it('countByFilter_word_and_milestone_only_produces_non_zero_all', () => {
    const onlyUncounted: FeedItem[] = [
      { id: 'word-of-day', type: 'wordOfDay', span: 'compact', tone: 'amber' },
      {
        id: 'milestone',
        type: 'milestone',
        span: 'compact',
        tone: 'amber',
        currentStreak: 5,
        longestStreak: 10,
      },
    ];
    const counts = countByFilter(onlyUncounted);
    expect(counts.all).toBe(2);
    expect(counts.cards).toBe(0);
    expect(counts.news).toBe(0);
    expect(counts.practice).toBe(0);
  });
});

describe('filterFeed — adversarial', () => {
  // Boundary: unknown filter key falls through to returning all items
  // (type safety guard: FeedFilterKey union prevents this at compile time,
  //  but the runtime fallback in filterFeed returns all items, not empty)
  it('unknown_filter_key_returns_all_items_as_fallback', () => {
    // Cast to string to simulate an unexpected runtime value
    const result = filterFeed(ten, 'unknown_key_xyz');
    // The current implementation: unknown key → filter not found → !filter?.types → returns items
    expect(result).toHaveLength(ten.length);
  });

  // Boundary: filter on an empty feed returns empty
  it('filterFeed_empty_input_returns_empty', () => {
    expect(filterFeed([], 'cards')).toHaveLength(0);
    expect(filterFeed([], 'all')).toHaveLength(0);
  });
});
