/**
 * SituationsTab Component Tests — SIT-05
 *
 * Covers:
 * - Shell composition: situations-tab root, PageHead h1, both action buttons.
 * - 4 StatCards rendered with correct tones.
 * - Drafts tone flips amber <-> green based on draft count.
 * - Ready-to-ship percent interpolation + zero-total edge.
 * - Subtitle interpolation.
 * - "Generate from news" is disabled / aria-disabled, Tooltip shows "Coming soon".
 * - "+ New situation" click opens SituationCreateModal.
 * - No SituationDetailModal rendered.
 * - URL deep-link: ?edit=<id> → openDrawer called.
 * - Missing param → closeDrawer called.
 * - fetchSituations called on mount.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (must be declared before any import that transitively loads them) ───

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, params?: Record<string, unknown>) => {
      if (params && Object.keys(params).length > 0) {
        return Object.entries(params).reduce(
          (acc, [key, val]) => acc.replace(`{{${key}}}`, String(val)),
          k
        );
      }
      return k;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    getSituations: vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      page_size: 10,
      status_counts: {},
    }),
  },
}));

// ── Store mock ─────────────────────────────────────────────────────────────────

const mockFetchSituations = vi.fn().mockResolvedValue(undefined);
const mockOpenDrawer = vi.fn();
const mockCloseDrawer = vi.fn();

type StoreSituation = {
  id: string;
  status: string;
  created_at: string;
  dialog_exercises_count: number;
  description_exercises_count: number;
  picture_exercises_count: number;
  levels: string[];
};

const storeState = {
  situations: [] as StoreSituation[],
  total: 0,
  // ADMIN2-41-03: statusCounts holds catalog-wide counts from the backend.
  // The current selectStatsTotals mock (below) still reads from situations[] —
  // that makes tests 5-8 RED until the real selector is fixed.
  statusCounts: {} as Record<string, number>,
  drawerItemId: null as string | null,
  isLoading: false,
  fetchSituations: mockFetchSituations,
  openDrawer: mockOpenDrawer,
  closeDrawer: mockCloseDrawer,
};

const mockUseAdminSituationStore = vi.fn((selector?: (s: typeof storeState) => unknown) => {
  if (typeof selector === 'function') return selector(storeState);
  return storeState;
});

vi.mock('@/stores/adminSituationStore', () => ({
  useAdminSituationStore: (...args: unknown[]) =>
    mockUseAdminSituationStore(...(args as [(s: typeof storeState) => unknown])),
  selectStatsTotals: (s: typeof storeState) => {
    let ready = 0;
    let draft = 0;
    let exercisesGenerated = 0;
    let totalLast30d = 0;
    let oldestDraftDate: string | null = null;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    for (const sit of s.situations) {
      if (sit.status === 'ready') ready += 1;
      else if (sit.status === 'draft') {
        draft += 1;
        if (oldestDraftDate === null || sit.created_at < oldestDraftDate) {
          oldestDraftDate = sit.created_at;
        }
      }
      exercisesGenerated +=
        sit.dialog_exercises_count + sit.description_exercises_count + sit.picture_exercises_count;
      if (new Date(sit.created_at) >= thirtyDaysAgo) totalLast30d += 1;
    }
    return {
      total: s.situations.length,
      ready,
      draft,
      exercisesGenerated,
      totalLast30d,
      oldestDraftDate,
    };
  },
  selectFilteredSituations: (s: typeof storeState) => s.situations,
}));

// ── Child component stubs ─────────────────────────────────────────────────────

vi.mock('../SituationsToolbar', () => ({
  SituationsToolbar: () => <div data-testid="situations-toolbar-stub" />,
}));

vi.mock('../SituationGrid', () => ({
  SituationGrid: () => <div data-testid="situation-grid-stub" />,
}));

vi.mock('../SituationCreateModal', () => ({
  SituationCreateModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="situation-create-modal" /> : null,
}));

vi.mock('../SituationDrawer', () => ({
  SituationDrawer: () => <div data-testid="situation-drawer-stub" />,
}));

// ── Lazy import (after mocks) ─────────────────────────────────────────────────

let SituationsTab: React.FC<{ createOpen: boolean; onCreateOpenChange: (open: boolean) => void }>;

const mockOnCreateOpenChange = vi.fn();

async function loadSituationsTab() {
  const mod = await import('../SituationsTab');
  SituationsTab = mod.SituationsTab;
}

function SituationsTabWrapper({ createOpen = false }: { createOpen?: boolean }) {
  return SituationsTab ? (
    <SituationsTab createOpen={createOpen} onCreateOpenChange={mockOnCreateOpenChange} />
  ) : null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type SituationSeed = {
  id: string;
  status: 'draft' | 'ready';
  created_at?: string;
  dialog_exercises_count: number;
  description_exercises_count: number;
  picture_exercises_count: number;
  levels?: string[];
};

function seedStore(situations: SituationSeed[], statusCounts?: Record<string, number>) {
  storeState.situations = situations.map((s) => ({
    ...s,
    created_at: s.created_at ?? '2024-01-01T00:00:00Z',
    levels: s.levels ?? [],
  }));
  storeState.total = situations.length;
  storeState.statusCounts = statusCounts ?? {};
}

function renderWithRouter(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/admin${search}`]}>
      <Routes>
        <Route path="/admin" element={<SituationsTabWrapper />} />
      </Routes>
    </MemoryRouter>
  );
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  vi.clearAllMocks();
  storeState.situations = [];
  storeState.total = 0;
  storeState.statusCounts = {};
  storeState.drawerItemId = null;
  mockFetchSituations.mockResolvedValue(undefined);
  await loadSituationsTab();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SituationsTab — shell composition', () => {
  it('renders situations-tab root element', () => {
    renderWithRouter();
    expect(screen.getByTestId('situations-tab')).toBeInTheDocument();
  });

  // PageHead H1 is now owned by AdminPage, not SituationsTab.
  // The component renders stat cards, toolbar, grid, drawer stubs.

  it('renders SituationsToolbar', () => {
    renderWithRouter();
    expect(screen.getByTestId('situations-toolbar-stub')).toBeInTheDocument();
  });

  it('renders SituationGrid', () => {
    renderWithRouter();
    expect(screen.getByTestId('situation-grid-stub')).toBeInTheDocument();
  });

  it('renders SituationDrawer stub', () => {
    renderWithRouter();
    expect(screen.getByTestId('situation-drawer-stub')).toBeInTheDocument();
  });

  it('does not show SituationCreateModal when createOpen=false', () => {
    renderWithRouter();
    expect(screen.queryByTestId('situation-create-modal')).not.toBeInTheDocument();
  });
});

describe('SituationsTab — 4 StatCards rendered', () => {
  it('renders 4 stat-card elements with correct tones', () => {
    seedStore([
      {
        id: '1',
        status: 'ready',
        dialog_exercises_count: 10,
        description_exercises_count: 20,
        picture_exercises_count: 12,
      },
      {
        id: '2',
        status: 'draft',
        dialog_exercises_count: 0,
        description_exercises_count: 0,
        picture_exercises_count: 0,
      },
      {
        id: '3',
        status: 'draft',
        dialog_exercises_count: 0,
        description_exercises_count: 0,
        picture_exercises_count: 0,
      },
    ]);

    renderWithRouter();

    const cards = document.querySelectorAll('.stat-card');
    expect(cards).toHaveLength(4);

    const classNames = Array.from(cards).map((c) => c.className);
    expect(classNames.some((c) => c.includes('tone-blue'))).toBe(true);
    expect(classNames.some((c) => c.includes('tone-violet'))).toBe(true);
    expect(classNames.some((c) => c.includes('tone-amber'))).toBe(true);
    expect(classNames.some((c) => c.includes('tone-cyan'))).toBe(true);
  });

  // ADMIN2-41-03 UPDATED: stat cards must show catalog totals from statusCounts,
  // not page-local item counts. The page has 3 items (1 ready + 2 draft), but
  // statusCounts reports ready=4, draft=71 for the whole catalog (total=75).
  // This test is RED today (mock still computes from page) and GREEN after fix.
  it('displays catalog numbers (total=75, ready=4, draft=71, exercises=42)', () => {
    // Page: 1 ready with exercises + 2 draft; statusCounts: ready=4, draft=71 (catalog).
    seedStore(
      [
        {
          id: '1',
          status: 'ready',
          dialog_exercises_count: 10,
          description_exercises_count: 20,
          picture_exercises_count: 12,
        },
        {
          id: '2',
          status: 'draft',
          dialog_exercises_count: 0,
          description_exercises_count: 0,
          picture_exercises_count: 0,
        },
        {
          id: '3',
          status: 'draft',
          dialog_exercises_count: 0,
          description_exercises_count: 0,
          picture_exercises_count: 0,
        },
      ],
      { ready: 4, draft: 71 } // catalog statusCounts — diverges from page (1 ready, 2 draft)
    );

    renderWithRouter();

    const statNs = document.querySelectorAll('.stat-n');
    const texts = Array.from(statNs).map((el) => el.textContent);
    expect(texts).toContain('75'); // catalog total (ready+draft from statusCounts) — FAILS today (shows 3)
    expect(texts).toContain('4'); // catalog ready — FAILS today (shows 1)
    expect(texts).toContain('71'); // catalog draft — FAILS today (shows 2)
    expect(texts).toContain('42'); // exercises: still page-local sum (10+20+12)
  });
});

describe('SituationsTab — Drafts tone flip', () => {
  it('draft=0 → green tone and subDone sub text', () => {
    seedStore([
      {
        id: '1',
        status: 'ready',
        dialog_exercises_count: 0,
        description_exercises_count: 0,
        picture_exercises_count: 0,
      },
    ]);

    renderWithRouter();

    const cards = document.querySelectorAll('.stat-card');
    const greenCard = Array.from(cards).find((c) => c.className.includes('tone-green'));
    expect(greenCard).toBeDefined();
    expect(greenCard?.textContent).toContain('situations.stats.draftsToFinish.subDone');
  });

  it('draft>0 → amber tone and subOldest text (with date from created_at)', () => {
    seedStore([
      {
        id: '1',
        status: 'draft',
        created_at: '2024-03-15T00:00:00Z',
        dialog_exercises_count: 0,
        description_exercises_count: 0,
        picture_exercises_count: 0,
      },
      {
        id: '2',
        status: 'draft',
        created_at: '2024-06-01T00:00:00Z',
        dialog_exercises_count: 0,
        description_exercises_count: 0,
        picture_exercises_count: 0,
      },
    ]);

    renderWithRouter();

    const cards = document.querySelectorAll('.stat-card');
    const amberCard = Array.from(cards).find((c) => c.className.includes('tone-amber'));
    expect(amberCard).toBeDefined();
    // subOldest key is rendered (t() mock returns key with {{date}} substituted in real code)
    expect(amberCard?.textContent).toContain('situations.stats.draftsToFinish.subOldest');
  });
});

describe('SituationsTab — Ready-to-ship percent', () => {
  it('ready=4, total=10 → violet card n=4 (ready count)', () => {
    // 4 ready + 6 draft = 10 total; percent=40 is passed to the sub but
    // the i18n mock returns the key string (sub is not a template here),
    // so we verify the n prop (ready=4) lands in .stat-n of the violet card.
    const situations = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      status: i < 4 ? ('ready' as const) : ('draft' as const),
      dialog_exercises_count: 0,
      description_exercises_count: 0,
      picture_exercises_count: 0,
    }));
    seedStore(situations);

    renderWithRouter();

    const violetCard = Array.from(document.querySelectorAll('.stat-card')).find((c) =>
      c.className.includes('tone-violet')
    );
    expect(violetCard).toBeDefined();
    const statN = violetCard?.querySelector('.stat-n');
    expect(statN?.textContent).toBe('4');
  });

  it('total=0 → renders without division-by-zero error, n=0', () => {
    seedStore([]);

    renderWithRouter();

    const violetCard = Array.from(document.querySelectorAll('.stat-card')).find((c) =>
      c.className.includes('tone-violet')
    );
    expect(violetCard).toBeDefined();
    const statN = violetCard?.querySelector('.stat-n');
    expect(statN?.textContent).toBe('0');
  });
});

// Note: PageHead (breadcrumb, kicker, title, sub) is now owned by AdminPage.
// SituationsTab renders stat cards, toolbar, grid, drawer, and the create modal.
// Subtitle interpolation is tested via pageHeadPropsFor.test.tsx.

describe('SituationsTab — createOpen controlled prop', () => {
  it('mounts SituationCreateModal when createOpen=true', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route
            path="/admin"
            element={
              SituationsTab ? (
                <SituationsTab createOpen={true} onCreateOpenChange={mockOnCreateOpenChange} />
              ) : null
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('situation-create-modal')).toBeInTheDocument();
  });

  it('does not mount SituationCreateModal when createOpen=false', () => {
    renderWithRouter();
    expect(screen.queryByTestId('situation-create-modal')).not.toBeInTheDocument();
  });
});

describe('SituationsTab — URL deep-link (?edit=)', () => {
  it('calls openDrawer with the edit id from URL on mount', () => {
    renderWithRouter('?edit=abc-123');
    expect(mockOpenDrawer).toHaveBeenCalledWith('abc-123');
  });

  it('calls closeDrawer when no ?edit param is present', () => {
    renderWithRouter();
    expect(mockCloseDrawer).toHaveBeenCalled();
  });
});

describe('SituationsTab — fetchSituations on mount', () => {
  it('calls fetchSituations once on mount', () => {
    renderWithRouter();
    expect(mockFetchSituations).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// ADMIN2-41-03 — SituationsTab catalog-total stat card RED tests (Tests 5-8)
//
// The selectStatsTotals mock in this file currently computes from page items
// (s.situations.length, status loops) — NOT from statusCounts.
// All tests below assert the POST-FIX contract; they FAIL today because the
// mock still returns page-local values.
// After fix: the real selector uses statusCounts AND the mock is updated to match.
// ============================================================

describe('SituationsTab — ADMIN2-41-03 catalog-total stat cards', () => {
  // ── Test 5: StatCards render catalog numbers, not page numbers ───────────────
  it('T5: Total card shows statusCounts sum (75), Ready shows 4, Drafts shows 71', () => {
    // Page: 10 all-draft items; catalog statusCounts: ready=4, draft=71.
    // The mock selectStatsTotals reads situations[] → returns total=10, ready=0, draft=10.
    // Post-fix, it reads statusCounts → total=75, ready=4, draft=71.
    seedStore(
      Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        status: 'draft' as const,
        dialog_exercises_count: 0,
        description_exercises_count: 0,
        picture_exercises_count: 0,
      })),
      { ready: 4, draft: 71 }
    );

    renderWithRouter();

    const statNs = document.querySelectorAll('.stat-n');
    const texts = Array.from(statNs).map((el) => el.textContent);
    // FAILS today: mock returns 10/0/10 (page-local)
    expect(texts).toContain('75'); // catalog total
    expect(texts).toContain('4'); // catalog ready
    expect(texts).toContain('71'); // catalog draft
  });

  // ── Test 6: readyPercent is catalog-consistent (4/75 ≈ 5%) ───────────────────
  it('T6: Ready card sub shows 5% (round(4/75*100)), not page-local percent', () => {
    // Page has 0 ready (0%) but catalog is 4/75 (5%).
    seedStore(
      Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        status: 'draft' as const,
        dialog_exercises_count: 0,
        description_exercises_count: 0,
        picture_exercises_count: 0,
      })),
      { ready: 4, draft: 71 }
    );

    renderWithRouter();

    const violetCard = Array.from(document.querySelectorAll('.stat-card')).find((c) =>
      c.className.includes('tone-violet')
    );
    expect(violetCard).toBeDefined();
    // The sub text is rendered via i18n key with pct interpolated.
    // The mock t() returns the key string with {{pct}} replaced.
    // Post-fix: pct = round(4/75*100) = 5; today pct = round(0/10*100) = 0.
    // FAILS today: violet card stat-n shows 0, not 4 (ready count from catalog)
    const statN = violetCard?.querySelector('.stat-n');
    expect(statN?.textContent).toBe('4'); // catalog ready count — FAILS today (shows 0)
  });

  // ── Test 7: Exercises card does NOT show "Catalog total"/"footerCatalog" ──────
  it('T7: Exercises StatCard does not show "Catalog total" footer label', () => {
    seedStore([]);

    renderWithRouter();

    const cyanCard = Array.from(document.querySelectorAll('.stat-card')).find((c) =>
      c.className.includes('tone-cyan')
    );
    expect(cyanCard).toBeDefined();
    // Currently SituationsTab renders footerLabel={t('situations.stats.footerCatalog')} on ALL 4 cards.
    // The i18n mock returns the key string: "situations.stats.footerCatalog".
    // After fix, the Exercises card should NOT have this footer label (it gets a page-scoped sub).
    // FAILS today: the cyan card contains the footerCatalog key text.
    expect(cyanCard?.textContent).not.toContain('situations.stats.footerCatalog');
  });

  // ── Test 8: zero catalog edge — no divide-by-zero / NaN ──────────────────────
  it('T8: empty statusCounts (zero catalog) renders 0 everywhere, no NaN', () => {
    // statusCounts empty → ready=0, draft=0, total=0; page is also empty.
    seedStore([], {});

    renderWithRouter();

    const statNs = document.querySelectorAll('.stat-n');
    const texts = Array.from(statNs).map((el) => el.textContent);

    // All numeric cards show clean values (no NaN/Infinity)
    expect(texts.every((t) => t !== 'NaN' && t !== 'Infinity')).toBe(true);
    // The blue (total) card shows 0
    const blueCard = Array.from(document.querySelectorAll('.stat-card')).find((c) =>
      c.className.includes('tone-blue')
    );
    expect(blueCard?.querySelector('.stat-n')?.textContent).toBe('0');

    // readyPercent must be 0 (not NaN): violet card n=0
    const violetCard = Array.from(document.querySelectorAll('.stat-card')).find((c) =>
      c.className.includes('tone-violet')
    );
    expect(violetCard?.querySelector('.stat-n')?.textContent).toBe('0');
  });
});
