// src/components/admin/DeckCreateModal.tsx

import React, { useState } from 'react';

import { BookOpen, Landmark } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { CultureDeckCreateForm, type CultureDeckCreateFormData } from './CultureDeckCreateForm';
import {
  VocabularyDeckCreateForm,
  type VocabularyDeckCreateFormData,
} from './VocabularyDeckCreateForm';

export type DeckType = 'vocabulary' | 'culture';

export type DeckCreateFormData = VocabularyDeckCreateFormData | CultureDeckCreateFormData;

interface DeckCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    type: DeckType,
    data: DeckCreateFormData,
    coverFile?: File | null
  ) => void | Promise<void>;
  isLoading?: boolean;
}

/**
 * Modal dialog for creating a new deck — CD .aw-modal/.cd-modal design (ADMIN2-47, AC H).
 *
 * Rebuilt from the shadcn Dialog primitive (focus-trap / overlay / escape / zoom-in-95 pop
 * are inherited). Type selector is now .cd-type 2-col type cards instead of a <Select>.
 * Cover state is lifted here, threaded into the active form, and uploaded post-create by
 * AdminPage.handleCreateDeck (create-then-upload pattern — upload endpoints require a deckId).
 */
export const DeckCreateModal: React.FC<DeckCreateModalProps> = ({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
}) => {
  const { t } = useTranslation('admin');
  const [deckType, setDeckType] = useState<DeckType>('vocabulary');
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleSubmit = (data: DeckCreateFormData) => {
    onSubmit(deckType, data, coverFile);
  };

  // Reset deck type and cover when modal closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Small delay lets the close animation finish before resetting
      setTimeout(() => {
        setDeckType('vocabulary');
        setCoverFile(null);
      }, 200);
    }
    onOpenChange(newOpen);
  };

  // Type-card selector rendered inside each form's cd-modal-body
  const typeSelector = (
    <div className="cd-type">
      <button
        type="button"
        className={cn('cd-type-card', deckType === 'vocabulary' && 'is-active')}
        aria-pressed={deckType === 'vocabulary'}
        data-testid="deck-create-type-vocabulary"
        onClick={() => setDeckType('vocabulary')}
      >
        <BookOpen />
        {t('deckCreate.typeVocabulary')}
      </button>
      <button
        type="button"
        className={cn('cd-type-card', deckType === 'culture' && 'is-active')}
        aria-pressed={deckType === 'culture'}
        data-testid="deck-create-type-culture"
        onClick={() => setDeckType('culture')}
      >
        <Landmark />
        {t('deckCreate.typeCulture')}
      </button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/*
       * p-0 (via twMerge) defeats the base p-6 from DialogContent.
       * aw-modal overrides bg/border/radius/shadow; cd-modal sets max-width + padding:0.
       * zoom-in-95 animation is inherited from the base DialogContent.
       */}
      <DialogContent
        className="aw-modal cd-modal p-0"
        hideCloseButton
        data-testid="deck-create-modal"
      >
        <div className="cd-modal-head">
          <DialogHeader>
            <DialogTitle>{t('deckCreate.title')}</DialogTitle>
            <DialogDescription>{t('deckCreate.subtitle')}</DialogDescription>
          </DialogHeader>
        </div>

        {/* Active form — renders cd-modal-body (fields) + cd-modal-foot (buttons) */}
        {deckType === 'vocabulary' ? (
          <VocabularyDeckCreateForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isLoading}
            coverFile={coverFile}
            onCoverChange={setCoverFile}
            typeSelector={typeSelector}
          />
        ) : (
          <CultureDeckCreateForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isLoading}
            coverFile={coverFile}
            onCoverChange={setCoverFile}
            typeSelector={typeSelector}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
