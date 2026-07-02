// src/components/dashboard/lib/__tests__/summaryFeed.test.ts
//
// PERF-15-06 QA (Mode B adversarial) — mapSummaryFeed is a pure 1:1 projector
// from the server-ordered/gated summary.feed onto the client FeedItem[] that
// Feed/FeedCards render. Ordering and presence-gating are entirely
// server-owned (dashboard_compose.py's compose_feed, unit-tested in
// test_compose_feed.py) — these tests pin that mapSummaryFeed does NOT
// re-order/re-gate, that it reproduces the deleted composeFeed.ts's
// span/tone/illo assignment byte-for-byte, and that the deck_id/
// sibling_deck_ids/due_deck_ids resolution + defensive unresolved-deck skip
// behave correctly.

import { describe, it, expect } from 'vitest';

import type { DashboardDeckSlice, DashboardFeedItem } from '@/types/dashboard';

import { countByFilter, filterFeed } from '../feedItem';
import { mapSummaryFeed } from '../summaryFeed';

function makeDeckSlice(overrides: Partial<DashboardDeckSlice> = {}): DashboardDeckSlice {
  return {
    deck_id: 'deck-1',
    name_el: 'Ελληνικά',
    name_en: 'Greek Basics',
    name_ru: 'Греческий',
    level: 'A2',
    is_premium: false,
    category: 'vocabulary',
    card_count: 20,
    cover_image_url: null,
    cover_image_variants: null,
    status: 'in-progress',
    cards_total: 20,
    cards_new: 5,
    cards_learning: 8,
    cards_review: 5,
    cards_mastered: 7,
    due_today: 5,
    completion_pct: 75,
    mastery_pct: 35,
    last_studied_at: null,
    ...overrides,
  };
}

describe('mapSummaryFeed', () => {
  // A full 8-type server feed with 2 deck items — mirrors compose_feed's
  // fixed emission order (resume -> review -> situation -> word_of_day ->
  // deck -> deck -> milestone -> news -> quick).
  const decks: DashboardDeckSlice[] = [
    makeDeckSlice({ deck_id: 'resume-deck', category: 'vocabulary' }),
    makeDeckSlice({ deck_id: 'sib-1', category: 'grammar' }),
    makeDeckSlice({ deck_id: 'sib-2', category: 'culture' }),
    makeDeckSlice({ deck_id: 'deck-a', category: 'grammar' }), // -> illo 'verbs', tone[0]
    makeDeckSlice({ deck_id: 'deck-b', category: 'culture' }), // -> illo 'culture', tone[1]
    makeDeckSlice({ deck_id: 'due-1', category: 'vocabulary' }),
  ];

  const feed: DashboardFeedItem[] = [
    {
      type: 'resume',
      id: 'resume-resume-deck',
      deck_id: 'resume-deck',
      sibling_deck_ids: ['sib-1', 'sib-2'],
    },
    { type: 'review', id: 'review', cards_due: 5, due_deck_ids: ['due-1'] },
    {
      type: 'situation',
      id: 'situation-sit-1',
      situation: {
        id: 'sit-1',
        scenario_el: 'Στο εστιατόριο',
        scenario_en: 'At the restaurant',
        scenario_ru: 'В ресторане',
        status: 'active',
        has_audio: true,
        has_dialog: true,
        exercise_total: 5,
        exercise_completed: 2,
        source_image_url: null,
        domain: 'dining',
        description_source_type: null,
      },
    },
    { type: 'word_of_day', id: 'word-of-day' },
    { type: 'deck', id: 'deck-deck-a', deck_id: 'deck-a' },
    { type: 'deck', id: 'deck-deck-b', deck_id: 'deck-b' },
    { type: 'milestone', id: 'milestone', current_streak: 4, longest_streak: 9 },
    {
      type: 'news',
      id: 'news-n1',
      news: {
        id: 'n1',
        situation_id: 'sit-news',
        title_el: 'Τίτλος',
        title_en: 'Title',
        title_ru: 'Заголовок',
        publication_date: '2026-07-01',
        country: 'greece',
        audio_duration_seconds: 90,
        image_url: 'https://cdn.example.com/n1.jpg',
        image_variants: null,
        original_article_url: 'https://example.com/article',
      },
    },
    { type: 'quick', id: 'quick', queue_count: 3 },
  ];

  it('maps every type in server order with exact span/tone (byte-parity with the deleted composeFeed.ts)', () => {
    const items = mapSummaryFeed(feed, decks);

    expect(items.map((i) => i.type)).toEqual([
      'resume',
      'review',
      'situation',
      'wordOfDay',
      'deck',
      'deck',
      'milestone',
      'news',
      'quick',
    ]);

    expect(items[0]).toMatchObject({ type: 'resume', span: 'hero', tone: 'primary' });
    expect(items[1]).toMatchObject({ type: 'review', span: 'side', tone: 'blue' });
    expect(items[2]).toMatchObject({ type: 'situation', span: 'compact', tone: 'cyan' });
    expect(items[3]).toMatchObject({ type: 'wordOfDay', span: 'compact', tone: 'amber' });
    expect(items[4]).toMatchObject({ type: 'deck', span: 'side' });
    expect(items[5]).toMatchObject({ type: 'deck', span: 'side' });
    expect(items[6]).toMatchObject({ type: 'milestone', span: 'compact', tone: 'amber' });
    expect(items[7]).toMatchObject({ type: 'news', span: 'compact', tone: 'blue' });
    expect(items[8]).toMatchObject({ type: 'quick', span: 'compact', tone: 'green' });
  });

  it('cycles deck tones by DECK-ITEM index (DECK_TONES[0]=primary, [1]=violet), not overall feed index', () => {
    const items = mapSummaryFeed(feed, decks);
    const deckItems = items.filter((i) => i.type === 'deck');

    expect(deckItems).toHaveLength(2);
    // First deck item is feed index 4 (overall), but tone index 0 -> 'primary'.
    expect(deckItems[0]).toMatchObject({ tone: 'primary', illo: 'verbs' }); // deck-a, category 'grammar'
    // Second deck item is feed index 5 (overall), but tone index 1 -> 'violet'.
    expect(deckItems[1]).toMatchObject({ tone: 'violet', illo: 'culture' }); // deck-b, category 'culture'
  });

  it('resolves resume siblings (<=2) from sibling_deck_ids against decks', () => {
    const items = mapSummaryFeed(feed, decks);
    const resume = items[0];
    if (resume.type !== 'resume') throw new Error('expected resume item');

    expect(resume.deck.id).toBe('resume-deck');
    expect(resume.siblings.map((d) => d.id)).toEqual(['sib-1', 'sib-2']);
  });

  it('resolves review dueDecks from due_deck_ids against decks', () => {
    const items = mapSummaryFeed(feed, decks);
    const review = items[1];
    if (review.type !== 'review') throw new Error('expected review item');

    expect(review.cardsDue).toBe(5);
    expect(review.dueDecks.map((d) => d.id)).toEqual(['due-1']);
  });

  it('maps word_of_day (snake_case) onto wordOfDay (camelCase)', () => {
    const items = mapSummaryFeed(feed, decks);
    expect(items[3].type).toBe('wordOfDay');
  });

  it('carries original_article_url through onto the news item', () => {
    const items = mapSummaryFeed(feed, decks);
    const news = items[7];
    if (news.type !== 'news') throw new Error('expected news item');
    expect(news.news.original_article_url).toBe('https://example.com/article');
  });

  it('maps situation fields verbatim (no re-shaping)', () => {
    const items = mapSummaryFeed(feed, decks);
    const situation = items[2];
    if (situation.type !== 'situation') throw new Error('expected situation item');
    expect(situation.situation).toMatchObject({
      id: 'sit-1',
      scenario_en: 'At the restaurant',
      domain: 'dining',
      exercise_total: 5,
      exercise_completed: 2,
    });
  });

  it('maps milestone and quick fields verbatim', () => {
    const items = mapSummaryFeed(feed, decks);
    const milestone = items[6];
    const quick = items[8];
    if (milestone.type !== 'milestone' || quick.type !== 'quick') {
      throw new Error('expected milestone + quick items');
    }
    expect(milestone).toMatchObject({ currentStreak: 4, longestStreak: 9 });
    expect(quick).toMatchObject({ queueCount: 3 });
  });

  it('does NOT re-order: preserves the server feed array order 1:1 regardless of decks order', () => {
    const shuffledDecks = [...decks].reverse();
    const items = mapSummaryFeed(feed, shuffledDecks);
    expect(items.map((i) => i.type)).toEqual([
      'resume',
      'review',
      'situation',
      'wordOfDay',
      'deck',
      'deck',
      'milestone',
      'news',
      'quick',
    ]);
  });

  // ── Defensive unresolved deck_id handling ──────────────────────────────────

  it('skips a resume item whose deck_id is not in decks (no crash)', () => {
    const badFeed: DashboardFeedItem[] = [
      { type: 'resume', id: 'resume-ghost', deck_id: 'ghost', sibling_deck_ids: [] },
      { type: 'word_of_day', id: 'word-of-day' },
    ];
    const items = mapSummaryFeed(badFeed, decks);
    expect(items.map((i) => i.type)).toEqual(['wordOfDay']);
  });

  it('skips a deck item whose deck_id is not in decks (no crash)', () => {
    const badFeed: DashboardFeedItem[] = [
      { type: 'deck', id: 'deck-ghost', deck_id: 'ghost' },
      { type: 'word_of_day', id: 'word-of-day' },
    ];
    const items = mapSummaryFeed(badFeed, decks);
    expect(items.map((i) => i.type)).toEqual(['wordOfDay']);
  });

  it('drops unresolved sibling/due deck_ids instead of crashing, keeping the resume/review item itself', () => {
    const badFeed: DashboardFeedItem[] = [
      {
        type: 'resume',
        id: 'resume-resume-deck',
        deck_id: 'resume-deck',
        sibling_deck_ids: ['sib-1', 'ghost-sibling'],
      },
      { type: 'review', id: 'review', cards_due: 5, due_deck_ids: ['ghost-due', 'due-1'] },
    ];
    const items = mapSummaryFeed(badFeed, decks);
    const resume = items[0];
    const review = items[1];
    if (resume.type !== 'resume' || review.type !== 'review') {
      throw new Error('expected resume + review items');
    }
    expect(resume.siblings.map((d) => d.id)).toEqual(['sib-1']);
    expect(review.dueDecks.map((d) => d.id)).toEqual(['due-1']);
  });

  it('returns an empty array for an empty feed', () => {
    expect(mapSummaryFeed([], decks)).toEqual([]);
  });

  // ── Filter parity over the mapped items ────────────────────────────────────

  describe('filter parity (countByFilter / filterFeed over mapped items)', () => {
    const items = mapSummaryFeed(feed, decks);

    it('countByFilter: all=9, cards=4 (resume+review+2 deck), news=1, practice=2 (situation+quick)', () => {
      expect(countByFilter(items)).toEqual({ all: 9, cards: 4, news: 1, practice: 2 });
    });

    it('filterFeed("cards") returns exactly resume/review/deck items', () => {
      const cards = filterFeed(items, 'cards');
      expect(cards.map((i) => i.type)).toEqual(['resume', 'review', 'deck', 'deck']);
    });

    it('filterFeed("news") returns exactly the news item', () => {
      const news = filterFeed(items, 'news');
      expect(news.map((i) => i.type)).toEqual(['news']);
    });

    it('filterFeed("practice") returns exactly situation/quick items', () => {
      const practice = filterFeed(items, 'practice');
      expect(practice.map((i) => i.type)).toEqual(['situation', 'quick']);
    });

    it('filterFeed("all") returns every item unchanged, including wordOfDay/milestone', () => {
      expect(filterFeed(items, 'all')).toEqual(items);
    });
  });
});
