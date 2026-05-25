// EXR-20 + EXR-21 + EXR-22 + EXR-35 + EXR-36 + EXR-37 + EXR-73
// Audio bar with 54-bar waveform, real progress, edge states,
// single-audio policy (module scope), and keyboard/a11y.

import { useEffect, useRef, useState } from 'react';

import { AlertCircle, Loader2, Pause, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { track } from '@/lib/analytics/track';
import { cn } from '@/lib/utils';

// EXR-36: module-scoped ref — one audio element playing at a time across all rows.
let currentAudioRef: HTMLAudioElement | null = null;

interface Props {
  src?: string | null;
  /** EXR-73: exercise identity for analytics tracking */
  exerciseId?: string;
  exerciseType?: string;
}

export function AdminExerciseAudioBar({ src, exerciseId, exerciseType }: Props) {
  const { t } = useTranslation('admin');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [pct, setPct] = useState(0);
  // EXR-73: track only the first play per component mount (session-scoped)
  const hasTrackedPlay = useRef(false);

  // EXR-22 + EXR-35 + EXR-36: wire up audio element events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlaying = () => {
      setPlaying(true);
      setLoading(false);
      setError(false);
      // EXR-73: fire once per mount (first play only)
      if (!hasTrackedPlay.current) {
        hasTrackedPlay.current = true;
        track('admin_exercise_audio_played', {
          exercise_id: exerciseId,
          exercise_type: exerciseType,
          audio_present: true,
        });
      }
    };
    const onPause = () => {
      setPlaying(false);
      if (currentAudioRef === audio) currentAudioRef = null;
    };
    const onTimeUpdate = () => {
      if (audio.duration > 0) {
        setPct(Math.min(100, (audio.currentTime / audio.duration) * 100));
      }
    };
    const onEnded = () => {
      setPlaying(false);
      setPct(0);
      if (currentAudioRef === audio) currentAudioRef = null;
    };
    const onError = () => {
      setError(true);
      setLoading(false);
      setPlaying(false);
    };

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || error) return;

    if (audio.paused) {
      // EXR-36: pause any other row currently playing
      if (currentAudioRef && currentAudioRef !== audio) {
        currentAudioRef.pause();
      }
      currentAudioRef = audio;
      setLoading(true);
      void audio.play().catch(() => setError(true));
    } else {
      audio.pause();
    }
  };

  // Component renders nothing if no audio URL is provided
  if (!src) return null;

  // EXR-37: aria-label reflects current state
  const ariaLabel = error
    ? t('exercises.audio.unavailable')
    : playing
      ? t('exercises.audio.pauseLabel')
      : t('exercises.audio.playLabel');

  return (
    <div className="flex items-center gap-3 py-2">
      {/* EXR-20: 36px circular play/pause button */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={error}
        aria-label={ariaLabel}
        className={cn(
          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          error
            ? 'cursor-not-allowed bg-destructive/10 text-destructive'
            : 'bg-primary text-primary-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
        )}
      >
        {/* EXR-35: icon switches based on state */}
        {error ? (
          <AlertCircle className="size-4" />
        ) : loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : playing ? (
          <Pause className="size-4" />
        ) : (
          <Play className="size-4" />
        )}
      </button>

      {/* EXR-21 + EXR-22: 54-bar waveform with progress overlay */}
      <div
        className={cn('relative flex flex-1 items-end gap-px', error && 'opacity-40')}
        style={{ height: '24px' }}
      >
        {/* EXR-22: progress overlay */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 bg-primary/30 transition-[width] duration-100 ease-out"
          style={{ width: `${pct}%` }}
        />
        {/* EXR-21: 54 bars, height = 4 + ((i * 7) % 18) */}
        {Array.from({ length: 54 }).map((_, i) => (
          <div
            key={i}
            className="w-[2px] shrink-0 bg-fg3/40"
            style={{ height: `${4 + ((i * 7) % 18)}px` }}
          />
        ))}
      </div>

      {/* EXR-35: error label right of waveform */}
      {error && <span className="ms-2 text-xs text-fg3">{t('exercises.audio.unavailable')}</span>}

      {/* Hidden audio element */}
      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  );
}
