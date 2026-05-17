// src/components/admin/decks/DeckList.tsx
//
// Container component that maps decks → DeckRow and owns loading / empty states
// (ADMIN2-09 / DKDR-04). The error state is kept in AllDecksList (the parent owns
// the fetch). The hideDeactivated filter is applied upstream in AllDecksList;
// this component receives the already-filtered slice.

import { useTranslation } from 'react-i18next';

import { Skeleton } from '@/components/ui/skeleton';
import type { UnifiedDeckItem } from '@/services/adminAPI';

import { DeckRow } from './DeckRow';

export interface DeckListProps {
  decks: UnifiedDeckItem[];
  isLoading: boolean;
  locale: string;
  onOpenDrawer: (deck: UnifiedDeckItem) => void;
  onDelete: (deck: UnifiedDeckItem) => void;
}

function SkeletonList() {
  const { t } = useTranslation('admin');
  return (
    <div className="space-y-2" aria-label={t('decks.loadingLabel')}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

function EmptyDecks() {
  return <p className="py-4 text-center text-muted-foreground">No decks found.</p>;
}

export function DeckList({ decks, isLoading, locale, onOpenDrawer, onDelete }: DeckListProps) {
  if (isLoading) {
    return <SkeletonList />;
  }

  if (decks.length === 0) {
    return <EmptyDecks />;
  }

  return (
    <div className="space-y-2" data-testid="deck-list">
      {decks.map((deck) => (
        <DeckRow
          key={deck.id}
          deck={deck}
          locale={locale}
          onOpenDrawer={onOpenDrawer}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
