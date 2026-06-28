// src/components/admin/decks/VocabDrawerBody.tsx
//
// Vocabulary list view rendered inside the DeckDrawer "Words" tab.
// Shows a searchable, filterable paginated list of word entries with
// per-row completion pills, gender chips, and hover actions.
// Implements DKDR-10 (ADMIN2-09).

import { useState, useCallback, useEffect } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Search, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { CardDeleteDialog } from '@/components/admin/CardDeleteDialog';
import { LexgenSubmitDialog } from '@/components/admin/LexgenSubmitDialog';
import { ChangelogPagination } from '@/components/changelog/ChangelogPagination';
import { SegControl } from '@/components/ui/seg-control';
import { toast } from '@/hooks/use-toast';
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
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const GENDER_SYMBOLS: Record<string, string> = {
  feminine: '♀',
  masculine: '♂',
  neuter: '⚲',
};

// ── VocabDrawerBody ───────────────────────────────────────────────────────────

export function VocabDrawerBody({ deck, addOpen, onAddOpenChange }: VocabDrawerBodyProps) {
  const { t } = useTranslation('admin');
  const [, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // ── Filter state ───────────────────────────────────────────────────────────

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [posFilter, setPosFilter] = useState<PosFilter>('all');
  const [cardToDelete, setCardToDelete] = useState<AdminVocabularyCard | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      toast({ title: t('cardDelete.successWordEntry'), variant: 'success' });
    } catch {
      toast({ title: t('cardDelete.error'), variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  }, [cardToDelete, deck.id, queryClient, t]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const isFiltered = !!debouncedSearch || posFilter !== 'all';
  const isEmpty = cards.length === 0 && !isFetching;

  // ── POS filter options ─────────────────────────────────────────────────────

  const posOptions = [
    { value: 'all' as PosFilter, label: t('decks.drawer.pos.all') },
    { value: 'noun' as PosFilter, label: t('decks.drawer.pos.noun') },
    { value: 'verb' as PosFilter, label: t('decks.drawer.pos.verb') },
    { value: 'adjective' as PosFilter, label: t('decks.drawer.pos.adjective') },
    { value: 'adverb' as PosFilter, label: t('decks.drawer.pos.adverb') },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* ── Toolbar ── */}
      <div data-testid="word-list-toolbar" className="flex flex-wrap items-center gap-2">
        {/* Search — CD .news-search: full-width, radius 10, bg --bg, border --fg/.1 */}
        <div className="news-search">
          <Search className="search-icon" aria-hidden="true" />
          <input
            data-testid="word-list-search"
            type="text"
            placeholder={t('decks.drawer.searchWords')}
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleSearchChange('');
            }}
          />
          {searchInput && (
            <button
              type="button"
              className="icon-btn icon-btn-sm clear-btn"
              onClick={() => handleSearchChange('')}
              aria-label="Clear"
            >
              <X />
            </button>
          )}
        </div>

        {/* POS filter */}
        <SegControl
          data-testid="word-list-pos-filter"
          options={posOptions}
          value={posFilter}
          onChange={handlePosChange}
        />
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
                className="dk-card-item group"
                onClick={() => navigateToItem(card)}
              >
                {/* Column 1 (20px): Decorative checkbox */}
                <input
                  type="checkbox"
                  disabled
                  aria-hidden="true"
                  tabIndex={-1}
                  className="mt-1 cursor-default"
                />

                {/* Column 2 (1fr): Content */}
                <div className="min-w-0">
                  {/* First line: Greek word + POS badge + gender chip */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span lang="el" className="dk-word">
                      {card.front_text}
                    </span>

                    {card.part_of_speech && (
                      <span className="badge b-gray">{card.part_of_speech}</span>
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

                {/* Column 3 (auto): Hover actions */}
                <div
                  className="flex items-center gap-1 self-start opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    aria-label={t('decks.vocab.editWordLabel')}
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
                    aria-label={t('decks.vocab.deleteWordLabel')}
                    data-testid="word-row-delete"
                    className="rounded p-1 hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCardToDelete(card);
                    }}
                  >
                    <Trash2 className="size-4 text-destructive" />
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

      {/* ── Add word dialog (open state lifted to DeckDrawer) ── */}
      <LexgenSubmitDialog open={addOpen} onOpenChange={onAddOpenChange} />
    </div>
  );
}
