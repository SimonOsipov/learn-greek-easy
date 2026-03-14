export const MAX_GREEK_INPUT_LENGTH = 50;

// Greek Unicode ranges:
// \u0370-\u03FF — Greek and Coptic (modern Greek, accented vowels)
// \u1F00-\u1FFF — Greek Extended (polytonic accents)
// Also allow: spaces, hyphens, ano teleia (·), erotimatiko (;)
const GREEK_ONLY_REGEX =
  /^(?=.*[\u0370-\u03FF\u1F00-\u1FFF])[\u0370-\u03FF\u1F00-\u1FFF\s\-\u00B7;]+$/u;
const LATIN_REGEX = /[a-zA-Z]/;
const NUMBERS_ONLY_REGEX = /^\d+$/;

export interface GreekValidationResult {
  valid: boolean;
  reason?: 'latin' | 'numbersOnly' | 'tooLong';
}

export function isValidGreekInput(text: string): GreekValidationResult {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return { valid: false };
  }

  if (LATIN_REGEX.test(trimmed)) {
    return { valid: false, reason: 'latin' };
  }

  if (NUMBERS_ONLY_REGEX.test(trimmed)) {
    return { valid: false, reason: 'numbersOnly' };
  }

  if (trimmed.length > MAX_GREEK_INPUT_LENGTH) {
    return { valid: false, reason: 'tooLong' };
  }

  if (GREEK_ONLY_REGEX.test(trimmed)) {
    return { valid: true };
  }

  return { valid: false, reason: 'latin' };
}

export function containsLatinCharacters(text: string): boolean {
  return LATIN_REGEX.test(text);
}

export function detectScript(input: string): 'greek' | 'latin' | 'cyrillic' {
  if (/[\u0370-\u03FF\u1F00-\u1FFF]/.test(input)) return 'greek';
  if (/[\u0400-\u04FF]/.test(input)) return 'cyrillic';
  return 'latin';
}

export function scriptToLanguage(script: 'latin' | 'cyrillic'): 'en' | 'ru' {
  return script === 'cyrillic' ? 'ru' : 'en';
}
