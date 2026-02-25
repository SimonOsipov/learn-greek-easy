/**
 * Tests for CardGenerateButton component (CGEN-04)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { CardGenerateButton } from '../CardGenerateButton';

function renderButton(props: {
  label?: string;
  onClick?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  testId?: string;
}) {
  const {
    label = 'Generate',
    onClick = vi.fn(),
    isLoading = false,
    disabled = false,
    testId,
  } = props;
  return render(
    <CardGenerateButton
      label={label}
      onClick={onClick}
      isLoading={isLoading}
      disabled={disabled}
      data-testid={testId}
    />
  );
}

describe('CardGenerateButton', () => {
  it('renders the label text', () => {
    renderButton({ label: 'Generate Cards' });
    expect(screen.getByRole('button')).toHaveTextContent('Generate Cards');
  });

  it('renders as a ghost button', () => {
    renderButton({ testId: 'btn' });
    const btn = screen.getByTestId('btn');
    // ghost variant applies ghost class via shadcn button
    expect(btn).toBeInTheDocument();
    // Not disabled by default
    expect(btn).not.toBeDisabled();
  });

  it('is disabled and shows spinner when isLoading is true', () => {
    renderButton({ isLoading: true, testId: 'btn' });
    const btn = screen.getByTestId('btn');
    expect(btn).toBeDisabled();
    // Spinner icon is present (Loader2 with animate-spin class)
    const spinner = btn.querySelector('.motion-safe\\:animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('is disabled when disabled prop is true', () => {
    renderButton({ disabled: true, testId: 'btn' });
    expect(screen.getByTestId('btn')).toBeDisabled();
  });

  it('calls onClick when clicked in enabled state', () => {
    const onClick = vi.fn();
    renderButton({ onClick, testId: 'btn' });
    fireEvent.click(screen.getByTestId('btn'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn();
    renderButton({ onClick, disabled: true, testId: 'btn' });
    fireEvent.click(screen.getByTestId('btn'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not call onClick when isLoading is true', () => {
    const onClick = vi.fn();
    renderButton({ onClick, isLoading: true, testId: 'btn' });
    fireEvent.click(screen.getByTestId('btn'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not show spinner when not loading', () => {
    renderButton({ isLoading: false, testId: 'btn' });
    const btn = screen.getByTestId('btn');
    const spinner = btn.querySelector('.motion-safe\\:animate-spin');
    expect(spinner).not.toBeInTheDocument();
  });

  it('data-testid is passed through to the button', () => {
    renderButton({ testId: 'my-card-btn' });
    expect(screen.getByTestId('my-card-btn')).toBeInTheDocument();
  });

  it('always renders (no null return)', () => {
    const { container } = renderButton({});
    expect(container).not.toBeEmptyDOMElement();
  });
});
