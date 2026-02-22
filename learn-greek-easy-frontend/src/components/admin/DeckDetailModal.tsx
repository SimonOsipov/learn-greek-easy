// src/components/admin/DeckDetailModal.tsx

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { AlertCircle, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import {
  trackAdminWordEntryDetailOpened,
  trackAdminWordEntryDetailTabSwitched,
} from '@/lib/analytics/adminAnalytics';
import { getLocalizedDeckName } from '@/lib/deckLocale';
import { cn } from '@/lib/utils';
import { adminAPI } from '@/services/adminAPI';
import type {
  AdminCultureQuestion,
  AdminVocabularyCard,
  MultilingualName,
  UnifiedDeckItem,
} from '@/services/adminAPI';

import { CardCreateModal } from './CardCreateModal';
import { CardDeleteDialog } from './CardDeleteDialog';
import { CardEditModal } from './CardEditModal';
import { VocabularyCardCreateModal, VocabularyCardEditModal } from './vocabulary';
import { WordEntryCards } from './WordEntryCards';
import { WordEntryContent } from './WordEntryContent';

interface DeckDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deck: UnifiedDeckItem | null;
  onItemDeleted?: () => void;
}

/**
 * Get display name for a deck (handles multilingual names)
 * Uses shared getLocalizedDeckName for flat fields; falls back to
 * MultilingualName for legacy support.
 */
function getDeckDisplayName(
  deck: { name?: string | MultilingualName; name_en?: string; name_ru?: string },
  locale: string
): string {
  // If flat bilingual fields are available, prefer them
  if (deck.name_en || deck.name_ru) {
    return getLocalizedDeckName(deck as { name_en?: string; name_ru?: string }, locale);
  }
  // Fallback to MultilingualName object
  const name = deck.name;
  if (typeof name === 'string') {
    return name;
  }
  if (name) {
    if (locale === 'ru' && name.ru) return name.ru;
    return name.en || name.ru || '';
  }
  return '';
}

/**
 * Format card preview text for vocabulary cards
 */
function formatCardPreview(card: AdminVocabularyCard): string {
  return `${card.front_text} - ${card.back_text_en}`;
}

/**
 * Format question preview text for culture questions
 */
function formatQuestionPreview(question: AdminCultureQuestion, locale: string): string {
  const questionText = question.question_text[locale] || question.question_text.en || '';
  return questionText.length > 80 ? `${questionText.substring(0, 80)}...` : questionText;
}

/**
 * Modal showing all cards/questions in a deck with delete functionality.
 *
 * Displays:
 * - Deck name and item count
 * - List of cards (vocabulary) or questions (culture)
 * - Delete button for each item
 * - Pagination for large decks
 */
export const DeckDetailModal: React.FC<DeckDetailModalProps> = ({
  open,
  onOpenChange,
  deck,
  onItemDeleted,
}) => {
  const { t, i18n } = useTranslation('admin');
  const locale = i18n.language;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  // Vocabulary cards state
  const [cards, setCards] = useState<AdminVocabularyCard[]>([]);

  // Culture questions state
  const [questions, setQuestions] = useState<AdminCultureQuestion[]>([]);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<
    AdminVocabularyCard | AdminCultureQuestion | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit modal state (culture questions)
  const [editingCard, setEditingCard] = useState<AdminCultureQuestion | null>(null);

  // Create modal state (culture questions)
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Vocabulary card modal state
  const [vocabularyCreateModalOpen, setVocabularyCreateModalOpen] = useState(false);
  const [vocabularyEditModalOpen, setVocabularyEditModalOpen] = useState(false);
  const [selectedVocabularyCardId, setSelectedVocabularyCardId] = useState<string | null>(null);

  // Word entry detail view state
  const [selectedWordEntry, setSelectedWordEntry] = useState<AdminVocabularyCard | null>(null);
  const scrollPositionRef = useRef<number>(0);
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const clickedRowIdRef = useRef<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!deck) return;

    setIsLoading(true);
    setError(null);

    try {
      if (deck.type === 'vocabulary') {
        const response =
          deck.card_system === 'V2'
            ? await adminAPI.listWordEntries(deck.id, page, pageSize)
            : await adminAPI.listVocabularyCards(deck.id, page, pageSize);
        setCards(response.cards);
        setTotal(response.total);
        setQuestions([]);
      } else {
        const response = await adminAPI.listCultureQuestions(deck.id, page, pageSize);
        setQuestions(response.questions);
        setTotal(response.total);
        setCards([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.loadingDecks');
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [deck, page, t]);

  // Fetch items when modal opens or page changes
  useEffect(() => {
    if (open && deck) {
      fetchItems();
    }
  }, [open, deck, fetchItems]);

  // Reset page when deck changes
  useEffect(() => {
    setPage(1);
    setSelectedWordEntry(null);
  }, [deck?.id]);

  const totalPages = Math.ceil(total / pageSize);

  const handleDeleteClick = (item: AdminVocabularyCard | AdminCultureQuestion) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete || !deck) return;

    setIsDeleting(true);

    try {
      if (deck.type === 'vocabulary') {
        await adminAPI.deleteVocabularyCard(itemToDelete.id);
        toast({
          title: t('cardDelete.successCard'),
        });
      } else {
        await adminAPI.deleteCultureQuestion(itemToDelete.id);
        toast({
          title: t('cardDelete.successQuestion'),
        });
      }

      // Close delete dialog
      setDeleteDialogOpen(false);
      setItemToDelete(null);

      // Refresh the list
      await fetchItems();

      // Notify parent to refresh deck counts
      onItemDeleted?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('cardDelete.error');
      toast({
        title: t('cardDelete.error'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteDialogClose = (openState: boolean) => {
    if (!openState) {
      setItemToDelete(null);
    }
    setDeleteDialogOpen(openState);
  };

  const handleWordEntryClick = (card: AdminVocabularyCard) => {
    if (dialogContentRef.current) {
      scrollPositionRef.current = dialogContentRef.current.scrollTop;
    }
    clickedRowIdRef.current = card.id;
    setSelectedWordEntry(card);
    trackAdminWordEntryDetailOpened({
      word_entry_id: card.id,
      deck_id: deck!.id,
      lemma: card.front_text,
      part_of_speech: card.part_of_speech,
    });
  };

  const handleBack = useCallback(() => {
    setSelectedWordEntry(null);
    requestAnimationFrame(() => {
      if (dialogContentRef.current) {
        dialogContentRef.current.scrollTop = scrollPositionRef.current;
      }
      if (clickedRowIdRef.current) {
        const row = document.querySelector(
          `[data-testid="word-entry-row-${clickedRowIdRef.current}"]`
        );
        if (row instanceof HTMLElement) row.focus();
        clickedRowIdRef.current = null;
      }
    });
  }, []);

  // Focus management for word entry detail view
  useEffect(() => {
    if (selectedWordEntry && backButtonRef.current) {
      backButtonRef.current.focus();
    }
  }, [selectedWordEntry]);

  if (!deck) return null;

  const deckName = getDeckDisplayName(deck, locale);
  const isVocabulary = deck.type === 'vocabulary';
  const isV2Vocabulary = isVocabulary && deck.card_system === 'V2';
  const itemCountKey = isVocabulary ? 'deckDetail.cardsCount' : 'deckDetail.questionsCount';
  const noItemsKey = isVocabulary ? 'deckDetail.noCards' : 'deckDetail.noQuestions';

  // Get preview text for delete dialog
  const getItemPreview = (): string => {
    if (!itemToDelete) return '';
    if (isVocabulary) {
      return formatCardPreview(itemToDelete as AdminVocabularyCard);
    }
    return formatQuestionPreview(itemToDelete as AdminCultureQuestion, locale);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          ref={dialogContentRef}
          className="max-h-[85vh] overflow-y-auto sm:max-w-4xl"
          data-testid="deck-detail-modal"
          hideCloseButton
          onEscapeKeyDown={(e) => {
            if (selectedWordEntry) {
              e.preventDefault();
              handleBack();
            }
          }}
        >
          {selectedWordEntry ? (
            <>
              <DialogHeader>
                <Button
                  ref={backButtonRef}
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="mb-2 w-fit"
                  data-testid="word-entry-detail-back"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  {t('wordEntryDetail.back')}
                </Button>
                <div data-testid="word-entry-detail-header">
                  <div className="flex items-center gap-2">
                    <DialogTitle data-testid="deck-detail-title">
                      {selectedWordEntry.front_text}
                    </DialogTitle>
                    {selectedWordEntry.part_of_speech && (
                      <Badge variant="secondary">{selectedWordEntry.part_of_speech}</Badge>
                    )}
                  </div>
                  <DialogDescription>{selectedWordEntry.back_text_en}</DialogDescription>
                </div>
              </DialogHeader>
              <div data-testid="word-entry-detail-view">
                <Tabs
                  key={selectedWordEntry.id}
                  defaultValue="entry"
                  data-testid="word-entry-detail-tabs"
                  onValueChange={(value) =>
                    trackAdminWordEntryDetailTabSwitched({
                      word_entry_id: selectedWordEntry.id,
                      tab: value,
                    })
                  }
                >
                  <TabsList className="w-full">
                    <TabsTrigger
                      value="entry"
                      className="flex-1"
                      data-testid="word-entry-tab-entry"
                    >
                      {t('wordEntryDetail.tabWordEntry')}
                    </TabsTrigger>
                    <TabsTrigger
                      value="cards"
                      className="flex-1"
                      data-testid="word-entry-tab-cards"
                    >
                      {t('wordEntryDetail.tabCards')}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="entry" data-testid="word-entry-tab-content-entry">
                    <WordEntryContent wordEntryId={selectedWordEntry.id} />
                  </TabsContent>
                  <TabsContent value="cards" data-testid="word-entry-tab-content-cards">
                    <WordEntryCards entryId={selectedWordEntry.id} />
                  </TabsContent>
                </Tabs>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle data-testid="deck-detail-title">{deckName}</DialogTitle>
                    <DialogDescription>{t(itemCountKey, { count: total })}</DialogDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      isVocabulary ? setVocabularyCreateModalOpen(true) : setCreateModalOpen(true)
                    }
                    data-testid="create-card-btn"
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    {t('deckDetail.createCard')}
                  </Button>
                </div>
              </DialogHeader>

              {/* Loading State */}
              {isLoading && (
                <div className="space-y-3" data-testid="deck-detail-loading">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  ))}
                </div>
              )}

              {/* Error State */}
              {error && !isLoading && (
                <Alert variant="destructive" data-testid="deck-detail-error">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Empty State */}
              {!isLoading && !error && total === 0 && (
                <p
                  className="py-8 text-center text-muted-foreground"
                  data-testid="deck-detail-empty"
                >
                  {t(noItemsKey)}
                </p>
              )}

              {/* Vocabulary Cards List */}
              {!isLoading && !error && isVocabulary && cards.length > 0 && (
                <div className="space-y-2" data-testid="vocabulary-cards-list">
                  {cards.map((card) => (
                    <div
                      key={card.id}
                      className={cn(
                        'flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50',
                        isV2Vocabulary && 'cursor-pointer'
                      )}
                      data-testid={
                        isV2Vocabulary ? `word-entry-row-${card.id}` : `card-item-${card.id}`
                      }
                      {...(isV2Vocabulary && {
                        onClick: (e: React.MouseEvent) => {
                          if ((e.target as HTMLElement).closest('button')) return;
                          handleWordEntryClick(card);
                        },
                        role: 'button' as const,
                        tabIndex: 0,
                        onKeyDown: (e: React.KeyboardEvent) => {
                          if ((e.target as HTMLElement).closest('button')) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleWordEntryClick(card);
                          }
                        },
                      })}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium">{card.front_text}</p>
                          {card.part_of_speech && (
                            <Badge
                              variant="secondary"
                              className="shrink-0"
                              data-testid={`vocabulary-card-pos-badge-${card.id}`}
                            >
                              {card.part_of_speech}
                            </Badge>
                          )}
                          {card.level && card.level !== deck?.level && (
                            <Badge
                              variant="outline"
                              className="shrink-0"
                              data-testid={`vocabulary-card-level-badge-${card.id}`}
                            >
                              {card.level}
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-sm text-muted-foreground">
                          {card.back_text_en}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (isV2Vocabulary) {
                              handleWordEntryClick(card);
                            } else {
                              setSelectedVocabularyCardId(card.id);
                              setVocabularyEditModalOpen(true);
                            }
                          }}
                          data-testid={`vocabulary-card-edit-${card.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">{t('actions.edit')}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(card)}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          data-testid={`delete-card-${card.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">{t('actions.delete')}</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Culture Questions List */}
              {!isLoading && !error && !isVocabulary && questions.length > 0 && (
                <div className="space-y-2" data-testid="culture-questions-list">
                  {questions.map((question) => (
                    <div
                      key={question.id}
                      className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                      data-testid={`question-item-${question.id}`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="break-words font-medium">
                          {question.question_text[locale] || question.question_text.en}
                        </p>
                        {question.is_pending_review && (
                          <span className="text-xs text-amber-600">
                            {t('sources.articles.alreadyGenerated')}
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingCard(question)}
                          data-testid={`edit-question-${question.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">{t('actions.edit')}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(question)}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          data-testid={`delete-question-${question.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">{t('actions.delete')}</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {!isLoading && !error && total > pageSize && (
                <div className="mt-4 flex items-center justify-between border-t pt-4">
                  <p className="text-sm text-muted-foreground">
                    {t('pagination.showing', {
                      from: (page - 1) * pageSize + 1,
                      to: Math.min(page * pageSize, total),
                      total,
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p - 1)}
                      disabled={page === 1}
                      data-testid="deck-detail-prev"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {t('pagination.previous')}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {t('pagination.pageOf', { page, totalPages })}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= totalPages}
                      data-testid="deck-detail-next"
                    >
                      {t('pagination.next')}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Close Button */}
          <div className="flex justify-end border-t pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="deck-detail-close"
            >
              {t('deckDetail.close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Card/Question Delete Dialog */}
      <CardDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={handleDeleteDialogClose}
        itemPreview={getItemPreview()}
        itemType={isVocabulary ? 'card' : 'question'}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      {/* Culture Question Edit Modal */}
      <CardEditModal
        open={!!editingCard}
        onOpenChange={(open) => {
          if (!open) setEditingCard(null);
        }}
        onSuccess={() => {
          setEditingCard(null);
          fetchItems();
        }}
        question={editingCard}
      />

      {/* Culture Card Create Modal */}
      {!isVocabulary && deck && (
        <CardCreateModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          deckId={deck.id}
          onSuccess={() => {
            fetchItems();
            onItemDeleted?.(); // Refresh parent deck counts
          }}
        />
      )}

      {/* Vocabulary Card Create Modal */}
      {isVocabulary && deck && (
        <VocabularyCardCreateModal
          open={vocabularyCreateModalOpen}
          onOpenChange={setVocabularyCreateModalOpen}
          deckId={deck.id}
          deckLevel={deck.level ?? undefined}
          onSuccess={() => {
            fetchItems();
            onItemDeleted?.(); // Refresh parent deck counts
          }}
        />
      )}

      {/* Vocabulary Card Edit Modal */}
      {isVocabulary && deck && selectedVocabularyCardId && (
        <VocabularyCardEditModal
          open={vocabularyEditModalOpen}
          onOpenChange={(open) => {
            setVocabularyEditModalOpen(open);
            if (!open) setSelectedVocabularyCardId(null);
          }}
          cardId={selectedVocabularyCardId}
          deckId={deck.id}
          deckLevel={deck.level ?? undefined}
          onSuccess={() => {
            fetchItems();
          }}
        />
      )}
    </>
  );
};
