/**
 * NewsCard Component
 *
 * Reusable news card component that displays a news article with:
 * - Background image with gradient overlay
 * - Localized title and description
 * - Optional audio player overlay
 * - Configurable height for different layouts
 * - PostHog analytics tracking
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { WaveformPlayer } from '@/components/culture/WaveformPlayer';
import { track } from '@/lib/analytics';
import { clearActivePlayer, registerActivePlayer } from '@/lib/newsAudioCoordinator';
import { cn } from '@/lib/utils';
import type { NewsCountry, NewsItemResponse } from '@/services/adminAPI';
import type { NewsLevel } from '@/utils/newsLevel';

import { COUNTRY_CONFIG } from './countryConfig';

export type NewsCardHeight = 'default' | 'tall';

export interface NewsCardProps {
  article: NewsItemResponse;
  newsLang: 'el' | 'en' | 'ru';
  height?: NewsCardHeight;
  page?: 'dashboard' | 'news';
  level?: NewsLevel;
  variant?: 'compact' | 'full';
}

const heightClasses: Record<NewsCardHeight, string> = {
  default: 'h-[211px]',
  tall: 'h-[300px]',
};

export const NewsCard: React.FC<NewsCardProps> = ({
  article,
  newsLang: _newsLang,
  height = 'default',
  page,
  level = 'b2',
  variant = 'full',
}) => {
  const { t } = useTranslation('common');

  const useA2 = level === 'a2' && article.has_a2_content;
  const audioUrl = useA2 ? article.audio_a2_url : article.audio_url;
  const audioDuration = useA2 ? article.audio_a2_duration_seconds : article.audio_duration_seconds;
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
        level: level ?? 'b2',
      });
    },
    [article.id, pageName, level]
  );

  const handlePause = useCallback(
    (currentTime: number) => {
      track('news_audio_play_paused', {
        news_item_id: article.id,
        paused_at_seconds: currentTime,
        audio_duration_seconds: 0, // Duration not available in onPause callback
        page: pageName,
        level: level ?? 'b2',
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
        level: level ?? 'b2',
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

  const getLocalizedContent = () => {
    return {
      title: useA2 ? (article.title_el_a2 ?? article.title_el) : article.title_el,
      description: useA2
        ? (article.description_el_a2 ?? article.description_el)
        : article.description_el,
    };
  };

  const { title, description } = getLocalizedContent();

  const handleClick = () => {
    try {
      const domain = new URL(article.original_article_url).hostname;
      track('news_article_clicked', {
        item_id: article.id,
        article_domain: domain,
        level: level ?? 'b2',
      });
    } catch {
      // If URL parsing fails, still track but without domain
      track('news_article_clicked', {
        item_id: article.id,
        article_domain: 'unknown',
        level: level ?? 'b2',
      });
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-lg bg-card">
      {/* Clickable article link */}
      <a
        href={article.original_article_url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn('relative block overflow-hidden', heightClasses[height])}
        onClick={handleClick}
        data-testid={`news-card-${article.id}`}
        aria-label={`${title} - ${t('dashboard.news.readMore')}`}
      >
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform group-hover:scale-105"
          style={{ backgroundImage: article.image_url ? `url(${article.image_url})` : undefined }}
        />

        {/* Photo overlay gradient — uses theme-invariant landing-header-bg per design doc. */}
        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-t',
            variant === 'compact'
              ? 'from-landing-header-bg/90 via-landing-header-bg/60 to-landing-header-bg/30'
              : 'from-landing-header-bg/80 via-landing-header-bg/50 to-landing-header-bg/30'
          )}
        />

        {/* Country Flag Pill — v2.4 badge system, on-photo modifier for readability over images. */}
        {article.country && COUNTRY_CONFIG[article.country as NewsCountry] && (
          <span className="badge b-blue on-photo absolute left-2 top-2 z-10">
            {COUNTRY_CONFIG[article.country as NewsCountry].flag}{' '}
            {t(COUNTRY_CONFIG[article.country as NewsCountry].labelKey)}
          </span>
        )}

        {/* Content */}
        <div
          className={cn('relative z-10 flex h-full flex-col justify-end p-4', hasAudio && 'pb-20')}
        >
          <h3
            className={cn(
              'line-clamp-2 font-serif font-semibold text-landing-header-fg',
              variant === 'compact' ? 'text-sm' : 'mb-1 text-lg'
            )}
          >
            {title}
          </h3>
          {variant !== 'compact' && (
            <p className="line-clamp-2 font-serif text-sm text-landing-header-fg/80">
              {description}
            </p>
          )}
          <ExternalLink className="absolute right-3 top-3 h-4 w-4 text-landing-header-fg/70 group-hover:text-landing-header-fg" />
        </div>
      </a>

      {/* Audio player overlay — landing-header-bg is theme-invariant for photo overlays. */}
      {hasAudio && (
        <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col gap-2 bg-gradient-to-t from-landing-header-bg/90 via-landing-header-bg/60 to-transparent p-3 pt-8 sm:flex-row sm:items-stretch">
          <div
            className={cn(
              'relative min-w-0 flex-1 transition-opacity duration-300',
              showError && 'opacity-60'
            )}
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
              disabled={!audioUrl}
              onPlay={handlePlay}
              onPause={handlePause}
              onComplete={handleComplete}
              onError={handleError}
            />
          </div>
        </div>
      )}
    </div>
  );
};
