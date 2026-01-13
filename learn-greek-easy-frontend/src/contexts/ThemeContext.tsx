import React, { createContext, useContext, useCallback, useEffect, useState, useMemo } from 'react';

import log from '@/lib/logger';

export type Theme = 'light' | 'dark';

export interface ThemeContextValue {
  currentTheme: Theme;
  toggleTheme: (source?: 'header' | 'settings') => void;
  setTheme: (theme: Theme, source?: 'header' | 'settings') => void;
  isChanging: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = 'theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
  // Note: setIsChanging will be used in DARKMODE-07 for API sync loading state
  const [isChanging, _setIsChanging] = useState(false);

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

  const setTheme = useCallback(
    (theme: Theme, source: 'header' | 'settings' = 'header') => {
      if (theme === currentTheme) return;

      log.debug(`[ThemeContext] Theme changed: ${currentTheme} -> ${theme} (source: ${source})`);
      setCurrentTheme(theme);
      // Note: API sync and analytics will be added in DARKMODE-07
    },
    [currentTheme]
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
