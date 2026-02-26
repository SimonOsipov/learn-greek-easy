/**
 * NewsCard Component
 *
 * Reusable news card component that displays a news article with:
 * - Background image with gradient overlay
 * - Localized title and description
 * - Optional audio and questions action buttons
 * - Configurable height for different layouts
 * - PostHog analytics tracking
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { ExternalLink, HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { WaveformPlayer } from '@/components/culture/WaveformPlayer';
import { Button } from '@/components/ui/button';
import {
  trackNewsArticleClicked,
  trackNewsAudioError,
  trackNewsAudioPlayCompleted,
  trackNewsAudioPlayPaused,
  trackNewsAudioPlayStarted,
  trackNewsQuestionsButtonClicked,
} from '@/lib/analytics/newsAnalytics';
import { clearActivePlayer, registerActivePlayer } from '@/lib/newsAudioCoordinator';
import { cn } from '@/lib/utils';
import type { NewsCountry, NewsItemResponse } from '@/services/adminAPI';

import { COUNTRY_CONFIG } from './countryConfig';

export type NewsCardHeight = 'default' | 'tall';

export interface NewsCardProps {
  article: NewsItemResponse;
  newsLang: 'el' | 'en' | 'ru';
  height?: NewsCardHeight;
  page?: 'dashboard' | 'news';
}

const heightClasses: Record<NewsCardHeight, string> = {
  default: 'h-48',
  tall: 'h-[300px]',
};

export const NewsCard: React.FC<NewsCardProps> = ({
  article,
  newsLang,
  height = 'default',
  page,
}) => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  const hasQuestion = article.card_id !== null && article.deck_id !== null;

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
      });
    },
    [article.id, pageName]
  );

  const handlePause = useCallback(
    (currentTime: number) => {
      trackNewsAudioPlayPaused({
        news_item_id: article.id,
        paused_at_seconds: currentTime,
        audio_duration_seconds: 0, // Duration not available in onPause callback
        page: pageName,
      });
    },
    [article.id, pageName]
  );

  const handleComplete = useCallback(
    (duration: number) => {
      clearActivePlayer(stopFnRef.current);
      trackNewsAudioPlayCompleted({
        news_item_id: article.id,
        audio_duration_seconds: duration,
        page: pageName,
      });
    },
    [article.id, pageName]
  );

  const handleError = useCallback(() => {
    clearActivePlayer(stopFnRef.current);
    trackNewsAudioError({
      news_item_id: article.id,
      error_type: 'load_failed',
      page: pageName,
    });

    setShowError(true);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => {
      setShowError(false);
      setResetKey((k) => k + 1);
    }, 1500);
  }, [article.id, pageName]);

  useEffect(() => {
    return () => {
      clearActivePlayer(stopFnRef.current);
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, []);

  // Now all 3 languages are supported in backend
  const getLocalizedContent = () => {
    switch (newsLang) {
      case 'el':
        return { title: article.title_el, description: article.description_el };
      case 'ru':
        return { title: article.title_ru, description: article.description_ru };
      default: // 'en'
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
      });
    } catch {
      // If URL parsing fails, still track but without domain
      trackNewsArticleClicked({
        item_id: article.id,
        article_domain: 'unknown',
      });
    }
  };

  const handleQuestionsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (article.deck_id) {
      trackNewsQuestionsButtonClicked({
        news_item_id: article.id,
        deck_id: article.deck_id,
      });
      navigate(`/culture/${article.deck_id}/practice`);
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />

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
            hasQuestion && 'pb-16'
          )}
        >
          <h3 className="mb-1 line-clamp-2 text-lg font-semibold text-white">{title}</h3>
          <p className="line-clamp-2 text-sm text-gray-200">{description}</p>
          <ExternalLink className="absolute right-3 top-3 h-4 w-4 text-white/70 group-hover:text-white" />
        </div>
      </a>

      {/* Action Buttons - only show if news has associated question */}
      {hasQuestion && (
        <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col gap-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-8 sm:flex-row sm:items-stretch">
          <div
            className={cn(
              'relative min-w-0 flex-[1.7] transition-opacity duration-300',
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
              key={resetKey}
              variant="news-mini"
              audioUrl={article.audio_url ?? undefined}
              barCount={20}
              showSpeedControl={false}
              disableScrub
              disabled={!article.audio_url}
              onPlay={handlePlay}
              onPause={handlePause}
              onComplete={handleComplete}
              onError={handleError}
            />
          </div>

          <Button
            variant="default"
            size="sm"
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 sm:h-auto"
            onClick={handleQuestionsClick}
            aria-label={t(
              'dashboard.news.buttons.questionsLabel',
              'Practice questions for this article'
            )}
            data-testid={`news-questions-button-${article.id}`}
          >
            <HelpCircle className="mr-2 h-4 w-4" />
            {t('dashboard.news.buttons.questions', 'Practice!')}
          </Button>
        </div>
      )}
    </div>
  );
};
