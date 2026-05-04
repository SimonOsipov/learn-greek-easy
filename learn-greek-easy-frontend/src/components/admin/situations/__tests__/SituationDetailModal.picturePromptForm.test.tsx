/**
 * SituationDetailModal — picture tab empty-state branch
 *
 * Covers the single branch: when selectedSituation.picture === null,
 * the `data-testid="situation-picture-empty"` placeholder IS rendered
 * and `data-testid="picture-prompt-form"` is NOT rendered.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import type { ReactNode } from 'react';

import i18n from '@/i18n';
import { useAdminSituationStore } from '@/stores/adminSituationStore';
import type { SituationDetailResponse } from '@/types/situation';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/services/adminAPI', () => ({
  GENERATE_WORD_ENTRY_STREAM_URL: '/api/v1/admin/word-entries/generate/stream',
  adminAPI: {
    updateSituationPicture: vi.fn(),
    getSituationDetail: vi.fn(),
  },
  getDialogAudioStreamUrl: vi.fn((id: string) => `/api/v1/admin/dialogs/${id}/audio/stream`),
  getDescriptionAudioStreamUrl: vi.fn(
    (id: string, level: string) =>
      `/api/v1/admin/situations/${id}/description-audio/${level}/stream`
  ),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ currentLanguage: 'en' }),
}));

vi.mock('@/hooks/useSSE', () => ({
  useSSE: vi.fn(() => ({ state: 'disconnected', close: vi.fn() })),
}));

vi.mock('@/hooks/useAudioTimeMs', () => ({
  useAudioTimeMs: vi.fn(() => 0),
}));

vi.mock('@/components/culture/WaveformPlayer', () => ({
  WaveformPlayer: () => <div data-testid="mock-waveform-player" />,
}));

vi.mock('@/components/shared/KaraokeText', () => ({
  KaraokeText: ({ fallbackText }: { fallbackText: string }) => <span>{fallbackText}</span>,
}));

// ── Import after mocks ─────────────────────────────────────────────────────

import { SituationDetailModal } from '../SituationDetailModal';

// ── Helpers ────────────────────────────────────────────────────────────────

const initialStoreState = useAdminSituationStore.getState();

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

const baseSituation: SituationDetailResponse = {
  id: 'sit-bbb',
  scenario_en: 'Test scenario',
  scenario_el: 'Δοκιμαστικό σενάριο',
  scenario_ru: 'Тестовый сценарий',
  status: 'draft',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  dialog: null,
  description: null,
  picture: null,
};

// ── Setup / teardown ───────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  useAdminSituationStore.setState(initialStoreState, true);
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('SituationDetailModal — picture tab empty state', () => {
  it('shows situation-picture-empty and hides picture-prompt-form when picture is null', async () => {
    const user = userEvent.setup();

    // Seed store with a situation that has picture === null
    useAdminSituationStore.setState({
      ...initialStoreState,
      selectedSituation: { ...baseSituation, picture: null },
      isLoadingDetail: false,
      detailError: null,
      fetchSituationDetail: vi.fn().mockResolvedValue(undefined),
    });

    render(<SituationDetailModal situationId="sit-bbb" open={true} onOpenChange={vi.fn()} />, {
      wrapper,
    });

    // Click the picture tab
    const pictureTab = await screen.findByTestId('situation-tab-picture');
    await user.click(pictureTab);

    await waitFor(() => {
      expect(screen.getByTestId('situation-picture-empty')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('picture-prompt-form')).not.toBeInTheDocument();
  });
});
