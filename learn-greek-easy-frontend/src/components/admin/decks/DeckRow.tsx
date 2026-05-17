// src/components/admin/decks/DeckRow.tsx
//
// Presentational row for a single deck in the DeckList (ADMIN2-09 / DKDR-04).
// Clicking the row body or the pencil icon writes ?edit=<id> to the URL via
// the onOpenDrawer callback. The trash icon triggers onDelete without bubbling.

import React from 'react';

import { formatDistanceToNow } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getLocalizedDeckName } from '@/lib/deckLocale';
import type { UnifiedDeckItem } from '@/services/adminAPI';

import { DeckMark } from './DeckMark';

export interface DeckRowProps {
  deck: UnifiedDeckItem;
  locale: string;
  onOpenDrawer: (deck: UnifiedDeckItem) => void;
  onDelete: (deck: UnifiedDeckItem) => void;
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
  const ownerLabel = deck.is_system_deck === true ? 'System' : (deck.owner_name ?? '—');
  const relativeDate = formatDistanceToNow(new Date(deck.created_at), { addSuffix: true });
  const itemLabel =
    deck.type === 'culture' ? `${deck.item_count} questions` : `${deck.item_count} cards`;

  function handleRowClick() {
    onOpenDrawer(deck);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
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
    <div
      data-testid="deck-row"
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      className="group flex cursor-pointer items-center justify-between gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Left cluster: mark + name + badges */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* DeckMark slot */}
        <span data-testid="deck-row-mark" className="shrink-0">
          <DeckMark name={localizedName} type={deck.type} isSystem={deck.is_system_deck === true} />
        </span>

        {/* Name */}
        <span className="min-w-0 truncate font-medium">{localizedName}</span>

        {/* Type badge */}
        <Badge variant="outline" className="shrink-0 text-xs">
          {deck.type === 'vocabulary' ? 'Vocab' : 'Culture'}
        </Badge>

        {/* CEFR level pill — vocabulary only, when set */}
        {deck.level && (
          <Badge variant="secondary" className="shrink-0 text-xs">
            {deck.level}
          </Badge>
        )}
      </div>

      {/* Right cluster: meta + actions */}
      <div className="flex shrink-0 items-center gap-4 text-sm text-muted-foreground">
        {/* Owner */}
        <span className="hidden sm:inline">{ownerLabel}</span>

        {/* Created-at (substitutes last-edited — no updated_at on UnifiedDeckItem) */}
        <time dateTime={deck.created_at} className="hidden md:inline">
          {relativeDate}
        </time>

        {/* Card / question count */}
        <span className="hidden sm:inline">{itemLabel}</span>

        {/* Hover-revealed action buttons */}
        <div
          data-testid="deck-row-actions"
          className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
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
      </div>
    </div>
  );
}
