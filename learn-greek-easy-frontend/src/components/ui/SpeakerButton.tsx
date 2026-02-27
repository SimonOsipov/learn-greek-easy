import React, { useEffect, useRef } from 'react';

import { Loader2, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import type { AudioSpeed } from '@/hooks/useAudioPlayer';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { cn } from '@/lib/utils';

export interface SpeakerButtonProps {
  audioUrl: string | null | undefined;
  size?: 'default' | 'sm';
  onPlay?: () => void;
  onError?: (error: string) => void;
  className?: string;
  controlledState?: {
    isPlaying: boolean;
    isLoading: boolean;
    error: string | null;
    toggle: () => void;
    speed?: AudioSpeed;
    setSpeed?: (s: AudioSpeed) => void;
  };
}

// ============================================
// SpeedPills Sub-Component (private)
// ============================================

const SPEAKER_SPEED_OPTIONS: AudioSpeed[] = [1, 0.75];

function SpeedPills({
  speed,
  onSpeedChange,
}: {
  speed: AudioSpeed;
  onSpeedChange: (s: AudioSpeed) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Playback speed"
      className="flex gap-1"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {SPEAKER_SPEED_OPTIONS.map((opt) => {
        const isSelected = opt === speed;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`${opt}x speed`}
            data-testid={`speed-pill-${opt}`}
            onClick={(e) => {
              e.stopPropagation();
              onSpeedChange(opt);
            }}
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              isSelected
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            x{opt}
          </button>
        );
      })}
    </div>
  );
}

// ============================================
// SpeakerButton
// ============================================

export function SpeakerButton({
  audioUrl,
  size = 'default',
  onPlay,
  onError,
  className,
  controlledState,
}: SpeakerButtonProps) {
  const { t } = useTranslation('common');
  // Always call the hook (React rules) but pass null URL when controlled
  const internal = useAudioPlayer(controlledState ? null : audioUrl);
  // Use controlled values if provided, otherwise use internal hook values
  const { isPlaying, isLoading, error, toggle } = controlledState ?? internal;

  const speed = controlledState?.speed ?? internal.speed;
  const setSpeed = controlledState?.setSpeed ?? internal.setSpeed;

  // Callback refs pattern to avoid stale closures
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Fire onPlay only on false→true transition
  const prevPlayingRef = useRef(false);
  useEffect(() => {
    if (isPlaying && !prevPlayingRef.current) {
      onPlayRef.current?.();
    }
    prevPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Fire onError when error appears
  useEffect(() => {
    if (error) {
      onErrorRef.current?.(error);
    }
  }, [error]);

  if (!audioUrl) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggle();
  };

  const ariaLabel = isLoading ? t('audio.loading') : isPlaying ? t('audio.pause') : t('audio.play');

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <Button
        variant="ghost"
        size={size === 'sm' ? 'sm' : 'icon'}
        onClick={handleClick}
        aria-label={ariaLabel}
        className={className}
      >
        {isLoading ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Volume2
            className={cn(isPlaying ? 'animate-pulse text-primary' : 'text-muted-foreground')}
          />
        )}
      </Button>
      <SpeedPills speed={speed} onSpeedChange={setSpeed} />
    </div>
  );
}
