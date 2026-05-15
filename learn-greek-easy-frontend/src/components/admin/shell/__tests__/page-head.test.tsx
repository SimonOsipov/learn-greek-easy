/**
 * PageHead Component Tests (ASHELL-05)
 *
 * Covers:
 * 1. All 5 slots render when provided (breadcrumb, kicker, title, sub, actions)
 * 2. Omitted breadcrumb produces no .va-bcrumb node
 * 3. Omitted kicker produces no kicker node
 * 4. Omitted sub produces no .va-sub node
 * 5. Omitted actions produces no .va-page-actions node
 * 6. Final breadcrumb segment is non-clickable + carries aria-current="page"
 * 7. Empty breadcrumb array treated as missing — no .va-bcrumb wrapper
 * 8. Earlier breadcrumb segment fires onClick on click
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PageHead } from '../page-head';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPageHead(props: React.ComponentProps<typeof PageHead>) {
  return render(<PageHead {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PageHead', () => {
  // 1. All 5 slots render when provided
  it('renders all slots when all props are provided', () => {
    renderPageHead({
      breadcrumb: [{ label: 'Admin' }, { label: 'Decks', onClick: vi.fn() }, { label: 'Edit' }],
      kicker: <span data-testid="kicker-node">Featured</span>,
      title: 'Edit Deck',
      sub: 'Modify deck details below',
      actions: <button type="button">Save</button>,
    });

    // breadcrumb wrapper present
    expect(document.querySelector('.va-bcrumb')).toBeTruthy();
    // kicker node present
    expect(screen.getByTestId('kicker-node')).toBeTruthy();
    // h1 present
    expect(screen.getByRole('heading', { level: 1, name: 'Edit Deck' })).toBeTruthy();
    // sub present
    expect(document.querySelector('.va-sub')).toBeTruthy();
    // actions present
    expect(document.querySelector('.va-page-actions')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  // 2. Omitted breadcrumb produces no .va-bcrumb node
  it('does not render .va-bcrumb when breadcrumb prop is omitted', () => {
    renderPageHead({ title: 'Dashboard' });

    expect(document.querySelector('.va-bcrumb')).toBeNull();
  });

  // 3. Omitted kicker produces no kicker-specific node (no kicker-atom class)
  it('does not render a kicker node when kicker prop is omitted', () => {
    renderPageHead({ title: 'Dashboard' });

    expect(document.querySelector('.kicker-atom')).toBeNull();
  });

  // 4. Omitted sub produces no .va-sub node
  it('does not render .va-sub when sub prop is omitted', () => {
    renderPageHead({ title: 'Dashboard' });

    expect(document.querySelector('.va-sub')).toBeNull();
  });

  // 5. Omitted actions produces no .va-page-actions node
  it('does not render .va-page-actions when actions prop is omitted', () => {
    renderPageHead({ title: 'Dashboard' });

    expect(document.querySelector('.va-page-actions')).toBeNull();
  });

  // 6. Final breadcrumb segment is non-clickable + aria-current="page"
  it('renders the final breadcrumb segment as a non-clickable span with aria-current="page"', () => {
    renderPageHead({
      breadcrumb: [{ label: 'Admin', onClick: vi.fn() }, { label: 'Edit Deck' }],
      title: 'Edit Deck',
    });

    const currentItem = document.querySelector('[aria-current="page"]');
    expect(currentItem).toBeTruthy();
    expect(currentItem?.tagName.toLowerCase()).toBe('span');
    expect(currentItem?.textContent).toBe('Edit Deck');
  });

  // 7. Empty breadcrumb array treated as missing — no .va-bcrumb wrapper
  it('does not render .va-bcrumb when breadcrumb is an empty array', () => {
    renderPageHead({ title: 'Dashboard', breadcrumb: [] });

    expect(document.querySelector('.va-bcrumb')).toBeNull();
  });

  // 8. Earlier breadcrumb segment fires onClick on click
  it('fires onClick when an earlier breadcrumb segment with onClick is clicked', async () => {
    const user = userEvent.setup();
    const onClickAdmin = vi.fn();

    renderPageHead({
      breadcrumb: [{ label: 'Admin', onClick: onClickAdmin }, { label: 'Current Page' }],
      title: 'Current Page',
    });

    const adminLink = screen.getByRole('link', { name: 'Admin' });
    await user.click(adminLink);

    expect(onClickAdmin).toHaveBeenCalledOnce();
  });
});
