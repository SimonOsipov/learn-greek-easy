import { describe, it, expect } from 'vitest';
import { computeCultureChips, isTranslationComplete } from '@/lib/cultureCompleteness';
import type { AdminCultureQuestion } from '@/services/adminAPI';

function makeQuestion(overrides: Partial<AdminCultureQuestion> = {}): AdminCultureQuestion {
  return {
    id: 'test-id',
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
  };
}

describe('computeCultureChips', () => {
  it('returns green EL chip when all EL fields present', () => {
    const chips = computeCultureChips(makeQuestion());
    const el = chips.find((c) => c.name === 'lang-el');
    expect(el?.color).toBe('green');
  });

  it('returns yellow EL chip when some EL fields missing', () => {
    const q = makeQuestion({ option_a: { el: '', en: 'A', ru: 'А' } });
    const chips = computeCultureChips(q);
    const el = chips.find((c) => c.name === 'lang-el');
    expect(el?.color).toBe('yellow');
  });

  it('returns gray EL chip when no EL fields present', () => {
    const q = makeQuestion({
      question_text: { el: '', en: 'Q', ru: 'В' },
      option_a: { el: '', en: 'A', ru: 'А' },
      option_b: { el: '', en: 'B', ru: 'Б' },
      option_c: { el: '', en: 'C', ru: 'В' },
      option_d: { el: '', en: 'D', ru: 'Г' },
    });
    const chips = computeCultureChips(q);
    const el = chips.find((c) => c.name === 'lang-el');
    expect(el?.color).toBe('gray');
  });

  it('returns green opts chip for 4 options', () => {
    const chips = computeCultureChips(makeQuestion());
    const opts = chips.find((c) => c.name === 'opts');
    expect(opts?.color).toBe('green');
    expect(opts?.label).toBe('Opts 4');
  });

  it('returns yellow opts chip for 3 options', () => {
    const q = makeQuestion({ option_d: null });
    const chips = computeCultureChips(q);
    const opts = chips.find((c) => c.name === 'opts');
    expect(opts?.color).toBe('yellow');
    expect(opts?.label).toBe('Opts 3');
  });

  it('returns gray opts chip for 2 options', () => {
    const q = makeQuestion({ option_c: null, option_d: null });
    const chips = computeCultureChips(q);
    const opts = chips.find((c) => c.name === 'opts');
    expect(opts?.color).toBe('gray');
    expect(opts?.label).toBe('Opts 2');
  });

  // D2/D7: single unconditional "Audio" pill — ADMIN2-38-02 (RED)
  it('exam question with audio_s3_key → exactly one audio chip, green; no audio-b1/audio-a2', () => {
    const q = makeQuestion({ news_item_id: null, audio_s3_key: 'audio.mp3' });
    const chips = computeCultureChips(q);
    const audioChips = chips.filter((c) => c.name === 'audio');
    expect(audioChips).toHaveLength(1);
    expect(audioChips[0].color).toBe('green');
    expect(audioChips[0].label).toBe('Audio');
    expect(audioChips[0].tooltip).toBe('Audio present');
    expect(chips.find((c) => c.name === 'audio-b1')).toBeUndefined();
    expect(chips.find((c) => c.name === 'audio-a2')).toBeUndefined();
  });

  it('news question with audio_s3_key → exactly one audio chip, green; no audio-b1/audio-a2', () => {
    const q = makeQuestion({
      news_item_id: 'news-123',
      audio_s3_key: 'audio/b1.mp3',
      news_item_audio_a2_s3_key: null,
    });
    const chips = computeCultureChips(q);
    const audioChips = chips.filter((c) => c.name === 'audio');
    expect(audioChips).toHaveLength(1);
    expect(audioChips[0].color).toBe('green');
    expect(chips.find((c) => c.name === 'audio-b1')).toBeUndefined();
    expect(chips.find((c) => c.name === 'audio-a2')).toBeUndefined();
  });

  // C8: both keys set → still only ONE audio chip (news_item_audio_a2_s3_key is ignored)
  it('(C8) news question with both audio_s3_key and news_item_audio_a2_s3_key → still exactly one audio chip; no audio-b1/audio-a2', () => {
    const q = makeQuestion({
      news_item_id: 'news-123',
      audio_s3_key: 'audio/b1.mp3',
      news_item_audio_a2_s3_key: 'audio/a2.mp3',
    });
    const chips = computeCultureChips(q);
    const audioChips = chips.filter((c) => c.name === 'audio');
    expect(audioChips).toHaveLength(1);
    expect(audioChips[0].color).toBe('green');
    expect(chips.find((c) => c.name === 'audio-b1')).toBeUndefined();
    expect(chips.find((c) => c.name === 'audio-a2')).toBeUndefined();
  });

  it('question with audio_s3_key:null → single audio chip, gray, tooltip "Audio missing"', () => {
    const q = makeQuestion({ audio_s3_key: null });
    const chips = computeCultureChips(q);
    const audioChips = chips.filter((c) => c.name === 'audio');
    expect(audioChips).toHaveLength(1);
    expect(audioChips[0].color).toBe('gray');
    expect(audioChips[0].tooltip).toBe('Audio missing');
    expect(chips.find((c) => c.name === 'audio-b1')).toBeUndefined();
    expect(chips.find((c) => c.name === 'audio-a2')).toBeUndefined();
  });

  it('news badge visible when original_article_url set', () => {
    const q = makeQuestion({ original_article_url: 'https://kathimerini.com.cy/article' });
    const chips = computeCultureChips(q);
    const news = chips.find((c) => c.name === 'news');
    expect(news?.visible).toBe(true);
    expect(news?.tooltip).toContain('kathimerini.com.cy');
  });

  it('news badge invisible when original_article_url null', () => {
    const chips = computeCultureChips(makeQuestion({ original_article_url: null }));
    const news = chips.find((c) => c.name === 'news');
    expect(news?.visible).toBe(false);
  });
});

describe('isTranslationComplete', () => {
  it('returns true when all translations present', () => {
    expect(isTranslationComplete(makeQuestion())).toBe(true);
  });

  it('returns false when some translation missing', () => {
    const q = makeQuestion({ option_a: { el: '', en: 'A', ru: 'А' } });
    expect(isTranslationComplete(q)).toBe(false);
  });
});
