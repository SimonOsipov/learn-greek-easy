import { type FC, useCallback, useEffect, useRef, useState } from 'react';

import { Pause, Play } from 'lucide-react';

import { cn } from '@/lib/utils';
import { generateBars } from '@/lib/waveform';

const BAR_COUNT = 48;
const DEFAULT_DURATION = 90;
const TICK_INTERVAL_MS = 100;
const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5] as const;
type Speed = (typeof SPEED_OPTIONS)[number];

function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds || 0);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface WaveformPlayerProps {
  /** Total audio duration in seconds. Default: 90. Used only in timer mode. */
  duration?: number;
  /** URL of the audio file. When provided, enables real audio playback mode. */
  audioUrl?: string;
  /** Additional CSS classes applied to the outer container. */
  className?: string;
  /** Whether to show the playback speed control pills. Default: true. */
  showSpeedControl?: boolean;
  /** Visual style variant. 'culture' uses culture-page tokens, 'admin' uses shadcn tokens. Default: 'culture'. */
  variant?: 'culture' | 'admin';
  /** When true, the player is visually greyed out and all interactions are no-ops. Default: false. */
  disabled?: boolean;
  /** Callback fired when audio fails to load. */
  onError?: () => void;
}

export const WaveformPlayer: FC<WaveformPlayerProps> = ({
  duration = DEFAULT_DURATION,
  audioUrl,
  className,
  showSpeedControl = true,
  variant = 'culture',
  disabled = false,
  onError,
}) => {
  const barsRef = useRef<number[] | null>(null);
  if (barsRef.current === null) {
    barsRef.current = generateBars(BAR_COUNT);
  }
  const bars = barsRef.current;

  const isAdmin = variant === 'admin';

  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState<Speed>(1);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [audioError, setAudioError] = useState<boolean>(false);

  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const isAudioMode = !!audioUrl && !audioError;
  const effectiveDuration = isAudioMode ? audioDuration : duration;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    const onLoadedMetadata = () => {
      setAudioDuration(audio.duration);
      setAudioError(false);
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onErrorEvent = () => {
      setAudioError(true);
      setIsPlaying(false);
      setCurrentTime(0);
      onError?.();
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onErrorEvent);

    // If metadata is already loaded (cached), read duration immediately
    if (audio.readyState >= 1) {
      setAudioDuration(audio.duration);
    }

    return () => {
      audio.pause();
      audio.currentTime = 0;
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onErrorEvent);
    };
  }, [audioUrl]);

  useEffect(() => {
    if (!isPlaying || isAudioMode || disabled) return;

    const id = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + (TICK_INTERVAL_MS / 1000) * speedRef.current;
        if (next >= effectiveDuration) {
          setIsPlaying(false);
          return 0;
        }
        return next;
      });
    }, TICK_INTERVAL_MS);

    return () => clearInterval(id);
  }, [isPlaying, effectiveDuration, isAudioMode, disabled]);

  const togglePlayPause = useCallback(() => {
    if (disabled) return;
    if (isAudioMode && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {
          setAudioError(true);
        });
      }
    }
    setIsPlaying((prev) => !prev);
  }, [isAudioMode, isPlaying, disabled]);

  const handleScrub = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      const container = containerRef.current;
      if (!container || !effectiveDuration || effectiveDuration <= 0) return;

      const rect = container.getBoundingClientRect();
      if (rect.width === 0) return;

      const clickX = event.clientX - rect.left;
      const newTime = Math.max(
        0,
        Math.min(effectiveDuration, (clickX / rect.width) * effectiveDuration)
      );

      if (isAudioMode && audioRef.current) {
        audioRef.current.currentTime = newTime;
      }
      setCurrentTime(newTime);
    },
    [effectiveDuration, isAudioMode, disabled]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (disabled) return;
      if (!effectiveDuration || effectiveDuration <= 0) return;
      const step = effectiveDuration * 0.05;
      let newTime: number | null = null;

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          newTime = Math.min(effectiveDuration, currentTime + step);
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          newTime = Math.max(0, currentTime - step);
          break;
        case 'Home':
          newTime = 0;
          break;
        case 'End':
          newTime = effectiveDuration;
          break;
        default:
          return;
      }

      if (newTime !== null) {
        if (isAudioMode && audioRef.current) {
          audioRef.current.currentTime = newTime;
        }
        setCurrentTime(newTime);
      }
      event.preventDefault();
    },
    [effectiveDuration, isAudioMode, currentTime, disabled]
  );

  const handleSpeedChange = useCallback((newSpeed: Speed) => {
    setSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  }, []);

  useEffect(() => {
    if (disabled) {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [disabled]);

  return (
    <>
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          style={{ display: 'none' }}
          data-testid="waveform-audio-element"
        />
      )}
      <div
        data-testid="waveform-player"
        aria-disabled={disabled || undefined}
        className={cn(
          'flex items-center gap-3 rounded-xl p-[14px]',
          isAdmin
            ? 'border bg-muted'
            : 'border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800',
          disabled && 'opacity-50',
          className
        )}
      >
        {/* Play/Pause button */}
        <button
          type="button"
          data-testid="waveform-play-button"
          onClick={togglePlayPause}
          aria-disabled={disabled || undefined}
          className={cn(
            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full',
            'transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-offset-2',
            disabled && 'cursor-not-allowed',
            !disabled &&
              (isAdmin
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary'
                : [
                    'bg-indigo-500 text-white',
                    'hover:bg-indigo-600 focus:ring-indigo-500',
                    'dark:bg-indigo-400 dark:hover:bg-indigo-500 dark:focus:ring-offset-slate-800',
                  ]),
            disabled &&
              (isAdmin
                ? 'bg-primary text-primary-foreground'
                : 'bg-indigo-500 text-white dark:bg-indigo-400')
          )}
          aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Play className="ml-0.5 h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {/* Waveform bars */}
        <div
          ref={containerRef}
          data-testid="waveform-bars"
          className="flex flex-1 items-end gap-[2px]"
          style={{ height: '40px', cursor: disabled ? 'default' : 'pointer' }}
          role="slider"
          aria-label="Audio position"
          aria-valuemin={0}
          aria-valuemax={effectiveDuration}
          aria-valuenow={Math.round(currentTime)}
          tabIndex={disabled ? -1 : 0}
          onClick={handleScrub}
          onKeyDown={handleKeyDown}
        >
          {bars.map((height, i) => {
            const barEndTime = ((i + 1) / BAR_COUNT) * effectiveDuration;
            const isFilled =
              !disabled && currentTime > 0 && effectiveDuration > 0 && barEndTime <= currentTime;
            return (
              <div
                key={i}
                className={cn(
                  'flex-1 rounded-t-sm',
                  !isFilled &&
                    (isAdmin ? 'bg-muted-foreground/30' : 'bg-slate-300 dark:bg-slate-600')
                )}
                style={{
                  height: `${height * 100}%`,
                  ...(isFilled
                    ? { backgroundColor: isAdmin ? 'hsl(var(--primary))' : 'var(--cult-accent)' }
                    : undefined),
                }}
                data-testid="waveform-bar"
              />
            );
          })}
        </div>

        {/* Time + Speed pills */}
        <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
          <span
            data-testid="waveform-time"
            className={cn('text-xs', isAdmin ? 'font-mono' : 'font-cult-mono')}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            <span
              data-testid="waveform-time-current"
              style={{
                color: isAdmin
                  ? isPlaying && !disabled
                    ? 'hsl(var(--foreground))'
                    : 'hsl(var(--muted-foreground))'
                  : isPlaying && !disabled
                    ? 'var(--cult-accent)'
                    : 'var(--cult-text-muted)',
              }}
            >
              {formatTime(disabled ? 0 : currentTime)}
            </span>
            <span
              style={{ color: isAdmin ? 'hsl(var(--muted-foreground))' : 'var(--cult-text-muted)' }}
            >
              {' / '}
            </span>
            <span
              data-testid="waveform-time-total"
              style={{ color: isAdmin ? 'hsl(var(--muted-foreground))' : 'var(--cult-text-muted)' }}
            >
              {formatTime(disabled ? 0 : effectiveDuration)}
            </span>
          </span>
          {showSpeedControl && (
            <div
              data-testid="waveform-speed-pills"
              role="radiogroup"
              aria-label="Playback speed"
              className="flex gap-1"
            >
              {SPEED_OPTIONS.map((opt) => {
                const isSelected = opt === speed;
                return (
                  <button
                    key={opt}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`${opt}x speed`}
                    onClick={() => !disabled && handleSpeedChange(opt)}
                    tabIndex={disabled ? -1 : 0}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                      isAdmin ? 'font-mono' : 'font-cult-mono',
                      disabled && 'cursor-not-allowed',
                      isSelected
                        ? isAdmin
                          ? 'bg-primary text-primary-foreground'
                          : 'text-white'
                        : !disabled
                          ? isAdmin
                            ? 'text-muted-foreground hover:bg-muted'
                            : 'text-[var(--cult-text-muted)] hover:bg-[var(--cult-accent-soft)]'
                          : isAdmin
                            ? 'text-muted-foreground'
                            : 'text-[var(--cult-text-muted)]'
                    )}
                    style={
                      isSelected && !isAdmin ? { backgroundColor: 'var(--cult-accent)' } : undefined
                    }
                  >
                    {opt}x
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
