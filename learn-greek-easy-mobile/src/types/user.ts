/**
 * Copy-first port of the user/settings types needed for ONB-04 (settings
 * read + PATCH hook) and downstream onboarding screens.
 * Source: learn-greek-easy-frontend/src/services/authAPI.ts:33-54 (shape ported
 * and extended with ONB-02 fields: proficiency_level, learning_goal).
 * Copied (not shared) pending a future monorepo packages/shared extraction.
 */

export interface UserSettings {
  id: string;
  user_id: string;
  daily_goal: number;
  email_notifications: boolean;
  theme: string | null;
  preferred_language?: string | null;
  tour_completed_at: string | null;
  proficiency_level: string | null;
  learning_goal: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_superuser: boolean;
  auth_provider?: string | null;
  effective_role?: 'admin' | 'premium' | 'free';
  created_at: string;
  updated_at: string;
  /** Backend get-or-create guarantees this is always present on /me responses. */
  settings: UserSettings;
}

export interface UserSettingsUpdate {
  daily_goal?: number;
  email_notifications?: boolean;
  theme?: string;
  preferred_language?: string;
  tour_completed_at?: string;
  proficiency_level?: string;
  learning_goal?: string;
}
