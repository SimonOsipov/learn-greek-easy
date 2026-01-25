// src/components/admin/DeckCreateModal.tsx

import React, { useState } from 'react';

import { useTranslation } from 'react-i18next';

import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  onSubmit: (type: DeckType, data: DeckCreateFormData) => void | Promise<void>;
  isLoading?: boolean;
}

/**
 * Modal dialog for creating a new deck
 *
 * Displays a deck type selector and renders the appropriate form:
 * - VocabularyDeckCreateForm for vocabulary decks
 * - CultureDeckCreateForm for culture decks
 */
export const DeckCreateModal: React.FC<DeckCreateModalProps> = ({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
}) => {
  const { t } = useTranslation('admin');
  const [deckType, setDeckType] = useState<DeckType>('vocabulary');

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleSubmit = (data: DeckCreateFormData) => {
    onSubmit(deckType, data);
  };

  // Reset deck type when modal closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset to default state after closing
      setTimeout(() => setDeckType('vocabulary'), 200);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="deck-create-modal">
        <DialogHeader>
          <DialogTitle>{t('deckCreate.title')}</DialogTitle>
          <DialogDescription>{t('sections.allDecksDescription')}</DialogDescription>
        </DialogHeader>

        {/* Deck Type Selector */}
        <div className="space-y-2">
          <Label htmlFor="deck-type-select">{t('deckCreate.typeLabel')}</Label>
          <Select value={deckType} onValueChange={(value: DeckType) => setDeckType(value)}>
            <SelectTrigger id="deck-type-select" data-testid="deck-create-type-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vocabulary">{t('deckCreate.typeVocabulary')}</SelectItem>
              <SelectItem value="culture">{t('deckCreate.typeCulture')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Render appropriate form based on deck type */}
        {deckType === 'vocabulary' ? (
          <VocabularyDeckCreateForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isLoading}
          />
        ) : (
          <CultureDeckCreateForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isLoading}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
