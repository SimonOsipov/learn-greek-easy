import React, { createContext, useContext, useCallback, useEffect, useState, useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_NAMES,
  type SupportedLanguage,
} from '@/i18n';
import { LANGUAGE_OPTIONS, type LanguageOption } from '@/i18n/types';
import { registerInterfaceLanguage, trackLanguageSwitch } from '@/lib/analytics';
import log from '@/lib/logger';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';

/**
 * Language context value interface
 */
export interface LanguageContextValue {
  /** Current active language code */
  currentLanguage: SupportedLanguage;
  /** Change the interface language */
  changeLanguage: (lang: SupportedLanguage, source?: 'header' | 'settings') => Promise<void>;
  /** Whether a language change is in progress */
  isChanging: boolean;
  /** List of available languages for UI selectors */
  availableLanguages: readonly LanguageOption[];
  /** Get display name for a language code */
  getLanguageName: (code: SupportedLanguage) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

/**
 * LanguageProvider Component
 *
 * Provides language state management across the application:
 * - Tracks current language from i18next
 * - Syncs with backend user preferences when authenticated
 * - Persists to localStorage for guests (via i18next-browser-languagedetector)
 * - Provides language change functionality with error handling
 */
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const { user, isAuthenticated } = useAuthStore();
  const [isChanging, setIsChanging] = useState(false);

  /**
   * Get current language from i18next, validated against supported languages
   */
  const currentLanguage = useMemo((): SupportedLanguage => {
    const lang = i18n.language;
    // Handle language codes with region (e.g., 'en-US' -> 'en')
    const baseLanguage = lang?.split('-')[0] as SupportedLanguage;

    if (SUPPORTED_LANGUAGES.includes(baseLanguage)) {
      return baseLanguage;
    }
    return DEFAULT_LANGUAGE;
  }, [i18n.language]);

  /**
   * Register current language with PostHog on initial load
   */
  useEffect(() => {
    registerInterfaceLanguage(currentLanguage);
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Sync language with user preference on login
   * Priority: User DB preference > current i18next language
   */
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Check if user has a preferred_language in settings (from backend)
    // Note: This will be populated after I18N-04 backend implementation
    const userPreferredLang = (user as Record<string, unknown>).settings as
      | { preferred_language?: SupportedLanguage }
      | undefined;

    if (
      userPreferredLang?.preferred_language &&
      SUPPORTED_LANGUAGES.includes(userPreferredLang.preferred_language) &&
      userPreferredLang.preferred_language !== currentLanguage
    ) {
      // User's DB preference takes precedence - sync i18next to it
      i18n.changeLanguage(userPreferredLang.preferred_language);
    }
  }, [isAuthenticated, user, currentLanguage, i18n]);

  /**
   * Change language with persistence and optional backend sync
   *
   * @param lang - Target language code
   * @param source - Where the change was initiated (for analytics in I18N-08)
   */
  const changeLanguage = useCallback(
    async (lang: SupportedLanguage, source: 'header' | 'settings' = 'header') => {
      // Validate language
      if (!SUPPORTED_LANGUAGES.includes(lang)) {
        log.warn(`[LanguageContext] Unsupported language: ${lang}`);
        return;
      }

      // Skip if already on this language
      if (lang === currentLanguage) {
        return;
      }

      const previousLang = currentLanguage;
      setIsChanging(true);

      try {
        // Step 1: Change language in i18next (also updates localStorage via detector)
        await i18n.changeLanguage(lang);

        // Step 2: If authenticated, sync preference to backend
        if (isAuthenticated) {
          try {
            await api.patch('/api/v1/users/me', {
              preferred_language: lang,
            });
          } catch (apiError) {
            // Log but don't fail - local change still succeeded
            log.error('[LanguageContext] Failed to sync language to backend:', apiError);
            // Note: We could optionally show a toast here
          }
        }

        // Step 3: Track analytics
        registerInterfaceLanguage(lang);
        trackLanguageSwitch(previousLang, lang, source, isAuthenticated);

        log.debug(
          `[LanguageContext] Language changed: ${previousLang} -> ${lang} (source: ${source})`
        );
      } catch (error) {
        log.error('[LanguageContext] Failed to change language:', error);

        // Revert on failure
        try {
          await i18n.changeLanguage(previousLang);
        } catch (revertError) {
          log.error('[LanguageContext] Failed to revert language:', revertError);
        }

        throw error;
      } finally {
        setIsChanging(false);
      }
    },
    [currentLanguage, i18n, isAuthenticated]
  );

  /**
   * Get human-readable name for a language code
   */
  const getLanguageName = useCallback((code: SupportedLanguage): string => {
    return LANGUAGE_NAMES[code] || code;
  }, []);

  const value = useMemo(
    (): LanguageContextValue => ({
      currentLanguage,
      changeLanguage,
      isChanging,
      availableLanguages: LANGUAGE_OPTIONS,
      getLanguageName,
    }),
    [currentLanguage, changeLanguage, isChanging, getLanguageName]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

/**
 * Hook to access language context
 *
 * @throws Error if used outside LanguageProvider
 *
 * @example
 * ```tsx
 * function LanguageSwitcher() {
 *   const { currentLanguage, changeLanguage, availableLanguages, isChanging } = useLanguage();
 *
 *   return (
 *     <select
 *       value={currentLanguage}
 *       onChange={(e) => changeLanguage(e.target.value as SupportedLanguage, 'header')}
 *       disabled={isChanging}
 *     >
 *       {availableLanguages.map((lang) => (
 *         <option key={lang.code} value={lang.code}>
 *           {lang.flag} {lang.nativeName}
 *         </option>
 *       ))}
 *     </select>
 *   );
 * }
 * ```
 */
export const useLanguage = (): LanguageContextValue => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
