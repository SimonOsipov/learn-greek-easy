/**
 * LanguageContext Tests
 *
 * Tests for the language context and provider functionality.
 * These tests verify that:
 * - Context provides current language correctly
 * - Language can be changed successfully
 * - Loading state is managed during language changes
 * - Available languages are provided
 */

import React from 'react';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { LanguageProvider, useLanguage } from '../LanguageContext';
import { SUPPORTED_LANGUAGES } from '@/i18n/constants';

// Mock dependencies
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ user: null, isAuthenticated: false }),
}));

vi.mock('@/services/api', () => ({
  api: {
    patch: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('@/lib/analytics', () => ({
  registerInterfaceLanguage: vi.fn(),
  trackLanguageSwitch: vi.fn(),
}));

describe('LanguageContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <LanguageProvider>{children}</LanguageProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('useLanguage hook', () => {
    it('should throw error when used outside LanguageProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useLanguage());
      }).toThrow('useLanguage must be used within a LanguageProvider');

      consoleSpy.mockRestore();
    });

    it('should provide current language', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });
      // Should be one of the supported languages
      expect(SUPPORTED_LANGUAGES).toContain(result.current.currentLanguage);
    });

    it('should provide available languages array', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });
      expect(result.current.availableLanguages).toBeInstanceOf(Array);
      expect(result.current.availableLanguages.length).toBeGreaterThan(0);
    });

    it('should provide changeLanguage function', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });
      expect(typeof result.current.changeLanguage).toBe('function');
    });

    it('should provide getLanguageName function', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });
      expect(typeof result.current.getLanguageName).toBe('function');
    });

    it('should provide isChanging state', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });
      expect(typeof result.current.isChanging).toBe('boolean');
    });
  });

  describe('Language Change', () => {
    it('should change language to Russian', async () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      await act(async () => {
        await result.current.changeLanguage('ru', 'header');
      });

      await waitFor(() => {
        expect(result.current.currentLanguage).toBe('ru');
      });
    });

    it('should change language to English', async () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      // First switch to Russian
      await act(async () => {
        await result.current.changeLanguage('ru', 'header');
      });

      // Then switch back to English
      await act(async () => {
        await result.current.changeLanguage('en', 'header');
      });

      await waitFor(() => {
        expect(result.current.currentLanguage).toBe('en');
      });
    });

    it('should not change language if same as current', async () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });
      const currentLang = result.current.currentLanguage;

      // isChanging should remain false if trying to change to same language
      await act(async () => {
        await result.current.changeLanguage(currentLang, 'header');
      });

      expect(result.current.isChanging).toBe(false);
    });
  });

  describe('Available Languages', () => {
    it('should have English option', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      const englishOption = result.current.availableLanguages.find((lang) => lang.code === 'en');

      expect(englishOption).toBeDefined();
      expect(englishOption?.nativeName).toBe('English');
    });

    it('should have Russian option', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      const russianOption = result.current.availableLanguages.find((lang) => lang.code === 'ru');

      expect(russianOption).toBeDefined();
      expect(russianOption?.nativeName).toBe('Русский');
    });

    it('should have flag emoji for each language', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      result.current.availableLanguages.forEach((option) => {
        expect(option.flag).toBeDefined();
        expect(option.flag).not.toBe('');
      });
    });
  });

  describe('getLanguageName', () => {
    it('should return English for "en" code', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });
      expect(result.current.getLanguageName('en')).toBe('English');
    });

    it('should return Russian name for "ru" code', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });
      expect(result.current.getLanguageName('ru')).toBe('Русский');
    });
  });

  describe('isChanging State', () => {
    it('should initially be false', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });
      expect(result.current.isChanging).toBe(false);
    });

    it('should return to false after language change completes', async () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      await act(async () => {
        await result.current.changeLanguage('ru', 'header');
      });

      await waitFor(() => {
        expect(result.current.isChanging).toBe(false);
      });
    });
  });

  describe('Source Parameter', () => {
    it('should accept header source', async () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      // Should not throw when passing 'header' as source
      await act(async () => {
        await result.current.changeLanguage('ru', 'header');
      });

      expect(result.current.currentLanguage).toBe('ru');
    });

    it('should accept settings source', async () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      // Should not throw when passing 'settings' as source
      await act(async () => {
        await result.current.changeLanguage('ru', 'settings');
      });

      expect(result.current.currentLanguage).toBe('ru');
    });

    it('should default to header source if not provided', async () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      // Should not throw when source is omitted
      await act(async () => {
        await result.current.changeLanguage('ru');
      });

      expect(result.current.currentLanguage).toBe('ru');
    });
  });
});
