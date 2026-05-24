// src/components/admin/AdminCardErrorCard.tsx

import React from 'react';

import { formatDistanceToNow } from 'date-fns';
import { el } from 'date-fns/locale/el';
import { ru } from 'date-fns/locale/ru';
import { BookOpen, Check, ExternalLink, Globe, MessageSquare, Pencil, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { AdminCardErrorResponse, CardErrorCardSnapshot } from '@/types/cardError';

import { CardErrorStatusBadge } from './CardErrorStatusBadge';

import type { Locale } from 'date-fns';

// ── Open-status set for CER-16 tint border ────────────────────────────────────

const OPEN_STATUSES = new Set(['PENDING', 'REVIEWED'] as const);

// ── CardPeek (CER-13) ─────────────────────────────────────────────────────────

function CardPeek({
  card,
  cardType,
}: {
  card: CardErrorCardSnapshot | null | undefined;
  cardType: string;
}) {
  if (!card) return null;

  if (cardType === 'WORD') {
    const { article, word, translation_en } = card;
    if (!word) return null;
    return (
      <div className="ce-card-preview text-sm text-muted-foreground">
        {article && <span lang="el">{article}</span>}
        {article && ' '}
        <span lang="el" className="font-medium">
          {word}
        </span>
        {translation_en && (
          <>
            {' · '}
            <span>{translation_en}</span>
          </>
        )}
      </div>
    );
  }

  if (cardType === 'CULTURE') {
    const question = card.question_en ?? card.question_el;
    if (!question) return null;
    const truncated = question.length > 90 ? `${question.slice(0, 90).trimEnd()}…` : question;
    const lang = card.question_el && !card.question_en ? 'el' : undefined;
    return (
      <div className="ce-card-preview text-sm text-muted-foreground" lang={lang}>
        {truncated}
      </div>
    );
  }

  return null;
}

// ── AdminNotesBlock (CER-15) ──────────────────────────────────────────────────

interface AdminNotesBlockProps {
  adminNotes: string | null;
  status: string;
  resolvedAt: string | null;
  updatedAt: string;
  dateLocale: Locale | undefined;
}

function AdminNotesBlock({
  adminNotes,
  status,
  resolvedAt,
  updatedAt,
  dateLocale,
}: AdminNotesBlockProps) {
  if (!adminNotes?.trim()) return null;

  const isFixed = status === 'FIXED';
  const timestampDate = new Date(resolvedAt ?? updatedAt);
  const relativeTime = formatDistanceToNow(timestampDate, {
    addSuffix: true,
    locale: dateLocale,
  });

  return (
    <div className="fb-card-reply mt-2">
      <span className="fb-card-reply-label text-xs text-muted-foreground">
        <Check className="mr-1 inline h-3 w-3" aria-hidden />
        {isFixed ? `Admin · resolved ${relativeTime}` : `Admin · noted ${relativeTime}`}
      </span>
      <div className="whitespace-pre-wrap text-sm" data-testid="card-error-admin-notes">
        {adminNotes}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface AdminCardErrorCardProps {
  errorReport: AdminCardErrorResponse;
  onRespond: (error: AdminCardErrorResponse) => void;
}

/**
 * Admin card error report card component (CER-09 through CER-19 redesign)
 *
 * - CER-12: Deck chip in head row
 * - CER-13: Inline card peek (WORD / CULTURE)
 * - CER-14: Truncated card-ID stub in foot row
 * - CER-15: Inline admin-notes block
 * - CER-16: Warning-tinted border for open rows (data-state="open")
 * - CER-17: Open card ghost action + Respond ↔ Edit response toggle
 * - CER-18: Clickable row body (role=button, Enter/Space, stopPropagation)
 * - CER-19: Mono font on relative timestamp
 */
export const AdminCardErrorCard: React.FC<AdminCardErrorCardProps> = ({
  errorReport,
  onRespond,
}) => {
  const { t, i18n } = useTranslation('admin');

  const getDateLocale = (): Locale | undefined => {
    switch (i18n.language) {
      case 'el':
        return el;
      case 'ru':
        return ru;
      default:
        return undefined;
    }
  };

  const hasResponse = !!errorReport.admin_notes?.trim();

  const CardTypeIcon = errorReport.card_type === 'WORD' ? BookOpen : Globe;

  // CER-16: derive data-state from status
  const rowState = OPEN_STATUSES.has(errorReport.status as 'PENDING' | 'REVIEWED')
    ? 'open'
    : 'triaged';

  // CER-18: row click opens drawer; CER-17: inner buttons stopPropagation
  const handleRowClick = () => {
    onRespond(errorReport);
  };

  const handleRowKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRespond(errorReport);
    }
  };

  // CER-17: respond / edit response
  const handleRespond = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRespond(errorReport);
  };

  // CER-17: Open card — currently reuses drawer opener; TODO deep-link to deck editor
  const handleOpenCard = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO(CER-OOS): deep-link to deck editor route — for now reuse drawer.
    onRespond(errorReport);
  };

  const dateLocale = getDateLocale();

  return (
    <Card
      data-testid="admin-card-error-card"
      data-state={rowState}
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
      className="cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            {/* Head row: Status badge · type badge · deck chip · timestamp */}
            <div className="flex flex-wrap items-center gap-2">
              <CardErrorStatusBadge status={errorReport.status} />
              <span className="badge b-gray gap-1" data-testid="card-error-type-badge">
                <CardTypeIcon className="h-3 w-3" />
                {t(`cardErrors.cardTypes.${errorReport.card_type.toLowerCase()}`)}
              </span>
              {/* CER-12: Deck chip — hidden when deck is null/empty */}
              {errorReport.deck?.name ? (
                <span
                  className="min-w-0 truncate text-sm text-muted-foreground"
                  data-testid="card-error-deck-chip"
                >
                  {t('cardErrors.row.inDeck')}{' '}
                  <b className="font-semibold text-foreground">{errorReport.deck.name}</b>
                </span>
              ) : null}
            </div>

            {/* Reporter and timestamp */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {errorReport.reporter.full_name || t('cardErrors.anonymousUser')}
              </span>
              {/* CER-19: mono font on timestamp via ce-card-when class */}
              <span className="ce-card-when">
                {formatDistanceToNow(new Date(errorReport.created_at), {
                  addSuffix: true,
                  locale: dateLocale,
                })}
              </span>
            </div>
          </div>

          {/* CER-17: Action buttons */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              variant={hasResponse ? 'outline' : 'default'}
              size="sm"
              onClick={handleRespond}
              data-testid="card-error-respond-button"
              aria-label={
                hasResponse ? t('cardErrors.row.editResponse') : t('cardErrors.row.respond')
              }
            >
              {hasResponse ? (
                <Pencil className="mr-2 h-4 w-4" />
              ) : (
                <MessageSquare className="mr-2 h-4 w-4" />
              )}
              {hasResponse ? t('cardErrors.row.editResponse') : t('cardErrors.row.respond')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenCard}
              data-testid="card-error-open-card-button"
              aria-label={t('cardErrors.row.openCard')}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {t('cardErrors.row.openCard')}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* CER-13: Inline card peek */}
        <CardPeek card={errorReport.card} cardType={errorReport.card_type} />

        {/* Error description */}
        <p
          className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground"
          data-testid="card-error-description"
        >
          {errorReport.description}
        </p>

        {/* CER-15: Inline admin notes block */}
        <AdminNotesBlock
          adminNotes={errorReport.admin_notes}
          status={errorReport.status}
          resolvedAt={errorReport.resolved_at}
          updatedAt={errorReport.updated_at}
          dateLocale={dateLocale}
        />

        {/* CER-14: Truncated card-ID stub in foot row */}
        {errorReport.card_id ? (
          <div className="mt-3 flex items-center gap-2">
            <span
              className="ce-card-id-dim"
              title={errorReport.card_id}
              aria-label={`Card ID ${errorReport.card_id}`}
            >
              {errorReport.card_id.slice(0, 8)}…
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
