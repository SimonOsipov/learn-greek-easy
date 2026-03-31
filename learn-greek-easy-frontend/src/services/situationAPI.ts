import type {
  LearnerSituationDetailResponse,
  LearnerSituationListResponse,
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
};
