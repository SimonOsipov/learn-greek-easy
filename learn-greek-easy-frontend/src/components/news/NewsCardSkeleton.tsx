/**
 * NewsCardSkeleton Component
 *
 * Loading skeleton for news cards with configurable height
 * to match the NewsCard component variants.
 */

import React from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { type NewsCardHeight } from './NewsCard';

export interface NewsCardSkeletonProps {
  height?: NewsCardHeight;
}

const heightClasses: Record<NewsCardHeight, string> = {
  default: 'h-48',
  tall: 'h-[300px]',
};

export const NewsCardSkeleton: React.FC<NewsCardSkeletonProps> = ({ height = 'default' }) => (
  <div className={cn('overflow-hidden rounded-lg', heightClasses[height])}>
    <Skeleton className="h-full w-full" />
  </div>
);
