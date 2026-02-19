/**
 * CardHeader Audio Integration Tests
 *
 * Tests SpeakerButton wiring in CardHeader: visibility, stopPropagation,
 * and analytics callback correctness.
 */

import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { trackWordAudioFailed, trackWordAudioPlayed } from '@/lib/analytics';
import { render, screen } from '@/lib/test-utils';
import type { CardReview } from '@/types/review';

import { CardHeader } from '../CardHeader';

// Mock SpeakerButton — captures onPlay/onError callbacks and exposes them via test buttons
vi.mock('@/components/ui/SpeakerButton', () => ({
  SpeakerButton: ({
    audioUrl,
    onPlay,
    onError,
  }: {
    audioUrl: string | null | undefined;
    onPlay?: () => void;
    onError?: (error: string) => void;
  }) => {
    if (!audioUrl) return null;
    return (
      <>
        <button
          data-testid="speaker-button"
          onClick={(e) => {
            e.stopPropagation();
            onPlay?.();
          }}
        >
          Speaker
        </button>
        <button data-testid="speaker-error-trigger" onClick={() => onError?.('play error')}>
          Trigger Error
        </button>
      </>
    );
  },
}));

// Mock analytics module — use importOriginal to preserve other exports used by providers
vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>();
  return {
    ...actual,
    trackWordAudioPlayed: vi.fn(),
    trackWordAudioFailed: vi.fn(),
  };
});

// Minimal CardReview fixture
function makeCard(overrides: Partial<CardReview> = {}): CardReview {
  return {
    id: 'card-123',
    front: 'γράφω',
    back: 'to write',
    word: 'γράφω',
    part_of_speech: 'verb',
    audio_url: 'https://example.com/audio.mp3',
    word_entry_id: 'we-123',
    isEarlyPractice: false,
    timesReviewed: 0,
    successRate: 0,
    difficulty: 'new',
    srData: {
      cardId: 'card-123',
      deckId: 'deck-456',
      interval: 0,
      easeFactor: 2.5,
      repetitions: 0,
      state: 'new',
      step: 0,
      dueDate: null,
      lastReviewed: null,
      reviewCount: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0,
    },
    ...overrides,
  } as CardReview;
}

describe('CardHeader — SpeakerButton audio integration', () => {
  const onFlip = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. renders SpeakerButton when audio_url is set', () => {
    render(<CardHeader card={makeCard()} onFlip={onFlip} isCardFlipped={false} />);
    expect(screen.getByTestId('speaker-button')).toBeInTheDocument();
  });

  it('2. does NOT render SpeakerButton when audio_url is null', () => {
    render(
      <CardHeader card={makeCard({ audio_url: null })} onFlip={onFlip} isCardFlipped={false} />
    );
    expect(screen.queryByTestId('speaker-button')).not.toBeInTheDocument();
  });

  it('3. SpeakerButton click does NOT call onFlip', async () => {
    const user = userEvent.setup();
    render(<CardHeader card={makeCard()} onFlip={onFlip} isCardFlipped={false} />);

    await user.click(screen.getByTestId('speaker-button'));

    expect(onFlip).not.toHaveBeenCalled();
  });

  it('4. trackWordAudioPlayed called with correct properties on play', async () => {
    const user = userEvent.setup();
    const card = makeCard();
    render(<CardHeader card={card} onFlip={onFlip} isCardFlipped={false} />);

    await user.click(screen.getByTestId('speaker-button'));

    expect(trackWordAudioPlayed).toHaveBeenCalledWith({
      word_entry_id: 'we-123',
      lemma: 'γράφω',
      part_of_speech: 'verb',
      context: 'review',
      deck_id: 'deck-456',
    });
  });

  it('5. trackWordAudioFailed called with correct properties on error', async () => {
    const user = userEvent.setup();
    render(<CardHeader card={makeCard()} onFlip={onFlip} isCardFlipped={false} />);

    await user.click(screen.getByTestId('speaker-error-trigger'));

    expect(trackWordAudioFailed).toHaveBeenCalledWith({
      word_entry_id: 'we-123',
      error: 'play error',
      audio_type: 'word',
      context: 'review',
    });
  });
});
