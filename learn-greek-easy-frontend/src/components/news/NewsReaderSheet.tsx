/**
 * NewsReaderSheet — in-app article reading panel (NEWS-07 Batch 3, NWSR-07)
 *
 * Right-side slide-over panel built on the Sheet (Radix Dialog) primitive.
 * ESC-close, scrim-click-close, and focus management come from Radix for free.
 * No custom @keyframes — uses the Sheet primitive's built-in slide/scrim animation.
 *
 * Audio variant note: uses `variant="news-mini"` (primary accent) rather than
 * the "culture" variant (practice-accent). The design §4 says "practice-accent"
 * but crossing into the Practice-palette violates the three-palettes rule in
 * CLAUDE.md. Flagged for follow-up. Scrub and speed controls are fully enabled
 * (this is the full player, not compact).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { ArrowLeft, ExternalLink, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { WaveformPlayer } from '@/components/culture/WaveformPlayer';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent } from '@/components/ui/sheet';
import { tDynamic } from '@/i18n/tDynamic';
import { track } from '@/lib/analytics';
import { buildSrcSet, recoverDerivativeError } from '@/lib/imageVariants';
import { clearActivePlayer, registerActivePlayer } from '@/lib/newsAudioCoordinator';
import { cn } from '@/lib/utils';
import type { NewsCountry, NewsItemResponse } from '@/services/adminAPI';
import type { NewsLevel } from '@/utils/newsLevel';

import { COUNTRY_CONFIG } from './countryConfig';
import { pickNewsThumb } from '../admin/news/newsThumbs';

export interface NewsReaderSheetProps {
  article: NewsItemResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  level: NewsLevel;
  onLevelChange: (level: NewsLevel) => void;
}

export const NewsReaderSheet: React.FC<NewsReaderSheetProps> = ({
  article,
  open,
  onOpenChange,
  level,
  onLevelChange,
}) => {
  const { t } = useTranslation('common');

  // Whether to use A2 content for this article (requires both level=a2 AND content exists)
  const useA2Content = level === 'a2' && (article?.has_a2_content ?? false);

  const audioUrl = useA2Content ? article?.audio_a2_url : article?.audio_url;
  const audioDuration = useA2Content
    ? article?.audio_a2_duration_seconds
    : article?.audio_duration_seconds;
  const hasAudio = !!audioUrl;

  // resetKey forces WaveformPlayer remount when level or article changes
  const [resetKey, setResetKey] = useState(0);
  const stopFn = useCallback(() => {
    setResetKey((k) => k + 1);
  }, []);
  const stopFnRef = useRef(stopFn);
  stopFnRef.current = stopFn;

  // Reset player when article or level changes to avoid stale audio
  useEffect(() => {
    setResetKey((k) => k + 1);
  }, [article?.id, level]);

  // Clear coordinator on unmount
  useEffect(() => {
    return () => {
      clearActivePlayer(stopFnRef.current);
    };
  }, []);

  // Stop audio when the sheet closes or the component unmounts (e.g. route change)
  useEffect(() => {
    if (!open) {
      stopFnRef.current();
      clearActivePlayer(stopFnRef.current);
    }
    return () => {
      stopFnRef.current();
      clearActivePlayer(stopFnRef.current);
    };
  }, [open]);

  const handlePlay = useCallback(
    (duration: number) => {
      if (!article) return;
      registerActivePlayer(stopFnRef.current);
      track('news_audio_play_started', {
        news_item_id: article.id,
        audio_duration_seconds: duration,
        page: 'news_reader',
        playback_speed: 1,
        level: level ?? 'b1',
      });
    },
    [article, level]
  );

  const handlePause = useCallback(
    (currentTime: number) => {
      if (!article) return;
      track('news_audio_play_paused', {
        news_item_id: article.id,
        paused_at_seconds: currentTime,
        audio_duration_seconds: 0,
        page: 'news_reader',
        level: level ?? 'b1',
      });
    },
    [article, level]
  );

  const handleComplete = useCallback(
    (duration: number) => {
      if (!article) return;
      clearActivePlayer(stopFnRef.current);
      track('news_audio_play_completed', {
        news_item_id: article.id,
        audio_duration_seconds: duration,
        page: 'news_reader',
        level: level ?? 'b1',
      });
    },
    [article, level]
  );

  /** Handle the level segment switch — delegates entirely to the page-level handler
   * which already persists and tracks. Do NOT call setPersistedNewsLevel here to
   * avoid a double-write / stale-closure race. */
  const handleSegmentLevel = useCallback(
    (newLevel: NewsLevel) => {
      onLevelChange(newLevel);
    },
    [onLevelChange]
  );

  /** Open the external article. Fires news_article_clicked (outbound). */
  const handleOpenOriginal = useCallback(() => {
    if (!article) return;
    try {
      const domain = new URL(article.original_article_url).hostname;
      track('news_article_clicked', {
        item_id: article.id,
        article_domain: domain,
        level: level ?? 'b1',
      });
    } catch {
      track('news_article_clicked', {
        item_id: article.id,
        article_domain: 'unknown',
        level: level ?? 'b1',
      });
    }
    window.open(article.original_article_url, '_blank', 'noopener,noreferrer');
  }, [article, level]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  // Source hostname stripped of www.
  let sourceHostname = '';
  if (article) {
    try {
      sourceHostname = new URL(article.original_article_url).hostname.replace(/^www\./, '');
    } catch {
      // ignore
    }
  }

  // Publication date formatted
  const formattedDate = article?.publication_date
    ? new Date(article.publication_date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  // Body text respects level
  const bodyText = useA2Content
    ? (article?.description_el_a2 ?? article?.description_el ?? '')
    : (article?.description_el ?? '');

  const title = useA2Content
    ? (article?.title_el_a2 ?? article?.title_el ?? '')
    : (article?.title_el ?? '');

  const thumbGradient = article ? pickNewsThumb(article.id) : undefined;

  // Whether A2 variant is available for the current article
  const a2Available = article?.has_a2_content ?? false;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        // Override default padding (p-6) + width (sm:max-w-sm) + hide the built-in X button
        // The built-in X (SheetPrimitive.Close) is rendered as the first child button;
        // we replace it with our own sticky-header close button.
        className={cn(
          'flex flex-col p-0',
          'w-full sm:max-w-[560px]',
          'bg-card',
          // Hide the auto-rendered Radix close button — we provide our own in the sticky header
          '[&>button:first-child]:hidden'
        )}
        // Suppress VisuallyHidden title warning — we provide our own heading in the body
        aria-label={title || t('news.page.title')}
      >
        {/* ── Sticky header ───────────────────────────────────────────── */}
        <div
          className={cn(
            'sticky top-0 z-20 flex items-center justify-between',
            'border-b border-line bg-card/95 backdrop-blur-sm',
            'px-4 py-3'
          )}
        >
          {/* Back button */}
          <button
            type="button"
            aria-label={t('news.reader.back', 'Back to news')}
            onClick={close}
            className={cn(
              'flex items-center gap-1.5',
              'rounded-[9px] px-2.5 py-1.5',
              'text-[13px] font-medium text-fg2',
              'transition-colors duration-150',
              'hover:bg-bg-2 hover:text-fg',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
            )}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t('news.reader.back', 'Back to news')}
          </button>

          {/* Close (×) button — wraps SheetClose for Radix integration */}
          <SheetClose asChild>
            <button
              type="button"
              aria-label="Close"
              className={cn(
                'flex h-8 w-8 items-center justify-center',
                'rounded-[9px] border border-line',
                'bg-card text-fg3',
                'transition-colors duration-150',
                'hover:bg-bg-2 hover:text-fg',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1'
              )}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </SheetClose>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {article && (
            <>
              {/* ── Hero band ─────────────────────────────────────────── */}
              <div
                className="relative h-[200px] overflow-hidden"
                style={!article.image_url ? { backgroundImage: thumbGradient } : undefined}
              >
                {article.image_url && (
                  <img
                    src={article.image_url}
                    srcSet={buildSrcSet(article.image_variants)}
                    sizes="560px"
                    alt=""
                    aria-hidden="true"
                    width={560}
                    height={200}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="eager"
                    onError={recoverDerivativeError}
                  />
                )}

                {/* Country badge */}
                {article.country && COUNTRY_CONFIG[article.country as NewsCountry] && (
                  <span className="badge b-blue on-photo absolute left-3 top-3 z-10">
                    {COUNTRY_CONFIG[article.country as NewsCountry].flag}{' '}
                    {tDynamic(t, COUNTRY_CONFIG[article.country as NewsCountry].labelKey)}
                  </span>
                )}
              </div>

              {/* ── Body ──────────────────────────────────────────────── */}
              <div className="flex flex-col gap-[18px] px-[26px] py-6">
                {/* Meta row: level segment + date */}
                <div className="flex items-center justify-between gap-3">
                  {/* A2/B1 segment with level hints */}
                  <div
                    className={cn(
                      'flex items-center rounded-full border border-line bg-bg-2 p-[3px]'
                    )}
                    role="group"
                    aria-label={t('news.level.label', 'Content level')}
                  >
                    {/* A2 button */}
                    <button
                      type="button"
                      aria-pressed={level === 'a2'}
                      disabled={!a2Available}
                      onClick={() => handleSegmentLevel('a2')}
                      className={cn(
                        'rounded-full px-3 py-1 font-mono text-[12.5px] font-semibold',
                        'transition-all duration-150',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                        level === 'a2' && a2Available
                          ? 'bg-card text-primary shadow-1 ring-1 ring-line'
                          : 'text-fg3',
                        !a2Available && 'cursor-not-allowed opacity-40'
                      )}
                    >
                      {t('news.level.a2', 'A2')}{' '}
                      <span className="font-sans font-normal">
                        · {t('news.level.hint.a2', 'Easier')}
                      </span>
                    </button>

                    {/* B1 button */}
                    <button
                      type="button"
                      aria-pressed={level === 'b1'}
                      onClick={() => handleSegmentLevel('b1')}
                      className={cn(
                        'rounded-full px-3 py-1 font-mono text-[12.5px] font-semibold',
                        'transition-all duration-150',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                        level === 'b1'
                          ? 'bg-card text-primary shadow-1 ring-1 ring-line'
                          : 'text-fg3'
                      )}
                    >
                      {t('news.level.b1', 'B1')}{' '}
                      <span className="font-sans font-normal">
                        · {t('news.level.hint.b1', 'Harder')}
                      </span>
                    </button>
                  </div>

                  {/* Publication date */}
                  {formattedDate && (
                    <span className="flex-shrink-0 font-mono text-[12.5px] text-fg3">
                      {formattedDate}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h2 lang="el" className="font-display text-[25px] font-bold leading-[1.28] text-fg">
                  {title}
                </h2>

                {/* Audio player (full — scrub enabled, 3 speeds) */}
                {hasAudio && (
                  <WaveformPlayer
                    key={`reader-${resetKey}-${level}-${article.id}`}
                    variant="news-mini"
                    audioUrl={audioUrl ?? undefined}
                    duration={audioDuration ?? undefined}
                    barCount={44}
                    showSpeedControl
                    disabled={!audioUrl}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onComplete={handleComplete}
                  />
                )}

                {/* Body text — Noto Serif (font-serif), full un-clamped paragraph */}
                <div lang="el" className="font-serif text-[17px] leading-[1.72] text-fg2">
                  {bodyText}
                </div>

                {/* Primary CTA — "Open original" */}
                <Button
                  onClick={handleOpenOriginal}
                  className="w-full gap-2"
                  aria-label={t('news.reader.openOriginal', 'Open original')}
                >
                  {t('news.reader.openOriginal', 'Open original')}
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </Button>

                {/* Source line */}
                {sourceHostname && <p className="text-[12.5px] text-fg3">{sourceHostname}</p>}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
