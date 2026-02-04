/**
 * API Error Utilities
 *
 * Utilities for parsing and displaying API error messages,
 * particularly Pydantic validation errors (422 responses).
 */

import { APIRequestError } from '@/services/api';

/**
 * Extract a human-readable error message from an APIRequestError.
 *
 * For 422 validation errors, parses Pydantic error details to show
 * field-specific messages. For other errors, returns the error message.
 *
 * @param error - The caught error (may or may not be APIRequestError)
 * @returns Human-readable error message, or null if not an APIRequestError
 */
export function getApiErrorMessage(error: unknown): string | null {
  if (!(error instanceof APIRequestError)) {
    return null;
  }

  if (error.status === 422 && error.detail) {
    return parseValidationErrorDetail(error.detail);
  }

  return error.message || null;
}

/**
 * Parse Pydantic validation error detail into human-readable message.
 *
 * Pydantic errors come as an array of objects with:
 * - type: error type (e.g., "string_too_short")
 * - loc: location path (e.g., ["body", "title_en"])
 * - msg: error message (e.g., "String should have at least 1 character")
 * - input: the invalid input value
 */
function parseValidationErrorDetail(detail: string | Record<string, unknown>[]): string | null {
  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const messages = detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          const msg = item.msg as string;
          const loc = item.loc as (string | number)[] | undefined;

          if (loc && loc.length > 0) {
            // Get the field name from the last element of loc
            // (skip "body" prefix if present)
            const fieldName = loc[loc.length - 1];
            return `${fieldName}: ${msg}`;
          }
          return msg;
        }
        return null;
      })
      .filter((msg): msg is string => msg !== null);

    if (messages.length > 0) {
      return messages.join('; ');
    }
  }

  return null;
}

/**
 * Type guard to check if an error is an APIRequestError.
 *
 * Optionally checks for a specific status code.
 *
 * @param error - The error to check
 * @param statusCode - Optional status code to match
 * @returns True if error is APIRequestError (with matching status if specified)
 */
export function isApiError(error: unknown, statusCode?: number): error is APIRequestError {
  if (!(error instanceof APIRequestError)) {
    return false;
  }
  if (statusCode !== undefined) {
    return error.status === statusCode;
  }
  return true;
}
