/**
 * News Item JSON Validation Utility
 *
 * Validates news item JSON input for the admin interface.
 */

import type { NewsCountry, NewsItemCreate } from '@/services/adminAPI';

/** JSON placeholder template for textarea */
export const JSON_PLACEHOLDER = `{
  "country": "cyprus",
  "scenario_el": "Σενάριο στα ελληνικά",
  "scenario_en": "Scenario in English",
  "scenario_ru": "Сценарий на русском",
  "scenario_el_a2": "(optional) Simplified A2 scenario",
  "text_el": "Κείμενο στα ελληνικά",
  "text_el_a2": "(optional) Simplified A2 text",
  "publication_date": "2024-01-15",
  "original_article_url": "https://example.com/article",
  "source_image_url": "https://example.com/image.jpg"
}`;

/** Required fields for news item creation */
export const REQUIRED_FIELDS = [
  'country',
  'scenario_el',
  'scenario_en',
  'scenario_ru',
  'text_el',
  'publication_date',
  'original_article_url',
  'source_image_url',
] as const;

/** Validation error types for translation */
export type ValidationErrorType =
  | 'invalidJson'
  | 'missingFields'
  | 'invalidArticleUrl'
  | 'invalidImageUrl'
  | 'invalidDate'
  | 'invalidCountry'
  | 'a2FieldsPaired';

/** Successful validation result */
export interface ValidationSuccess {
  valid: true;
  data: NewsItemCreate;
}

/** Failed validation result */
export interface ValidationFailure {
  valid: false;
  error: {
    type: ValidationErrorType;
    /** i18n key: admin:news.validation.{type} */
    messageKey: string;
  };
}

/** Union type for validation result */
export type ValidationResult = ValidationSuccess | ValidationFailure;

/**
 * Validates JSON input for news item creation.
 */
export function validateNewsItemJson(jsonString: string): ValidationResult {
  // Try to parse JSON
  let parsed: Record<string, unknown>;
  try {
    const rawParsed: unknown = JSON.parse(jsonString);
    if (typeof rawParsed !== 'object' || rawParsed === null || Array.isArray(rawParsed)) {
      return {
        valid: false,
        error: { type: 'invalidJson', messageKey: 'news.validation.invalidJson' },
      };
    }
    parsed = rawParsed as Record<string, unknown>;
  } catch {
    return {
      valid: false,
      error: {
        type: 'invalidJson',
        messageKey: 'news.validation.invalidJson',
      },
    };
  }

  // Check for required fields
  const missingFields = REQUIRED_FIELDS.filter(
    (field) => !parsed[field] || typeof parsed[field] !== 'string'
  );

  if (missingFields.length > 0) {
    return {
      valid: false,
      error: {
        type: 'missingFields',
        messageKey: 'news.validation.missingFields',
      },
    };
  }

  // Validate URL fields
  try {
    new URL(parsed.original_article_url as string);
  } catch {
    return {
      valid: false,
      error: {
        type: 'invalidArticleUrl',
        messageKey: 'news.validation.invalidArticleUrl',
      },
    };
  }

  try {
    new URL(parsed.source_image_url as string);
  } catch {
    return {
      valid: false,
      error: {
        type: 'invalidImageUrl',
        messageKey: 'news.validation.invalidImageUrl',
      },
    };
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(parsed.publication_date as string)) {
    return {
      valid: false,
      error: {
        type: 'invalidDate',
        messageKey: 'news.validation.invalidDate',
      },
    };
  }

  // Validate country
  const VALID_COUNTRIES: NewsCountry[] = ['cyprus', 'greece', 'world'];
  const countryValue = parsed.country;
  if (typeof countryValue !== 'string' || !VALID_COUNTRIES.includes(countryValue as NewsCountry)) {
    return {
      valid: false,
      error: {
        type: 'invalidCountry',
        messageKey: 'news.validation.invalidCountry',
      },
    };
  }
  const country = countryValue as NewsCountry;

  // Validate A2 fields pairing
  const scenarioA2 =
    typeof parsed.scenario_el_a2 === 'string' && parsed.scenario_el_a2.trim() !== ''
      ? (parsed.scenario_el_a2 as string)
      : null;
  const textA2 =
    typeof parsed.text_el_a2 === 'string' && parsed.text_el_a2.trim() !== ''
      ? (parsed.text_el_a2 as string)
      : null;

  if ((scenarioA2 !== null) !== (textA2 !== null)) {
    return {
      valid: false,
      error: {
        type: 'a2FieldsPaired',
        messageKey: 'news.validation.a2FieldsPaired',
      },
    };
  }

  // Build the data object
  const data: NewsItemCreate = {
    country,
    scenario_el: parsed.scenario_el as string,
    scenario_en: parsed.scenario_en as string,
    scenario_ru: parsed.scenario_ru as string,
    text_el: parsed.text_el as string,
    publication_date: parsed.publication_date as string,
    original_article_url: parsed.original_article_url as string,
    source_image_url: parsed.source_image_url as string,
  };

  // Include A2 fields when both present
  if (scenarioA2 !== null && textA2 !== null) {
    data.scenario_el_a2 = scenarioA2;
    data.text_el_a2 = textA2;
  }

  return {
    valid: true,
    data,
  };
}
