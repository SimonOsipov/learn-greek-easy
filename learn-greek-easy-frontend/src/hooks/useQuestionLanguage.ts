import { useState, useCallback, useRef } from 'react';

import { useLanguage } from '@/contexts/LanguageContext';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';
import { trackCultureLanguageChanged } from '@/lib/analytics/cultureAnalytics';

/**
 * localStorage key for persisting culture question language preference.
 * Separate from the main interface language (i18nextLng).
 */
const CULTURE_LANGUAGE_KEY = 'culture_question_language';

/**
 * Result of the useQuestionLanguage hook
 */
export interface UseQuestionLanguageResult {
  /** Current question display language */
  questionLanguage: SupportedLanguage;
  /** Change the question language (persists to localStorage, tracks analytics) */
  setQuestionLanguage: (lang: SupportedLanguage) => void;
  /** Reset to app default language (clears localStorage preference) */
  resetToDefault: () => void;
}

/**
 * Read stored language from localStorage with validation.
 * Returns null if no valid stored value.
 */
function getStoredLanguage(): SupportedLanguage | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(CULTURE_LANGUAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)) {
      return stored as SupportedLanguage;
    }
  } catch {
    // localStorage may be unavailable (e.g., private browsing)
    console.warn('[useQuestionLanguage] Could not read from localStorage');
  }
  return null;
}

/**
 * useQuestionLanguage Hook
 *
 * Manages the display language for culture exam questions separately
 * from the main interface language. This allows users to:
 * - Use the app interface in one language (e.g., English)
 * - Practice culture questions in another (e.g., Greek)
 *
 * Features:
 * - Persists preference to localStorage
 * - Falls back to current app language if no preference
 * - Tracks language changes in PostHog analytics
 * - SSR-safe with window check
 *
 * @example
 * ```tsx
 * function CulturePractice() {
 *   const { questionLanguage, setQuestionLanguage } = useQuestionLanguage();
 *
 *   return (
 *     <div>
 *       <LanguageSelector
 *         value={questionLanguage}
 *         onChange={setQuestionLanguage}
 *       />
 *       <QuestionDisplay language={questionLanguage} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useQuestionLanguage(): UseQuestionLanguageResult {
  const { currentLanguage } = useLanguage();

  // Initialize from localStorage or fall back to app language
  const [questionLanguage, setQuestionLanguageState] = useState<SupportedLanguage>(() => {
    const stored = getStoredLanguage();
    return stored ?? currentLanguage;
  });

  // Use ref to track previous language for analytics
  // This avoids stale closure issues in setQuestionLanguage callback
  const previousLangRef = useRef<SupportedLanguage>(questionLanguage);

  /**
   * Change the question language.
   * Persists to localStorage and tracks analytics.
   */
  const setQuestionLanguage = useCallback(
    (lang: SupportedLanguage) => {
      // Validate language
      if (!SUPPORTED_LANGUAGES.includes(lang)) {
        console.warn(`[useQuestionLanguage] Unsupported language: ${lang}`);
        return;
      }

      // Skip if already on this language
      if (lang === previousLangRef.current) {
        return;
      }

      const previousLang = previousLangRef.current;

      // Update state
      setQuestionLanguageState(lang);
      previousLangRef.current = lang;

      // Persist to localStorage
      try {
        localStorage.setItem(CULTURE_LANGUAGE_KEY, lang);
      } catch {
        console.warn('[useQuestionLanguage] Could not save to localStorage');
      }

      // Track analytics
      trackCultureLanguageChanged(previousLang, lang);
    },
    [] // No dependencies - uses refs for state tracking
  );

  /**
   * Reset to app default language.
   * Clears localStorage preference.
   */
  const resetToDefault = useCallback(() => {
    // Remove from localStorage
    try {
      localStorage.removeItem(CULTURE_LANGUAGE_KEY);
    } catch {
      console.warn('[useQuestionLanguage] Could not remove from localStorage');
    }

    // Reset to current app language
    setQuestionLanguageState(currentLanguage);
    previousLangRef.current = currentLanguage;
  }, [currentLanguage]);

  return {
    questionLanguage,
    setQuestionLanguage,
    resetToDefault,
  };
}
