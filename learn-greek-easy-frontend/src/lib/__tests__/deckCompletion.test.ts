/**
 * Unit tests for deckCompletion.ts (DKDR-01)
 *
 * Covers the 9 cases from the implementation plan:
 *   Word:    (1) all complete, (2) partial EN, (3) grammar hidden,
 *            (4) audio generating, (5) stable order
 *   Culture: (6) exam question, (7) news question, (8) done from green color,
 *            (9) news badge visible
 */
import { describe, it, expect } from 'vitest';
import { getWordCompletion, getCultureCompletion } from '@/lib/deckCompletion';
import type { AdminVocabularyCard, AdminCultureQuestion } from '@/services/adminAPI';

// ============================================================
// Fixtures
// ============================================================

const makeCard = (overrides: Partial<AdminVocabularyCard> = {}): AdminVocabularyCard => ({
  id: 'card-1',
  deck_id: 'deck-v2',
  front_text: 'μητέρα',
  back_text_en: 'mother',
  back_text_ru: 'мать',
  example_sentence: null,
  pronunciation: '/mi*te*ra/',
  part_of_speech: 'noun',
  level: 'A1',
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  gender: 'feminine',
  has_examples: true,
  has_audio: true,
  has_grammar: true,
  translation_en_plural: 'mothers',
  translation_ru_plural: 'матери',
  audio_status: 'ready',
  grammar_filled: 9,
  grammar_total: 9,
  example_count: 2,
  examples_with_en: 2,
  examples_with_ru: 2,
  examples_with_audio: 2,
  ...overrides,
});

const makeQuestion = (overrides: Partial<AdminCultureQuestion> = {}): AdminCultureQuestion => ({
  id: 'q-1',
  question_text: { el: 'Ερώτηση', en: 'Question', ru: 'Вопрос' },
  option_a: { el: 'Α', en: 'A', ru: 'А' },
  option_b: { el: 'Β', en: 'B', ru: 'Б' },
  option_c: { el: 'Γ', en: 'C', ru: 'В' },
  option_d: { el: 'Δ', en: 'D', ru: 'Г' },
  correct_option: 1,
  source_article_url: null,
  is_pending_review: false,
  audio_s3_key: null,
  news_item_id: null,
  original_article_url: null,
  order_index: 0,
  news_item_audio_a2_s3_key: null,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

// ============================================================
// getWordCompletion
// ============================================================

describe('getWordCompletion', () => {
  // Test 1 — All complete
  it('(1) all complete: 6 pills, all done:true and visible:true', () => {
    const pills = getWordCompletion(makeCard());
    expect(pills).toHaveLength(6);
    const allDone = pills.every((p) => p.done);
    expect(allDone).toBe(true);
    // gram is visible because grammar_total > 0 (9)
    const allVisible = pills.every((p) => p.visible);
    expect(allVisible).toBe(true);
  });

  // Test 2 — Partial EN
  it('(2) partial EN: en pill has label "EN 1/2", done:false, value:0.5', () => {
    const pills = getWordCompletion(
      makeCard({ back_text_en: 'mother', translation_en_plural: null })
    );
    const en = pills.find((p) => p.name === 'en');
    expect(en).toBeDefined();
    expect(en!.label).toBe('EN 1/2');
    expect(en!.done).toBe(false);
    expect(en!.value).toBe(0.5);
  });

  // Test 3 — Grammar hidden
  it('(3) grammar hidden: gram pill present with visible:false when grammar_total===0', () => {
    const pills = getWordCompletion(makeCard({ grammar_total: 0, grammar_filled: 0 }));
    const gram = pills.find((p) => p.name === 'gram');
    expect(gram).toBeDefined();
    expect(gram!.visible).toBe(false);
  });

  // Test 4 — Audio generating
  it('(4) audio generating: audio pill has done:false despite value:0.5', () => {
    const pills = getWordCompletion(makeCard({ audio_status: 'generating' }));
    const audio = pills.find((p) => p.name === 'audio');
    expect(audio).toBeDefined();
    expect(audio!.label).toBe('Audio …');
    expect(audio!.done).toBe(false);
    // ratio from upstream is 0.5
    expect(audio!.value).toBe(0.5);
  });

  // Test 5 — Stable order
  it('(5) order is always [en, ru, pron, audio, gram, ex]', () => {
    const pills = getWordCompletion(makeCard());
    const names = pills.map((p) => p.name);
    expect(names).toEqual(['en', 'ru', 'pron', 'audio', 'gram', 'ex']);
  });
});

// ============================================================
// getCultureCompletion
// ============================================================

describe('getCultureCompletion', () => {
  // Test 6 — Exam question: no audio-a2
  it('(6) exam question: no visible audio-a2 chip; single "audio" chip present', () => {
    const pills = getCultureCompletion(makeQuestion({ news_item_id: null }));
    const audioA2 = pills.find((p) => p.name === 'audio-a2');
    // audio-a2 must not exist OR must be invisible if defensively included
    if (audioA2) {
      expect(audioA2.visible).toBe(false);
    }
    const audio = pills.find((p) => p.name === 'audio');
    expect(audio).toBeDefined();
    expect(audio!.label).toBe('Audio');
  });

  // Test 7 — News question: audio-b2 + audio-a2 both visible
  it('(7) news question: audio-b2 "B2 Audio" and audio-a2 (visible:true) present', () => {
    const pills = getCultureCompletion(
      makeQuestion({
        news_item_id: '42',
        audio_s3_key: 'b2.mp3',
        news_item_audio_a2_s3_key: 'a2.mp3',
      })
    );
    const b2 = pills.find((p) => p.name === 'audio-b2');
    expect(b2).toBeDefined();
    expect(b2!.label).toBe('B2 Audio');

    const a2 = pills.find((p) => p.name === 'audio-a2');
    expect(a2).toBeDefined();
    expect(a2!.visible).toBe(true);
  });

  // Test 8 — done derived from green color (no N/M ratio in label)
  it('(8) done:true when chip has no N/M ratio but color is green (e.g. audio-b2 with s3 key)', () => {
    const pills = getCultureCompletion(
      makeQuestion({
        news_item_id: '99',
        audio_s3_key: 'exists.mp3',
      })
    );
    const b2 = pills.find((p) => p.name === 'audio-b2');
    expect(b2).toBeDefined();
    // upstream sets color:'green' when audio_s3_key is truthy
    expect(b2!.done).toBe(true);
  });

  // Test 9 — News badge visible when original_article_url is set
  it('(9) news badge: visible:true when original_article_url is set', () => {
    const pills = getCultureCompletion(
      makeQuestion({
        original_article_url: 'https://ekathimerini.com/article/1',
        news_item_id: null,
      })
    );
    const news = pills.find((p) => p.name === 'news');
    expect(news).toBeDefined();
    expect(news!.visible).toBe(true);
  });
});
