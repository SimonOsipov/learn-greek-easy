/**
 * AnswerOption Component Tests
 *
 * Tests for the AnswerOption component, verifying:
 * - Rendering with correct data-testid for each letter
 * - Default, selected, correct, incorrect, and dimmed states
 * - State resolution logic (prop precedence)
 * - Keyboard hint badge visibility and content
 * - Result icons (check/cross) rendering
 * - Letter badge color transitions
 * - Accessibility attributes (aria-pressed, aria-label, aria-describedby)
 * - Click interactions and disabled state
 * - Visual classes (borders, backgrounds, shadows, opacity)
 */

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnswerOption } from '../AnswerOption';
import type { OptionLetter } from '../AnswerOption';

const defaultProps = {
  letter: 'A' as OptionLetter,
  text: 'Athens',
  isSelected: false,
  onClick: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AnswerOption', () => {
  describe('rendering', () => {
    it('should render button with correct data-testid for letter A', () => {
      render(<AnswerOption {...defaultProps} letter="A" />);

      const button = screen.getByTestId('answer-option-a');
      expect(button).toBeInTheDocument();
    });

    it('should render button with correct data-testid for letter B', () => {
      render(<AnswerOption {...defaultProps} letter="B" />);

      const button = screen.getByTestId('answer-option-b');
      expect(button).toBeInTheDocument();
    });

    it('should render button with correct data-testid for letter C', () => {
      render(<AnswerOption {...defaultProps} letter="C" />);

      const button = screen.getByTestId('answer-option-c');
      expect(button).toBeInTheDocument();
    });

    it('should render button with correct data-testid for letter D', () => {
      render(<AnswerOption {...defaultProps} letter="D" />);

      const button = screen.getByTestId('answer-option-d');
      expect(button).toBeInTheDocument();
    });

    it('should render letter badge with correct letter text', () => {
      render(<AnswerOption {...defaultProps} letter="B" />);

      const button = screen.getByTestId('answer-option-b');
      expect(button).toHaveTextContent('B');
    });

    it('should render option text with serif font class', () => {
      render(<AnswerOption {...defaultProps} text="Thessaloniki" />);

      const button = screen.getByTestId('answer-option-a');
      const textSpan = button.querySelector('.font-cult-serif');
      expect(textSpan).toBeInTheDocument();
      expect(textSpan).toHaveTextContent('Thessaloniki');
    });

    it('should have button type="button"', () => {
      render(<AnswerOption {...defaultProps} />);

      const button = screen.getByTestId('answer-option-a');
      expect(button).toHaveAttribute('type', 'button');
    });
  });

  describe('default state', () => {
    it('should apply default border and background classes', () => {
      render(<AnswerOption {...defaultProps} />);

      const button = screen.getByTestId('answer-option-a');
      expect(button.className).toContain('border-[var(--cult-border)]');
      expect(button.className).toContain('bg-[var(--cult-card)]');
    });

    it('should have hover classes when in default state', () => {
      render(<AnswerOption {...defaultProps} />);

      const button = screen.getByTestId('answer-option-a');
      expect(button.className).toContain('hover:border-slate-300');
      expect(button.className).toContain('hover:bg-slate-50/60');
    });

    it('should show keyboard hint when showKeyboardHint=true and keyboardHintNumber provided', () => {
      render(<AnswerOption {...defaultProps} showKeyboardHint={true} keyboardHintNumber={1} />);

      const hint = screen.getByTestId('keyboard-hint-a');
      expect(hint).toBeInTheDocument();
      expect(hint).toHaveTextContent('1');
    });

    it('should hide keyboard hint when showKeyboardHint=false', () => {
      render(<AnswerOption {...defaultProps} showKeyboardHint={false} keyboardHintNumber={1} />);

      const hint = screen.queryByTestId('keyboard-hint-a');
      expect(hint).not.toBeInTheDocument();
    });

    it('should hide keyboard hint when keyboardHintNumber is undefined', () => {
      render(<AnswerOption {...defaultProps} showKeyboardHint={true} />);

      const hint = screen.queryByTestId('keyboard-hint-a');
      expect(hint).not.toBeInTheDocument();
    });

    it('should display correct keyboard hint number', () => {
      render(<AnswerOption {...defaultProps} keyboardHintNumber={3} />);

      const hint = screen.getByTestId('keyboard-hint-a');
      expect(hint).toHaveTextContent('3');
    });

    it('should have keyboard hint with aria-hidden="true"', () => {
      render(<AnswerOption {...defaultProps} keyboardHintNumber={1} />);

      const hint = screen.getByTestId('keyboard-hint-a');
      expect(hint).toHaveAttribute('aria-hidden', 'true');
    });

    it('should have keyboard hint with font-mono class', () => {
      render(<AnswerOption {...defaultProps} keyboardHintNumber={1} />);

      const hint = screen.getByTestId('keyboard-hint-a');
      expect(hint).toHaveClass('font-mono');
    });
  });

  describe('selected state', () => {
    it('should apply accent border and background via state prop', () => {
      render(<AnswerOption {...defaultProps} state="selected" />);

      const button = screen.getByTestId('answer-option-a');
      expect(button.className).toContain('border-[var(--cult-accent)]');
      expect(button.className).toContain('bg-[var(--cult-accent-soft)]');
      expect(button.className).toContain('shadow-[0_0_0_3px_var(--cult-accent-glow)]');
    });

    it('should apply accent border via isSelected boolean fallback', () => {
      render(<AnswerOption {...defaultProps} isSelected={true} />);

      const button = screen.getByTestId('answer-option-a');
      expect(button.className).toContain('border-[var(--cult-accent)]');
      expect(button.className).toContain('bg-[var(--cult-accent-soft)]');
    });

    it('should not show keyboard hint', () => {
      render(<AnswerOption {...defaultProps} isSelected={true} keyboardHintNumber={1} />);

      const hint = screen.queryByTestId('keyboard-hint-a');
      expect(hint).not.toBeInTheDocument();
    });

    it('should not show result icons', () => {
      render(<AnswerOption {...defaultProps} isSelected={true} />);

      const checkIcon = screen.queryByTestId('result-icon-correct');
      const crossIcon = screen.queryByTestId('result-icon-incorrect');
      expect(checkIcon).not.toBeInTheDocument();
      expect(crossIcon).not.toBeInTheDocument();
    });

    it('should have aria-pressed="true"', () => {
      render(<AnswerOption {...defaultProps} isSelected={true} />);

      const button = screen.getByTestId('answer-option-a');
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('correct state', () => {
    it('should apply correct border and background classes', () => {
      render(<AnswerOption {...defaultProps} submitted={true} isCorrect={true} />);

      const button = screen.getByTestId('answer-option-a');
      expect(button.className).toContain('border-[var(--cult-correct)]');
      expect(button.className).toContain('bg-[var(--cult-correct-soft)]');
      expect(button.className).toContain('shadow-[0_0_0_3px_var(--cult-correct-glow)]');
    });

    it('should show checkmark icon with data-testid result-icon-correct', () => {
      render(<AnswerOption {...defaultProps} submitted={true} isCorrect={true} />);

      const checkIcon = screen.getByTestId('result-icon-correct');
      expect(checkIcon).toBeInTheDocument();
    });

    it('should have checkmark with animate-cult-pop-in class', () => {
      render(<AnswerOption {...defaultProps} submitted={true} isCorrect={true} />);

      const checkIcon = screen.getByTestId('result-icon-correct');
      expect(checkIcon).toHaveClass('animate-cult-pop-in');
    });

    it('should have letter badge with bg-emerald-500', () => {
      render(<AnswerOption {...defaultProps} submitted={true} isCorrect={true} />);

      const button = screen.getByTestId('answer-option-a');
      const badge = button.querySelector('span');
      expect(badge).toHaveClass('bg-emerald-500');
    });

    it('should not show keyboard hint', () => {
      render(
        <AnswerOption {...defaultProps} submitted={true} isCorrect={true} keyboardHintNumber={1} />
      );

      const hint = screen.queryByTestId('keyboard-hint-a');
      expect(hint).not.toBeInTheDocument();
    });

    it('should have aria-pressed="false" when not selected', () => {
      render(<AnswerOption {...defaultProps} submitted={true} isCorrect={true} />);

      const button = screen.getByTestId('answer-option-a');
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('incorrect state', () => {
    it('should apply incorrect border and background classes', () => {
      render(<AnswerOption {...defaultProps} submitted={true} isSelectedIncorrect={true} />);

      const button = screen.getByTestId('answer-option-a');
      expect(button.className).toContain('border-[var(--cult-incorrect)]');
      expect(button.className).toContain('bg-[var(--cult-incorrect-soft)]');
      expect(button.className).toContain('shadow-[0_0_0_3px_var(--cult-incorrect-glow)]');
    });

    it('should show cross icon with data-testid result-icon-incorrect', () => {
      render(<AnswerOption {...defaultProps} submitted={true} isSelectedIncorrect={true} />);

      const crossIcon = screen.getByTestId('result-icon-incorrect');
      expect(crossIcon).toBeInTheDocument();
    });

    it('should have cross icon with animate-cult-pop-in class', () => {
      render(<AnswerOption {...defaultProps} submitted={true} isSelectedIncorrect={true} />);

      const crossIcon = screen.getByTestId('result-icon-incorrect');
      expect(crossIcon).toHaveClass('animate-cult-pop-in');
    });

    it('should have letter badge with bg-red-500', () => {
      render(<AnswerOption {...defaultProps} submitted={true} isSelectedIncorrect={true} />);

      const button = screen.getByTestId('answer-option-a');
      const badge = button.querySelector('span');
      expect(badge).toHaveClass('bg-red-500');
    });

    it('should not show keyboard hint', () => {
      render(
        <AnswerOption
          {...defaultProps}
          submitted={true}
          isSelectedIncorrect={true}
          keyboardHintNumber={1}
        />
      );

      const hint = screen.queryByTestId('keyboard-hint-a');
      expect(hint).not.toBeInTheDocument();
    });
  });

  describe('dimmed state', () => {
    it('should apply opacity-[0.35] class', () => {
      render(<AnswerOption {...defaultProps} submitted={true} />);

      const button = screen.getByTestId('answer-option-a');
      expect(button.className).toContain('opacity-[0.35]');
    });

    it('should not show result icons', () => {
      render(<AnswerOption {...defaultProps} submitted={true} />);

      const checkIcon = screen.queryByTestId('result-icon-correct');
      const crossIcon = screen.queryByTestId('result-icon-incorrect');
      expect(checkIcon).not.toBeInTheDocument();
      expect(crossIcon).not.toBeInTheDocument();
    });

    it('should not show keyboard hint', () => {
      render(<AnswerOption {...defaultProps} submitted={true} keyboardHintNumber={1} />);

      const hint = screen.queryByTestId('keyboard-hint-a');
      expect(hint).not.toBeInTheDocument();
    });

    it('should have letter badge with bg-muted', () => {
      render(<AnswerOption {...defaultProps} submitted={true} />);

      const button = screen.getByTestId('answer-option-a');
      const badge = button.querySelector('span');
      expect(badge).toHaveClass('bg-muted');
    });
  });

  describe('disabled state', () => {
    it('should apply pointer-events-none class', () => {
      render(<AnswerOption {...defaultProps} disabled={true} />);

      const button = screen.getByTestId('answer-option-a');
      expect(button).toHaveClass('pointer-events-none');
    });

    it('should have button disabled attribute', () => {
      render(<AnswerOption {...defaultProps} disabled={true} />);

      const button = screen.getByTestId('answer-option-a');
      expect(button).toBeDisabled();
    });

    it('should not call onClick when clicked while disabled', () => {
      const onClick = vi.fn();
      render(<AnswerOption {...defaultProps} onClick={onClick} disabled={true} />);

      const button = screen.getByTestId('answer-option-a');
      fireEvent.click(button);

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('state resolution', () => {
    it('should use state prop when provided (takes precedence)', () => {
      render(<AnswerOption {...defaultProps} state="correct" isSelected={true} submitted={true} />);

      const button = screen.getByTestId('answer-option-a');
      expect(button.className).toContain('border-[var(--cult-correct)]');
    });

    it('should resolve to correct when submitted + isCorrect', () => {
      render(<AnswerOption {...defaultProps} submitted={true} isCorrect={true} />);

      const button = screen.getByTestId('answer-option-a');
      expect(button.className).toContain('border-[var(--cult-correct)]');
      expect(screen.getByTestId('result-icon-correct')).toBeInTheDocument();
    });

    it('should resolve to incorrect when submitted + isSelectedIncorrect', () => {
      render(<AnswerOption {...defaultProps} submitted={true} isSelectedIncorrect={true} />);

      const button = screen.getByTestId('answer-option-a');
      expect(button.className).toContain('border-[var(--cult-incorrect)]');
      expect(screen.getByTestId('result-icon-incorrect')).toBeInTheDocument();
    });

    it('should resolve to dimmed when submitted without correct/incorrect', () => {
      render(<AnswerOption {...defaultProps} submitted={true} />);

      const button = screen.getByTestId('answer-option-a');
      expect(button.className).toContain('opacity-[0.35]');
    });

    it('should resolve to selected when isSelected without submitted', () => {
      render(<AnswerOption {...defaultProps} isSelected={true} />);

      const button = screen.getByTestId('answer-option-a');
      expect(button.className).toContain('border-[var(--cult-accent)]');
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('should resolve to default when no state props provided', () => {
      render(<AnswerOption {...defaultProps} />);

      const button = screen.getByTestId('answer-option-a');
      expect(button.className).toContain('border-[var(--cult-border)]');
      expect(button.className).toContain('bg-[var(--cult-card)]');
    });
  });

  describe('accessibility', () => {
    it('should have aria-pressed="true" only for selected state', () => {
      render(<AnswerOption {...defaultProps} state="selected" />);

      const button = screen.getByTestId('answer-option-a');
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('should have aria-pressed="false" for default state', () => {
      render(<AnswerOption {...defaultProps} state="default" />);

      const button = screen.getByTestId('answer-option-a');
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('should have aria-pressed="false" for correct state', () => {
      render(<AnswerOption {...defaultProps} state="correct" />);

      const button = screen.getByTestId('answer-option-a');
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('should have aria-pressed="false" for incorrect state', () => {
      render(<AnswerOption {...defaultProps} state="incorrect" />);

      const button = screen.getByTestId('answer-option-a');
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('should have aria-pressed="false" for dimmed state', () => {
      render(<AnswerOption {...defaultProps} state="dimmed" />);

      const button = screen.getByTestId('answer-option-a');
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('should have correct aria-label for correct state', () => {
      render(<AnswerOption {...defaultProps} text="Sparta" state="correct" />);

      const button = screen.getByTestId('answer-option-a');
      expect(button).toHaveAttribute('aria-label', 'Correct answer: Sparta');
    });

    it('should have correct aria-label for incorrect state', () => {
      render(<AnswerOption {...defaultProps} text="Sparta" state="incorrect" />);

      const button = screen.getByTestId('answer-option-a');
      expect(button).toHaveAttribute('aria-label', 'Your answer (incorrect): Sparta');
    });

    it('should not have aria-label in default state', () => {
      render(<AnswerOption {...defaultProps} state="default" />);

      const button = screen.getByTestId('answer-option-a');
      expect(button).not.toHaveAttribute('aria-label');
    });

    it('should pass through aria-describedby when provided', () => {
      render(<AnswerOption {...defaultProps} aria-describedby="question-text" />);

      const button = screen.getByTestId('answer-option-a');
      expect(button).toHaveAttribute('aria-describedby', 'question-text');
    });

    it('should not have aria-describedby when not provided', () => {
      render(<AnswerOption {...defaultProps} />);

      const button = screen.getByTestId('answer-option-a');
      expect(button).not.toHaveAttribute('aria-describedby');
    });

    it('should have focus-visible classes', () => {
      render(<AnswerOption {...defaultProps} />);

      const button = screen.getByTestId('answer-option-a');
      expect(button).toHaveClass('focus-visible:outline-none');
      expect(button).toHaveClass('focus-visible:ring-2');
    });
  });

  describe('letter badge', () => {
    it('should render correct letter A', () => {
      render(<AnswerOption {...defaultProps} letter="A" />);

      const button = screen.getByTestId('answer-option-a');
      const badge = button.querySelector('span');
      expect(badge).toHaveTextContent('A');
    });

    it('should render correct letter B', () => {
      render(<AnswerOption {...defaultProps} letter="B" />);

      const button = screen.getByTestId('answer-option-b');
      const badge = button.querySelector('span');
      expect(badge).toHaveTextContent('B');
    });

    it('should render correct letter C', () => {
      render(<AnswerOption {...defaultProps} letter="C" />);

      const button = screen.getByTestId('answer-option-c');
      const badge = button.querySelector('span');
      expect(badge).toHaveTextContent('C');
    });

    it('should render correct letter D', () => {
      render(<AnswerOption {...defaultProps} letter="D" />);

      const button = screen.getByTestId('answer-option-d');
      const badge = button.querySelector('span');
      expect(badge).toHaveTextContent('D');
    });

    it('should have bg-muted text-muted-foreground in default state', () => {
      render(<AnswerOption {...defaultProps} state="default" />);

      const button = screen.getByTestId('answer-option-a');
      const badge = button.querySelector('span');
      expect(badge).toHaveClass('bg-muted');
      expect(badge).toHaveClass('text-muted-foreground');
    });

    it('should have bg-indigo-500 text-white in selected state', () => {
      render(<AnswerOption {...defaultProps} state="selected" />);

      const button = screen.getByTestId('answer-option-a');
      const badge = button.querySelector('span');
      expect(badge).toHaveClass('bg-indigo-500');
      expect(badge).toHaveClass('text-white');
    });

    it('should have bg-emerald-500 text-white in correct state', () => {
      render(<AnswerOption {...defaultProps} state="correct" />);

      const button = screen.getByTestId('answer-option-a');
      const badge = button.querySelector('span');
      expect(badge).toHaveClass('bg-emerald-500');
      expect(badge).toHaveClass('text-white');
    });

    it('should have bg-red-500 text-white in incorrect state', () => {
      render(<AnswerOption {...defaultProps} state="incorrect" />);

      const button = screen.getByTestId('answer-option-a');
      const badge = button.querySelector('span');
      expect(badge).toHaveClass('bg-red-500');
      expect(badge).toHaveClass('text-white');
    });

    it('should have bg-muted in dimmed state', () => {
      render(<AnswerOption {...defaultProps} state="dimmed" />);

      const button = screen.getByTestId('answer-option-a');
      const badge = button.querySelector('span');
      expect(badge).toHaveClass('bg-muted');
    });

    it('should have rounded-lg', () => {
      render(<AnswerOption {...defaultProps} />);

      const button = screen.getByTestId('answer-option-a');
      const badge = button.querySelector('span');
      expect(badge).toHaveClass('rounded-lg');
    });

    it('should have transition-colors duration-200', () => {
      render(<AnswerOption {...defaultProps} />);

      const button = screen.getByTestId('answer-option-a');
      const badge = button.querySelector('span');
      expect(badge).toHaveClass('transition-colors');
      expect(badge).toHaveClass('duration-200');
    });
  });

  describe('interactions', () => {
    it('should call onClick when clicked', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<AnswerOption {...defaultProps} onClick={onClick} />);

      const button = screen.getByTestId('answer-option-a');
      await user.click(button);

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when disabled', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<AnswerOption {...defaultProps} onClick={onClick} disabled={true} />);

      const button = screen.getByTestId('answer-option-a');
      await user.click(button);

      expect(onClick).not.toHaveBeenCalled();
    });
  });
});
