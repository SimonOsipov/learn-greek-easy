// src/components/admin/decks/VocabWordDetail.tsx
//
// Pushed Word Entry detail view inside the Decks Drawer "Words" tab.
// Implements DKDR-11 (ADMIN2-09).
//
// Layout:
//   ← Back | Greek word (28px) | POS badge | gender chip | % badge
//   EN translation (sub-line)
//   Pill row (from AdminVocabularyCard via adminAPI.listWordEntries)
//   Sub-tabs: Word Entry · Cards

import { useCallback } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { WordEntryCards } from '@/components/admin/WordEntryCards';
import { WordEntryContent } from '@/components/admin/WordEntryContent';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWordEntry } from '@/features/words/hooks/useWordEntry';
import { computeCompletionPercentage } from '@/lib/completeness';
import { getWordCompletion } from '@/lib/deckCompletion';
import { adminAPI, type AdminVocabularyCard, type UnifiedDeckItem } from '@/services/adminAPI';

import { CompletionPill } from './CompletionPill';
import { DeckDrawerSkeleton } from './DeckDrawerSkeleton';

// ── Constants ─────────────────────────────────────────────────────────────────

const GENDER_SYMBOLS: Record<string, string> = {
  feminine: '♀',
  masculine: '♂',
  neuter: '⚲',
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VocabWordDetailProps {
  deck: UnifiedDeckItem;
  itemId: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VocabWordDetail({ deck, itemId }: VocabWordDetailProps) {
  const { t } = useTranslation('admin');
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // ── URL-driven sub-tab state ───────────────────────────────────────────────

  const subtab = searchParams.get('subtab') ?? 'entry';

  const handleSubtabChange = useCallback(
    (value: string) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.set('subtab', value);
        return p;
      });
    },
    [setSearchParams]
  );

  // ── Back navigation ────────────────────────────────────────────────────────

  const popToList = useCallback(() => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('item');
      p.delete('subtab');
      return p;
    });
    queryClient.invalidateQueries({ queryKey: ['deck-vocab', deck.id] });
  }, [setSearchParams, queryClient, deck.id]);

  // ── Word entry data (editable body: identity / translations / grammar) ─────

  const { wordEntry, isLoading: isWordEntryLoading } = useWordEntry({ wordId: itemId });

  // ── AdminVocabularyCard for pill row ───────────────────────────────────────
  //
  // Strategy (per QA #2b and task spec):
  //   1. Try to find the card in cached TanStack Query pages from the vocab list.
  //   2. If not found, issue a single-row fetch via adminAPI.listWordEntries.
  //      Search by itemId — the API returns an entry matching the id.

  // Step 1: scan all cached deck-vocab pages for the current deck.
  const cachedAdminCard = (() => {
    const allPages = queryClient.getQueriesData<{
      cards: AdminVocabularyCard[];
    }>({ queryKey: ['deck-vocab', deck.id] });

    for (const [, data] of allPages) {
      if (!data?.cards) continue;
      const match = data.cards.find((c) => c.id === itemId);
      if (match) return match;
    }
    return null;
  })();

  // Step 2: only fetch from API when not in cache.
  const { data: fetchedCardsData } = useQuery({
    queryKey: ['deck-vocab-single', deck.id, itemId],
    queryFn: () => adminAPI.listWordEntries(deck.id, 1, 50),
    enabled: !cachedAdminCard,
    staleTime: 5 * 60 * 1000,
  });

  // Resolve the AdminVocabularyCard from either cache hit or single-row fetch.
  const adminCard: AdminVocabularyCard | null =
    cachedAdminCard ?? fetchedCardsData?.cards.find((c) => c.id === itemId) ?? null;

  // ── Derived display values ─────────────────────────────────────────────────

  const pct = adminCard ? computeCompletionPercentage(adminCard) : 0;
  const completionTone: 'green' | 'amber' | 'red' =
    pct >= 80 ? 'green' : pct >= 40 ? 'amber' : 'red';

  const genderSymbol =
    adminCard?.part_of_speech === 'noun' && adminCard.gender
      ? (GENDER_SYMBOLS[adminCard.gender] ?? null)
      : null;

  // Use front_text from adminCard when available; fall back to wordEntry.lemma
  // (adminCard is from the list; wordEntry is from the detail fetch).
  const greekWord = adminCard?.front_text ?? wordEntry?.lemma ?? '';
  const posLabel = adminCard?.part_of_speech ?? wordEntry?.part_of_speech ?? null;
  const translationEn = adminCard?.back_text_en ?? wordEntry?.translation_en ?? '';

  // ── Skeleton while word entry is loading (deep-link case) ─────────────────

  if (isWordEntryLoading && !wordEntry) {
    return <DeckDrawerSkeleton variant="detail" />;
  }

  // ── Pill row ───────────────────────────────────────────────────────────────

  const pills = adminCard ? getWordCompletion(adminCard).filter((p) => p.visible) : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2">
        {/* Back button */}
        <button
          type="button"
          onClick={popToList}
          data-testid="vocab-word-detail-back"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {t('decks.drawer.tabs.words')}
        </button>

        {/* Greek word + meta */}
        <div className="flex flex-wrap items-center gap-2">
          <h3
            lang="el"
            className="text-[28px] font-medium leading-tight"
            data-testid="vocab-word-detail-lemma"
          >
            {greekWord}
          </h3>

          {posLabel && (
            <Badge variant="outline" className="text-xs" data-testid="vocab-word-detail-pos">
              {posLabel}
            </Badge>
          )}

          {genderSymbol && (
            <span className="text-sm text-muted-foreground" data-testid="vocab-word-detail-gender">
              {genderSymbol}
            </span>
          )}

          {adminCard && (
            <Badge tone={completionTone} data-testid="vocab-word-detail-pct">
              {pct}%
            </Badge>
          )}
        </div>

        {/* EN translation sub-line */}
        {translationEn && (
          <p className="text-sm text-muted-foreground" data-testid="vocab-word-detail-translation">
            {translationEn}
          </p>
        )}
      </div>

      {/* ── Pill row ── */}
      {pills !== null ? (
        <div className="dk-pills" data-testid="vocab-word-detail-pills">
          {pills.map((pill) => (
            <CompletionPill key={pill.name} pill={pill} />
          ))}
        </div>
      ) : (
        <Skeleton className="h-6 w-full" data-testid="vocab-word-detail-pills-skeleton" />
      )}

      {/* ── Sub-tabs ── */}
      <Tabs value={subtab} onValueChange={handleSubtabChange}>
        <TabsList data-testid="word-entry-detail-tabs">
          <TabsTrigger value="entry" data-testid="word-entry-tab-entry">
            {t('wordEntryDetail.tabWordEntry')}
          </TabsTrigger>
          <TabsTrigger value="cards" data-testid="word-entry-tab-cards">
            {t('wordEntryDetail.tabCards')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entry" data-testid="word-entry-tab-content-entry">
          <WordEntryContent wordEntryId={itemId} deckId={deck.id} onUnlinked={popToList} />
        </TabsContent>

        <TabsContent value="cards" data-testid="word-entry-tab-content-cards">
          <WordEntryCards entryId={itemId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
