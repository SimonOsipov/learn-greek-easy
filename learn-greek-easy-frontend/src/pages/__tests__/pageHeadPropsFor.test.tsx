import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { pageHeadPropsFor } from '@/pages/AdminPage';
import { Kicker } from '@/components/ui/kicker';
import { PageHead } from '@/components/admin/shell/page-head';

const STRINGS: Record<string, string> = {
  'inbox.title': 'Inbox',
  'inbox.sub':
    'Cross-content attention queue — feedback, drafts, audio gaps, and card errors will surface here.',
  'inbox.kicker': 'Needs your attention',
  'inbox.breadcrumb.dashboard': 'Admin',
  'inbox.breadcrumb.current': 'Inbox',
  'page.title': 'Admin',
  'page.subtitle': 'Manage content',
};
const mockT = (key: string) => STRINGS[key] ?? key;

describe('pageHeadPropsFor — inbox branch', () => {
  it('returns inbox-specific shape', () => {
    const r = pageHeadPropsFor('inbox', mockT);
    expect(r.title).toBe(STRINGS['inbox.title']);
    expect(r.sub).toBe(STRINGS['inbox.sub']);
    expect(r.breadcrumb).toHaveLength(2);
    expect(r.breadcrumb![0].label).toBe('Admin');
    expect(r.breadcrumb![1].label).toBe('Inbox');
    expect(React.isValidElement(r.kicker)).toBe(true);
    const kickerEl = r.kicker as React.ReactElement;
    expect(kickerEl.type).toBe(Kicker);
    expect((kickerEl.props as { dot: string }).dot).toBe('amber');
    expect((kickerEl.props as { children: string }).children).toBe('Needs your attention');
    expect(r.titleTestId).toBe('admin-title');
    expect(r.subTestId).toBe('admin-subtitle');
    expect(r.actions).toBeUndefined();
  });
});

describe('pageHeadPropsFor — default branch', () => {
  it('returns generic shape for non-inbox tab', () => {
    const r = pageHeadPropsFor('decks', mockT);
    expect(r.title).toBe(STRINGS['page.title']);
    expect(r.sub).toBe(STRINGS['page.subtitle']);
    expect(r).not.toHaveProperty('breadcrumb');
    expect(r).not.toHaveProperty('kicker');
    expect(r.titleTestId).toBe('admin-title');
    expect(r.subTestId).toBe('admin-subtitle');
  });
});

describe('pageHeadPropsFor — PageHead render integration', () => {
  it('PageHead consumes inbox props end-to-end', () => {
    const { container } = render(<PageHead {...pageHeadPropsFor('inbox', mockT)} />);
    expect(screen.getByTestId('admin-title')).toHaveTextContent('Inbox');
    expect(screen.getByTestId('admin-subtitle')).toHaveTextContent('Cross-content attention queue');
    expect(screen.getByText('Needs your attention')).toBeInTheDocument();
    expect(container.querySelector('.kicker-dot[data-tone="amber"]')).not.toBeNull();
  });
});
