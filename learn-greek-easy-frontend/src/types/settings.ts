/**
 * Settings-related TypeScript interfaces
 *
 * Note: Most settings types (User, UserPreferences, UserRole) are defined in auth.ts
 * This file contains only settings-specific interfaces.
 */

/**
 * Subscription information
 * Extends the User.role field with additional subscription metadata
 */
export interface SubscriptionInfo {
  plan: 'free' | 'premium' | 'lifetime';
  status: 'active' | 'cancelled' | 'expired';
  startDate: Date;
  expiresAt?: Date;
}

/**
 * Email change form data
 */
export interface EmailChangeData {
  newEmail: string;
  currentPassword: string;
}

/**
 * Password change form data
 */
export interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
