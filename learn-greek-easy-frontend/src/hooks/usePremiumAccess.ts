import { useAuthStore } from '@/stores/authStore';

/**
 * Hook to check if the current user has premium access
 * Returns true for premium and admin users, false for free users
 */
export function usePremiumAccess(): boolean {
  const { user } = useAuthStore();
  return user?.role === 'premium' || user?.role === 'admin';
}
