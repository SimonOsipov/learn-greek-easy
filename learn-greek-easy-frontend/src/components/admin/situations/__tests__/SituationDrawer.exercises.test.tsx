// src/components/admin/situations/__tests__/SituationDrawer.exercises.test.tsx
//
// SIT-07d: SituationDrawerExercises unit tests.
// Covers: counts from exercisesData.groups, default source=dialog,
// sub-tab switching (client-side only), empty state, disabled Generate buttons.

import React from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SituationDetailResponse, SituationExercisesResponse } from '@/types/situation';

import { SituationDrawerExercises } from '../SituationDrawer.exercises';

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

function makeExercise(id: string) {
  return {
    id,
    exercise_type: 'fill_gaps',
    status: 'draft',
    modality: 'reading',
    audio_level: null,
    audio_url: null,
    reading_text: null,
    items: [],
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
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

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

// 2. Default active source is 'dialog'

describe('SituationDrawerExercises — default source', () => {
  it('defaults to dialog sub-tab (aria-pressed=true)', () => {
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
