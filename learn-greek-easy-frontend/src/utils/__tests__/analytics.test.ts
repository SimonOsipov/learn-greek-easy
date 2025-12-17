/**
 * Unit tests for analytics utility functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { shouldInitializePostHog, isTestUser, generateSessionId } from '../analytics';

describe('shouldInitializePostHog', () => {
  it('should return true when API key is present and environment is not test', () => {
    expect(shouldInitializePostHog('phc_xxx', 'production')).toBe(true);
    expect(shouldInitializePostHog('phc_xxx', 'development')).toBe(true);
    expect(shouldInitializePostHog('some-key', 'staging')).toBe(true);
  });

  it('should return false when API key is missing', () => {
    expect(shouldInitializePostHog(undefined, 'production')).toBe(false);
    expect(shouldInitializePostHog('', 'production')).toBe(false);
  });

  it('should return false when environment is test', () => {
    expect(shouldInitializePostHog('phc_xxx', 'test')).toBe(false);
  });
});

describe('isTestUser', () => {
  it('should return true for test_ prefixed user IDs', () => {
    expect(isTestUser('test_123')).toBe(true);
    expect(isTestUser('test_user')).toBe(true);
  });

  it('should return true for e2e_ prefixed user IDs', () => {
    expect(isTestUser('e2e_learner@test.com')).toBe(true);
    expect(isTestUser('e2e_admin')).toBe(true);
  });

  it('should return true for @test. email domains', () => {
    expect(isTestUser('user@test.com')).toBe(true);
    expect(isTestUser('admin@test.example.com')).toBe(true);
  });

  it('should return false for regular user IDs', () => {
    expect(isTestUser('user123')).toBe(false);
    expect(isTestUser('john@example.com')).toBe(false);
    expect(isTestUser('testing_user')).toBe(false); // Does not start with test_
  });

  it('should return false for undefined/null', () => {
    expect(isTestUser(undefined)).toBe(false);
    expect(isTestUser(null)).toBe(false);
  });
});

describe('generateSessionId', () => {
  it('should return a valid UUID v4 format', () => {
    const sessionId = generateSessionId();

    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    // where x is any hex digit and y is one of 8, 9, a, or b
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(sessionId).toMatch(uuidV4Regex);
  });

  it('should generate unique IDs', () => {
    const ids = new Set<string>();
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      ids.add(generateSessionId());
    }

    // All IDs should be unique
    expect(ids.size).toBe(iterations);
  });

  it('should have correct length (36 characters)', () => {
    const sessionId = generateSessionId();
    expect(sessionId.length).toBe(36);
  });

  describe('fallback behavior', () => {
    const originalCrypto = globalThis.crypto;

    beforeEach(() => {
      // Mock crypto to test fallback
      vi.stubGlobal('crypto', undefined);
    });

    afterEach(() => {
      // Restore original crypto
      vi.stubGlobal('crypto', originalCrypto);
    });

    it('should generate valid UUID v4 using fallback when crypto.randomUUID is unavailable', () => {
      const sessionId = generateSessionId();

      // Should still produce valid UUID v4 format
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(sessionId).toMatch(uuidV4Regex);
    });

    it('should generate unique IDs using fallback', () => {
      const ids = new Set<string>();
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        ids.add(generateSessionId());
      }

      expect(ids.size).toBe(iterations);
    });
  });
});
