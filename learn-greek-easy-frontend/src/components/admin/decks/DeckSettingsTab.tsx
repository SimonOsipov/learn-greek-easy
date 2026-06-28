// src/components/admin/decks/DeckSettingsTab.tsx
//
// Settings tab rendered inside DeckDrawer for both vocabulary and culture decks.
//
// Two sections:
// 1. Identity — bilingual name/description + level (vocab) / no level (culture)
// 2. Access — is_active + is_premium toggles (already inside the embedded form)
//
// The delete flow + the standard drawer footer (Cancel / Save changes / Delete)
// live in DeckDrawer (ADMIN2-35-04). This tab still owns the "Discard unsaved
// changes?" dialog (triggered by the dirty-state close guard).

import { useEffect, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { adminAPI } from '@/services/adminAPI';
import type { UnifiedDeckItem } from '@/services/adminAPI';

import { CultureDeckEditForm } from '../CultureDeckEditForm';
import { VocabularyDeckEditForm } from '../VocabularyDeckEditForm';
import { useDeckDrawer } from './DeckDrawer';

import type { CultureDeckFormData } from '../CultureDeckEditForm';
import type { VocabularyDeckFormData } from '../VocabularyDeckEditForm';

// ── Constants ─────────────────────────────────────────────────────────────────

const FORM_ID = 'deck-settings-form';

// ── Props ─────────────────────────────────────────────────────────────────────

interface DeckSettingsTabProps {
  deck: UnifiedDeckItem;
  onSaved?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DeckSettingsTab({ deck, onSaved }: DeckSettingsTabProps) {
  const { t } = useTranslation('admin');
  const queryClient = useQueryClient();

  const { registerCloseGuard, closeWithGuard } = useDeckDrawer();

  // ── Local state ──────────────────────────────────────────────────────────

  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  /** Reset handle provided by the embedded form via onReady */
  const formResetRef = useRef<(() => void) | null>(null);

  // ── Save handler ─────────────────────────────────────────────────────────

  const handleSave = async (data: VocabularyDeckFormData | CultureDeckFormData) => {
    // The drawer Save button is enabled on the Settings tab regardless of dirty
    // state (it disables only off the Settings tab — matching the FeedbackDrawer
    // standard). Mirror that standard's "no-op when unchanged" guard here so a
    // clean submit never fires a redundant PATCH.
    if (!isDirty) return;

    try {
      if (deck.type === 'vocabulary') {
        const vocabData = data as VocabularyDeckFormData;
        await adminAPI.updateVocabularyDeck(deck.id, {
          name_en: vocabData.name_en,
          name_el: vocabData.name_el || null,
          name_ru: vocabData.name_ru,
          description_en: vocabData.description_en || null,
          description_el: vocabData.description_el || null,
          description_ru: vocabData.description_ru || null,
          level: vocabData.level,
          is_active: vocabData.is_active,
          is_premium: vocabData.is_premium,
        });
      } else {
        const cultureData = data as CultureDeckFormData;
        await adminAPI.updateCultureDeck(deck.id, {
          name_en: cultureData.name_en,
          name_ru: cultureData.name_ru,
          description_en: cultureData.description_en || null,
          description_ru: cultureData.description_ru || null,
          category: cultureData.category,
          is_active: cultureData.is_active,
          is_premium: cultureData.is_premium,
        });
      }

      // Invalidate both the single-deck and the full list cache
      void queryClient.invalidateQueries({ queryKey: ['admin', 'deck', deck.id] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'decks'] });

      toast({ title: t('deckEdit.saveSuccess'), variant: 'success' });
      onSaved?.();
    } catch {
      toast({ title: t('errors.saveFailed'), variant: 'destructive' });
    }
  };

  // ── Cancel / discard ──────────────────────────────────────────────────────

  const handleCancel = () => {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      closeWithGuard();
    }
  };

  const handleDiscardConfirm = () => {
    setShowDiscardDialog(false);
    formResetRef.current?.();
    // After reset isDirty will be false, so closeWithGuard will pass
    closeWithGuard();
  };

  const handleDiscardCancel = () => {
    setShowDiscardDialog(false);
  };

  // ── Register dirty close guard ────────────────────────────────────────────

  useEffect(() => {
    registerCloseGuard(() => {
      if (isDirty) {
        setShowDiscardDialog(true);
        return false;
      }
      return true;
    });

    return () => {
      registerCloseGuard(null);
    };
  }, [isDirty, registerCloseGuard]);

  // ── Cover-image handlers ─────────────────────────────────────────────────

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'deck', deck.id] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'decks'] });
  };

  const handleUploadVocabCover = async (file: File) => {
    await adminAPI.uploadDeckCoverImage(deck.id, file);
    invalidate();
  };

  const handleRemoveVocabCover = async () => {
    await adminAPI.deleteDeckCoverImage(deck.id);
    invalidate();
  };

  const handleUploadCultureCover = async (file: File) => {
    await adminAPI.uploadCultureDeckCoverImage(deck.id, file);
    invalidate();
  };

  const handleRemoveCultureCover = async () => {
    await adminAPI.deleteCultureDeckCoverImage(deck.id);
    invalidate();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6" data-testid="deck-settings-tab">
      {/* Block 1+2: Identity + Access — both inside the embedded form */}
      {deck.type === 'vocabulary' ? (
        <VocabularyDeckEditForm
          deck={deck}
          onSave={handleSave}
          onCancel={handleCancel}
          renderFooter={false}
          onDirtyChange={setIsDirty}
          onReady={(api) => {
            formResetRef.current = api.reset;
          }}
          formId={FORM_ID}
          onUploadCoverImage={handleUploadVocabCover}
          onRemoveCoverImage={handleRemoveVocabCover}
        />
      ) : (
        <CultureDeckEditForm
          deck={deck}
          onSave={handleSave}
          onCancel={handleCancel}
          renderFooter={false}
          hideCategory={true}
          onDirtyChange={setIsDirty}
          onReady={(api) => {
            formResetRef.current = api.reset;
          }}
          formId={FORM_ID}
          onUploadCoverImage={handleUploadCultureCover}
          onRemoveCoverImage={handleRemoveCultureCover}
        />
      )}

      {/* Discard-changes confirmation dialog */}
      <Dialog
        open={showDiscardDialog}
        onOpenChange={(open) => {
          if (!open) handleDiscardCancel();
        }}
      >
        <DialogContent data-testid="deck-settings-discard-dialog">
          <DialogHeader>
            <DialogTitle>{t('decks.discardTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('decks.discardBody')}</p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleDiscardCancel}
              data-testid="deck-settings-discard-cancel"
            >
              {t('decks.discardCancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDiscardConfirm}
              data-testid="deck-settings-discard-confirm"
            >
              {t('decks.discardConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
