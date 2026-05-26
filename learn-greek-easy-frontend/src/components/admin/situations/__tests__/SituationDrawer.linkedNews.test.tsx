// src/components/admin/situations/__tests__/SituationDrawer.linkedNews.test.tsx
//
// SAR2-26-17b: SituationDrawerLinkedNews — unit tests.
// Covers: kicker + helper, empty state, disabled CTA + tooltip, disabled footer actions,
// linked-news rich-card branch, active footer actions when linked, tabNav.openIn call.

import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SituationDetailResponse } from '@/types/situation';

// ── Module mocks ───────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

// tabNav mock — openIn is a spy so we can assert calls
const mockOpenIn = vi.fn();
vi.mock('@/hooks/useAdminTabNav', () => ({
  useAdminTabNav: () => ({
    openIn: mockOpenIn,
    activeTab: 'situations',
    searchParams: new URLSearchParams(),
  }),
}));

// adminSituationStore mock — fetchSituationDetail + closeDrawer spies
const mockFetchDetail = vi.fn().mockResolvedValue(undefined);
const mockCloseDrawer = vi.fn();
vi.mock('@/stores/adminSituationStore', () => ({
  useAdminSituationStore: (
    selector: (s: {
      fetchSituationDetail: typeof mockFetchDetail;
      closeDrawer: typeof mockCloseDrawer;
    }) => unknown
  ) => selector({ fetchSituationDetail: mockFetchDetail, closeDrawer: mockCloseDrawer }),
}));

// adminAPI mock
const mockUnlinkSituationNews = vi.fn().mockResolvedValue(undefined);
const mockReDeriveSituationFromNews = vi.fn().mockResolvedValue(undefined);
vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    unlinkSituationNews: (...args: Parameters<typeof mockUnlinkSituationNews>) =>
      mockUnlinkSituationNews(...args),
    reDeriveSituationFromNews: (...args: Parameters<typeof mockReDeriveSituationFromNews>) =>
      mockReDeriveSituationFromNews(...args),
  },
}));

// toast mock
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: Parameters<typeof mockToast>) => mockToast(...args),
}));

// Tooltip: render children + content inline so tooltip text is queryable
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => {
    if (asChild) return <>{children}</>;
    return <span>{children}</span>;
  },
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="tooltip-content">{children}</span>
  ),
}));

// ── Fixtures ────────────────────────────────────────────────────────────────────

const LINKED_NEWS = {
  id: 'news-1',
  title_en: 'Supreme Court Rejects Appeal',
  country: 'greece',
  published_at: '2026-01-01T00:00:00Z',
};

function makeSituation(overrides: Partial<SituationDetailResponse> = {}): SituationDetailResponse {
  return {
    id: 'sit-1',
    scenario_el: 'Σενάριο',
    scenario_en: 'Scenario',
    scenario_ru: 'Сценарий',
    status: 'draft',
    levels: [],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    dialog: null,
    description: null,
    picture: null,
    linked_news: null,
    ...overrides,
  } as unknown as SituationDetailResponse;
}

// ── Helper ─────────────────────────────────────────────────────────────────────

async function renderComponent(situation = makeSituation()) {
  const { SituationDrawerLinkedNews } = await import('../SituationDrawer.linkedNews');
  render(
    <MemoryRouter>
      <SituationDrawerLinkedNews situation={situation} />
    </MemoryRouter>
  );
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests: root container ──────────────────────────────────────────────────────

describe('SituationDrawerLinkedNews — root container', () => {
  it('renders the root container with data-testid', async () => {
    await renderComponent();
    expect(screen.getByTestId('situation-drawer-tab-linkedNews-content')).toBeInTheDocument();
  });

  it('renders Kicker with situations.drawer.linkedNews.kicker key', async () => {
    await renderComponent();
    expect(screen.getByText('situations.drawer.linkedNews.kicker')).toBeInTheDocument();
  });

  it('renders helper text with situations.drawer.linkedNews.help key', async () => {
    await renderComponent();
    expect(screen.getByText('situations.drawer.linkedNews.help')).toBeInTheDocument();
  });
});

// ── Tests: empty state ─────────────────────────────────────────────────────────

describe('SituationDrawerLinkedNews — empty state (linked_news = null)', () => {
  it('renders empty body text', async () => {
    await renderComponent();
    expect(screen.getByText('situations.drawer.linkedNews.empty')).toBeInTheDocument();
  });

  it('renders Link to article button with aria-disabled="true"', async () => {
    await renderComponent();
    const btn = screen.getByRole('button', {
      name: 'situations.drawer.linkedNews.linkCta',
    });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows Coming soon tooltip for Link to article button', async () => {
    await renderComponent();
    const tooltips = screen.getAllByTestId('tooltip-content');
    const comingSoon = tooltips.filter((el) => el.textContent?.includes('comingSoon'));
    expect(comingSoon.length).toBeGreaterThanOrEqual(1);
  });

  it('does not render a linked-news-card element', async () => {
    await renderComponent();
    expect(screen.queryByTestId('linked-news-card')).not.toBeInTheDocument();
  });

  it('does not render any anchor tag (no link to article)', async () => {
    await renderComponent();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

// ── Tests: footer disabled (empty state) ────────────────────────────────────────

describe('SituationDrawerLinkedNews — footer disabled actions (empty state)', () => {
  it('renders Unlink button with aria-disabled="true"', async () => {
    await renderComponent();
    const btn = screen.getByRole('button', {
      name: 'situations.drawer.linkedNews.unlink',
    });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders Re-derive button with aria-disabled="true"', async () => {
    await renderComponent();
    const btn = screen.getByRole('button', {
      name: 'situations.drawer.linkedNews.reDerive',
    });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows Coming soon tooltip for footer buttons', async () => {
    await renderComponent();
    const tooltips = screen.getAllByTestId('tooltip-content');
    const comingSoon = tooltips.filter((el) => el.textContent?.includes('comingSoon'));
    // linkCta + Unlink + Re-derive = 3 tooltips
    expect(comingSoon.length).toBeGreaterThanOrEqual(3);
  });
});

// ── Tests: openIn never called in empty state ──────────────────────────────────

describe('SituationDrawerLinkedNews — openIn not called in empty state', () => {
  it('does not call openIn on initial render', async () => {
    await renderComponent();
    expect(mockOpenIn).not.toHaveBeenCalled();
  });

  it('does not call openIn when disabled Link to article button is clicked', async () => {
    const user = userEvent.setup();
    await renderComponent();
    const btn = screen.getByRole('button', {
      name: 'situations.drawer.linkedNews.linkCta',
    });
    await user.click(btn);
    expect(mockOpenIn).not.toHaveBeenCalled();
  });
});

// ── Tests: linked state rich card ─────────────────────────────────────────────

describe('SituationDrawerLinkedNews — linked state (linked_news set)', () => {
  it('renders linked-news-card element', async () => {
    await renderComponent(makeSituation({ linked_news: LINKED_NEWS }));
    expect(screen.getByTestId('linked-news-card')).toBeInTheDocument();
  });

  it('renders news title in the card', async () => {
    await renderComponent(makeSituation({ linked_news: LINKED_NEWS }));
    expect(screen.getByText('Supreme Court Rejects Appeal')).toBeInTheDocument();
  });

  it('does not render empty state text', async () => {
    await renderComponent(makeSituation({ linked_news: LINKED_NEWS }));
    expect(screen.queryByText('situations.drawer.linkedNews.empty')).not.toBeInTheDocument();
  });

  it('renders disabled Link to article button (always shown, Coming soon)', async () => {
    await renderComponent(makeSituation({ linked_news: LINKED_NEWS }));
    const btn = screen.getByRole('button', {
      name: 'situations.drawer.linkedNews.linkCta',
    });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
  });
});

// ── Tests: linked state footer actions ────────────────────────────────────────

describe('SituationDrawerLinkedNews — linked state footer actions', () => {
  it('renders Unlink button without aria-disabled', async () => {
    await renderComponent(makeSituation({ linked_news: LINKED_NEWS }));
    const btn = screen.getByTestId('linked-news-unlink-btn');
    expect(btn).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('renders Re-derive button without aria-disabled', async () => {
    await renderComponent(makeSituation({ linked_news: LINKED_NEWS }));
    const btn = screen.getByTestId('linked-news-re-derive-btn');
    expect(btn).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('calls unlinkSituationNews + fetchSituationDetail when Unlink is clicked', async () => {
    const user = userEvent.setup();
    await renderComponent(makeSituation({ linked_news: LINKED_NEWS }));
    await user.click(screen.getByTestId('linked-news-unlink-btn'));
    expect(mockUnlinkSituationNews).toHaveBeenCalledWith('sit-1');
    expect(mockFetchDetail).toHaveBeenCalledWith('sit-1');
  });

  it('calls reDeriveSituationFromNews when Re-derive is clicked', async () => {
    const user = userEvent.setup();
    await renderComponent(makeSituation({ linked_news: LINKED_NEWS }));
    await user.click(screen.getByTestId('linked-news-re-derive-btn'));
    expect(mockReDeriveSituationFromNews).toHaveBeenCalledWith('sit-1');
  });
});

// ── Tests: card navigation ────────────────────────────────────────────────────

describe('SituationDrawerLinkedNews — card click navigation', () => {
  it('calls closeDrawer + openIn("news", { edit: newsId }) when card is clicked', async () => {
    const user = userEvent.setup();
    await renderComponent(makeSituation({ linked_news: LINKED_NEWS }));
    await user.click(screen.getByTestId('linked-news-card'));
    expect(mockCloseDrawer).toHaveBeenCalled();
    expect(mockOpenIn).toHaveBeenCalledWith('news', { edit: 'news-1' });
  });
});
