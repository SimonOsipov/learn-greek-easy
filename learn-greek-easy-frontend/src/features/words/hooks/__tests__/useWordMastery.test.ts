import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

import { useWordMastery } from '../useWordMastery';
import { progressAPI } from '@/services/progressAPI';
import { wordEntryAPI } from '@/services/wordEntryAPI';

vi.mock('@/services/progressAPI', () => ({
  progressAPI: {
    getWordMastery: vi.fn(),
  },
}));

vi.mock('@/services/wordEntryAPI', () => ({
  wordEntryAPI: {
    getCardsByWordEntry: vi.fn(),
  },
}));

const mockCardBase = {
  id: 'card-1',
  word_entry_id: 'word-1',
  deck_id: 'deck-1',
  tier: 1,
  variant_key: 'meaning_el_to_en_t1',
  front_content: { prompt: 'What does this mean?', main: 'σπίτι' },
  back_content: { answer: 'house' },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockCards = [
  { ...mockCardBase, id: 'card-1', card_type: 'meaning_el_to_en', is_active: true },
  {
    ...mockCardBase,
    id: 'card-2',
    card_type: 'meaning_en_to_el',
    is_active: true,
    front_content: { prompt: 'Translate to Greek', main: 'house' },
    back_content: { answer: 'σπίτι' },
  },
];

const mockMasteryResponse = (
  masteredCount: number,
  studiedCount: number,
  typeProgress?: Array<{
    card_type: string;
    mastered_count: number;
    studied_count: number;
    total_count: number;
  }>
) => ({
  deck_id: 'deck-1',
  items: [
    {
      word_entry_id: 'word-1',
      mastered_count: masteredCount,
      studied_count: studiedCount,
      total_count: 2,
      type_progress: typeProgress ?? [],
    },
  ],
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useWordMastery Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return loading state while both queries are pending', () => {
    vi.mocked(progressAPI.getWordMastery).mockReturnValue(new Promise(() => {}));
    vi.mocked(wordEntryAPI.getCardsByWordEntry).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(
      () => useWordMastery({ deckId: 'deck-1', wordEntryId: 'word-1' }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.cards).toEqual([]);
  });

  it('should return mastered status when mastered_count equals total_count', async () => {
    // All cards mastered: mastered_count (2) >= total_count (2)
    vi.mocked(progressAPI.getWordMastery).mockResolvedValue(mockMasteryResponse(2, 2));
    vi.mocked(wordEntryAPI.getCardsByWordEntry).mockResolvedValue(mockCards);

    const { result } = renderHook(
      () => useWordMastery({ deckId: 'deck-1', wordEntryId: 'word-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.cards).toHaveLength(2);
    expect(result.current.cards[0].id).toBe('card-1');
    expect(result.current.cards[1].id).toBe('card-2');
    expect(result.current.cards[0].mastery_status).toBe('none');
    expect(result.current.cards[1].mastery_status).toBe('none');
    expect(result.current.wordMasteryStatus).toBe('mastered');
  });

  it('should return studied status when mastered_count > 0 but less than total_count', async () => {
    // Partial mastery: mastered_count (1) < total_count (2)
    vi.mocked(progressAPI.getWordMastery).mockResolvedValue(mockMasteryResponse(1, 2));
    vi.mocked(wordEntryAPI.getCardsByWordEntry).mockResolvedValue(mockCards);

    const { result } = renderHook(
      () => useWordMastery({ deckId: 'deck-1', wordEntryId: 'word-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.cards).toHaveLength(2);
    expect(result.current.cards[0].mastery_status).toBe('none');
    expect(result.current.cards[1].mastery_status).toBe('none');
    expect(result.current.wordMasteryStatus).toBe('studied');
  });

  it('should return studied status when mastered_count is 0 and studied_count > 0', async () => {
    vi.mocked(progressAPI.getWordMastery).mockResolvedValue(mockMasteryResponse(0, 2));
    vi.mocked(wordEntryAPI.getCardsByWordEntry).mockResolvedValue(mockCards);

    const { result } = renderHook(
      () => useWordMastery({ deckId: 'deck-1', wordEntryId: 'word-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.wordMasteryStatus).toBe('studied');
    expect(result.current.cards[0].mastery_status).toBe('none');
  });

  it('should return none status when both mastered_count and studied_count are 0', async () => {
    vi.mocked(progressAPI.getWordMastery).mockResolvedValue(mockMasteryResponse(0, 0));
    vi.mocked(wordEntryAPI.getCardsByWordEntry).mockResolvedValue(mockCards);

    const { result } = renderHook(
      () => useWordMastery({ deckId: 'deck-1', wordEntryId: 'word-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.wordMasteryStatus).toBe('none');
    expect(result.current.cards[0].mastery_status).toBe('none');
  });

  it('should return none status when word is not found in mastery items', async () => {
    vi.mocked(progressAPI.getWordMastery).mockResolvedValue({
      deck_id: 'deck-1',
      items: [],
    });
    vi.mocked(wordEntryAPI.getCardsByWordEntry).mockResolvedValue(mockCards);

    const { result } = renderHook(
      () => useWordMastery({ deckId: 'deck-1', wordEntryId: 'word-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.wordMasteryStatus).toBe('none');
    expect(result.current.cards[0].mastery_status).toBe('none');
  });

  it('should return empty cards array when no card records exist', async () => {
    vi.mocked(progressAPI.getWordMastery).mockResolvedValue(mockMasteryResponse(1, 1));
    vi.mocked(wordEntryAPI.getCardsByWordEntry).mockResolvedValue([]);

    const { result } = renderHook(
      () => useWordMastery({ deckId: 'deck-1', wordEntryId: 'word-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.cards).toEqual([]);
  });

  it('should exclude inactive cards from the result', async () => {
    const cardsWithInactive = [
      ...mockCards,
      { ...mockCardBase, id: 'card-3', card_type: 'cloze', is_active: false },
    ];
    vi.mocked(progressAPI.getWordMastery).mockResolvedValue(mockMasteryResponse(1, 1));
    vi.mocked(wordEntryAPI.getCardsByWordEntry).mockResolvedValue(cardsWithInactive);

    const { result } = renderHook(
      () => useWordMastery({ deckId: 'deck-1', wordEntryId: 'word-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.cards).toHaveLength(2);
    expect(result.current.cards.every((c) => c.card_type !== 'cloze')).toBe(true);
  });

  it('should set isError and error when mastery API fails', async () => {
    const mockError = new Error('Mastery API Error');
    vi.mocked(progressAPI.getWordMastery).mockRejectedValue(mockError);
    vi.mocked(wordEntryAPI.getCardsByWordEntry).mockResolvedValue(mockCards);

    const { result } = renderHook(
      () => useWordMastery({ deckId: 'deck-1', wordEntryId: 'word-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual(mockError);
  });

  it('should set isError and error when cards API fails', async () => {
    const mockError = new Error('Cards API Error');
    vi.mocked(progressAPI.getWordMastery).mockResolvedValue(mockMasteryResponse(1, 1));
    vi.mocked(wordEntryAPI.getCardsByWordEntry).mockRejectedValue(mockError);

    const { result } = renderHook(
      () => useWordMastery({ deckId: 'deck-1', wordEntryId: 'word-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual(mockError);
  });

  it('should not call APIs when enabled is false', () => {
    const { result } = renderHook(
      () => useWordMastery({ deckId: 'deck-1', wordEntryId: 'word-1', enabled: false }),
      { wrapper: createWrapper() }
    );

    expect(progressAPI.getWordMastery).not.toHaveBeenCalled();
    expect(wordEntryAPI.getCardsByWordEntry).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.cards).toEqual([]);
  });

  describe('per-card-type mastery', () => {
    it('should return mastered for a card whose type_progress entry is fully mastered', async () => {
      const typeProgress = [
        { card_type: 'meaning_el_to_en', mastered_count: 1, studied_count: 1, total_count: 1 },
        { card_type: 'meaning_en_to_el', mastered_count: 0, studied_count: 1, total_count: 1 },
      ];
      vi.mocked(progressAPI.getWordMastery).mockResolvedValue(
        mockMasteryResponse(1, 2, typeProgress)
      );
      vi.mocked(wordEntryAPI.getCardsByWordEntry).mockResolvedValue(mockCards);

      const { result } = renderHook(
        () => useWordMastery({ deckId: 'deck-1', wordEntryId: 'word-1' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.cards[0].mastery_status).toBe('mastered');
      expect(result.current.cards[1].mastery_status).toBe('studied');
      expect(result.current.wordMasteryStatus).toBe('studied');
    });

    it('should return studied for a card whose type_progress entry has studied but not mastered', async () => {
      const typeProgress = [
        { card_type: 'meaning_el_to_en', mastered_count: 0, studied_count: 1, total_count: 1 },
      ];
      vi.mocked(progressAPI.getWordMastery).mockResolvedValue(
        mockMasteryResponse(0, 1, typeProgress)
      );
      vi.mocked(wordEntryAPI.getCardsByWordEntry).mockResolvedValue(mockCards);

      const { result } = renderHook(
        () => useWordMastery({ deckId: 'deck-1', wordEntryId: 'word-1' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.cards[0].mastery_status).toBe('studied');
      expect(result.current.cards[1].mastery_status).toBe('none');
    });

    it('should return none for a card whose type_progress entry has zero counts', async () => {
      const typeProgress = [
        { card_type: 'meaning_el_to_en', mastered_count: 0, studied_count: 0, total_count: 1 },
      ];
      vi.mocked(progressAPI.getWordMastery).mockResolvedValue(
        mockMasteryResponse(0, 0, typeProgress)
      );
      vi.mocked(wordEntryAPI.getCardsByWordEntry).mockResolvedValue(mockCards);

      const { result } = renderHook(
        () => useWordMastery({ deckId: 'deck-1', wordEntryId: 'word-1' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.cards[0].mastery_status).toBe('none');
      expect(result.current.cards[1].mastery_status).toBe('none');
    });

    it('should return none when card type has no matching type_progress entry', async () => {
      const typeProgress = [
        { card_type: 'article', mastered_count: 1, studied_count: 1, total_count: 1 },
      ];
      vi.mocked(progressAPI.getWordMastery).mockResolvedValue(
        mockMasteryResponse(1, 1, typeProgress)
      );
      vi.mocked(wordEntryAPI.getCardsByWordEntry).mockResolvedValue(mockCards);

      const { result } = renderHook(
        () => useWordMastery({ deckId: 'deck-1', wordEntryId: 'word-1' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.cards[0].mastery_status).toBe('none');
      expect(result.current.cards[1].mastery_status).toBe('none');
      expect(result.current.wordMasteryStatus).toBe('studied');
    });
  });
});
