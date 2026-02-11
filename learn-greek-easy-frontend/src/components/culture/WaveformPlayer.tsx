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
  /** Total audio duration in seconds. Default: 90. */
  duration?: number;
  /** Additional CSS classes applied to the outer container. */
  className?: string;
}

export const WaveformPlayer: FC<WaveformPlayerProps> = ({
  duration = DEFAULT_DURATION,
  className,
}) => {
  const barsRef = useRef<number[] | null>(null);
  if (barsRef.current === null) {
    barsRef.current = generateBars(BAR_COUNT);
  }
  const bars = barsRef.current;

  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState<Speed>(1);
  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    if (!isPlaying) return;

    const id = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + (TICK_INTERVAL_MS / 1000) * speedRef.current;
        if (next >= duration) {
          setIsPlaying(false);
          return 0;
        }
        return next;
      });
    }, TICK_INTERVAL_MS);

    return () => clearInterval(id);
  }, [isPlaying, duration]);

  const togglePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleScrub = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container || !duration || duration <= 0) return;

      const rect = container.getBoundingClientRect();
      if (rect.width === 0) return;

      const clickX = event.clientX - rect.left;
      const newTime = Math.max(0, Math.min(duration, (clickX / rect.width) * duration));
      setCurrentTime(newTime);
    },
    [duration]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!duration || duration <= 0) return;
      const step = duration * 0.05;
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          setCurrentTime((t) => Math.min(duration, t + step));
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          setCurrentTime((t) => Math.max(0, t - step));
          break;
        case 'Home':
          setCurrentTime(0);
          break;
        case 'End':
          setCurrentTime(duration);
          break;
        default:
          return;
      }
      event.preventDefault();
    },
    [duration]
  );

  return (
    <div
      data-testid="waveform-player"
      className={cn(
        'flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-100 p-[14px]',
        'dark:border-slate-700 dark:bg-slate-800',
        className
      )}
    >
      {/* Play/Pause button */}
      <button
        type="button"
        data-testid="waveform-play-button"
        onClick={togglePlayPause}
        className={cn(
          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full',
          'bg-indigo-500 text-white transition-colors duration-200',
          'hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
          'dark:bg-indigo-400 dark:hover:bg-indigo-500 dark:focus:ring-offset-slate-800'
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
        style={{ height: '40px', cursor: 'pointer' }}
        role="slider"
        aria-label="Audio position"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={Math.round(currentTime)}
        tabIndex={0}
        onClick={handleScrub}
        onKeyDown={handleKeyDown}
      >
        {bars.map((height, i) => {
          const barEndTime = ((i + 1) / BAR_COUNT) * duration;
          const isFilled = currentTime > 0 && duration > 0 && barEndTime <= currentTime;
          return (
            <div
              key={i}
              className={cn('flex-1 rounded-t-sm', !isFilled && 'bg-slate-300 dark:bg-slate-600')}
              style={{
                height: `${height * 100}%`,
                ...(isFilled ? { backgroundColor: 'var(--cult-accent)' } : undefined),
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
          className="font-cult-mono text-xs"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          <span
            data-testid="waveform-time-current"
            style={{ color: isPlaying ? 'var(--cult-accent)' : 'var(--cult-text-muted)' }}
          >
            {formatTime(currentTime)}
          </span>
          <span style={{ color: 'var(--cult-text-muted)' }}>{' / '}</span>
          <span data-testid="waveform-time-total" style={{ color: 'var(--cult-text-muted)' }}>
            {formatTime(duration)}
          </span>
        </span>
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
                onClick={() => setSpeed(opt)}
                className={cn(
                  'rounded-full px-2.5 py-0.5 font-cult-mono text-xs transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  isSelected
                    ? 'text-white'
                    : 'text-[var(--cult-text-muted)] hover:bg-[var(--cult-accent-soft)]'
                )}
                style={isSelected ? { backgroundColor: 'var(--cult-accent)' } : undefined}
              >
                {opt}x
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
