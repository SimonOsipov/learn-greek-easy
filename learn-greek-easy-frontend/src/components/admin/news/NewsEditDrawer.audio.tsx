// src/components/admin/news/NewsEditDrawer.audio.tsx
//
// NEWS-07c: Audio tab — 3 rows (B2 / A2 / B1) + static decorative waveform + one-at-a-time play.
// Does NOT reuse WaveformPlayer — this is a lightweight static-bar atom with no Web Audio analysis.

import React, { useEffect, useRef, useState } from 'react';

import { Pause, Play, RefreshCw, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { type NewsItemResponse } from '@/services/adminAPI';

// ── Types ──────────────────────────────────────────────────────────────────────

type AudioLevel = 'b2' | 'a2' | 'b1';

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
  const { t, i18n } = useTranslation('admin');

  // Which row is actively playing.
  const [playing, setPlaying] = useState<AudioLevel | null>(null);

  // Per-row playback state (currentTime / duration).
  const [rowState, setRowState] = useState<Record<AudioLevel, RowState>>({
    b2: { currentTime: 0, duration: item.audio_duration_seconds ?? 0 },
    a2: { currentTime: 0, duration: item.audio_a2_duration_seconds ?? 0 },
    b1: { currentTime: 0, duration: 0 },
  });

  // Audio element refs — only B2 and A2 have real audio elements.
  const b2Ref = useRef<HTMLAudioElement>(null);
  const a2Ref = useRef<HTMLAudioElement>(null);

  // Pause both elements on unmount (covers tab-change since the parent
  // conditionally renders this component only when activeTab === 'audio').
  useEffect(() => {
    return () => {
      b2Ref.current?.pause();
      a2Ref.current?.pause();
    };
  }, []);

  // ── Playback control ────────────────────────────────────────────────────────

  function getRef(level: AudioLevel): React.RefObject<HTMLAudioElement | null> | null {
    if (level === 'b2') return b2Ref;
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
    if (level === 'b1') {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={t('news.drawer.audio.playLabel', { level: 'B1' })}
              aria-disabled="true"
              className="btn-glass cursor-not-allowed opacity-60"
              onClick={(e) => e.preventDefault()}
            >
              <Play size={16} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('comingSoon')}</TooltipContent>
        </Tooltip>
      );
    }

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
    if (level === 'b1') return t('news.drawer.audio.b1NotShipping');

    const url = level === 'b2' ? item.audio_url : item.audio_a2_url;
    const generatedAt = level === 'b2' ? item.audio_generated_at : item.audio_a2_generated_at;

    if (!url) return t('news.drawer.audio.notGeneratedYet');

    const dateStr = generatedAt ? new Date(generatedAt).toLocaleDateString(i18n.language) : '';
    return t('news.drawer.audio.generatedFrom', { date: dateStr });
  }

  function renderRow(level: AudioLevel, tone: 'violet', badgeLabel: string, nameKey: string) {
    const rs = rowState[level];
    return (
      <div key={level} className="audio-row">
        {/* Left meta */}
        <div className="audio-l">
          <Badge tone={tone}>{badgeLabel}</Badge>
          <div>
            <span className="audio-name">{t(nameKey)}</span>
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
        <div className="audio-actions">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-disabled="true"
                className="btn-glass cursor-not-allowed opacity-60"
                onClick={(e) => e.preventDefault()}
              >
                <RefreshCw size={14} />
                {t('news.drawer.audio.regenerate')}
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('comingSoon')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-disabled="true"
                className="icon-btn cursor-not-allowed opacity-60"
                onClick={(e) => e.preventDefault()}
              >
                <Upload size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('comingSoon')}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div data-testid="news-drawer-tab-audio-content">
        {/* Hidden audio elements — only B2 and A2 */}
        {item.audio_url && (
          <audio
            ref={b2Ref}
            src={item.audio_url}
            style={{ display: 'none' }}
            data-testid="news-drawer-audio-b2-element"
            onTimeUpdate={(e) => handleTimeUpdate('b2', e.currentTarget)}
            onLoadedMetadata={(e) => handleLoadedMetadata('b2', e.currentTarget)}
            onEnded={() => handleEnded('b2')}
          />
        )}
        {!item.audio_url && (
          <audio
            ref={b2Ref}
            style={{ display: 'none' }}
            data-testid="news-drawer-audio-b2-element"
            onTimeUpdate={(e) => handleTimeUpdate('b2', e.currentTarget)}
            onLoadedMetadata={(e) => handleLoadedMetadata('b2', e.currentTarget)}
            onEnded={() => handleEnded('b2')}
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
        {renderRow('b2', 'violet', 'B2', 'news.drawer.audio.b2Narration')}
        {renderRow('a2', 'violet', 'A2', 'news.drawer.audio.a2Narration')}
        {renderRow('b1', 'violet', 'B1', 'news.drawer.audio.b1Narration')}
      </div>
    </TooltipProvider>
  );
};
