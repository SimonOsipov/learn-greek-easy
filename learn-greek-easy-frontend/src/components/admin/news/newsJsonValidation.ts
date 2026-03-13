/**
 * News Item JSON Validation Utility
 *
 * Validates news item JSON input for the admin interface.
 */

import type { NewsItemWithQuestionCreate, QuestionCreate } from '@/services/adminAPI';

/** JSON placeholder template for textarea */
export const JSON_PLACEHOLDER = `{
  "country": "cyprus",
  "title_el": "Τίτλος ειδήσεων",
  "title_en": "News title",
  "title_ru": "Заголовок новости",
  "title_el_a2": "(optional) Simplified A2 title",
  "description_el_a2": "(optional) Simplified A2 description",
  "description_el": "Περιγραφή στα ελληνικά",
  "description_en": "Description in English",
  "description_ru": "Описание на русском",
  "publication_date": "2024-01-15",
  "original_article_url": "https://example.com/article",
  "source_image_url": "https://example.com/image.jpg",
  "question": {
    "deck_id": "uuid-of-target-deck",
    "question_el": "Ερώτηση στα ελληνικά;",
    "question_en": "Question in English?",
    "question_ru": "Вопрос на русском?",
    "options": [
      { "text_el": "Επιλογή Α", "text_en": "Option A", "text_ru": "Вариант А" },
      { "text_el": "Επιλογή Β", "text_en": "Option B", "text_ru": "Вариант Б" },
      { "text_el": "Επιλογή Γ", "text_en": "Option C", "text_ru": "Вариант В" },
      { "text_el": "Επιλογή Δ", "text_en": "Option D", "text_ru": "Вариант Г" }
    ],
    "correct_answer_index": 0
  }
}`;

/** Required fields for news item creation */
export const REQUIRED_FIELDS = [
  'country',
  'title_el',
  'title_en',
  'title_ru',
  'description_el',
  'description_en',
  'description_ru',
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
  data: NewsItemWithQuestionCreate;
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
    parsed = JSON.parse(jsonString);
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
  const VALID_COUNTRIES = ['cyprus', 'greece', 'world'];
  if (!VALID_COUNTRIES.includes(parsed.country as string)) {
    return {
      valid: false,
      error: {
        type: 'invalidCountry',
        messageKey: 'news.validation.invalidCountry',
      },
    };
  }

  // Validate A2 fields pairing
  const titleA2 =
    typeof parsed.title_el_a2 === 'string' && parsed.title_el_a2.trim() !== ''
      ? (parsed.title_el_a2 as string)
      : null;
  const descA2 =
    typeof parsed.description_el_a2 === 'string' && parsed.description_el_a2.trim() !== ''
      ? (parsed.description_el_a2 as string)
      : null;

  if ((titleA2 !== null) !== (descA2 !== null)) {
    return {
      valid: false,
      error: {
        type: 'a2FieldsPaired',
        messageKey: 'news.validation.a2FieldsPaired',
      },
    };
  }

  // Build the data object
  const data: NewsItemWithQuestionCreate = {
    country: parsed.country as string,
    title_el: parsed.title_el as string,
    title_en: parsed.title_en as string,
    title_ru: parsed.title_ru as string,
    description_el: parsed.description_el as string,
    description_en: parsed.description_en as string,
    description_ru: parsed.description_ru as string,
    publication_date: parsed.publication_date as string,
    original_article_url: parsed.original_article_url as string,
    source_image_url: parsed.source_image_url as string,
  };

  // Include A2 fields when both present
  if (titleA2 !== null && descA2 !== null) {
    data.title_el_a2 = titleA2;
    data.description_el_a2 = descA2;
  }

  // Include question if present (optional field - backend will validate structure)
  if (parsed.question !== undefined && parsed.question !== null) {
    data.question = parsed.question as QuestionCreate;
  }

  return {
    valid: true,
    data,
  };
}
