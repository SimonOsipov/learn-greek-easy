import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { DateRangeType } from '@/stores/analyticsStore';

interface DateRangeState {
  dateRange: DateRangeType;
  setDateRange: (range: DateRangeType) => void;
}

export const useDateRangeStore = create<DateRangeState>()(
  devtools(
    (set) => ({
      dateRange: 'last30',
      setDateRange: (range) => set({ dateRange: range }),
    }),
    { name: 'dateRangeStore' }
  )
);
