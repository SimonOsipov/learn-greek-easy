import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';

import { track } from '@/lib/analytics';
import type { CultureLanguage } from '@/types/culture';

const VALID_LANGUAGES: CultureLanguage[] = ['el', 'en', 'ru'];
const LEGACY_KEY = 'culture_question_language';

interface QuestionLanguageState {
  language: CultureLanguage;
  setLanguage: (lang: CultureLanguage, source?: string) => void;
}

export function migrateLegacyLanguage(): CultureLanguage | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(LEGACY_KEY);
    if (stored && VALID_LANGUAGES.includes(stored as CultureLanguage)) {
      localStorage.removeItem(LEGACY_KEY);
      return stored as CultureLanguage;
    }
  } catch {
    // localStorage unavailable
  }
  return null;
}

export const useQuestionLanguageStore = create<QuestionLanguageState>()(
  devtools(
    persist(
      (set, get) => ({
        language: 'en',

        setLanguage: (lang: CultureLanguage, source = 'unknown') => {
          if (!VALID_LANGUAGES.includes(lang)) return;
          const current = get().language;
          if (lang === current) return;
          set({ language: lang });
          track('question_language_changed', { from_lang: current, to_lang: lang, source });
        },
      }),
      {
        name: 'question-language',
        storage: createJSONStorage(() => localStorage),
        version: 1,
        migrate: (persistedState, _version) => {
          if (!persistedState) {
            const legacy = migrateLegacyLanguage();
            if (legacy) {
              return { language: legacy };
            }
          }
          return persistedState as QuestionLanguageState;
        },
      }
    ),
    { name: 'questionLanguageStore' }
  )
);
