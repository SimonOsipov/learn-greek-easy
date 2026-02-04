/**
 * API Error Utilities Tests
 *
 * Tests for parsing and displaying API error messages.
 */

import { describe, it, expect } from 'vitest';
import { getApiErrorMessage, isApiError } from '../apiErrorUtils';
import { APIRequestError } from '@/services/api';

describe('apiErrorUtils', () => {
  describe('getApiErrorMessage', () => {
    it('returns null for non-APIRequestError', () => {
      expect(getApiErrorMessage(new Error('generic error'))).toBeNull();
      expect(getApiErrorMessage('string error')).toBeNull();
      expect(getApiErrorMessage(null)).toBeNull();
      expect(getApiErrorMessage(undefined)).toBeNull();
      expect(getApiErrorMessage({ message: 'object error' })).toBeNull();
    });

    it('returns message for non-422 APIRequestError', () => {
      const error = new APIRequestError({
        status: 500,
        statusText: 'Internal Server Error',
        message: 'Something went wrong',
      });

      expect(getApiErrorMessage(error)).toBe('Something went wrong');
    });

    it('returns string detail for 422 error with string detail', () => {
      const error = new APIRequestError({
        status: 422,
        statusText: 'Unprocessable Entity',
        message: 'Validation failed',
        detail: 'Invalid input format',
      });

      expect(getApiErrorMessage(error)).toBe('Invalid input format');
    });

    it('parses Pydantic validation error array (single error)', () => {
      const error = new APIRequestError({
        status: 422,
        statusText: 'Unprocessable Entity',
        message: 'Validation failed',
        detail: [
          {
            type: 'string_too_short',
            loc: ['body', 'title_en'],
            msg: 'String should have at least 1 character',
            input: '',
          },
        ],
      });

      expect(getApiErrorMessage(error)).toBe('title_en: String should have at least 1 character');
    });

    it('parses Pydantic validation error array (multiple errors)', () => {
      const error = new APIRequestError({
        status: 422,
        statusText: 'Unprocessable Entity',
        message: 'Validation failed',
        detail: [
          {
            type: 'string_too_short',
            loc: ['body', 'title_en'],
            msg: 'String should have at least 1 character',
            input: '',
          },
          {
            type: 'missing',
            loc: ['body', 'content_en'],
            msg: 'Field required',
          },
        ],
      });

      expect(getApiErrorMessage(error)).toBe(
        'title_en: String should have at least 1 character; content_en: Field required'
      );
    });

    it('handles loc with nested path', () => {
      const error = new APIRequestError({
        status: 422,
        statusText: 'Unprocessable Entity',
        message: 'Validation failed',
        detail: [
          {
            type: 'string_pattern_mismatch',
            loc: ['body', 'items', 0, 'email'],
            msg: 'String does not match pattern',
            input: 'invalid',
          },
        ],
      });

      // Should show last element of loc
      expect(getApiErrorMessage(error)).toBe('email: String does not match pattern');
    });

    it('handles missing loc gracefully', () => {
      const error = new APIRequestError({
        status: 422,
        statusText: 'Unprocessable Entity',
        message: 'Validation failed',
        detail: [
          {
            type: 'string_too_short',
            msg: 'String should have at least 1 character',
            input: '',
          },
        ],
      });

      expect(getApiErrorMessage(error)).toBe('String should have at least 1 character');
    });

    it('handles empty loc array gracefully', () => {
      const error = new APIRequestError({
        status: 422,
        statusText: 'Unprocessable Entity',
        message: 'Validation failed',
        detail: [
          {
            type: 'string_too_short',
            loc: [],
            msg: 'String should have at least 1 character',
            input: '',
          },
        ],
      });

      expect(getApiErrorMessage(error)).toBe('String should have at least 1 character');
    });

    it('filters out invalid detail items', () => {
      const error = new APIRequestError({
        status: 422,
        statusText: 'Unprocessable Entity',
        message: 'Validation failed',
        detail: [
          { type: 'error', loc: ['body', 'title'], msg: 'Invalid title' },
          null as unknown as Record<string, unknown>,
          { type: 'error' }, // missing msg
          'string item',
        ],
      });

      expect(getApiErrorMessage(error)).toBe('title: Invalid title');
    });

    it('returns null if detail array is empty and no fallback', () => {
      const error = new APIRequestError({
        status: 422,
        statusText: 'Unprocessable Entity',
        message: 'Validation failed',
        detail: [],
      });

      // Empty detail array returns null since no messages could be extracted
      expect(getApiErrorMessage(error)).toBeNull();
    });

    it('returns null for 422 error with no detail', () => {
      const error = new APIRequestError({
        status: 422,
        statusText: 'Unprocessable Entity',
        message: '',
      });

      // No detail and empty message results in null
      expect(getApiErrorMessage(error)).toBeNull();
    });
  });

  describe('isApiError', () => {
    it('returns false for non-APIRequestError', () => {
      expect(isApiError(new Error('generic'))).toBe(false);
      expect(isApiError('string')).toBe(false);
      expect(isApiError(null)).toBe(false);
      expect(isApiError(undefined)).toBe(false);
      expect(isApiError({ status: 500 })).toBe(false);
    });

    it('returns true for APIRequestError without status check', () => {
      const error = new APIRequestError({
        status: 500,
        statusText: 'Internal Server Error',
        message: 'Error',
      });

      expect(isApiError(error)).toBe(true);
    });

    it('returns true for APIRequestError with matching status', () => {
      const error = new APIRequestError({
        status: 422,
        statusText: 'Unprocessable Entity',
        message: 'Validation failed',
      });

      expect(isApiError(error, 422)).toBe(true);
    });

    it('returns false for APIRequestError with non-matching status', () => {
      const error = new APIRequestError({
        status: 500,
        statusText: 'Internal Server Error',
        message: 'Error',
      });

      expect(isApiError(error, 422)).toBe(false);
    });
  });
});
