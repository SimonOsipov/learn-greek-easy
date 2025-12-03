import { Skeleton } from '@/components/ui/skeleton';

export function FlashcardSkeleton() {
  return (
    <div className="mx-auto min-h-[800px] max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
      {/* Progress header skeleton */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
        <Skeleton className="mb-2 h-2 animate-pulse rounded-full bg-gray-200" />
        <Skeleton className="mx-auto h-4 w-48 animate-pulse rounded bg-gray-200" />
      </div>

      {/* Main card skeleton */}
      <div className="px-8 py-12 text-center">
        <Skeleton className="mx-auto mb-3 h-12 w-64 animate-pulse rounded bg-gray-200" />
        <Skeleton className="mx-auto mb-6 h-5 w-40 animate-pulse rounded bg-gray-200" />
        <div className="mb-6 flex justify-center gap-2">
          <Skeleton className="h-6 w-32 animate-pulse rounded-full bg-gray-200" />
          <Skeleton className="h-6 w-12 animate-pulse rounded-full bg-gray-200" />
        </div>
        <Skeleton className="mx-auto h-8 w-48 animate-pulse rounded bg-gray-200" />
      </div>

      {/* Rating buttons skeleton */}
      <div className="flex justify-center gap-3 px-8 py-6">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-11 w-28 animate-pulse rounded-lg bg-gray-200" />
        ))}
      </div>

      {/* Grammar section skeleton */}
      <div className="border-t border-gray-200 bg-gray-50 px-6 py-6">
        <Skeleton className="mb-4 h-5 w-40 animate-pulse rounded bg-gray-200" />
        <div className="space-y-3 rounded-xl bg-white p-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10 animate-pulse rounded bg-gray-200" />
          ))}
        </div>
      </div>
    </div>
  );
}
