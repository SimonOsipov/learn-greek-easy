import { useTranslation } from 'react-i18next';

import type { AdminTabType } from '@/pages/admin/types';
import type { ContentStatsResponse } from '@/services/adminAPI';

interface DashboardViewProps {
  stats: ContentStatsResponse | null;
  setActiveTab: (tab: AdminTabType) => void;
}

/**
 * Dashboard tab body shell. Renders body only — `<PageHead>` is rendered once
 * by `AdminPage` via `pageHeadPropsFor('dashboard', t)`, and `<SectionTabs>`
 * is rendered once by the admin shell.
 *
 * Stat grid and dash grid content arrive in [DASH-04]. `stats` and
 * `setActiveTab` are forwarded from `AdminPage`'s existing data flow
 * (no duplicate fetch, no new query key, no Zustand).
 */
export default function DashboardView({
  stats: _stats,
  setActiveTab: _setActiveTab,
}: DashboardViewProps) {
  // i18n hook reserved for DASH-04 (stat grid + body grid copy).
  useTranslation('admin');

  return (
    <div>
      <section className="stat-grid" />
      <section className="dash-grid" />
    </div>
  );
}
