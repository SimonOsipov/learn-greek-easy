import { useQuestionLanguageStore } from '@/stores/questionLanguageStore';
import type { CultureLanguage } from '@/types/culture';

export interface UseQuestionLanguageResult {
  questionLanguage: CultureLanguage;
  setQuestionLanguage: (lang: CultureLanguage, source?: string) => void;
  resetToDefault: () => void;
}

export function useQuestionLanguage(): UseQuestionLanguageResult {
  const { language, setLanguage } = useQuestionLanguageStore();

  return {
    questionLanguage: language,
    setQuestionLanguage: setLanguage,
    resetToDefault: () => setLanguage('en', 'reset'),
  };
}
