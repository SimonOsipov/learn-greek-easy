// src/components/feedback-voting/FeedbackVoteButton.tsx

import React from 'react';

import { ChevronUp, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useFeedbackStore } from '@/stores/feedbackStore';
import type { VoteType } from '@/types/feedback';

interface FeedbackVoteButtonProps {
  feedbackId: string;
  voteCount: number;
  userVote: VoteType | null;
}

export const FeedbackVoteButton: React.FC<FeedbackVoteButtonProps> = ({
  feedbackId,
  voteCount,
  userVote,
}) => {
  const { t } = useTranslation('feedback');
  const { vote, removeVote, isVoting } = useFeedbackStore();

  const handleUpvote = async () => {
    if (userVote === 'up') {
      await removeVote(feedbackId);
    } else {
      await vote(feedbackId, 'up');
    }
  };

  const handleDownvote = async () => {
    if (userVote === 'down') {
      await removeVote(feedbackId);
    } else {
      await vote(feedbackId, 'down');
    }
  };

  return (
    <div className="flex flex-col items-center gap-1" data-testid="vote-buttons">
      <Button
        variant="ghost"
        size="icon"
        className={cn('h-8 w-8', userVote === 'up' && 'bg-primary/10 text-primary')}
        onClick={handleUpvote}
        disabled={isVoting}
        aria-label={t('voting.upvote')}
        data-testid="upvote-button"
      >
        <ChevronUp className="h-5 w-5" />
      </Button>
      <span
        className={cn(
          'text-sm font-semibold',
          voteCount > 0 && 'text-primary',
          voteCount < 0 && 'text-destructive'
        )}
        data-testid="vote-count"
      >
        {voteCount}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className={cn('h-8 w-8', userVote === 'down' && 'bg-destructive/10 text-destructive')}
        onClick={handleDownvote}
        disabled={isVoting}
        aria-label={t('voting.downvote')}
        data-testid="downvote-button"
      >
        <ChevronDown className="h-5 w-5" />
      </Button>
    </div>
  );
};
