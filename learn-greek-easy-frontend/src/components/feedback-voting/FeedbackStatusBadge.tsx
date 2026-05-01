// src/components/feedback-voting/FeedbackStatusBadge.tsx

import React from 'react';

import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { FeedbackStatus } from '@/types/feedback';

const statusToBadgeColor: Record<FeedbackStatus, string> = {
  new: 'b-blue',
  under_review: 'b-violet',
  planned: 'b-gray',
  in_progress: 'b-amber',
  completed: 'b-green',
  cancelled: 'b-red',
};

interface FeedbackStatusBadgeProps {
  status: FeedbackStatus;
}

export const FeedbackStatusBadge: React.FC<FeedbackStatusBadgeProps> = ({ status }) => {
  const { t } = useTranslation('feedback');
  return <span className={cn('badge', statusToBadgeColor[status])}>{t(`status.${status}`)}</span>;
};
