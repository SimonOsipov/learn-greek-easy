// src/components/admin/decks/DeckRow.tsx
//
// Presentational row for a single deck in the DeckList (ADMIN2-09 / DKDR-04).
// Clicking the row body opens the deck drawer via the onOpenDrawer callback.
// The actions cell stops propagation so edit/delete don't also trigger row click.

import React from 'react';

import { formatDistanceToNow } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AdminAvatar } from '@/components/ui/admin-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { getLocalizedDeckName } from '@/lib/deckLocale';
import type { UnifiedDeckItem } from '@/services/adminAPI';

import { DeckMark } from './DeckMark';

export interface DeckRowProps {
  deck: UnifiedDeckItem;
  locale: string;
  onOpenDrawer: (deck: UnifiedDeckItem) => void;
  onDelete: (deck: UnifiedDeckItem) => void;
}

/** Derive up-to-2-char initials from an owner name. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function DeckRow({ deck, locale, onOpenDrawer, onDelete }: DeckRowProps) {
  const { t } = useTranslation('admin');

  // Normalize name: MultilingualName → flat fields so getLocalizedDeckName can accept it.
  const multiName = typeof deck.name === 'object' ? deck.name : null;
  const normalizedDeck = {
    name: typeof deck.name === 'string' ? deck.name : undefined,
    name_en: deck.name_en ?? multiName?.en,
    name_ru: deck.name_ru ?? multiName?.ru,
  };
  const localizedName = getLocalizedDeckName(normalizedDeck, locale);
  const relativeDate = formatDistanceToNow(new Date(deck.created_at), { addSuffix: true });
  const itemLabel =
    deck.type === 'culture' ? `${deck.item_count} questions` : `${deck.item_count} cards`;

  const isSystem = deck.is_system_deck === true;

  function handleRowClick() {
    onOpenDrawer(deck);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenDrawer(deck);
    }
  }

  function handleEditClick(e: React.MouseEvent) {
    e.stopPropagation();
    onOpenDrawer(deck);
  }

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation();
    onDelete(deck);
  }

  return (
    <TableRow
      data-testid="deck-row"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      className="group cursor-pointer"
    >
      {/* Col 1: DeckMark + name + optional CEFR badge */}
      <TableCell>
        <div className="flex min-w-0 items-center gap-3">
          <span data-testid="deck-row-mark" className="shrink-0">
            <DeckMark name={localizedName} type={deck.type} isSystem={isSystem} />
          </span>
          <span className="min-w-0 truncate font-medium">{localizedName}</span>
          {deck.level && (
            <Badge variant="secondary" className="shrink-0 text-xs">
              {deck.level}
            </Badge>
          )}
        </div>
      </TableCell>

      {/* Col 2: Type */}
      <TableCell>
        <Badge variant="outline" className="text-xs">
          {deck.type === 'vocabulary' ? 'Vocab' : 'Culture'}
        </Badge>
      </TableCell>

      {/* Col 3: Owner (hidden on xs) */}
      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
        {isSystem ? (
          <span>System</span>
        ) : deck.owner_name ? (
          <div className="flex items-center gap-2">
            <AdminAvatar initials={getInitials(deck.owner_name)} size="sm" />
            <span>{deck.owner_name}</span>
          </div>
        ) : (
          <span>—</span>
        )}
      </TableCell>

      {/* Col 4: Last edit (hidden on sm and below) */}
      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
        <time dateTime={deck.created_at}>{relativeDate}</time>
      </TableCell>

      {/* Col 5: Card / question count */}
      <TableCell className="text-sm text-muted-foreground">{itemLabel}</TableCell>

      {/* Col 6: Actions — stop propagation so clicking doesn't open drawer */}
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <div
          data-testid="deck-row-actions"
          className="flex items-center justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
        >
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('decks.editLabel')}
            onClick={handleEditClick}
            className="h-8 w-8"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('decks.deleteLabel')}
            onClick={handleDeleteClick}
            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
