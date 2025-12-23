/**
 * Analytics exports for centralized access to PostHog tracking utilities.
 */

export { registerInterfaceLanguage, trackLanguageSwitch } from './languageAnalytics';
export {
  // Type interfaces
  type CultureDeckViewedProperties,
  type CultureSessionStartedProperties,
  type CultureQuestionAnsweredProperties,
  type CultureSessionCompletedProperties,
  type CultureSessionAbandonedProperties,
  type CultureLanguageChangedProperties,
  type DeckFilterChangedProperties,
  // Tracking functions
  trackCultureDeckViewed,
  trackCultureSessionStarted,
  trackCultureQuestionAnswered,
  trackCultureSessionCompleted,
  trackCultureSessionAbandoned,
  trackCultureLanguageChanged,
  trackDeckFilterChanged,
  generateCultureSessionId,
} from './cultureAnalytics';
