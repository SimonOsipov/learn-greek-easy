import { useQuery } from '@tanstack/react-query';

import { cultureDeckAPI } from '@/services/cultureDeckAPI';

export function useCultureReadiness() {
  const query = useQuery({
    queryKey: ['cultureReadiness'],
    queryFn: () => cultureDeckAPI.getReadiness(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    isError: query.isError,
  };
}
