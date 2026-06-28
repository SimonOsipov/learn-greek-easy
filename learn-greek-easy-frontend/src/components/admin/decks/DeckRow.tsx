// src/components/admin/decks/DeckRow.tsx
//
// Presentational row for a single deck in the DeckList (ADMIN2-09 / DKDR-04).
// Clicking the row body opens the deck drawer via the onOpenDrawer callback.
// The actions cell stops propagation so edit/delete don't also trigger row click.
//
// ADMIN2-47-03: replaced shadcn <TableRow>/<TableCell> with CD .va-list/.va-row grid.
// - Type cell: single CD tone badge (.badge b-blue / b-violet); removed mixed shadcn badgeVariants.
// - CEFR level badge removed from row (stays in drawer).
// - D6: .deck-inactive-tag near the name when !deck.is_active; Active rows show nothing.
// - Actions: icon-btn icon-btn-sm pattern (edit + danger trash).

import React from 'react';

import { format } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AdminAvatar } from '@/components/ui/admin-avatar';
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
  const absoluteDate = format(new Date(deck.created_at), 'MMM d, yyyy');
  const itemLabel =
    deck.type === 'culture'
      ? t('decks.row.itemCountQuestions', { count: deck.item_count })
      : t('decks.row.itemCountCards', { count: deck.item_count });

  const isSystem = deck.is_system_deck === true;

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
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      className="va-row va-row-clickable deck-row"
    >
      {/* Col 1: DeckMark chip + name + meta + optional inactive tag */}
      <div className="va-cell-deck">
        <span data-testid="deck-row-mark" className="shrink-0">
          <DeckMark name={localizedName} type={deck.type} isSystem={isSystem} />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{localizedName}</span>
          <span className="truncate text-xs text-muted-foreground">
            {deck.type === 'vocabulary'
              ? t('decks.row.typeVocabulary')
              : t('decks.row.typeCulture')}
          </span>
        </div>
        {!deck.is_active && (
          <span className="deck-inactive-tag" data-testid="deck-row-status">
            {t('decks.statusDeactivated')}
          </span>
        )}
      </div>

      {/* Col 2: Type badge — single CD tone badge */}
      <div>
        <span className={`badge ${deck.type === 'vocabulary' ? 'b-blue' : 'b-violet'}`}>
          {deck.type === 'vocabulary'
            ? t('decks.row.typeVocabBadge')
            : t('decks.row.typeCultureBadge')}
        </span>
      </div>

      {/* Col 3: Owner */}
      <div className="va-owner">
        {isSystem ? (
          <span>{t('decks.row.systemOwner')}</span>
        ) : deck.owner_name ? (
          <>
            <AdminAvatar initials={getInitials(deck.owner_name)} size="sm" />
            <span>{deck.owner_name}</span>
          </>
        ) : (
          <span>—</span>
        )}
      </div>

      {/* Col 4: Last edit */}
      <div className="text-sm text-muted-foreground">
        <time dateTime={deck.created_at}>{absoluteDate}</time>
      </div>

      {/* Col 5: Card / question count — mono right-aligned */}
      <div className="va-cards-n">{itemLabel}</div>

      {/* Col 6: Actions — stop propagation so clicking doesn't open drawer */}
      <div
        data-testid="deck-row-actions"
        className="va-row-actions deck-row-actions"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="icon-btn icon-btn-sm"
          aria-label={t('decks.editLabel')}
          onClick={handleEditClick}
        >
          <Pencil />
        </button>
        <button
          className="icon-btn icon-btn-sm danger"
          aria-label={t('decks.deleteLabel')}
          onClick={handleDeleteClick}
        >
          <Trash2 />
        </button>
      </div>
    </div>
  );
}
