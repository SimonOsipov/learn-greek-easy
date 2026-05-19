// src/components/admin/decks/DeckSettingsTab.tsx
//
// Settings tab rendered inside DeckDrawer for both vocabulary and culture decks.
//
// Three sections:
// 1. Identity — bilingual name/description + level (vocab) / no level (culture)
// 2. Access — is_active + is_premium toggles (already inside the embedded form)
// 3. Danger zone — delete deck
//
// Also owns:
// - "Discard unsaved changes?" dialog (triggered by dirty-state close guard)
// - "Auto-saved · just now" transient indicator in the drawer footer

import { useEffect, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { adminAPI } from '@/services/adminAPI';
import type { UnifiedDeckItem } from '@/services/adminAPI';
import { useAdminTabCountsStore } from '@/stores/adminTabCountsStore';

import { CultureDeckEditForm } from '../CultureDeckEditForm';
import { DeckDeleteDialog } from '../DeckDeleteDialog';
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
  const [, setSearchParams] = useSearchParams();

  const { registerCloseGuard, setFooter, closeWithGuard } = useDeckDrawer();

  // ── Local state ──────────────────────────────────────────────────────────

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAutoSaved, setShowAutoSaved] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  /** Reset handle provided by the embedded form via onReady */
  const formResetRef = useRef<(() => void) | null>(null);

  // ── Save handler ─────────────────────────────────────────────────────────

  const handleSave = async (data: VocabularyDeckFormData | CultureDeckFormData) => {
    setIsSaving(true);
    try {
      if (deck.type === 'vocabulary') {
        const vocabData = data as VocabularyDeckFormData;
        await adminAPI.updateVocabularyDeck(deck.id, {
          name_en: vocabData.name_en,
          name_ru: vocabData.name_ru,
          description_en: vocabData.description_en || null,
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

      setShowAutoSaved(true);
      setTimeout(() => setShowAutoSaved(false), 2500);

      onSaved?.();
    } finally {
      setIsSaving(false);
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

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      if (deck.type === 'vocabulary') {
        await adminAPI.deleteVocabularyDeck(deck.id);
      } else {
        await adminAPI.deleteCultureDeck(deck.id);
      }
      void queryClient.invalidateQueries({ queryKey: ['admin', 'decks'] });
      void useAdminTabCountsStore.getState().fetchCounts();
      // Close drawer by stripping URL params
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.delete('edit');
        params.delete('item');
        params.delete('subtab');
        return params;
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
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

  // ── Populate drawer footer slot ───────────────────────────────────────────

  useEffect(() => {
    setFooter(
      <div
        className="flex items-center justify-between gap-2 border-t px-4 py-3"
        data-testid="deck-settings-footer"
      >
        <span
          className={cn(
            'text-xs text-muted-foreground transition-opacity duration-300',
            showAutoSaved ? 'opacity-100' : 'opacity-0'
          )}
          data-testid="deck-settings-auto-saved"
          aria-live="polite"
        >
          {t('decks.autoSavedJustNow')}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            data-testid="deck-settings-cancel"
          >
            {t('deckEdit.cancel')}
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            disabled={!isDirty || isSaving}
            data-testid="deck-settings-save"
          >
            {isSaving ? t('deckEdit.saving') : t('deckEdit.save')}
          </Button>
        </div>
      </div>
    );

    return () => {
      setFooter(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAutoSaved, isDirty, isSaving, t]);

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
        />
      )}

      {/* Block 3: Danger zone */}
      <div
        className="rounded-lg border border-destructive/30 p-4"
        data-testid="deck-settings-danger-zone"
      >
        <h3 className="mb-3 text-sm font-semibold text-destructive">
          {t('decks.settings.danger')}
        </h3>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => setShowDeleteDialog(true)}
          data-testid="deck-settings-delete-btn"
        >
          <Trash2 className="mr-2 size-4" aria-hidden="true" />
          {t('deckDelete.confirm', { defaultValue: 'Delete deck' })}
        </Button>
      </div>

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

      {/* Delete deck dialog */}
      <DeckDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        deck={deck}
        onConfirm={() => void handleDeleteConfirm()}
        isDeleting={isDeleting}
      />
    </div>
  );
}
