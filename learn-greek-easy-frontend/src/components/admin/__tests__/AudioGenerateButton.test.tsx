/**
 * Tests for AudioGenerateButton component (WDET05-03)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';

import { AudioGenerateButton } from '../AudioGenerateButton';
import i18n from '@/i18n';

function renderButton(
  props: {
    status?: 'ready' | 'missing' | 'generating' | 'failed' | null;
    onClick?: () => void;
    isLoading?: boolean;
    testId?: string;
  } = {}
) {
  const { status = undefined, onClick = vi.fn(), isLoading = false, testId } = props;
  return render(
    <I18nextProvider i18n={i18n}>
      <AudioGenerateButton
        status={status}
        onClick={onClick}
        isLoading={isLoading}
        data-testid={testId}
      />
    </I18nextProvider>
  );
}

describe('AudioGenerateButton', () => {
  it('renders "Generate" when status is undefined', () => {
    renderButton({ status: undefined, testId: 'btn' });
    expect(screen.getByTestId('btn')).toHaveTextContent('Generate');
  });

  it('renders "Generate" when status is missing', () => {
    renderButton({ status: 'missing', testId: 'btn' });
    expect(screen.getByTestId('btn')).toHaveTextContent('Generate');
  });

  it('renders "Retry" when status is failed', () => {
    renderButton({ status: 'failed', testId: 'btn' });
    expect(screen.getByTestId('btn')).toHaveTextContent('Retry');
  });

  it('renders "Regenerate" when status is ready', () => {
    renderButton({ status: 'ready', testId: 'btn' });
    expect(screen.getByTestId('btn')).toHaveTextContent('Regenerate');
  });

  it('clicking calls onClick for ready status', () => {
    const onClick = vi.fn();
    renderButton({ status: 'ready', onClick, testId: 'btn' });
    fireEvent.click(screen.getByTestId('btn'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('button is not disabled when status is ready', () => {
    renderButton({ status: 'ready', testId: 'btn' });
    expect(screen.getByTestId('btn')).not.toBeDisabled();
  });

  it('renders disabled with spinner when status is generating', () => {
    renderButton({ status: 'generating', testId: 'btn' });
    const btn = screen.getByTestId('btn');
    expect(btn).toBeDisabled();
  });

  it('renders disabled with spinner when isLoading is true', () => {
    renderButton({ status: 'missing', isLoading: true, testId: 'btn' });
    const btn = screen.getByTestId('btn');
    expect(btn).toBeDisabled();
  });

  it('clicking calls onClick for missing status', () => {
    const onClick = vi.fn();
    renderButton({ status: 'missing', onClick, testId: 'btn' });
    fireEvent.click(screen.getByTestId('btn'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('clicking calls onClick for failed status', () => {
    const onClick = vi.fn();
    renderButton({ status: 'failed', onClick, testId: 'btn' });
    fireEvent.click(screen.getByTestId('btn'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not call onClick when generating (button is disabled)', () => {
    const onClick = vi.fn();
    renderButton({ status: 'generating', onClick, testId: 'btn' });
    fireEvent.click(screen.getByTestId('btn'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('data-testid passthrough works', () => {
    renderButton({ status: 'missing', testId: 'my-generate-btn' });
    expect(screen.getByTestId('my-generate-btn')).toBeInTheDocument();
  });
});
