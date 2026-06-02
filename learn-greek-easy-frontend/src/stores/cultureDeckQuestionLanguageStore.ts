import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';

import { track } from '@/lib/analytics';
import type { CultureLanguage } from '@/types/culture';

const VALID_LANGUAGES: CultureLanguage[] = ['el', 'en', 'ru'];

interface CultureDeckQuestionLanguageState {
  language: CultureLanguage;
  setLanguage: (lang: CultureLanguage) => void;
}

export const useCultureDeckQuestionLanguageStore = create<CultureDeckQuestionLanguageState>()(
  devtools(
    persist(
      (set, get) => ({
        language: 'el',

        setLanguage: (lang: CultureLanguage) => {
          if (!VALID_LANGUAGES.includes(lang)) return;
          const current = get().language;
          if (lang === current) return;
          set({ language: lang });
          track('question_language_changed', {
            from_lang: current,
            to_lang: lang,
            source: 'culture_deck_detail',
          });
        },
      }),
      {
        name: 'culture-deck-question-language',
        storage: createJSONStorage(() => localStorage),
        version: 1,
      }
    ),
    { name: 'cultureDeckQuestionLanguageStore' }
  )
);

export function useCultureDeckQuestionLanguage(): {
  questionLanguage: CultureLanguage;
  setQuestionLanguage: (lang: CultureLanguage) => void;
} {
  const { language, setLanguage } = useCultureDeckQuestionLanguageStore();
  return { questionLanguage: language, setQuestionLanguage: setLanguage };
}
