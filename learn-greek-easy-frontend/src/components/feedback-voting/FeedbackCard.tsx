// src/components/feedback-voting/FeedbackCard.tsx

import React, { useState } from 'react';

import { formatDistanceToNow } from 'date-fns';
import { el } from 'date-fns/locale/el';
import { ru } from 'date-fns/locale/ru';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import type { FeedbackItem } from '@/types/feedback';

import { DeveloperResponseSection } from './DeveloperResponseSection';
import { FeedbackCategoryBadge } from './FeedbackCategoryBadge';
import { FeedbackDeleteConfirmDialog } from './FeedbackDeleteConfirmDialog';
import { FeedbackEditDialog } from './FeedbackEditDialog';
import { FeedbackStatusBadge } from './FeedbackStatusBadge';
import { FeedbackVoteButton } from './FeedbackVoteButton';

interface FeedbackCardProps {
  feedback: FeedbackItem;
}

export const FeedbackCard: React.FC<FeedbackCardProps> = ({ feedback }) => {
  const { t, i18n } = useTranslation('feedback');
  const { user } = useAuth();

  // Dialog states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Check if current user is the owner of this feedback
  const isOwner = user?.id === feedback.author.id;

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

  return (
    <>
      <Card id={`feedback-${feedback.id}`} data-testid="feedback-card">
        <CardHeader className="flex flex-row items-start gap-4 space-y-0">
          <FeedbackVoteButton
            feedbackId={feedback.id}
            voteCount={feedback.vote_count}
            userVote={feedback.user_vote}
          />
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold" data-testid="feedback-title">
                {feedback.title}
              </h3>
              <FeedbackCategoryBadge category={feedback.category} />
              <FeedbackStatusBadge status={feedback.status} />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground" data-testid="feedback-meta">
                {formatDistanceToNow(new Date(feedback.created_at), {
                  addSuffix: true,
                  locale: getDateLocale(),
                })}
                {feedback.author.full_name && ` ${t('list.by')} ${feedback.author.full_name}`}
              </p>
              {isOwner && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setIsEditDialogOpen(true)}
                    title={t('edit.button')}
                    data-testid="feedback-edit-button"
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">{t('edit.button')}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    title={t('delete.button')}
                    data-testid="feedback-delete-button"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">{t('delete.button')}</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm" data-testid="feedback-description">
            {feedback.description}
          </p>
        </CardContent>
        {feedback.admin_response && (
          <DeveloperResponseSection
            response={feedback.admin_response}
            respondedAt={feedback.admin_response_at!}
          />
        )}
      </Card>

      {/* Edit Dialog */}
      <FeedbackEditDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        feedback={feedback}
      />

      {/* Delete Confirmation Dialog */}
      <FeedbackDeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        feedback={feedback}
      />
    </>
  );
};
