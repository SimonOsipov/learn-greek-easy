/**
 * NewsCardSkeleton Component — two-zone shape matching NewsCard (NEWS-07 Batch 2, NWSR-03)
 *
 * Photo block (16/11 aspect) + solid body (description lines, player bar, footer row).
 * The fixed min-heights on description and title mirror the card for layout stability.
 */

import React from 'react';

import { Skeleton } from '@/components/ui/skeleton';

import { type NewsCardHeight } from './NewsCard';

export interface NewsCardSkeletonProps {
  height?: NewsCardHeight;
}

export const NewsCardSkeleton: React.FC<NewsCardSkeletonProps> = ({
  height: _height = 'default',
}) => (
  <div className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-line bg-card shadow-1">
    {/* Zone A: Photo block skeleton */}
    <div className="relative aspect-[16/11] overflow-hidden rounded-t-[var(--radius-lg)]">
      <Skeleton className="h-full w-full" />
    </div>

    {/* Zone B: Body skeleton */}
    <div className="flex flex-1 flex-col gap-[11px] px-4 pb-[15px] pt-3">
      {/* Title area placeholder (over-photo region is real content; body starts with description) */}
      {/* Description lines — 3-line reserved height to match card */}
      <div className="flex min-h-[calc(1.5em*3)] flex-col gap-1.5">
        <Skeleton className="h-[14px] w-full" />
        <Skeleton className="h-[14px] w-full" />
        <Skeleton className="h-[14px] w-4/5" />
      </div>

      {/* Audio player bar */}
      <Skeleton className="h-[44px] w-full rounded-[12px]" />

      {/* Footer row */}
      <div className="mt-auto flex items-center justify-between pt-1">
        <Skeleton className="h-[12px] w-24" />
        <Skeleton className="h-[12px] w-20" />
      </div>
    </div>
  </div>
);
