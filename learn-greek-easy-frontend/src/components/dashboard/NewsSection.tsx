/**
 * NewsSection Component
 *
 * Displays the 3 most recent news items on the dashboard.
 * Features:
 * - Fetches news via adminAPI.getNewsItems()
 * - Shows loading skeleton while fetching
 * - Returns null if no items or on error (hides section gracefully)
 * - Responsive grid layout (1/2/3 columns)
 * - Cards with semi-transparent image backgrounds
 * - News content always displays in Greek (learning material)
 * - UI buttons follow user's language preference via i18n
 * - PostHog analytics tracking on click
 */

import React, { useEffect, useState } from 'react';

import { ExternalLink, HelpCircle, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  trackNewsArticleClicked,
  trackNewsQuestionsButtonClicked,
} from '@/lib/analytics/newsAnalytics';
import { reportAPIError } from '@/lib/errorReporting';
import { cn } from '@/lib/utils';
import { adminAPI, type NewsItemResponse } from '@/services/adminAPI';

/**
 * Individual news card component
 */
interface NewsCardProps {
  item: NewsItemResponse;
  newsLang: 'el' | 'en' | 'ru';
}

const NewsCard: React.FC<NewsCardProps> = ({ item, newsLang }) => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  const hasQuestion = item.card_id !== null && item.deck_id !== null;

  // Now all 3 languages are supported in backend
  const getLocalizedContent = () => {
    switch (newsLang) {
      case 'el':
        return { title: item.title_el, description: item.description_el };
      case 'ru':
        return { title: item.title_ru, description: item.description_ru };
      default: // 'en'
        return { title: item.title_en, description: item.description_en };
    }
  };

  const { title, description } = getLocalizedContent();

  const handleClick = () => {
    try {
      const domain = new URL(item.original_article_url).hostname;
      trackNewsArticleClicked({
        item_id: item.id,
        article_domain: domain,
      });
    } catch {
      // If URL parsing fails, still track but without domain
      trackNewsArticleClicked({
        item_id: item.id,
        article_domain: 'unknown',
      });
    }
  };

  const handleQuestionsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (item.deck_id) {
      trackNewsQuestionsButtonClicked({
        news_item_id: item.id,
        deck_id: item.deck_id,
      });
      navigate(`/culture/${item.deck_id}/practice`);
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-lg bg-card">
      {/* Clickable article link */}
      <a
        href={item.original_article_url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block h-48"
        onClick={handleClick}
        data-testid={`news-card-${item.id}`}
        aria-label={`${title} - ${t('dashboard.news.readMore')}`}
      >
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform group-hover:scale-105"
          style={{ backgroundImage: item.image_url ? `url(${item.image_url})` : undefined }}
        />

        {/* Semi-transparent Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />

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
        <div className="absolute bottom-0 left-0 right-0 z-20 flex gap-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-8">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  className="flex-1 border-white/50 bg-white/10 text-white hover:bg-white/20 disabled:border-white/30 disabled:text-white/50"
                  aria-label={t('dashboard.news.buttons.audioDisabled', 'Audio - Coming soon')}
                  data-testid={`news-audio-button-${item.id}`}
                >
                  <Volume2 className="mr-2 h-4 w-4" />
                  {t('dashboard.news.buttons.audio', 'Audio')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('dashboard.news.buttons.audioTooltip', 'Coming soon')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            variant="default"
            size="sm"
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleQuestionsClick}
            aria-label={t(
              'dashboard.news.buttons.questionsLabel',
              'Practice questions for this article'
            )}
            data-testid={`news-questions-button-${item.id}`}
          >
            <HelpCircle className="mr-2 h-4 w-4" />
            {t('dashboard.news.buttons.questions', 'Questions')}
          </Button>
        </div>
      )}
    </div>
  );
};

/**
 * Loading skeleton for news cards
 */
const NewsCardSkeleton: React.FC = () => (
  <div className="h-48 overflow-hidden rounded-lg">
    <Skeleton className="h-full w-full" />
  </div>
);

/**
 * Main NewsSection component
 */
export const NewsSection: React.FC = () => {
  const { t } = useTranslation('common');

  const [items, setItems] = useState<NewsItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // News content always displays in Greek - this is learning material
  const newsLang: 'el' | 'en' | 'ru' = 'el';

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true);
        setHasError(false);
        const response = await adminAPI.getNewsItems(1, 3);
        setItems(response.items);
      } catch (error) {
        reportAPIError(error, { operation: 'fetchNewsItems', endpoint: '/api/v1/news' });
        setHasError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  // Hide section on error
  if (hasError) {
    return null;
  }

  // Hide section if no items (after loading completes)
  if (!loading && items.length === 0) {
    return null;
  }

  return (
    <section data-testid="news-section">
      <h2 className="mb-4 text-lg font-semibold text-foreground">{t('dashboard.news.title')}</h2>
      {loading ? (
        <div
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          data-testid="news-section-loading"
        >
          {[1, 2, 3].map((i) => (
            <NewsCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <NewsCard key={item.id} item={item} newsLang={newsLang} />
          ))}
        </div>
      )}
    </section>
  );
};
