// src/services/__tests__/usersAPI.test.ts

/**
 * Users API Service Tests
 *
 * Tests for the Users API service covering:
 * - Reset progress endpoint
 * - Delete account endpoint
 * - Error propagation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usersAPI } from '../usersAPI';
import { api } from '../api';

// Mock the api module
vi.mock('../api', () => ({
  api: {
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('usersAPI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resetProgress', () => {
    it('should call POST /api/v1/users/me/reset-progress', async () => {
      vi.mocked(api.post).mockResolvedValue(undefined);

      await usersAPI.resetProgress();

      expect(api.post).toHaveBeenCalledWith('/api/v1/users/me/reset-progress');
      expect(api.post).toHaveBeenCalledTimes(1);
    });

    it('should call POST without a request body', async () => {
      vi.mocked(api.post).mockResolvedValue(undefined);

      await usersAPI.resetProgress();

      // Verify only endpoint argument was passed (no body)
      expect(vi.mocked(api.post).mock.calls[0].length).toBe(1);
    });

    it('should propagate errors from API', async () => {
      const error = new Error('API Error');
      vi.mocked(api.post).mockRejectedValue(error);

      await expect(usersAPI.resetProgress()).rejects.toThrow('API Error');
    });

    it('should propagate APIRequestError with status details', async () => {
      const apiError = {
        status: 500,
        statusText: 'Internal Server Error',
        message: 'Database error',
        detail: 'Failed to clear progress data',
      };
      vi.mocked(api.post).mockRejectedValue(apiError);

      await expect(usersAPI.resetProgress()).rejects.toMatchObject({
        status: 500,
        detail: 'Failed to clear progress data',
      });
    });
  });

  describe('deleteAccount', () => {
    it('should call DELETE /api/v1/users/me', async () => {
      vi.mocked(api.delete).mockResolvedValue(undefined);

      await usersAPI.deleteAccount();

      expect(api.delete).toHaveBeenCalledWith('/api/v1/users/me');
      expect(api.delete).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from API', async () => {
      const error = new Error('API Error');
      vi.mocked(api.delete).mockRejectedValue(error);

      await expect(usersAPI.deleteAccount()).rejects.toThrow('API Error');
    });

    it('should propagate APIRequestError with status details', async () => {
      const apiError = {
        status: 500,
        statusText: 'Internal Server Error',
        message: 'Auth0 deletion failed',
        detail: 'Please contact support',
      };
      vi.mocked(api.delete).mockRejectedValue(apiError);

      await expect(usersAPI.deleteAccount()).rejects.toMatchObject({
        status: 500,
        detail: 'Please contact support',
      });
    });
  });
});
