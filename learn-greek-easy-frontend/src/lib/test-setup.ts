/**
 * Test Setup File
 * Runs before each test file to configure test environment
 */

// NOTE: We intentionally do NOT set VITE_API_URL from process.env for unit tests.
// Unit tests should use mocked API calls, not real backend connections.
// E2E tests (Playwright) handle their own API configuration.

import React from 'react';

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { afterEach, beforeAll, vi } from 'vitest';

// Import all translation resources for test i18n setup
import enAuth from '@/i18n/locales/en/auth.json';
import enCommon from '@/i18n/locales/en/common.json';
import enDeck from '@/i18n/locales/en/deck.json';
import enFeedback from '@/i18n/locales/en/feedback.json';
import enProfile from '@/i18n/locales/en/profile.json';
import enReview from '@/i18n/locales/en/review.json';
import enSettings from '@/i18n/locales/en/settings.json';
import enStatistics from '@/i18n/locales/en/statistics.json';

// Initialize i18n for tests with English translations
i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: enCommon,
      auth: enAuth,
      deck: enDeck,
      review: enReview,
      settings: enSettings,
      profile: enProfile,
      statistics: enStatistics,
      feedback: enFeedback,
    },
  },
  lng: 'en', // Force English for tests
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'auth', 'deck', 'review', 'settings', 'profile', 'statistics', 'feedback'],
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

// Ensure localStorage exists BEFORE any Zustand stores are imported
// Always use our mock for consistent behavior across tests
class LocalStorageMock implements Storage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] || null;
  }
}

const localStorageMock = new LocalStorageMock();
const sessionStorageMock = new LocalStorageMock();

// Assign to all possible global references
(globalThis as any).localStorage = localStorageMock;
(globalThis as any).sessionStorage = sessionStorageMock;
if (typeof window !== 'undefined') {
  (window as any).localStorage = localStorageMock;
  (window as any).sessionStorage = sessionStorageMock;
}
if (typeof global !== 'undefined') {
  (global as any).localStorage = localStorageMock;
  (global as any).sessionStorage = sessionStorageMock;
}

// Mock @react-oauth/google library
// This prevents "Google OAuth components must be used within GoogleOAuthProvider" errors
vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => children,
  GoogleLogin: ({
    onSuccess,
    onError,
  }: {
    onSuccess?: (response: { credential: string }) => void;
    onError?: () => void;
  }) =>
    React.createElement(
      'button',
      {
        type: 'button',
        'data-testid': 'google-login-mock',
        onClick: () => onSuccess?.({ credential: 'mock-credential-token' }),
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Escape') onError?.();
        },
      },
      'Continue with Google'
    ),
  useGoogleLogin: () => vi.fn(),
}));

// Mock posthog-js library
// This prevents PostHog from initializing during tests
vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    register: vi.fn(),
    reset: vi.fn(),
    people: {
      set: vi.fn(),
    },
  },
}));

// Mock posthog-js/react library
// This provides a passthrough provider for tests
vi.mock('posthog-js/react', () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => children,
  usePostHog: () => ({
    capture: vi.fn(),
    identify: vi.fn(),
  }),
}));

// Cleanup after each test (remove rendered components)
afterEach(() => {
  cleanup();
  // Clear localStorage and sessionStorage after each test
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear();
  }
});

// Mock browser APIs not available in test environment
beforeAll(() => {
  // Handle unhandled rejections gracefully during tests
  // This catches expected errors during async cleanup (e.g., session cleared during pending operation)
  const originalHandler = globalThis.onunhandledrejection;
  globalThis.onunhandledrejection = (event: PromiseRejectionEvent) => {
    // Ignore expected session cleanup errors - these occur when async operations
    // complete after the session has been cleared (race condition during test cleanup)
    if (event.reason?.message === 'No active review session found') {
      console.debug('Test cleanup: Expected session error suppressed');
      event.preventDefault();
      return;
    }
    // Pass through other errors to original handler
    if (originalHandler) {
      originalHandler.call(globalThis, event);
    }
  };
  // Mock window.matchMedia (for responsive hooks)
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock IntersectionObserver (for lazy loading)
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    takeRecords() {
      return [];
    }
    unobserve() {}
  } as any;

  // Mock ResizeObserver (for chart components)
  global.ResizeObserver = class ResizeObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    unobserve() {}
  } as any;

  // Mock scrollTo
  window.scrollTo = vi.fn();

  // Suppress console errors in tests (reduce noise)
  // Comment out if debugging specific console errors
  // global.console.error = vi.fn();
  // global.console.warn = vi.fn();
});
