/**
 * PasswordStrengthIndicator Unit Tests
 *
 * Tests the advisory strength bar visibility and color coding behavior.
 * The requirements checklist was removed in AUTH-02; these tests cover the
 * advisory-bar-only contract.
 */

import { describe, it, expect, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import { PasswordStrengthIndicator } from '../PasswordStrengthIndicator';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'register.passwordStrength.label': 'Password strength:',
        'register.passwordStrength.weak': 'Weak',
        'register.passwordStrength.fair': 'Fair',
        'register.passwordStrength.strong': 'Strong',
      };
      return translations[key] ?? key;
    },
  }),
}));

describe('PasswordStrengthIndicator', () => {
  describe('Empty password', () => {
    it('does not show progress bar when password is empty', () => {
      render(<PasswordStrengthIndicator password="" />);

      expect(screen.queryByTestId('password-strength-bar')).not.toBeInTheDocument();
    });

    it('does not show strength label when password is empty', () => {
      render(<PasswordStrengthIndicator password="" />);

      expect(screen.queryByText('Password strength:')).not.toBeInTheDocument();
      expect(screen.queryByText('Weak')).not.toBeInTheDocument();
      expect(screen.queryByText('Fair')).not.toBeInTheDocument();
      expect(screen.queryByText('Strong')).not.toBeInTheDocument();
    });
  });

  describe('Non-empty password', () => {
    it('shows progress bar when password is non-empty', () => {
      render(<PasswordStrengthIndicator password="weakpass" />);

      expect(screen.getByTestId('password-strength-bar')).toBeInTheDocument();
    });

    it('progress bar uses h-2 class', () => {
      render(<PasswordStrengthIndicator password="weakpass" />);

      const progressBar = screen.getByTestId('password-strength-bar');
      // The Progress component renders with the h-2 class on the root element
      const progressEl = progressBar.querySelector('[role="progressbar"]');
      expect(progressEl).toHaveClass('h-2');
    });

    it('shows weak strength for a simple all-lowercase password', () => {
      // "abc" - only hasLowercase met (score=20 < 40) → weak
      render(<PasswordStrengthIndicator password="abc" />);

      expect(screen.getByText('Weak')).toBeInTheDocument();
      const weakSpan = screen.getByText('Weak');
      expect(weakSpan).toHaveClass('text-danger');
    });

    it('shows fair strength for a password meeting 2-3 requirements', () => {
      // "Weakpass" - hasLowercase + hasUppercase + minLength → score=60 → fair
      render(<PasswordStrengthIndicator password="Weakpass" />);

      expect(screen.getByText('Fair')).toBeInTheDocument();
      const fairSpan = screen.getByText('Fair');
      expect(fairSpan).toHaveClass('text-warning');
    });

    it('shows strong strength for a fully complex password', () => {
      // "Abcdefg1!" - all 5 requirements met → score=100 → strong
      render(<PasswordStrengthIndicator password="Abcdefg1!" />);

      expect(screen.getByText('Strong')).toBeInTheDocument();
      const strongSpan = screen.getByText('Strong');
      expect(strongSpan).toHaveClass('text-success');
    });

    it('shows strength label text when password is non-empty', () => {
      render(<PasswordStrengthIndicator password="weakpass" />);

      expect(screen.getByText('Password strength:')).toBeInTheDocument();
    });
  });

  describe('Always renders', () => {
    it('renders the component container for empty password', () => {
      render(<PasswordStrengthIndicator password="" />);

      expect(screen.getByTestId('password-strength-indicator')).toBeInTheDocument();
    });

    it('renders the component container for non-empty password', () => {
      render(<PasswordStrengthIndicator password="test" />);

      expect(screen.getByTestId('password-strength-indicator')).toBeInTheDocument();
    });
  });
});
