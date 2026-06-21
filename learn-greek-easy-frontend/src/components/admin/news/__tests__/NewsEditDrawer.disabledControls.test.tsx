// src/components/admin/news/__tests__/NewsEditDrawer.disabledControls.test.tsx
//
// ADMIN2-36-07 (C4): Mandatory regression test — every named disabled control in the
// News edit drawer must render:
//   1. A red-dot marker span (absolute, bg-destructive)
//   2. A tooltip trigger wrapping the control
//   3. The control itself must be disabled (aria-disabled="true" or disabled attribute)
//
// Named controls:
//   - Regenerate translations (NewsEditDrawer.tsx header area)
//   - Audio Regenerate ×2 — REMOVED in ADMIN2-40 F10 (wired for linked items; redundant with
//     audio.test.tsx #6 which guards the unlinked path; red-dot removed — guard, not stub)
//   - Audio Upload ×2 — B1 + A2 (NewsEditDrawer.audio.tsx)
//   - Linked-situation Generate (NewsEditDrawer.linkedSituation.tsx empty state)
//   - Unlink (NewsEditDrawer.linkedSituation.tsx footer)
//   - Regenerate-from-article (NewsEditDrawer.linkedSituation.tsx footer)

import React from 'react';

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NewsItemResponse } from '@/services/adminAPI';

// ── Module mocks ───────────────────────────────────────────────────────────────

// I18NG-04: real i18n instance resolves all admin keys.

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  APIRequestError: class APIRequestError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

const mockUpdateNewsItem = vi.fn();
vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    updateNewsItem: (...args: unknown[]) => mockUpdateNewsItem(...args),
  },
  getDescriptionAudioStreamUrl: (_situationId: string, level: string) =>
    `/api/v1/admin/situations/sit-1/description-audio/stream?level=${level}`,
}));

// ADMIN2-40 F10: useSSE mock — NewsEditDrawer.audio now imports it.
vi.mock('@/hooks/useSSE', () => ({
  useSSE: vi.fn(() => ({ state: 'disconnected', close: vi.fn() })),
}));

// Store mock
const mockCloseDrawer = vi.fn();
const mockFetchNewsItems = vi.fn().mockResolvedValue(undefined);

const storeState = {
  drawerItemId: null as string | null,
  newsItems: [] as NewsItemResponse[],
  closeDrawer: mockCloseDrawer,
  fetchNewsItems: mockFetchNewsItems,
};

const mockUseAdminNewsStore = vi.fn((selector?: (s: typeof storeState) => unknown) => {
  if (typeof selector === 'function') return selector(storeState);
  return storeState;
});
(mockUseAdminNewsStore as unknown as { getState: () => typeof storeState }).getState = () =>
  storeState;

vi.mock('@/stores/adminNewsStore', () => ({
  useAdminNewsStore: (...args: unknown[]) =>
    mockUseAdminNewsStore(...(args as [(s: typeof storeState) => unknown])),
}));

vi.mock('@/hooks/useAdminTabNav', () => ({
  useAdminTabNav: () => ({
    openIn: vi.fn(),
    activeTab: 'news',
    searchParams: new URLSearchParams(),
  }),
}));

// Tooltip: render children + content inline so TooltipContent is accessible.
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => {
    if (asChild) {
      // Wrap in a span marker so we can detect the trigger boundary without
      // needing to clone with unknown extra props.
      return <span data-tooltip-trigger="true">{children}</span>;
    }
    return <span data-tooltip-trigger="true">{children}</span>;
  },
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="tooltip-content">{children}</span>
  ),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<NewsItemResponse> = {}): NewsItemResponse {
  return {
    id: 'item-1',
    title_el: 'Ελληνικός τίτλος',
    title_en: 'English title',
    title_ru: 'Русский заголовок',
    description_el: 'Περιγραφή B1',
    description_en: 'Description EN',
    description_ru: 'Описание RU',
    publication_date: '2025-01-15',
    original_article_url: 'https://example.com/article',
    image_url: null,
    audio_url: 'https://cdn.example.com/b1.mp3',
    audio_generated_at: '2024-03-15T10:00:00Z',
    audio_duration_seconds: 120,
    audio_file_size_bytes: null,
    created_at: '2025-01-10T10:00:00Z',
    updated_at: '2025-01-14T12:00:00Z',
    country: 'greece',
    title_el_a2: null,
    description_el_a2: null,
    audio_a2_url: 'https://cdn.example.com/a2.mp3',
    audio_a2_duration_seconds: 90,
    audio_a2_generated_at: '2024-03-15T11:00:00Z',
    audio_a2_file_size_bytes: null,
    has_a2_content: false,
    alt_text: null,
    photo_credit: null,
    status: 'draft' as const,
    linked_situation: null,
    image_variants: null,
    ...overrides,
  };
}

// ── Lazy-loaded modules ────────────────────────────────────────────────────────

let NewsEditDrawerAudio: React.FC<{ item: NewsItemResponse }>;
let NewsEditDrawerLinkedSituation: React.FC<{
  item: NewsItemResponse;
  linkedSituation?: null;
  onRequestQuickJump?: (id: string) => void;
}>;
let NewsEditDrawer: React.FC;

async function loadModules() {
  const audioMod = await import('../NewsEditDrawer.audio');
  NewsEditDrawerAudio = audioMod.NewsEditDrawerAudio;
  const lsMod = await import('../NewsEditDrawer.linkedSituation');
  NewsEditDrawerLinkedSituation = lsMod.NewsEditDrawerLinkedSituation;
  const drawerMod = await import('../NewsEditDrawer');
  NewsEditDrawer = drawerMod.NewsEditDrawer;
}

beforeEach(async () => {
  vi.clearAllMocks();
  storeState.drawerItemId = null;
  storeState.newsItems = [];
  mockFetchNewsItems.mockResolvedValue(undefined);
  mockUpdateNewsItem.mockResolvedValue({});
  await loadModules();
});

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Assert that a button element (found by predicate) has:
 *   1. The red-dot marker span inside it (absolute, bg-destructive).
 *   2. A tooltip trigger attribute on itself or a parent.
 *   3. Is disabled via aria-disabled="true" or the disabled attribute.
 */
function assertDisabledControlContract(btn: Element, controlName: string): void {
  // 1. Red-dot marker span present inside the button.
  const dot = btn.querySelector('span[aria-hidden="true"]');
  expect(dot, `${controlName}: must have a red-dot marker span`).not.toBeNull();

  // 2. Tooltip trigger: the button itself carries data-tooltip-trigger (injected by our mock),
  //    or a parent does (TooltipTrigger asChild clones the child).
  const hasTriggerOnSelf = btn.getAttribute('data-tooltip-trigger') === 'true';
  const hasTriggerOnParent = btn.closest('[data-tooltip-trigger="true"]') !== null;
  expect(
    hasTriggerOnSelf || hasTriggerOnParent,
    `${controlName}: must be wrapped in a TooltipTrigger`
  ).toBe(true);

  // 3. Disabled state.
  const isAriaDisabled = btn.getAttribute('aria-disabled') === 'true';
  const isHtmlDisabled = (btn as HTMLButtonElement).disabled === true;
  expect(
    isAriaDisabled || isHtmlDisabled,
    `${controlName}: must be disabled (aria-disabled="true" or disabled attr)`
  ).toBe(true);
}

// ── Wrapper for audio isolated tests ─────────────────────────────────────────

function AudioWrapper({ item }: { item: NewsItemResponse }) {
  return (
    <MemoryRouter>
      <NewsEditDrawerAudio item={item} />
    </MemoryRouter>
  );
}

// ── Full drawer render ────────────────────────────────────────────────────────

function renderDrawer() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <NewsEditDrawer />
    </MemoryRouter>
  );
}

// ── ADMIN2-36-07 (C4): Disabled-control marker regression tests ────────────────

// ADMIN2-41 F1: "Regenerate translations" footer button REMOVED.
// The entire describe block for that control has been deleted — the button no longer
// renders, so there is nothing to assert its disabled-control contract on.

// ADMIN2-40 F10: "Audio Regenerate ×2" block REMOVED.
// After F10 the Regenerate button is wired for linked items (no longer a stub) and uses a
// plain input-guard (aria-disabled + regenerateNoSituation tooltip, no red dot) for unlinked
// items. The unlinked guard is covered by NewsEditDrawer.audio.test.tsx test #6.
// The red-dot contract only applied to "coming soon" stubs and no longer fits this control.

describe('Disabled-control marker audit — Audio Upload removed (F9)', () => {
  it('B1 row has no Upload button (F9 removal)', () => {
    render(<AudioWrapper item={makeItem()} />);

    const rows = document.querySelectorAll('.audio-row');
    const b1Row = rows[0];
    // F9: Upload removed — only one disabled button (Regenerate) per row.
    const disabledBtns = b1Row.querySelectorAll('button[aria-disabled="true"]');
    expect(disabledBtns.length).toBe(1);
    // The remaining disabled button must be Regenerate (has visible text, no aria-label).
    const regenBtn = disabledBtns[0];
    expect(regenBtn.getAttribute('aria-label')).toBeNull();
  });

  it('A2 row has no Upload button (F9 removal)', () => {
    render(<AudioWrapper item={makeItem()} />);

    const rows = document.querySelectorAll('.audio-row');
    const a2Row = rows[1];
    const disabledBtns = a2Row.querySelectorAll('button[aria-disabled="true"]');
    expect(disabledBtns.length).toBe(1);
    const regenBtn = disabledBtns[0];
    expect(regenBtn.getAttribute('aria-label')).toBeNull();
  });
});

describe('Disabled-control marker audit — Linked-situation Generate (empty state)', () => {
  it('Generate situation: has red-dot marker + tooltip trigger + is disabled', () => {
    const item = makeItem();
    render(
      <MemoryRouter>
        <NewsEditDrawerLinkedSituation item={item} linkedSituation={null} />
      </MemoryRouter>
    );

    const btn = screen.getByRole('button', { name: /Generate situation from this article/i });
    assertDisabledControlContract(btn, 'Generate situation');
  });
});

describe('Disabled-control marker audit — Unlink + Regenerate-from-article (footer)', () => {
  it('Unlink: has red-dot marker + tooltip trigger + is disabled', () => {
    const item = makeItem();
    render(
      <MemoryRouter>
        <NewsEditDrawerLinkedSituation item={item} linkedSituation={null} />
      </MemoryRouter>
    );

    const btn = screen.getByRole('button', { name: /Unlink/i });
    assertDisabledControlContract(btn, 'Unlink');
  });

  it('Regenerate from this article: has red-dot marker + tooltip trigger + is disabled', () => {
    const item = makeItem();
    render(
      <MemoryRouter>
        <NewsEditDrawerLinkedSituation item={item} linkedSituation={null} />
      </MemoryRouter>
    );

    const btn = screen.getByRole('button', { name: /Regenerate from this article/i });
    assertDisabledControlContract(btn, 'Regenerate from this article');
  });
});
