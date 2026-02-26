/**
 * Country configuration for news items.
 * Shared constant for flag emojis and i18n label keys.
 */

import type { NewsCountry } from '@/services/adminAPI';

export const COUNTRY_CONFIG: Record<NewsCountry, { flag: string; labelKey: string }> = {
  cyprus: { flag: '\u{1F1E8}\u{1F1FE}', labelKey: 'news.country.cyprus' },
  greece: { flag: '\u{1F1EC}\u{1F1F7}', labelKey: 'news.country.greece' },
  world: { flag: '\u{1F30D}', labelKey: 'news.country.world' },
};
