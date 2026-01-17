// src/components/decks/UserDeckEditModal.tsx

import React, { useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  trackUserDeckCreateStarted,
  trackUserDeckCreateCompleted,
  trackUserDeckCreateCancelled,
  trackUserDeckEditStarted,
  trackUserDeckEditCompleted,
  trackUserDeckEditCancelled,
} from '@/lib/analytics/myDecksAnalytics';
import type { CreateDeckInput, DeckLevel, DeckResponse } from '@/services/deckAPI';
import { deckAPI } from '@/services/deckAPI';

import { UserDeckForm } from './UserDeckForm';

export type CreateSource = 'my_decks_button' | 'empty_state_cta';
export type EditSource = 'grid_card' | 'detail_page';

export interface UserDeckEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  /** Source of the modal opening for analytics tracking */
  source?: CreateSource | EditSource;
  deck?: {
    id: string;
    name: string;
    description?: string | null;
    level: DeckLevel;
  };
  onSuccess?: (deck: DeckResponse) => void;
}

/**
 * Modal for creating and editing user vocabulary decks
 *
 * Features:
 * - Create mode: Empty form for new deck creation
 * - Edit mode: Pre-populated form with existing deck data
 * - Loading state during API calls
 * - Toast notifications for success/error
 * - Prevents closing while loading
 */
export const UserDeckEditModal: React.FC<UserDeckEditModalProps> = ({
  isOpen,
  onClose,
  mode,
  source,
  deck,
  onSuccess,
}) => {
  const { t } = useTranslation('deck');
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const hasTrackedOpen = useRef(false);

  const isCreateMode = mode === 'create';
  const title = isCreateMode ? t('modal.createTitle') : t('modal.editTitle');
  const description = isCreateMode ? t('modal.createDescription') : t('modal.editDescription');

  // Track modal opened
  useEffect(() => {
    if (isOpen && !hasTrackedOpen.current) {
      hasTrackedOpen.current = true;
      if (isCreateMode && source) {
        trackUserDeckCreateStarted({
          source: source as CreateSource,
        });
      } else if (!isCreateMode && deck && source) {
        trackUserDeckEditStarted({
          deck_id: deck.id,
          deck_name: deck.name,
          source: source as EditSource,
        });
      }
    } else if (!isOpen) {
      // Reset tracking flag when modal closes
      hasTrackedOpen.current = false;
    }
  }, [isOpen, isCreateMode, source, deck]);

  /**
   * Calculate which fields changed between original and submitted data.
   */
  const getChangedFields = (submittedData: CreateDeckInput): string[] => {
    if (!deck) return [];
    const changedFields: string[] = [];
    if (submittedData.name !== deck.name) changedFields.push('name');
    if ((submittedData.description || null) !== (deck.description || null)) {
      changedFields.push('description');
    }
    if (submittedData.level !== deck.level) changedFields.push('level');
    return changedFields;
  };

  const handleSubmit = async (data: CreateDeckInput) => {
    setIsLoading(true);
    try {
      let result: DeckResponse;

      if (isCreateMode) {
        result = await deckAPI.createDeck(data);
        // Track create completed
        if (source) {
          trackUserDeckCreateCompleted({
            deck_id: result.id,
            deck_name: result.name,
            level: result.level,
            has_description: !!result.description,
            source: source as CreateSource,
          });
        }
        toast({
          title: t('modal.createSuccess'),
        });
      } else {
        if (!deck?.id) {
          throw new Error('Deck ID is required for edit mode');
        }
        const fieldsChanged = getChangedFields(data);
        result = await deckAPI.updateMyDeck(deck.id, data);
        // Track edit completed
        if (source) {
          trackUserDeckEditCompleted({
            deck_id: result.id,
            deck_name: result.name,
            fields_changed: fieldsChanged,
            source: source as EditSource,
          });
        }
        toast({
          title: t('modal.editSuccess'),
        });
      }

      onSuccess?.(result);
      onClose();
    } catch (error) {
      toast({
        title: isCreateMode ? t('modal.createError') : t('modal.editError'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Track cancellation
    if (isCreateMode && source) {
      trackUserDeckCreateCancelled({
        source: source as CreateSource,
      });
    } else if (!isCreateMode && deck && source) {
      trackUserDeckEditCancelled({
        deck_id: deck.id,
        deck_name: deck.name,
        source: source as EditSource,
      });
    }
    onClose();
  };

  const handleOpenChange = (open: boolean) => {
    // Prevent closing while loading
    if (!open && isLoading) {
      return;
    }
    if (!open) {
      handleCancel();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="user-deck-modal">
        <DialogHeader>
          <DialogTitle data-testid="user-deck-modal-title">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <UserDeckForm
          key={deck?.id ?? 'create'}
          mode={mode}
          deck={deck}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  );
};
