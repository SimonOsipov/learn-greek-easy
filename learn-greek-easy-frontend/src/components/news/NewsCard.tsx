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
import {
  trackNewsArticleClicked,
  trackNewsAudioPlayCompleted,
  trackNewsAudioPlayPaused,
  trackNewsAudioPlayStarted,
} from '@/lib/analytics/newsAnalytics';
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
  newsLang,
  height = 'default',
  page,
  level = 'b2',
  variant = 'full',
}) => {
  const { t } = useTranslation('common');

  const useA2 = level === 'a2' && article.has_a2_content;
  const audioUrl = useA2 ? article.audio_a2_url : article.audio_url;
  const hasAudio = !!audioUrl;

  const [resetKey, setResetKey] = useState(0);
  const [showError, setShowError] = useState(false);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const stopFn = useCallback(() => {
    setResetKey((k) => k + 1);
  }, []);
  const stopFnRef = useRef(stopFn);
  stopFnRef.current = stopFn;

  const pageName = page ?? (window.location.pathname === '/news' ? 'news' : 'dashboard');

  const handlePlay = useCallback(
    (duration: number) => {
      registerActivePlayer(stopFnRef.current);
      trackNewsAudioPlayStarted({
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
      trackNewsAudioPlayPaused({
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
      trackNewsAudioPlayCompleted({
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

  // Now all 3 languages are supported in backend
  const getLocalizedContent = () => {
    if (newsLang === 'el') {
      return {
        title: useA2 ? (article.title_el_a2 ?? article.title_el) : article.title_el,
        description: useA2
          ? (article.description_el_a2 ?? article.description_el)
          : article.description_el,
      };
    }
    switch (newsLang) {
      case 'ru':
        return { title: article.title_ru, description: article.description_ru };
      default:
        return { title: article.title_en, description: article.description_en };
    }
  };

  const { title, description } = getLocalizedContent();

  const handleClick = () => {
    try {
      const domain = new URL(article.original_article_url).hostname;
      trackNewsArticleClicked({
        item_id: article.id,
        article_domain: domain,
        level: level ?? 'b2',
      });
    } catch {
      // If URL parsing fails, still track but without domain
      trackNewsArticleClicked({
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

        {/* Semi-transparent Overlay */}
        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-t',
            variant === 'compact'
              ? 'from-black/90 via-black/60 to-black/30'
              : 'from-black/80 via-black/50 to-black/30'
          )}
        />

        {/* Country Flag Pill */}
        {article.country && COUNTRY_CONFIG[article.country as NewsCountry] && (
          <span className="absolute left-2 top-2 z-10 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
            {COUNTRY_CONFIG[article.country as NewsCountry].flag}{' '}
            {t(COUNTRY_CONFIG[article.country as NewsCountry].labelKey)}
          </span>
        )}

        {/* Content */}
        <div
          className={cn(
            'relative z-10 flex h-full flex-col justify-end p-4',
            hasAudio && (variant === 'compact' ? 'pb-20' : 'pb-16')
          )}
        >
          <h3
            className={cn(
              'line-clamp-2 font-semibold text-white',
              variant === 'compact' ? 'text-sm' : 'mb-1 text-lg'
            )}
          >
            {title}
          </h3>
          {variant !== 'compact' && (
            <p className="line-clamp-2 text-sm text-gray-200">{description}</p>
          )}
          <ExternalLink className="absolute right-3 top-3 h-4 w-4 text-white/70 group-hover:text-white" />
        </div>
      </a>

      {/* Audio player overlay */}
      {hasAudio && (
        <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col gap-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-8 sm:flex-row sm:items-stretch">
          <div
            className={cn(
              'relative min-w-0 flex-1 transition-opacity duration-300',
              showError && 'opacity-60'
            )}
          >
            {showError && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <span className="text-xs text-red-300" aria-live="polite">
                  {t('dashboard.news.buttons.audioError')}
                </span>
              </div>
            )}
            <WaveformPlayer
              key={`${resetKey}-${level}`}
              variant="news-mini"
              audioUrl={audioUrl ?? undefined}
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
