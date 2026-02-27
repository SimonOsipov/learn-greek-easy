/**
 * PasswordStrengthIndicator Unit Tests
 *
 * Tests the password requirements checklist, progress bar visibility,
 * and strength color coding behavior.
 */

import { describe, it, expect, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import { PasswordStrengthIndicator } from '../PasswordStrengthIndicator';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'register.passwordRequirements.minLength': 'At least 8 characters',
        'register.passwordRequirements.hasLowercase': 'One lowercase letter',
        'register.passwordRequirements.hasUppercase': 'One uppercase letter',
        'register.passwordRequirements.hasNumber': 'One number',
        'register.passwordRequirements.hasSpecial': 'One special character',
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
    it('renders checklist with 5 items when password is empty', () => {
      render(<PasswordStrengthIndicator password="" />);

      const list = screen.getByTestId('password-requirements-list');
      const items = list.querySelectorAll('li');
      expect(items).toHaveLength(5);
    });

    it('shows all 5 items with X (unchecked) when password is empty', () => {
      render(<PasswordStrengthIndicator password="" />);

      expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
      expect(screen.getByText('One lowercase letter')).toBeInTheDocument();
      expect(screen.getByText('One uppercase letter')).toBeInTheDocument();
      expect(screen.getByText('One number')).toBeInTheDocument();
      expect(screen.getByText('One special character')).toBeInTheDocument();

      // All items should have muted-foreground (unchecked) color
      const items = screen.getByTestId('password-requirements-list').querySelectorAll('li');
      items.forEach((item) => {
        const span = item.querySelector('span');
        expect(span).toHaveClass('text-muted-foreground');
      });
    });

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
    it('shows all 5 items checked (green) for a fully valid password', () => {
      render(<PasswordStrengthIndicator password="Abcdefg1!" />);

      const items = screen.getByTestId('password-requirements-list').querySelectorAll('li');
      expect(items).toHaveLength(5);
      items.forEach((item) => {
        const span = item.querySelector('span');
        expect(span).toHaveClass('text-green-500');
      });
    });

    it('shows only hasLowercase checked for password "abc"', () => {
      render(<PasswordStrengthIndicator password="abc" />);

      const list = screen.getByTestId('password-requirements-list');
      const items = list.querySelectorAll('li');

      // minLength: not met (abc < 8)
      expect(items[0].querySelector('span')).toHaveClass('text-muted-foreground');
      // hasLowercase: met
      expect(items[1].querySelector('span')).toHaveClass('text-green-500');
      // hasUppercase: not met
      expect(items[2].querySelector('span')).toHaveClass('text-muted-foreground');
      // hasNumber: not met
      expect(items[3].querySelector('span')).toHaveClass('text-muted-foreground');
      // hasSpecial: not met
      expect(items[4].querySelector('span')).toHaveClass('text-muted-foreground');
    });

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
      expect(weakSpan).toHaveClass('text-red-500');
    });

    it('shows fair strength for a password meeting 2-3 requirements', () => {
      // "Weakpass" - hasLowercase + hasUppercase + minLength → score=60 → fair
      render(<PasswordStrengthIndicator password="Weakpass" />);

      expect(screen.getByText('Fair')).toBeInTheDocument();
      const fairSpan = screen.getByText('Fair');
      expect(fairSpan).toHaveClass('text-yellow-500');
    });

    it('shows strong strength for a fully complex password', () => {
      // "Abcdefg1!" - all 5 requirements met → score=100 → strong
      render(<PasswordStrengthIndicator password="Abcdefg1!" />);

      expect(screen.getByText('Strong')).toBeInTheDocument();
      const strongSpan = screen.getByText('Strong');
      expect(strongSpan).toHaveClass('text-green-500');
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
