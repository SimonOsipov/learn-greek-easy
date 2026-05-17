// src/components/admin/decks/DeckDrawerSkeleton.tsx

import { Skeleton } from '@/components/ui/skeleton';

export type SkeletonVariant = 'list' | 'detail';

interface DeckDrawerSkeletonProps {
  variant: SkeletonVariant;
}

export function DeckDrawerSkeleton({ variant }: DeckDrawerSkeletonProps) {
  return (
    <div
      data-testid="deck-drawer-skeleton"
      data-variant={variant}
      className="flex flex-col gap-0 p-6"
    >
      {/* Header: type badge + title bar + meta row */}
      <Skeleton className="mb-2 h-6 w-24" />
      <Skeleton className="mb-3 h-8 w-3/4" />
      <Skeleton className="mb-6 h-4 w-1/2" />

      {variant === 'list' ? (
        <>
          {/* Tab bar */}
          <Skeleton className="mb-2 h-10 w-full" />
          {/* 6 list rows */}
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="mb-2 h-12 w-full" />
          ))}
        </>
      ) : (
        <>
          {/* Back link */}
          <Skeleton className="mb-4 h-4 w-32" />
          {/* Detail form blocks */}
          <Skeleton className="mb-3 h-20 w-full" />
          <Skeleton className="mb-3 h-20 w-full" />
          <Skeleton className="mb-3 h-20 w-full" />
          {/* Action bar */}
          <Skeleton className="h-10 w-full" />
        </>
      )}
    </div>
  );
}
