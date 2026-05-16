// src/components/admin/decks/VocabDrawerBody.tsx
//
// Vocabulary list view rendered inside the DeckDrawer "Words" tab.
// Shows a searchable, filterable paginated list of word entries with
// per-row completion pills, gender chips, and hover actions.
// Implements DKDR-10 (ADMIN2-09).

import { useState, useCallback, useEffect } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { CardDeleteDialog } from '@/components/admin/CardDeleteDialog';
import { GenerateNounDialog } from '@/components/admin/GenerateNounDialog';
import { ChangelogPagination } from '@/components/changelog/ChangelogPagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SegControl } from '@/components/ui/seg-control';
import { getWordCompletion } from '@/lib/deckCompletion';
import {
  adminAPI,
  type AdminVocabularyCard,
  type PartOfSpeech,
  type UnifiedDeckItem,
} from '@/services/adminAPI';

import { CompletionPill } from './CompletionPill';

// ── Types ─────────────────────────────────────────────────────────────────────

type PosFilter = 'all' | 'noun' | 'verb' | 'adjective' | 'adverb';

export interface VocabDrawerBodyProps {
  deck: UnifiedDeckItem;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const GENDER_SYMBOLS: Record<string, string> = {
  feminine: '♀',
  masculine: '♂',
  neuter: '⚲',
};

// ── VocabDrawerBody ───────────────────────────────────────────────────────────

export function VocabDrawerBody({ deck }: VocabDrawerBodyProps) {
  const { t } = useTranslation('admin');
  const [, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // ── Filter state ───────────────────────────────────────────────────────────

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [posFilter, setPosFilter] = useState<PosFilter>('all');
  const [cardToDelete, setCardToDelete] = useState<AdminVocabularyCard | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [addWordOpen, setAddWordOpen] = useState(false);

  const [debouncedSearch, setDebouncedSearch] = useState(searchInput);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page when filters change
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    setPage(1);
  }, []);

  const handlePosChange = useCallback((value: PosFilter) => {
    setPosFilter(value);
    setPage(1);
  }, []);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data, isFetching } = useQuery({
    queryKey: ['deck-vocab', deck.id, page, debouncedSearch, posFilter],
    queryFn: () =>
      adminAPI.listWordEntries(deck.id, page, PAGE_SIZE, {
        search: debouncedSearch || undefined,
        partOfSpeech: posFilter !== 'all' ? (posFilter as PartOfSpeech) : undefined,
      }),
  });

  const cards = data?.cards ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Navigation helpers ─────────────────────────────────────────────────────

  const navigateToItem = useCallback(
    (card: AdminVocabularyCard) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.set('edit', deck.id);
        params.set('item', card.id);
        return params;
      });
    },
    [deck.id, setSearchParams]
  );

  // ── Delete flow ────────────────────────────────────────────────────────────

  const handleDeleteConfirm = useCallback(async () => {
    if (!cardToDelete) return;
    setIsDeleting(true);
    try {
      await adminAPI.deleteWordEntry(cardToDelete.id);
      queryClient.invalidateQueries({ queryKey: ['deck-vocab', deck.id] });
      setCardToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  }, [cardToDelete, deck.id, queryClient]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const isFiltered = !!debouncedSearch || posFilter !== 'all';
  const isEmpty = cards.length === 0 && !isFetching;

  // ── POS filter options ─────────────────────────────────────────────────────

  const posOptions = [
    { value: 'all' as PosFilter, label: 'All' },
    { value: 'noun' as PosFilter, label: 'Noun' },
    { value: 'verb' as PosFilter, label: 'Verb' },
    { value: 'adjective' as PosFilter, label: 'Adjective' },
    { value: 'adverb' as PosFilter, label: 'Adverb' },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* ── Toolbar ── */}
      <div data-testid="word-list-toolbar" className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <Input
          data-testid="word-list-search"
          type="search"
          placeholder="Search words…"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-48"
        />

        {/* POS filter */}
        <SegControl
          data-testid="word-list-pos-filter"
          options={posOptions}
          value={posFilter}
          onChange={handlePosChange}
        />

        {/* Sort placeholder */}
        <button
          type="button"
          disabled
          aria-label="Sort (coming soon)"
          className="cursor-not-allowed rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground opacity-50"
        >
          Sort
        </button>

        {/* Add word — right-aligned */}
        <div className="ml-auto">
          <Button size="sm" onClick={() => setAddWordOpen(true)} data-testid="word-list-add-word">
            {t('decks.addWord')}
          </Button>
        </div>
      </div>

      {/* ── Empty state ── */}
      {isEmpty && isFiltered && (
        <div className="placeholder-box" data-testid="word-list-empty">
          {t('decks.emptyWordsFilter')}
        </div>
      )}

      {/* ── Word rows ── */}
      {cards.length > 0 && (
        <div className="flex flex-col gap-1" role="list">
          {cards.map((card) => {
            const pills = getWordCompletion(card).filter((p) => p.visible);
            const genderSymbol =
              card.part_of_speech === 'noun' && card.gender
                ? (GENDER_SYMBOLS[card.gender] ?? null)
                : null;

            return (
              <div
                key={card.id}
                data-testid="word-row"
                role="listitem"
                className="group relative flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted/40"
                onClick={() => navigateToItem(card)}
              >
                {/* Decorative checkbox */}
                <input
                  type="checkbox"
                  disabled
                  aria-hidden="true"
                  tabIndex={-1}
                  className="mt-1 shrink-0 cursor-default"
                />

                {/* Content */}
                <div className="min-w-0 flex-1">
                  {/* First line: Greek word + POS badge + gender chip */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span lang="el" className="text-2xl font-medium leading-tight">
                      {card.front_text}
                    </span>

                    {card.part_of_speech && (
                      <Badge variant="outline" className="text-xs">
                        {card.part_of_speech}
                      </Badge>
                    )}

                    {genderSymbol && (
                      <span className="text-sm text-muted-foreground" data-testid="word-row-gender">
                        {genderSymbol}
                      </span>
                    )}
                  </div>

                  {/* Second line: IPA + EN translation */}
                  <div className="mt-0.5 flex flex-wrap items-center gap-3">
                    {card.pronunciation && (
                      <span className="text-sm text-muted-foreground">{card.pronunciation}</span>
                    )}
                    <span className="text-sm">{card.back_text_en}</span>
                  </div>

                  {/* Completion pills */}
                  {pills.length > 0 && (
                    <div className="dk-pills mt-1">
                      {pills.map((pill) => (
                        <CompletionPill key={pill.name} pill={pill} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Hover actions */}
                <div
                  className="absolute right-3 top-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    aria-label="Edit word"
                    data-testid="word-row-edit"
                    className="rounded p-1 hover:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateToItem(card);
                    }}
                  >
                    <Pencil className="size-4 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete word"
                    data-testid="word-row-delete"
                    className="rounded p-1 hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCardToDelete(card);
                    }}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <ChangelogPagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          itemsPerPage={PAGE_SIZE}
          onPageChange={setPage}
          isLoading={isFetching}
        />
      )}

      {/* ── Delete confirmation dialog ── */}
      <CardDeleteDialog
        open={!!cardToDelete}
        onOpenChange={(open) => {
          if (!open) setCardToDelete(null);
        }}
        itemPreview={cardToDelete?.front_text ?? ''}
        itemType="wordEntry"
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />

      {/* ── Add word dialog ── */}
      <GenerateNounDialog
        open={addWordOpen}
        onOpenChange={setAddWordOpen}
        deckId={deck.id}
        deckName={typeof deck.name === 'string' ? deck.name : (deck.name_en ?? '')}
        onWordLinked={() => {
          queryClient.invalidateQueries({ queryKey: ['deck-vocab', deck.id] });
        }}
      />
    </div>
  );
}
