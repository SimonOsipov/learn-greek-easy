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
  type AdminDeckPremiumEnabledProperties,
  type AdminDeckPremiumDisabledProperties,
  // Tracking functions
  trackAdminDeckEditOpened,
  trackAdminDeckEditSaved,
  trackAdminDeckEditCancelled,
  trackAdminDeckEditFailed,
  trackAdminDeckDeactivated,
  trackAdminDeckReactivated,
  trackAdminDeckPremiumEnabled,
  trackAdminDeckPremiumDisabled,
} from './adminAnalytics';
export {
  type PremiumDeckLockedViewedProperties,
  type PremiumDeckLockedClickedProperties,
  trackPremiumDeckLockedViewed,
  trackPremiumDeckLockedClicked,
} from './deckAnalytics';
export {
  registerTheme,
  trackThemeChange,
  trackThemePreferenceLoaded,
  trackThemeMigration,
} from './themeAnalytics';
