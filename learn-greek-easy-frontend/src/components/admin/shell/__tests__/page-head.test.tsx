/**
 * PageHead Component Tests (ASHELL-05, extended by ASHELL-07)
 *
 * Covers:
 * 1. All 5 slots render when provided (breadcrumb, kicker, title, sub, actions)
 * 2. Omitted breadcrumb produces no .va-bcrumb node
 * 3. Omitted kicker produces no kicker node
 * 4. Omitted sub produces no .va-sub node
 * 5. Omitted actions produces no .va-page-actions node
 * 6. Final breadcrumb segment is non-clickable + carries aria-current="page"
 * 7. Empty breadcrumb array treated as missing — no .va-bcrumb wrapper
 * 8. Earlier breadcrumb segment (button) fires onClick on click
 * 9. titleTestId forwarded to h1 as data-testid (ASHELL-07)
 * 10. subTestId forwarded to .va-sub p as data-testid (ASHELL-07)
 * 11. No data-testid on h1/sub when props are omitted (ASHELL-07)
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

    const adminBtn = screen.getByRole('button', { name: 'Admin' });
    await user.click(adminBtn);

    expect(onClickAdmin).toHaveBeenCalledOnce();
  });

  // 9. titleTestId forwarded to h1 as data-testid
  it('forwards titleTestId as data-testid on the h1', () => {
    renderPageHead({ title: 'Admin Panel', titleTestId: 'admin-title' });

    const h1 = screen.getByRole('heading', { level: 1, name: 'Admin Panel' });
    expect(h1).toHaveAttribute('data-testid', 'admin-title');
  });

  // 10. subTestId forwarded to .va-sub p as data-testid
  it('forwards subTestId as data-testid on the sub paragraph', () => {
    renderPageHead({
      title: 'Admin Panel',
      sub: 'Manage your content',
      subTestId: 'admin-subtitle',
    });

    const subEl = document.querySelector('.va-sub');
    expect(subEl).toBeTruthy();
    expect(subEl).toHaveAttribute('data-testid', 'admin-subtitle');
  });

  // 11. No data-testid on h1 or sub when testid props are omitted
  it('does not add data-testid attributes when titleTestId and subTestId are omitted', () => {
    renderPageHead({ title: 'Admin Panel', sub: 'Subtitle' });

    const h1 = screen.getByRole('heading', { level: 1, name: 'Admin Panel' });
    expect(h1).not.toHaveAttribute('data-testid');

    const subEl = document.querySelector('.va-sub');
    expect(subEl).toBeTruthy();
    expect(subEl).not.toHaveAttribute('data-testid');
  });
});
