// src/services/dashboardAPI.ts
// PERF-15-05 — client for GET /api/v1/dashboard/summary, the single-call
// endpoint that replaces the dashboard's eight separate per-domain calls.

import type { DashboardSummaryResponse } from '@/types/dashboard';

import { api } from './api';

export const dashboardAPI = {
  getSummary: async (): Promise<DashboardSummaryResponse> => {
    return api.get<DashboardSummaryResponse>('/api/v1/dashboard/summary');
  },
};
