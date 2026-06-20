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

  // ── ADMIN2-39-01 QA edge coverage: tone→class mapping (AC#3 pixel-identity / AC#4) ──
  // The component now routes through <Badge tone>. These assert the SAME `.badge b-*`
  // classes the old hardcoded STATUS_CLASS map produced, so a future mis-mapping
  // (e.g. ready→red) is caught instead of silently passing the testid-only tests above.
  it('ready badge renders .badge b-green (was badge b-green)', () => {
    renderBadge('ready', 'ready-badge');
    const badge = screen.getByTestId('ready-badge');
    expect(badge).toHaveClass('badge');
    expect(badge).toHaveClass('b-green');
    expect(badge).not.toHaveClass('b-red');
    expect(badge).not.toHaveClass('b-amber');
  });

  it('missing badge renders .badge b-red (was badge b-red)', () => {
    renderBadge('missing', 'missing-badge');
    const badge = screen.getByTestId('missing-badge');
    expect(badge).toHaveClass('badge');
    expect(badge).toHaveClass('b-red');
    expect(badge).not.toHaveClass('b-green');
  });

  it('failed badge renders .badge b-red (was badge b-red)', () => {
    renderBadge('failed', 'failed-badge');
    const badge = screen.getByTestId('failed-badge');
    expect(badge).toHaveClass('badge');
    expect(badge).toHaveClass('b-red');
    expect(badge).not.toHaveClass('b-green');
  });

  it('generating badge renders .badge b-amber (was badge b-amber motion-safe:animate-pulse)', () => {
    renderBadge('generating', 'generating-badge');
    const badge = screen.getByTestId('generating-badge');
    expect(badge).toHaveClass('badge');
    expect(badge).toHaveClass('b-amber');
    expect(badge).not.toHaveClass('b-green');
    expect(badge).not.toHaveClass('b-red');
  });

  it('non-generating badges do NOT carry the pulse class', () => {
    renderBadge('ready', 'ready-badge');
    expect(screen.getByTestId('ready-badge')).not.toHaveClass('motion-safe:animate-pulse');
  });
});
