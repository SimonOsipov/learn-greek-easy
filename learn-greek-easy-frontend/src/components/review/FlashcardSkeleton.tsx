import { Skeleton } from '@/components/ui/skeleton';

export function FlashcardSkeleton() {
  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden min-h-[800px]">
      {/* Progress header skeleton */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <Skeleton className="h-2 bg-gray-200 rounded-full mb-2 animate-pulse" />
        <Skeleton className="h-4 bg-gray-200 rounded w-48 mx-auto animate-pulse" />
      </div>

      {/* Main card skeleton */}
      <div className="px-8 py-12 text-center">
        <Skeleton className="h-12 bg-gray-200 rounded w-64 mx-auto mb-3 animate-pulse" />
        <Skeleton className="h-5 bg-gray-200 rounded w-40 mx-auto mb-6 animate-pulse" />
        <div className="flex gap-2 justify-center mb-6">
          <Skeleton className="h-6 w-32 bg-gray-200 rounded-full animate-pulse" />
          <Skeleton className="h-6 w-12 bg-gray-200 rounded-full animate-pulse" />
        </div>
        <Skeleton className="h-8 bg-gray-200 rounded w-48 mx-auto animate-pulse" />
      </div>

      {/* Rating buttons skeleton */}
      <div className="px-8 py-6 flex gap-3 justify-center">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-11 w-28 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>

      {/* Grammar section skeleton */}
      <div className="bg-gray-50 border-t border-gray-200 px-6 py-6">
        <Skeleton className="h-5 bg-gray-200 rounded w-40 mb-4 animate-pulse" />
        <div className="bg-white rounded-xl p-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
