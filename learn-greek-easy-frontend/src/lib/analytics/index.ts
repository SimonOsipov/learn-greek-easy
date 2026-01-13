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
export {
  // Type interfaces
  type AdminDeckEditOpenedProperties,
  type AdminDeckEditSavedProperties,
  type AdminDeckEditCancelledProperties,
  type AdminDeckEditFailedProperties,
  type AdminDeckDeactivatedProperties,
  type AdminDeckReactivatedProperties,
  // Tracking functions
  trackAdminDeckEditOpened,
  trackAdminDeckEditSaved,
  trackAdminDeckEditCancelled,
  trackAdminDeckEditFailed,
  trackAdminDeckDeactivated,
  trackAdminDeckReactivated,
} from './adminAnalytics';
export {
  registerTheme,
  trackThemeChange,
  trackThemePreferenceLoaded,
  trackThemeMigration,
} from './themeAnalytics';
