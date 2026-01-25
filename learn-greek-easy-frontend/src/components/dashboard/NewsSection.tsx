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
 * - Language-aware content (el/en/ru - all 3 languages supported)
 * - PostHog analytics tracking on click
 */

import React, { useEffect, useState } from 'react';

import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/hooks/useLanguage';
import { trackNewsArticleClicked } from '@/lib/analytics/newsAnalytics';
import { reportAPIError } from '@/lib/errorReporting';
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

  return (
    <a
      href={item.original_article_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block h-48 overflow-hidden rounded-lg"
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
      <div className="relative z-10 flex h-full flex-col justify-end p-4">
        <h3 className="mb-1 line-clamp-2 text-lg font-semibold text-white">{title}</h3>
        <p className="line-clamp-2 text-sm text-gray-200">{description}</p>
        <ExternalLink className="absolute right-3 top-3 h-4 w-4 text-white/70 group-hover:text-white" />
      </div>
    </a>
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
  const { currentLanguage } = useLanguage();

  const [items, setItems] = useState<NewsItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // All 3 languages are now supported in backend
  const newsLang: 'el' | 'en' | 'ru' = (
    ['el', 'en', 'ru'].includes(currentLanguage) ? currentLanguage : 'en'
  ) as 'el' | 'en' | 'ru';

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
