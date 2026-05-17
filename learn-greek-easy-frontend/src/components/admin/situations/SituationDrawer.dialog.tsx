/**
 * SIT-07a — Dialog tab content (chat bubbles + segmented playback).
 *
 * CRITICAL: The hidden `scenario_en` RHF input at the top of this component MUST
 * remain intact until SIT-08 migrates the drawer dirty-state tests off it.
 * SIT-06 tests in `__tests__/SituationDrawer.test.tsx` (lines 303, 310, 335, 351,
 * 432, 471, 485, 502, 533) depend on `data-testid="scenario-en-input"` being present
 * whenever the Dialog tab is active.
 */
import { useEffect, useRef, useState } from 'react';

import { Pause, Pencil, Play, RefreshCw } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDuration } from '@/lib/timeFormatUtils';
import type { DialogLine, DialogSpeaker, SituationDetailResponse } from '@/types/situation';

import type { SituationDrawerFormData } from './SituationDrawer';

// ── Constants ────────────────────────────────────────────────────────────────

const WAVE_BARS = Array.from({ length: 24 }, (_, i) => ({
  i,
  height: 6 + ((i * 7) % 18),
}));

// Cycle through 4 tone classes — see index.css for definitions
const AVATAR_TONES = ['avatar-blue', 'avatar-violet', 'avatar-green', 'avatar-amber'] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatLineDuration(start: number | null, end: number | null): string {
  if (start == null || end == null || end <= start) return '—';
  return formatDuration((end - start) / 1000);
}

function avatarToneFor(speakerIndex: number): string {
  return AVATAR_TONES[speakerIndex % AVATAR_TONES.length];
}

function speakerByLine(line: DialogLine, speakers: DialogSpeaker[]): DialogSpeaker | undefined {
  return speakers.find((s) => s.id === line.speaker_id);
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  situation: SituationDetailResponse;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SituationDrawerDialog({ situation }: Props) {
  const { t } = useTranslation('admin');
  const { register } = useFormContext<SituationDrawerFormData>();

  const [playingLineIndex, setPlayingLineIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeupdateListenerRef = useRef<(() => void) | null>(null);

  // Pause audio and clean up listener on unmount (tab switch or drawer close).
  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        if (timeupdateListenerRef.current) {
          audio.removeEventListener('timeupdate', timeupdateListenerRef.current);
          timeupdateListenerRef.current = null;
        }
      }
    };
  }, []);

  function playLine(lineIndex: number, line: DialogLine) {
    const audio = audioRef.current;
    if (!audio || line.start_time_ms == null || line.end_time_ms == null) return;

    // Clicking the currently playing line → pause and clear.
    if (playingLineIndex === lineIndex) {
      audio.pause();
      if (timeupdateListenerRef.current) {
        audio.removeEventListener('timeupdate', timeupdateListenerRef.current);
        timeupdateListenerRef.current = null;
      }
      setPlayingLineIndex(null);
      return;
    }

    // Cancel any prior listener before switching lines.
    if (timeupdateListenerRef.current) {
      audio.removeEventListener('timeupdate', timeupdateListenerRef.current);
      timeupdateListenerRef.current = null;
    }

    audio.currentTime = line.start_time_ms / 1000;
    const endSec = line.end_time_ms / 1000;

    const listener = () => {
      if (audio.currentTime >= endSec) {
        audio.pause();
        audio.removeEventListener('timeupdate', listener);
        timeupdateListenerRef.current = null;
        setPlayingLineIndex(null);
      }
    };

    timeupdateListenerRef.current = listener;
    audio.addEventListener('timeupdate', listener);
    audio.play().catch(() => {
      // AbortError on rapid toggles — ignore.
    });
    setPlayingLineIndex(lineIndex);
  }

  const dialog = situation.dialog;
  const speakers = dialog?.speakers ?? [];
  const lines = dialog?.lines ?? [];

  return (
    <TooltipProvider>
      <div data-testid="situation-drawer-tab-dialog-content" className="dlg-tab">
        {/* Hidden RHF input — retained for SIT-06 dirty-state tests. Do NOT remove. */}
        <input
          data-testid="scenario-en-input"
          aria-hidden="true"
          className="sr-only"
          {...register('scenario_en')}
        />

        {/* Single shared audio element (only when audio_url available) */}
        {dialog?.audio_url && (
          <audio
            ref={audioRef}
            src={dialog.audio_url}
            preload="metadata"
            data-testid="situation-drawer-dialog-audio"
            style={{ display: 'none' }}
          />
        )}

        {/* Lines list */}
        {lines.map((line, idx) => {
          const speaker = speakerByLine(line, speakers);
          const isLeft = (speaker?.speaker_index ?? 0) % 2 === 0;
          const isPlaying = playingLineIndex === idx;
          const hasTs = line.start_time_ms != null && line.end_time_ms != null;
          const canPlay = hasTs && !!dialog?.audio_url;

          return (
            <div
              key={line.id}
              className={`dlg-line ${isLeft ? 'is-left' : 'is-right'}`}
              data-testid={`dlg-line-${idx}`}
            >
              {/* Side rail: avatar + line number */}
              <div className="dlg-side">
                <div className={`dlg-avatar ${avatarToneFor(speaker?.speaker_index ?? 0)}`}>
                  {(speaker?.character_name ?? '?').charAt(0).toUpperCase()}
                </div>
                <span className="dlg-line-num">#{idx + 1}</span>
              </div>

              {/* Bubble */}
              <div className="dlg-bubble">
                <p lang="el" className="dlg-text">
                  {line.text}
                </p>

                <div className="dlg-bubble-foot">
                  {/* Play / Pause button */}
                  {canPlay ? (
                    <button
                      type="button"
                      className="icon-btn icon-btn-sm"
                      aria-label={
                        isPlaying
                          ? t('situations.drawer.dialog.pauseAria')
                          : t('situations.drawer.dialog.playAria')
                      }
                      onClick={() => playLine(idx, line)}
                      data-testid={`dlg-play-${idx}`}
                    >
                      {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-disabled="true"
                          className="icon-btn icon-btn-sm cursor-not-allowed opacity-60"
                          onClick={(e) => e.preventDefault()}
                          data-testid={`dlg-play-${idx}`}
                        >
                          <Play size={14} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {hasTs ? t('comingSoon') : t('situations.drawer.dialog.timestampsMissing')}
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Static waveform */}
                  <div className="dlg-wave">
                    {WAVE_BARS.map(({ i, height }) => (
                      <span key={i} className="audio-wave" style={{ height: `${height}px` }} />
                    ))}
                  </div>

                  {/* Duration */}
                  <span className="dlg-duration">
                    {formatLineDuration(line.start_time_ms, line.end_time_ms)}
                  </span>

                  {/* Regen — disabled, coming soon */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-disabled="true"
                        className="icon-btn icon-btn-sm cursor-not-allowed opacity-60"
                        aria-label={t('situations.drawer.dialog.regen')}
                        onClick={(e) => e.preventDefault()}
                      >
                        <RefreshCw size={14} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('comingSoon')}</TooltipContent>
                  </Tooltip>

                  {/* Edit — disabled, coming soon */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-disabled="true"
                        className="icon-btn icon-btn-sm cursor-not-allowed opacity-60"
                        aria-label={t('situations.drawer.dialog.edit')}
                        onClick={(e) => e.preventDefault()}
                      >
                        <Pencil size={14} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('comingSoon')}</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add line — disabled, coming soon */}
        <div className="dlg-add-row">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                aria-disabled="true"
                className="cursor-not-allowed opacity-60"
                onClick={(e) => e.preventDefault()}
                data-testid="dlg-add-line"
              >
                + {t('situations.drawer.dialog.addLine')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('comingSoon')}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
