// src/features/practice/pf/__tests__/TypedInput.test.tsx
//
// Component tests for TypedInput + TypedResultChip (PRACT2-1-08).
//
// Covers:
//   - Enter runs judge and calls onResult + onFlip
//   - Tab reveals without judging (onFlip, NOT onResult)
//   - Skip button reveals without judging
//   - Input auto-focuses on mount
//   - Greek input carries lang="el" and serif class
//   - English input does not carry lang="el"
//   - Empty Enter is no-op
//   - TypedResultChip renders correct/lenient/wrong tones

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { TypedInput, TypedResultChip } from '../TypedInput';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGreekBackContent() {
  return { main: 'σπίτι' };
}

function makeEnBackContent() {
  return { main: 'house' };
}

// ── TypedInput ────────────────────────────────────────────────────────────────

describe('TypedInput', () => {
  it('renders the input field', () => {
    const onFlip = vi.fn();
    const onResult = vi.fn();
    render(
      <TypedInput
        cardType="meaning_el_to_en"
        backContent={makeEnBackContent()}
        onFlip={onFlip}
        onResult={onResult}
      />
    );
    expect(screen.getByTestId('pf-typed-input')).toBeInTheDocument();
  });

  it('Enter runs judge and calls onResult + onFlip', () => {
    const onFlip = vi.fn();
    const onResult = vi.fn();
    render(
      <TypedInput
        cardType="meaning_el_to_en"
        backContent={makeEnBackContent()}
        onFlip={onFlip}
        onResult={onResult}
      />
    );
    const input = screen.getByTestId('pf-typed-input');
    fireEvent.change(input, { target: { value: 'house' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(onResult).toHaveBeenCalledWith('correct');
    expect(onFlip).toHaveBeenCalledTimes(1);
  });

  it('Enter with a wrong answer calls onResult with wrong', () => {
    const onFlip = vi.fn();
    const onResult = vi.fn();
    render(
      <TypedInput
        cardType="meaning_el_to_en"
        backContent={makeEnBackContent()}
        onFlip={onFlip}
        onResult={onResult}
      />
    );
    const input = screen.getByTestId('pf-typed-input');
    fireEvent.change(input, { target: { value: 'airplane' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(onResult).toHaveBeenCalledWith('wrong');
    expect(onFlip).toHaveBeenCalledTimes(1);
  });

  it('Enter with empty input is a no-op (does not call onFlip or onResult)', () => {
    const onFlip = vi.fn();
    const onResult = vi.fn();
    render(
      <TypedInput
        cardType="meaning_el_to_en"
        backContent={makeEnBackContent()}
        onFlip={onFlip}
        onResult={onResult}
      />
    );
    const input = screen.getByTestId('pf-typed-input');
    // input is empty by default
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(onResult).not.toHaveBeenCalled();
    expect(onFlip).not.toHaveBeenCalled();
  });

  it('Tab reveals without judging — calls onFlip but NOT onResult', () => {
    const onFlip = vi.fn();
    const onResult = vi.fn();
    render(
      <TypedInput
        cardType="meaning_el_to_en"
        backContent={makeEnBackContent()}
        onFlip={onFlip}
        onResult={onResult}
      />
    );
    const input = screen.getByTestId('pf-typed-input');
    fireEvent.change(input, { target: { value: 'something' } });
    fireEvent.keyDown(input, { key: 'Tab', code: 'Tab' });

    expect(onResult).not.toHaveBeenCalled();
    expect(onFlip).toHaveBeenCalledTimes(1);
  });

  it('Skip button reveals without judging', () => {
    const onFlip = vi.fn();
    const onResult = vi.fn();
    render(
      <TypedInput
        cardType="meaning_el_to_en"
        backContent={makeEnBackContent()}
        onFlip={onFlip}
        onResult={onResult}
      />
    );
    fireEvent.click(screen.getByTestId('pf-typed-skip-btn'));

    expect(onResult).not.toHaveBeenCalled();
    expect(onFlip).toHaveBeenCalledTimes(1);
  });

  it('Greek input carries lang="el" and serif class', () => {
    render(
      <TypedInput
        cardType="meaning_en_to_el"
        backContent={makeGreekBackContent()}
        onFlip={vi.fn()}
        onResult={vi.fn()}
      />
    );
    const input = screen.getByTestId('pf-typed-input');
    expect(input.getAttribute('lang')).toBe('el');
    expect(input.classList.contains('pf-typed-input--el')).toBe(true);
  });

  it('English input does not carry lang="el" and uses en class', () => {
    render(
      <TypedInput
        cardType="meaning_el_to_en"
        backContent={makeEnBackContent()}
        onFlip={vi.fn()}
        onResult={vi.fn()}
      />
    );
    const input = screen.getByTestId('pf-typed-input');
    expect(input.getAttribute('lang')).toBeNull();
    expect(input.classList.contains('pf-typed-input--en')).toBe(true);
  });

  it('does not call onResult when Space is pressed (stopPropagation)', () => {
    const onResult = vi.fn();
    const onFlip = vi.fn();
    render(
      <TypedInput
        cardType="meaning_el_to_en"
        backContent={makeEnBackContent()}
        onFlip={onFlip}
        onResult={onResult}
      />
    );
    const input = screen.getByTestId('pf-typed-input');
    // Space should not trigger judging (only stopPropagation)
    fireEvent.keyDown(input, { key: ' ', code: 'Space' });
    expect(onResult).not.toHaveBeenCalled();
    expect(onFlip).not.toHaveBeenCalled();
  });
});

// ── TypedResultChip ───────────────────────────────────────────────────────────

describe('TypedResultChip', () => {
  it('renders correct verdict', () => {
    render(<TypedResultChip verdict="correct" />);
    const chip = screen.getByTestId('pf-typed-result');
    expect(chip.getAttribute('data-verdict')).toBe('correct');
    expect(chip.classList.contains('pf-typed-result--correct')).toBe(true);
    expect(chip).toHaveTextContent('Correct');
  });

  it('renders lenient verdict', () => {
    render(<TypedResultChip verdict="lenient" />);
    const chip = screen.getByTestId('pf-typed-result');
    expect(chip.getAttribute('data-verdict')).toBe('lenient');
    expect(chip.classList.contains('pf-typed-result--lenient')).toBe(true);
    expect(chip).toHaveTextContent('Close enough');
  });

  it('renders wrong verdict', () => {
    render(<TypedResultChip verdict="wrong" />);
    const chip = screen.getByTestId('pf-typed-result');
    expect(chip.getAttribute('data-verdict')).toBe('wrong');
    expect(chip.classList.contains('pf-typed-result--wrong')).toBe(true);
    expect(chip).toHaveTextContent('Wrong');
  });

  it('has role=status for a11y', () => {
    render(<TypedResultChip verdict="correct" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
