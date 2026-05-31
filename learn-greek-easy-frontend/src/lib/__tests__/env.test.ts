/**
 * Environment Utilities Tests
 *
 * Coverage targets:
 * - requireEnv() - throws with the key name when variable is missing
 * - getEnvBoolean() - case-insensitive parsing + default value
 * - getEnvNumber() - integer parsing + default on missing/non-numeric
 * - isEnvironment() - exact match against VITE_APP_ENV
 * - getEnv() - returns value or empty string
 * - getEnvironment() - returns current env or 'development' fallback
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the logger to avoid real log output and side effects
vi.mock('../logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
}));

// Mock sentry-queue as logger.ts imports it
vi.mock('../sentry-queue', () => ({
  queueBreadcrumb: vi.fn(),
  queueLog: vi.fn(),
  queueException: vi.fn(),
  queueMessage: vi.fn(),
}));

describe('env utilities', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getEnv', () => {
    it('returns the value of a set environment variable', async () => {
      vi.stubEnv('VITE_API_URL', 'https://api.example.com');
      const { getEnv } = await import('../env');
      expect(getEnv('VITE_API_URL')).toBe('https://api.example.com');
    });

    it('returns empty string when variable is not set', async () => {
      // Ensure the key is absent
      vi.stubEnv('VITE_API_URL', '');
      const { getEnv } = await import('../env');
      expect(getEnv('VITE_API_URL')).toBe('');
    });
  });

  describe('requireEnv', () => {
    it('returns the value when variable is set', async () => {
      vi.stubEnv('VITE_API_URL', 'https://api.example.com');
      const { requireEnv } = await import('../env');
      expect(requireEnv('VITE_API_URL')).toBe('https://api.example.com');
    });

    it('throws an error containing the key name when variable is missing', async () => {
      vi.stubEnv('VITE_API_URL', '');
      const { requireEnv } = await import('../env');
      expect(() => requireEnv('VITE_API_URL')).toThrow('VITE_API_URL');
    });

    it('throws an Error instance (not just any throw)', async () => {
      vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
      const { requireEnv } = await import('../env');
      expect(() => requireEnv('VITE_GOOGLE_CLIENT_ID')).toThrow(Error);
    });

    it('error message includes "Missing required environment variable"', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', '');
      const { requireEnv } = await import('../env');
      expect(() => requireEnv('VITE_SUPABASE_URL')).toThrow(
        'Missing required environment variable: VITE_SUPABASE_URL'
      );
    });
  });

  describe('getEnvBoolean', () => {
    it('returns true when value is "true"', async () => {
      vi.stubEnv('VITE_ENABLE_DEBUG_MODE', 'true');
      const { getEnvBoolean } = await import('../env');
      expect(getEnvBoolean('VITE_ENABLE_DEBUG_MODE')).toBe(true);
    });

    it('returns true when value is "TRUE" (case-insensitive)', async () => {
      vi.stubEnv('VITE_ENABLE_DEBUG_MODE', 'TRUE');
      const { getEnvBoolean } = await import('../env');
      expect(getEnvBoolean('VITE_ENABLE_DEBUG_MODE')).toBe(true);
    });

    it('returns true when value is "True" (mixed case)', async () => {
      vi.stubEnv('VITE_ENABLE_MOCK_DATA', 'True');
      const { getEnvBoolean } = await import('../env');
      expect(getEnvBoolean('VITE_ENABLE_MOCK_DATA')).toBe(true);
    });

    it('returns false when value is "false"', async () => {
      vi.stubEnv('VITE_ENABLE_DEBUG_MODE', 'false');
      const { getEnvBoolean } = await import('../env');
      expect(getEnvBoolean('VITE_ENABLE_DEBUG_MODE')).toBe(false);
    });

    it('returns false when value is "FALSE" (case-insensitive)', async () => {
      vi.stubEnv('VITE_ENABLE_DEBUG_MODE', 'FALSE');
      const { getEnvBoolean } = await import('../env');
      expect(getEnvBoolean('VITE_ENABLE_DEBUG_MODE')).toBe(false);
    });

    it('returns the defaultValue (false) when variable is not set', async () => {
      vi.stubEnv('VITE_ENABLE_DEBUG_MODE', '');
      const { getEnvBoolean } = await import('../env');
      expect(getEnvBoolean('VITE_ENABLE_DEBUG_MODE')).toBe(false);
    });

    it('returns custom defaultValue (true) when variable is not set', async () => {
      vi.stubEnv('VITE_ENABLE_DEVTOOLS', '');
      const { getEnvBoolean } = await import('../env');
      expect(getEnvBoolean('VITE_ENABLE_DEVTOOLS', true)).toBe(true);
    });

    it('returns false for arbitrary non-"true" string values', async () => {
      vi.stubEnv('VITE_ENABLE_ANALYTICS', '1');
      const { getEnvBoolean } = await import('../env');
      expect(getEnvBoolean('VITE_ENABLE_ANALYTICS')).toBe(false);
    });
  });

  describe('getEnvNumber', () => {
    it('parses a valid integer string', async () => {
      vi.stubEnv('VITE_API_TIMEOUT', '5000');
      const { getEnvNumber } = await import('../env');
      expect(getEnvNumber('VITE_API_TIMEOUT', 3000)).toBe(5000);
    });

    it('returns defaultValue when variable is not set', async () => {
      vi.stubEnv('VITE_API_TIMEOUT', '');
      const { getEnvNumber } = await import('../env');
      expect(getEnvNumber('VITE_API_TIMEOUT', 3000)).toBe(3000);
    });

    it('returns defaultValue when value is not a valid number', async () => {
      vi.stubEnv('VITE_API_TIMEOUT', 'not-a-number');
      const { getEnvNumber } = await import('../env');
      expect(getEnvNumber('VITE_API_TIMEOUT', 3000)).toBe(3000);
    });

    it('parses integer part of a float string (parseInt behavior)', async () => {
      vi.stubEnv('VITE_API_TIMEOUT', '42.9');
      const { getEnvNumber } = await import('../env');
      // parseInt('42.9', 10) === 42
      expect(getEnvNumber('VITE_API_TIMEOUT', 0)).toBe(42);
    });

    it('parses zero correctly', async () => {
      vi.stubEnv('VITE_API_TIMEOUT', '0');
      const { getEnvNumber } = await import('../env');
      // '0' is truthy via getEnv (not falsy), parseInt('0') === 0, isNaN(0) is false
      expect(getEnvNumber('VITE_API_TIMEOUT', 3000)).toBe(0);
    });

    it('returns defaultValue for NaN input string', async () => {
      vi.stubEnv('VITE_API_TIMEOUT', 'NaN');
      const { getEnvNumber } = await import('../env');
      expect(getEnvNumber('VITE_API_TIMEOUT', 999)).toBe(999);
    });
  });

  describe('isEnvironment', () => {
    it('returns true when VITE_APP_ENV matches "development"', async () => {
      vi.stubEnv('VITE_APP_ENV', 'development');
      const { isEnvironment } = await import('../env');
      expect(isEnvironment('development')).toBe(true);
    });

    it('returns true when VITE_APP_ENV matches "staging"', async () => {
      vi.stubEnv('VITE_APP_ENV', 'staging');
      const { isEnvironment } = await import('../env');
      expect(isEnvironment('staging')).toBe(true);
    });

    it('returns true when VITE_APP_ENV matches "production"', async () => {
      vi.stubEnv('VITE_APP_ENV', 'production');
      const { isEnvironment } = await import('../env');
      expect(isEnvironment('production')).toBe(true);
    });

    it('returns false when VITE_APP_ENV does not match (exact match required)', async () => {
      vi.stubEnv('VITE_APP_ENV', 'development');
      const { isEnvironment } = await import('../env');
      expect(isEnvironment('production')).toBe(false);
      expect(isEnvironment('staging')).toBe(false);
    });

    it('returns false when VITE_APP_ENV is not set', async () => {
      vi.stubEnv('VITE_APP_ENV', '');
      const { isEnvironment } = await import('../env');
      expect(isEnvironment('development')).toBe(false);
      expect(isEnvironment('staging')).toBe(false);
      expect(isEnvironment('production')).toBe(false);
    });
  });

  describe('getEnvironment', () => {
    it('returns "development" when VITE_APP_ENV is "development"', async () => {
      vi.stubEnv('VITE_APP_ENV', 'development');
      const { getEnvironment } = await import('../env');
      expect(getEnvironment()).toBe('development');
    });

    it('returns "staging" when VITE_APP_ENV is "staging"', async () => {
      vi.stubEnv('VITE_APP_ENV', 'staging');
      const { getEnvironment } = await import('../env');
      expect(getEnvironment()).toBe('staging');
    });

    it('returns "production" when VITE_APP_ENV is "production"', async () => {
      vi.stubEnv('VITE_APP_ENV', 'production');
      const { getEnvironment } = await import('../env');
      expect(getEnvironment()).toBe('production');
    });

    it('falls back to "development" when VITE_APP_ENV is not set', async () => {
      vi.stubEnv('VITE_APP_ENV', '');
      const { getEnvironment } = await import('../env');
      expect(getEnvironment()).toBe('development');
    });
  });
});
