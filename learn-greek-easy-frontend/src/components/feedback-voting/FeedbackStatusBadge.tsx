// src/components/feedback-voting/FeedbackStatusBadge.tsx

import React from 'react';

import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import type { FeedbackStatus } from '@/types/feedback';

const statusConfig: Record<
  FeedbackStatus,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  new: { variant: 'default' },
  under_review: { variant: 'secondary' },
  planned: { variant: 'outline' },
  in_progress: { variant: 'default' },
  completed: { variant: 'secondary' },
  cancelled: { variant: 'destructive' },
};

interface FeedbackStatusBadgeProps {
  status: FeedbackStatus;
}

export const FeedbackStatusBadge: React.FC<FeedbackStatusBadgeProps> = ({ status }) => {
  const { t } = useTranslation('feedback');
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{t(`status.${status}`)}</Badge>;
};
