import { useSearchParams } from 'react-router-dom';

import { isValidTab } from '@/pages/admin/types';
import type { AdminTabType } from '@/pages/admin/types';

export interface AdminTabNav {
  openIn(tab: AdminTabType, params?: Record<string, string>): void;
  activeTab: AdminTabType;
  searchParams: URLSearchParams;
}

/**
 * Hook for admin tab navigation.
 *
 * - `openIn(tab, params)` — full-replace: writes `?tab=<tab>` plus any extra
 *   params; does NOT preserve other existing search params.
 * - `activeTab` — derived from `?tab=` with fallback to `'dashboard'`.
 * - `searchParams` — the raw URLSearchParams object.
 */
export function useAdminTabNav(): AdminTabNav {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab: AdminTabType = isValidTab(searchParams.get('tab'))
    ? (searchParams.get('tab') as AdminTabType)
    : 'dashboard';

  function openIn(tab: AdminTabType, params?: Record<string, string>): void {
    setSearchParams({ tab, ...params }, { replace: true });
  }

  return { openIn, activeTab, searchParams };
}
