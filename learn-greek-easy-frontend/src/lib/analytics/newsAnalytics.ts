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

/**
 * Properties for tracking news questions button clicks
 */
export interface NewsQuestionsButtonClickedProperties {
  news_item_id: string;
  deck_id: string;
}

/**
 * Track when user clicks Questions button on a news card
 */
export function trackNewsQuestionsButtonClicked(
  properties: NewsQuestionsButtonClickedProperties
): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('news_questions_button_clicked', properties);
  }
}

/**
 * Properties for tracking source article link clicks from question feedback
 */
export interface NewsSourceLinkClickedProperties {
  /** UUID of the culture question card */
  card_id: string;
  /** Domain of the source article (e.g., "ekathimerini.com") */
  article_domain: string;
}

/**
 * Track when user clicks source article link in question feedback
 */
export function trackNewsSourceLinkClicked(properties: NewsSourceLinkClickedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('news_source_link_clicked', properties);
  }
}

// =============================================================================
// News Page Analytics (for dedicated /news page)
// =============================================================================

/**
 * Properties for tracking when user views the News page
 */
export interface NewsPageViewedProperties {
  /** Total number of articles available */
  total_articles: number;
}

/**
 * Properties for tracking pagination on the News page
 */
export interface NewsPagePaginatedProperties {
  /** Page number user navigated from (1-indexed) */
  from_page: number;
  /** Page number user navigated to (1-indexed) */
  to_page: number;
  /** Total number of pages available */
  total_pages: number;
}

/**
 * Properties for tracking article clicks on the News page
 */
export interface NewsPageArticleClickedProperties {
  /** UUID of the clicked article */
  article_id: string;
  /** Title of the clicked article */
  article_title: string;
  /** 0-indexed position in the grid */
  position: number;
}

/**
 * Properties for tracking questions button clicks on the News page
 */
export interface NewsPageQuestionsClickedProperties {
  /** UUID of the article */
  article_id: string;
  /** Whether the article has associated questions */
  has_questions: boolean;
}

/**
 * Track when user views the News page
 */
export function trackNewsPageViewed(properties: NewsPageViewedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('news_page_viewed', properties);
  }
}

/**
 * Track when user navigates between pages on the News page
 */
export function trackNewsPagePaginated(properties: NewsPagePaginatedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('news_page_paginated', properties);
  }
}

/**
 * Track when user clicks on an article on the News page
 */
export function trackNewsPageArticleClicked(properties: NewsPageArticleClickedProperties): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('news_page_article_clicked', properties);
  }
}

/**
 * Track when user clicks the Questions button on the News page
 */
export function trackNewsPageQuestionsClicked(
  properties: NewsPageQuestionsClickedProperties
): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('news_page_questions_clicked', properties);
  }
}

/**
 * Track when user clicks "See All News" link from dashboard
 */
export function trackNewsPageSeeAllClicked(): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture('news_page_see_all_clicked');
  }
}
