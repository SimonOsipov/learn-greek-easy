import React from 'react';

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { SectionTabs, type SectionTabItem } from '../SectionTabs';

type Tab = 'inbox' | 'decks' | 'news';
const tabs: SectionTabItem<Tab>[] = [
  { key: 'inbox', label: 'Inbox', count: 0, tone: 'amber' },
  { key: 'decks', label: 'Decks', count: 12 },
  { key: 'news', label: 'News', count: 5 },
];

describe('SectionTabs', () => {
  it('renders all tabs with count badges (even 0)', () => {
    render(<SectionTabs<Tab> tabs={tabs} active="decks" onTabChange={() => {}} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByText('Inbox')).toBeInTheDocument();
    expect(screen.getByText('Decks')).toBeInTheDocument();
    expect(screen.getByText('News')).toBeInTheDocument();
    // All three counts including 0
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('marks the active tab with .is-active and aria-selected=true', () => {
    render(<SectionTabs<Tab> tabs={tabs} active="decks" onTabChange={() => {}} />);
    // The count badge is aria-hidden, so the accessible name is just the label.
    const decks = screen.getByRole('tab', { name: 'Decks' });
    expect(decks).toHaveClass('is-active');
    expect(decks).toHaveAttribute('aria-selected', 'true');
  });

  it('clicking a tab fires onTabChange with the key', () => {
    const onTabChange = vi.fn();
    render(<SectionTabs<Tab> tabs={tabs} active="decks" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'News' }));
    expect(onTabChange).toHaveBeenCalledWith('news');
  });

  it('inbox amber attention class fires only when count > 0', () => {
    const { container, rerender } = render(
      <SectionTabs<Tab>
        tabs={[{ key: 'inbox', label: 'Inbox', count: 0, tone: 'amber' }]}
        active="inbox"
        onTabChange={() => {}}
      />
    );
    // count=0: tone-amber but NOT is-attn
    expect(container.querySelector('.va-tab-n.tone-amber')).not.toBeNull();
    expect(container.querySelector('.va-tab-n.is-attn')).toBeNull();

    rerender(
      <SectionTabs<Tab>
        tabs={[{ key: 'inbox', label: 'Inbox', count: 3, tone: 'amber' }]}
        active="inbox"
        onTabChange={() => {}}
      />
    );
    expect(container.querySelector('.va-tab-n.is-attn')).not.toBeNull();
  });
});
