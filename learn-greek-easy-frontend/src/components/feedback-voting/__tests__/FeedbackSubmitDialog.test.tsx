/**
 * FeedbackSubmitDialog Component Tests
 *
 * Tests for the FeedbackSubmitDialog component verifying:
 * - Title <5 chars and description <20 chars are blocked (validation errors shown)
 * - Char counter shows destructive styling at 180/200 chars (title at WARN_THRESHOLD)
 * - Char counter shows normal styling at 179 chars (below WARN_THRESHOLD)
 * - Successful submit resets the form and closes the dialog
 * - Failed submit keeps the dialog open and does not reset the form
 */

import React from 'react';

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { FeedbackSubmitDialog } from '../FeedbackSubmitDialog';

// ── Toast mock ─────────────────────────────────────────────────────────────────
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// ── feedbackStore mock ─────────────────────────────────────────────────────────
const mockCreateFeedback = vi.fn();
vi.mock('@/stores/feedbackStore', () => ({
  useFeedbackStore: vi.fn(() => ({
    createFeedback: mockCreateFeedback,
    isSubmitting: false,
  })),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
};

function renderDialog(props: Partial<typeof defaultProps> = {}) {
  const merged = { ...defaultProps, ...props };
  return render(<FeedbackSubmitDialog {...merged} />);
}

// Fill required fields with valid values so we can focus on one field at a time
async function fillValidTitle(
  user: ReturnType<typeof userEvent.setup>,
  title = 'Valid title here'
) {
  const titleInput = screen.getByTestId('feedback-title-input');
  await user.clear(titleInput);
  await user.type(titleInput, title);
}

async function fillValidDescription(
  user: ReturnType<typeof userEvent.setup>,
  description = 'This is a valid description that meets the minimum length requirement.'
) {
  const descInput = screen.getByTestId('feedback-description-input');
  await user.clear(descInput);
  await user.type(descInput, description);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('FeedbackSubmitDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateFeedback.mockReset();
    defaultProps.onOpenChange.mockReset();
  });

  describe('Validation — blocked submissions', () => {
    it('blocks submit and shows error when title is shorter than 5 characters', async () => {
      const user = userEvent.setup();
      renderDialog();

      const titleInput = screen.getByTestId('feedback-title-input');
      const submitButton = screen.getByTestId('feedback-submit-button');

      await user.type(titleInput, 'Hi'); // 2 chars — below min 5
      await fillValidDescription(user);
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Title must be at least 5 characters')).toBeInTheDocument();
      });
      expect(mockCreateFeedback).not.toHaveBeenCalled();
    });

    it('blocks submit and shows error when description is shorter than 20 characters', async () => {
      const user = userEvent.setup();
      renderDialog();

      const descInput = screen.getByTestId('feedback-description-input');
      const submitButton = screen.getByTestId('feedback-submit-button');

      await fillValidTitle(user);
      await user.type(descInput, 'Too short'); // 9 chars — below min 20
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Description must be at least 20 characters')).toBeInTheDocument();
      });
      expect(mockCreateFeedback).not.toHaveBeenCalled();
    });

    it('blocks submit when both title and description are below minimums', async () => {
      const user = userEvent.setup();
      renderDialog();

      const titleInput = screen.getByTestId('feedback-title-input');
      const descInput = screen.getByTestId('feedback-description-input');
      const submitButton = screen.getByTestId('feedback-submit-button');

      await user.type(titleInput, 'Hi'); // too short
      await user.type(descInput, 'Short'); // too short
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Title must be at least 5 characters')).toBeInTheDocument();
        expect(screen.getByText('Description must be at least 20 characters')).toBeInTheDocument();
      });
      expect(mockCreateFeedback).not.toHaveBeenCalled();
    });
  });

  describe('Char counter — title field', () => {
    it('shows normal (non-destructive) counter at 179 chars (below warn threshold of 180)', () => {
      renderDialog();

      const titleInput = screen.getByTestId('feedback-title-input');
      fireEvent.change(titleInput, { target: { value: 'a'.repeat(179) } });

      // Counter should show "179 / 200"
      const counter = screen.getByText('179 / 200');
      expect(counter).toBeInTheDocument();
      // Should NOT have destructive styling (threshold is 180 = 200 * 0.9)
      expect(counter).not.toHaveClass('text-destructive');
    });

    it('shows destructive counter at 180 chars (exactly at warn threshold of 200 * 0.9)', () => {
      renderDialog();

      const titleInput = screen.getByTestId('feedback-title-input');
      fireEvent.change(titleInput, { target: { value: 'a'.repeat(180) } });

      // Counter should show "180 / 200"
      const counter = screen.getByText('180 / 200');
      expect(counter).toBeInTheDocument();
      // Should have destructive styling at threshold
      expect(counter).toHaveClass('text-destructive');
    });
  });

  describe('Char counter — description field', () => {
    it('shows normal counter at 1799 chars (below warn threshold of 1800)', () => {
      renderDialog();

      const descInput = screen.getByTestId('feedback-description-input');
      fireEvent.change(descInput, { target: { value: 'a'.repeat(1799) } });

      const counter = screen.getByText('1799 / 2000');
      expect(counter).toBeInTheDocument();
      expect(counter).not.toHaveClass('text-destructive');
    });

    it('shows destructive counter at 1800 chars (exactly at warn threshold of 2000 * 0.9)', () => {
      renderDialog();

      const descInput = screen.getByTestId('feedback-description-input');
      fireEvent.change(descInput, { target: { value: 'a'.repeat(1800) } });

      const counter = screen.getByText('1800 / 2000');
      expect(counter).toBeInTheDocument();
      expect(counter).toHaveClass('text-destructive');
    });
  });

  describe('Successful submit — resets form and closes dialog', () => {
    it('calls createFeedback with form data on valid submit', async () => {
      mockCreateFeedback.mockResolvedValue({ id: 'new-feedback' });
      const user = userEvent.setup();
      renderDialog();

      await fillValidTitle(user, 'My feature request');
      await fillValidDescription(user, 'Please add dark mode to the application settings.');

      const submitButton = screen.getByTestId('feedback-submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateFeedback).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'My feature request',
            description: 'Please add dark mode to the application settings.',
            category: 'feature_request',
          })
        );
      });
    });

    it('shows success toast after successful submit', async () => {
      mockCreateFeedback.mockResolvedValue({ id: 'new-feedback' });
      const user = userEvent.setup();
      renderDialog();

      await fillValidTitle(user, 'My feature request');
      await fillValidDescription(user, 'Please add dark mode to the application settings.');

      await user.click(screen.getByTestId('feedback-submit-button'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Feedback submitted',
          })
        );
      });
    });

    it('calls onOpenChange(false) to close the dialog after successful submit', async () => {
      mockCreateFeedback.mockResolvedValue({ id: 'new-feedback' });
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      renderDialog({ onOpenChange });

      await fillValidTitle(user, 'My feature request');
      await fillValidDescription(user, 'Please add dark mode to the application settings.');

      await user.click(screen.getByTestId('feedback-submit-button'));

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('resets the form fields after successful submit', async () => {
      mockCreateFeedback.mockResolvedValue({ id: 'new-feedback' });
      const user = userEvent.setup();
      renderDialog();

      await fillValidTitle(user, 'My feature request');
      await fillValidDescription(user, 'Please add dark mode to the application settings.');

      await user.click(screen.getByTestId('feedback-submit-button'));

      await waitFor(() => {
        expect(mockCreateFeedback).toHaveBeenCalled();
      });

      // After reset, title input should be empty
      const titleInput = screen.getByTestId('feedback-title-input') as HTMLInputElement;
      expect(titleInput.value).toBe('');
    });
  });

  describe('Failed submit — keeps dialog open', () => {
    it('does not call onOpenChange(false) when createFeedback throws', async () => {
      mockCreateFeedback.mockRejectedValue(new Error('Network error'));
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      renderDialog({ onOpenChange });

      await fillValidTitle(user, 'My feature request');
      await fillValidDescription(user, 'Please add dark mode to the application settings.');

      await user.click(screen.getByTestId('feedback-submit-button'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
          })
        );
      });

      // Dialog stays open — onOpenChange should NOT be called with false
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it('shows destructive error toast when createFeedback throws', async () => {
      mockCreateFeedback.mockRejectedValue(new Error('Server error'));
      const user = userEvent.setup();
      renderDialog();

      await fillValidTitle(user, 'My feature request');
      await fillValidDescription(user, 'Please add dark mode to the application settings.');

      await user.click(screen.getByTestId('feedback-submit-button'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: 'Failed to submit feedback. Please try again.',
            variant: 'destructive',
          })
        );
      });
    });

    it('preserves form field values when submit fails', async () => {
      mockCreateFeedback.mockRejectedValue(new Error('Server error'));
      const user = userEvent.setup();
      renderDialog();

      const validTitle = 'My feature request';
      const validDesc = 'Please add dark mode to the application settings.';

      await fillValidTitle(user, validTitle);
      await fillValidDescription(user, validDesc);

      await user.click(screen.getByTestId('feedback-submit-button'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
      });

      // Form fields should still have their values
      const titleInput = screen.getByTestId('feedback-title-input') as HTMLInputElement;
      expect(titleInput.value).toBe(validTitle);

      const descInput = screen.getByTestId('feedback-description-input') as HTMLTextAreaElement;
      expect(descInput.value).toBe(validDesc);
    });
  });

  describe('Cancel button', () => {
    it('calls onOpenChange(false) when cancel is clicked', async () => {
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      renderDialog({ onOpenChange });

      const cancelButton = screen.getByTestId('feedback-cancel-button');
      await user.click(cancelButton);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Dialog renders when open=true', () => {
    it('renders the form fields when open', () => {
      renderDialog();

      expect(screen.getByTestId('feedback-form')).toBeInTheDocument();
      expect(screen.getByTestId('feedback-title-input')).toBeInTheDocument();
      expect(screen.getByTestId('feedback-description-input')).toBeInTheDocument();
      expect(screen.getByTestId('feedback-submit-button')).toBeInTheDocument();
      expect(screen.getByTestId('feedback-cancel-button')).toBeInTheDocument();
    });

    it('shows initial char counters at 0', () => {
      renderDialog();

      expect(screen.getByText('0 / 200')).toBeInTheDocument();
      expect(screen.getByText('0 / 2000')).toBeInTheDocument();
    });
  });
});
