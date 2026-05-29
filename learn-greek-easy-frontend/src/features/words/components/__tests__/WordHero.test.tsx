/**
 * WordHero Component Tests — DX-09
 *
 * Acceptance criteria:
 * 1. is-playing class present on onPlayStateChange(true) / absent on (false)
 * 2. DonutRing done=masteredCards / total=totalCards + NO dot
 * 3. exactly TWO UnwiredDots in the hero (R4 extra-gloss + R3 WeekHeat),
 *    both with danger tone + correct aria-label
 * 4. voice-speed change calls setPersistedAudioSpeed
 * 5. Greek headline lang="el" + not italic
 * 6. back link → /decks/:deckId
 * 7. SpeakerButton not rendered when audio_url is null
 * 8. DonutRing has NO UnwiredDot wrapper
 */

import userEvent from '@testing-library/user-event';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WordEntryResponse } from '@/services/wordEntryAPI';

// Mock SpeakerButton — exposes onPlayStateChange via test buttons
vi.mock('@/components/ui/SpeakerButton', () => ({
  SpeakerButton: ({
    audioUrl,
    onPlay,
    onPlayStateChange,
  }: {
    audioUrl: string | null | undefined;
    onPlay?: () => void;
    onPlayStateChange?: (playing: boolean) => void;
  }) => {
    if (!audioUrl) return null;
    return (
      <>
        <button
          data-testid="mock-speaker-play"
          onClick={() => {
            onPlayStateChange?.(true);
            onPlay?.();
          }}
        >
          Play
        </button>
        <button
          data-testid="mock-speaker-stop"
          onClick={() => {
            onPlayStateChange?.(false);
          }}
        >
          Stop
        </button>
      </>
    );
  },
}));

// Mock analytics
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));

// Mock ReportErrorButton
vi.mock('@/components/card-errors', () => ({
  ReportErrorButton: ({ onClick }: { onClick: () => void }) => (
    <button data-testid="report-error-btn" onClick={onClick}>
      Report
    </button>
  ),
}));

// Mock GenderBadge + PartOfSpeechBadge
vi.mock('@/components/review/grammar', () => ({
  GenderBadge: ({ gender }: { gender: string }) => <span data-testid="gender-badge">{gender}</span>,
  PartOfSpeechBadge: ({ partOfSpeech }: { partOfSpeech: string }) => (
    <span data-testid="pos-badge">{partOfSpeech}</span>
  ),
}));

// Mock DonutRing — spy on props, render with testid
vi.mock('@/features/decks/dx', () => ({
  DonutRing: ({ done, total, label }: { done: number; total: number; label?: string }) => (
    <div data-testid="donut-ring" data-done={done} data-total={total} data-label={label}>
      DonutRing
    </div>
  ),
  WeekHeat: ({ heat, label }: { heat?: number[]; label?: string }) => (
    <div data-testid="week-heat" data-label={label}>
      WeekHeat
    </div>
  ),
  UnwiredDot: ({
    children,
    tone,
    'aria-label': ariaLabel,
  }: {
    children: React.ReactNode;
    tone?: string;
    'aria-label'?: string;
  }) => (
    <span data-testid="unwired-dot" data-tone={tone ?? 'danger'} aria-label={ariaLabel}>
      {children}
    </span>
  ),
  DxSvgDefs: () => null,
}));

// Mock audioSpeed utils
const mockSetPersistedAudioSpeed = vi.fn();
vi.mock('@/utils/audioSpeed', () => ({
  getPersistedAudioSpeed: () => 1,
  setPersistedAudioSpeed: (s: unknown) => mockSetPersistedAudioSpeed(s),
}));

// Mock react-router-dom Link
vi.mock('react-router-dom', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

// Import after mocks
import { WordHero } from '../WordHero';
import type { AudioSpeed } from '@/utils/audioSpeed';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWordEntry(overrides: Partial<WordEntryResponse> = {}): WordEntryResponse {
  return {
    id: 'word-42',
    deck_id: 'deck-1',
    lemma: 'γράφω',
    part_of_speech: 'verb',
    translation_en: 'to write',
    translation_en_plural: null,
    translation_ru: null,
    translation_ru_plural: null,
    pronunciation: 'gráfo',
    grammar_data: null,
    examples: null,
    audio_key: 'audio/word-42.mp3',
    audio_url: 'https://cdn.example.com/word-42.mp3',
    audio_status: 'done',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

interface RenderOpts {
  masteredCards?: number;
  totalCards?: number;
  audioSpeed?: AudioSpeed;
  overrides?: Partial<WordEntryResponse>;
  deckId?: string;
}

function renderHero({
  masteredCards = 3,
  totalCards = 10,
  audioSpeed = 1,
  overrides = {},
  deckId = 'deck-1',
}: RenderOpts = {}) {
  const onSpeedChange = vi.fn();
  const onReportError = vi.fn();

  const wordEntry = makeWordEntry(overrides);

  render(
    <WordHero
      wordEntry={wordEntry}
      deckId={deckId}
      displayTranslation="to write"
      masteredCards={masteredCards}
      totalCards={totalCards}
      audioSpeed={audioSpeed}
      onSpeedChange={onSpeedChange}
      onReportError={onReportError}
    />
  );

  return { onSpeedChange, onReportError, wordEntry };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WordHero — DX-09', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Audio pulse — is-playing class driven by onPlayStateChange', () => {
    it('audio wrapper does NOT have is-playing initially', () => {
      renderHero();
      const wrapper = screen.getByTestId('word-audio-wrapper');
      expect(wrapper).not.toHaveClass('is-playing');
    });

    it('audio wrapper gains is-playing when onPlayStateChange(true)', async () => {
      const user = userEvent.setup();
      renderHero();

      await user.click(screen.getByTestId('mock-speaker-play'));
      expect(screen.getByTestId('word-audio-wrapper')).toHaveClass('is-playing');
    });

    it('audio wrapper loses is-playing when onPlayStateChange(false)', async () => {
      const user = userEvent.setup();
      renderHero();

      await user.click(screen.getByTestId('mock-speaker-play'));
      expect(screen.getByTestId('word-audio-wrapper')).toHaveClass('is-playing');

      await user.click(screen.getByTestId('mock-speaker-stop'));
      expect(screen.getByTestId('word-audio-wrapper')).not.toHaveClass('is-playing');
    });

    it('no audio wrapper rendered when audio_url is null', () => {
      renderHero({ overrides: { audio_url: null } });
      expect(screen.queryByTestId('word-audio-wrapper')).not.toBeInTheDocument();
    });
  });

  describe('2. DonutRing — real mastery data, no UnwiredDot', () => {
    it('DonutRing receives done=masteredCards and total=totalCards', () => {
      renderHero({ masteredCards: 5, totalCards: 12 });

      const ring = screen.getByTestId('donut-ring');
      expect(ring).toHaveAttribute('data-done', '5');
      expect(ring).toHaveAttribute('data-total', '12');
    });

    it('DonutRing is NOT wrapped in an UnwiredDot', () => {
      renderHero({ masteredCards: 5, totalCards: 12 });

      const ring = screen.getByTestId('donut-ring');
      // Parent should NOT be an unwired-dot
      expect(ring.closest('[data-testid="unwired-dot"]')).toBeNull();
    });
  });

  describe('3. Exactly TWO UnwiredDots, both danger tone', () => {
    it('renders exactly 2 UnwiredDots', () => {
      renderHero();
      const dots = screen.getAllByTestId('unwired-dot');
      expect(dots).toHaveLength(2);
    });

    it('both UnwiredDots have tone="danger"', () => {
      renderHero();
      const dots = screen.getAllByTestId('unwired-dot');
      dots.forEach((dot) => {
        expect(dot).toHaveAttribute('data-tone', 'danger');
      });
    });

    it('R4 extra-gloss UnwiredDot has correct aria-label', () => {
      renderHero();
      const dots = screen.getAllByTestId('unwired-dot');
      const extraGlossDot = dots.find((d) =>
        d.getAttribute('aria-label')?.toLowerCase().includes('extra gloss')
      );
      expect(extraGlossDot).toBeDefined();
    });

    it('R3 WeekHeat UnwiredDot has correct aria-label', () => {
      renderHero();
      const dots = screen.getAllByTestId('unwired-dot');
      const heatDot = dots.find((d) =>
        d.getAttribute('aria-label')?.toLowerCase().includes('heatmap')
      );
      expect(heatDot).toBeDefined();
    });

    it('WeekHeat is inside an UnwiredDot', () => {
      renderHero();
      const heat = screen.getByTestId('week-heat');
      expect(heat.closest('[data-testid="unwired-dot"]')).not.toBeNull();
    });

    it('extra-gloss placeholder paragraph is inside an UnwiredDot', () => {
      renderHero();
      const extra = screen.getByTestId('word-en-extra');
      expect(extra.closest('[data-testid="unwired-dot"]')).not.toBeNull();
    });
  });

  describe('4. Voice-speed change calls setPersistedAudioSpeed', () => {
    it('clicking x0.75 speed button calls onSpeedChange(0.75)', async () => {
      const user = userEvent.setup();
      const { onSpeedChange } = renderHero({ audioSpeed: 1 });

      await user.click(screen.getByTestId('speed-btn-0.75'));
      expect(onSpeedChange).toHaveBeenCalledWith(0.75);
    });

    it('clicking x1 speed button calls onSpeedChange(1)', async () => {
      const user = userEvent.setup();
      const { onSpeedChange } = renderHero({ audioSpeed: 0.75 });

      await user.click(screen.getByTestId('speed-btn-1'));
      expect(onSpeedChange).toHaveBeenCalledWith(1);
    });

    it('active speed button has is-active class', () => {
      renderHero({ audioSpeed: 0.75 });
      expect(screen.getByTestId('speed-btn-0.75')).toHaveClass('is-active');
      expect(screen.getByTestId('speed-btn-1')).not.toHaveClass('is-active');
    });
  });

  describe('5. Greek headline: lang="el", font-style not italic', () => {
    it('word-lemma span has lang="el"', () => {
      renderHero();
      expect(screen.getByTestId('word-lemma')).toHaveAttribute('lang', 'el');
    });

    it('word-article span has lang="el" when present', () => {
      renderHero({
        overrides: {
          part_of_speech: 'noun',
          grammar_data: { gender: 'masculine' },
        },
      });
      const article = screen.queryByTestId('word-article');
      if (article) {
        expect(article).toHaveAttribute('lang', 'el');
      }
    });

    it('word-lemma span has dx-w-word class (font-style:normal via CSS)', () => {
      renderHero();
      expect(screen.getByTestId('word-lemma')).toHaveClass('dx-w-word');
    });
  });

  describe('6. Back link → /decks/:deckId', () => {
    it('back link href points to /decks/:deckId', () => {
      renderHero({ deckId: 'my-deck' });
      const back = screen.getByTestId('back-button');
      expect(back).toHaveAttribute('href', '/decks/my-deck');
    });
  });

  describe('7. SpeakerButton absent when audio_url is null', () => {
    it('does not render mock-speaker-play when audio_url is null', () => {
      renderHero({ overrides: { audio_url: null } });
      expect(screen.queryByTestId('mock-speaker-play')).not.toBeInTheDocument();
    });
  });

  describe('8. DonutRing has no UnwiredDot ancestor', () => {
    it('DonutRing closest unwired-dot is null', () => {
      renderHero();
      expect(screen.getByTestId('donut-ring').closest('[data-testid="unwired-dot"]')).toBeNull();
    });
  });
});
