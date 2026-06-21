// src/components/admin/news/NewsEditDrawer.audio.tsx
//
// NEWS-07c: Audio tab — 2 rows (B1 / A2) + static decorative waveform + one-at-a-time play.
// Does NOT reuse WaveformPlayer — this is a lightweight static-bar atom with no Web Audio analysis.
// ADMIN2-40 F10: Regenerate button wired to the situation description-audio SSE pipeline.

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Pause, Play, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSSE } from '@/hooks/useSSE';
import { tDynamic } from '@/i18n/tDynamic';
import { getDescriptionAudioStreamUrl, type NewsItemResponse } from '@/services/adminAPI';
import { useAdminNewsStore } from '@/stores/adminNewsStore';

// ── Types ──────────────────────────────────────────────────────────────────────

type AudioLevel = 'b1' | 'a2';

interface RowState {
  currentTime: number;
  duration: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = String(Math.floor(seconds % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

// 60 static decorative bars with deterministic heights — no Web Audio analysis.
const WAVE_BARS = Array.from({ length: 60 }, (_, i) => ({ i, height: 6 + ((i * 7) % 18) }));

// ── Sub-component: static waveform bars + progress overlay ────────────────────

interface AudioTrackProps {
  currentTime: number;
  duration: number;
}

function AudioTrack({ currentTime, duration }: AudioTrackProps) {
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  return (
    <div className="audio-track">
      <span className="audio-progress" style={{ width: `${pct}%` }} />
      {WAVE_BARS.map(({ i, height }) => (
        <span key={i} className="audio-wave" style={{ height: `${height}px` }} />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  item: NewsItemResponse;
}

export const NewsEditDrawerAudio: React.FC<Props> = ({ item }) => {
  const { t } = useTranslation('admin');

  // Which row is actively playing.
  const [playing, setPlaying] = useState<AudioLevel | null>(null);

  // Per-row playback state (currentTime / duration).
  const [rowState, setRowState] = useState<Record<AudioLevel, RowState>>({
    b1: { currentTime: 0, duration: item.audio_duration_seconds ?? 0 },
    a2: { currentTime: 0, duration: item.audio_a2_duration_seconds ?? 0 },
  });

  // F10: which level is actively regenerating via SSE.
  const [regenLevel, setRegenLevel] = useState<AudioLevel | null>(null);
  // F10: inline error message (cleared when a new regen starts).
  const [regenError, setRegenError] = useState<string | null>(null);

  // Audio element refs — only B1 and A2 have real audio elements.
  const b1Ref = useRef<HTMLAudioElement>(null);
  const a2Ref = useRef<HTMLAudioElement>(null);

  // Pause both elements on unmount (covers tab-change since the parent
  // conditionally renders this component only when activeTab === 'audio').
  useEffect(() => {
    return () => {
      b1Ref.current?.pause();
      a2Ref.current?.pause();
    };
  }, []);

  // ── F10: SSE wiring ─────────────────────────────────────────────────────────

  const situationId = item.linked_situation?.id ?? null;

  // Derive the stream URL from the active regen level and the linked situation.
  // An empty string disables the stream when either is absent.
  const streamUrl =
    regenLevel !== null && situationId !== null
      ? getDescriptionAudioStreamUrl(situationId, regenLevel)
      : '';

  const handleSSEEvent = useCallback((event: { type: string; data: unknown }) => {
    const data = event.data as Record<string, unknown>;
    switch (event.type) {
      case 'description_audio:complete':
        // Refresh the item to pick up new audio URLs + duration.
        useAdminNewsStore.getState().fetchNewsItems();
        setRegenLevel(null);
        break;
      case 'description_audio:error':
        setRegenError(
          typeof data['error'] === 'string' ? data['error'] : 'Audio regeneration failed'
        );
        setRegenLevel(null);
        break;
      // Intermediate stages (start / tts / alignment / upload / persist) — no UI update needed
      // beyond the spinner that's already visible while regenLevel !== null.
      default:
        break;
    }
  }, []);

  const handleSSEError = useCallback((err: Error | unknown) => {
    const msg =
      err instanceof Error
        ? err.message
        : ((err as { message?: string }).message ?? 'Stream connection failed');
    setRegenError(msg);
    setRegenLevel(null);
  }, []);

  useSSE(streamUrl, {
    method: 'POST',
    enabled: regenLevel !== null && situationId !== null,
    onEvent: handleSSEEvent,
    onError: handleSSEError,
    maxRetries: 0,
  });

  // ── Playback control ────────────────────────────────────────────────────────

  function getRef(level: AudioLevel): React.RefObject<HTMLAudioElement | null> | null {
    if (level === 'b1') return b1Ref;
    if (level === 'a2') return a2Ref;
    return null;
  }

  function handleToggle(level: AudioLevel) {
    const ref = getRef(level);
    if (!ref?.current) return;

    if (playing === level) {
      // Pause the current row.
      ref.current.pause();
      setPlaying(null);
    } else {
      // Pause the previously playing row first.
      if (playing) {
        const prevRef = getRef(playing);
        prevRef?.current?.pause();
      }
      ref.current.play().catch(() => {
        // Ignore AbortError from rapid toggles.
      });
      setPlaying(level);
    }
  }

  // ── Audio event handlers ────────────────────────────────────────────────────

  function handleTimeUpdate(level: AudioLevel, el: HTMLAudioElement) {
    setRowState((prev) => ({
      ...prev,
      [level]: { ...prev[level], currentTime: el.currentTime },
    }));
  }

  function handleLoadedMetadata(level: AudioLevel, el: HTMLAudioElement) {
    setRowState((prev) => ({
      ...prev,
      [level]: { ...prev[level], duration: el.duration },
    }));
  }

  function handleEnded(level: AudioLevel) {
    setRowState((prev) => ({
      ...prev,
      [level]: { ...prev[level], currentTime: 0 },
    }));
    setPlaying(null);
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  function renderPlayButton(level: AudioLevel) {
    const isPlaying = playing === level;
    const label = isPlaying
      ? t('news.drawer.audio.pauseLabel', { level: level.toUpperCase() })
      : t('news.drawer.audio.playLabel', { level: level.toUpperCase() });

    return (
      <button
        type="button"
        className="audio-play"
        aria-label={label}
        onClick={() => handleToggle(level)}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>
    );
  }

  function renderSubText(level: AudioLevel): string {
    const url = level === 'b1' ? item.audio_url : item.audio_a2_url;

    if (!url) return t('news.drawer.audio.notGeneratedYet');

    return '';
  }

  function renderRegenButton(level: AudioLevel) {
    const isInFlight = regenLevel === level;

    if (situationId === null) {
      // UNLINKED: keep aria-disabled with guard tooltip (no red dot — this is a real input guard,
      // not a "coming soon" stub).
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-disabled="true"
                className="cursor-not-allowed opacity-60"
                onClick={(e) => e.preventDefault()}
              >
                <RefreshCw size={14} />
                {t('news.drawer.audio.regenerate')}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{t('news.drawer.audio.regenerateNoSituation')}</TooltipContent>
        </Tooltip>
      );
    }

    // LINKED: fully wired Regenerate button.
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={isInFlight}
        onClick={() => {
          setRegenError(null);
          setRegenLevel(level);
        }}
      >
        <RefreshCw size={14} className={isInFlight ? 'animate-spin' : ''} />
        {t('news.drawer.audio.regenerate')}
      </Button>
    );
  }

  function renderRow(level: AudioLevel, tone: 'violet', badgeLabel: string, nameKey: string) {
    const rs = rowState[level];
    return (
      <div key={level} className="audio-row">
        {/* Left meta */}
        <div className="audio-l">
          <Badge tone={tone}>{badgeLabel}</Badge>
          <div>
            <span className="audio-name">{tDynamic(t, nameKey)}</span>
            <span className="audio-sub">{renderSubText(level)}</span>
          </div>
        </div>

        {/* Player */}
        <div className="audio-player">
          {renderPlayButton(level)}
          <AudioTrack currentTime={rs.currentTime} duration={rs.duration} />
          <span className="audio-time">
            {formatMs(rs.currentTime)} / {formatMs(rs.duration)}
          </span>
        </div>

        {/* Actions */}
        <div className="audio-actions">{renderRegenButton(level)}</div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div data-testid="news-drawer-tab-audio-content">
        {/* F10: inline error banner — shown when SSE transport or pipeline errors out */}
        {regenError && (
          <p className="mb-2 text-sm text-destructive" role="alert">
            {regenError}
          </p>
        )}

        {/* Hidden audio elements — only B1 and A2 */}
        {item.audio_url && (
          <audio
            ref={b1Ref}
            src={item.audio_url}
            style={{ display: 'none' }}
            data-testid="news-drawer-audio-b1-element"
            onTimeUpdate={(e) => handleTimeUpdate('b1', e.currentTarget)}
            onLoadedMetadata={(e) => handleLoadedMetadata('b1', e.currentTarget)}
            onEnded={() => handleEnded('b1')}
          />
        )}
        {!item.audio_url && (
          <audio
            ref={b1Ref}
            style={{ display: 'none' }}
            data-testid="news-drawer-audio-b1-element"
            onTimeUpdate={(e) => handleTimeUpdate('b1', e.currentTarget)}
            onLoadedMetadata={(e) => handleLoadedMetadata('b1', e.currentTarget)}
            onEnded={() => handleEnded('b1')}
          />
        )}
        {item.audio_a2_url && (
          <audio
            ref={a2Ref}
            src={item.audio_a2_url}
            style={{ display: 'none' }}
            data-testid="news-drawer-audio-a2-element"
            onTimeUpdate={(e) => handleTimeUpdate('a2', e.currentTarget)}
            onLoadedMetadata={(e) => handleLoadedMetadata('a2', e.currentTarget)}
            onEnded={() => handleEnded('a2')}
          />
        )}
        {!item.audio_a2_url && (
          <audio
            ref={a2Ref}
            style={{ display: 'none' }}
            data-testid="news-drawer-audio-a2-element"
            onTimeUpdate={(e) => handleTimeUpdate('a2', e.currentTarget)}
            onLoadedMetadata={(e) => handleLoadedMetadata('a2', e.currentTarget)}
            onEnded={() => handleEnded('a2')}
          />
        )}

        {/* Rows */}
        {renderRow('b1', 'violet', 'B1', 'news.drawer.audio.b1Narration')}
        {renderRow('a2', 'violet', 'A2', 'news.drawer.audio.a2Narration')}
      </div>
    </TooltipProvider>
  );
};
