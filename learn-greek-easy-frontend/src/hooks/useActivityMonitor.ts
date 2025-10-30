import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { sessionManager } from '@/utils/sessionManager';
import { useToast } from '@/hooks/use-toast';

interface UseActivityMonitorReturn {
  showWarning: boolean;
  remainingSeconds: number;
  extendSession: () => void;
}

/**
 * Hook to monitor user activity and manage session timeout
 *
 * Features:
 * - Monitors user activity (mouse, keyboard, scroll, touch)
 * - Shows warning 5 minutes before logout
 * - Auto-logout after 30 minutes of inactivity
 * - Allows session extension
 */
export const useActivityMonitor = (): UseActivityMonitorReturn => {
  const { logout, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(300); // 5 minutes

  // Handle timeout (auto-logout)
  const handleTimeout = useCallback(() => {
    logout();
    navigate('/login');
    toast({
      title: 'Session expired',
      description: "You've been logged out due to inactivity.",
      variant: 'destructive',
    });
  }, [logout, navigate, toast]);

  // Handle warning (show dialog)
  const handleWarning = useCallback((seconds: number) => {
    setRemainingSeconds(seconds);
    setShowWarning(true);
  }, []);

  // Extend session (reset timers)
  const extendSession = useCallback(() => {
    setShowWarning(false);
    setRemainingSeconds(300);
    sessionManager.extendSession(handleTimeout, handleWarning);
    toast({
      title: 'Session extended',
      description: 'Your session has been extended for another 30 minutes.',
    });
  }, [handleTimeout, handleWarning, toast]);

  // Set up activity monitoring
  useEffect(() => {
    if (!isAuthenticated) {
      sessionManager.cleanup();
      return;
    }

    const activityEvents = sessionManager.getActivityEvents();

    // Reset timer on any activity
    const resetTimer = () => {
      if (showWarning) return; // Don't reset if warning is showing
      sessionManager.extendSession(handleTimeout, handleWarning);
    };

    // Add event listeners for all activity types
    activityEvents.forEach(event => {
      document.addEventListener(event, resetTimer);
    });

    // Start initial timer
    sessionManager.startInactivityTimer(handleTimeout, handleWarning);

    // Cleanup on unmount or logout
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
      sessionManager.cleanup();
    };
  }, [isAuthenticated, showWarning, handleTimeout, handleWarning]);

  return {
    showWarning,
    remainingSeconds,
    extendSession,
  };
};
