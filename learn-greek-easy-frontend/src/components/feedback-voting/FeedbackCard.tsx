// src/components/feedback-voting/FeedbackCard.tsx

import React from 'react';

import { formatDistanceToNow } from 'date-fns';
import { el } from 'date-fns/locale/el';
import { ru } from 'date-fns/locale/ru';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { FeedbackItem } from '@/types/feedback';

import { FeedbackCategoryBadge } from './FeedbackCategoryBadge';
import { FeedbackStatusBadge } from './FeedbackStatusBadge';
import { FeedbackVoteButton } from './FeedbackVoteButton';

interface FeedbackCardProps {
  feedback: FeedbackItem;
}

export const FeedbackCard: React.FC<FeedbackCardProps> = ({ feedback }) => {
  const { t, i18n } = useTranslation('feedback');

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
    <Card data-testid="feedback-card">
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
          <p className="text-sm text-muted-foreground" data-testid="feedback-meta">
            {formatDistanceToNow(new Date(feedback.created_at), {
              addSuffix: true,
              locale: getDateLocale(),
            })}
            {feedback.author.full_name && ` ${t('list.by')} ${feedback.author.full_name}`}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap text-sm" data-testid="feedback-description">
          {feedback.description}
        </p>
      </CardContent>
    </Card>
  );
};
