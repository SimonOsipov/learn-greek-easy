// src/components/admin/DeckDetailModal.tsx

import React, { useCallback, useEffect, useState } from 'react';

import { AlertCircle, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { adminAPI } from '@/services/adminAPI';
import type {
  AdminCultureQuestion,
  AdminVocabularyCard,
  MultilingualName,
  UnifiedDeckItem,
} from '@/services/adminAPI';

import { CardDeleteDialog } from './CardDeleteDialog';

interface DeckDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deck: UnifiedDeckItem | null;
  onItemDeleted?: () => void;
}

/**
 * Get display name for a deck (handles multilingual names)
 */
function getDeckDisplayName(name: string | MultilingualName, locale: string): string {
  if (typeof name === 'string') {
    return name;
  }
  // MultilingualName has el, en, ru fields
  if (locale === 'el' && name.el) return name.el;
  if (locale === 'ru' && name.ru) return name.ru;
  return name.en || name.el || name.ru || '';
}

/**
 * Format card preview text for vocabulary cards
 */
function formatCardPreview(card: AdminVocabularyCard): string {
  return `${card.front_text} - ${card.back_text}`;
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

  const fetchItems = useCallback(async () => {
    if (!deck) return;

    setIsLoading(true);
    setError(null);

    try {
      if (deck.type === 'vocabulary') {
        const response = await adminAPI.listVocabularyCards(deck.id, page, pageSize);
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

  if (!deck) return null;

  const deckName = getDeckDisplayName(deck.name, locale);
  const isVocabulary = deck.type === 'vocabulary';
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
          className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
          data-testid="deck-detail-modal"
        >
          <DialogHeader>
            <DialogTitle data-testid="deck-detail-title">{deckName}</DialogTitle>
            <DialogDescription>{t(itemCountKey, { count: total })}</DialogDescription>
          </DialogHeader>

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-3" data-testid="deck-detail-loading">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-3">
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
            <p className="py-8 text-center text-muted-foreground" data-testid="deck-detail-empty">
              {t(noItemsKey)}
            </p>
          )}

          {/* Vocabulary Cards List */}
          {!isLoading && !error && isVocabulary && cards.length > 0 && (
            <div className="space-y-2" data-testid="vocabulary-cards-list">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  data-testid={`card-item-${card.id}`}
                >
                  <div className="flex-1 overflow-hidden pr-2">
                    <p className="truncate font-medium">{card.front_text}</p>
                    <p className="truncate text-sm text-muted-foreground">{card.back_text}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(card)}
                    className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    data-testid={`delete-card-${card.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">{t('actions.delete')}</span>
                  </Button>
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
                  <div className="flex-1 overflow-hidden pr-2">
                    <p className="truncate font-medium">
                      {question.question_text[locale] || question.question_text.en}
                    </p>
                    {question.is_pending_review && (
                      <span className="text-xs text-amber-600">
                        {t('sources.articles.alreadyGenerated')}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(question)}
                    className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    data-testid={`delete-question-${question.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">{t('actions.delete')}</span>
                  </Button>
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
    </>
  );
};
