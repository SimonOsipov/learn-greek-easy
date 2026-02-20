/**
 * Tests for AudioStatusBadge component (WDET03)
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';

import { AudioStatusBadge } from '../AudioStatusBadge';
import i18n from '@/i18n';

function renderBadge(status: 'ready' | 'missing' | 'generating' | 'failed', testId?: string) {
  return render(
    <I18nextProvider i18n={i18n}>
      <AudioStatusBadge status={status} data-testid={testId} />
    </I18nextProvider>
  );
}

describe('AudioStatusBadge', () => {
  it('renders the ready state', () => {
    renderBadge('ready');
    expect(screen.getByTestId('audio-status-ready')).toBeInTheDocument();
  });

  it('renders the missing state', () => {
    renderBadge('missing');
    expect(screen.getByTestId('audio-status-missing')).toBeInTheDocument();
  });

  it('renders the generating state', () => {
    renderBadge('generating');
    expect(screen.getByTestId('audio-status-generating')).toBeInTheDocument();
  });

  it('renders the failed state', () => {
    renderBadge('failed');
    expect(screen.getByTestId('audio-status-failed')).toBeInTheDocument();
  });

  it('shows correct i18n text for ready', () => {
    renderBadge('ready');
    expect(screen.getByTestId('audio-status-ready')).toHaveTextContent('Ready');
  });

  it('shows correct i18n text for generating', () => {
    renderBadge('generating');
    expect(screen.getByTestId('audio-status-generating')).toHaveTextContent('Generating...');
  });

  it('passes data-testid to outer Badge element', () => {
    renderBadge('ready', 'my-badge');
    expect(screen.getByTestId('my-badge')).toBeInTheDocument();
  });

  it('inner span has data-testid matching audio-status-{status}', () => {
    renderBadge('failed', 'outer-badge');
    expect(screen.getByTestId('audio-status-failed')).toBeInTheDocument();
  });

  it('generating badge has motion-safe:animate-pulse class', () => {
    renderBadge('generating', 'generating-badge');
    expect(screen.getByTestId('generating-badge')).toHaveClass('motion-safe:animate-pulse');
  });
});
