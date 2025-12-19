// src/hooks/index.ts

// Auth hooks
export { useAuth } from './useAuth';

// Deck hooks
export { useDecks } from './useDecks';

// Dashboard hooks
export { useDashboard } from './useDashboard';

// Analytics hooks
export { useAnalytics } from './useAnalytics';
export { useProgressData } from './useProgressData';
export { useDeckPerformance } from './useDeckPerformance';
export { useStudyStreak } from './useStudyStreak';
export { useTrackEvent } from './useTrackEvent';
export type { AnalyticsEventName, EventProperties } from './useTrackEvent';

// Utility hooks
export { useKeyboardShortcuts } from './useKeyboardShortcuts';
export { usePremiumAccess } from './usePremiumAccess';
export { useToast } from './use-toast';

// i18n hooks
export { useLanguage } from './useLanguage';
export type { LanguageContextValue } from './useLanguage';
