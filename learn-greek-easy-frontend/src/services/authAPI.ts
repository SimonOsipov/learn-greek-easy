// src/services/authAPI.ts

/**
 * Authentication API Service
 *
 * Provides methods for user profile management including:
 * - Profile retrieval and updates
 * - User deletion
 *
 * Note: Login, registration, and session management are handled
 * via Supabase Auth SDK. See supabaseClient.ts.
 */

import { api, clearAuthTokens } from './api';

// ============================================
// Types
// ============================================

/**
 * Token response from backend
 */
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * User profile response from backend
 */
export interface UserProfileResponse {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_superuser: boolean;
  auth_provider?: string | null; // e.g., 'email', 'google'
  effective_role?: 'admin' | 'premium' | 'free';
  created_at: string;
  updated_at: string;
  settings?: {
    id: string;
    user_id: string;
    daily_goal: number;
    email_notifications: boolean;
    theme?: 'light' | 'dark';
    created_at: string;
    updated_at: string;
  };
}

/**
 * Request for avatar upload URL
 */
export interface AvatarUploadRequest {
  content_type: string;
  file_size: number;
}

/**
 * Response with presigned upload URL
 */
export interface AvatarUploadResponse {
  upload_url: string;
  avatar_key: string;
  expires_in: number;
}

/**
 * Response for avatar deletion
 */
export interface AvatarDeleteResponse {
  success: boolean;
  message: string;
}

/**
 * Profile update request (partial)
 */
export interface ProfileUpdateRequest {
  full_name?: string;
  avatar_url?: string;
  daily_goal?: number;
  email_notifications?: boolean;
  preferred_language?: string;
  theme?: 'light' | 'dark';
}

/**
 * Logout response
 */
export interface LogoutResponse {
  success: boolean;
  message: string;
  token_revoked: boolean;
}

// ============================================
// Auth API Methods
// ============================================

export const authAPI = {
  /**
   * Refresh access token
   */
  refresh: async (refreshToken: string): Promise<TokenResponse> => {
    return api.post<TokenResponse>(
      '/api/v1/auth/refresh',
      { refresh_token: refreshToken },
      { skipAuth: true }
    );
  },

  /**
   * Logout (revoke refresh token)
   */
  logout: async (refreshToken: string): Promise<LogoutResponse> => {
    return api.post<LogoutResponse>('/api/v1/auth/logout', { refresh_token: refreshToken });
  },

  /**
   * Logout from all sessions
   */
  logoutAll: async (): Promise<{ success: boolean; message: string; sessions_revoked: number }> => {
    return api.post('/api/v1/auth/logout-all');
  },

  /**
   * Get current user profile
   */
  getProfile: async (options?: { signal?: AbortSignal }): Promise<UserProfileResponse> => {
    return api.get<UserProfileResponse>('/api/v1/auth/me', { signal: options?.signal });
  },

  /**
   * Get presigned URL for avatar upload
   */
  getAvatarUploadUrl: async (request: AvatarUploadRequest): Promise<AvatarUploadResponse> => {
    return api.post<AvatarUploadResponse>('/api/v1/auth/avatar/upload-url', request);
  },

  /**
   * Upload file directly to S3 using presigned URL
   */
  uploadToS3: async (presignedUrl: string, file: File): Promise<void> => {
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!response.ok) {
      throw new Error(`S3 upload failed: ${response.status} ${response.statusText}`);
    }
  },

  /**
   * Update user profile
   */
  updateProfile: async (updates: ProfileUpdateRequest): Promise<UserProfileResponse> => {
    return api.patch<UserProfileResponse>('/api/v1/auth/me', updates);
  },

  /**
   * Remove avatar
   */
  removeAvatar: async (): Promise<AvatarDeleteResponse> => {
    return api.delete<AvatarDeleteResponse>('/api/v1/auth/avatar');
  },

  /**
   * Clear local auth tokens
   */
  clearTokens: clearAuthTokens,
};

// Re-export for consumers who import from authAPI
export { clearAuthTokens } from './api';
