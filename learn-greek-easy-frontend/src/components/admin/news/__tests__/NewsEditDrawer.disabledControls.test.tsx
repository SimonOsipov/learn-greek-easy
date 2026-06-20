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
//   - Audio Regenerate ×2 — B1 + A2 (NewsEditDrawer.audio.tsx)
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

describe('Disabled-control marker audit — Regenerate translations (NewsEditDrawer header)', () => {
  it('Regenerate translations: has red-dot marker + tooltip trigger + is disabled', () => {
    const item = makeItem();
    storeState.drawerItemId = item.id;
    storeState.newsItems = [item];

    renderDrawer();

    // ADMIN2-39 F9.1: "Regenerate translations" now lives in the footer action row
    // (relocated out of the tab row); the contract is unchanged wherever it renders.
    const btn = screen.getByRole('button', { name: /Regenerate translations/i });
    assertDisabledControlContract(btn, 'Regenerate translations');
  });

  // ADMIN2-39 F9.1 (QA edge): AC-1 — the relocation outcome itself.
  // The existing contract test above passes regardless of WHERE the button lives, so
  // it cannot catch a regression that puts Regenerate-translations back in the tab row.
  // This guard pins the button OUT of the tab row (.drawer-tabs) and INTO the footer
  // (.drawer-foot), with the disabled-control contract still intact.
  it('Regenerate translations: lives in the footer, NOT in the tab row (F9.1)', () => {
    const item = makeItem();
    storeState.drawerItemId = item.id;
    storeState.newsItems = [item];

    renderDrawer();

    const btn = screen.getByRole('button', { name: /Regenerate translations/i });

    // SidePanel renders inside a Dialog portal mounted on document.body, so query the
    // document rather than the render container.
    const tabRow = document.querySelector('.drawer-tabs');
    const footer = document.querySelector('.drawer-foot');
    expect(tabRow, 'tab row (.drawer-tabs) must exist').not.toBeNull();
    expect(footer, 'footer (.drawer-foot) must exist').not.toBeNull();

    // Outcome of F9.1: button moved out of the tab row, into the footer.
    expect(tabRow!.contains(btn), 'Regenerate translations must NOT be inside the tab row').toBe(
      false
    );
    expect(footer!.contains(btn), 'Regenerate translations must be inside the footer').toBe(true);

    // The tab row contains tabs only — no disabled stub controls.
    expect(
      tabRow!.querySelector('button[aria-disabled="true"]'),
      'tab row must contain tabs only (no disabled stub controls)'
    ).toBeNull();

    // Relocated button still satisfies the full disabled-control contract.
    assertDisabledControlContract(btn, 'Regenerate translations (footer)');
  });
});

describe('Disabled-control marker audit — Audio Regenerate ×2 (NewsEditDrawer.audio)', () => {
  it('B1 Regenerate audio: has red-dot marker + tooltip trigger + is disabled', () => {
    render(<AudioWrapper item={makeItem()} />);

    const rows = document.querySelectorAll('.audio-row');
    expect(rows.length).toBeGreaterThanOrEqual(2);

    const b1Row = rows[0];
    const regenBtn = b1Row.querySelector('button[aria-disabled="true"]');
    expect(regenBtn, 'B1 Regenerate: button not found').not.toBeNull();
    assertDisabledControlContract(regenBtn!, 'Audio Regenerate (B1)');
  });

  it('A2 Regenerate audio: has red-dot marker + tooltip trigger + is disabled', () => {
    render(<AudioWrapper item={makeItem()} />);

    const rows = document.querySelectorAll('.audio-row');
    const a2Row = rows[1];
    const regenBtn = a2Row.querySelector('button[aria-disabled="true"]');
    expect(regenBtn, 'A2 Regenerate: button not found').not.toBeNull();
    assertDisabledControlContract(regenBtn!, 'Audio Regenerate (A2)');
  });
});

describe('Disabled-control marker audit — Audio Upload ×2 (NewsEditDrawer.audio)', () => {
  it('B1 Upload audio: has red-dot marker + tooltip trigger + is disabled', () => {
    render(<AudioWrapper item={makeItem()} />);

    const rows = document.querySelectorAll('.audio-row');
    const b1Row = rows[0];
    // Upload button is the icon-btn in the audio-actions area.
    const uploadBtns = b1Row.querySelectorAll('button[aria-disabled="true"]');
    // There are 2 disabled buttons per row: Regenerate + Upload.
    const uploadBtn = uploadBtns[1]; // second disabled btn is the upload icon-btn
    expect(uploadBtn, 'B1 Upload: button not found').toBeDefined();
    assertDisabledControlContract(uploadBtn, 'Audio Upload (B1)');
  });

  it('A2 Upload audio: has red-dot marker + tooltip trigger + is disabled', () => {
    render(<AudioWrapper item={makeItem()} />);

    const rows = document.querySelectorAll('.audio-row');
    const a2Row = rows[1];
    const uploadBtns = a2Row.querySelectorAll('button[aria-disabled="true"]');
    const uploadBtn = uploadBtns[1];
    expect(uploadBtn, 'A2 Upload: button not found').toBeDefined();
    assertDisabledControlContract(uploadBtn, 'Audio Upload (A2)');
  });

  // ADMIN2-39 F9.2 (QA edge): the icon-only upload Button must carry a non-empty,
  // resolved accessible name (the a11y gap the sweep closed via news.drawer.audio.uploadLabel).
  // Asserts the {{level}} interpolation actually resolved (no leftover key / empty label).
  it('Upload audio: icon-only button exposes a resolved, level-specific accessible name', () => {
    render(<AudioWrapper item={makeItem()} />);

    const rows = document.querySelectorAll('.audio-row');
    const levels = ['B1', 'A2'];
    rows.forEach((row, i) => {
      const uploadBtn = row.querySelector<HTMLButtonElement>(
        'button[aria-disabled="true"][aria-label]'
      );
      expect(uploadBtn, `${levels[i]} Upload: aria-labelled button not found`).not.toBeNull();
      const label = uploadBtn!.getAttribute('aria-label') ?? '';
      expect(
        label.trim().length,
        `${levels[i]} Upload: aria-label must be non-empty`
      ).toBeGreaterThan(0);
      // i18n key must have resolved (not the raw dotted key) and include the level token value.
      expect(label).not.toContain('uploadLabel');
      expect(label).toContain(levels[i]);
    });
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
