import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { pageHeadPropsFor } from '@/pages/AdminPage';
import { Kicker } from '@/components/ui/kicker';
import { PageHead } from '@/components/admin/shell/page-head';

// Minimal string table covering every key accessed by pageHeadPropsFor.
const STRINGS: Record<string, string> = {
  // inbox
  'inbox.title': 'Inbox',
  'inbox.sub': 'Cross content queue — feedback, drafts, audio gaps, and card error.',
  'inbox.kicker': 'Admin · Inbox',
  'inbox.breadcrumb.dashboard': 'Admin',
  'inbox.breadcrumb.current': 'Inbox',
  // dashboard
  'dashboard.title': 'Admin Dashboard',
  'dashboard.sub': 'Manage content and view statistics across every learning surface.',
  'dashboard.kicker': 'Admin · Dashboard',
  'dashboard.breadcrumb.dashboard': 'Admin',
  'dashboard.breadcrumb.current': 'Dashboard',
  // decks
  'decks.title': 'All decks',
  'decks.sub': '{{deckTotal}} decks · {{cardTotal}} cards · vocabulary + culture exam sets',
  'decks.kicker': 'Admin · Decks',
  'decks.breadcrumb.dashboard': 'Admin',
  'decks.breadcrumb.current': 'Decks',
  'decks.actions.createDeck': 'Create Deck',
  // news
  'news.title': 'News',
  'news.kicker': 'Admin · News',
  'news.breadcrumb.dashboard': 'Admin',
  'news.breadcrumb.current': 'News',
  'news.actions.importRss': 'Import RSS',
  'news.actions.new': 'New article',
  comingSoon: 'Coming soon',
  // situations
  'situations.title': 'Situations',
  'situations.kicker': 'Admin · Situations',
  'situations.breadcrumb.dashboard': 'Admin',
  'situations.breadcrumb.current': 'Situations',
  'situations.actions.generateFromNews': 'Generate from news',
  'situations.actions.newSituation': '+ New situation',
  // exercises
  'exercises.title': 'Exercises',
  'exercises.kicker': 'Admin · Exercises',
  'exercises.sub': 'Approve and review listening + reading exercises across all situations.',
  'exercises.breadcrumb.dashboard': 'Admin',
  'exercises.breadcrumb.current': 'Exercises',
  // errors (cardErrors)
  'cardErrors.title': 'Card errors',
  'cardErrors.kicker': 'Admin · Card errors',
  'cardErrors.sub': 'User-reported issues on word and culture cards.',
  'cardErrors.breadcrumb.dashboard': 'Admin',
  'cardErrors.breadcrumb.current': 'Card errors',
  // feedback
  'feedback.title': 'Feedback',
  'feedback.kicker': 'Admin · Feedback',
  'feedback.sub': 'Review, respond, and track community feedback.',
  'feedback.breadcrumb.dashboard': 'Admin',
  'feedback.breadcrumb.current': 'Feedback',
  // changelog
  'changelog.title': 'Changelog',
  'changelog.kicker': 'Changelog',
  'changelog.sub': 'Manage and publish product updates for your users.',
  'changelog.breadcrumb.dashboard': 'Admin',
  'changelog.breadcrumb.current': 'Changelog',
  'changelog.actions.newEntry': 'New entry',
  // announcements
  'announcements.title': 'Announcements',
  'announcements.kicker': 'Admin · Announcements',
  'announcements.sub': 'Send notifications and updates to active learners.',
  'announcements.breadcrumb.dashboard': 'Admin',
  'announcements.breadcrumb.current': 'Announcements',
  'announcements.actions.new': 'New announcement',
};

const mockT = (key: string, opts?: Record<string, unknown>) => {
  let s = STRINGS[key] ?? key;
  if (opts) {
    for (const [k, v] of Object.entries(opts)) {
      s = s.replace(`{{${k}}}`, String(v));
    }
  }
  return s;
};

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
    expect((kickerEl.props as { children: string }).children).toBe('Admin · Inbox');
    expect(r.titleTestId).toBe('admin-title');
    expect(r.subTestId).toBe('admin-subtitle');
    expect(r.actions).toBeUndefined();
  });
});

describe('pageHeadPropsFor — decks branch', () => {
  it('returns decks-specific shape with breadcrumb, kicker, actions', () => {
    const r = pageHeadPropsFor('decks', mockT, undefined, {
      newsTotal: 0,
      newsAudio: 0,
      situationsTotal: 0,
      situationsDraft: 0,
      situationsReady: 0,
      deckTotal: 12,
      cardTotal: 340,
    });
    expect(r.title).toBe('All decks');
    expect(r.sub).toBe('12 decks · 340 cards · vocabulary + culture exam sets');
    expect(r.breadcrumb).toHaveLength(2);
    expect(r.breadcrumb![0].label).toBe('Admin');
    expect(r.breadcrumb![1].label).toBe('Decks');
    expect(React.isValidElement(r.kicker)).toBe(true);
    expect(r.actions).toBeDefined();
    expect(r.titleTestId).toBe('admin-title');
    expect(r.subTestId).toBe('admin-subtitle');
  });
});

describe('pageHeadPropsFor — dashboard branch', () => {
  it('returns dashboard shape', () => {
    const r = pageHeadPropsFor('dashboard', mockT);
    expect(r.title).toBe('Admin Dashboard');
    expect(r.sub).toBe('Manage content and view statistics across every learning surface.');
    expect(r.breadcrumb).toHaveLength(2);
    expect(r.actions).toBeUndefined();
    expect(r.titleTestId).toBe('admin-title');
  });
});

describe('pageHeadPropsFor — exercises branch', () => {
  it('returns exercises shape with New exercise action', () => {
    const r = pageHeadPropsFor('exercises', mockT);
    expect(r.title).toBe('Exercises');
    expect(r.actions).toBeDefined();
    expect(React.isValidElement(r.actions)).toBe(true);
    expect(r.breadcrumb![1].label).toBe('Exercises');
    expect(React.isValidElement(r.kicker)).toBe(true);
    const kickerEl = r.kicker as React.ReactElement;
    expect((kickerEl.props as { dot: string }).dot).toBe('cyan');
  });
});

describe('pageHeadPropsFor — errors branch', () => {
  it('returns card errors shape without actions', () => {
    const r = pageHeadPropsFor('errors', mockT);
    expect(r.title).toBe('Card errors');
    expect(r.actions).toBeUndefined();
    expect(r.breadcrumb![1].label).toBe('Card errors');
  });
});

describe('pageHeadPropsFor — news branch', () => {
  it('returns news shape with actions', () => {
    const r = pageHeadPropsFor('news', mockT, undefined, {
      newsTotal: 10,
      newsAudio: 5,
      situationsTotal: 0,
      situationsDraft: 0,
      situationsReady: 0,
      deckTotal: 0,
      cardTotal: 0,
    });
    expect(r.title).toBe('News');
    expect(r.breadcrumb![0].label).toBe('Admin');
    expect(r.breadcrumb![1].label).toBe('News');
    expect(r.actions).toBeDefined();
  });
});

describe('pageHeadPropsFor — situations branch', () => {
  it('returns situations shape with actions', () => {
    const r = pageHeadPropsFor('situations', mockT, undefined, {
      newsTotal: 0,
      newsAudio: 0,
      situationsTotal: 5,
      situationsDraft: 2,
      situationsReady: 3,
      deckTotal: 0,
      cardTotal: 0,
    });
    expect(r.title).toBe('Situations');
    expect(r.actions).toBeDefined();
  });
});

describe('pageHeadPropsFor — feedback branch', () => {
  it('returns feedback shape without actions', () => {
    const r = pageHeadPropsFor('feedback', mockT);
    expect(r.title).toBe('Feedback');
    expect(r.actions).toBeUndefined();
    expect(r.breadcrumb![1].label).toBe('Feedback');
  });
});

describe('pageHeadPropsFor — changelog branch', () => {
  it('returns changelog shape with actions', () => {
    const r = pageHeadPropsFor('changelog', mockT);
    expect(r.title).toBe('Changelog');
    expect(r.actions).toBeDefined();
  });
});

describe('pageHeadPropsFor — announcements branch', () => {
  it('returns announcements shape with action button', () => {
    const r = pageHeadPropsFor('announcements', mockT);
    expect(r.title).toBe('Announcements');
    expect(r.actions).toBeDefined();
    expect(r.breadcrumb![1].label).toBe('Announcements');
  });
});

describe('pageHeadPropsFor — PageHead render integration', () => {
  it('PageHead consumes inbox props end-to-end', () => {
    const { container } = render(<PageHead {...pageHeadPropsFor('inbox', mockT)} />);
    expect(screen.getByTestId('admin-title')).toHaveTextContent('Inbox');
    expect(screen.getByTestId('admin-subtitle')).toHaveTextContent('Cross content queue');
    expect(screen.getByText('Admin · Inbox')).toBeInTheDocument();
    expect(container.querySelector('.kicker-dot[data-tone="amber"]')).not.toBeNull();
  });
});
