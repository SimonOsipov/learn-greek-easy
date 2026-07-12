// src/services/__tests__/cultureDeckAPI.test.ts

/**
 * Culture Deck API Service Tests -- Topic Filter (WEDGE-03-02)
 *
 * `getQuestionQueue` (cultureDeckAPI.ts:205) and `browseQuestions`
 * (cultureDeckAPI.ts:251) build their query string with URLSearchParams and
 * append it to the path passed into `api.get()`. Both methods' `options`
 * types accept a `topic?: CultureTopic` key that gets appended when present.
 *
 * "omits topic" is a regression lock: it passes both before and after the
 * executor wires the param (omitting it must stay a strict no-op), mirroring
 * the backend WEDGE-03-01 `test_*_without_topic_unchanged` pattern.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { CultureQuestionBrowseResponse } from '@/types/culture';

import { api } from '../api';
import { cultureDeckAPI, type CultureQuestionQueue } from '../cultureDeckAPI';

vi.mock('../api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockQueue: CultureQuestionQueue = {
  deck_id: 'd1',
  deck_name: { el: 'Δοκιμή', en: 'Test', ru: 'Тест' },
  category: 'history',
  total_due: 0,
  total_new: 0,
  total_in_queue: 0,
  has_studied_questions: false,
  questions: [],
};

const mockBrowseResponse: CultureQuestionBrowseResponse = {
  deck_id: 'd1',
  deck_name: 'Test Deck',
  total: 0,
  offset: 0,
  limit: 20,
  questions: [],
};

describe('cultureDeckAPI topic filter param (WEDGE-03-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getQuestionQueue', () => {
    it('appends topic when provided', async () => {
      vi.mocked(api.get).mockResolvedValue(mockQueue);

      await cultureDeckAPI.getQuestionQueue('d1', { topic: 'history' });

      const calledUrl = vi.mocked(api.get).mock.calls[0][0] as string;
      expect(calledUrl).toContain('topic=history');
    });

    it('omits topic when absent', async () => {
      vi.mocked(api.get).mockResolvedValue(mockQueue);

      await cultureDeckAPI.getQuestionQueue('d1', {});

      const calledUrl = vi.mocked(api.get).mock.calls[0][0] as string;
      expect(calledUrl).not.toContain('topic=');
    });
  });

  describe('browseQuestions', () => {
    it('appends topic when provided', async () => {
      vi.mocked(api.get).mockResolvedValue(mockBrowseResponse);

      await cultureDeckAPI.browseQuestions('d1', { topic: 'politics' });

      const calledUrl = vi.mocked(api.get).mock.calls[0][0] as string;
      expect(calledUrl).toContain('topic=politics');
    });
  });
});
