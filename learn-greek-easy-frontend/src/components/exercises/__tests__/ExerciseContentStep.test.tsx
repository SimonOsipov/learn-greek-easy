// src/components/exercises/__tests__/ExerciseContentStep.test.tsx

import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ExerciseContentStep } from '@/components/exercises/ExerciseContentStep';
import { renderWithProviders } from '@/lib/test-utils';
import type { WordTimestamp } from '@/types/situation';

// Mock WaveformPlayer since it requires audio context
vi.mock('@/components/culture/WaveformPlayer', () => ({
  WaveformPlayer: ({ audioUrl, onPlay }: { audioUrl: string; onPlay?: (d: number) => void }) => (
    <div data-testid="waveform-player" data-audio-url={audioUrl}>
      <button data-testid="waveform-play-button" onClick={() => onPlay?.(30)}>
        Play
      </button>
      <audio data-testid="waveform-audio-element" />
    </div>
  ),
}));

// Mock KaraokeText
vi.mock('@/components/shared/KaraokeText', () => ({
  KaraokeText: ({ fallbackText }: { fallbackText: string }) => (
    <div data-testid="karaoke-text">{fallbackText}</div>
  ),
}));

// Mock useAudioTimeMs
vi.mock('@/hooks/useAudioTimeMs', () => ({
  useAudioTimeMs: () => 0,
}));

// ============================================
// Fixtures
// ============================================

const SAMPLE_TIMESTAMPS: WordTimestamp[] = [
  { word: 'Ο', start_ms: 0, end_ms: 200 },
  { word: 'Γιάννης', start_ms: 200, end_ms: 600 },
];

const defaultProps = {
  modality: null as 'listening' | 'reading' | null,
  audioLevel: null as string | null,
  descriptionTextEl: null as string | null,
  descriptionAudioUrl: null as string | null,
  descriptionAudioDuration: null as number | null,
  wordTimestamps: null as WordTimestamp[] | null,
  onAudioPlay: vi.fn(),
};

function renderComponent(overrides: Partial<typeof defaultProps> = {}) {
  return renderWithProviders(<ExerciseContentStep {...defaultProps} {...overrides} />);
}

// ============================================
// Tests
// ============================================

describe('ExerciseContentStep', () => {
  // ============================================
  // Badge tests
  // ============================================

  it('renders reading modality badge', () => {
    renderComponent({ modality: 'reading', descriptionTextEl: 'Ο Γιάννης πάει στην αγορά.' });
    expect(screen.getByText('Reading')).toBeInTheDocument();
  });

  it('renders listening modality badge', () => {
    renderComponent({
      modality: 'listening',
      descriptionAudioUrl: 'https://example.com/audio.mp3',
    });
    expect(screen.getByText('Listening')).toBeInTheDocument();
  });

  it('renders level badge when audioLevel provided', () => {
    renderComponent({
      modality: 'listening',
      audioLevel: 'B1',
      descriptionAudioUrl: 'https://example.com/audio.mp3',
    });
    expect(screen.getByText('B1')).toBeInTheDocument();
  });

  it('renders both modality and level badges', () => {
    renderComponent({
      modality: 'listening',
      audioLevel: 'A2',
      descriptionAudioUrl: 'https://example.com/audio.mp3',
    });
    expect(screen.getByText('Listening')).toBeInTheDocument();
    expect(screen.getByText('A2')).toBeInTheDocument();
  });

  it('does not render badge row when both modality and audioLevel are null', () => {
    // modality=null & audioLevel=null → hasBadges is false → component returns null entirely
    renderComponent({ modality: null, audioLevel: null });
    expect(screen.queryByTestId('exercise-content-step')).not.toBeInTheDocument();
    expect(screen.queryByTestId('exercise-metadata-badges')).not.toBeInTheDocument();
  });

  // ============================================
  // Reading content tests
  // ============================================

  it('renders Greek text block for reading exercise', () => {
    renderComponent({
      modality: 'reading',
      descriptionTextEl: 'Ο Γιάννης πάει στην αγορά.',
    });
    const passage = screen.getByTestId('exercise-reading-passage');
    expect(passage).toBeInTheDocument();
    expect(passage).toHaveTextContent('Ο Γιάννης πάει στην αγορά.');
  });

  it('does not render text block when descriptionTextEl is null', () => {
    renderComponent({ modality: 'reading', descriptionTextEl: null });
    // With no text, no audio, and no level badge, component returns null
    expect(screen.queryByTestId('exercise-reading-passage')).not.toBeInTheDocument();
  });

  it('does not render text block when descriptionTextEl is empty/whitespace', () => {
    renderComponent({ modality: 'reading', descriptionTextEl: '  ' });
    expect(screen.queryByTestId('exercise-reading-passage')).not.toBeInTheDocument();
  });

  // ============================================
  // Listening content tests
  // ============================================

  it('renders WaveformPlayer for listening exercise', () => {
    renderComponent({
      modality: 'listening',
      descriptionAudioUrl: 'https://example.com/audio.mp3',
      descriptionAudioDuration: 30,
    });
    expect(screen.getByTestId('exercise-listening-audio')).toBeInTheDocument();
    expect(screen.getByTestId('waveform-player')).toBeInTheDocument();
  });

  it('does not render audio player when descriptionAudioUrl is null', () => {
    renderComponent({ modality: 'listening', descriptionAudioUrl: null });
    expect(screen.queryByTestId('exercise-listening-audio')).not.toBeInTheDocument();
    expect(screen.queryByTestId('waveform-player')).not.toBeInTheDocument();
  });

  // ============================================
  // Graceful degradation
  // ============================================

  it('returns null when all fields are null', () => {
    renderComponent();
    expect(screen.queryByTestId('exercise-content-step')).not.toBeInTheDocument();
  });

  // ============================================
  // Karaoke text
  // ============================================

  it('renders KaraokeText when listening with timestamps', () => {
    renderComponent({
      modality: 'listening',
      descriptionAudioUrl: 'https://example.com/audio.mp3',
      descriptionTextEl: 'Ο Γιάννης',
      wordTimestamps: SAMPLE_TIMESTAMPS,
    });
    expect(screen.getByTestId('karaoke-text')).toBeInTheDocument();
  });
});
