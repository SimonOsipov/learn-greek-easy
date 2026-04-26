import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type DateRangeType = 'last7' | 'last30' | 'alltime';

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
