import { progressAPI } from '@/services/progressAPI';
import type { DateRangeType } from '@/stores/dateRangeStore';
import type { AnalyticsDashboardData } from '@/types/analytics';

import { transformToAnalyticsDashboardData } from '../lib/transform';

/**
 * Map date range type to API period parameter
 */
const mapDateRangeToPeriod = (dateRange: DateRangeType): 'week' | 'month' | 'year' => {
  switch (dateRange) {
    case 'last7':
      return 'week';
    case 'last30':
      return 'month';
    case 'alltime':
      return 'year';
    default:
      return 'month';
  }
};

/**
 * Fetch analytics data from backend and transform to frontend format
 */
export const getAnalytics = async (
  userId: string,
  dateRange: DateRangeType
): Promise<AnalyticsDashboardData> => {
  const period = mapDateRangeToPeriod(dateRange);

  const [dashboard, trends, deckProgress] = await Promise.all([
    progressAPI.getDashboard(),
    progressAPI.getTrends({ period }),
    progressAPI.getDeckProgressList({ page: 1, page_size: 50 }),
  ]);

  return transformToAnalyticsDashboardData(userId, dateRange, dashboard, trends, deckProgress);
};
