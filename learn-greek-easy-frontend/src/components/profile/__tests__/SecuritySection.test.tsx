import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecuritySection } from '../SecuritySection';
import { BrowserRouter } from 'react-router-dom';

// Mock dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    updatePassword: vi.fn(),
  }),
}));

const renderSecuritySection = () => {
  return render(
    <BrowserRouter>
      <SecuritySection />
    </BrowserRouter>
  );
};

describe('SecuritySection', () => {
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
});
