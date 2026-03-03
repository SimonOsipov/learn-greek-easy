/**
 * GenerateNounDialog Component Tests
 *
 * Tests for the GenerateNounDialog component covering:
 * - Modal open/close states
 * - Greek input validation (valid, Latin, mixed, empty)
 * - Submit loading and success states
 * - State reset on close/reopen
 *
 * Related feature: [NGEN-08] Generate Noun Dialog
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GenerateNounDialog } from '../GenerateNounDialog';

// ============================================
// Test Utilities
// ============================================

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  deckId: 'deck-1',
  deckName: 'Animals & Nature',
};

const renderDialog = (overrides: Partial<typeof defaultProps> = {}) => {
  const props = { ...defaultProps, onOpenChange: vi.fn(), ...overrides };
  return { ...render(<GenerateNounDialog {...props} />), props };
};

// ============================================
// Tests
// ============================================

describe('GenerateNounDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 1. Renders modal when open
  it('renders modal when open', () => {
    renderDialog();

    expect(screen.getByTestId('generate-noun-dialog')).toBeInTheDocument();
    expect(screen.getByText('Generate Noun')).toBeInTheDocument();
    expect(screen.getByTestId('generate-noun-input')).toBeInTheDocument();
    expect(screen.getByTestId('generate-noun-submit')).toBeDisabled();
  });

  // 2. Does not render when closed
  it('does not render when closed', () => {
    renderDialog({ open: false });

    expect(screen.queryByTestId('generate-noun-dialog')).not.toBeInTheDocument();
  });

  // 3. Displays deck name
  it('displays deck name', () => {
    renderDialog();

    expect(screen.getByTestId('generate-noun-deck-name')).toHaveTextContent('Animals & Nature');
  });

  // 4. Greek input enables Create
  it('enables Create button when valid Greek is typed', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'σπίτι');

    expect(screen.getByTestId('generate-noun-submit')).not.toBeDisabled();
    expect(screen.queryByTestId('generate-noun-warning')).not.toBeInTheDocument();
  });

  // 5. Latin input shows warning
  it('shows warning and disables Create for Latin input', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'spiti');

    expect(screen.getByTestId('generate-noun-warning')).toBeInTheDocument();
    expect(screen.getByTestId('generate-noun-submit')).toBeDisabled();
  });

  // 6. Mixed input shows warning
  it('shows warning and disables Create for mixed Greek/Latin input', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'σπίτιtest');

    expect(screen.getByTestId('generate-noun-warning')).toBeInTheDocument();
    expect(screen.getByTestId('generate-noun-submit')).toBeDisabled();
  });

  // 7. Empty input disables Create without warning
  it('disables Create without showing warning when input is empty', () => {
    renderDialog();

    expect(screen.getByTestId('generate-noun-submit')).toBeDisabled();
    expect(screen.queryByTestId('generate-noun-warning')).not.toBeInTheDocument();
  });

  // 8. Submit shows loading spinner
  it('shows loading spinner after clicking Create', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'σπίτι');
    await user.click(screen.getByTestId('generate-noun-submit'));

    expect(screen.getByText('Creating...')).toBeInTheDocument();
    expect(screen.getByTestId('generate-noun-submit')).toBeDisabled();
  });

  // 9. Success state appears after 2s delay
  it('shows success state after 2 second delay', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'σπίτι');
    await user.click(screen.getByTestId('generate-noun-submit'));

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId('generate-noun-success')).toBeInTheDocument();
  });

  // 10. Success hides form
  it('hides form elements and shows Close button in success state', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'σπίτι');
    await user.click(screen.getByTestId('generate-noun-submit'));

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByTestId('generate-noun-input')).not.toBeInTheDocument();
    expect(screen.getByTestId('generate-noun-close')).toBeInTheDocument();
  });

  // 11. Close button works in success state
  it('calls onOpenChange(false) when Close is clicked in success state', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });

    await user.type(screen.getByTestId('generate-noun-input'), 'σπίτι');
    await user.click(screen.getByTestId('generate-noun-submit'));

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    await user.click(screen.getByTestId('generate-noun-close'));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // 12. Cancel closes modal
  it('calls onOpenChange(false) when Cancel is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });

    await user.click(screen.getByTestId('generate-noun-cancel'));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // 13. State resets on close and reopen
  it('resets state when modal is closed and reopened', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onOpenChange = vi.fn();
    const { rerender } = renderDialog({ onOpenChange });

    // Type something and submit to reach success state
    await user.type(screen.getByTestId('generate-noun-input'), 'σπίτι');
    await user.click(screen.getByTestId('generate-noun-submit'));

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId('generate-noun-success')).toBeInTheDocument();

    // Close the dialog
    rerender(
      <GenerateNounDialog
        open={false}
        onOpenChange={onOpenChange}
        deckId="deck-1"
        deckName="Animals & Nature"
      />
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Reopen the dialog
    rerender(
      <GenerateNounDialog
        open={true}
        onOpenChange={onOpenChange}
        deckId="deck-1"
        deckName="Animals & Nature"
      />
    );

    // Should show form state with empty input, no success
    expect(screen.getByTestId('generate-noun-input')).toHaveValue('');
    expect(screen.queryByTestId('generate-noun-success')).not.toBeInTheDocument();
  });
});
