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

const GENDER_LABELS: Record<string, string> = {
  feminine: 'feminine',
  masculine: 'masculine',
  neuter: 'neuter',
};

const GENDER_VARIANT_CLASS: Record<string, string> = {
  feminine: 'dk-gender-f',
  masculine: 'dk-gender-m',
  neuter: 'dk-gender-n',
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

  // Normalize to a valid union so an invalid/garbage value (e.g. ?subtab=foo)
  // never leaves both tabs unselected — default to 'entry'.
  const subtab = searchParams.get('subtab') === 'cards' ? 'cards' : 'entry';

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

  const genderRaw =
    adminCard?.part_of_speech === 'noun' && adminCard.gender ? adminCard.gender : null;
  const genderSymbol = genderRaw ? (GENDER_SYMBOLS[genderRaw] ?? null) : null;
  const genderLabel = genderRaw ? (GENDER_LABELS[genderRaw] ?? genderRaw) : null;
  const genderVariantClass = genderRaw ? (GENDER_VARIANT_CLASS[genderRaw] ?? 'dk-gender-n') : '';

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
          {t('wordEntryDetail.back')}
        </button>

        {/* Greek word + meta */}
        <div className="flex flex-wrap items-center gap-2">
          <h3 lang="el" className="dk-word" data-testid="vocab-word-detail-lemma">
            {greekWord}
          </h3>

          {posLabel && (
            <span className="badge b-gray" data-testid="vocab-word-detail-pos">
              {posLabel}
            </span>
          )}

          {genderSymbol && genderLabel && (
            <span
              className={`dk-gender ${genderVariantClass}`}
              data-testid="vocab-word-detail-gender"
            >
              {genderSymbol} {genderLabel}
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

      {/* ── Sub-tabs (F11 — segmented control) ── */}
      <div className="dk-segtabs" role="tablist" data-testid="word-entry-detail-tabs">
        <button
          type="button"
          role="tab"
          id="word-entry-tab-entry"
          aria-selected={subtab === 'entry'}
          aria-controls="word-entry-tab-content-entry"
          className={subtab === 'entry' ? 'dk-segtab is-active' : 'dk-segtab'}
          onClick={() => handleSubtabChange('entry')}
          data-testid="word-entry-tab-entry"
        >
          {t('wordEntryDetail.tabWordEntry')}
        </button>
        <button
          type="button"
          role="tab"
          id="word-entry-tab-cards"
          aria-selected={subtab === 'cards'}
          aria-controls="word-entry-tab-content-cards"
          className={subtab === 'cards' ? 'dk-segtab is-active' : 'dk-segtab'}
          onClick={() => handleSubtabChange('cards')}
          data-testid="word-entry-tab-cards"
        >
          {t('wordEntryDetail.tabCards')}
        </button>
      </div>

      <div
        role="tabpanel"
        id="word-entry-tab-content-entry"
        aria-labelledby="word-entry-tab-entry"
        hidden={subtab !== 'entry'}
        className="mt-2"
        data-testid="word-entry-tab-content-entry"
      >
        <WordEntryContent wordEntryId={itemId} enabled={subtab === 'entry'} />
      </div>

      <div
        role="tabpanel"
        id="word-entry-tab-content-cards"
        aria-labelledby="word-entry-tab-cards"
        hidden={subtab !== 'cards'}
        className="mt-2"
        data-testid="word-entry-tab-content-cards"
      >
        <WordEntryCards entryId={itemId} enabled={subtab === 'cards'} />
      </div>
    </div>
  );
}
