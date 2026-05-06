/**
 * SituationDetailPage Component Tests
 *
 * Covers the About-tab 2-column image row (LSPIC-08):
 * - SourceCard + picture img when both source_url and picture_url are present
 * - SourceCard + illustration placeholder when only source_url present
 * - Both placeholders when neither source_url nor picture_url present
 *
 * In all three cases the grid wrapper must carry both grid-cols-1 and
 * lg:grid-cols-2 so the layout never collapses.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import { QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

import { SituationDetailPage } from '@/pages/SituationDetailPage';
import { render, screen, waitFor, createTestQueryClient } from '@/lib/test-utils';
import { situationAPI } from '@/services/situationAPI';
import { exerciseAPI } from '@/services/exerciseAPI';
import type { LearnerSituationDetailResponse } from '@/types/situation';

// Mock situationAPI
vi.mock('@/services/situationAPI', () => ({
  situationAPI: {
    getById: vi.fn(),
    getList: vi.fn(),
  },
}));

// Mock exerciseAPI
vi.mock('@/services/exerciseAPI', () => ({
  exerciseAPI: {
    getAllForSituation: vi.fn(),
    getQueue: vi.fn(),
    submitReview: vi.fn(),
  },
}));

// Mock analytics
vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  registerTheme: vi.fn(),
  registerInterfaceLanguage: vi.fn(),
}));

// Mock error reporting
vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

// Mock react-router-dom so useParams always resolves to our test id
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'situation-id' }),
  };
});

// -----------------------------------------------------------------------
// Factory helpers
// -----------------------------------------------------------------------

function createMockSituation(
  overrides: Partial<LearnerSituationDetailResponse> = {}
): LearnerSituationDetailResponse {
  return {
    id: 'situation-id',
    scenario_el: 'Σενάριο',
    scenario_en: 'Scenario',
    scenario_ru: 'Сценарий',
    status: 'ready',
    description: null,
    dialog: null,
    exercise_total: 0,
    exercise_completed: 0,
    source_url: null,
    source_image_url: null,
    picture_url: null,
    source_title: null,
    ...overrides,
  };
}

function createEmptyExerciseQueue() {
  return {
    total_due: 0,
    total_new: 0,
    total_early_practice: 0,
    total_in_queue: 0,
    exercises: [],
  };
}

// Wrap SituationDetailPage in a fresh QueryClientProvider before handing off
// to renderWithProviders (which adds Router + i18n providers on top).
function renderPage() {
  const queryClient = createTestQueryClient();
  const wrapped = createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(SituationDetailPage)
  );
  return render(wrapped);
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

describe('SituationDetailPage About-tab image row', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Always stub exerciseAPI to return a benign empty queue
    (exerciseAPI.getAllForSituation as Mock).mockResolvedValue(createEmptyExerciseQueue());
  });

  it('renders SourceCard + img when both source_url and picture_url are present', async () => {
    (situationAPI.getById as Mock).mockResolvedValue(
      createMockSituation({
        source_url: 'https://example.com/article',
        source_image_url: 'https://example.com/article-img.jpg',
        source_title: 'Article title',
        picture_url: 'https://example.com/picture.jpg',
      })
    );

    renderPage();

    // Wait for query resolution and hero section to appear
    await waitFor(() => {
      expect(screen.getByTestId('situation-detail-hero')).toBeInTheDocument();
    });

    // Picture image should be present
    const imgs = screen.getAllByRole('img');
    const pictureImg = imgs.find(
      (img) => img.getAttribute('src') === 'https://example.com/picture.jpg'
    );
    expect(pictureImg).toBeInTheDocument();

    // SourceCard renders the source title text
    expect(screen.getByText('Article title')).toBeInTheDocument();

    // Grid wrapper has both column classes
    const detailRoot = screen.getByTestId('situation-detail');
    const gridWrapper = detailRoot.querySelector('.grid-cols-1.lg\\:grid-cols-2');
    expect(gridWrapper).toBeInTheDocument();
    expect(gridWrapper!.className).toMatch(/grid-cols-1/);
    expect(gridWrapper!.className).toMatch(/lg:grid-cols-2/);
  });

  it('renders SourceCard + illustration placeholder when only source_url present', async () => {
    (situationAPI.getById as Mock).mockResolvedValue(
      createMockSituation({
        source_url: 'https://example.com/article',
        source_image_url: 'https://example.com/article-img.jpg',
        source_title: 'Article title',
        picture_url: null,
      })
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('situation-detail-hero')).toBeInTheDocument();
    });

    // SourceCard still renders
    expect(screen.getByText('Article title')).toBeInTheDocument();

    // Illustration placeholder (i18n key: situations.detail.about.illustrationPlaceholder)
    expect(screen.getByText('Illustration coming soon')).toBeInTheDocument();

    // Grid wrapper still carries both column classes
    const detailRoot = screen.getByTestId('situation-detail');
    const gridWrapper = detailRoot.querySelector('.grid-cols-1.lg\\:grid-cols-2');
    expect(gridWrapper).toBeInTheDocument();
    expect(gridWrapper!.className).toMatch(/grid-cols-1/);
    expect(gridWrapper!.className).toMatch(/lg:grid-cols-2/);
  });

  it('renders both placeholders when neither source_url nor picture_url present', async () => {
    (situationAPI.getById as Mock).mockResolvedValue(createMockSituation());

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('situation-detail-hero')).toBeInTheDocument();
    });

    // Source placeholder (i18n key: situations.detail.about.sourcePlaceholder)
    expect(screen.getByText('Source coming soon')).toBeInTheDocument();

    // Illustration placeholder
    expect(screen.getByText('Illustration coming soon')).toBeInTheDocument();

    // Grid wrapper still carries both column classes
    const detailRoot = screen.getByTestId('situation-detail');
    const gridWrapper = detailRoot.querySelector('.grid-cols-1.lg\\:grid-cols-2');
    expect(gridWrapper).toBeInTheDocument();
    expect(gridWrapper!.className).toMatch(/grid-cols-1/);
    expect(gridWrapper!.className).toMatch(/lg:grid-cols-2/);
  });
});
