/**
 * CardCreateModal - Modal for creating culture cards.
 *
 * Features:
 * - Card type dropdown (Culture or Vocabulary) when no deckId
 * - Deck dropdown for selecting target deck when no deckId
 * - CultureCardForm integration
 * - Success state with Create Another/Done buttons
 * - Cancel confirmation for unsaved changes
 */

import { useCallback, useEffect, useState } from 'react';

import { CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import type {
  CultureDeckListItem,
  CultureQuestionCreatePayload,
  UnifiedDeckItem,
} from '@/services/adminAPI';
import { adminAPI } from '@/services/adminAPI';

import { CultureCardForm } from './CultureCardForm';
import { AlertDialog } from '../dialogs/AlertDialog';

// ============================================
// Types
// ============================================

type CardType = 'culture' | 'vocabulary';
type ViewState = 'form' | 'success';

export interface CardCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId?: string;
  onSuccess?: () => void;
}

// ============================================
// Component
// ============================================

export function CardCreateModal({ open, onOpenChange, deckId, onSuccess }: CardCreateModalProps) {
  const { t } = useTranslation('admin');

  // State
  const [view, setView] = useState<ViewState>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [cardType, setCardType] = useState<CardType>('culture');
  const [decks, setDecks] = useState<CultureDeckListItem[]>([]);
  const [vocabularyDecks, setVocabularyDecks] = useState<UnifiedDeckItem[]>([]);
  const [isLoadingDecks, setIsLoadingDecks] = useState(false);
  const [formKey, setFormKey] = useState(0);

  // Determine effective deck ID
  const effectiveDeckId = deckId || selectedDeckId;

  // Compute which decks to show based on card type
  const decksToShow = cardType === 'vocabulary' ? vocabularyDecks : decks;

  // Helper to get deck name as string (vocabulary decks may have MultilingualName)
  const getDeckName = (deck: CultureDeckListItem | UnifiedDeckItem): string => {
    return typeof deck.name === 'string' ? deck.name : deck.name.en;
  };

  // Fetch decks when modal opens (only when no deckId prop)
  useEffect(() => {
    if (open && !deckId) {
      setIsLoadingDecks(true);
      adminAPI
        .getCultureDecks()
        .then((fetchedDecks) => {
          setDecks(fetchedDecks);
        })
        .catch(() => {
          toast({
            title: t('errors.loadingDecks'),
            variant: 'destructive',
          });
        })
        .finally(() => {
          setIsLoadingDecks(false);
        });
    }
  }, [open, deckId, t]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      // Delay reset to allow close animation
      const timeout = setTimeout(() => {
        setView('form');
        setIsDirty(false);
        setSelectedDeckId('');
        setCardType('culture');
        setFormKey((prev) => prev + 1);
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [open]);

  // Fetch vocabulary decks when card type changes to vocabulary
  useEffect(() => {
    // Reset selected deck when card type changes
    setSelectedDeckId('');

    if (cardType === 'vocabulary') {
      adminAPI.listDecks({ type: 'vocabulary' }).then((res) => {
        setVocabularyDecks(res.decks);
      });
    }
  }, [cardType]);

  // Handle dirty state changes from form
  const handleDirtyChange = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  // Handle form submission
  const handleSubmit = async (data: CultureQuestionCreatePayload) => {
    setIsSubmitting(true);
    try {
      await adminAPI.createCultureQuestion({
        ...data,
        deck_id: effectiveDeckId,
      });
      setView('success');
      setIsDirty(false);
    } catch {
      toast({
        title: t('errors.createFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel button click
  const handleCancel = () => {
    if (isDirty) {
      setShowCancelConfirm(true);
    } else {
      onOpenChange(false);
    }
  };

  // Handle discard confirmation
  const handleDiscard = () => {
    setShowCancelConfirm(false);
    setIsDirty(false);
    onOpenChange(false);
  };

  // Handle "Create Another" button
  const handleCreateAnother = () => {
    setView('form');
    setFormKey((prev) => prev + 1);
  };

  // Handle "Done" button
  const handleDone = () => {
    onOpenChange(false);
    onSuccess?.();
  };

  // Prevent closing when dirty
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isDirty) {
      setShowCancelConfirm(true);
      return;
    }
    onOpenChange(newOpen);
  };

  // Check if form can be submitted
  const canSubmit = effectiveDeckId && !isSubmitting;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[600px]" data-testid="card-create-modal">
          {view === 'form' ? (
            <>
              <DialogHeader>
                <DialogTitle>{t('cardCreate.title')}</DialogTitle>
                <DialogDescription>{t('cardCreate.description')}</DialogDescription>
              </DialogHeader>

              {/* Card Type and Deck Selection - only when no deckId prop */}
              {!deckId && (
                <div className="space-y-4">
                  {/* Card Type Dropdown */}
                  <div className="space-y-2">
                    <Label htmlFor="card-type-select">{t('cardCreate.cardType')}</Label>
                    <Select
                      value={cardType}
                      onValueChange={(value: CardType) => setCardType(value)}
                    >
                      <SelectTrigger id="card-type-select" data-testid="card-type-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="culture">{t('cardCreate.culture')}</SelectItem>
                        <SelectItem value="vocabulary">{t('cardCreate.vocabulary')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Deck Dropdown */}
                  <div className="space-y-2">
                    <Label htmlFor="deck-select">{t('cardCreate.selectDeck')}</Label>
                    <Select
                      value={selectedDeckId}
                      onValueChange={setSelectedDeckId}
                      disabled={isLoadingDecks}
                    >
                      <SelectTrigger id="deck-select" data-testid="deck-select">
                        <SelectValue placeholder={t('cardCreate.selectDeckPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {decksToShow.length === 0 ? (
                          <SelectItem value="__none" disabled>
                            {t('cardCreate.noDecks')}
                          </SelectItem>
                        ) : (
                          decksToShow.map((deck) => (
                            <SelectItem key={deck.id} value={deck.id}>
                              {getDeckName(deck)}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Culture Card Form */}
              <CultureCardForm
                key={formKey}
                deckId={effectiveDeckId}
                onSubmit={handleSubmit}
                onDirtyChange={handleDirtyChange}
                isSubmitting={isSubmitting}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  data-testid="cancel-btn"
                >
                  {t('cardCreate.cancel')}
                </Button>
                <Button
                  type="submit"
                  form="culture-card-form"
                  disabled={!canSubmit}
                  onClick={() => {
                    // Trigger form submission via the form's submit handler
                    const form = document.querySelector(
                      '[data-testid="culture-card-form"]'
                    ) as HTMLFormElement;
                    form?.requestSubmit();
                  }}
                  data-testid="create-btn"
                >
                  {isSubmitting ? t('cardCreate.creating') : t('cardCreate.create')}
                </Button>
              </DialogFooter>
            </>
          ) : (
            /* Success State */
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  {t('cardCreate.successTitle')}
                </DialogTitle>
                <DialogDescription>{t('cardCreate.successMessage')}</DialogDescription>
              </DialogHeader>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={handleCreateAnother}
                  data-testid="create-another-btn"
                >
                  {t('cardCreate.createAnother')}
                </Button>
                <Button onClick={handleDone} data-testid="done-btn">
                  {t('cardCreate.done')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog
        open={showCancelConfirm}
        onOpenChange={setShowCancelConfirm}
        title={t('cardCreate.discardTitle')}
        description={t('cardCreate.discardMessage')}
        variant="warning"
        dismissible={false}
        actions={[
          {
            label: t('cardCreate.keepEditing'),
            onClick: () => setShowCancelConfirm(false),
            variant: 'outline',
          },
          {
            label: t('cardCreate.discard'),
            onClick: handleDiscard,
            variant: 'destructive',
          },
        ]}
      />
    </>
  );
}

export default CardCreateModal;
