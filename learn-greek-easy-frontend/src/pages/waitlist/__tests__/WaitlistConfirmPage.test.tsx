/**
 * WaitlistConfirmPage Component Tests
 *
 * Tests for:
 * - Valid token: loading -> confirmed state
 * - Invalid/rejected token: error state UI
 * - No token: stuck in pending state (no API call made)
 * - Non-loading states show Back-to-Home link
 *
 * Note: There is no timeout on a broken/hanging API response. A request
 * that never resolves or rejects will leave the page in 'loading' state
 * indefinitely (no Back-to-Home, spinner shown forever). This is a UX
 * issue but not addressed here to stay within surgical scope.
 */

import { act } from 'react';

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import i18n from 'i18next';

import { render, screen, waitFor } from '@/lib/test-utils';
import enWaitlist from '@/i18n/locales/en/waitlist.json';
import { WaitlistConfirmPage } from '../WaitlistConfirmPage';

// Hoisted so they are safe to reference inside vi.mock factories
const mockGetSearchParams = vi.hoisted(() => vi.fn());
const mockConfirm = vi.hoisted(() => vi.fn());

// Helmet requires HelmetProvider — mock it to avoid the provider constraint in unit tests
vi.mock('@dr.pogodin/react-helmet', () => ({
  Helmet: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [{ get: mockGetSearchParams }, vi.fn()],
  };
});

vi.mock('@/services/waitlistAPI', () => ({
  waitlistAPI: {
    confirm: (...args: unknown[]) => mockConfirm(...args),
  },
}));

// Required: LanguageProvider in the test-utils render tree calls useAuthStore() as a hook
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({ user: null, isAuthenticated: false })),
}));

describe('WaitlistConfirmPage', () => {
  beforeAll(() => {
    // The shared test-setup.ts does not register the 'waitlist' namespace.
    // Add it here so useTranslation('waitlist') resolves real strings, not keys.
    i18n.addResourceBundle('en', 'waitlist', enWaitlist, true, false);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('valid token — loading then confirmed', () => {
    it('should call waitlistAPI.confirm with the token', async () => {
      mockGetSearchParams.mockReturnValue('valid-token-123');
      mockConfirm.mockResolvedValue({ message: 'confirmed' });

      await act(async () => {
        render(<WaitlistConfirmPage />);
      });

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalledWith('valid-token-123');
      });
    });

    it('should show confirmed title after successful confirmation', async () => {
      mockGetSearchParams.mockReturnValue('valid-token-abc');
      mockConfirm.mockResolvedValue({ message: 'confirmed' });

      await act(async () => {
        render(<WaitlistConfirmPage />);
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
          "You're on the Waitlist!"
        );
      });
    });

    it('should show Back-to-Home button in confirmed state', async () => {
      mockGetSearchParams.mockReturnValue('valid-token-abc');
      mockConfirm.mockResolvedValue({ message: 'confirmed' });

      await act(async () => {
        render(<WaitlistConfirmPage />);
      });

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /back to home/i })).toBeInTheDocument();
      });
    });

    it('should link Back-to-Home to the root path', async () => {
      mockGetSearchParams.mockReturnValue('valid-token-abc');
      mockConfirm.mockResolvedValue({ message: 'confirmed' });

      await act(async () => {
        render(<WaitlistConfirmPage />);
      });

      await waitFor(() => {
        const link = screen.getByRole('link', { name: /back to home/i });
        expect(link).toHaveAttribute('href', '/');
      });
    });
  });

  describe('rejected token — error state', () => {
    it('should show error title when API call rejects', async () => {
      mockGetSearchParams.mockReturnValue('bad-token');
      mockConfirm.mockRejectedValue(new Error('invalid token'));

      await act(async () => {
        render(<WaitlistConfirmPage />);
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Something Went Wrong');
      });
    });

    it('should show error body text when API call rejects', async () => {
      mockGetSearchParams.mockReturnValue('expired-token');
      mockConfirm.mockRejectedValue(new Error('expired'));

      await act(async () => {
        render(<WaitlistConfirmPage />);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/this confirmation link is invalid or has already been used/i)
        ).toBeInTheDocument();
      });
    });

    it('should show Back-to-Home button in error state', async () => {
      mockGetSearchParams.mockReturnValue('bad-token');
      mockConfirm.mockRejectedValue(new Error('invalid'));

      await act(async () => {
        render(<WaitlistConfirmPage />);
      });

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /back to home/i })).toBeInTheDocument();
      });
    });
  });

  describe('no token — pending state', () => {
    it('should NOT call waitlistAPI.confirm when token is absent', () => {
      mockGetSearchParams.mockReturnValue(null);

      render(<WaitlistConfirmPage />);

      expect(mockConfirm).not.toHaveBeenCalled();
    });

    it('should show the pending title when no token is provided', () => {
      mockGetSearchParams.mockReturnValue(null);

      render(<WaitlistConfirmPage />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Check Your Inbox');
    });

    it('should show the spam hint in pending state', () => {
      mockGetSearchParams.mockReturnValue(null);

      render(<WaitlistConfirmPage />);

      expect(
        screen.getByText(/don't see it\? check your spam or junk folder/i)
      ).toBeInTheDocument();
    });

    it('should show Back-to-Home button in pending state', () => {
      mockGetSearchParams.mockReturnValue(null);

      render(<WaitlistConfirmPage />);

      expect(screen.getByRole('link', { name: /back to home/i })).toBeInTheDocument();
    });
  });

  describe('loading state — with token, before resolution', () => {
    it('should NOT show Back-to-Home button while loading', () => {
      mockGetSearchParams.mockReturnValue('some-token');
      // Never resolves: simulates an in-flight request
      mockConfirm.mockReturnValue(new Promise(() => {}));

      render(<WaitlistConfirmPage />);

      expect(screen.queryByRole('link', { name: /back to home/i })).not.toBeInTheDocument();
    });

    it('should show the pending/loading title while in-flight', () => {
      mockGetSearchParams.mockReturnValue('some-token');
      mockConfirm.mockReturnValue(new Promise(() => {}));

      render(<WaitlistConfirmPage />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Check Your Inbox');
    });
  });
});
