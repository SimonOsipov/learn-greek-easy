import { within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders, screen } from '@/lib/test-utils';

import { LanguageSelector } from '../LanguageSelector';

vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>();
  return {
    ...actual,
    trackCultureLanguageChanged: vi.fn(),
  };
});

vi.mock('@/lib/logger', () => ({
  default: { warn: vi.fn() },
}));

import { trackCultureLanguageChanged } from '@/lib/analytics';

describe('LanguageSelector — pill variant', () => {
  const defaultProps = {
    value: 'en' as const,
    onChange: vi.fn(),
    variant: 'pill' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Rendering', () => {
    it('should render three language buttons', () => {
      renderWithProviders(<LanguageSelector {...defaultProps} />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      expect(buttons).toHaveLength(3);
    });

    it('should render buttons in order: EL, EN, RU', () => {
      renderWithProviders(<LanguageSelector {...defaultProps} />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      expect(buttons[0]).toHaveTextContent('EL');
      expect(buttons[1]).toHaveTextContent('EN');
      expect(buttons[2]).toHaveTextContent('RU');
    });

    it('should show flag emojis when showFlags is true', () => {
      renderWithProviders(<LanguageSelector {...defaultProps} showFlags />);
      const group = screen.getByRole('group');
      expect(group).toHaveTextContent('🇬🇷');
      expect(group).toHaveTextContent('🇬🇧');
      expect(group).toHaveTextContent('🇷🇺');
    });

    it('should not show flag emojis by default', () => {
      renderWithProviders(<LanguageSelector {...defaultProps} />);
      const group = screen.getByRole('group');
      expect(group).not.toHaveTextContent('🇬🇷');
      expect(group).not.toHaveTextContent('🇬🇧');
      expect(group).not.toHaveTextContent('🇷🇺');
    });

    it('should mark flag emojis as aria-hidden', () => {
      renderWithProviders(<LanguageSelector {...defaultProps} showFlags />);
      const group = screen.getByRole('group');
      const hiddenFlags = group.querySelectorAll('[aria-hidden="true"]');
      expect(hiddenFlags.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Selection State', () => {
    it('should apply selected styles to the current language', () => {
      renderWithProviders(<LanguageSelector {...defaultProps} value="en" />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      expect(buttons[1].className).toContain('bg-indigo-500');
      expect(buttons[1].className).toContain('text-white');
    });

    it('should apply unselected styles to non-current languages', () => {
      renderWithProviders(<LanguageSelector {...defaultProps} value="en" />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      expect(buttons[0].className).toContain('bg-transparent');
      expect(buttons[0].className).toContain('text-slate-500');
      expect(buttons[2].className).toContain('bg-transparent');
      expect(buttons[2].className).toContain('text-slate-500');
    });

    it('should highlight Greek when value is el', () => {
      renderWithProviders(<LanguageSelector {...defaultProps} value="el" />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      expect(buttons[0].className).toContain('bg-indigo-500');
      expect(buttons[1].className).toContain('bg-transparent');
      expect(buttons[2].className).toContain('bg-transparent');
    });

    it('should highlight Russian when value is ru', () => {
      renderWithProviders(<LanguageSelector {...defaultProps} value="ru" />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      expect(buttons[0].className).toContain('bg-transparent');
      expect(buttons[1].className).toContain('bg-transparent');
      expect(buttons[2].className).toContain('bg-indigo-500');
    });
  });

  describe('User Interactions', () => {
    it('should call onChange when clicking a different language', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LanguageSelector {...defaultProps} value="en" />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      await user.click(buttons[0]); // click EL
      expect(defaultProps.onChange).toHaveBeenCalledWith('el');
    });

    it('should not call onChange when clicking the already-selected language', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LanguageSelector {...defaultProps} value="en" />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      await user.click(buttons[1]); // click EN (already selected)
      expect(defaultProps.onChange).not.toHaveBeenCalled();
    });

    it('should call onChange with ru when clicking Russian', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LanguageSelector {...defaultProps} value="en" />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      await user.click(buttons[2]); // click RU
      expect(defaultProps.onChange).toHaveBeenCalledWith('ru');
    });
  });

  describe('Analytics', () => {
    it('should track language change', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LanguageSelector {...defaultProps} value="en" />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      await user.click(buttons[0]); // click EL
      expect(trackCultureLanguageChanged).toHaveBeenCalledWith('en', 'el');
    });

    it('should not track when clicking same language', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LanguageSelector {...defaultProps} value="en" />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      await user.click(buttons[1]); // click EN (same)
      expect(trackCultureLanguageChanged).not.toHaveBeenCalled();
    });
  });

  describe('localStorage', () => {
    it('should persist language change to localStorage', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LanguageSelector {...defaultProps} value="en" />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      await user.click(buttons[0]); // click EL
      expect(localStorage.getItem('culture_question_language')).toBe('el');
    });

    it('should not write to localStorage when clicking same language', async () => {
      const user = userEvent.setup();
      renderWithProviders(<LanguageSelector {...defaultProps} value="en" />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      await user.click(buttons[1]); // click EN (same)
      expect(localStorage.getItem('culture_question_language')).toBeNull();
    });
  });

  describe('Size Variants', () => {
    it('should apply text-xs for size sm', () => {
      renderWithProviders(<LanguageSelector {...defaultProps} size="sm" />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      buttons.forEach((btn) => {
        expect(btn.className).toContain('text-xs');
      });
    });

    it('should apply text-sm for default size', () => {
      renderWithProviders(<LanguageSelector {...defaultProps} />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      buttons.forEach((btn) => {
        expect(btn.className).toContain('text-sm');
      });
    });
  });

  describe('className Prop', () => {
    it('should merge custom className onto container', () => {
      renderWithProviders(<LanguageSelector {...defaultProps} className="my-custom-class" />);
      const group = screen.getByRole('group');
      expect(group.className).toContain('my-custom-class');
      expect(group.className).toContain('inline-flex');
    });
  });

  describe('Accessibility', () => {
    it('should have role group on container', () => {
      renderWithProviders(<LanguageSelector {...defaultProps} />);
      expect(screen.getByRole('group')).toBeInTheDocument();
    });

    it('should have aria-label on container', () => {
      renderWithProviders(<LanguageSelector {...defaultProps} />);
      const group = screen.getByRole('group');
      expect(group).toHaveAttribute('aria-label', 'Question Language');
    });

    it('should set aria-pressed true on selected button', () => {
      renderWithProviders(<LanguageSelector {...defaultProps} value="en" />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      expect(buttons[1]).toHaveAttribute('aria-pressed', 'true');
    });

    it('should set aria-pressed false on unselected buttons', () => {
      renderWithProviders(<LanguageSelector {...defaultProps} value="en" />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      expect(buttons[0]).toHaveAttribute('aria-pressed', 'false');
      expect(buttons[2]).toHaveAttribute('aria-pressed', 'false');
    });

    it('should have exactly one selected button at a time', () => {
      renderWithProviders(<LanguageSelector {...defaultProps} value="ru" />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      const pressedButtons = buttons.filter((btn) => btn.getAttribute('aria-pressed') === 'true');
      expect(pressedButtons).toHaveLength(1);
    });

    it('should have aria-label on each button', () => {
      renderWithProviders(<LanguageSelector {...defaultProps} />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      expect(buttons[0]).toHaveAttribute('aria-label', 'Greek');
      expect(buttons[1]).toHaveAttribute('aria-label', 'English');
      expect(buttons[2]).toHaveAttribute('aria-label', 'Russian');
    });

    it('should have type button on all buttons', () => {
      renderWithProviders(<LanguageSelector {...defaultProps} />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      buttons.forEach((btn) => {
        expect(btn).toHaveAttribute('type', 'button');
      });
    });
  });
});
