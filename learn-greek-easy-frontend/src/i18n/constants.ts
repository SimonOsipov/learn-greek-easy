/**
 * Supported languages for the application interface.
 * Card content (Greek vocabulary) remains untranslated.
 */
export const SUPPORTED_LANGUAGES = ['en', 'ru'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

/**
 * Language display names in their native form
 */
export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  ru: 'Русский',
};

/**
 * Language detection order priority.
 * 1. localStorage - persisted user preference
 * 2. navigator - browser language settings
 */
export const DETECTION_ORDER = ['localStorage', 'navigator'] as const;

/**
 * Translation namespaces for code-splitting and organization.
 * Each namespace corresponds to a feature area.
 */
export const NAMESPACES = [
  'common', // Shared: nav, buttons, loading, errors
  'auth', // Login, register, forgot password
  'deck', // Deck list, deck detail, filters
  'review', // Flashcard review, ratings, summary
  'settings', // Settings page sections
  'profile', // Profile page
  'statistics', // Statistics/analytics page
  'feedback', // Feedback submission/voting
  'culture', // Culture exam practice
  'mockExam', // Mock citizenship exam
  'admin', // Admin dashboard and statistics
  'landing', // Landing page
  'achievements', // Achievement cards and categories
  'changelog', // Changelog tag labels
  'upgrade', // Upgrade/pricing page
  'subscription', // Subscription management page
] as const;

export type Namespace = (typeof NAMESPACES)[number];

/**
 * localStorage key for persisting language preference
 */
export const I18N_STORAGE_KEY = 'i18nextLng';
