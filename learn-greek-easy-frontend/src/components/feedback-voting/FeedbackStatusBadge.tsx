// src/components/feedback-voting/FeedbackStatusBadge.tsx

import React from 'react';

import { Badge } from '@/components/ui/badge';
import type { FeedbackStatus } from '@/types/feedback';

const statusConfig: Record<
  FeedbackStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  new: { label: 'New', variant: 'default' },
  under_review: { label: 'Under Review', variant: 'secondary' },
  planned: { label: 'Planned', variant: 'outline' },
  in_progress: { label: 'In Progress', variant: 'default' },
  completed: { label: 'Completed', variant: 'secondary' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

interface FeedbackStatusBadgeProps {
  status: FeedbackStatus;
}

export const FeedbackStatusBadge: React.FC<FeedbackStatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
};
