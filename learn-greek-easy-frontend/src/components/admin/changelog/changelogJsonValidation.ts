/**
 * Changelog JSON Validation Utility
 *
 * Validates changelog JSON input for the admin interface.
 * Ensures JSON syntax is valid, required fields are present,
 * and tag values match allowed options.
 */

import type { ChangelogTag, ChangelogCreateRequest } from '@/types/changelog';
import { CHANGELOG_TAG_OPTIONS } from '@/types/changelog';

/** Valid tag values - re-exported from changelog types for consistency */
export const VALID_TAGS: readonly ChangelogTag[] = CHANGELOG_TAG_OPTIONS;

/** Required fields for changelog JSON input */
export const REQUIRED_FIELDS = ['tag', 'title_en', 'title_ru', 'content_en', 'content_ru'] as const;
export type RequiredField = (typeof REQUIRED_FIELDS)[number];

/** Validation error types - matches i18n keys in admin:changelog.validation */
export type ValidationErrorType = 'invalidJson' | 'missingFields' | 'invalidTag';

/** Validation error with i18n-compatible message key */
export interface ValidationError {
  type: ValidationErrorType;
  /** i18n key: admin:changelog.validation.{type} */
  messageKey: string;
  /** For missingFields: list of field names */
  fields?: string[];
}

/** Successful validation result */
export interface ValidationSuccess {
  valid: true;
  data: ChangelogCreateRequest;
}

/** Failed validation result */
export interface ValidationFailure {
  valid: false;
  error: ValidationError;
}

/** Union type for validation result */
export type ValidationResult = ValidationSuccess | ValidationFailure;

/** JSON placeholder template for textarea */
export const JSON_PLACEHOLDER = `{
  "tag": "new_feature",
  "title_en": "Title in English",
  "title_ru": "Заголовок на русском",
  "content_en": "Content in English",
  "content_ru": "Содержимое на русском"
}`;

/**
 * Validates changelog JSON input string.
 *
 * Validation order:
 * 1. Parse JSON syntax
 * 2. Check all required fields exist and are non-empty strings
 * 3. Validate tag is one of VALID_TAGS
 *
 * @param json - Raw JSON string from textarea input
 * @returns ValidationResult with either validated data or error details
 */
export function validateChangelogJson(json: string): ValidationResult {
  // Step 1: Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      valid: false,
      error: {
        type: 'invalidJson',
        messageKey: 'admin:changelog.validation.invalidJson',
      },
    };
  }

  // Ensure parsed result is an object (not null, array, or primitive)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      valid: false,
      error: {
        type: 'invalidJson',
        messageKey: 'admin:changelog.validation.invalidJson',
      },
    };
  }

  const obj = parsed as Record<string, unknown>;

  // Step 2: Check required fields exist and are non-empty strings
  const missingFields: string[] = [];
  for (const field of REQUIRED_FIELDS) {
    const value = obj[field];
    if (typeof value !== 'string' || value.trim() === '') {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    return {
      valid: false,
      error: {
        type: 'missingFields',
        messageKey: 'admin:changelog.validation.missingFields',
        fields: missingFields,
      },
    };
  }

  // Step 3: Validate tag value
  const tag = obj['tag'] as string;
  if (!VALID_TAGS.includes(tag as ChangelogTag)) {
    return {
      valid: false,
      error: {
        type: 'invalidTag',
        messageKey: 'admin:changelog.validation.invalidTag',
      },
    };
  }

  // All validations passed - return typed data
  const data: ChangelogCreateRequest = {
    tag: tag as ChangelogTag,
    title_en: (obj['title_en'] as string).trim(),
    title_ru: (obj['title_ru'] as string).trim(),
    content_en: (obj['content_en'] as string).trim(),
    content_ru: (obj['content_ru'] as string).trim(),
  };

  return {
    valid: true,
    data,
  };
}
