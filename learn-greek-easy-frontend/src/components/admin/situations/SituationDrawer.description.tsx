// src/components/admin/situations/SituationDrawer.description.tsx
//
// SIT-07b: Description tab — B1 + A2 editable Greek textareas + Reference EN textarea
// + dual audio rows. One-at-a-time playback; pause-on-unmount covers tab-change.
// No Save button here — save is handled by the parent drawer footer.
// Both Regenerate buttons disabled with "Coming soon" tooltip.

import React, { useEffect, useRef, useState } from 'react';

import { Pause, Play } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import { Kicker } from '@/components/ui/kicker';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { SituationDetailResponse } from '@/types/situation';

import type { SituationDrawerFormData } from './SituationDrawer';

// ── Types ─────────────────────────────────────────────────────────────────────

type Level = 'b1' | 'a2';

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

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  situation: SituationDetailResponse;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SituationDrawerDescription({ situation }: Props) {
  const { t } = useTranslation('admin');
  const { register } = useFormContext<SituationDrawerFormData>();

  const [playing, setPlaying] = useState<Level | null>(null);
  const [rowState, setRowState] = useState<Record<Level, RowState>>({
    b1: { currentTime: 0, duration: 0 },
    a2: { currentTime: 0, duration: 0 },
  });

  const b1Ref = useRef<HTMLAudioElement>(null);
  const a2Ref = useRef<HTMLAudioElement>(null);

  // Pause both elements on unmount — covers tab-change since parent conditionally
  // renders this component only when activeTab === 'description'.
  useEffect(() => {
    return () => {
      b1Ref.current?.pause();
      a2Ref.current?.pause();
    };
  }, []);

  // ── Ref lookup ───────────────────────────────────────────────────────────────

  function getRef(level: Level): React.RefObject<HTMLAudioElement | null> {
    return level === 'b1' ? b1Ref : a2Ref;
  }

  // ── Playback control ─────────────────────────────────────────────────────────

  function handleToggle(level: Level) {
    const ref = getRef(level);
    if (!ref.current) return;

    if (playing === level) {
      ref.current.pause();
      setPlaying(null);
    } else {
      if (playing) {
        getRef(playing).current?.pause();
      }
      ref.current.play().catch(() => {
        // Ignore AbortError from rapid toggles.
      });
      setPlaying(level);
    }
  }

  // ── Audio event handlers ─────────────────────────────────────────────────────

  function handleTimeUpdate(level: Level, el: HTMLAudioElement) {
    setRowState((prev) => ({
      ...prev,
      [level]: { ...prev[level], currentTime: el.currentTime },
    }));
  }

  function handleLoadedMetadata(level: Level, el: HTMLAudioElement) {
    setRowState((prev) => ({
      ...prev,
      [level]: { ...prev[level], duration: el.duration },
    }));
  }

  function handleEnded(level: Level) {
    setRowState((prev) => ({
      ...prev,
      [level]: { ...prev[level], currentTime: 0 },
    }));
    setPlaying(null);
  }

  // ── Render helpers ───────────────────────────────────────────────────────────

  function renderPlayButton(level: Level, audioUrl: string | null) {
    if (!audioUrl) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
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
      ? t('situations.drawer.description.pauseAria', { level: level.toUpperCase() })
      : t('situations.drawer.description.playAria', { level: level.toUpperCase() });

    return (
      <button
        type="button"
        className="icon-btn"
        aria-label={label}
        onClick={() => handleToggle(level)}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>
    );
  }

  function renderRow(level: Level, audioUrl: string | null, nameKey: string) {
    const rs = rowState[level];
    const subText = audioUrl
      ? t('situations.drawer.description.generatedElevenLabs')
      : t('situations.drawer.description.notGeneratedYet');

    return (
      <div
        key={level}
        className="audio-row"
        data-testid={`situation-drawer-description-${level}-row`}
      >
        {/* Left meta */}
        <div className="audio-l">
          <Badge tone="violet">{level.toUpperCase()}</Badge>
          <div>
            <span className="audio-name">{t(nameKey)}</span>
            <span className="audio-sub">{subText}</span>
          </div>
        </div>

        {/* Player */}
        <div className="audio-player">
          {renderPlayButton(level, audioUrl)}
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
                {t('situations.drawer.description.regenerate')}
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('comingSoon')}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  }

  // ── Guard: description not yet generated ─────────────────────────────────────

  const desc = situation.description;

  if (!desc) {
    return (
      <TooltipProvider>
        <div data-testid="situation-drawer-tab-description-content">
          <Kicker dot="primary">{t('situations.drawer.description.kicker')}</Kicker>
          <p className="dr-field-h">{t('situations.drawer.description.hint')}</p>
        </div>
      </TooltipProvider>
    );
  }

  // ── Full render ───────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <div data-testid="situation-drawer-tab-description-content">
        <Kicker dot="primary">{t('situations.drawer.description.kicker')}</Kicker>
        <p className="dr-field-h">{t('situations.drawer.description.hint')}</p>

        <div className="dr-2col">
          <Field label={t('situations.drawer.description.b1Label')}>
            <Textarea
              rows={6}
              lang="el"
              className="font-serif"
              data-testid="situation-drawer-description-b1-text"
              {...register('description.text_el')}
            />
          </Field>
          <Field label={t('situations.drawer.description.a2Label')}>
            <Textarea
              rows={6}
              lang="el"
              className="font-serif"
              data-testid="situation-drawer-description-a2-text"
              {...register('description.text_el_a2')}
            />
          </Field>
        </div>

        <Field
          label={t('situations.drawer.description.referenceLabel')}
          hint={t('situations.drawer.description.referenceHint')}
        >
          <Textarea
            rows={4}
            lang="en"
            data-testid="situation-drawer-description-en-text"
            {...register('description.text_en')}
          />
        </Field>

        {/* Hidden audio elements — always rendered so refs are stable */}
        {desc.audio_url ? (
          <audio
            ref={b1Ref}
            src={desc.audio_url}
            style={{ display: 'none' }}
            data-testid="situation-drawer-description-b1-audio"
            onTimeUpdate={(e) => handleTimeUpdate('b1', e.currentTarget)}
            onLoadedMetadata={(e) => handleLoadedMetadata('b1', e.currentTarget)}
            onEnded={() => handleEnded('b1')}
          />
        ) : (
          <audio
            ref={b1Ref}
            style={{ display: 'none' }}
            data-testid="situation-drawer-description-b1-audio"
            onTimeUpdate={(e) => handleTimeUpdate('b1', e.currentTarget)}
            onLoadedMetadata={(e) => handleLoadedMetadata('b1', e.currentTarget)}
            onEnded={() => handleEnded('b1')}
          />
        )}
        {desc.audio_a2_url ? (
          <audio
            ref={a2Ref}
            src={desc.audio_a2_url}
            style={{ display: 'none' }}
            data-testid="situation-drawer-description-a2-audio"
            onTimeUpdate={(e) => handleTimeUpdate('a2', e.currentTarget)}
            onLoadedMetadata={(e) => handleLoadedMetadata('a2', e.currentTarget)}
            onEnded={() => handleEnded('a2')}
          />
        ) : (
          <audio
            ref={a2Ref}
            style={{ display: 'none' }}
            data-testid="situation-drawer-description-a2-audio"
            onTimeUpdate={(e) => handleTimeUpdate('a2', e.currentTarget)}
            onLoadedMetadata={(e) => handleLoadedMetadata('a2', e.currentTarget)}
            onEnded={() => handleEnded('a2')}
          />
        )}

        {renderRow('b1', desc.audio_url, 'situations.drawer.description.b1Narration')}
        {renderRow('a2', desc.audio_a2_url, 'situations.drawer.description.a2Narration')}
      </div>
    </TooltipProvider>
  );
}
