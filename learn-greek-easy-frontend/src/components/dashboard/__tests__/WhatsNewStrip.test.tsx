/**
 * WhatsNewStrip — unit tests (DASH2-01-05)
 *
 * Covers (AC tests, authored green):
 *  - Heading renders "Recently added"
 *  - Situations chip shows the passed whatsNewCount
 *  - Exactly 2 unwired-dot testids (none on the situations chip)
 *  - Distinct aria-labels on both unwired dots
 *  - See-all link points to /changelog
 *  - whatsNewCount={0} renders without crashing (chip shows "0")
 *
 * Adversarial additions (QA DASH2-01-05 gate):
 *  - Heading is NOT "Since you last visited" (E1 negative guard)
 *  - See-all renders as <a> anchor, NOT a <button> (cascade-trap guard)
 *  - Both UnwiredDot aria-labels mention the specific metric they guard
 *  - Large whatsNewCount (999) renders correctly (boundary)
 *  - Situations chip renders text label alongside the count
 *  - Both UnwiredDots use tone="danger" (data-tone absent → red, per CSS spec)
 */

import { screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { renderWithProviders } from '@/lib/test-utils';

import { WhatsNewStrip } from '../WhatsNewStrip';

// renderWithProviders already wraps with BrowserRouter, so <Link> works.

describe('WhatsNewStrip', () => {
  // ── AC tests (authored green) ─────────────────────────────────────────────

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

  // ── Adversarial (QA DASH2-01-05) ─────────────────────────────────────────

  it('adversarial_heading_not_since_you_last_visited: heading is never "Since you last visited"', () => {
    // E1 negative guard — the old design label must not leak in
    renderWithProviders(<WhatsNewStrip whatsNewCount={5} />);
    expect(screen.queryByText(/since you last visited/i)).toBeNull();
  });

  it('adversarial_see_all_is_anchor_not_button: see-all renders as <a>, NOT a <button>', () => {
    // Guard against the shadcn <Button> cascade trap (converts <a> to <button>)
    renderWithProviders(<WhatsNewStrip whatsNewCount={0} />);
    const link = screen.getByTestId('whats-new-see-all');
    expect(link.tagName.toLowerCase()).toBe('a');
  });

  it('adversarial_unwired_dot_aria_labels_describe_metrics: both labels mention the specific metric', () => {
    // The generic fallback "Placeholder — not yet connected" is not specific enough;
    // each label must reference the metric it guards (news items / audio articles).
    renderWithProviders(<WhatsNewStrip whatsNewCount={0} />);
    const dots = screen.getAllByTestId('unwired-dot');
    const labels = dots.map((d) => d.getAttribute('aria-label') ?? '');

    // Neither label should be the generic default
    for (const label of labels) {
      expect(label).not.toBe('Placeholder — not yet connected to backend data.');
    }

    // The pair must collectively mention news and audio
    const combined = labels.join(' ').toLowerCase();
    expect(combined).toMatch(/news/i);
    expect(combined).toMatch(/audio|article/i);
  });

  it('adversarial_large_count_boundary: whatsNewCount=999 renders without overflow or crash', () => {
    renderWithProviders(<WhatsNewStrip whatsNewCount={999} />);
    const chip = screen.getByTestId('whats-new-situations');
    expect(chip).toHaveTextContent('999');
  });

  it('adversarial_situations_chip_has_label_text: situations chip contains count AND label text', () => {
    renderWithProviders(<WhatsNewStrip whatsNewCount={4} />);
    const chip = screen.getByTestId('whats-new-situations');
    // Count present
    expect(chip).toHaveTextContent('4');
    // Label text present (from i18n key dashboard.whatsNew.situations)
    // The English value is "new situations"; verify something beyond just the digit
    expect(chip.textContent?.length).toBeGreaterThan(1);
    expect(chip.textContent).toMatch(/\D/); // contains non-digit characters
  });

  it('adversarial_unwired_dots_are_danger_tone: both red dots have no data-tone (danger default in CSS)', () => {
    // tone="danger" → marker has NO data-tone attribute → CSS base rule applies → red
    // tone="amber" → marker has data-tone="amber" → amber override
    // WhatsNewStrip passes tone="danger" explicitly to both chips.
    renderWithProviders(<WhatsNewStrip whatsNewCount={0} />);
    const dots = screen.getAllByTestId('unwired-dot');
    for (const dot of dots) {
      const marker = dot.querySelector('.dx-unwired-dot-marker');
      expect(marker).not.toBeNull();
      // No amber override → default danger (red)
      expect(marker!.getAttribute('data-tone')).toBeNull();
    }
  });
});
