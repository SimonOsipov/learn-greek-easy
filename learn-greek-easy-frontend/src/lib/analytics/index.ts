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
  type CultureQuestionDetailViewedProperties,
  // Tracking functions
  trackCultureDeckViewed,
  trackCultureSessionStarted,
  trackCultureQuestionAnswered,
  trackCultureSessionCompleted,
  trackCultureSessionAbandoned,
  trackCultureLanguageChanged,
  generateCultureSessionId,
  trackCultureQuestionDetailViewed,
} from './cultureAnalytics';
export {
  type PremiumDeckLockedViewedProperties,
  type PremiumDeckLockedClickedProperties,
  trackPremiumDeckLockedViewed,
  trackPremiumDeckLockedClicked,
} from './deckAnalytics';
export { registerTheme, trackThemeChange, trackThemePreferenceLoaded } from './themeAnalytics';
export {
  // Type interfaces
  type MockExamPageViewedProperties,
  type MockExamStartedProperties,
  type MockExamQuestionAnsweredProperties,
  type MockExamCompletedProperties,
  type MockExamAbandonedProperties,
  type MockExamResultsViewedProperties,
  type MockExamIncorrectReviewExpandedProperties,
  type MockExamRetryClickedProperties,
  // Tracking functions
  trackMockExamPageViewed,
  trackMockExamStarted,
  trackMockExamQuestionAnswered,
  trackMockExamCompleted,
  trackMockExamAbandoned,
  trackMockExamResultsViewed,
  trackMockExamIncorrectReviewExpanded,
  trackMockExamRetryClicked,
} from './mockExamAnalytics';
export {
  // Type interfaces
  type NewsArticleClickedProperties,
  type NewsSourceLinkClickedProperties,
  type NewsPageViewedProperties,
  type NewsPagePaginatedProperties,
  type NewsAudioPlayStartedProperties,
  type NewsAudioPlayCompletedProperties,
  type NewsAudioPlayPausedProperties,
  type NewsLevelToggledProperties,
  // Tracking functions
  trackNewsArticleClicked,
  trackNewsSourceLinkClicked,
  trackNewsPageViewed,
  trackNewsPagePaginated,
  trackNewsPageSeeAllClicked,
  trackNewsAudioPlayStarted,
  trackNewsAudioPlayCompleted,
  trackNewsAudioPlayPaused,
  trackNewsLevelToggled,
} from './newsAnalytics';
export {
  // Type interfaces
  type ChangelogPageViewedProperties,
  type ChangelogPagePaginatedProperties,
  type ChangelogEntryViewedProperties,
  // Tracking functions
  trackChangelogPageViewed,
  trackChangelogPagePaginated,
  trackChangelogEntryViewed,
} from './changelogAnalytics';
export {
  // Type interfaces
  type UserCardCreateStartedProperties,
  type UserCardCreateCompletedProperties,
  type UserCardCreateCancelledProperties,
  type UserCardEditStartedProperties,
  type UserCardEditCompletedProperties,
  type UserCardEditCancelledProperties,
  type UserCardDeleteStartedProperties,
  type UserCardDeleteCompletedProperties,
  type UserCardDeleteCancelledProperties,
  // Tracking functions
  trackUserCardCreateStarted,
  trackUserCardCreateCompleted,
  trackUserCardCreateCancelled,
  trackUserCardEditStarted,
  trackUserCardEditCompleted,
  trackUserCardEditCancelled,
  trackUserCardDeleteStarted,
  trackUserCardDeleteCompleted,
  trackUserCardDeleteCancelled,
} from './userCardAnalytics';
export {
  // Type interfaces
  type CardErrorReportedProperties,
  type CardErrorModalOpenedProperties,
  type CardErrorModalClosedProperties,
  // Tracking functions
  trackCardErrorReported,
  trackCardErrorModalOpened,
  trackCardErrorModalClosed,
} from './cardErrorAnalytics';
export {
  // Type interfaces
  type WordAudioPlayedProperties,
  type ExampleAudioPlayedProperties,
  // Tracking functions
  trackWordAudioPlayed,
  trackExampleAudioPlayed,
} from './audioAnalytics';
