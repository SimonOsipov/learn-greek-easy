// src/components/shared/cardStatusColors.ts

export type CardStatus = 'new' | 'learning' | 'review' | 'mastered';

export const STATUS_DOT_CLASS: Record<CardStatus, string> = {
  new: 'bg-muted-foreground/30',
  learning: 'bg-blue-500',
  review: 'bg-blue-500',
  mastered: 'bg-green-500',
};

export const STATUS_TO_MASTERY: Record<CardStatus, number> = {
  new: 0,
  learning: 1,
  review: 2,
  mastered: 4,
};
