// src/components/feedback-voting/FeedbackCategoryBadge.tsx

import React from 'react';

import { Lightbulb, Bug } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { FeedbackCategory } from '@/types/feedback';

const categoryConfig: Record<
  FeedbackCategory,
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  feature_request: {
    label: 'Feature Request',
    icon: Lightbulb,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  bug_incorrect_data: {
    label: 'Bug / Incorrect Data',
    icon: Bug,
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
};

interface FeedbackCategoryBadgeProps {
  category: FeedbackCategory;
}

export const FeedbackCategoryBadge: React.FC<FeedbackCategoryBadgeProps> = ({ category }) => {
  const config = categoryConfig[category];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={config.className}>
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  );
};
