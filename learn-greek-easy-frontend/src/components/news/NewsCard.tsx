/**
 * NewsCard Component — two-zone overlay design (NEWS-07 Batch 2, NWSR-01/02)
 *
 * Zone A: Photo block with bottom scrim, country badge, external-link button,
 *         level chips (A2/B1), and Greek headline.
 * Zone B: Solid body with description, compact audio player, source/date footer.
 *
 * The card renders in two modes based on whether `onOpen` is provided:
 *
 *   Reader mode  (onOpen provided)  — used on /news page.
 *     Root is <article role="button">. Card click opens the in-app reader sheet.
 *     External-link button (top-right) is interactive: stops propagation + window.open.
 *
 *   Link mode    (!onOpen)          — used on the dashboard.
 *     Root is <a href target="_blank" rel>. Native anchor navigation to the source article.
 *     External-link icon (top-right) is DECORATIVE only (aria-hidden, pointer-events-none)
 *     to preserve the visual without creating a nested interactive element.
 *     Audio player container calls stopPropagation+preventDefault so play/pause clicks
 *     do not trigger anchor navigation.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { WaveformPlayer } from '@/components/culture/WaveformPlayer';
import { tDynamic } from '@/i18n/tDynamic';
import { track } from '@/lib/analytics';
import { buildSrcSet, recoverDerivativeError } from '@/lib/imageVariants';
import { clearActivePlayer, registerActivePlayer } from '@/lib/newsAudioCoordinator';
import { cn } from '@/lib/utils';
import type { NewsCountry, NewsItemResponse } from '@/services/adminAPI';
import { formatPublicationDate, safeExternalHref } from '@/utils/newsFormat';
import type { NewsLevel } from '@/utils/newsLevel';

import { COUNTRY_CONFIG } from './countryConfig';
import { pickNewsThumb } from '../admin/news/newsThumbs';

export type NewsCardHeight = 'default' | 'tall';

export interface NewsCardProps {
  article: NewsItemResponse;
  newsLang: 'el' | 'en' | 'ru';
  height?: NewsCardHeight;
  page?: 'dashboard' | 'news';
  level?: NewsLevel;
  variant?: 'compact' | 'full';
  eager?: boolean;
  /** Called when the user activates the card body, or — with `{ autoplay: true }` — the
   *  card's Play button. Wires into the slide-over reader (autoplay opens + starts playback there). */
  onOpen?: (article: NewsItemResponse, opts?: { autoplay?: boolean }) => void;
}

export const NewsCard: React.FC<NewsCardProps> = ({
  article,
  newsLang: _newsLang,
  height: _height = 'default',
  page,
  level = 'b1',
  variant = 'full',
  eager,
  onOpen,
}) => {
  const { t, i18n } = useTranslation('common');

  const useA2Content = level === 'a2' && article.has_a2_content;
  const audioUrl = useA2Content ? article.audio_a2_url : article.audio_url;
  const audioDuration = useA2Content
    ? article.audio_a2_duration_seconds
    : article.audio_duration_seconds;
  const hasAudio = !!audioUrl;

  const [resetKey, setResetKey] = useState(0);
  const [showError, setShowError] = useState(false);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stopFn = useCallback(() => {
    setResetKey((k) => k + 1);
  }, []);
  const stopFnRef = useRef(stopFn);
  stopFnRef.current = stopFn;

  const pageName = page ?? (window.location.pathname === '/news' ? 'news' : 'dashboard');

  const handlePlay = useCallback(
    (duration: number) => {
      registerActivePlayer(stopFnRef.current);
      track('news_audio_play_started', {
        news_item_id: article.id,
        audio_duration_seconds: duration,
        page: pageName,
        playback_speed: 1,
        level: level ?? 'b1',
      });
    },
    [article.id, pageName, level]
  );

  const handlePause = useCallback(
    (currentTime: number) => {
      track('news_audio_play_paused', {
        news_item_id: article.id,
        paused_at_seconds: currentTime,
        audio_duration_seconds: 0,
        page: pageName,
        level: level ?? 'b1',
      });
    },
    [article.id, pageName, level]
  );

  const handleComplete = useCallback(
    (duration: number) => {
      clearActivePlayer(stopFnRef.current);
      track('news_audio_play_completed', {
        news_item_id: article.id,
        audio_duration_seconds: duration,
        page: pageName,
        level: level ?? 'b1',
      });
    },
    [article.id, pageName, level]
  );

  const handleError = useCallback(() => {
    clearActivePlayer(stopFnRef.current);
    setShowError(true);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => {
      setShowError(false);
      setResetKey((k) => k + 1);
    }, 1500);
  }, [article.id, pageName, level]);

  useEffect(() => {
    return () => {
      clearActivePlayer(stopFnRef.current);
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, []);

  const title = useA2Content ? (article.title_el_a2 ?? article.title_el) : article.title_el;
  const description = useA2Content
    ? (article.description_el_a2 ?? article.description_el)
    : article.description_el;

  /** Fire the analytics event for an outbound click. */
  const fireClickedAnalytics = useCallback(() => {
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
  }, [article.id, article.original_article_url, level]);

  /**
   * Reader mode only: external-link button handler.
   * Stops propagation (so card's onOpen doesn't also fire) and opens URL in new tab.
   * Only opens if the URL has an http/https scheme (XSS guard).
   */
  const openExternal = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      fireClickedAnalytics();
      const safeHref = safeExternalHref(article.original_article_url);
      if (safeHref) {
        window.open(safeHref, '_blank', 'noopener,noreferrer');
      }
    },
    [article.original_article_url, fireClickedAnalytics]
  );

  /**
   * Reader mode only: card body click handler.
   *
   * NOTE: `news_article_clicked` is intentionally NOT fired here — that event is
   * reserved for actual outbound link clicks (external-link button on the card and
   * "Open original" CTA in the reader). The reader-open action fires
   * `news_article_opened` from NewsPage's onOpen handler.
   */
  const handleCardActivate = useCallback(() => {
    if (onOpen) {
      onOpen(article);
    }
  }, [onOpen, article]);

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCardActivate();
      }
    },
    [handleCardActivate]
  );

  /**
   * Link mode only: handler for the audio player container div.
   * Prevents clicks on the WaveformPlayer (play/pause/scrub) from bubbling to the
   * parent <a> anchor, which would otherwise trigger navigation.
   */
  const handlePlayerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  }, []);

  // Source hostname for footer
  let sourceHostname = '';
  try {
    sourceHostname = new URL(article.original_article_url).hostname.replace(/^www\./, '');
  } catch {
    // ignore
  }

  // Publication date formatted — UTC-safe helper avoids day-shift in negative-UTC-offset locales.
  const formattedDate = formatPublicationDate(
    article.publication_date,
    i18n.language.split('-')[0]
  );

  // Gradient fallback when no image
  const thumbGradient = pickNewsThumb(article.id);

  // ── Shared inner content (same for both modes) ──────────────────────────
  const cardInner = (
    <>
      {/* ── Zone A: Photo block ───────────────────────────────────────── */}
      <div
        className="relative aspect-[16/11] overflow-hidden rounded-t-[var(--radius-lg)]"
        style={!article.image_url ? { backgroundImage: thumbGradient } : undefined}
      >
        {/* Real image — keep srcSet/eager logic intact (PERF-10, srcset/eager tests depend on this) */}
        {article.image_url && (
          <img
            src={article.image_url}
            srcSet={buildSrcSet(article.image_variants)}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
            alt=""
            aria-hidden="true"
            width={800}
            height={450}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            loading={eager ? 'eager' : 'lazy'}
            fetchPriority={eager ? 'high' : undefined}
            onError={recoverDerivativeError}
          />
        )}

        {/* Bottom scrim — 2-stop dark-navy gradient matching CD spec */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,hsl(222_47%_8%/0.78)_100%)]" />

        {/* Country badge — top-left, on-photo modifier */}
        {article.country && COUNTRY_CONFIG[article.country as NewsCountry] && (
          <span className="badge b-blue on-photo absolute left-2 top-2 z-10">
            {COUNTRY_CONFIG[article.country as NewsCountry].flag}{' '}
            {tDynamic(t, COUNTRY_CONFIG[article.country as NewsCountry].labelKey)}
          </span>
        )}

        {/*
         * External-link affordance — top-right, above the photo.
         *
         * Reader mode: interactive <button> that stops propagation and opens the source URL.
         * Link mode:   decorative <span> (aria-hidden, pointer-events-none) — the whole card
         *              is already the link, so no nested interactive element is needed.
         */}
        {onOpen ? (
          <button
            type="button"
            aria-label={t('dashboard.news.readMore')}
            onClick={openExternal}
            className={cn(
              'absolute right-2 top-2 z-10',
              'flex h-[30px] w-[30px] items-center justify-center',
              'rounded-[9px] border border-line',
              'bg-card/80 text-fg2 backdrop-blur-sm',
              'transition-all duration-150',
              'hover:-translate-y-px hover:text-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1'
            )}
          >
            <ExternalLink className="h-[14px] w-[14px]" aria-hidden="true" />
          </button>
        ) : (
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute right-2 top-2 z-10',
              'flex h-[30px] w-[30px] items-center justify-center',
              'rounded-[9px] border border-line',
              'bg-card/80 text-fg2 backdrop-blur-sm'
            )}
          >
            <ExternalLink className="h-[14px] w-[14px]" />
          </span>
        )}

        {/* Over-photo bottom text: level chips + Greek title */}
        <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col gap-[9px] p-4">
          {/* Level chips — non-interactive display (M1 decision: reader controls level, not card) */}
          <div className="flex items-center gap-[6px]">
            <span
              className={cn(
                'font-mono text-[11px] font-bold leading-none tracking-[0.04em]',
                'rounded-[6px] px-[7px] py-[2px]',
                level === 'a2'
                  ? 'border border-transparent bg-white/[0.92] text-primary'
                  : 'border border-white/[0.24] bg-white/[0.16] text-white/[0.82]'
              )}
            >
              {t('news.level.a2')}
            </span>
            <span
              className={cn(
                'font-mono text-[11px] font-bold leading-none tracking-[0.04em]',
                'rounded-[6px] px-[7px] py-[2px]',
                level === 'b1'
                  ? 'border border-transparent bg-white/[0.92] text-primary'
                  : 'border border-white/[0.24] bg-white/[0.16] text-white/[0.82]'
              )}
            >
              {t('news.level.b1')}
            </span>
          </div>

          {/* Greek title — Inter Tight (font-display), 3-line reserved height, bottom-aligned */}
          <h3
            lang="el"
            className={cn(
              'flex min-h-[calc(1.28em*3)] items-end',
              'font-display text-[17px] font-semibold leading-[1.28]',
              'line-clamp-3 tracking-[-0.01em] text-white'
            )}
          >
            {title}
          </h3>
        </div>
      </div>

      {/* ── Zone B: Solid body ────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-[11px] px-4 pb-[15px] pt-3">
        {/* Description — current level's Greek body text, 3-line reserved height.
            Hidden in compact variant (dashboard usage). */}
        {variant !== 'compact' && (
          <p
            lang="el"
            className={cn(
              'min-h-[calc(1.5em*3)] font-sans text-[13.5px] leading-[1.5]',
              'line-clamp-3 text-fg2'
            )}
          >
            {description}
          </p>
        )}

        {/* Compact audio player — no speed pills on card (design spec §3 "Speeds non-compact only").
            In link mode, wrap in a div that stops propagation so play/pause clicks do not
            navigate the parent <a>. In reader mode, the card is not an anchor so no guard needed. */}
        {hasAudio && (
          <div
            className={cn('relative transition-opacity duration-300', showError && 'opacity-60')}
            {...(!onOpen ? { onClick: handlePlayerClick } : {})}
          >
            {showError && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <span className="text-xs text-danger" aria-live="polite">
                  {t('dashboard.news.buttons.audioError')}
                </span>
              </div>
            )}
            <WaveformPlayer
              key={`${resetKey}-${level}`}
              variant="news-mini"
              audioUrl={audioUrl ?? undefined}
              duration={audioDuration ?? undefined}
              barCount={20}
              disableScrub
              showSpeedControl={false}
              disabled={!audioUrl}
              // Reader mode: the Play button opens the reader and autoplays there
              // (single click), instead of playing this on-card mini-player.
              onPlayIntent={onOpen ? () => onOpen(article, { autoplay: true }) : undefined}
              onPlay={handlePlay}
              onPause={handlePause}
              onComplete={handleComplete}
              onError={handleError}
            />
          </div>
        )}

        {/* Footer — source hostname ↔ formatted publication date */}
        <div className="mt-auto flex items-center justify-between gap-2.5 pt-1">
          <span className="truncate font-mono text-[11.5px] text-fg3">{sourceHostname}</span>
          <span className="flex-shrink-0 font-mono text-[12px] text-fg3">{formattedDate}</span>
        </div>
      </div>
    </>
  );

  // Shared className for the card root element (same in both modes)
  const cardClassName = cn(
    'group flex cursor-pointer flex-col overflow-hidden rounded-[var(--radius-lg)]',
    'border border-line bg-card shadow-1',
    'transition-all duration-200',
    'hover:-translate-y-[3px] hover:border-line-2 hover:shadow-2',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
  );

  // ── Link mode (dashboard, no reader wired): root is a native anchor ──────
  if (!onOpen) {
    const safeHref = safeExternalHref(article.original_article_url);
    // Only render a navigable anchor when the URL scheme is http/https.
    // Unsafe or unparseable URLs fall back to a non-navigating div so nothing
    // dangerous is clickable (XSS guard for admin-supplied URLs).
    if (safeHref) {
      return (
        <a
          data-testid={`news-card-${article.id}`}
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={title ?? ''}
          className={cardClassName}
          onClick={fireClickedAnalytics}
        >
          {cardInner}
        </a>
      );
    }
    return (
      <div
        data-testid={`news-card-${article.id}`}
        aria-label={title ?? ''}
        className={cardClassName}
      >
        {cardInner}
      </div>
    );
  }

  // ── Reader mode (/news page, onOpen provided): root is an article button ─
  return (
    <article
      data-testid={`news-card-${article.id}`}
      role="button"
      tabIndex={0}
      aria-label={title ?? ''}
      className={cardClassName}
      onClick={handleCardActivate}
      onKeyDown={handleCardKeyDown}
    >
      {cardInner}
    </article>
  );
};
