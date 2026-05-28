// src/components/admin/decks/DeckList.tsx
//
// Container component that maps decks → DeckRow and owns loading / empty states
// (ADMIN2-09 / DKDR-04). The error state is kept in AllDecksList (the parent owns
// the fetch). The hideDeactivated filter is applied upstream in AllDecksList;
// this component receives the already-filtered slice.

import { useTranslation } from 'react-i18next';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { UnifiedDeckItem } from '@/services/adminAPI';

import { DeckRow } from './DeckRow';

export interface DeckListProps {
  decks: UnifiedDeckItem[];
  isLoading: boolean;
  locale: string;
  onOpenDrawer: (deck: UnifiedDeckItem) => void;
  onDelete: (deck: UnifiedDeckItem) => void;
}

function TableSkeleton() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-4 w-48" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell className="hidden sm:table-cell">
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="ml-auto h-8 w-16" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

function EmptyRow() {
  const { t } = useTranslation('admin');
  return (
    <TableRow>
      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
        {t('decks.list.empty')}
      </TableCell>
    </TableRow>
  );
}

export function DeckList({ decks, isLoading, locale, onOpenDrawer, onDelete }: DeckListProps) {
  const { t } = useTranslation('admin');

  return (
    <div
      className="rounded-md border"
      data-testid={isLoading ? undefined : 'deck-list'}
      aria-label={isLoading ? t('decks.loadingLabel') : undefined}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[35%]">{t('decks.table.deck')}</TableHead>
            <TableHead className="w-[10%]">{t('decks.table.type')}</TableHead>
            <TableHead className="hidden w-[15%] sm:table-cell">{t('decks.table.owner')}</TableHead>
            <TableHead className="hidden w-[15%] md:table-cell">
              {t('decks.table.lastEdit')}
            </TableHead>
            <TableHead className="w-[10%]">{t('decks.table.cards')}</TableHead>
            <TableHead className="w-[15%] text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableSkeleton />
          ) : decks.length === 0 ? (
            <EmptyRow />
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
        </TableBody>
      </Table>
    </div>
  );
}
