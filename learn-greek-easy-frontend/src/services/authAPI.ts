// src/services/authAPI.ts

/**
 * Authentication API Service
 *
 * Provides methods for user authentication including:
 * - Token refresh
 * - Logout
 * - Profile retrieval
 *
 * Note: Login and registration are handled via Auth0.
 * See useAuth0Integration hook for Auth0-based authentication.
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
  is_active: boolean;
  is_superuser: boolean;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
  settings?: {
    id: string;
    user_id: string;
    daily_goal: number;
    email_notifications: boolean;
    created_at: string;
    updated_at: string;
  };
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
   * Clear local auth tokens
   */
  clearTokens: clearAuthTokens,
};

// Re-export for consumers who import from authAPI
export { clearAuthTokens } from './api';
