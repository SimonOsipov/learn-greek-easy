// src/components/admin/AdminFeedbackCard.tsx

import React from 'react';

import { formatDistanceToNow } from 'date-fns';
import { el } from 'date-fns/locale/el';
import { ru } from 'date-fns/locale/ru';
import { MessageSquare, ThumbsUp, Trash2, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { FeedbackCategoryBadge } from '@/components/feedback-voting/FeedbackCategoryBadge';
import { FeedbackStatusBadge } from '@/components/feedback-voting/FeedbackStatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { AdminFeedbackItem } from '@/types/feedback';

interface AdminFeedbackCardProps {
  feedback: AdminFeedbackItem;
  onRespond: (feedback: AdminFeedbackItem) => void;
  onDelete?: (feedback: AdminFeedbackItem) => void;
}

/**
 * Admin feedback card component
 *
 * Displays feedback item with admin-specific controls:
 * - Status badge
 * - Category badge
 * - Vote count
 * - Author info
 * - Admin response indicator
 * - Respond button
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

  const hasResponse = !!feedback.admin_response;

  return (
    <Card data-testid="admin-feedback-card">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold" data-testid="admin-feedback-title">
                {feedback.title}
              </h3>
              <FeedbackCategoryBadge category={feedback.category} />
              <FeedbackStatusBadge status={feedback.status} />
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {feedback.author.full_name || t('feedback.anonymousUser')}
              </span>
              <span className="flex items-center gap-1">
                <ThumbsUp className="h-3.5 w-3.5" />
                {feedback.vote_count}
              </span>
              <span>
                {formatDistanceToNow(new Date(feedback.created_at), {
                  addSuffix: true,
                  locale: getDateLocale(),
                })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={hasResponse ? 'outline' : 'default'}
              size="sm"
              onClick={() => onRespond(feedback)}
              data-testid="admin-feedback-respond-button"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              {hasResponse ? t('feedback.editResponse') : t('feedback.respond')}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete?.(feedback)}
              data-testid={`delete-feedback-${feedback.id}`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p
          className="whitespace-pre-wrap text-sm text-muted-foreground"
          data-testid="admin-feedback-description"
        >
          {feedback.description}
        </p>
        {hasResponse && (
          <div className="mt-4 rounded-lg border-l-4 border-primary bg-muted/50 p-3">
            <p className="mb-1 text-xs font-medium text-primary">
              {t('feedback.adminResponseLabel')}
            </p>
            <p className="whitespace-pre-wrap text-sm" data-testid="admin-feedback-response">
              {feedback.admin_response}
            </p>
            {feedback.admin_response_at && (
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(feedback.admin_response_at), {
                  addSuffix: true,
                  locale: getDateLocale(),
                })}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
