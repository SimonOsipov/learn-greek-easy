/**
 * SectionTabs Component Tests (ASHELL-04)
 *
 * Covers:
 * 1. Renders one tab button per item
 * 2. Active tab has is-active class; inactive tabs do not
 * 3. active tab button has aria-selected="true"; others have aria-selected="false"
 * 4. Clicking an inactive tab calls onTabChange with the correct key
 * 5. Clicking the active tab calls onTabChange with the active key
 * 6. Count badge shows the correct number
 * 7. tone-amber + count > 0 adds is-attn class to the count badge
 * 8. tone-amber + count === 0 does NOT add is-attn class
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SectionTabs, type SectionTabItem } from '../section-tabs';
import type { AdminTabType } from '@/pages/admin/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_TABS: SectionTabItem[] = [
  { key: 'dashboard', label: 'Dashboard', count: 0 },
  { key: 'inbox', label: 'Inbox', count: 5 },
  { key: 'decks', label: 'Decks', count: 3, tone: 'amber' },
];

function renderTabs(
  props: Partial<React.ComponentProps<typeof SectionTabs>> & { active?: AdminTabType } = {}
) {
  const { tabs = DEFAULT_TABS, active = 'dashboard', onTabChange = vi.fn(), ...rest } = props;
  return render(<SectionTabs tabs={tabs} active={active} onTabChange={onTabChange} {...rest} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SectionTabs', () => {
  // 1. Renders one tab button per item
  it('renders one tab button per item', () => {
    renderTabs();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(DEFAULT_TABS.length);
  });

  // 2. Active tab has is-active class; inactive tabs do not
  it('applies is-active class only to the active tab', () => {
    renderTabs({ active: 'inbox' });
    const tabs = screen.getAllByRole('tab');

    const dashboardTab = tabs.find((t) => t.textContent?.includes('Dashboard'));
    const inboxTab = tabs.find((t) => t.textContent?.includes('Inbox'));
    const decksTab = tabs.find((t) => t.textContent?.includes('Decks'));

    expect(inboxTab?.classList.contains('is-active')).toBe(true);
    expect(dashboardTab?.classList.contains('is-active')).toBe(false);
    expect(decksTab?.classList.contains('is-active')).toBe(false);
  });

  // 3. Active tab has aria-selected="true"; others have aria-selected="false"
  it('sets aria-selected correctly for active and inactive tabs', () => {
    renderTabs({ active: 'decks' });
    const tabs = screen.getAllByRole('tab');

    const decksTab = tabs.find((t) => t.textContent?.includes('Decks'));
    const dashboardTab = tabs.find((t) => t.textContent?.includes('Dashboard'));

    expect(decksTab).toHaveAttribute('aria-selected', 'true');
    expect(dashboardTab).toHaveAttribute('aria-selected', 'false');
  });

  // 4. Clicking an inactive tab calls onTabChange with the correct key
  it('calls onTabChange with the correct key when an inactive tab is clicked', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    renderTabs({ active: 'dashboard', onTabChange });

    const inboxTab = screen.getAllByRole('tab').find((t) => t.textContent?.includes('Inbox'));
    await user.click(inboxTab!);

    expect(onTabChange).toHaveBeenCalledOnce();
    expect(onTabChange).toHaveBeenCalledWith('inbox');
  });

  // 5. Clicking the active tab calls onTabChange with the active key
  it('calls onTabChange with the active key when the active tab is clicked', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    renderTabs({ active: 'dashboard', onTabChange });

    const dashboardTab = screen
      .getAllByRole('tab')
      .find((t) => t.textContent?.includes('Dashboard'));
    await user.click(dashboardTab!);

    expect(onTabChange).toHaveBeenCalledOnce();
    expect(onTabChange).toHaveBeenCalledWith('dashboard');
  });

  // 6. Count badge shows the correct number
  it('displays the correct count in each badge', () => {
    renderTabs();
    const tabs = screen.getAllByRole('tab');

    // Dashboard has count 0
    const dashboardTab = tabs.find((t) => t.textContent?.includes('Dashboard'));
    expect(dashboardTab?.querySelector('.va-tab-n')?.textContent).toBe('0');

    // Inbox has count 5
    const inboxTab = tabs.find((t) => t.textContent?.includes('Inbox'));
    expect(inboxTab?.querySelector('.va-tab-n')?.textContent).toBe('5');
  });

  // 7. tone-amber + count > 0 adds is-attn class
  it('adds is-attn class to badge when tone is amber and count > 0', () => {
    renderTabs();
    const decksTab = screen.getAllByRole('tab').find((t) => t.textContent?.includes('Decks'));
    const badge = decksTab?.querySelector('.va-tab-n');

    expect(badge?.classList.contains('tone-amber')).toBe(true);
    expect(badge?.classList.contains('is-attn')).toBe(true);
  });

  // 8. tone-amber + count === 0 does NOT add is-attn class
  it('does NOT add is-attn class when tone is amber but count is 0', () => {
    const tabs: SectionTabItem[] = [{ key: 'inbox', label: 'Inbox', count: 0, tone: 'amber' }];
    renderTabs({ tabs, active: 'inbox' });

    const badge = screen.getByRole('tab').querySelector('.va-tab-n');
    expect(badge?.classList.contains('tone-amber')).toBe(true);
    expect(badge?.classList.contains('is-attn')).toBe(false);
  });
});
