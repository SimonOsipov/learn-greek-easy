import { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';

import { progressAPI } from '@/services/progressAPI';
import type { WordMasteryItem } from '@/services/progressAPI';
import type { CardRecordType } from '@/services/wordEntryAPI';

import { useWordEntryCards } from './useWordEntryCards';

export type MasteryStatus = 'none' | 'studied' | 'mastered';

export interface CardMasteryItem {
  card_type: CardRecordType;
  front_content: Record<string, unknown>;
  back_content: Record<string, unknown>;
  mastery_status: MasteryStatus;
}

export interface UseWordMasteryOptions {
  deckId: string;
  wordEntryId: string;
  enabled?: boolean;
}

export interface UseWordMasteryResult {
  cards: CardMasteryItem[];
  wordMasteryStatus: MasteryStatus;
  isLoading: boolean;
  error: Error | null;
  isError: boolean;
  refetch: () => Promise<void>;
}

function deriveMasteryStatus(mastery: WordMasteryItem | null | undefined): MasteryStatus {
  if (!mastery) return 'none';
  if (mastery.total_count > 0 && mastery.mastered_count >= mastery.total_count) return 'mastered';
  if (mastery.mastered_count > 0 || mastery.studied_count > 0) return 'studied';
  return 'none';
}

export function useWordMastery({
  deckId,
  wordEntryId,
  enabled = true,
}: UseWordMasteryOptions): UseWordMasteryResult {
  const masteryQuery = useQuery({
    queryKey: ['wordMastery', deckId],
    queryFn: () => progressAPI.getWordMastery(deckId),
    enabled: enabled && !!deckId && !!wordEntryId,
    staleTime: 5 * 60 * 1000,
    select: (data) => data.items.find((item) => item.word_entry_id === wordEntryId) ?? null,
  });

  const {
    cards: cardRecords,
    isLoading: cardsLoading,
    error: cardsError,
    isError: cardsIsError,
    refetch: cardsRefetch,
  } = useWordEntryCards({
    wordEntryId,
    enabled: enabled && !!wordEntryId,
  });

  const refetch = async () => {
    await Promise.all([masteryQuery.refetch(), cardsRefetch()]);
  };

  const mergedCards = useMemo(() => {
    if (!cardRecords.length) return [];
    const mastery = masteryQuery.data;
    return cardRecords
      .filter((card) => card.is_active)
      .map((card) => ({
        card_type: card.card_type,
        front_content: card.front_content,
        back_content: card.back_content,
        mastery_status: deriveMasteryStatus(mastery),
      }));
  }, [cardRecords, masteryQuery.data]);

  const wordMasteryStatus = useMemo(() => {
    return deriveMasteryStatus(masteryQuery.data ?? null);
  }, [masteryQuery.data]);

  return {
    cards: mergedCards,
    wordMasteryStatus,
    isLoading: masteryQuery.isLoading || cardsLoading,
    error: masteryQuery.error ?? cardsError,
    isError: masteryQuery.isError || cardsIsError,
    refetch,
  };
}
