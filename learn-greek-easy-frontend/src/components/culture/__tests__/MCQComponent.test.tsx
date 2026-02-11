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

// Mock SourceImage to test integration without implementation details
vi.mock('../SourceImage', () => ({
  SourceImage: ({
    imageUrl,
    sourceUrl,
    onSourceClick,
  }: {
    imageUrl: string;
    sourceUrl?: string;
    onSourceClick?: () => void;
  }) => (
    <div
      data-testid="source-image-container"
      data-image-url={imageUrl}
      data-source-url={sourceUrl || ''}
    >
      <img data-testid="source-image" src={imageUrl} alt="" loading="lazy" />
      {sourceUrl && (
        <a
          data-testid="source-image-link"
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onSourceClick}
        >
          Source
        </a>
      )}
    </div>
  ),
}));

vi.mock('../WaveformPlayer', () => ({
  WaveformPlayer: ({ className }: { className?: string }) => (
    <div data-testid="waveform-player" className={className}>
      Waveform Player Mock
    </div>
  ),
}));

vi.mock('../ExplanationCard', () => ({
  ExplanationCard: ({
    isCorrect,
    explanationText,
    correctAnswer,
    sourceArticleUrl,
    cardId,
    className,
  }: {
    isCorrect: boolean;
    explanationText?: string;
    correctAnswer?: { label: string; text: string };
    sourceArticleUrl?: string | null;
    cardId?: string;
    className?: string;
  }) => (
    <div
      data-testid="explanation-card"
      data-is-correct={isCorrect}
      data-explanation={explanationText || ''}
      data-correct-label={correctAnswer?.label || ''}
      data-correct-text={correctAnswer?.text || ''}
      data-source-url={sourceArticleUrl || ''}
      data-card-id={cardId || ''}
      className={className}
    >
      {isCorrect ? 'Correct!' : 'Incorrect'}
    </div>
  ),
}));

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
  original_article_url: null,
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
  original_article_url: null,
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
  original_article_url: null,
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
  original_article_url: null,
};

const mockQuestionWithSourceUrl: CultureQuestionResponse = {
  ...mockQuestion,
  id: 'test-question-with-source',
  original_article_url: 'https://example.com/news/article',
};

const mockQuestionWithInvalidSourceUrl: CultureQuestionResponse = {
  ...mockQuestion,
  id: 'test-question-invalid-source',
  original_article_url: 'javascript:alert("xss")',
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
    it('should render SourceImage when image_url is provided', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestionWithImage} language="en" onAnswer={mockOnAnswer} />
      );

      const container = screen.getByTestId('source-image-container');
      expect(container).toBeInTheDocument();
      expect(container).toHaveAttribute('data-image-url', 'https://example.com/image.jpg');
    });

    it('should not render SourceImage when image_url is null', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      expect(screen.queryByTestId('source-image-container')).not.toBeInTheDocument();
    });

    it('should pass sourceUrl to SourceImage when original_article_url is a valid http URL', () => {
      const questionWithBoth: CultureQuestionResponse = {
        ...mockQuestionWithImage,
        original_article_url: 'https://example.com/news/article',
      };
      renderWithProviders(
        <MCQComponent question={questionWithBoth} language="en" onAnswer={mockOnAnswer} />
      );

      const container = screen.getByTestId('source-image-container');
      expect(container).toHaveAttribute('data-source-url', 'https://example.com/news/article');
    });

    it('should not pass sourceUrl to SourceImage for non-http URLs', () => {
      const questionWithBadUrl: CultureQuestionResponse = {
        ...mockQuestionWithImage,
        original_article_url: 'javascript:alert("xss")',
      };
      renderWithProviders(
        <MCQComponent question={questionWithBadUrl} language="en" onAnswer={mockOnAnswer} />
      );

      const container = screen.getByTestId('source-image-container');
      expect(container).toHaveAttribute('data-source-url', '');
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

    it('should render keyboard hint with mono font and muted styling', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      const hint = screen.getByTestId('mcq-keyboard-hint');
      expect(hint).toBeInTheDocument();
      expect(hint).toHaveClass('font-mono', 'text-xs', 'text-slate-400', 'text-center');
    });

    it('should hide keyboard hint when answer is submitted', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <MCQComponent
          question={mockQuestion}
          language="en"
          onAnswer={mockOnAnswer}
          showFeedback={true}
          answerResult={{ isCorrect: true, correctOption: 1 }}
        />
      );

      // Keyboard hint should be visible initially
      expect(screen.getByTestId('mcq-keyboard-hint')).toBeInTheDocument();

      // Select option and submit
      const optionA = screen.getByTestId('answer-option-a');
      await user.click(optionA);

      const submitButton = screen.getByTestId('mcq-submit-button');
      await user.click(submitButton);

      // Keyboard hint should be hidden after submission
      expect(screen.queryByTestId('mcq-keyboard-hint')).not.toBeInTheDocument();
    });

    it('should show keyboard hint when showFeedback is not provided', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      expect(screen.getByTestId('mcq-keyboard-hint')).toBeInTheDocument();
    });

    it('should not render select answer helper text', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

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

  describe('Source Article Link', () => {
    it('should pass sourceUrl to SourceImage when original_article_url is provided', () => {
      const questionWithBoth: CultureQuestionResponse = {
        ...mockQuestionWithSourceUrl,
        image_url: 'https://example.com/image.jpg',
      };
      renderWithProviders(
        <MCQComponent question={questionWithBoth} language="en" onAnswer={mockOnAnswer} />
      );

      const link = screen.getByTestId('source-image-link');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://example.com/news/article');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should not render source link when original_article_url is null', () => {
      renderWithProviders(
        <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
      );

      expect(screen.queryByTestId('source-image-link')).not.toBeInTheDocument();
    });

    it('should not pass sourceUrl to SourceImage for non-http URLs', () => {
      const questionWithInvalidUrlAndImage: CultureQuestionResponse = {
        ...mockQuestionWithInvalidSourceUrl,
        image_url: 'https://example.com/image.jpg',
      };
      renderWithProviders(
        <MCQComponent
          question={questionWithInvalidUrlAndImage}
          language="en"
          onAnswer={mockOnAnswer}
        />
      );

      // SourceImage should be rendered (has image_url) but without source link
      expect(screen.getByTestId('source-image-container')).toBeInTheDocument();
      expect(screen.queryByTestId('source-image-link')).not.toBeInTheDocument();
    });
  });
});

describe('MCQComponent - Category Badge Integration', () => {
  const mockOnAnswer = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render badge row when category is provided', () => {
    renderWithProviders(
      <MCQComponent
        question={mockQuestion}
        language="en"
        onAnswer={mockOnAnswer}
        category="history"
      />
    );

    const badgeRow = screen.getByTestId('mcq-badge-row');
    expect(badgeRow).toBeInTheDocument();
  });

  it('should not render badge row when category is not provided', () => {
    renderWithProviders(
      <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
    );

    const badgeRow = screen.queryByTestId('mcq-badge-row');
    expect(badgeRow).not.toBeInTheDocument();
  });

  it('should render CultureBadge component when category is provided', () => {
    renderWithProviders(
      <MCQComponent
        question={mockQuestion}
        language="en"
        onAnswer={mockOnAnswer}
        category="politics"
      />
    );

    // Badge row should exist
    const badgeRow = screen.getByTestId('mcq-badge-row');
    expect(badgeRow).toBeInTheDocument();

    // Should be the first child in the inner content div (before progress)
    const component = screen.getByTestId('mcq-component');
    const cardShell = component.querySelector('[class*="rounded-"]');
    const innerContent = cardShell?.querySelector('[class*="flex flex-col"]');
    expect(innerContent?.firstChild).toBe(badgeRow);
  });
});

describe('MCQComponent - Audio Player', () => {
  const mockOnAnswer = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render WaveformPlayer when hasAudio is true', () => {
    renderWithProviders(
      <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} hasAudio={true} />
    );

    const waveformPlayer = screen.getByTestId('waveform-player');
    expect(waveformPlayer).toBeInTheDocument();
  });

  it('should not render WaveformPlayer when hasAudio is false', () => {
    renderWithProviders(
      <MCQComponent
        question={mockQuestion}
        language="en"
        onAnswer={mockOnAnswer}
        hasAudio={false}
      />
    );

    const waveformPlayer = screen.queryByTestId('waveform-player');
    expect(waveformPlayer).not.toBeInTheDocument();
  });

  it('should not render WaveformPlayer when hasAudio is not provided', () => {
    renderWithProviders(
      <MCQComponent question={mockQuestion} language="en" onAnswer={mockOnAnswer} />
    );

    const waveformPlayer = screen.queryByTestId('waveform-player');
    expect(waveformPlayer).not.toBeInTheDocument();
  });
});

describe('MCQComponent - ExplanationCard Integration', () => {
  const mockOnAnswer = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render ExplanationCard when showFeedback=true, isSubmitted=true, and answerResult provided', async () => {
    const user = userEvent.setup();
    const mockAnswerResult = {
      isCorrect: true,
      correctOption: 1,
      explanationText: 'Athens is the capital and largest city of Greece.',
    };

    renderWithProviders(
      <MCQComponent
        question={mockQuestion}
        language="en"
        onAnswer={mockOnAnswer}
        showFeedback={true}
        answerResult={mockAnswerResult}
      />
    );

    // Select option A
    const optionA = screen.getByTestId('answer-option-a');
    await user.click(optionA);

    // Submit the answer
    const submitButton = screen.getByTestId('mcq-submit-button');
    await user.click(submitButton);

    // Check that ExplanationCard is rendered
    const explanationCard = screen.getByTestId('explanation-card');
    expect(explanationCard).toBeInTheDocument();
    expect(explanationCard).toHaveAttribute('data-is-correct', 'true');
    expect(explanationCard).toHaveAttribute(
      'data-explanation',
      'Athens is the capital and largest city of Greece.'
    );
    expect(explanationCard).toHaveAttribute('data-correct-label', 'A');
    expect(explanationCard).toHaveAttribute('data-correct-text', 'Athens');
    expect(explanationCard).toHaveAttribute('data-card-id', 'test-question-1');
  });

  it('should NOT render ExplanationCard when showFeedback=false (mock exam mode)', async () => {
    const user = userEvent.setup();
    const mockAnswerResult = {
      isCorrect: true,
      correctOption: 1,
      explanationText: 'Test explanation',
    };

    renderWithProviders(
      <MCQComponent
        question={mockQuestion}
        language="en"
        onAnswer={mockOnAnswer}
        showFeedback={false}
        answerResult={mockAnswerResult}
      />
    );

    // Select option A
    const optionA = screen.getByTestId('answer-option-a');
    await user.click(optionA);

    // Submit the answer
    const submitButton = screen.getByTestId('mcq-submit-button');
    await user.click(submitButton);

    // ExplanationCard should NOT be rendered
    expect(screen.queryByTestId('explanation-card')).not.toBeInTheDocument();
  });

  it('should NOT render ExplanationCard before submission', async () => {
    const user = userEvent.setup();
    const mockAnswerResult = {
      isCorrect: true,
      correctOption: 1,
      explanationText: 'Test explanation',
    };

    renderWithProviders(
      <MCQComponent
        question={mockQuestion}
        language="en"
        onAnswer={mockOnAnswer}
        showFeedback={true}
        answerResult={mockAnswerResult}
      />
    );

    // Select option A but don't submit
    const optionA = screen.getByTestId('answer-option-a');
    await user.click(optionA);

    // ExplanationCard should NOT be rendered before submission
    expect(screen.queryByTestId('explanation-card')).not.toBeInTheDocument();
  });

  it('should NOT render ExplanationCard when answerResult is undefined', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MCQComponent
        question={mockQuestion}
        language="en"
        onAnswer={mockOnAnswer}
        showFeedback={true}
      />
    );

    // Select option A
    const optionA = screen.getByTestId('answer-option-a');
    await user.click(optionA);

    // Submit the answer
    const submitButton = screen.getByTestId('mcq-submit-button');
    await user.click(submitButton);

    // ExplanationCard should NOT be rendered without answerResult
    expect(screen.queryByTestId('explanation-card')).not.toBeInTheDocument();
  });

  it('should pass isCorrect=false when answer is incorrect', async () => {
    const user = userEvent.setup();
    const mockAnswerResult = {
      isCorrect: false,
      correctOption: 2,
      explanationText: 'The correct answer is Athens.',
    };

    renderWithProviders(
      <MCQComponent
        question={mockQuestion}
        language="en"
        onAnswer={mockOnAnswer}
        showFeedback={true}
        answerResult={mockAnswerResult}
      />
    );

    // Select option A (wrong answer)
    const optionA = screen.getByTestId('answer-option-a');
    await user.click(optionA);

    // Submit the answer
    const submitButton = screen.getByTestId('mcq-submit-button');
    await user.click(submitButton);

    // Check that ExplanationCard shows incorrect state
    const explanationCard = screen.getByTestId('explanation-card');
    expect(explanationCard).toBeInTheDocument();
    expect(explanationCard).toHaveAttribute('data-is-correct', 'false');
    expect(explanationCard).toHaveTextContent('Incorrect');
  });

  it('should derive correctAnswer label and text correctly', async () => {
    const user = userEvent.setup();
    const mockAnswerResult = {
      isCorrect: false,
      correctOption: 2, // Option B - Thessaloniki
      explanationText: 'Test explanation',
    };

    renderWithProviders(
      <MCQComponent
        question={mockQuestion}
        language="en"
        onAnswer={mockOnAnswer}
        showFeedback={true}
        answerResult={mockAnswerResult}
      />
    );

    // Select option A
    const optionA = screen.getByTestId('answer-option-a');
    await user.click(optionA);

    // Submit the answer
    const submitButton = screen.getByTestId('mcq-submit-button');
    await user.click(submitButton);

    // Check that correct answer shows "B" label and "Thessaloniki" text
    const explanationCard = screen.getByTestId('explanation-card');
    expect(explanationCard).toHaveAttribute('data-correct-label', 'B');
    expect(explanationCard).toHaveAttribute('data-correct-text', 'Thessaloniki');
  });

  it('should pass sourceArticleUrl from question when available', async () => {
    const user = userEvent.setup();
    const mockAnswerResult = {
      isCorrect: true,
      correctOption: 1,
      explanationText: 'Test explanation',
    };

    renderWithProviders(
      <MCQComponent
        question={mockQuestionWithSourceUrl}
        language="en"
        onAnswer={mockOnAnswer}
        showFeedback={true}
        answerResult={mockAnswerResult}
      />
    );

    // Select option A
    const optionA = screen.getByTestId('answer-option-a');
    await user.click(optionA);

    // Submit the answer
    const submitButton = screen.getByTestId('mcq-submit-button');
    await user.click(submitButton);

    // Check that sourceArticleUrl is passed
    const explanationCard = screen.getByTestId('explanation-card');
    expect(explanationCard).toHaveAttribute('data-source-url', 'https://example.com/news/article');
  });

  it('should have mt-3 margin class', async () => {
    const user = userEvent.setup();
    const mockAnswerResult = {
      isCorrect: true,
      correctOption: 1,
      explanationText: 'Test explanation',
    };

    renderWithProviders(
      <MCQComponent
        question={mockQuestion}
        language="en"
        onAnswer={mockOnAnswer}
        showFeedback={true}
        answerResult={mockAnswerResult}
      />
    );

    // Select option A
    const optionA = screen.getByTestId('answer-option-a');
    await user.click(optionA);

    // Submit the answer
    const submitButton = screen.getByTestId('mcq-submit-button');
    await user.click(submitButton);

    // Check that mt-3 class is applied
    const explanationCard = screen.getByTestId('explanation-card');
    expect(explanationCard).toHaveClass('mt-3');
  });
});
