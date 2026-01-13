import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useMemo,
  useRef,
} from 'react';

import {
  registerTheme,
  trackThemeChange,
  trackThemePreferenceLoaded,
  trackThemeMigration,
} from '@/lib/analytics';
import { reportAPIError } from '@/lib/errorReporting';
import log from '@/lib/logger';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';

export type Theme = 'light' | 'dark';

export interface ThemeContextValue {
  currentTheme: Theme;
  toggleTheme: (source?: 'header' | 'settings') => void;
  setTheme: (theme: Theme, source?: 'header' | 'settings') => void;
  isChanging: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = 'theme';
const GUEST_THEME_KEY = 'guest_theme'; // Track if theme was set as guest

// Debounce utility
function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuthStore();

  // Initialize from localStorage or default to light
  const [currentTheme, setCurrentTheme] = useState<Theme>(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'dark' || stored === 'light') {
          return stored;
        }
      }
    } catch {
      // localStorage unavailable (e.g., Safari private mode)
    }
    return 'light';
  });
  const [isChanging, setIsChanging] = useState(false);

  // Debounced API sync (500ms)
  const debouncedApiSyncRef = useRef(
    debounce(async (theme: Theme) => {
      try {
        setIsChanging(true);
        await api.patch('/api/v1/auth/me', { theme });
        log.debug(`[ThemeContext] Theme synced to API: ${theme}`);
      } catch (error) {
        reportAPIError(error, {
          operation: 'syncThemeToBackend',
          endpoint: '/api/v1/auth/me',
        });
        // Don't throw - local change still works
      } finally {
        setIsChanging(false);
      }
    }, 500)
  );

  // Register theme on mount
  useEffect(() => {
    registerTheme(currentTheme);
    trackThemePreferenceLoaded(
      currentTheme,
      localStorage.getItem(THEME_STORAGE_KEY) ? 'localStorage' : 'default'
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync theme class to document
  useEffect(() => {
    const root = document.documentElement;

    // Add transition class for smooth theme change
    root.classList.add('theme-transition');

    if (currentTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Remove transition class after animation completes
    const timeout = setTimeout(() => {
      root.classList.remove('theme-transition');
    }, 300);

    return () => clearTimeout(timeout);
  }, [currentTheme]);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
    } catch {
      // localStorage unavailable, theme works in-memory only
    }
  }, [currentTheme]);

  // Sync with user preference on login / handle migration
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const userSettings = (user as Record<string, unknown>).settings as
      | { theme?: Theme }
      | undefined;
    const userPreferences = (user as Record<string, unknown>).preferences as
      | { theme?: Theme }
      | undefined;

    // Check both settings (backend format) and preferences (frontend format)
    const userTheme = userSettings?.theme || userPreferences?.theme;

    const guestTheme = localStorage.getItem(GUEST_THEME_KEY);

    // Case 1: User has theme in DB - use it
    if (userTheme && userTheme !== 'light') {
      // Only update if different from current (and not default 'light')
      if (userTheme !== currentTheme) {
        setCurrentTheme(userTheme);
        trackThemePreferenceLoaded(userTheme, 'api');
      }
      // Clear guest marker since we're now using account preference
      localStorage.removeItem(GUEST_THEME_KEY);
      return;
    }

    // Case 2: User has no theme in DB, but was a guest with preference - migrate
    if (guestTheme) {
      log.debug(`[ThemeContext] Migrating guest theme preference: ${currentTheme}`);
      // Sync to API
      api
        .patch('/api/v1/auth/me', { theme: currentTheme })
        .then(() => {
          trackThemeMigration(currentTheme);
          localStorage.removeItem(GUEST_THEME_KEY);
        })
        .catch((error) => {
          reportAPIError(error, { operation: 'migrateTheme' });
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user]);

  const setTheme = useCallback(
    (theme: Theme, source: 'header' | 'settings' = 'header') => {
      if (theme === currentTheme) return;

      const previousTheme = currentTheme;
      log.debug(`[ThemeContext] Theme changed: ${previousTheme} -> ${theme} (source: ${source})`);

      setCurrentTheme(theme);
      registerTheme(theme);
      trackThemeChange(previousTheme, theme, source, isAuthenticated);

      // If authenticated, sync to API (debounced)
      if (isAuthenticated) {
        debouncedApiSyncRef.current(theme);
      } else {
        // Mark as guest preference for potential migration
        localStorage.setItem(GUEST_THEME_KEY, 'true');
      }
    },
    [currentTheme, isAuthenticated]
  );

  const toggleTheme = useCallback(
    (source: 'header' | 'settings' = 'header') => {
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      setTheme(newTheme, source);
    },
    [currentTheme, setTheme]
  );

  const value = useMemo(
    (): ThemeContextValue => ({
      currentTheme,
      toggleTheme,
      setTheme,
      isChanging,
    }),
    [currentTheme, toggleTheme, setTheme, isChanging]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
