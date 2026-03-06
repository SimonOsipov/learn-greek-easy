import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CultureQuestionChips } from '@/components/admin/culture/CultureQuestionChips';
import type { AdminCultureQuestion } from '@/services/adminAPI';

function makeQuestion(overrides: Partial<AdminCultureQuestion> = {}): AdminCultureQuestion {
  return {
    id: 'q-1',
    question_text: { el: 'Ε', en: 'Q', ru: 'В' },
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

function renderChips(question: AdminCultureQuestion) {
  return render(
    <TooltipProvider>
      <CultureQuestionChips question={question} />
    </TooltipProvider>
  );
}

describe('CultureQuestionChips', () => {
  it('renders chip container with correct test id', () => {
    renderChips(makeQuestion());
    expect(screen.getByTestId('culture-chips-q-1')).toBeInTheDocument();
  });

  it('renders 5 chips for exam question with no news/audio (EL, EN, RU, Opts, Audio)', () => {
    renderChips(makeQuestion());
    // EL, EN, RU, opts, audio = 5 chips (news invisible)
    expect(screen.getByTestId('culture-chip-lang-el-q-1')).toBeInTheDocument();
    expect(screen.getByTestId('culture-chip-lang-en-q-1')).toBeInTheDocument();
    expect(screen.getByTestId('culture-chip-lang-ru-q-1')).toBeInTheDocument();
    expect(screen.getByTestId('culture-chip-opts-q-1')).toBeInTheDocument();
    expect(screen.getByTestId('culture-chip-audio-q-1')).toBeInTheDocument();
  });

  it('renders B2 and A2 audio chips for news question', () => {
    const q = makeQuestion({
      news_item_id: 'news-1',
      audio_s3_key: 'b2.mp3',
      news_item_audio_a2_s3_key: 'a2.mp3',
    });
    renderChips(q);
    expect(screen.getByTestId('culture-chip-audio-b2-q-1')).toBeInTheDocument();
    expect(screen.getByTestId('culture-chip-audio-a2-q-1')).toBeInTheDocument();
    expect(screen.queryByTestId('culture-chip-audio-q-1')).not.toBeInTheDocument();
  });
});
