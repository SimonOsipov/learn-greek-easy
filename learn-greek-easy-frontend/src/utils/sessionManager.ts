/**
 * SessionManager - Handles session timeout and activity monitoring
 *
 * Configuration:
 * - Inactivity timeout: 30 minutes (1800000ms)
 * - Warning time: 5 minutes before timeout (300000ms)
 * - Activity events: mousedown, keydown, scroll, touchstart
 */

class SessionManager {
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private warningTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  // Configuration constants
  private readonly INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly WARNING_TIME = 5 * 60 * 1000; // 5 minutes before timeout
  private readonly ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'];

  /**
   * Start inactivity monitoring with warning and timeout callbacks
   */
  startInactivityTimer(onTimeout: () => void, onWarning: (remainingSeconds: number) => void): void {
    this.resetTimers();

    // Set warning timer (25 minutes)
    this.warningTimer = setTimeout(() => {
      onWarning(this.WARNING_TIME / 1000); // Pass remaining seconds
      this.startCountdown(onWarning);
    }, this.INACTIVITY_TIMEOUT - this.WARNING_TIME);

    // Set logout timer (30 minutes)
    this.inactivityTimer = setTimeout(() => {
      onTimeout();
      this.cleanup();
    }, this.INACTIVITY_TIMEOUT);
  }

  /**
   * Start countdown for warning dialog
   */
  private startCountdown(onTick: (remainingSeconds: number) => void): void {
    let remainingSeconds = this.WARNING_TIME / 1000;

    this.countdownInterval = setInterval(() => {
      remainingSeconds -= 1;
      onTick(remainingSeconds);

      if (remainingSeconds <= 0) {
        this.stopCountdown();
      }
    }, 1000);
  }

  /**
   * Stop countdown interval
   */
  private stopCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  /**
   * Reset all timers (called on user activity)
   */
  resetTimers(): void {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    if (this.warningTimer) clearTimeout(this.warningTimer);
    this.stopCountdown();
  }

  /**
   * Extend session (called when user clicks "Stay Logged In")
   */
  extendSession(onTimeout: () => void, onWarning: (remainingSeconds: number) => void): void {
    this.resetTimers();
    this.startInactivityTimer(onTimeout, onWarning);
  }

  /**
   * Clean up all timers
   */
  cleanup(): void {
    this.resetTimers();
  }

  /**
   * Get activity events to monitor
   */
  getActivityEvents(): string[] {
    return this.ACTIVITY_EVENTS;
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();
