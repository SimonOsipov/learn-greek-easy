// src/components/admin/situations/__tests__/SituationDrawer.test.tsx
//
// SIT-06: SituationDrawer scaffold tests.

import React from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module mocks ───────────────────────────────────────────────────────────────

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

const mockUpdateSituation = vi.fn();
vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    updateSituation: (...args: unknown[]) => mockUpdateSituation(...args),
  },
}));

// Store mock
const mockCloseDrawer = vi.fn();
const mockFetchSituationDetail = vi.fn().mockResolvedValue(undefined);
const mockFetchSituations = vi.fn().mockResolvedValue(undefined);

const storeState = {
  drawerItemId: null as string | null,
  selectedSituation: null as ReturnType<typeof makeDetail> | null,
  isLoadingDetail: false,
  situations: [] as ReturnType<typeof makeListItem>[],
  closeDrawer: mockCloseDrawer,
  fetchSituationDetail: mockFetchSituationDetail,
  fetchSituations: mockFetchSituations,
};

const mockUseAdminSituationStore = vi.fn((selector?: (s: typeof storeState) => unknown) => {
  if (typeof selector === 'function') return selector(storeState);
  return storeState;
});

vi.mock('@/stores/adminSituationStore', () => ({
  useAdminSituationStore: (...args: unknown[]) =>
    mockUseAdminSituationStore(...(args as [(s: typeof storeState) => unknown])),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeListItem(overrides: Partial<ReturnType<typeof _buildListItem>> = {}) {
  return { ..._buildListItem(), ...overrides };
}

function _buildListItem() {
  return {
    id: 'sit-1',
    scenario_el: 'Ελληνικό σενάριο',
    scenario_en: 'English scenario',
    scenario_ru: 'Русский сценарий',
    status: 'draft' as const,
    created_at: '2025-01-10T10:00:00Z',
    has_dialog: true,
    has_description: false,
    has_picture: false,
    has_dialog_audio: false,
    has_description_audio: false,
    description_timestamps_count: 0,
    dialog_exercises_count: 2,
    description_exercises_count: 1,
    picture_exercises_count: 0,
    levels: [] as string[],
    dialog_lines_count: 0,
    roles: [] as string[],
    picture_image_url: null as string | null,
    audio_duration_seconds: null as number | null,
    source_title_en: null as string | null,
    source_country: null as string | null,
  };
}

function makeDetail(overrides: Partial<ReturnType<typeof _buildDetail>> = {}) {
  return { ..._buildDetail(), ...overrides };
}

function _buildDetail() {
  return {
    id: 'sit-1',
    scenario_el: 'Ελληνικό σενάριο',
    scenario_en: 'English scenario',
    scenario_ru: 'Русский сценарий',
    status: 'draft' as const,
    created_at: '2025-01-10T10:00:00Z',
    updated_at: '2025-01-14T12:00:00Z',
    levels: [] as string[],
    dialog: {
      id: 'dlg-1',
      status: 'draft' as const,
      num_speakers: 2,
      audio_duration_seconds: null,
      audio_url: null,
      created_at: '2025-01-10T10:00:00Z',
      speakers: [
        { id: 'sp-1', speaker_index: 0, character_name: 'Alice', voice_id: 'v1' },
        { id: 'sp-2', speaker_index: 1, character_name: 'Bob', voice_id: 'v2' },
      ],
      lines: [
        {
          id: 'ln-1',
          line_index: 0,
          speaker_id: 'sp-1',
          text: 'Γεια',
          start_time_ms: null,
          end_time_ms: null,
          word_timestamps: null,
        },
        {
          id: 'ln-2',
          line_index: 1,
          speaker_id: 'sp-2',
          text: 'Χαίρε',
          start_time_ms: null,
          end_time_ms: null,
          word_timestamps: null,
        },
      ],
    },
    description: null,
    picture: null,
  };
}

function renderDrawer(initialSearch = '') {
  return render(
    <MemoryRouter initialEntries={[`/admin${initialSearch}`]}>
      <SituationDrawer />
    </MemoryRouter>
  );
}

// Lazy import so mocks are registered first.
let SituationDrawer: React.FC;
async function loadDrawer() {
  const mod = await import('../SituationDrawer');
  SituationDrawer = mod.SituationDrawer;
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  vi.clearAllMocks();
  storeState.drawerItemId = null;
  storeState.selectedSituation = null;
  storeState.isLoadingDetail = false;
  storeState.situations = [];
  mockFetchSituationDetail.mockResolvedValue(undefined);
  mockFetchSituations.mockResolvedValue(undefined);
  await loadDrawer();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('SituationDrawer — null guard', () => {
  it('returns null when drawerItemId is null', () => {
    storeState.drawerItemId = null;
    storeState.selectedSituation = null;
    const { container } = renderDrawer();
    expect(container.firstChild).toBeNull();
  });

  it('renders drawer when drawerItemId is set', () => {
    storeState.drawerItemId = 'sit-1';
    storeState.selectedSituation = makeDetail();
    storeState.situations = [makeListItem()];
    renderDrawer();
    expect(screen.getByTestId('situation-edit-drawer')).toBeInTheDocument();
  });
});

describe('SituationDrawer — fetchSituationDetail', () => {
  it('calls fetchSituationDetail when drawerItemId is set', async () => {
    storeState.drawerItemId = 'sit-1';
    storeState.selectedSituation = makeDetail();
    storeState.situations = [makeListItem()];
    renderDrawer();
    await waitFor(() => {
      expect(mockFetchSituationDetail).toHaveBeenCalledWith('sit-1');
    });
  });

  it('calls fetchSituationDetail on every open (re-mount)', async () => {
    // First open
    storeState.drawerItemId = 'sit-1';
    storeState.selectedSituation = makeDetail();
    storeState.situations = [makeListItem()];
    const { unmount } = renderDrawer();
    await waitFor(() => expect(mockFetchSituationDetail).toHaveBeenCalledTimes(1));

    // Simulate close + re-open with a different id
    unmount();
    vi.clearAllMocks();
    storeState.drawerItemId = 'sit-2';
    storeState.selectedSituation = makeDetail({ id: 'sit-2' });
    renderDrawer();
    await waitFor(() => {
      expect(mockFetchSituationDetail).toHaveBeenCalledWith('sit-2');
    });
  });
});

describe('SituationDrawer — header rendering', () => {
  beforeEach(() => {
    storeState.drawerItemId = 'sit-1';
    storeState.selectedSituation = makeDetail();
    storeState.situations = [makeListItem()];
  });

  it('renders breadcrumb with two speakers and line count', () => {
    renderDrawer();
    const breadcrumb = document.querySelector('.drawer-breadcrumb');
    expect(breadcrumb).toBeInTheDocument();
    expect(breadcrumb!.textContent).toContain('Alice');
    expect(breadcrumb!.textContent).toContain('Bob');
    expect(breadcrumb!.textContent).toContain('↔');
    expect(breadcrumb!.textContent).toContain('2 lines');
  });

  it('renders breadcrumb fallback when no dialog / no speakers', () => {
    storeState.selectedSituation = makeDetail({ dialog: null });
    renderDrawer();
    const breadcrumb = document.querySelector('.drawer-breadcrumb');
    expect(breadcrumb!.textContent).toBe('Situations');
  });

  it('renders breadcrumb with single speaker', () => {
    const detail = makeDetail();
    detail.dialog!.speakers = [
      { id: 'sp-1', speaker_index: 0, character_name: 'Alice', voice_id: 'v1' },
    ];
    detail.dialog!.lines = detail.dialog!.lines.slice(0, 1);
    storeState.selectedSituation = detail;
    renderDrawer();
    const breadcrumb = document.querySelector('.drawer-breadcrumb');
    expect(breadcrumb!.textContent).toContain('Alice');
    expect(breadcrumb!.textContent).not.toContain('↔');
  });

  it('renders EN title as h2.drawer-title', () => {
    renderDrawer();
    expect(document.querySelector('.drawer-title')!.textContent).toBe('English scenario');
  });

  it('falls back to EL title when scenario_en is empty', () => {
    storeState.selectedSituation = makeDetail({ scenario_en: '' });
    renderDrawer();
    expect(document.querySelector('.drawer-title')!.textContent).toBe('Ελληνικό σενάριο');
  });

  it('renders EL title row with lang="el" and serif class', () => {
    renderDrawer();
    const elRow = document.querySelector('.drawer-el-title[lang="el"]');
    expect(elRow).toBeInTheDocument();
    expect(elRow!.classList.contains('font-serif')).toBe(true);
    expect(elRow!.textContent).toBe('Ελληνικό σενάριο');
  });

  it('renders status badge', () => {
    renderDrawer();
    // Badge with draft status text
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('renders exercises-count badge from list item', () => {
    renderDrawer();
    // list item has dialog=2 + description=1 + picture=0 = 3 exercises
    expect(screen.getByText('3 exercises')).toBeInTheDocument();
  });
});

describe('SituationDrawer — tab strip', () => {
  beforeEach(() => {
    storeState.drawerItemId = 'sit-1';
    storeState.selectedSituation = makeDetail();
    storeState.situations = [makeListItem()];
  });

  it('renders 5 tab buttons', () => {
    renderDrawer();
    const tabs = ['dialog', 'description', 'picture', 'exercises', 'linkedNews'];
    tabs.forEach((tab) => {
      expect(screen.getByTestId(`situation-drawer-tab-${tab}`)).toBeInTheDocument();
    });
  });

  it('dialog tab label includes line count', () => {
    renderDrawer();
    const dialogTab = screen.getByTestId('situation-drawer-tab-dialog');
    expect(dialogTab.textContent).toContain('2 lines');
  });

  it('exercises tab label includes total count', () => {
    renderDrawer();
    const exercisesTab = screen.getByTestId('situation-drawer-tab-exercises');
    expect(exercisesTab.textContent).toContain('3');
  });

  it('starts on dialog tab — dialog stub renders', () => {
    renderDrawer();
    // Dialog stub renders a hidden input
    expect(screen.getByTestId('scenario-en-input')).toBeInTheDocument();
  });

  it('clicking description tab switches tab (dialog stub disappears)', async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(screen.getByTestId('situation-drawer-tab-description'));
    expect(screen.queryByTestId('scenario-en-input')).not.toBeInTheDocument();
  });

  it('clicking tab does NOT change URL (drawer stays rendered)', async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(screen.getByTestId('situation-drawer-tab-picture'));
    // Drawer is still present — tab switch is local state only (no navigation)
    expect(screen.getByTestId('situation-edit-drawer')).toBeInTheDocument();
  });

  it('every drawer open resets to dialog tab', async () => {
    const user = userEvent.setup();
    storeState.drawerItemId = 'sit-1';
    storeState.selectedSituation = makeDetail({ id: 'sit-1' });
    storeState.situations = [makeListItem({ id: 'sit-1' })];

    const { rerender } = render(
      <MemoryRouter>
        <SituationDrawer />
      </MemoryRouter>
    );

    // Navigate to picture tab
    await user.click(screen.getByTestId('situation-drawer-tab-picture'));
    expect(screen.queryByTestId('scenario-en-input')).not.toBeInTheDocument();

    // Simulate closing + re-opening with a different id (triggers useEffect)
    const detailB = makeDetail({ id: 'sit-2', scenario_en: 'Scenario B' });
    storeState.drawerItemId = 'sit-2';
    storeState.selectedSituation = detailB;
    storeState.situations = [makeListItem({ id: 'sit-2' })];

    rerender(
      <MemoryRouter>
        <SituationDrawer />
      </MemoryRouter>
    );

    // Should reset to dialog tab
    await waitFor(() => {
      expect(screen.getByTestId('scenario-en-input')).toBeInTheDocument();
    });
  });

  it('renders disabled Regenerate scenario button with aria-disabled', () => {
    renderDrawer();
    const regenBtn = screen.getByText('Regenerate scenario');
    expect(regenBtn).toBeInTheDocument();
    expect(regenBtn.getAttribute('aria-disabled')).toBe('true');
  });
});

describe('SituationDrawer — body loading state', () => {
  it('shows loading placeholder when detail is not yet loaded', () => {
    storeState.drawerItemId = 'sit-1';
    storeState.selectedSituation = null;
    storeState.isLoadingDetail = true;
    storeState.situations = [];
    renderDrawer();
    expect(document.querySelector('.drawer-body-loading')).toBeInTheDocument();
  });
});

describe('SituationDrawer — footer', () => {
  beforeEach(() => {
    storeState.drawerItemId = 'sit-1';
    storeState.selectedSituation = makeDetail();
    storeState.situations = [makeListItem()];
  });

  it('renders All checks passed badge', () => {
    renderDrawer();
    expect(screen.getByText('All checks passed')).toBeInTheDocument();
  });

  it('renders updated relative time', () => {
    renderDrawer();
    // The relative time rendering uses formatDistanceToNow
    const updatedText = screen.getByText(/Updated/);
    expect(updatedText).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    renderDrawer();
    expect(screen.getByTestId('situation-drawer-cancel')).toBeInTheDocument();
  });

  it('renders Save & close button', () => {
    renderDrawer();
    expect(screen.getByTestId('situation-drawer-save')).toBeInTheDocument();
  });
});

describe('SituationDrawer — Save with no dirty fields', () => {
  it('closes drawer without calling updateSituation when form is pristine', async () => {
    const user = userEvent.setup();
    storeState.drawerItemId = 'sit-1';
    storeState.selectedSituation = makeDetail();
    storeState.situations = [makeListItem()];

    renderDrawer();
    await user.click(screen.getByTestId('situation-drawer-save'));

    await waitFor(() => {
      expect(mockUpdateSituation).not.toHaveBeenCalled();
      expect(mockCloseDrawer).toHaveBeenCalled();
    });
  });
});

describe('SituationDrawer — Save with dirty fields', () => {
  it('calls updateSituation with only diffed scenario fields and closes', async () => {
    const user = userEvent.setup();
    storeState.drawerItemId = 'sit-1';
    storeState.selectedSituation = makeDetail();
    storeState.situations = [makeListItem()];
    mockUpdateSituation.mockResolvedValue({ id: 'sit-1' });

    renderDrawer();

    // Make the form dirty by typing in the hidden scenario_en input
    const input = screen.getByTestId('scenario-en-input');
    await user.clear(input);
    await user.type(input, 'New scenario text');

    await user.click(screen.getByTestId('situation-drawer-save'));

    await waitFor(() => {
      expect(mockUpdateSituation).toHaveBeenCalledWith(
        'sit-1',
        expect.objectContaining({ scenario_en: 'New scenario text' })
      );
      // Should NOT include scenario_el or scenario_ru since they were not changed
      const callArg = mockUpdateSituation.mock.calls[0][1];
      expect(callArg).not.toHaveProperty('scenario_el');
      expect(callArg).not.toHaveProperty('scenario_ru');
      expect(mockCloseDrawer).toHaveBeenCalled();
    });
  });
});

describe('SituationDrawer — dirty guard', () => {
  beforeEach(() => {
    storeState.drawerItemId = 'sit-1';
    storeState.selectedSituation = makeDetail();
    storeState.situations = [makeListItem()];
  });

  it('does not open ConfirmDialog when Cancel is clicked and form is clean', async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(screen.getByTestId('situation-drawer-cancel'));
    expect(mockCloseDrawer).toHaveBeenCalled();
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });

  it('opens ConfirmDialog when Cancel is clicked and form is dirty', async () => {
    const user = userEvent.setup();
    renderDrawer();

    const input = screen.getByTestId('scenario-en-input');
    await user.clear(input);
    await user.type(input, 'dirty');

    await user.click(screen.getByTestId('situation-drawer-cancel'));
    await waitFor(() => {
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    });
  });

  it('opens ConfirmDialog when Close button is clicked and form is dirty', async () => {
    const user = userEvent.setup();
    renderDrawer();

    const input = screen.getByTestId('scenario-en-input');
    await user.clear(input);
    await user.type(input, 'dirty');

    // Click the close button (aria-label = "Close drawer")
    const closeBtn = screen.getByLabelText('Close drawer');
    await user.click(closeBtn);

    await waitFor(() => {
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    });
  });

  it('Discard & continue closes drawer without saving', async () => {
    const user = userEvent.setup();
    renderDrawer();

    const input = screen.getByTestId('scenario-en-input');
    await user.clear(input);
    await user.type(input, 'dirty');

    await user.click(screen.getByTestId('situation-drawer-cancel'));
    await waitFor(() => screen.getByText('Unsaved changes'));

    // Click "Discard & continue" (cancel button in ConfirmDialog)
    await user.click(screen.getByText('Discard & continue'));

    await waitFor(() => {
      expect(mockUpdateSituation).not.toHaveBeenCalled();
      expect(mockCloseDrawer).toHaveBeenCalled();
    });
  });
});

describe('SituationDrawer — deep link', () => {
  it('renders drawer when URL has ?edit=sit-1 and store has drawerItemId set', () => {
    storeState.drawerItemId = 'sit-1';
    storeState.selectedSituation = makeDetail({ id: 'sit-1' });
    storeState.situations = [makeListItem({ id: 'sit-1' })];

    render(
      <MemoryRouter initialEntries={['/admin?tab=situations&edit=sit-1']}>
        <SituationDrawer />
      </MemoryRouter>
    );

    expect(screen.getByTestId('situation-edit-drawer')).toBeInTheDocument();
    // Dialog stub (default tab) should be rendered
    expect(screen.getByTestId('scenario-en-input')).toBeInTheDocument();
  });
});
