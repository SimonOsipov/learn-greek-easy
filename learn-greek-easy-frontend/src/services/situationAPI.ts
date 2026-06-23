import type {
  LearnerSituationDetailResponse,
  LearnerSituationListResponse,
  SituationComprehensionResponse,
  SituationStatsResponse,
} from '@/types/situation';

import { api, buildQueryString } from './api';

export interface SituationListParams {
  page?: number;
  page_size?: number;
  search?: string;
  has_audio?: boolean;
}

export const situationAPI = {
  getList: async (params: SituationListParams = {}): Promise<LearnerSituationListResponse> => {
    const queryString = buildQueryString({
      page: params.page ?? 1,
      page_size: params.page_size ?? 20,
      search: params.search,
      has_audio: params.has_audio,
    });
    return api.get<LearnerSituationListResponse>(`/api/v1/situations${queryString}`);
  },

  getById: async (id: string): Promise<LearnerSituationDetailResponse> => {
    return api.get<LearnerSituationDetailResponse>(`/api/v1/situations/${id}`);
  },

  // SIT-27-04: per-situation exercise counts for the detail metric strip.
  getStats: async (id: string): Promise<SituationStatsResponse> => {
    return api.get<SituationStatsResponse>(`/api/v1/situations/${id}/stats`);
  },

  // SIT-27-04: account-wide comprehension overview.
  getComprehension: async (): Promise<SituationComprehensionResponse> => {
    return api.get<SituationComprehensionResponse>('/api/v1/situations/comprehension');
  },
};
