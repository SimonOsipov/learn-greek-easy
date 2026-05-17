// src/components/admin/decks/CultureDrawerBody.tsx
//
// Culture question list view rendered inside the DeckDrawer "Questions" tab.
// Shows a searchable paginated list of culture questions with completion pills,
// a News badge, and hover actions.
// Implements DKDR-12 (ADMIN2-09).

import { useState, useCallback, useEffect } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { CardDeleteDialog } from '@/components/admin/CardDeleteDialog';
import { CultureCardForm } from '@/components/admin/CultureCardForm';
import { ChangelogPagination } from '@/components/changelog/ChangelogPagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getCultureCompletion } from '@/lib/deckCompletion';
import {
  adminAPI,
  type AdminCultureQuestion,
  type CultureQuestionCreatePayload,
  type UnifiedDeckItem,
} from '@/services/adminAPI';

import { CompletionPill } from './CompletionPill';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CultureDrawerBodyProps {
  deck: UnifiedDeckItem;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolve display text for a multilingual question_text record.
 * Fallback chain: en → el → ru → '—'
 */
function resolveQuestionText(question_text: Record<string, string>): string {
  return question_text['en'] ?? question_text['el'] ?? question_text['ru'] ?? '—';
}

// ── CultureDrawerBody ─────────────────────────────────────────────────────────

export function CultureDrawerBody({ deck }: CultureDrawerBodyProps) {
  const { t } = useTranslation('admin');
  const [, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // ── Filter state ───────────────────────────────────────────────────────────

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<AdminCultureQuestion | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [debouncedSearch, setDebouncedSearch] = useState(searchInput);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page when search changes
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    setPage(1);
  }, []);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data, isFetching } = useQuery({
    queryKey: ['deck-culture', deck.id, page, debouncedSearch],
    queryFn: () =>
      adminAPI.listCultureQuestions(deck.id, page, PAGE_SIZE, {
        search: debouncedSearch || undefined,
      }),
  });

  const questions = data?.questions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Navigation helpers ─────────────────────────────────────────────────────

  const navigateToItem = useCallback(
    (question: AdminCultureQuestion) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.set('edit', deck.id);
        params.set('item', question.id);
        return params;
      });
    },
    [deck.id, setSearchParams]
  );

  // ── Create flow ────────────────────────────────────────────────────────────

  const handleCreate = useCallback(
    async (data: CultureQuestionCreatePayload) => {
      setIsCreating(true);
      try {
        await adminAPI.createCultureQuestion(data);
        await queryClient.invalidateQueries({ queryKey: ['deck-culture', deck.id] });
        setShowAddDialog(false);
      } finally {
        setIsCreating(false);
      }
    },
    [deck.id, queryClient]
  );

  // ── Delete flow ────────────────────────────────────────────────────────────

  const handleDeleteConfirm = useCallback(async () => {
    if (!questionToDelete) return;
    setIsDeleting(true);
    try {
      await adminAPI.deleteCultureQuestion(questionToDelete.id);
      queryClient.invalidateQueries({ queryKey: ['deck-culture', deck.id] });
      setQuestionToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  }, [questionToDelete, deck.id, queryClient]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const isFiltered = !!debouncedSearch;
  const isEmpty = questions.length === 0 && !isFetching;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* ── Toolbar ── */}
      <div data-testid="question-list-toolbar" className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <Input
          data-testid="question-list-search"
          type="search"
          placeholder="Search questions…"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-48"
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

        {/* Add question — right-aligned */}
        <div className="ml-auto">
          <Button
            size="sm"
            onClick={() => setShowAddDialog(true)}
            data-testid="question-list-add-question"
          >
            {t('decks.addQuestion')}
          </Button>
        </div>
      </div>

      {/* ── Empty state ── */}
      {isEmpty && isFiltered && (
        <div className="placeholder-box" data-testid="question-list-empty">
          {t('decks.emptyQuestionsFilter')}
        </div>
      )}

      {/* ── Question rows ── */}
      {questions.length > 0 && (
        <div className="flex flex-col gap-1" role="list">
          {questions.map((question) => {
            const pills = getCultureCompletion(question).filter((p) => p.visible);
            const displayText = resolveQuestionText(question.question_text);

            return (
              <div
                key={question.id}
                data-testid="question-row"
                role="listitem"
                className="group relative flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted/40"
                onClick={() => navigateToItem(question)}
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
                  {/* Question text in English */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span lang="en" className="text-base font-medium leading-tight">
                      {displayText}
                    </span>
                  </div>

                  {/* Completion pills + News badge */}
                  {(pills.length > 0 || question.original_article_url) && (
                    <div className="dk-pills mt-1 flex flex-wrap items-center gap-1">
                      {pills.map((pill) => (
                        <CompletionPill key={pill.name} pill={pill} />
                      ))}

                      {question.original_article_url && (
                        <Badge variant="outline" data-testid="question-row-news-badge">
                          News
                        </Badge>
                      )}
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
                    aria-label={t('decks.culture.editQuestionLabel')}
                    data-testid="question-row-edit"
                    className="rounded p-1 hover:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateToItem(question);
                    }}
                  >
                    <Pencil className="size-4 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    aria-label={t('decks.culture.deleteQuestionLabel')}
                    data-testid="question-row-delete"
                    className="rounded p-1 hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQuestionToDelete(question);
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
        open={!!questionToDelete}
        onOpenChange={(open) => {
          if (!open) setQuestionToDelete(null);
        }}
        itemPreview={questionToDelete ? resolveQuestionText(questionToDelete.question_text) : ''}
        itemType="question"
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />

      {/* ── Add question dialog ── */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('decks.addQuestion')}</DialogTitle>
          </DialogHeader>
          <CultureCardForm onSubmit={handleCreate} deckId={deck.id} isSubmitting={isCreating} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
