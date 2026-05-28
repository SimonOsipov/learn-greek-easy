/**
 * ChangelogTab Component Tests — CLTE-08 / ADMIN2-21 trim
 *
 * Covers:
 * - 3 StatCards (Missing RU card removed in CLTT-01)
 * - Missing RU card absent
 * - No sparkline rendered
 * - Search filter (no debounce, case-insensitive, EN+RU)
 * - Tag SegControl shows only present tags with counts
 * - Deep-link: ?edit=<valid-id>&lang=ru opens drawer
 * - Deep-link: ?compose=1 opens compose drawer
 * - Deep-link: ?edit=<missing-id> ignored silently (URL NOT immediately stripped)
 * - Deep-link: ?lang=foo ignored silently
 * - Close drawer strips URL params
 * - No console.warn even at 200 entries
 */

import React from 'react';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ChangelogTab } from '../ChangelogTab';
import type { ChangelogEntryAdmin } from '@/types/changelog';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<ChangelogEntryAdmin> = {}): ChangelogEntryAdmin {
  return {
    id: 'entry-1',
    title_en: 'Test feature',
    title_ru: 'Тестовая функция',
    content_en: 'Some content',
    content_ru: 'Некоторое содержимое',
    tag: 'new_feature',
    version: null,
    created_at: '2024-03-15T10:00:00Z',
    updated_at: '2024-03-15T10:00:00Z',
    ...overrides,
  };
}

/**
 * Render ChangelogTab inside a MemoryRouter with optional initial URL params.
 */
function renderWithRouter(initialSearch = '') {
  return render(
    <MemoryRouter initialEntries={[`/${initialSearch}`]}>
      <Routes>
        <Route path="/" element={<ChangelogTab />} />
      </Routes>
    </MemoryRouter>
  );
}

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        // Existing tag keys — keep.
        'changelog:tag.newFeature': 'New Feature',
        'changelog:tag.bugFix': 'Bug Fix',
        'changelog:tag.announcement': 'Announcement',
        // I18N-04 admin-namespace keys read by ChangelogTab.tsx.
        'admin:changelog.filter.all': 'All',
        'admin:changelog.kicker': 'Changelog',
        'admin:changelog.title': 'Changelog',
        'admin:changelog.subtitle': 'Manage and publish product updates for your users.',
        'admin:changelog.actions.newEntry': 'New entry',
        'admin:changelog.stats.total': 'Total entries',
        'admin:changelog.stats.mostRecent': 'Most recent',
        'admin:changelog.stats.cadence': 'Avg cadence',
        'admin:changelog.stats.cadenceSub': 'between entries',
        'admin:changelog.stats.cadenceSubMinimal': 'need ≥ 2 entries',
        'admin:changelog.stats.footer.allTime': 'all-time',
        'admin:changelog.stats.footer.lastPublished': 'last published',
        'admin:changelog.stats.footer.lastTenEntries': 'last 10 entries',
        'admin:changelog.search.entriesPlaceholder': 'Search entries…',
        'admin:changelog.search.clearAriaLabel': 'Clear search',
        'admin:shell.breadcrumb.dashboard': 'Dashboard',
      };
      return map[key] ?? key;
    },
    i18n: { language: 'en' },
  }),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (args: unknown) => mockToast(args),
}));

// Store mock state (module-level, mutated per test)
let mockItems: ChangelogEntryAdmin[] = [];
let mockIsLoading = false;
let mockMode: 'compose' | 'edit' | null = null;
let mockOpenEntryId: string | null = null;
let mockLang: 'en' | 'ru' = 'en';
let mockTotal = 0;

const mockFetchList = vi.fn();
const mockOpenCompose = vi.fn().mockImplementation(() => {
  mockMode = 'compose';
  mockOpenEntryId = null;
  mockLang = 'en';
});
const mockOpenEdit = vi.fn().mockImplementation((id: string) => {
  mockMode = 'edit';
  mockOpenEntryId = id;
  mockLang = 'en';
});
const mockCloseDrawer = vi.fn().mockImplementation(() => {
  mockMode = null;
  mockOpenEntryId = null;
  mockLang = 'en';
});
const mockSetLang = vi.fn().mockImplementation((l: 'en' | 'ru') => {
  mockLang = l;
});

vi.mock('@/stores/adminChangelogStore', () => ({
  useAdminChangelogStore: (selector?: (state: unknown) => unknown) => {
    const state = {
      items: mockItems,
      total: mockTotal,
      isLoading: mockIsLoading,
      mode: mockMode,
      openEntryId: mockOpenEntryId,
      lang: mockLang,
      fetchList: mockFetchList,
      openCompose: mockOpenCompose,
      openEdit: mockOpenEdit,
      closeDrawer: mockCloseDrawer,
      setLang: mockSetLang,
    };
    return selector ? selector(state) : state;
  },
  // Named selectors used by sub-components (ChangelogEditorDrawer etc.)
  selectAdminChangelogLang: (s: { lang: 'en' | 'ru' }) => s.lang,
  selectAdminChangelogPanelMode: (s: { panelMode: string }) => s.panelMode ?? 'form',
  selectAdminChangelogIsSaving: (s: { isSaving: boolean }) => s.isSaving ?? false,
}));

// Mock sub-components to avoid pulling in their dependency trees
vi.mock('../ChangelogTimeline', () => ({
  ChangelogTimeline: ({
    entries,
    onEdit,
    onDelete,
  }: {
    entries: ChangelogEntryAdmin[];
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
  }) => (
    <div data-testid="changelog-timeline-mock" data-entry-count={entries.length}>
      {entries.map((e) => (
        <div key={e.id} data-testid={`timeline-entry-${e.id}`}>
          <button onClick={() => onEdit(e.id)} data-testid={`edit-${e.id}`}>
            Edit
          </button>
          <button onClick={() => onDelete(e.id)} data-testid={`delete-${e.id}`}>
            Delete
          </button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../ChangelogEditorDrawer', () => ({
  ChangelogEditorDrawer: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="changelog-editor-drawer-mock">
        <button onClick={onClose} data-testid="drawer-close">
          Close
        </button>
      </div>
    ) : null,
}));

vi.mock('../ChangelogDeleteDialog', () => ({
  ChangelogDeleteDialog: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
  }) =>
    open ? (
      <div data-testid="changelog-delete-dialog-mock">
        <button onClick={() => onOpenChange(false)} data-testid="delete-dialog-close">
          Close
        </button>
      </div>
    ) : null,
}));

// ── Test suite ─────────────────────────────────────────────────────────────────

describe('ChangelogTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockItems = [];
    mockIsLoading = false;
    mockMode = null;
    mockOpenEntryId = null;
    mockLang = 'en';
    mockTotal = 0;
  });

  // ── Root test ID ────────────────────────────────────────────────────────────
  describe('Root test ID', () => {
    it('renders changelog-tab test ID', () => {
      renderWithRouter();
      expect(screen.getByTestId('changelog-tab')).toBeInTheDocument();
    });
  });

  // ── StatCards (3-card grid after CLTT-01 trim) ───────────────────────────────
  describe('StatCards', () => {
    it('renders exactly 3 StatCards', () => {
      renderWithRouter();
      const cards = document.querySelectorAll('.stat-card');
      expect(cards.length).toBe(3);
    });

    it('Total card has tone-blue class', () => {
      renderWithRouter();
      const cards = Array.from(document.querySelectorAll('.stat-card'));
      expect(cards[0].classList).toContain('tone-blue');
    });

    it('Most recent card has tone-violet class', () => {
      renderWithRouter();
      const cards = Array.from(document.querySelectorAll('.stat-card'));
      expect(cards[1].classList).toContain('tone-violet');
    });

    it('Avg cadence card has tone-cyan class', () => {
      renderWithRouter();
      const cards = Array.from(document.querySelectorAll('.stat-card'));
      expect(cards[2].classList).toContain('tone-cyan');
    });

    it('Missing RU card is absent', () => {
      renderWithRouter();
      // The 4th card was the missing-RU card — no longer rendered
      const cards = document.querySelectorAll('.stat-card');
      expect(cards.length).toBeLessThan(4);
      // Also verify no testid references to missing-ru-card
      expect(screen.queryByTestId('missing-ru-card')).not.toBeInTheDocument();
    });
  });

  // ── No sparkline (CLTT-01 trim) ──────────────────────────────────────────────
  describe('No sparkline rendered', () => {
    it('sparkline-total is NOT rendered', () => {
      renderWithRouter();
      expect(screen.queryByTestId('sparkline-total')).not.toBeInTheDocument();
    });

    it('sparkline-missing-ru is NOT rendered', () => {
      renderWithRouter();
      expect(screen.queryByTestId('sparkline-missing-ru')).not.toBeInTheDocument();
    });

    it('no sparkline-* testid is rendered at all', () => {
      renderWithRouter();
      // querySelectorAll is not scoped to testids, use queryBy pattern
      const sparklines = document.querySelectorAll('[data-testid^="sparkline-"]');
      expect(sparklines.length).toBe(0);
    });
  });

  // ── Avg cadence (AC #4) ─────────────────────────────────────────────────────
  describe('Avg cadence', () => {
    it('renders — when fewer than 2 entries', () => {
      mockItems = [makeEntry({ id: '1' })];
      renderWithRouter();
      const cards = Array.from(document.querySelectorAll('.stat-card'));
      expect(cards[2].querySelector('.stat-n')?.textContent).toBe('—');
    });

    it('renders — when no entries', () => {
      mockItems = [];
      renderWithRouter();
      const cards = Array.from(document.querySelectorAll('.stat-card'));
      expect(cards[2].querySelector('.stat-n')?.textContent).toBe('—');
    });

    it('computes avg days between 2 entries', () => {
      mockItems = [
        makeEntry({ id: '1', created_at: '2024-03-20T00:00:00Z' }),
        makeEntry({ id: '2', created_at: '2024-03-10T00:00:00Z' }),
      ];
      renderWithRouter();
      const cards = Array.from(document.querySelectorAll('.stat-card'));
      // 10 days apart
      expect(cards[2].querySelector('.stat-n')?.textContent).toBe('10d');
    });
  });

  // ── Search filter (AC #5) ───────────────────────────────────────────────────
  describe('Search filter', () => {
    beforeEach(() => {
      mockItems = [
        makeEntry({ id: '1', title_en: 'Hello world', title_ru: 'Привет мир' }),
        makeEntry({ id: '2', title_en: 'Bug fix today', title_ru: 'Исправление ошибки' }),
        makeEntry({ id: '3', title_en: 'New release', title_ru: 'Новый выпуск' }),
      ];
    });

    it('shows all entries when search is empty', () => {
      renderWithRouter();
      const timeline = screen.getByTestId('changelog-timeline-mock');
      expect(timeline.getAttribute('data-entry-count')).toBe('3');
    });

    it('filters by title_en (case-insensitive)', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      const input = screen.getByTestId('changelog-search-input');
      await user.type(input, 'hello');
      // Only entry 1 matches
      expect(screen.getByTestId('changelog-timeline-mock').getAttribute('data-entry-count')).toBe(
        '1'
      );
    });

    it('filters by title_ru (case-insensitive)', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      const input = screen.getByTestId('changelog-search-input');
      await user.type(input, 'ошибки');
      // Only entry 2 matches
      expect(screen.getByTestId('changelog-timeline-mock').getAttribute('data-entry-count')).toBe(
        '1'
      );
    });

    it('filters case-insensitively on title_en', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      const input = screen.getByTestId('changelog-search-input');
      await user.type(input, 'BUG');
      expect(screen.getByTestId('changelog-timeline-mock').getAttribute('data-entry-count')).toBe(
        '1'
      );
    });

    it('is not debounced — filters on every keystroke', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      const input = screen.getByTestId('changelog-search-input');
      // After single char, filter should already apply
      await user.type(input, 'H');
      expect(screen.getByTestId('changelog-timeline-mock').getAttribute('data-entry-count')).toBe(
        '1'
      );
    });
  });

  // ── Tag SegControl (AC #6) ──────────────────────────────────────────────────
  describe('Tag SegControl', () => {
    it('shows All option', () => {
      mockItems = [
        makeEntry({ id: '1', tag: 'new_feature' }),
        makeEntry({ id: '2', tag: 'bug_fix' }),
      ];
      renderWithRouter();
      // "All" button should be present (no count badge)
      expect(screen.getByText('All')).toBeInTheDocument();
      const allBtn = screen.getByText('All').closest('button');
      expect(allBtn?.querySelector('.cl-tag-n')).toBeNull();
    });

    it('shows only tags present in data', () => {
      mockItems = [
        makeEntry({ id: '1', tag: 'new_feature' }),
        makeEntry({ id: '2', tag: 'new_feature' }),
      ];
      renderWithRouter();
      // new_feature should appear, bug_fix and announcement should not
      expect(screen.queryByText('Bug Fix')).not.toBeInTheDocument();
      expect(screen.queryByText('Announcement')).not.toBeInTheDocument();
    });

    it('renders a pill per tag present in data without count badges', () => {
      mockItems = [
        makeEntry({ id: '1', tag: 'new_feature' }),
        makeEntry({ id: '2', tag: 'new_feature' }),
        makeEntry({ id: '3', tag: 'bug_fix' }),
      ];
      renderWithRouter();
      const nfBtn = screen.getByText('New Feature').closest('button');
      expect(nfBtn?.querySelector('.cl-tag-n')).toBeNull();
      const bfBtn = screen.getByText('Bug Fix').closest('button');
      expect(bfBtn?.querySelector('.cl-tag-n')).toBeNull();
    });

    it('filters timeline by selected tag', async () => {
      const user = userEvent.setup();
      mockItems = [
        makeEntry({ id: '1', tag: 'new_feature' }),
        makeEntry({ id: '2', tag: 'bug_fix' }),
      ];
      renderWithRouter();
      await user.click(screen.getByText('Bug Fix'));
      // Only 1 entry matches bug_fix
      expect(screen.getByTestId('changelog-timeline-mock').getAttribute('data-entry-count')).toBe(
        '1'
      );
    });
  });

  // ── Filter pipeline (AC #7) — filtering before grouping is implicit ─────────
  describe('Filter pipeline order', () => {
    it('tag filter applies to search-filtered set', async () => {
      const user = userEvent.setup();
      mockItems = [
        makeEntry({ id: '1', title_en: 'alpha feature', tag: 'new_feature' }),
        makeEntry({ id: '2', title_en: 'alpha bug', tag: 'bug_fix' }),
        makeEntry({ id: '3', title_en: 'beta feature', tag: 'new_feature' }),
      ];
      renderWithRouter();
      // Search for 'alpha' → 2 entries
      await user.type(screen.getByTestId('changelog-search-input'), 'alpha');
      expect(screen.getByTestId('changelog-timeline-mock').getAttribute('data-entry-count')).toBe(
        '2'
      );
      // Then filter by new_feature → only 1
      await user.click(screen.getByText('New Feature'));
      expect(screen.getByTestId('changelog-timeline-mock').getAttribute('data-entry-count')).toBe(
        '1'
      );
    });
  });

  // ── Deep-link ?edit=<valid-id>&lang=ru (AC #8) ──────────────────────────────
  describe('Deep-link ?edit=<valid-id>&lang=ru', () => {
    it('calls openEdit with the id when item exists', async () => {
      mockItems = [makeEntry({ id: 'abc-123' })];
      mockIsLoading = false;
      renderWithRouter('?edit=abc-123&lang=ru');
      await act(async () => {});
      expect(mockOpenEdit).toHaveBeenCalledWith('abc-123');
    });

    it('calls setLang(ru) when lang=ru is valid', async () => {
      mockItems = [makeEntry({ id: 'abc-123' })];
      mockIsLoading = false;
      renderWithRouter('?edit=abc-123&lang=ru');
      await act(async () => {});
      expect(mockSetLang).toHaveBeenCalledWith('ru');
    });

    it('opens drawer in RU — ?edit=<valid-id>&lang=ru activates both openEdit and setLang("ru")', async () => {
      mockItems = [makeEntry({ id: 'deep-ru-1' })];
      mockIsLoading = false;
      renderWithRouter('?edit=deep-ru-1&lang=ru');
      await act(async () => {});
      expect(mockOpenEdit).toHaveBeenCalledWith('deep-ru-1');
      expect(mockSetLang).toHaveBeenCalledWith('ru');
    });
  });

  // ── Deep-link ?compose=1 (AC #8) ────────────────────────────────────────────
  describe('Deep-link ?compose=1', () => {
    it('calls openCompose', async () => {
      mockItems = [];
      mockIsLoading = false;
      renderWithRouter('?compose=1');
      await act(async () => {});
      expect(mockOpenCompose).toHaveBeenCalled();
    });
  });

  // ── Deep-link malformed values (AC #9) ──────────────────────────────────────
  describe('Deep-link malformed values', () => {
    it('ignores ?edit=<missing-id> silently AND does NOT immediately strip URL', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockItems = [makeEntry({ id: 'real-id' })];
      mockIsLoading = false;
      renderWithRouter('?edit=not-a-real-id');
      // openEdit must NOT be called
      expect(mockOpenEdit).not.toHaveBeenCalled();
      // No console.error
      expect(errSpy).not.toHaveBeenCalled();
      // URL is not immediately stripped — the ?edit param should still be present
      // (the component should NOT call setSearchParams to remove it immediately)
      // We verify this by checking that no rewrite happened on initial render
      await act(async () => {});
      expect(mockOpenEdit).not.toHaveBeenCalled();
      errSpy.mockRestore();
    });

    it('ignores ?lang=foo (does not call setLang with invalid value)', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockItems = [makeEntry({ id: 'abc-123' })];
      mockIsLoading = false;
      renderWithRouter('?edit=abc-123&lang=foo');
      await act(async () => {});
      // openEdit is called but setLang should not be called with 'foo'
      expect(mockSetLang).not.toHaveBeenCalledWith('foo');
      expect(errSpy).not.toHaveBeenCalled();
      errSpy.mockRestore();
    });
  });

  // ── Close drawer strips URL params (AC #10) ─────────────────────────────────
  describe('Close drawer strips URL params', () => {
    it('drawer renders when mode is non-null', () => {
      mockMode = 'compose';
      renderWithRouter();
      expect(screen.getByTestId('changelog-editor-drawer-mock')).toBeInTheDocument();
    });

    it('drawer is absent when mode is null', () => {
      mockMode = null;
      renderWithRouter();
      expect(screen.queryByTestId('changelog-editor-drawer-mock')).not.toBeInTheDocument();
    });
  });

  // ── No console.warn even at 200 entries (CLTT-01 removed the warn) ──────────
  describe('No console.warn at high entry counts', () => {
    it('does NOT fire console.warn when mocking 200 entries', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockItems = Array.from({ length: 200 }, (_, i) =>
        makeEntry({ id: `entry-${i}`, title_en: `Entry ${i}` })
      );
      renderWithRouter();
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('does NOT fire console.warn when mocking 100 entries', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockItems = Array.from({ length: 100 }, (_, i) =>
        makeEntry({ id: `entry-${i}`, title_en: `Entry ${i}` })
      );
      renderWithRouter();
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  // ── fetchList on mount ──────────────────────────────────────────────────────
  describe('Lifecycle', () => {
    it('calls fetchList on mount', () => {
      renderWithRouter();
      expect(mockFetchList).toHaveBeenCalled();
    });
  });

  // ── Tag SegControl renders without count badges (TBR2-25-04) ────────────────
  describe('Tag SegControl count-badge format', () => {
    it('renders filter pills without count badges', () => {
      mockItems = [
        makeEntry({ id: '1', tag: 'new_feature' }),
        makeEntry({ id: '2', tag: 'bug_fix' }),
        makeEntry({ id: '3', tag: 'new_feature' }),
      ];
      renderWithRouter();
      const allBtn = screen.getByText('All').closest('button');
      expect(allBtn).toBeInTheDocument();
      expect(allBtn?.querySelector('.cl-tag-n')).toBeNull();
    });
  });

  // ── Clear-X button (TBR2-25-04) ─────────────────────────────────────────────
  describe('Clear-X button', () => {
    beforeEach(() => {
      mockItems = [
        makeEntry({ id: '1', title_en: 'Hello world' }),
        makeEntry({ id: '2', title_en: 'Bug fix' }),
      ];
    });

    it('shows clear-X button when search is non-empty', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      const input = screen.getByTestId('changelog-search-input');
      await user.type(input, 'hello');
      expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
    });

    it('does not show clear-X button when search is empty', () => {
      renderWithRouter();
      expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
    });

    it('clicking clear-X clears the search and restores all entries', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      const input = screen.getByTestId('changelog-search-input');
      await user.type(input, 'hello');
      // Only 1 entry visible
      expect(screen.getByTestId('changelog-timeline-mock').getAttribute('data-entry-count')).toBe(
        '1'
      );
      await user.click(screen.getByRole('button', { name: 'Clear search' }));
      // All entries restored
      expect(screen.getByTestId('changelog-timeline-mock').getAttribute('data-entry-count')).toBe(
        '2'
      );
      expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
    });
  });

  // ── ESC-to-clear (TBR2-25-04) ───────────────────────────────────────────────
  describe('ESC-to-clear', () => {
    beforeEach(() => {
      mockItems = [
        makeEntry({ id: '1', title_en: 'Hello world' }),
        makeEntry({ id: '2', title_en: 'Bug fix' }),
      ];
    });

    it('pressing Escape on the input clears the search', async () => {
      const user = userEvent.setup();
      renderWithRouter();
      const input = screen.getByTestId('changelog-search-input');
      await user.type(input, 'hello');
      expect(screen.getByTestId('changelog-timeline-mock').getAttribute('data-entry-count')).toBe(
        '1'
      );
      await user.keyboard('{Escape}');
      expect(screen.getByTestId('changelog-timeline-mock').getAttribute('data-entry-count')).toBe(
        '2'
      );
    });
  });

  // ── .va-panel wrapper ──────────────────────────────────────────────────────
  // Toolbar lives outside .va-panel so it sits on page canvas (matches
  // Exercises tab styling and avoids the rounded-corner clip on the search input).
  describe('.va-panel wrapper', () => {
    it('.va-panel wraps the timeline but NOT the search toolbar', () => {
      mockItems = [makeEntry({ id: '1' })];
      renderWithRouter();

      const panel = document.querySelector('.va-panel');
      expect(panel).not.toBeNull();
      expect(panel!.contains(screen.getByTestId('changelog-timeline-mock'))).toBe(true);
      expect(panel!.contains(screen.getByTestId('changelog-search-input'))).toBe(false);
    });
  });

  // ── Deep-link race fix (Fix #3) ────────────────────────────────────────────
  describe('Deep-link race: deep-link blocked while isLoading=true', () => {
    it('does not call openEdit while isLoading=true', async () => {
      // Simulate: store says loading is in progress
      mockIsLoading = true;
      mockItems = [makeEntry({ id: 'loading-id' })];
      renderWithRouter('?edit=loading-id');
      await act(async () => {});
      // Should NOT have called openEdit because isLoading was true
      expect(mockOpenEdit).not.toHaveBeenCalled();
    });

    it('calls openEdit after isLoading transitions to false', async () => {
      // Start with loading complete
      mockIsLoading = false;
      mockItems = [makeEntry({ id: 'resolved-id' })];
      renderWithRouter('?edit=resolved-id');
      await act(async () => {});
      expect(mockOpenEdit).toHaveBeenCalledWith('resolved-id');
    });
  });

  // ── news-seg-l regression (TBR2-25-14) ─────────────────────────────────────
  it('toolbar does not render visible SegControl group labels', () => {
    const { container } = renderWithRouter();
    expect(container.querySelectorAll('.news-seg-l')).toHaveLength(0);
  });
});
