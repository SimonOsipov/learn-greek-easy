import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders, screen } from '@/lib/test-utils';

vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>();
  return {
    ...actual,
    track: vi.fn(),
  };
});

vi.mock('@/lib/logger', () => ({
  default: { warn: vi.fn() },
}));

import { LanguageToggle } from '../LanguageToggle';

describe('LanguageToggle', () => {
  const defaultProps = {
    value: 'en',
    onChange: vi.fn(),
  };

  describe('Rendering', () => {
    it('renders the underlying LanguageSelector', () => {
      renderWithProviders(<LanguageToggle {...defaultProps} />);
      // LanguageSelector with pill variant renders a group with buttons
      expect(screen.getByRole('group')).toBeInTheDocument();
    });

    it('has data-testid="language-toggle" on wrapper', () => {
      renderWithProviders(<LanguageToggle {...defaultProps} />);
      expect(screen.getByTestId('language-toggle')).toBeInTheDocument();
    });
  });

  describe('Props passthrough', () => {
    it('passes value through to LanguageSelector', () => {
      renderWithProviders(<LanguageToggle value="el" onChange={vi.fn()} />);
      const group = screen.getByRole('group');
      const buttons = group.querySelectorAll('button');
      // First button (EL) should be aria-pressed true
      expect(buttons[0]).toHaveAttribute('aria-pressed', 'true');
    });

    it('calls onChange when language is selected', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      renderWithProviders(<LanguageToggle value="en" onChange={onChange} />);
      const group = screen.getByRole('group');
      const buttons = group.querySelectorAll('button');
      await user.click(buttons[0]); // click EL
      expect(onChange).toHaveBeenCalledWith('el');
    });
  });
});
