/**
 * PostHogProvider Tests
 * Tests initialization conditions and graceful degradation
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import posthog from 'posthog-js';

import { PostHogProvider } from '../PostHogProvider';

// Mock posthog-js
vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    register: vi.fn(),
  },
}));

// Mock posthog-js/react
vi.mock('posthog-js/react', () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock analytics utils
vi.mock('@/utils/analytics', () => ({
  shouldInitializePostHog: vi.fn(),
  isTestUser: vi.fn(() => false),
}));

import { shouldInitializePostHog } from '@/utils/analytics';

describe('PostHogProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should render children regardless of initialization state', () => {
    vi.mocked(shouldInitializePostHog).mockReturnValue(false);

    render(
      <PostHogProvider>
        <div data-testid="child">Hello</div>
      </PostHogProvider>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('should not initialize posthog when shouldInitializePostHog returns false', () => {
    vi.mocked(shouldInitializePostHog).mockReturnValue(false);

    render(
      <PostHogProvider>
        <div>Child</div>
      </PostHogProvider>
    );

    expect(posthog.init).not.toHaveBeenCalled();
  });

  it('should initialize posthog when shouldInitializePostHog returns true', async () => {
    vi.mocked(shouldInitializePostHog).mockReturnValue(true);

    // Mock init to call the loaded callback
    vi.mocked(posthog.init).mockImplementation((_key, options) => {
      if (options?.loaded) {
        options.loaded({ register: vi.fn() } as unknown as typeof posthog);
      }
      return posthog;
    });

    render(
      <PostHogProvider>
        <div>Child</div>
      </PostHogProvider>
    );

    await waitFor(() => {
      expect(posthog.init).toHaveBeenCalled();
    });
  });

  it('should pass correct configuration to posthog.init', async () => {
    vi.mocked(shouldInitializePostHog).mockReturnValue(true);

    vi.mocked(posthog.init).mockImplementation((_key, options) => {
      if (options?.loaded) {
        options.loaded({ register: vi.fn() } as unknown as typeof posthog);
      }
      return posthog;
    });

    render(
      <PostHogProvider>
        <div>Child</div>
      </PostHogProvider>
    );

    await waitFor(() => {
      expect(posthog.init).toHaveBeenCalled();
      // Check the second argument (config) contains expected properties
      const [, config] = vi.mocked(posthog.init).mock.calls[0];
      expect(config).toMatchObject({
        person_profiles: 'identified_only',
        capture_pageview: true,
        capture_pageleave: true,
        autocapture: false,
        disable_session_recording: true,
      });
    });
  });

  it('should handle initialization errors gracefully', () => {
    vi.mocked(shouldInitializePostHog).mockReturnValue(true);
    vi.mocked(posthog.init).mockImplementation(() => {
      throw new Error('Init failed');
    });

    // Mock console.error to suppress error output in test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Should not throw
    expect(() => {
      render(
        <PostHogProvider>
          <div data-testid="child">Child</div>
        </PostHogProvider>
      );
    }).not.toThrow();

    // Children should still render
    expect(screen.getByTestId('child')).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('should render children even when PostHog initialization fails', () => {
    vi.mocked(shouldInitializePostHog).mockReturnValue(true);
    vi.mocked(posthog.init).mockImplementation(() => {
      throw new Error('Network error');
    });

    // Suppress console.error for this test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <PostHogProvider>
        <div data-testid="child-content">Important Content</div>
      </PostHogProvider>
    );

    // Graceful degradation: children should still render
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Important Content')).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('should register super properties when PostHog is loaded', async () => {
    vi.mocked(shouldInitializePostHog).mockReturnValue(true);

    const mockRegister = vi.fn();
    vi.mocked(posthog.init).mockImplementation((_key, options) => {
      if (options?.loaded) {
        options.loaded({ register: mockRegister } as unknown as typeof posthog);
      }
      return posthog;
    });

    render(
      <PostHogProvider>
        <div>Child</div>
      </PostHogProvider>
    );

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: expect.any(String),
          app_version: expect.any(String),
        })
      );
    });
  });

  it('should configure before_send filter for test users', async () => {
    vi.mocked(shouldInitializePostHog).mockReturnValue(true);

    let capturedBeforeSend:
      | ((event: Record<string, unknown>) => Record<string, unknown> | null)
      | undefined;

    vi.mocked(posthog.init).mockImplementation((_key, options) => {
      capturedBeforeSend = options?.before_send as typeof capturedBeforeSend;
      if (options?.loaded) {
        options.loaded({ register: vi.fn() } as unknown as typeof posthog);
      }
      return posthog;
    });

    render(
      <PostHogProvider>
        <div>Child</div>
      </PostHogProvider>
    );

    await waitFor(() => {
      expect(posthog.init).toHaveBeenCalled();
    });

    // Verify before_send was configured
    expect(capturedBeforeSend).toBeDefined();
  });

  describe('Test environment behavior', () => {
    it('should not initialize in test environment', () => {
      // shouldInitializePostHog returns false for test environment
      vi.mocked(shouldInitializePostHog).mockReturnValue(false);

      render(
        <PostHogProvider>
          <div data-testid="test-child">Test Content</div>
        </PostHogProvider>
      );

      // PostHog should NOT be initialized
      expect(posthog.init).not.toHaveBeenCalled();

      // But children should still render
      expect(screen.getByTestId('test-child')).toBeInTheDocument();
    });
  });

  describe('Missing API key behavior', () => {
    it('should not initialize without API key', () => {
      // shouldInitializePostHog returns false when API key is missing
      vi.mocked(shouldInitializePostHog).mockReturnValue(false);

      render(
        <PostHogProvider>
          <div data-testid="no-key-child">No Key Content</div>
        </PostHogProvider>
      );

      // PostHog should NOT be initialized
      expect(posthog.init).not.toHaveBeenCalled();

      // Children should still render
      expect(screen.getByTestId('no-key-child')).toBeInTheDocument();
    });
  });

  describe('Multiple children', () => {
    it('should render multiple children correctly', () => {
      vi.mocked(shouldInitializePostHog).mockReturnValue(false);

      render(
        <PostHogProvider>
          <div data-testid="child-1">First</div>
          <div data-testid="child-2">Second</div>
          <span data-testid="child-3">Third</span>
        </PostHogProvider>
      );

      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
      expect(screen.getByTestId('child-3')).toBeInTheDocument();
    });
  });
});
