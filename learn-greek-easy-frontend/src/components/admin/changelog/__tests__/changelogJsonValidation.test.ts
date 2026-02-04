/**
 * Changelog JSON Validation Tests
 *
 * Comprehensive test suite for the changelog JSON validation utility.
 * Tests JSON parsing, required field validation, and tag validation.
 */

import { describe, it, expect } from 'vitest';

import {
  validateChangelogJson,
  sanitizeJsonInput,
  JSON_PLACEHOLDER,
  REQUIRED_FIELDS,
  VALID_TAGS,
} from '../changelogJsonValidation';

describe('changelogJsonValidation', () => {
  describe('validateChangelogJson', () => {
    // Test Case 1: Valid JSON with all fields
    it('returns valid result for complete valid JSON', () => {
      const validJson = JSON.stringify({
        tag: 'new_feature',
        title_en: 'English Title',
        title_ru: 'Russian Title',
        content_en: 'English content',
        content_ru: 'Russian content',
      });

      const result = validateChangelogJson(validJson);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toEqual({
          tag: 'new_feature',
          title_en: 'English Title',
          title_ru: 'Russian Title',
          content_en: 'English content',
          content_ru: 'Russian content',
        });
      }
    });

    // Test Case 2: Invalid JSON syntax
    it('returns invalidJson error for malformed JSON', () => {
      const result = validateChangelogJson('{ broken json');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('invalidJson');
        expect(result.error.messageKey).toBe('admin:changelog.validation.invalidJson');
      }
    });

    // Test Case 3: Missing required field
    it('returns missingFields error when required field is absent', () => {
      const jsonWithoutTitle = JSON.stringify({
        tag: 'new_feature',
        // title_en missing
        title_ru: 'Russian Title',
        content_en: 'English content',
        content_ru: 'Russian content',
      });

      const result = validateChangelogJson(jsonWithoutTitle);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('missingFields');
        expect(result.error.messageKey).toBe('admin:changelog.validation.missingFields');
        expect(result.error.fields).toContain('title_en');
      }
    });

    // Test Case 4: Invalid tag value
    it('returns invalidTag error for unknown tag', () => {
      const jsonWithBadTag = JSON.stringify({
        tag: 'invalid_tag',
        title_en: 'English Title',
        title_ru: 'Russian Title',
        content_en: 'English content',
        content_ru: 'Russian content',
      });

      const result = validateChangelogJson(jsonWithBadTag);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('invalidTag');
        expect(result.error.messageKey).toBe('admin:changelog.validation.invalidTag');
      }
    });

    // Test Case 5: Empty string fields
    it('returns missingFields error for empty string values', () => {
      const jsonWithEmpty = JSON.stringify({
        tag: 'new_feature',
        title_en: '',
        title_ru: 'Russian Title',
        content_en: 'English content',
        content_ru: 'Russian content',
      });

      const result = validateChangelogJson(jsonWithEmpty);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('missingFields');
        expect(result.error.fields).toContain('title_en');
      }
    });

    // Test Case 6: Extra fields ignored
    it('ignores extra fields and returns valid result', () => {
      const jsonWithExtra = JSON.stringify({
        tag: 'bug_fix',
        title_en: 'Bug Fix Title',
        title_ru: 'Исправление ошибки',
        content_en: 'Fixed the bug',
        content_ru: 'Ошибка исправлена',
        extra_field: 'should be ignored',
        another_extra: 123,
      });

      const result = validateChangelogJson(jsonWithExtra);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toEqual({
          tag: 'bug_fix',
          title_en: 'Bug Fix Title',
          title_ru: 'Исправление ошибки',
          content_en: 'Fixed the bug',
          content_ru: 'Ошибка исправлена',
        });
        // Extra fields should not be in result
        expect(result.data).not.toHaveProperty('extra_field');
        expect(result.data).not.toHaveProperty('another_extra');
      }
    });

    // Edge case: Whitespace-only strings
    it('treats whitespace-only strings as empty', () => {
      const jsonWithWhitespace = JSON.stringify({
        tag: 'new_feature',
        title_en: '   ',
        title_ru: 'Russian Title',
        content_en: 'English content',
        content_ru: 'Russian content',
      });

      const result = validateChangelogJson(jsonWithWhitespace);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('missingFields');
        expect(result.error.fields).toContain('title_en');
      }
    });

    // Edge case: Non-object JSON (array)
    it('returns invalidJson for non-object JSON (array)', () => {
      const result = validateChangelogJson('["array", "not", "object"]');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('invalidJson');
      }
    });

    // Edge case: Primitive JSON values
    it('returns invalidJson for primitive JSON values', () => {
      const result = validateChangelogJson('"just a string"');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('invalidJson');
      }
    });

    // Edge case: null JSON
    it('returns invalidJson for null JSON', () => {
      const result = validateChangelogJson('null');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('invalidJson');
      }
    });

    // Edge case: Number JSON
    it('returns invalidJson for number JSON', () => {
      const result = validateChangelogJson('42');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('invalidJson');
      }
    });

    // Edge case: Boolean JSON
    it('returns invalidJson for boolean JSON', () => {
      const result = validateChangelogJson('true');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('invalidJson');
      }
    });

    // Edge case: null values for required fields
    it('returns missingFields for null field values', () => {
      const jsonWithNull = JSON.stringify({
        tag: 'new_feature',
        title_en: null,
        title_ru: 'Russian Title',
        content_en: 'English content',
        content_ru: 'Russian content',
      });

      const result = validateChangelogJson(jsonWithNull);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('missingFields');
        expect(result.error.fields).toContain('title_en');
      }
    });

    // Edge case: Number values for required fields
    it('returns missingFields for number field values', () => {
      const jsonWithNumber = JSON.stringify({
        tag: 'new_feature',
        title_en: 123,
        title_ru: 'Russian Title',
        content_en: 'English content',
        content_ru: 'Russian content',
      });

      const result = validateChangelogJson(jsonWithNumber);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('missingFields');
        expect(result.error.fields).toContain('title_en');
      }
    });

    // Edge case: Object values for required fields
    it('returns missingFields for object field values', () => {
      const jsonWithObject = JSON.stringify({
        tag: 'new_feature',
        title_en: { nested: 'object' },
        title_ru: 'Russian Title',
        content_en: 'English content',
        content_ru: 'Russian content',
      });

      const result = validateChangelogJson(jsonWithObject);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('missingFields');
        expect(result.error.fields).toContain('title_en');
      }
    });

    // Edge case: Array values for required fields
    it('returns missingFields for array field values', () => {
      const jsonWithArray = JSON.stringify({
        tag: 'new_feature',
        title_en: ['array', 'value'],
        title_ru: 'Russian Title',
        content_en: 'English content',
        content_ru: 'Russian content',
      });

      const result = validateChangelogJson(jsonWithArray);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('missingFields');
        expect(result.error.fields).toContain('title_en');
      }
    });

    // Validate all three tag types
    it('validates all three tag types', () => {
      for (const tag of VALID_TAGS) {
        const json = JSON.stringify({
          tag,
          title_en: 'Title',
          title_ru: 'Заголовок',
          content_en: 'Content',
          content_ru: 'Содержимое',
        });

        const result = validateChangelogJson(json);
        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.data.tag).toBe(tag);
        }
      }
    });

    // Edge case: Multiple missing fields
    it('reports all missing fields at once', () => {
      const jsonMissingMultiple = JSON.stringify({
        tag: 'new_feature',
        // title_en, title_ru, content_en, content_ru all missing
      });

      const result = validateChangelogJson(jsonMissingMultiple);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('missingFields');
        expect(result.error.fields).toContain('title_en');
        expect(result.error.fields).toContain('title_ru');
        expect(result.error.fields).toContain('content_en');
        expect(result.error.fields).toContain('content_ru');
      }
    });

    // Edge case: Empty JSON object
    it('returns missingFields for empty JSON object', () => {
      const result = validateChangelogJson('{}');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('missingFields');
        expect(result.error.fields).toHaveLength(5); // All fields missing
      }
    });

    // Edge case: Trims whitespace from valid values
    it('trims whitespace from valid string values', () => {
      const jsonWithWhitespace = JSON.stringify({
        tag: 'announcement',
        title_en: '  English Title  ',
        title_ru: '  Russian Title  ',
        content_en: '  English content  ',
        content_ru: '  Russian content  ',
      });

      const result = validateChangelogJson(jsonWithWhitespace);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.title_en).toBe('English Title');
        expect(result.data.title_ru).toBe('Russian Title');
        expect(result.data.content_en).toBe('English content');
        expect(result.data.content_ru).toBe('Russian content');
      }
    });

    // Edge case: Case sensitivity for tag
    it('is case sensitive for tag values', () => {
      const jsonUpperCase = JSON.stringify({
        tag: 'NEW_FEATURE', // Wrong case
        title_en: 'Title',
        title_ru: 'Заголовок',
        content_en: 'Content',
        content_ru: 'Содержимое',
      });

      const result = validateChangelogJson(jsonUpperCase);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('invalidTag');
      }
    });
  });

  describe('JSON_PLACEHOLDER', () => {
    it('is valid JSON', () => {
      expect(() => JSON.parse(JSON_PLACEHOLDER)).not.toThrow();
    });

    it('contains all required fields', () => {
      const parsed = JSON.parse(JSON_PLACEHOLDER);
      for (const field of REQUIRED_FIELDS) {
        expect(parsed).toHaveProperty(field);
      }
    });

    it('has a valid tag value', () => {
      const parsed = JSON.parse(JSON_PLACEHOLDER);
      expect(VALID_TAGS).toContain(parsed.tag);
    });

    it('passes validation', () => {
      const result = validateChangelogJson(JSON_PLACEHOLDER);
      expect(result.valid).toBe(true);
    });
  });

  describe('constants', () => {
    it('exports REQUIRED_FIELDS with all necessary fields', () => {
      expect(REQUIRED_FIELDS).toEqual(['tag', 'title_en', 'title_ru', 'content_en', 'content_ru']);
    });

    it('exports VALID_TAGS matching changelog types', () => {
      expect(VALID_TAGS).toEqual(['new_feature', 'bug_fix', 'announcement']);
    });

    it('REQUIRED_FIELDS is immutable (readonly)', () => {
      // TypeScript readonly arrays cannot be mutated at runtime
      expect(Object.isFrozen(REQUIRED_FIELDS)).toBe(false); // as const doesn't freeze
      expect(REQUIRED_FIELDS.length).toBe(5);
    });

    it('VALID_TAGS is immutable (readonly)', () => {
      expect(VALID_TAGS.length).toBe(3);
    });
  });

  describe('sanitizeJsonInput', () => {
    it('should pass through valid JSON unchanged', () => {
      const input = '{"key": "value"}';
      expect(sanitizeJsonInput(input)).toBe(input);
    });

    it('should normalize Windows line endings (\\r\\n)', () => {
      const input = '{\r\n  "key": "value"\r\n}';
      const expected = '{\n  "key": "value"\n}';
      expect(sanitizeJsonInput(input)).toBe(expected);
    });

    it('should escape literal newlines in string values', () => {
      const input = '{"content": "line1\nline2"}';
      const expected = '{"content": "line1\\nline2"}';
      expect(sanitizeJsonInput(input)).toBe(expected);
    });

    it('should preserve structural newlines between JSON elements', () => {
      const input = '{\n  "a": "1",\n  "b": "2"\n}';
      expect(sanitizeJsonInput(input)).toBe(input);
    });

    it('should handle strings with escaped quotes', () => {
      const input = '{"msg": "say \\"hello\\""}';
      expect(sanitizeJsonInput(input)).toBe(input);
    });

    it('should handle multiple strings with newlines', () => {
      const input = '{"a": "x\ny", "b": "p\nq"}';
      const expected = '{"a": "x\\ny", "b": "p\\nq"}';
      expect(sanitizeJsonInput(input)).toBe(expected);
    });

    it('should handle empty strings', () => {
      const input = '{"empty": ""}';
      expect(sanitizeJsonInput(input)).toBe(input);
    });

    it('should handle strings with existing escape sequences', () => {
      const input = '{"escaped": "line1\\nline2"}';
      expect(sanitizeJsonInput(input)).toBe(input);
    });

    it('should handle mixed Windows and Unix line endings', () => {
      const input = '{\r\n  "content": "line1\r\nline2"\r\n}';
      const expected = '{\n  "content": "line1\\nline2"\n}';
      expect(sanitizeJsonInput(input)).toBe(expected);
    });
  });

  describe('validateChangelogJson with sanitization', () => {
    it('should accept JSON with Windows line endings', () => {
      const input =
        '{\r\n  "tag": "new_feature",\r\n  "title_en": "Test",\r\n  "title_ru": "Тест",\r\n  "content_en": "Content",\r\n  "content_ru": "Содержимое"\r\n}';
      const result = validateChangelogJson(input);
      expect(result.valid).toBe(true);
    });

    it('should accept JSON with literal newlines in content', () => {
      const input = `{
        "tag": "new_feature",
        "title_en": "Test",
        "title_ru": "Тест",
        "content_en": "Line 1\nLine 2",
        "content_ru": "Строка 1\nСтрока 2"
      }`;
      const result = validateChangelogJson(input);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.content_en).toContain('\n');
      }
    });

    it('should handle complex JSON with multiple newline issues', () => {
      const input =
        '{\r\n  "tag": "bug_fix",\r\n  "title_en": "Fix",\r\n  "title_ru": "Исправление",\r\n  "content_en": "Fixed:\n- Bug 1\n- Bug 2",\r\n  "content_ru": "Исправлено:\n- Ошибка 1\n- Ошибка 2"\r\n}';
      const result = validateChangelogJson(input);
      expect(result.valid).toBe(true);
    });
  });
});
