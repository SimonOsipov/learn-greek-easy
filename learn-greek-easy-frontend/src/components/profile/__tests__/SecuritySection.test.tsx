import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecuritySection } from '../SecuritySection';
import { BrowserRouter } from 'react-router-dom';

// Mock dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  Trans: ({ children, i18nKey }: { children?: React.ReactNode; i18nKey?: string }) =>
    children || i18nKey || null,
}));

// Create a mock for useAuthStore that we can modify per test
const mockAuthStore = {
  updatePassword: vi.fn(),
  user: null as { authProvider?: string } | null,
};

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => mockAuthStore,
}));

const renderSecuritySection = () => {
  return render(
    <BrowserRouter>
      <SecuritySection />
    </BrowserRouter>
  );
};

describe('SecuritySection', () => {
  beforeEach(() => {
    // Reset mock state before each test
    mockAuthStore.user = null;
    mockAuthStore.updatePassword.mockClear();
  });

  it('should render security section', () => {
    renderSecuritySection();
    expect(screen.getByTestId('security-section')).toBeInTheDocument();
  });

  it('should render change password section', () => {
    renderSecuritySection();
    expect(screen.getByTestId('change-password-button')).toBeInTheDocument();
  });

  it('should render danger zone', () => {
    renderSecuritySection();
    expect(screen.getByText(/security.dangerZone.title/i)).toBeInTheDocument();
  });

  it('should NOT render subscription section', () => {
    renderSecuritySection();
    expect(screen.queryByText(/security.subscription/i)).not.toBeInTheDocument();
  });

  it('should NOT render two-factor authentication section', () => {
    renderSecuritySection();
    expect(screen.queryByText(/security.twoFactor/i)).not.toBeInTheDocument();
  });

  it('should NOT render active sessions section', () => {
    renderSecuritySection();
    expect(screen.queryByText(/security.sessions/i)).not.toBeInTheDocument();
  });

  describe('auth provider handling', () => {
    it('should show password change button for auth0 (email/password) users', () => {
      mockAuthStore.user = { authProvider: 'auth0' };
      renderSecuritySection();

      expect(screen.getByTestId('change-password-button')).toBeInTheDocument();
      expect(screen.queryByTestId('social-login-message')).not.toBeInTheDocument();
    });

    it('should show social login message for google-oauth2 users', () => {
      mockAuthStore.user = { authProvider: 'google-oauth2' };
      renderSecuritySection();

      expect(screen.queryByTestId('change-password-button')).not.toBeInTheDocument();
      expect(screen.getByTestId('social-login-message')).toBeInTheDocument();
    });

    it('should show password change button when authProvider is undefined', () => {
      mockAuthStore.user = { authProvider: undefined };
      renderSecuritySection();

      expect(screen.getByTestId('change-password-button')).toBeInTheDocument();
      expect(screen.queryByTestId('social-login-message')).not.toBeInTheDocument();
    });

    it('should show password change button when user is null', () => {
      mockAuthStore.user = null;
      renderSecuritySection();

      expect(screen.getByTestId('change-password-button')).toBeInTheDocument();
      expect(screen.queryByTestId('social-login-message')).not.toBeInTheDocument();
    });
  });
});
