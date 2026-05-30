// src/features/practice/pf/AudioChip.tsx
//
// Thin wrapper around SpeakerButton + AudioSpeedToggle.
// Accepts the lifted audioState shape already plumbed in
// V2FlashcardPracticePage / PracticeCard.tsx:48-57.
// Click propagation is stopped here so the chip never triggers card flip.

import { AudioSpeedToggle } from '@/components/ui/AudioSpeedToggle';
import { SpeakerButton } from '@/components/ui/SpeakerButton';
import type { AudioSpeed } from '@/hooks/useAudioPlayer';

export interface AudioChipState {
  audioUrl: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  onToggle: () => void;
  speed?: AudioSpeed;
  setSpeed?: (s: AudioSpeed) => void;
}

export interface AudioChipProps {
  audioState: AudioChipState;
  className?: string;
}

/**
 * AudioChip — composes SpeakerButton + AudioSpeedToggle.
 *
 * Propagation is stopped at the wrapper level so clicking the chip
 * never triggers parent card-flip handlers (mirrors live PracticeCard:556-560).
 */
export function AudioChip({ audioState, className }: AudioChipProps) {
  const { audioUrl, isPlaying, isLoading, error, onToggle, speed = 1, setSpeed } = audioState;

  if (!audioUrl) return null;

  const controlledState = {
    isPlaying,
    isLoading,
    error,
    toggle: onToggle,
    speed,
    setSpeed,
  };

  return (
    <div
      className={`pf-audio-chip${className ? ` ${className}` : ''}`}
      data-testid="pf-audio-chip"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <AudioSpeedToggle speed={speed} onSpeedChange={setSpeed ?? (() => {})} />
      <SpeakerButton audioUrl={audioUrl} size="sm" controlledState={controlledState} />
    </div>
  );
}
