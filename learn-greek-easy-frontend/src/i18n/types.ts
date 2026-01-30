import type { SupportedLanguage } from './constants';

/**
 * Language option for UI selectors
 */
export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag?: string; // Optional emoji flag
}

/**
 * Available language options for the language switcher
 */
export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
];

/**
 * Type-safe translation key accessor
 * Will be extended when we add typed translations
 */
export type TranslationKey = string;

/**
 * i18next interpolation values
 */
export interface InterpolationValues {
  [key: string]: string | number | boolean | null | undefined;
}
