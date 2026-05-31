// src/services/__tests__/waitlistAPI.test.ts

/**
 * Waitlist API Service Tests
 *
 * Tests for the waitlist API service covering:
 * - subscribe path, body, and skipAuth:true
 * - confirm path, body, and skipAuth:true
 * - subscribe passes the response through
 * - confirm propagates errors
 *
 * skipAuth is load-bearing because waitlist endpoints are used by unauthenticated
 * landing-page visitors who have no session token.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitlistAPI } from '../waitlistAPI';
import { api } from '../api';

// Mock the api module
vi.mock('../api', () => ({
  api: {
    post: vi.fn(),
  },
}));

describe('waitlistAPI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('subscribe', () => {
    it('should call POST /api/v1/waitlist/subscribe', async () => {
      vi.mocked(api.post).mockResolvedValue({ message: 'Subscribed' });

      await waitlistAPI.subscribe('test@example.com');

      expect(api.post).toHaveBeenCalledWith(
        '/api/v1/waitlist/subscribe',
        { email: 'test@example.com' },
        { skipAuth: true }
      );
      expect(api.post).toHaveBeenCalledTimes(1);
    });

    it('should pass skipAuth: true so unauthenticated landing users are not rejected', async () => {
      vi.mocked(api.post).mockResolvedValue({ message: 'Subscribed' });

      await waitlistAPI.subscribe('anon@example.com');

      const [, , options] = vi.mocked(api.post).mock.calls[0];
      expect(options).toEqual({ skipAuth: true });
    });

    it('should send the email in the request body', async () => {
      vi.mocked(api.post).mockResolvedValue({ message: 'Subscribed' });

      await waitlistAPI.subscribe('user@domain.com');

      const [, body] = vi.mocked(api.post).mock.calls[0];
      expect(body).toEqual({ email: 'user@domain.com' });
    });

    it('should return the response from the API', async () => {
      const mockResponse = { message: 'Check your email to confirm' };
      vi.mocked(api.post).mockResolvedValue(mockResponse);

      const result = await waitlistAPI.subscribe('test@example.com');

      expect(result).toEqual(mockResponse);
    });

    it('should propagate errors from the API', async () => {
      const error = new Error('Network Error');
      vi.mocked(api.post).mockRejectedValue(error);

      await expect(waitlistAPI.subscribe('test@example.com')).rejects.toThrow('Network Error');
    });

    it('should propagate APIRequestError with status details', async () => {
      const apiError = {
        status: 409,
        statusText: 'Conflict',
        message: 'Email already on waitlist',
        detail: 'This email address has already been subscribed',
      };
      vi.mocked(api.post).mockRejectedValue(apiError);

      await expect(waitlistAPI.subscribe('duplicate@example.com')).rejects.toMatchObject({
        status: 409,
        detail: 'This email address has already been subscribed',
      });
    });
  });

  describe('confirm', () => {
    it('should call POST /api/v1/waitlist/confirm', async () => {
      vi.mocked(api.post).mockResolvedValue({ message: 'Confirmed' });

      await waitlistAPI.confirm('abc-token-123');

      expect(api.post).toHaveBeenCalledWith(
        '/api/v1/waitlist/confirm',
        { token: 'abc-token-123' },
        { skipAuth: true }
      );
      expect(api.post).toHaveBeenCalledTimes(1);
    });

    it('should pass skipAuth: true so the confirmation link works without a session', async () => {
      vi.mocked(api.post).mockResolvedValue({ message: 'Confirmed' });

      await waitlistAPI.confirm('some-token');

      const [, , options] = vi.mocked(api.post).mock.calls[0];
      expect(options).toEqual({ skipAuth: true });
    });

    it('should send the token in the request body', async () => {
      vi.mocked(api.post).mockResolvedValue({ message: 'Confirmed' });

      await waitlistAPI.confirm('my-confirmation-token');

      const [, body] = vi.mocked(api.post).mock.calls[0];
      expect(body).toEqual({ token: 'my-confirmation-token' });
    });

    it('should return the response from the API', async () => {
      const mockResponse = { message: 'Email confirmed successfully' };
      vi.mocked(api.post).mockResolvedValue(mockResponse);

      const result = await waitlistAPI.confirm('valid-token');

      expect(result).toEqual(mockResponse);
    });

    it('should propagate errors from the API', async () => {
      const error = new Error('API Error');
      vi.mocked(api.post).mockRejectedValue(error);

      await expect(waitlistAPI.confirm('bad-token')).rejects.toThrow('API Error');
    });

    it('should propagate APIRequestError with status details', async () => {
      const apiError = {
        status: 400,
        statusText: 'Bad Request',
        message: 'Invalid or expired token',
        detail: 'The confirmation token has expired or does not exist',
      };
      vi.mocked(api.post).mockRejectedValue(apiError);

      await expect(waitlistAPI.confirm('expired-token')).rejects.toMatchObject({
        status: 400,
        detail: 'The confirmation token has expired or does not exist',
      });
    });
  });
});
