/**
 * News Analytics for PostHog Integration
 *
 * Provides analytics tracking for news-related events:
 * - Tracks news_article_clicked events when users click on news items
 */

import posthog from 'posthog-js';

/**
 * Properties for news article click tracking
 */
export interface NewsArticleClickedProperties {
  item_id: string;
  article_domain: string;
}

/**
 * Track when a user clicks on a news article.
 *
 * @param properties - The news article click properties
 */
export function trackNewsArticleClicked(properties: NewsArticleClickedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('news_article_clicked', properties);
  }
}
