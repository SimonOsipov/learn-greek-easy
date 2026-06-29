/**
 * WhatsNewStrip — unit tests (DASH2-01-05)
 *
 * Covers:
 *  - Heading renders "Recently added"
 *  - Situations chip shows the passed whatsNewCount
 *  - Exactly 2 unwired-dot testids (none on the situations chip)
 *  - Distinct aria-labels on both unwired dots
 *  - See-all link points to /changelog
 *  - whatsNewCount={0} renders without crashing (chip shows "0")
 */

import { screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { renderWithProviders } from '@/lib/test-utils';

import { WhatsNewStrip } from '../WhatsNewStrip';

// renderWithProviders already wraps with BrowserRouter, so <Link> works.

describe('WhatsNewStrip', () => {
  it('renders heading "Recently added"', () => {
    renderWithProviders(<WhatsNewStrip whatsNewCount={5} />);
    expect(screen.getByText(/recently added/i)).toBeInTheDocument();
  });

  it('shows the passed whatsNewCount in the situations chip', () => {
    renderWithProviders(<WhatsNewStrip whatsNewCount={7} />);
    const chip = screen.getByTestId('whats-new-situations');
    expect(chip).toHaveTextContent('7');
  });

  it('renders exactly 2 unwired-dot elements (not on the situations chip)', () => {
    renderWithProviders(<WhatsNewStrip whatsNewCount={3} />);
    const dots = screen.getAllByTestId('unwired-dot');
    expect(dots).toHaveLength(2);

    // Situations chip must NOT contain an unwired-dot
    const situationsChip = screen.getByTestId('whats-new-situations');
    expect(situationsChip.querySelector('[data-testid="unwired-dot"]')).toBeNull();
  });

  it('both unwired dots have distinct aria-labels', () => {
    renderWithProviders(<WhatsNewStrip whatsNewCount={0} />);
    const dots = screen.getAllByTestId('unwired-dot');
    expect(dots).toHaveLength(2);
    const labels = dots.map((d) => d.getAttribute('aria-label'));
    const unique = new Set(labels);
    expect(unique.size).toBe(2);
  });

  it('see-all link points to /changelog', () => {
    renderWithProviders(<WhatsNewStrip whatsNewCount={0} />);
    const link = screen.getByTestId('whats-new-see-all');
    expect(link).toHaveAttribute('href', '/changelog');
  });

  it('whatsNewCount={0} renders without crashing and chip shows "0"', () => {
    renderWithProviders(<WhatsNewStrip whatsNewCount={0} />);
    const chip = screen.getByTestId('whats-new-situations');
    expect(chip).toHaveTextContent('0');
  });
});
