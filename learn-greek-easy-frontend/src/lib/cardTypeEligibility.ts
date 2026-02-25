import type { GenerateCardType, WordEntryResponse } from '@/services/wordEntryAPI';

export type CardTypeEligibilityMap = Record<GenerateCardType, boolean>;

function getNestedString(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' && current.length > 0 ? current : undefined;
}

function isMeaningEligible(entry: WordEntryResponse): boolean {
  return !!entry.translation_en && !!entry.translation_ru;
}

function isPluralFormEligible(entry: WordEntryResponse): boolean {
  const gd = entry.grammar_data;
  if (!gd) return false;

  if (entry.part_of_speech === 'noun') {
    const sg = getNestedString(gd, 'cases', 'singular', 'nominative');
    const pl = getNestedString(gd, 'cases', 'plural', 'nominative');
    return !!sg && !!pl;
  }

  if (entry.part_of_speech === 'adjective') {
    const forms = gd.forms;
    if (!forms || typeof forms !== 'object') return false;
    const formsObj = forms as Record<string, unknown>;
    return ['masculine', 'feminine', 'neuter'].some((gender) => {
      const sg = getNestedString(formsObj, gender, 'singular', 'nominative');
      const pl = getNestedString(formsObj, gender, 'plural', 'nominative');
      return !!sg && !!pl;
    });
  }

  return false;
}

function isArticleEligible(entry: WordEntryResponse): boolean {
  if (entry.part_of_speech !== 'noun') return false;
  const gd = entry.grammar_data;
  if (!gd) return false;
  const gender = typeof gd.gender === 'string' && gd.gender.length > 0;
  const nomSg = getNestedString(gd, 'cases', 'singular', 'nominative');
  return gender && !!nomSg;
}

function isSentenceTranslationEligible(entry: WordEntryResponse): boolean {
  const examples = entry.examples;
  if (!examples || examples.length === 0) return false;
  return examples.some((ex) => !!ex.id && !!ex.greek && !!ex.english);
}

export function getCardTypeEligibility(entry: WordEntryResponse): CardTypeEligibilityMap {
  return {
    meaning: isMeaningEligible(entry),
    plural_form: isPluralFormEligible(entry),
    article: isArticleEligible(entry),
    sentence_translation: isSentenceTranslationEligible(entry),
  };
}
