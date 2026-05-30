// src/features/practice/pf/AudioSurface.tsx
//
// Presentational audio surface for the Audio practice family (PRACT2-1-06).
//
// Design:
//  - 56px round green play/pause/loading button (--success tinted)
//  - 28-bar waveform with pf-wave pulse while playing
//  - 0:00 / 0:02 time readout (current / duration)
//  - x1 / x0.75 speed toggle
//  - Red-dot badge (UnwiredDot tone="danger") signals that the Audio family
//    has no backend card type yet — it is a forward-looking placeholder.
//
// IMPORTANT: This component is PRESENTATIONAL ONLY.
//  - It receives a controlled `audioState` object as props (same shape as
//    AudioChip / PracticeCard) — it does NOT call useAudioPlayer internally.
//  - A second useAudioPlayer instance would create a duplicate Audio() element
//    and desync play/pulse/time with the page-level instance.
//  - The component is consumed by the visual mock fixture (subtask 13) and
//    integration tests (subtask 14). It has NO dispatch case in the live page.

import '@/features/decks/dx/dx.css';

import React, { useEffect, useRef, useState } from 'react';

import { Loader2, Pause, Play, Volume2 } from 'lucide-react';

import { UnwiredDot } from '@/features/decks/dx/atoms/UnwiredDot';
import type { AudioSpeed } from '@/utils/audioSpeed';

// ─── Deterministic waveform helper ───────────────────────────────────────────

/**
 * Returns a bar height (20–100, unitless %) for bar index `i`.
 * Derived from a mix of two sinusoids seeded by the index — purely deterministic,
 * no Math.random / Date.now, stable across renders and environments (AC #2).
 *
 * The formula uses two offset sine waves to produce a natural-looking asymmetric
 * waveform shape. All inputs and outputs are pure functions of `i`.
 */
export function barHeight(i: number): number {
  const a = Math.sin(i * 0.72 + 1.1) * 30; // primary wave
  const b = Math.sin(i * 1.4 + 2.3) * 20; // secondary wave
  const raw = 60 + a + b; // 10..110 approx
  return Math.max(20, Math.min(100, Math.round(raw)));
}

const BAR_COUNT = 28;
const BAR_HEIGHTS: readonly number[] = Array.from({ length: BAR_COUNT }, (_, i) => barHeight(i));

// ─── Types ────────────────────────────────────────────────────────────────────

/** Controlled audio state — same contract as AudioChip / PracticeCard */
export interface AudioSurfaceState {
  audioUrl: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  onToggle: () => void;
  speed?: AudioSpeed;
  setSpeed?: (s: AudioSpeed) => void;
}

export interface AudioSurfaceProps {
  audioState: AudioSurfaceState;
  /** Optional className for the outer wrapper */
  className?: string;
}

// ─── Time formatting ──────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AudioSurface — the expanded audio play control for the Audio practice family.
 *
 * Wraps in an `UnwiredDot tone="danger"` to register the Audio family as a
 * red-dotted placeholder (no audio card type exists in the backend yet).
 */
export function AudioSurface({ audioState, className }: AudioSurfaceProps) {
  const { audioUrl, isPlaying, isLoading, error, onToggle, speed = 1, setSpeed } = audioState;

  // Track current / duration for the time readout.
  // We use a lightweight rAF-based counter that increments while isPlaying.
  // This avoids adding a second useAudioPlayer or a DOM Audio reference —
  // it approximates elapsed time from the moment isPlaying became true.
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const rafRef = useRef<number | null>(null);
  const rafStartRef = useRef<{ ts: number; baseTime: number } | null>(null);

  // Poll time while playing via rAF
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      rafStartRef.current = null;
      return;
    }

    rafStartRef.current = { ts: performance.now(), baseTime: currentTime };

    function tick(now: number) {
      const ref = rafStartRef.current;
      if (ref) {
        const elapsed = (now - ref.ts) / 1000;
        setCurrentTime(ref.baseTime + elapsed);
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // Reset time on URL change
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
  }, [audioUrl]);

  const disabled = !audioUrl;

  return (
    <div
      className={`pf-audio-surface${className ? ` ${className}` : ''}`}
      data-testid="pf-audio-surface"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* ── Family header: "Audio" label + red unwired dot ────────────────── */}
      <div className="pf-audio-surface__header">
        <UnwiredDot tone="danger" aria-label="Audio cards — not yet connected to backend.">
          <span className="pf-audio-surface__family-label">
            <Volume2 className="pf-audio-surface__family-icon" aria-hidden="true" />
            Audio
          </span>
        </UnwiredDot>
      </div>

      {/* ── Play / pause button ───────────────────────────────────────────── */}
      <button
        type="button"
        className="pf-audio-surface__play-btn"
        aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onToggle();
        }}
        data-testid="pf-audio-play-btn"
        data-playing={isPlaying ? 'true' : undefined}
      >
        {isLoading ? (
          <Loader2
            className="pf-audio-surface__play-icon pf-audio-surface__play-icon--loading"
            aria-hidden="true"
          />
        ) : isPlaying ? (
          <Pause className="pf-audio-surface__play-icon" aria-hidden="true" />
        ) : (
          <Play className="pf-audio-surface__play-icon" aria-hidden="true" />
        )}
      </button>

      {/* ── Waveform ──────────────────────────────────────────────────────── */}
      <div
        className="pf-audio-surface__wave"
        aria-hidden="true"
        data-testid="pf-audio-waveform"
        data-playing={isPlaying ? 'true' : undefined}
      >
        {BAR_HEIGHTS.map((h, i) => (
          <span
            key={i}
            className={`pf-wave-bar${isPlaying ? 'pf-wave-bar--playing' : ''}`}
            style={{ '--bar-h': `${h}%` } as React.CSSProperties}
            data-testid={`pf-wave-bar-${i}`}
          />
        ))}
      </div>

      {/* ── Time readout ──────────────────────────────────────────────────── */}
      <div className="pf-audio-surface__time" aria-live="off" data-testid="pf-audio-time">
        <span className="pf-audio-surface__time-current">{formatTime(currentTime)}</span>
        <span className="pf-audio-surface__time-sep" aria-hidden="true">
          {' '}
          /{' '}
        </span>
        <span className="pf-audio-surface__time-duration">{formatTime(duration)}</span>
      </div>

      {/* ── Speed toggle ──────────────────────────────────────────────────── */}
      <div className="pf-audio-surface__speed" data-testid="pf-audio-speed">
        {([1, 0.75] as AudioSpeed[]).map((opt) => (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={speed === opt}
            aria-label={`${opt}x speed`}
            data-testid={`pf-audio-speed-${opt}`}
            className={`pf-audio-surface__speed-btn${speed === opt ? 'is-active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setSpeed?.(opt);
            }}
          >
            x{opt}
          </button>
        ))}
      </div>

      {/* ── Error message ─────────────────────────────────────────────────── */}
      {error && (
        <p className="pf-audio-surface__error" role="alert" data-testid="pf-audio-error">
          {error}
        </p>
      )}
    </div>
  );
}
