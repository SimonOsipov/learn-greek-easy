// src/components/admin/situations/__tests__/SituationDrawer.exercises.test.tsx
//
// SIT-07d: SituationDrawerExercises unit tests.
// Covers: counts from exercisesData.groups, default source=dialog,
// sub-tab switching (client-side only), empty state, disabled Generate buttons.
//
// ADMIN2-42-04 (task-1121): added pickDefaultExerciseSource unit tests (tests 1-4)
// and auto-select / sticky-manual-switch behaviour tests (tests 5-7).

import React from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SituationDetailResponse, SituationExercisesResponse } from '@/types/situation';

import { pickDefaultExerciseSource, SituationDrawerExercises } from '../SituationDrawer.exercises';

// ── i18n mock ─────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'comingSoon') return 'Coming soon';
      if (key === 'situations.drawer.exercises.source.dialog') return 'From dialog';
      if (key === 'situations.drawer.exercises.source.description') return 'From description';
      if (key === 'situations.drawer.exercises.source.picture') return 'From picture';
      if (key === 'situations.drawer.exercises.generateFromDialog') return 'Generate from dialog';
      if (key === 'situations.drawer.exercises.generateFromDescription')
        return 'Generate from description';
      if (key === 'situations.drawer.exercises.generateFromPicture') return 'Generate from picture';
      if (key === 'situations.drawer.exercises.empty.title') return 'No exercises yet';
      if (key === 'situations.drawer.exercises.empty.cta') return 'Generate exercises';
      // Pass through for situations.detail.* used in wrapped tab
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

// ── Tooltip mock ───────────────────────────────────────────────────────────────

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

// ── adminAPI mock ──────────────────────────────────────────────────────────────

const mockGetSituationExercises = vi.fn();

vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    getSituationExercises: (...args: unknown[]) => mockGetSituationExercises(...args),
  },
}));

// ── ExerciseItemPayload mock ───────────────────────────────────────────────────

vi.mock('../../exercises/ExerciseItemPayload', () => ({
  ExerciseItemPayload: () => <div data-testid="exercise-item-payload" />,
  elText: (val: unknown): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object' && 'el' in (val as object))
      return String((val as Record<string, unknown>).el);
    return String(val);
  },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeExercise(id: string): import('@/types/situation').SituationExerciseResponse {
  return {
    id,
    exercise_type: 'fill_gaps',
    status: 'draft',
    items: [],
    modality: 'reading',
  };
}

function makeResponse(): SituationExercisesResponse {
  return {
    total_count: 4,
    groups: [
      {
        source_type: 'dialog',
        exercise_count: 3,
        exercises: [makeExercise('d1'), makeExercise('d2'), makeExercise('d3')],
      },
      { source_type: 'description', exercise_count: 0, exercises: [] },
      { source_type: 'picture', exercise_count: 1, exercises: [makeExercise('p1')] },
    ],
  };
}

function makeSituation(id = 'sit-1'): SituationDetailResponse {
  return {
    id,
    scenario_el: 'Γεια',
    scenario_en: 'Hello',
    scenario_ru: 'Привет',
    status: 'draft',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    description: null,
    picture: null,
    dialog: null,
    levels: [],
    linked_news: null,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── ADMIN2-42-04: pickDefaultExerciseSource unit tests (pure helper) ──────────

describe('pickDefaultExerciseSource', () => {
  it('picks first populated source — description wins when dialog=0', () => {
    // counts: dialog=0, description=4, picture=2 → 'description' (first non-zero in order)
    expect(pickDefaultExerciseSource({ dialog: 0, description: 4, picture: 2 })).toBe(
      'description'
    );
  });

  it('prefers dialog when populated, even if description also has exercises', () => {
    // counts: dialog=3, description=4, picture=0 → 'dialog' (dialog checked first)
    expect(pickDefaultExerciseSource({ dialog: 3, description: 4, picture: 0 })).toBe('dialog');
  });

  it('falls back to dialog when all sources are empty', () => {
    // counts: all zero → fallback 'dialog'
    expect(pickDefaultExerciseSource({ dialog: 0, description: 0, picture: 0 })).toBe('dialog');
  });

  it('selects picture when it is the only populated source', () => {
    // counts: dialog=0, description=0, picture=2 → 'picture'
    expect(pickDefaultExerciseSource({ dialog: 0, description: 0, picture: 2 })).toBe('picture');
  });
});

// ── ADMIN2-42-04: auto-select behaviour (render tests) ───────────────────────

describe('SituationDrawerExercises — auto-select populated source on load', () => {
  it('tab auto-selects populated source on load (description=4, picture=2, dialog=0)', async () => {
    // description=4 / picture=2 / dialog=0 → after data loads, active tab should be "From description"
    const response: SituationExercisesResponse = {
      total_count: 6,
      groups: [
        { source_type: 'dialog', exercise_count: 0, exercises: [] },
        {
          source_type: 'description',
          exercise_count: 4,
          exercises: [
            makeExercise('de1'),
            makeExercise('de2'),
            makeExercise('de3'),
            makeExercise('de4'),
          ],
        },
        {
          source_type: 'picture',
          exercise_count: 2,
          exercises: [makeExercise('pi1'), makeExercise('pi2')],
        },
      ],
    };
    mockGetSituationExercises.mockResolvedValue(response);
    render(<SituationDrawerExercises situation={makeSituation()} />);

    // After data loads, the active SegControl button must be "From description"
    await waitFor(() => {
      const pressedBtns = screen
        .getAllByRole('button')
        .filter((btn) => btn.getAttribute('aria-pressed') === 'true');
      expect(pressedBtns).toHaveLength(1);
      expect(pressedBtns[0].textContent).toContain('From description');
    });

    // The flat exercise list (not the empty state) should be shown
    expect(screen.queryByTestId('situation-drawer-exercises-empty')).not.toBeInTheDocument();
    const list = screen.getByTestId('dr-ex-list');
    expect(list).toBeInTheDocument();
  });

  it('empty situation still shows empty state on dialog source', async () => {
    // all groups empty → source must stay 'dialog', empty state shown
    const response: SituationExercisesResponse = {
      total_count: 0,
      groups: [
        { source_type: 'dialog', exercise_count: 0, exercises: [] },
        { source_type: 'description', exercise_count: 0, exercises: [] },
        { source_type: 'picture', exercise_count: 0, exercises: [] },
      ],
    };
    mockGetSituationExercises.mockResolvedValue(response);
    render(<SituationDrawerExercises situation={makeSituation()} />);

    // Active source must remain 'dialog'
    await waitFor(() => {
      const pressedBtns = screen
        .getAllByRole('button')
        .filter((btn) => btn.getAttribute('aria-pressed') === 'true');
      expect(pressedBtns).toHaveLength(1);
      expect(pressedBtns[0].textContent).toContain('From dialog');
    });

    // Empty state is shown
    expect(screen.getByTestId('situation-drawer-exercises-empty')).toBeInTheDocument();
    expect(screen.getByText('No exercises yet')).toBeInTheDocument();
  });

  it('manual source switch survives data load (auto-select fires once)', async () => {
    // description=4, dialog=0; the admin manually switches to "dialog" BEFORE data loads
    // → after data loads, source must stay "dialog" (auto-select must NOT override)
    let resolveApi!: (v: SituationExercisesResponse) => void;
    const pendingPromise = new Promise<SituationExercisesResponse>((res) => {
      resolveApi = res;
    });
    mockGetSituationExercises.mockReturnValue(pendingPromise);

    const user = userEvent.setup();
    render(<SituationDrawerExercises situation={makeSituation()} />);

    // While data is still loading (pending), manually switch to "From description" then back to "From dialog"
    // (simulates admin clicking around before the fetch completes)
    const descBtn = screen
      .getAllByRole('button')
      .find(
        (btn) =>
          btn.getAttribute('aria-pressed') !== null && btn.textContent?.includes('From description')
      );
    expect(descBtn).toBeDefined();
    await user.click(descBtn!);

    // Now switch back to dialog manually
    const dialogBtn = screen
      .getAllByRole('button')
      .find(
        (btn) =>
          btn.getAttribute('aria-pressed') !== null && btn.textContent?.includes('From dialog')
      );
    expect(dialogBtn).toBeDefined();
    await user.click(dialogBtn!);

    // Now resolve the API with description populated
    const response: SituationExercisesResponse = {
      total_count: 4,
      groups: [
        { source_type: 'dialog', exercise_count: 0, exercises: [] },
        {
          source_type: 'description',
          exercise_count: 4,
          exercises: [
            makeExercise('de1'),
            makeExercise('de2'),
            makeExercise('de3'),
            makeExercise('de4'),
          ],
        },
        { source_type: 'picture', exercise_count: 0, exercises: [] },
      ],
    };
    resolveApi(response);

    // After data loads, active source must remain "From dialog" (manual choice sticky)
    await waitFor(() => {
      // exercisesData is now set (counts updated)
      const tags = document.querySelectorAll('.cl-tag-n');
      const tagTexts = Array.from(tags).map((el) => el.textContent);
      expect(tagTexts).toContain('4');
    });

    // Source must NOT have been auto-selected to description
    const pressedBtns = screen
      .getAllByRole('button')
      .filter((btn) => btn.getAttribute('aria-pressed') === 'true');
    expect(pressedBtns).toHaveLength(1);
    expect(pressedBtns[0].textContent).toContain('From dialog');

    // Empty state is shown (dialog has 0 exercises)
    expect(screen.getByTestId('situation-drawer-exercises-empty')).toBeInTheDocument();
  });
});

// ── Legacy tests (unchanged) ─────────────────────────────────────────────────

// 1. Counts derived from exercisesData.groups

describe('SituationDrawerExercises — sub-tab counts', () => {
  it('shows count badges derived from exercisesData.groups after data loads', async () => {
    mockGetSituationExercises.mockResolvedValue(makeResponse());
    render(<SituationDrawerExercises situation={makeSituation()} />);

    // Wait for counts to appear in the SegControl badges
    await waitFor(() => {
      // SegControl renders count via cl-tag-n spans
      const tags = document.querySelectorAll('.cl-tag-n');
      const tagTexts = Array.from(tags).map((el) => el.textContent);
      expect(tagTexts).toContain('3');
      expect(tagTexts).toContain('0');
      expect(tagTexts).toContain('1');
    });
  });

  it('shows 0 counts for all sources before data loads', () => {
    // Never resolves during this check
    mockGetSituationExercises.mockReturnValue(new Promise(() => {}));
    render(<SituationDrawerExercises situation={makeSituation()} />);

    const tags = document.querySelectorAll('.cl-tag-n');
    const tagTexts = Array.from(tags).map((el) => el.textContent);
    expect(tagTexts.every((t) => t === '0')).toBe(true);
  });
});

// 2. Default active source is 'dialog' (before data loads / when dialog is populated)
//
// NOTE (ADMIN2-42-04): the original "defaults to dialog" expectation was correct for the
// pre-data-loaded state (both before any fetch AND when dialog is the first non-empty
// source). After data loads the auto-select logic kicks in and picks the first populated
// source. These two existing tests remain valid: the first checks pre-load state, the
// second checks the generate button which is visible regardless of source.

describe('SituationDrawerExercises — default source (pre-load)', () => {
  it('defaults to dialog sub-tab before data loads (aria-pressed=true on dialog)', () => {
    mockGetSituationExercises.mockReturnValue(new Promise(() => {}));
    render(<SituationDrawerExercises situation={makeSituation()} />);

    // SegControl buttons have aria-pressed; the Generate button does not.
    const pressedBtns = screen
      .getAllByRole('button')
      .filter((btn) => btn.getAttribute('aria-pressed') === 'true');
    expect(pressedBtns).toHaveLength(1);
    expect(pressedBtns[0].textContent).toContain('From dialog');
  });

  it('renders the Generate button for dialog source initially', () => {
    mockGetSituationExercises.mockReturnValue(new Promise(() => {}));
    render(<SituationDrawerExercises situation={makeSituation()} />);

    expect(screen.getByTestId('situation-drawer-exercises-generate-dialog')).toBeInTheDocument();
  });
});

// 3. Sub-tab switching is client-side (no extra fetch)

describe('SituationDrawerExercises — sub-tab switching', () => {
  it('switches active source client-side and does not re-fetch', async () => {
    mockGetSituationExercises.mockResolvedValue(makeResponse());
    const user = userEvent.setup();
    render(<SituationDrawerExercises situation={makeSituation()} />);

    // Wait for data to load
    await waitFor(() => {
      const tags = document.querySelectorAll('.cl-tag-n');
      expect(Array.from(tags).map((el) => el.textContent)).toContain('3');
    });

    // Click the SegControl "From picture" button (aria-pressed exists on seg buttons)
    const picBtn = screen
      .getAllByRole('button')
      .find(
        (btn) =>
          btn.getAttribute('aria-pressed') !== null && btn.textContent?.includes('From picture')
      );
    expect(picBtn).toBeDefined();
    await user.click(picBtn!);

    // Generate button should update to picture
    expect(screen.getByTestId('situation-drawer-exercises-generate-picture')).toBeInTheDocument();

    // Still only one API call
    expect(mockGetSituationExercises).toHaveBeenCalledTimes(1);
  });
});

// 4. Empty state renders when active count is 0

describe('SituationDrawerExercises — empty state', () => {
  it('shows empty state after switching to description (count=0)', async () => {
    mockGetSituationExercises.mockResolvedValue(makeResponse());
    const user = userEvent.setup();
    render(<SituationDrawerExercises situation={makeSituation()} />);

    await waitFor(() => {
      const tags = document.querySelectorAll('.cl-tag-n');
      expect(Array.from(tags).map((el) => el.textContent)).toContain('0');
    });

    const descBtn = screen
      .getAllByRole('button')
      .find(
        (btn) =>
          btn.getAttribute('aria-pressed') !== null && btn.textContent?.includes('From description')
      );
    expect(descBtn).toBeDefined();
    await user.click(descBtn!);

    await waitFor(() => {
      expect(screen.getByTestId('situation-drawer-exercises-empty')).toBeInTheDocument();
    });
    expect(screen.getByText('No exercises yet')).toBeInTheDocument();
    expect(screen.getByText('Generate exercises')).toBeInTheDocument();
  });
});

// 5. Generate button label binds to active source

describe('SituationDrawerExercises — Generate button', () => {
  it('Generate button label updates when source changes', async () => {
    mockGetSituationExercises.mockResolvedValue(makeResponse());
    const user = userEvent.setup();
    render(<SituationDrawerExercises situation={makeSituation()} />);

    await waitFor(() => {
      expect(screen.getByTestId('situation-drawer-exercises-generate-dialog')).toBeInTheDocument();
    });

    const picBtn = screen
      .getAllByRole('button')
      .find(
        (btn) =>
          btn.getAttribute('aria-pressed') !== null && btn.textContent?.includes('From picture')
      );
    expect(picBtn).toBeDefined();
    await user.click(picBtn!);

    expect(screen.getByTestId('situation-drawer-exercises-generate-picture')).toBeInTheDocument();
    expect(screen.queryByTestId('situation-drawer-exercises-generate-dialog')).toBeNull();
  });

  it('toolbar Generate button is disabled', () => {
    mockGetSituationExercises.mockReturnValue(new Promise(() => {}));
    render(<SituationDrawerExercises situation={makeSituation()} />);

    const btn = screen.getByTestId('situation-drawer-exercises-generate-dialog');
    expect(btn).toBeDisabled();
  });

  it('toolbar Generate button shows Coming soon tooltip', () => {
    mockGetSituationExercises.mockReturnValue(new Promise(() => {}));
    render(<SituationDrawerExercises situation={makeSituation()} />);

    const tooltips = screen.getAllByTestId('tooltip-content');
    const texts = tooltips.map((el) => el.textContent);
    expect(texts).toContain('Coming soon');
  });
});

// 6. Generate button text matches per-source keys (no interpolation artifact)

describe('SituationDrawerExercises — Generate button text per source', () => {
  it.each([
    ['dialog', 'Generate from dialog'],
    ['description', 'Generate from description'],
    ['picture', 'Generate from picture'],
  ] as const)('shows "%s" button text when active source is %s', async (source, expectedText) => {
    mockGetSituationExercises.mockResolvedValue(makeResponse());
    const user = userEvent.setup();
    render(<SituationDrawerExercises situation={makeSituation()} />);

    if (source !== 'dialog') {
      // Switch to the target source tab
      const tabBtn = screen
        .getAllByRole('button')
        .find(
          (btn) =>
            btn.getAttribute('aria-pressed') !== null &&
            btn.textContent?.toLowerCase().includes(source === 'picture' ? 'picture' : source)
        );
      expect(tabBtn).toBeDefined();
      await user.click(tabBtn!);
    }

    const generateBtn = await screen.findByTestId(`situation-drawer-exercises-generate-${source}`);
    expect(generateBtn.textContent).toMatch(/^Generate from (dialog|description|picture)$/);
    expect(generateBtn.textContent).toBe(expectedText);
  });
});

// 7. State resets on situation.id change

describe('SituationDrawerExercises — situation change reset', () => {
  it('resets activeSource to dialog and re-fetches on situation.id change', async () => {
    const response1 = makeResponse();
    const response2: SituationExercisesResponse = {
      total_count: 1,
      groups: [{ source_type: 'picture', exercise_count: 1, exercises: [makeExercise('p2')] }],
    };
    mockGetSituationExercises.mockResolvedValueOnce(response1).mockResolvedValueOnce(response2);

    const user = userEvent.setup();
    const { rerender } = render(<SituationDrawerExercises situation={makeSituation('sit-1')} />);

    // Wait for first load and switch to picture
    await waitFor(() => {
      const tags = document.querySelectorAll('.cl-tag-n');
      expect(Array.from(tags).map((el) => el.textContent)).toContain('3');
    });
    const picBtn = screen
      .getAllByRole('button')
      .find(
        (btn) =>
          btn.getAttribute('aria-pressed') !== null && btn.textContent?.includes('From picture')
      );
    expect(picBtn).toBeDefined();
    await user.click(picBtn!);
    expect(screen.getByTestId('situation-drawer-exercises-generate-picture')).toBeInTheDocument();

    // Rerender with a different situation
    rerender(<SituationDrawerExercises situation={makeSituation('sit-2')} />);

    // Should reset to dialog
    await waitFor(() => {
      expect(screen.getByTestId('situation-drawer-exercises-generate-dialog')).toBeInTheDocument();
    });

    // Should have fetched for the new situation
    expect(mockGetSituationExercises).toHaveBeenCalledTimes(2);
    expect(mockGetSituationExercises).toHaveBeenNthCalledWith(2, 'sit-2');
  });
});
