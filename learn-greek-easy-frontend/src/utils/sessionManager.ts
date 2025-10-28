import { useAuthStore } from '@/stores/authStore';

export class SessionManager {
  private inactivityTimer: NodeJS.Timeout | null = null;
  private warningTimer: NodeJS.Timeout | null = null;
  private readonly INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly WARNING_TIME = 5 * 60 * 1000; // 5 minutes before timeout

  startInactivityTimer(
    onTimeout: () => void,
    onWarning?: () => void
  ): void {
    this.resetTimers();

    // Set warning timer
    if (onWarning) {
      this.warningTimer = setTimeout(() => {
        onWarning();
      }, this.INACTIVITY_TIMEOUT - this.WARNING_TIME);
    }

    // Set logout timer
    this.inactivityTimer = setTimeout(() => {
      onTimeout();
    }, this.INACTIVITY_TIMEOUT);
  }

  resetTimers(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
  }

  async extendSession(): Promise<void> {
    try {
      const { refreshSession } = useAuthStore.getState();
      await refreshSession();
      this.resetTimers();
    } catch (error) {
      console.error('Failed to extend session:', error);
    }
  }

  destroy(): void {
    this.resetTimers();
  }
}

// Singleton instance
export const sessionManager = new SessionManager();
