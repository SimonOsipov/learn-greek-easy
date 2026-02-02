import { VocabularyCardCreateModal } from '@/components/admin/vocabulary';

export interface UserVocabularyCardCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  deckLevel?: string;
  onSuccess?: () => void;
}

/**
 * User-facing wrapper for vocabulary card creation.
 * Delegates to the admin VocabularyCardCreateModal component.
 * Backend allows deck owners to create cards (USRCARD-01).
 */
export function UserVocabularyCardCreateModal({
  open,
  onOpenChange,
  deckId,
  deckLevel,
  onSuccess,
}: UserVocabularyCardCreateModalProps) {
  return (
    <VocabularyCardCreateModal
      open={open}
      onOpenChange={onOpenChange}
      deckId={deckId}
      deckLevel={deckLevel}
      onSuccess={onSuccess}
    />
  );
}
