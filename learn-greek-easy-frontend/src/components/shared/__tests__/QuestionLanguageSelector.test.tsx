import { within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders, screen } from '@/lib/test-utils';

import { QuestionLanguageSelector } from '../QuestionLanguageSelector';

describe('QuestionLanguageSelector — pill variant', () => {
  const defaultProps = {
    value: 'en' as const,
    onChange: vi.fn(),
    variant: 'pill' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render three language buttons', () => {
      renderWithProviders(<QuestionLanguageSelector {...defaultProps} />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      expect(buttons).toHaveLength(3);
    });

    it('should render buttons in order: EL, EN, RU', () => {
      renderWithProviders(<QuestionLanguageSelector {...defaultProps} />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      expect(buttons[0]).toHaveTextContent('EL');
      expect(buttons[1]).toHaveTextContent('EN');
      expect(buttons[2]).toHaveTextContent('RU');
    });

    it('should show flag emojis when showFlags is true', () => {
      renderWithProviders(<QuestionLanguageSelector {...defaultProps} showFlags />);
      const group = screen.getByRole('group');
      expect(group).toHaveTextContent('🇬🇷');
      expect(group).toHaveTextContent('🇬🇧');
      expect(group).toHaveTextContent('🇷🇺');
    });

    it('should not show flag emojis by default', () => {
      renderWithProviders(<QuestionLanguageSelector {...defaultProps} />);
      const group = screen.getByRole('group');
      expect(group).not.toHaveTextContent('🇬🇷');
      expect(group).not.toHaveTextContent('🇬🇧');
      expect(group).not.toHaveTextContent('🇷🇺');
    });
  });

  describe('Selection State', () => {
    it('should mark the current language as aria-pressed', () => {
      renderWithProviders(<QuestionLanguageSelector {...defaultProps} value="en" />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      expect(buttons[1]).toHaveAttribute('aria-pressed', 'true');
      expect(buttons[0]).toHaveAttribute('aria-pressed', 'false');
      expect(buttons[2]).toHaveAttribute('aria-pressed', 'false');
    });

    it('should highlight Greek when value is el', () => {
      renderWithProviders(<QuestionLanguageSelector {...defaultProps} value="el" />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      expect(buttons[0]).toHaveAttribute('aria-pressed', 'true');
    });

    it('should highlight Russian when value is ru', () => {
      renderWithProviders(<QuestionLanguageSelector {...defaultProps} value="ru" />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      expect(buttons[2]).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('User Interactions', () => {
    it('should call onChange when clicking a different language', async () => {
      const user = userEvent.setup();
      renderWithProviders(<QuestionLanguageSelector {...defaultProps} value="en" />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      await user.click(buttons[0]);
      expect(defaultProps.onChange).toHaveBeenCalledWith('el');
    });

    it('should not call onChange when clicking the already-selected language', async () => {
      const user = userEvent.setup();
      renderWithProviders(<QuestionLanguageSelector {...defaultProps} value="en" />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      await user.click(buttons[1]);
      expect(defaultProps.onChange).not.toHaveBeenCalled();
    });

    it('should call onChange with ru when clicking Russian', async () => {
      const user = userEvent.setup();
      renderWithProviders(<QuestionLanguageSelector {...defaultProps} value="en" />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      await user.click(buttons[2]);
      expect(defaultProps.onChange).toHaveBeenCalledWith('ru');
    });
  });

  describe('Accessibility', () => {
    it('should have role group on container', () => {
      renderWithProviders(<QuestionLanguageSelector {...defaultProps} />);
      expect(screen.getByRole('group')).toBeInTheDocument();
    });

    it('should have aria-label on container', () => {
      renderWithProviders(<QuestionLanguageSelector {...defaultProps} />);
      const group = screen.getByRole('group');
      expect(group).toHaveAttribute('aria-label', 'Question Language');
    });

    it('should have aria-label on each button', () => {
      renderWithProviders(<QuestionLanguageSelector {...defaultProps} />);
      const group = screen.getByRole('group');
      const buttons = within(group).getAllByRole('button');
      expect(buttons[0]).toHaveAttribute('aria-label', 'Greek');
      expect(buttons[1]).toHaveAttribute('aria-label', 'English');
      expect(buttons[2]).toHaveAttribute('aria-label', 'Russian');
    });
  });

  describe('className Prop', () => {
    it('should merge custom className onto container', () => {
      renderWithProviders(
        <QuestionLanguageSelector {...defaultProps} className="my-custom-class" />
      );
      const group = screen.getByRole('group');
      expect(group.className).toContain('my-custom-class');
      expect(group.className).toContain('inline-flex');
    });
  });
});

describe('QuestionLanguageSelector — buttons variant (regression)', () => {
  const defaultProps = {
    value: 'en' as const,
    onChange: vi.fn(),
    variant: 'buttons' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render three buttons with language codes', () => {
    renderWithProviders(<QuestionLanguageSelector {...defaultProps} />);
    const group = screen.getByRole('group');
    const buttons = within(group).getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toHaveTextContent('EL');
    expect(buttons[1]).toHaveTextContent('EN');
    expect(buttons[2]).toHaveTextContent('RU');
  });

  it('should call onChange when clicking a different language', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<QuestionLanguageSelector {...defaultProps} onChange={onChange} />);
    const group = screen.getByRole('group');
    const buttons = within(group).getAllByRole('button');
    await user.click(buttons[0]);
    expect(onChange).toHaveBeenCalledWith('el');
  });

  it('should not call onChange when clicking same language', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<QuestionLanguageSelector {...defaultProps} onChange={onChange} />);
    const group = screen.getByRole('group');
    const buttons = within(group).getAllByRole('button');
    await user.click(buttons[1]);
    expect(onChange).not.toHaveBeenCalled();
  });
});
