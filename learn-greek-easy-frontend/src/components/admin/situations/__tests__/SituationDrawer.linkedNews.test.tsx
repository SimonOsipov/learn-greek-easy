// src/components/admin/situations/__tests__/SituationDrawer.linkedNews.test.tsx
//
// SIT-07e: SituationDrawerLinkedNews — unit tests.
// Covers: kicker + helper, empty state, disabled CTA + tooltip, disabled footer actions,
// no linked-state branch, no tabNav.openIn invocation.

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

// tabNav mock — openIn is a spy so we can assert it's never called
const mockOpenIn = vi.fn();
vi.mock('@/hooks/useAdminTabNav', () => ({
  useAdminTabNav: () => ({
    openIn: mockOpenIn,
    activeTab: 'situations',
    searchParams: new URLSearchParams(),
  }),
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

// ── Fixture ────────────────────────────────────────────────────────────────────

function makeSituation(overrides: Partial<SituationDetailResponse> = {}): SituationDetailResponse {
  return {
    id: 'sit-1',
    scenario_el: 'Σενάριο',
    scenario_en: 'Scenario',
    scenario_ru: 'Сценарий',
    status: 'draft',
    level: 'B1',
    image_url: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    audio_url: null,
    audio_generated_at: null,
    audio_duration_seconds: null,
    audio_file_size_bytes: null,
    description_el: null,
    description_en: null,
    description_ru: null,
    description_el_a2: null,
    description_a2_audio_url: null,
    description_a2_audio_generated_at: null,
    description_a2_audio_duration_seconds: null,
    description_a2_audio_file_size_bytes: null,
    description_audio_url: null,
    description_audio_generated_at: null,
    description_audio_duration_seconds: null,
    description_audio_file_size_bytes: null,
    picture_prompt: null,
    dialog: [],
    exercises: [],
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

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('SituationDrawerLinkedNews — kicker + helper', () => {
  it('renders the root container with data-testid', async () => {
    await renderComponent();
    expect(screen.getByTestId('situation-drawer-tab-linkedNews-content')).toBeInTheDocument();
  });

  it('renders Kicker with situations.drawer.linkedNews.header key', async () => {
    await renderComponent();
    expect(screen.getByText('situations.drawer.linkedNews.header')).toBeInTheDocument();
  });

  it('renders helper text with situations.drawer.linkedNews.help key', async () => {
    await renderComponent();
    expect(screen.getByText('situations.drawer.linkedNews.help')).toBeInTheDocument();
  });
});

describe('SituationDrawerLinkedNews — empty state body', () => {
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
    const comingSoon = tooltips.filter((el) => el.textContent?.includes('news.comingSoon'));
    expect(comingSoon.length).toBeGreaterThanOrEqual(1);
  });
});

describe('SituationDrawerLinkedNews — footer disabled actions', () => {
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
    const comingSoon = tooltips.filter((el) => el.textContent?.includes('news.comingSoon'));
    // linkCta + Unlink + Re-derive = 3 tooltips
    expect(comingSoon.length).toBeGreaterThanOrEqual(3);
  });
});

describe('SituationDrawerLinkedNews — no linked-state branch', () => {
  it('does not render a linked-news-card element', async () => {
    await renderComponent();
    expect(screen.queryByTestId('linked-news-card')).not.toBeInTheDocument();
  });

  it('does not render any anchor tag (no link to article)', async () => {
    await renderComponent();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('SituationDrawerLinkedNews — useAdminTabNav imported but openIn never called', () => {
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
