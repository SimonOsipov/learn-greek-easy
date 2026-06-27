// src/components/admin/decks/DeckList.tsx
//
// Container component that maps decks → DeckRow and owns loading / empty states
// (ADMIN2-09 / DKDR-04). The error state is kept in AllDecksList (the parent owns
// the fetch). The hideDeactivated filter is applied upstream in AllDecksList;
// this component receives the already-filtered slice.
//
// ADMIN2-47-03: replaced shadcn <Table> with CD .va-list/.va-row grid.

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

function ListSkeleton() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="va-row">
          <div className="va-cell-deck">
            <Skeleton className="h-9 w-9 shrink-0 rounded-[9px]" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="ml-auto h-3.5 w-8" />
          <span />
        </div>
      ))}
    </>
  );
}

function EmptyState() {
  const { t } = useTranslation('admin');
  return (
    <div className="px-6 py-12 text-center text-muted-foreground">{t('decks.list.empty')}</div>
  );
}

export function DeckList({ decks, isLoading, locale, onOpenDrawer, onDelete }: DeckListProps) {
  const { t } = useTranslation('admin');

  return (
    <div
      className="va-list"
      data-testid={isLoading ? undefined : 'deck-list'}
      aria-label={isLoading ? t('decks.loadingLabel') : undefined}
    >
      <div className="va-list-head" data-testid="deck-list-head">
        <span>{t('decks.table.deck')}</span>
        <span>{t('decks.table.type')}</span>
        <span>{t('decks.table.owner')}</span>
        <span>{t('decks.table.lastEdit')}</span>
        <span className="text-right">{t('decks.table.cards')}</span>
        <span />
      </div>
      {isLoading ? (
        <ListSkeleton />
      ) : decks.length === 0 ? (
        <EmptyState />
      ) : (
        decks.map((deck) => (
          <DeckRow
            key={deck.id}
            deck={deck}
            locale={locale}
            onOpenDrawer={onOpenDrawer}
            onDelete={onDelete}
          />
        ))
      )}
    </div>
  );
}
