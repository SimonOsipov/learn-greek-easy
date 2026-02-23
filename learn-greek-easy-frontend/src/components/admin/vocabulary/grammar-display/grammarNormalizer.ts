// src/components/admin/vocabulary/grammar-display/grammarNormalizer.ts

/**
 * Normalizes grammar_data from both V1 (flat keys) and V2 (nested objects)
 * into a uniform flat Record<string, string | null> for display components.
 *
 * V1 flat example (noun):  { gender: 'neuter', nominative_singular: 'σπίτι', ... }
 * V2 nested example (noun): { gender: 'neuter', cases: { singular: { nominative: 'σπίτι', ... } } }
 */

const CASE_MAP: Record<string, string> = {
  nominative: 'nom',
  genitive: 'gen',
  accusative: 'acc',
  vocative: 'voc',
};

const GREEK_PERSON_TO_KEY: Record<string, string> = {
  εγώ: '1s',
  εσύ: '2s',
  'αυτός/αυτή/αυτό': '3s',
  εμείς: '1p',
  εσείς: '2p',
  'αυτοί/αυτές/αυτά': '3p',
};

const TENSES = ['present', 'imperfect', 'past', 'future', 'perfect'] as const;
const GENDERS = ['masculine', 'feminine', 'neuter'] as const;

function safeStr(val: unknown): string | null {
  return typeof val === 'string' && val !== '' ? val : null;
}

export function normalizeGrammarData(
  data: Record<string, unknown> | null,
  pos: string
): Record<string, string | null> {
  if (!data) return {};

  switch (pos) {
    case 'noun': {
      const result: Record<string, string | null> = {};
      result.gender = safeStr(data.gender);

      const cases = data.cases as Record<string, unknown> | undefined;
      if (cases && typeof cases === 'object') {
        // V2 nested: cases.{singular|plural}.{caseName}
        for (const number of ['singular', 'plural'] as const) {
          const numObj = cases[number] as Record<string, unknown> | undefined;
          for (const caseName of Object.keys(CASE_MAP)) {
            const key = `${caseName}_${number}`;
            result[key] = numObj ? safeStr(numObj[caseName]) : null;
          }
        }
      } else {
        // V1 flat: nominative_singular, etc.
        for (const caseName of Object.keys(CASE_MAP)) {
          for (const number of ['singular', 'plural']) {
            const key = `${caseName}_${number}`;
            result[key] = safeStr(data[key]);
          }
        }
      }
      return result;
    }

    case 'verb': {
      const result: Record<string, string | null> = {};
      result.voice = safeStr(data.voice);

      const tenses = data.tenses as Record<string, unknown> | undefined;
      if (tenses && typeof tenses === 'object') {
        // V2 nested: tenses.{tense}.{greekPerson}
        for (const tense of TENSES) {
          const tenseObj = tenses[tense] as Record<string, unknown> | undefined;
          if (tenseObj && typeof tenseObj === 'object') {
            for (const [greekPerson, personKey] of Object.entries(GREEK_PERSON_TO_KEY)) {
              result[`${tense}_${personKey}`] = safeStr(tenseObj[greekPerson]);
            }
          } else {
            // tense missing — fill with nulls
            for (const personKey of Object.values(GREEK_PERSON_TO_KEY)) {
              result[`${tense}_${personKey}`] = null;
            }
          }
        }
        // Imperatives may be top-level even in V2
        result.imperative_2s = safeStr(data.imperative_2s);
        result.imperative_2p = safeStr(data.imperative_2p);
      } else {
        // V1 flat: present_1s, etc.
        for (const tense of TENSES) {
          for (const personKey of Object.values(GREEK_PERSON_TO_KEY)) {
            const key = `${tense}_${personKey}`;
            result[key] = safeStr(data[key]);
          }
        }
        result.imperative_2s = safeStr(data.imperative_2s);
        result.imperative_2p = safeStr(data.imperative_2p);
      }
      return result;
    }

    case 'adjective': {
      const result: Record<string, string | null> = {};
      const forms = data.forms as Record<string, unknown> | undefined;

      if (forms && typeof forms === 'object') {
        // V2 nested: forms.[gender].[singular|plural].[caseName]
        for (const gender of GENDERS) {
          const genderObj = forms[gender] as Record<string, unknown> | undefined;
          for (const number of ['singular', 'plural'] as const) {
            const numAbbrev = number === 'singular' ? 'sg' : 'pl';
            const numObj = genderObj
              ? (genderObj[number] as Record<string, unknown> | undefined)
              : undefined;
            for (const [, caseAbbrev] of Object.entries(CASE_MAP)) {
              const caseName = Object.keys(CASE_MAP).find((k) => CASE_MAP[k] === caseAbbrev)!;
              const key = `${gender}_${caseAbbrev}_${numAbbrev}`;
              result[key] = numObj ? safeStr(numObj[caseName]) : null;
            }
          }
        }
      } else {
        // V1 flat: masculine_nom_sg, etc.
        for (const gender of GENDERS) {
          for (const caseAbbrev of Object.values(CASE_MAP)) {
            for (const numAbbrev of ['sg', 'pl']) {
              const key = `${gender}_${caseAbbrev}_${numAbbrev}`;
              result[key] = safeStr(data[key]);
            }
          }
        }
      }
      result.comparative = safeStr(data.comparative);
      result.superlative = safeStr(data.superlative);
      return result;
    }

    case 'adverb': {
      // V2 adverbs may only have `category`, no comparative/superlative
      return {
        comparative: safeStr(data.comparative),
        superlative: safeStr(data.superlative),
      };
    }

    default:
      return {};
  }
}

// ============================================
// Expected field counts per POS (for completeness calculation)
// ============================================

export const GRAMMAR_FIELD_COUNTS: Record<string, number> = {
  noun: 9, // gender + 4 cases × 2 numbers
  verb: 33, // voice + 5 tenses × 6 persons + 2 imperatives
  adjective: 26, // 3 genders × 4 cases × 2 numbers + comparative + superlative
  adverb: 2, // comparative + superlative
};
