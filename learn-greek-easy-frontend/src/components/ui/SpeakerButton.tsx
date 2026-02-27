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
  speed?: AudioSpeed;
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
// SpeakerButton
// ============================================

export function SpeakerButton({
  audioUrl,
  size = 'default',
  onPlay,
  onError,
  className,
  speed,
  controlledState,
}: SpeakerButtonProps) {
  const { t } = useTranslation('common');
  // Always call the hook (React rules) but pass null URL when controlled
  const internal = useAudioPlayer(controlledState ? null : audioUrl, speed);
  // Use controlled values if provided, otherwise use internal hook values
  const { isPlaying, isLoading, error, toggle } = controlledState ?? internal;

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
  );
}
