/**
 * Token Utilities Tests
 *
 * Comprehensive test suite for JWT token utility functions.
 * Tests token decoding, expiry checking, and refresh decision logic.
 *
 * Coverage targets:
 * - decodeJWT() - JWT payload decoding
 * - isTokenExpired() - token expiry detection with buffer
 * - getTokenTimeRemaining() - time remaining calculation
 * - shouldRefreshToken() - refresh decision logic
 * - DEFAULT_REFRESH_BUFFER_SECONDS - constant export
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  decodeJWT,
  isTokenExpired,
  getTokenTimeRemaining,
  shouldRefreshToken,
  DEFAULT_REFRESH_BUFFER_SECONDS,
} from '../tokenUtils';

// Helper to create a JWT-like token (not cryptographically valid, but structurally correct)
function createMockToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const signature = 'mock_signature';
  return `${header}.${body}.${signature}`;
}

describe('tokenUtils', () => {
  describe('DEFAULT_REFRESH_BUFFER_SECONDS', () => {
    it('should be 300 seconds (5 minutes)', () => {
      expect(DEFAULT_REFRESH_BUFFER_SECONDS).toBe(300);
    });
  });

  describe('decodeJWT', () => {
    it('decodes a valid JWT payload', () => {
      const token = createMockToken({
        sub: 'user-123',
        type: 'access',
        exp: 1703123456,
        iat: 1703121656,
      });

      const payload = decodeJWT(token);

      expect(payload).toEqual({
        sub: 'user-123',
        type: 'access',
        exp: 1703123456,
        iat: 1703121656,
      });
    });

    it('returns null for invalid token format (too many parts)', () => {
      expect(decodeJWT('not.a.valid.token.format')).toBeNull();
    });

    it('returns null for invalid token format (too few parts)', () => {
      expect(decodeJWT('invalid')).toBeNull();
      expect(decodeJWT('only.two')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(decodeJWT('')).toBeNull();
    });

    it('returns null for malformed base64 payload', () => {
      const token = 'header.!!!invalid-base64!!!.signature';
      expect(decodeJWT(token)).toBeNull();
    });

    it('returns null for non-JSON payload', () => {
      const header = btoa(JSON.stringify({ alg: 'HS256' }));
      const notJson = btoa('this is not json');
      const token = `${header}.${notJson}.signature`;
      expect(decodeJWT(token)).toBeNull();
    });

    it('handles base64url encoding (with - and _ characters)', () => {
      // Create a payload that would have + and / in standard base64
      const payload = { sub: 'user+id/test', exp: 1703123456 };
      const payloadStr = JSON.stringify(payload);
      // Convert to base64url (replace + with -, / with _)
      const base64url = btoa(payloadStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const header = btoa(JSON.stringify({ alg: 'HS256' }));
      const token = `${header}.${base64url}.signature`;

      const decoded = decodeJWT(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.sub).toBe('user+id/test');
    });

    it('handles base64 with missing padding', () => {
      // Create a token where the payload base64 needs padding
      const payload = { sub: 'a', exp: 1 }; // Short payload to test padding
      const payloadStr = JSON.stringify(payload);
      const base64 = btoa(payloadStr).replace(/=+$/, ''); // Remove padding
      const header = btoa(JSON.stringify({ alg: 'HS256' }));
      const token = `${header}.${base64}.signature`;

      const decoded = decodeJWT(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.sub).toBe('a');
    });
  });

  describe('isTokenExpired', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns true for null token', () => {
      expect(isTokenExpired(null)).toBe(true);
    });

    it('returns true for expired token', () => {
      const expiredTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const token = createMockToken({ exp: expiredTime });

      expect(isTokenExpired(token)).toBe(true);
    });

    it('returns true for token expiring within default buffer (5 min)', () => {
      const expiringTime = Math.floor(Date.now() / 1000) + 60; // 1 minute from now
      const token = createMockToken({ exp: expiringTime });

      expect(isTokenExpired(token)).toBe(true);
    });

    it('returns false for token not expiring soon', () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const token = createMockToken({ exp: futureTime });

      expect(isTokenExpired(token)).toBe(false);
    });

    it('respects custom buffer seconds (shorter buffer)', () => {
      const time = Math.floor(Date.now() / 1000) + 120; // 2 minutes from now
      const token = createMockToken({ exp: time });

      // With 1 min buffer - not expired
      expect(isTokenExpired(token, 60)).toBe(false);
    });

    it('respects custom buffer seconds (longer buffer)', () => {
      const time = Math.floor(Date.now() / 1000) + 120; // 2 minutes from now
      const token = createMockToken({ exp: time });

      // With 3 min buffer - expired
      expect(isTokenExpired(token, 180)).toBe(true);
    });

    it('returns true for token with no exp claim', () => {
      const token = createMockToken({ sub: 'user-123' }); // No exp
      expect(isTokenExpired(token)).toBe(true);
    });

    it('returns true for invalid token format', () => {
      expect(isTokenExpired('invalid-token')).toBe(true);
    });

    it('handles edge case: token expires exactly at buffer boundary', () => {
      const bufferSeconds = 300;
      const time = Math.floor(Date.now() / 1000) + bufferSeconds; // Exactly at buffer
      const token = createMockToken({ exp: time });

      // At exactly the buffer boundary, should be considered expired
      expect(isTokenExpired(token, bufferSeconds)).toBe(true);
    });

    it('handles zero buffer', () => {
      const time = Math.floor(Date.now() / 1000) + 1; // 1 second from now
      const token = createMockToken({ exp: time });

      expect(isTokenExpired(token, 0)).toBe(false);
    });
  });

  describe('getTokenTimeRemaining', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns null for null token', () => {
      expect(getTokenTimeRemaining(null)).toBeNull();
    });

    it('returns 0 for expired token', () => {
      const expiredTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const token = createMockToken({ exp: expiredTime });

      expect(getTokenTimeRemaining(token)).toBe(0);
    });

    it('returns milliseconds remaining for valid token', () => {
      const futureTime = Math.floor(Date.now() / 1000) + 600; // 10 minutes
      const token = createMockToken({ exp: futureTime });

      const remaining = getTokenTimeRemaining(token);
      expect(remaining).toBe(600000); // 10 minutes in milliseconds
    });

    it('returns null for token with no exp claim', () => {
      const token = createMockToken({ sub: 'user-123' });
      expect(getTokenTimeRemaining(token)).toBeNull();
    });

    it('returns null for invalid token', () => {
      expect(getTokenTimeRemaining('invalid-token')).toBeNull();
    });

    it('returns exact remaining time', () => {
      // Set a specific time
      const now = Date.now();
      const expirySeconds = Math.floor(now / 1000) + 123; // 123 seconds from now
      const token = createMockToken({ exp: expirySeconds });

      const remaining = getTokenTimeRemaining(token);
      expect(remaining).toBe(123000); // 123 seconds in milliseconds
    });
  });

  describe('shouldRefreshToken', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns false for null token', () => {
      // Null token = not logged in, should not try to refresh
      expect(shouldRefreshToken(null)).toBe(false);
    });

    it('returns true for expired token', () => {
      const expiredTime = Math.floor(Date.now() / 1000) - 3600;
      const token = createMockToken({ exp: expiredTime });

      expect(shouldRefreshToken(token)).toBe(true);
    });

    it('returns true for token expiring within 5 minutes', () => {
      const expiringTime = Math.floor(Date.now() / 1000) + 120; // 2 minutes
      const token = createMockToken({ exp: expiringTime });

      expect(shouldRefreshToken(token)).toBe(true);
    });

    it('returns false for fresh token (more than 5 min remaining)', () => {
      const futureTime = Math.floor(Date.now() / 1000) + 1800; // 30 minutes
      const token = createMockToken({ exp: futureTime });

      expect(shouldRefreshToken(token)).toBe(false);
    });

    it('returns true for token expiring exactly at 5 minute boundary', () => {
      const time = Math.floor(Date.now() / 1000) + 300; // Exactly 5 minutes
      const token = createMockToken({ exp: time });

      expect(shouldRefreshToken(token)).toBe(true);
    });

    it('returns false for token expiring just over 5 minutes', () => {
      const time = Math.floor(Date.now() / 1000) + 301; // 5 min + 1 sec
      const token = createMockToken({ exp: time });

      expect(shouldRefreshToken(token)).toBe(false);
    });

    it('returns true for invalid/malformed token', () => {
      // Can't decode = safer to refresh
      expect(shouldRefreshToken('invalid-token')).toBe(true);
    });

    it('returns false for empty string token (falsy = not logged in)', () => {
      // Empty string is falsy, same as null - no token = not logged in
      expect(shouldRefreshToken('')).toBe(false);
    });
  });

  describe('Integration scenarios', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('token lifecycle: fresh -> needs refresh -> expired', () => {
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + 600; // 10 minutes from now
      const token = createMockToken({ exp: expiry, sub: 'user-1' });

      // T+0: Fresh token
      expect(shouldRefreshToken(token)).toBe(false);
      expect(getTokenTimeRemaining(token)).toBe(600000);

      // T+4 min: Still fresh
      vi.advanceTimersByTime(4 * 60 * 1000);
      expect(shouldRefreshToken(token)).toBe(false);
      expect(getTokenTimeRemaining(token)).toBe(360000); // 6 min left

      // T+5 min: Needs refresh (within 5 min buffer)
      vi.advanceTimersByTime(1 * 60 * 1000);
      expect(shouldRefreshToken(token)).toBe(true);
      expect(getTokenTimeRemaining(token)).toBe(300000); // 5 min left

      // T+10 min: Expired
      vi.advanceTimersByTime(5 * 60 * 1000);
      expect(shouldRefreshToken(token)).toBe(true);
      expect(getTokenTimeRemaining(token)).toBe(0);
      expect(isTokenExpired(token, 0)).toBe(true);
    });

    it('uses exported constant for buffer', () => {
      // Verify the constant is used consistently
      const time = Math.floor(Date.now() / 1000) + DEFAULT_REFRESH_BUFFER_SECONDS;
      const token = createMockToken({ exp: time });

      expect(isTokenExpired(token)).toBe(true);
      expect(shouldRefreshToken(token)).toBe(true);
    });
  });
});
