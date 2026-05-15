/**
 * InboxView Component Tests (INBPH-05)
 *
 * Covers the six AC items from ADMIN2-03 — render shape + SegControl
 * interaction. Pure render; no network mocking. i18n is bootstrapped
 * globally in src/lib/test-setup.ts, so no wrapper is needed.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import InboxView from '../InboxView';

describe('InboxView', () => {
  // 1. renders without throwing
  it('renders without throwing', () => {
    expect(() => render(<InboxView />)).not.toThrow();
  });

  // 2. all 4 stat-card titles in the document
  it('renders all 4 stat-card titles', () => {
    render(<InboxView />);
    expect(screen.getByText('Open items')).toBeTruthy();
    expect(screen.getByText('User feedback')).toBeTruthy();
    expect(screen.getByText('Drafts waiting')).toBeTruthy();
    expect(screen.getByText('Card errors')).toBeTruthy();
  });

  // 3. each StatCard shows its big number as "0" — 4 occurrences inside .stat-n
  it('renders the big number "0" inside each of the 4 .stat-n nodes', () => {
    const { container } = render(<InboxView />);
    const statNs = container.querySelectorAll('.stat-n');
    expect(statNs.length).toBe(4);
    statNs.forEach((el) => {
      expect(el.textContent).toBe('0');
    });
  });

  // 4. SegControl renders 5 buttons; each label has a (0) count tag (.cl-tag-n "0")
  it('renders 5 SegControl buttons each with a (0) count tag', () => {
    const { container } = render(<InboxView />);

    // 5 buttons via role (atom renders <button type="button">)
    const buttons = screen.getAllByRole('button');
    // Filter to the SegControl buttons only — they are the ones whose name
    // matches one of the 5 filter labels. Using getAllByRole('button') and
    // narrowing keeps this robust if the panel later adds incidental buttons.
    const segLabels = ['All', 'Feedback', 'Drafts', 'Audio', 'Errors'];
    const segButtons = buttons.filter((b) =>
      segLabels.some((label) => b.textContent?.includes(label))
    );
    expect(segButtons.length).toBe(5);

    // Each SegControl button contains a .cl-tag-n span with textContent "0"
    const tagNs = container.querySelectorAll('.cl-tag-n');
    expect(tagNs.length).toBe(5);
    tagNs.forEach((el) => {
      expect(el.textContent).toBe('0');
    });
  });

  // 5. clicking Feedback flips its aria-pressed to "true" and All to "false"
  it('toggles aria-pressed from All to Feedback on click', async () => {
    const user = userEvent.setup();
    render(<InboxView />);

    const allBtn = screen.getByRole('button', { name: /^All\b/i });
    const feedbackBtn = screen.getByRole('button', { name: /^Feedback\b/i });

    // Initial state: All active
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
    expect(feedbackBtn).toHaveAttribute('aria-pressed', 'false');

    await user.click(feedbackBtn);

    expect(feedbackBtn).toHaveAttribute('aria-pressed', 'true');
    expect(allBtn).toHaveAttribute('aria-pressed', 'false');
  });

  // 6. empty-state headline is in the document
  it('renders the empty-state headline', () => {
    render(<InboxView />);
    expect(screen.getByText('No items needing attention')).toBeTruthy();
  });
});
