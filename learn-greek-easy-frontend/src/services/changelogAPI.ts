/**
 * API service for changelog operations.
 */

import type {
  ChangelogListResponse,
  ChangelogEntryAdmin,
  ChangelogCreateRequest,
  ChangelogUpdateRequest,
  ChangelogAdminListResponse,
} from '@/types/changelog';

import { api, buildQueryString } from './api';

export const changelogAPI = {
  /**
   * Get paginated changelog entries (public, localized).
   * Content language determined by Accept-Language header.
   */
  getList: async (page = 1, pageSize = 5): Promise<ChangelogListResponse> => {
    const query = buildQueryString({ page, page_size: pageSize });
    return api.get<ChangelogListResponse>(`/api/v1/changelog${query}`);
  },

  /**
   * Get paginated changelog entries for admin (all languages).
   */
  adminGetList: async (page = 1, pageSize = 10): Promise<ChangelogAdminListResponse> => {
    const query = buildQueryString({ page, page_size: pageSize });
    return api.get<ChangelogAdminListResponse>(`/api/v1/admin/changelog${query}`);
  },

  /**
   * Get single changelog entry by ID (admin).
   */
  adminGetById: async (id: string): Promise<ChangelogEntryAdmin> => {
    return api.get<ChangelogEntryAdmin>(`/api/v1/admin/changelog/${id}`);
  },

  /**
   * Create a new changelog entry (admin).
   */
  adminCreate: async (data: ChangelogCreateRequest): Promise<ChangelogEntryAdmin> => {
    return api.post<ChangelogEntryAdmin>('/api/v1/admin/changelog', data);
  },

  /**
   * Update an existing changelog entry (admin).
   */
  adminUpdate: async (id: string, data: ChangelogUpdateRequest): Promise<ChangelogEntryAdmin> => {
    return api.put<ChangelogEntryAdmin>(`/api/v1/admin/changelog/${id}`, data);
  },

  /**
   * Delete a changelog entry (admin).
   */
  adminDelete: async (id: string): Promise<void> => {
    return api.delete(`/api/v1/admin/changelog/${id}`);
  },
};
