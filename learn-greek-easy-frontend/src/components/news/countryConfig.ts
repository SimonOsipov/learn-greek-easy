/**
 * Country configuration for news items.
 * Shared constant for flag emojis and i18n label keys.
 */

import type { NewsCountry } from '@/services/adminAPI';

export const COUNTRY_CONFIG: Record<NewsCountry, { flag: string; labelKey: string }> = {
  cyprus: { flag: '🇨🇾', labelKey: 'news.country.cyprus' },
  greece: { flag: '🇬🇷', labelKey: 'news.country.greece' },
  world: { flag: '🌍', labelKey: 'news.country.world' },
};
