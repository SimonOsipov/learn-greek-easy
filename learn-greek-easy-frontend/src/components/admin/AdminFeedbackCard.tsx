// src/components/admin/AdminFeedbackCard.tsx

import React from 'react';

import { formatDistanceToNow } from 'date-fns';
import { el } from 'date-fns/locale/el';
import { ru } from 'date-fns/locale/ru';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AdminAvatar } from '@/components/ui/admin-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AdminFeedbackItem } from '@/types/feedback';

import { BACKEND_TO_HANDOFF, CATEGORY_TONE, STATUS_TONE } from './feedbackStatusMap';

interface AdminFeedbackCardProps {
  feedback: AdminFeedbackItem;
  onRespond: (id: string) => void;
  onDelete?: (id: string) => void;
}

// ── Small helpers (inline — only two consumers would not warrant a shared util) ─

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}

function initialsOf(name?: string | null): string {
  if (!name) return 'A';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + second).toUpperCase() || 'A';
}

/**
 * Admin feedback card — HN-style layout (FBDR-07).
 *
 * Structure:
 *   <article.fb-card>
 *     <div[role=button].fb-card-clickable>   ← left rail + main (opens drawer)
 *       <div.fb-card-left>                   ← vote rail
 *       <div.fb-card-main>                   ← badges, title, body, reply, footer
 *     <div.fb-card-actions>                  ← sibling, absolute, stopPropagation
 */
export const AdminFeedbackCard: React.FC<AdminFeedbackCardProps> = ({
  feedback,
  onRespond,
  onDelete,
}) => {
  const { t, i18n } = useTranslation('admin');

  const getDateLocale = () => {
    switch (i18n.language) {
      case 'el':
        return el;
      case 'ru':
        return ru;
      default:
        return undefined;
    }
  };

  const handoff = BACKEND_TO_HANDOFF[feedback.status];
  const categoryLabel = feedback.category === 'bug_incorrect_data' ? 'Bug' : 'Feature request';
  const statusLabel = {
    new: 'New',
    investigating: 'Investigating',
    planned: 'Planned',
    in_progress: 'In progress',
    responded: 'Responded',
    shipped: 'Shipped',
    wont_fix: "Won't fix",
    duplicate: 'Duplicate',
  }[handoff];

  return (
    <article
      className="fb-card"
      data-testid="admin-feedback-card"
      data-feedback-id={feedback.id}
      style={{ position: 'relative' }}
    >
      {/* Click target — wraps left rail + main. role=button because children include
          block elements (<h3>, <blockquote>) which are invalid inside <button>. */}
      <div
        role="button"
        tabIndex={0}
        className="fb-card-clickable"
        onClick={() => onRespond(feedback.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onRespond(feedback.id);
          }
        }}
        aria-label={t('feedback.v2.card.openReply', {
          defaultValue: 'Open reply for {{title}}',
          title: feedback.title,
        })}
      >
        {/* Left rail — vote arrow + count */}
        <div className="fb-card-left" aria-hidden>
          <span className="fb-card-arrow" aria-hidden>
            ▲
          </span>
          <span className="fb-vote-count">{feedback.vote_count}</span>
        </div>

        {/* Main body */}
        <div className="fb-card-main">
          <header className="fb-card-head flex items-center gap-2">
            <Badge tone={CATEGORY_TONE[feedback.category]}>{categoryLabel}</Badge>
            <Badge tone={STATUS_TONE[handoff]}>{statusLabel}</Badge>
            <h3 className="fb-card-title" data-testid="admin-feedback-title">
              {feedback.title}
            </h3>
          </header>

          <p className="fb-card-body" data-testid="admin-feedback-description">
            {truncate(feedback.description, 200)}
          </p>

          {feedback.admin_response ? (
            <blockquote className="fb-card-reply" data-testid="admin-feedback-response">
              <span className="fb-card-reply-label">
                {t('feedback.v2.card.adminResponseLabel')} ·{' '}
                {formatDistanceToNow(new Date(feedback.admin_response_at ?? feedback.created_at), {
                  addSuffix: true,
                  locale: getDateLocale(),
                })}
              </span>
              <span className="fb-card-reply-body">{feedback.admin_response}</span>
            </blockquote>
          ) : null}

          <footer className="fb-card-foot flex items-center gap-2">
            <AdminAvatar initials={initialsOf(feedback.author?.full_name)} size="sm" />
            <span className="fb-card-author">
              {feedback.author?.full_name || t('feedback.anonymousUser')}
            </span>
            <span className="fb-card-time">
              {formatDistanceToNow(new Date(feedback.created_at), {
                addSuffix: true,
                locale: getDateLocale(),
              })}
            </span>
          </footer>
        </div>
      </div>

      {/* Right actions — absolute positioned sibling, stops propagation to avoid
          double-firing the clickable wrapper's onRespond. */}
      <div
        className="fb-card-actions"
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'absolute', top: '12px', right: '12px' }}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="admin-feedback-respond-button"
          onClick={(e) => {
            e.stopPropagation();
            onRespond(feedback.id);
          }}
        >
          {feedback.admin_response ? t('feedback.editResponse') : t('feedback.respond')}
        </Button>

        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-testid={`delete-feedback-${feedback.id}`}
            aria-label={t('feedback.delete')}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(feedback.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </article>
  );
};
