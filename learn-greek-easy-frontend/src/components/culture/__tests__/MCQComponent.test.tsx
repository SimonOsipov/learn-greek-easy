/**
 * MCQComponent Tests
 *
 * Tests for the Multiple Choice Question component.
 * These tests verify:
 * - Question text rendering in selected language
 * - Option rendering and selection
 * - Submit button state management
 * - Keyboard shortcuts integration
 * - Image lazy loading
 * - Language fallback logic
 * - Accessibility features
 */

import React from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MCQComponent } from '../MCQComponent';
import { renderWithProviders } from '@/lib/test-utils';
import type { CultureQuestionResponse } from '@/types/culture';

// Mock question data
const mockQuestion: CultureQuestionResponse = {
  id: 'test-question-1',
  question_text: {
    el: 'Ποιο είναι το όνομα της πρωτεύουσας της Ελλάδας;',
    en: 'What is the name of the capital of Greece?',
    ru: 'Как называется столица Греции?',
  },
  options: [
    { el: 'Αθήνα', en: 'Athens', ru: 'Афины' },
    { el: 'Θεσσαλονίκη', en: 'Thessaloniki', ru: 'Салоники' },
    { el: 'Πάτρα', en: 'Patras', ru: 'Патры' },
    { el: 'Ηράκλειο', en: 'Heraklion', ru: 'Ираклион' },
  ],
  option_count: 4,
  image_url: null,
  order_index: 1,
};

const mockQuestionWithImage: CultureQuestionResponse = {
  ...mockQuestion,
  id: 'test-question-with-image',
  image_url: 'https://example.com/image.jpg',
};

const mockQuestionWithMissingTranslation: CultureQuestionResponse = {
  id: 'test-question-missing-translation',
  question_text: {
    el: '',
    en: 'What is the capital of Greece?',
    ru: '',
  },
  options: [
    { el: '', en: 'Athens', ru: '' },
    { el: '', en: 'Thessaloniki', ru: '' },
    { el: '', en: 'Patras', ru: '' },
    { el: '', en: 'Heraklion', ru: '' },
  ],
  option_count: 4,
  image_url: null,
  order_index: 1,
};

// Mock question data for variable option count tests
const mockQuestion2Options: CultureQuestionResponse = {
  id: 'test-question-2opt',
  question_text: {
    el: 'Αληθές ή Ψευδές;',
    en: 'True or False?',
    ru: 'Правда или ложь?',
  },
  options: [
    { el: 'Αληθές', en: 'True', ru: 'Правда' },
    { el: 'Ψευδές', en: 'False', ru: 'Ложь' },
  ],
  option_count: 2,
  image_url: null,
  order_index: 1,
};

const mockQuestion3Options: CultureQuestionResponse = {
  id: 'test-question-3opt',
  question_text: {
    el: 'Ποιο είναι;',
    en: 'Which one?',
    ru: 'Какой?',
  },
  options: [
    { el: 'Α', en: 'A', ru: 'А' },
    { el: 'Β', en: 'B', ru: 'Б' },
    { el: 'Γ', en: 'C', ru: 'В' },
  ],
  option_count: 3,
  image_url: null,
  order_index: 1,
};

describe('MCQComponent', () => {
  const mockOnAnswer = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render question text in English', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      expect(screen.getByText('What is the name of the capital of Greece?')).toBeInTheDocument();
    });

    it('should render question text in Greek', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="el" onAnswer={mockOnAnswer} />
      );

      expect(
        screen.getByText('Ποιο είναι το όνομα της πρωτεύουσας της Ελλάδας;')
      ).toBeInTheDocument();
    });

    it('should render question text in Russian', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="ru" onAnswer={mockOnAnswer} />
      );

      expect(screen.getByText('Как называется столица Греции?')).toBeInTheDocument();
    });

    it('should render all 4 options', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      expect(screen.getByTestId('answer-option-a')).toBeInTheDocument();
      expect(screen.getByTestId('answer-option-b')).toBeInTheDocument();
      expect(screen.getByTestId('answer-option-c')).toBeInTheDocument();
      expect(screen.getByTestId('answer-option-d')).toBeInTheDocument();
    });

    it('should render option text in correct language', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      expect(screen.getByText('Athens')).toBeInTheDocument();
      expect(screen.getByText('Thessaloniki')).toBeInTheDocument();
      expect(screen.getByText('Patras')).toBeInTheDocument();
      expect(screen.getByText('Heraklion')).toBeInTheDocument();
    });

    it('should render progress indicator when provided', () => {
      renderWithProviders(
        <MCQComponent
          question={mockQuestion}
          language="en"
          onAnswer={mockOnAnswer}
          questionNumber={3}
          totalQuestions={10}
        />
      );

      expect(screen.getByTestId('mcq-progress')).toBeInTheDocument();
      // The translation should include "3" and "10"
      expect(screen.getByTestId('mcq-progress').textContent).toContain('3');
      expect(screen.getByTestId('mcq-progress').textContent).toContain('10');
    });

    it('should not render progress indicator when not provided', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      expect(screen.queryByTestId('mcq-progress')).not.toBeInTheDocument();
    });
  });

  describe('Option Selection', () => {
    it('should highlight selected option on click', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      const optionA = screen.getByTestId('answer-option-a');
      await user.click(optionA);

      expect(optionA).toHaveAttribute('aria-pressed', 'true');
    });

    it('should switch selection when clicking different option', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      const optionA = screen.getByTestId('answer-option-a');
      const optionB = screen.getByTestId('answer-option-b');

      await user.click(optionA);
      expect(optionA).toHaveAttribute('aria-pressed', 'true');
      expect(optionB).toHaveAttribute('aria-pressed', 'false');

      await user.click(optionB);
      expect(optionA).toHaveAttribute('aria-pressed', 'false');
      expect(optionB).toHaveAttribute('aria-pressed', 'true');
    });

    it('should not allow selection when disabled', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <MCQComponent
          question={mockQuestion}
          language="en"
          onAnswer={mockOnAnswer}
          disabled={true}
        />
      );

      const optionA = screen.getByTestId('answer-option-a');
      await user.click(optionA);

      expect(optionA).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('Submit Button', () => {
    it('should be disabled initially', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      const submitButton = screen.getByTestId('mcq-submit-button');
      expect(submitButton).toBeDisabled();
    });

    it('should be enabled after selecting an option', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      const optionA = screen.getByTestId('answer-option-a');
      await user.click(optionA);

      const submitButton = screen.getByTestId('mcq-submit-button');
      expect(submitButton).not.toBeDisabled();
    });

    it('should call onAnswer with correct option number when submitted', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      // Select option C (index 2, so option number 3)
      const optionC = screen.getByTestId('answer-option-c');
      await user.click(optionC);

      const submitButton = screen.getByTestId('mcq-submit-button');
      await user.click(submitButton);

      expect(mockOnAnswer).toHaveBeenCalledWith(3);
    });

    it('should be disabled when component is disabled', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <MCQComponent
          question={mockQuestion}
          language="en"
          onAnswer={mockOnAnswer}
          disabled={true}
        />
      );

      const submitButton = screen.getByTestId('mcq-submit-button');
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should select option A when pressing 1', async () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      fireEvent.keyDown(window, { code: 'Digit1' });

      await waitFor(() => {
        const optionA = screen.getByTestId('answer-option-a');
        expect(optionA).toHaveAttribute('aria-pressed', 'true');
      });
    });

    it('should select option B when pressing 2', async () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      fireEvent.keyDown(window, { code: 'Digit2' });

      await waitFor(() => {
        const optionB = screen.getByTestId('answer-option-b');
        expect(optionB).toHaveAttribute('aria-pressed', 'true');
      });
    });

    it('should select option C when pressing 3', async () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      fireEvent.keyDown(window, { code: 'Digit3' });

      await waitFor(() => {
        const optionC = screen.getByTestId('answer-option-c');
        expect(optionC).toHaveAttribute('aria-pressed', 'true');
      });
    });

    it('should select option D when pressing 4', async () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      fireEvent.keyDown(window, { code: 'Digit4' });

      await waitFor(() => {
        const optionD = screen.getByTestId('answer-option-d');
        expect(optionD).toHaveAttribute('aria-pressed', 'true');
      });
    });

    it('should submit when pressing Enter after selecting an option', async () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      // Select option first
      fireEvent.keyDown(window, { code: 'Digit2' });

      // Then press Enter
      fireEvent.keyDown(window, { code: 'Enter' });

      await waitFor(() => {
        expect(mockOnAnswer).toHaveBeenCalledWith(2);
      });
    });

    it('should not submit when pressing Enter without selection', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      fireEvent.keyDown(window, { code: 'Enter' });

      expect(mockOnAnswer).not.toHaveBeenCalled();
    });
  });

  describe('Language Fallback', () => {
    it('should fallback to English when translation is missing', () => {
      renderWithProviders(
        <MCQComponent
          question={mockQuestionWithMissingTranslation}
          language="el"
          onAnswer={mockOnAnswer}
        />
      );

      // Should show English text since Greek is empty
      expect(screen.getByText('What is the capital of Greece?')).toBeInTheDocument();
      expect(screen.getByText('Athens')).toBeInTheDocument();
    });

    it('should fallback to English for Russian when translation is missing', () => {
      renderWithProviders(
        <MCQComponent
          question={mockQuestionWithMissingTranslation}
          language="ru"
          onAnswer={mockOnAnswer}
        />
      );

      // Should show English text since Russian is empty
      expect(screen.getByText('What is the capital of Greece?')).toBeInTheDocument();
    });
  });

  describe('Image Handling', () => {
    it('should render image with lazy loading when image_url is provided', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestionWithImage} language="en" onAnswer={mockOnAnswer} />
      );

      const image = screen.getByTestId('mcq-image');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('loading', 'lazy');
      expect(image).toHaveAttribute('src', 'https://example.com/image.jpg');
    });

    it('should not render image when image_url is null', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      expect(screen.queryByTestId('mcq-image')).not.toBeInTheDocument();
    });

    it('should hide image on error', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestionWithImage} language="en" onAnswer={mockOnAnswer} />
      );

      const image = screen.getByTestId('mcq-image');
      fireEvent.error(image);

      expect(image).toHaveStyle({ display: 'none' });
    });
  });

  describe('Accessibility', () => {
    it('should have proper role and aria-labelledby', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      const container = screen.getByTestId('mcq-component');
      expect(container).toHaveAttribute('role', 'group');
      expect(container).toHaveAttribute('aria-labelledby');
    });

    it('should have radiogroup role for options', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      const optionsContainer = screen.getByTestId('mcq-options');
      expect(optionsContainer).toHaveAttribute('role', 'radiogroup');
    });

    it('should render keyboard hint', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      const hint = screen.getByTestId('mcq-keyboard-hint');
      expect(hint).toBeInTheDocument();
    });

    it('should show select answer hint when no option selected', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      expect(screen.getByTestId('mcq-select-hint')).toBeInTheDocument();
    });

    it('should hide select answer hint when option is selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      const optionA = screen.getByTestId('answer-option-a');
      await user.click(optionA);

      expect(screen.queryByTestId('mcq-select-hint')).not.toBeInTheDocument();
    });
  });

  describe('Variable Option Count', () => {
    it('renders only 2 options for 2-option question', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion2Options} language="en" onAnswer={mockOnAnswer} />
      );

      // Should render 2 options (A and B)
      expect(screen.getByTestId('answer-option-a')).toBeInTheDocument();
      expect(screen.getByTestId('answer-option-b')).toBeInTheDocument();
      // Should NOT render options C and D
      expect(screen.queryByTestId('answer-option-c')).not.toBeInTheDocument();
      expect(screen.queryByTestId('answer-option-d')).not.toBeInTheDocument();
    });

    it('renders only 3 options for 3-option question', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion3Options} language="en" onAnswer={mockOnAnswer} />
      );

      // Should render 3 options (A, B, C)
      expect(screen.getByTestId('answer-option-a')).toBeInTheDocument();
      expect(screen.getByTestId('answer-option-b')).toBeInTheDocument();
      expect(screen.getByTestId('answer-option-c')).toBeInTheDocument();
      // Should NOT render option D
      expect(screen.queryByTestId('answer-option-d')).not.toBeInTheDocument();
    });

    it('renders all 4 options for 4-option question', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      // Should render all 4 options
      expect(screen.getByTestId('answer-option-a')).toBeInTheDocument();
      expect(screen.getByTestId('answer-option-b')).toBeInTheDocument();
      expect(screen.getByTestId('answer-option-c')).toBeInTheDocument();
      expect(screen.getByTestId('answer-option-d')).toBeInTheDocument();
    });

    it('displays dynamic keyboard hint with correct max for 2 options', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion2Options} language="en" onAnswer={mockOnAnswer} />
      );

      // Should show "Press 1-2" not "Press 1-4"
      expect(screen.getByText(/Press 1-2/)).toBeInTheDocument();
    });

    it('displays dynamic keyboard hint with correct max for 3 options', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion3Options} language="en" onAnswer={mockOnAnswer} />
      );

      // Should show "Press 1-3"
      expect(screen.getByText(/Press 1-3/)).toBeInTheDocument();
    });

    it('displays dynamic keyboard hint with correct max for 4 options', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      // Should show "Press 1-4"
      expect(screen.getByText(/Press 1-4/)).toBeInTheDocument();
    });

    it('renders correct option text for 2-option question', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion2Options} language="en" onAnswer={mockOnAnswer} />
      );

      expect(screen.getByText('True')).toBeInTheDocument();
      expect(screen.getByText('False')).toBeInTheDocument();
    });

    it('allows selection of options in 2-option question', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <MCQComponent question={mockQuestion2Options} language="en" onAnswer={mockOnAnswer} />
      );

      const optionB = screen.getByTestId('answer-option-b');
      await user.click(optionB);

      expect(optionB).toHaveAttribute('aria-pressed', 'true');
    });

    it('submits correct option number for 2-option question', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <MCQComponent question={mockQuestion2Options} language="en" onAnswer={mockOnAnswer} />
      );

      // Select option B (index 1, so option number 2)
      const optionB = screen.getByTestId('answer-option-b');
      await user.click(optionB);

      const submitButton = screen.getByTestId('mcq-submit-button');
      await user.click(submitButton);

      expect(mockOnAnswer).toHaveBeenCalledWith(2);
    });
  });
});
