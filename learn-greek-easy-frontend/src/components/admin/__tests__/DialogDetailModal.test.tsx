/**
 * DialogDetailModal Component Tests
 *
 * Tests for karaoke word rendering feature ([LDLG-POL3-02]):
 * - word_timestamps null → plain text fallback
 * - word_timestamps empty array → plain text fallback
 * - audioCurrentTimeMs === 0 → plain text fallback
 * - Karaoke states at mid-playback (spoken/speaking/pending)
 * - Space rendering between words
 */

import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { DialogDetailModal } from '../DialogDetailModal';
import i18n from '@/i18n';
import { useAdminDialogStore } from '@/stores/adminDialogStore';

// ============================================
// NOTE on the Radix Dialog + useEffect + Portal pattern
// ============================================
// DialogDetailModal's Effect 3 (timeupdate listener) depends on [selectedDialog].
// When selectedDialog starts as null, the effect returns early.
// When selectedDialog becomes non-null, the effect re-runs. By that time the
// Radix Dialog portal IS mounted and containerRef.current is populated.
//
// In tests, we must replicate this lifecycle:
//   1. Start with selectedDialog: null → render (portal mounts, ref attaches)
//   2. Update mockStoreState.selectedDialog → rerender → Effect 3 re-runs → listener attaches
//   3. Dispatch timeupdate → state updates → karaoke renders

// ============================================
// Mocks
// ============================================

vi.mock('@/components/culture/WaveformPlayer', () => ({
  WaveformPlayer: ({ audioUrl }: { audioUrl: string }) => (
    <div data-testid="waveform-mock">
      <audio data-testid="waveform-audio-element" src={audioUrl} />
    </div>
  ),
}));

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ currentLanguage: 'en' }),
}));

let mockStoreState: Partial<ReturnType<typeof useAdminDialogStore>>;

vi.mock('@/stores/adminDialogStore', () => ({
  useAdminDialogStore: () => mockStoreState,
}));

// ============================================
// Test Data
// ============================================

const mockWordTimestamps = [
  { word: 'Γεια', start_ms: 0, end_ms: 500 },
  { word: 'σου', start_ms: 500, end_ms: 1000 },
  { word: 'κόσμε', start_ms: 1000, end_ms: 1500 },
];

const mockDialog = {
  id: 'dlg-1',
  scenario_el: 'Σκηνή.',
  scenario_en: 'Scene.',
  scenario_ru: 'Сцена.',
  cefr_level: 'A1' as const,
  num_speakers: 1,
  status: 'audio_ready' as const,
  audio_url: 'https://example.com/audio.mp3',
  audio_duration_seconds: 3,
  speakers: [{ id: 'sp-1', speaker_index: 0, character_name: 'Nikos', voice_id: 'voice-1' }],
  lines: [
    {
      id: 'line-1',
      line_index: 0,
      speaker_id: 'sp-1',
      text: 'Γεια σου κόσμε',
      start_time_ms: 0,
      end_time_ms: 3000,
      word_timestamps: mockWordTimestamps,
    },
  ],
};

// ============================================
// Wrapper
// ============================================

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

const Wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
  </QueryClientProvider>
);

// ============================================
// Helpers
// ============================================

const baseStoreState = () => ({
  selectedDialog: null,
  isLoadingDetail: false,
  detailError: null,
  fetchDialogDetail: vi.fn().mockResolvedValue(undefined),
  clearSelectedDialog: vi.fn(),
  // List state
  dialogs: [],
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0,
  isLoading: false,
  isDeleting: false,
  isCreating: false,
  error: null,
  cefrFilter: null,
  fetchDialogs: vi.fn(),
  deleteDialog: vi.fn(),
  createDialog: vi.fn(),
  setPage: vi.fn(),
  clearError: vi.fn(),
  setCefrFilter: vi.fn(),
});

const renderModal = (props?: { dialogId?: string | null; open?: boolean }) => {
  return render(
    <DialogDetailModal
      dialogId={props?.dialogId ?? 'dlg-1'}
      open={props?.open ?? true}
      onOpenChange={vi.fn()}
    />,
    { wrapper: Wrapper }
  );
};

// ============================================
// Tests
// ============================================

describe('DialogDetailModal - Karaoke Word Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState = baseStoreState();
  });

  it('renders plain text when word_timestamps is null', () => {
    mockStoreState = {
      ...baseStoreState(),
      selectedDialog: {
        ...mockDialog,
        lines: [{ ...mockDialog.lines[0], word_timestamps: null }],
      },
    };

    renderModal();

    const para = screen.getByText('Γεια σου κόσμε');
    expect(para.tagName).toBe('P');
    // No individual word spans inside this paragraph
    expect(para.querySelectorAll('span')).toHaveLength(0);
  });

  it('renders plain text when word_timestamps is an empty array', () => {
    mockStoreState = {
      ...baseStoreState(),
      selectedDialog: {
        ...mockDialog,
        lines: [{ ...mockDialog.lines[0], word_timestamps: [] }],
      },
    };

    renderModal();

    const para = screen.getByText('Γεια σου κόσμε');
    expect(para.tagName).toBe('P');
    expect(para.querySelectorAll('span')).toHaveLength(0);
  });

  it('renders plain text when audioCurrentTimeMs is 0 (default, no timeupdate dispatched)', () => {
    mockStoreState = {
      ...baseStoreState(),
      selectedDialog: mockDialog,
    };

    renderModal();

    // audioCurrentTimeMs defaults to 0, so the fallback plain <p> renders
    const para = screen.getByText('Γεια σου κόσμε');
    expect(para.tagName).toBe('P');
    expect(para.querySelectorAll('span')).toHaveLength(0);
  });

  it('applies correct karaoke state classes at mid-playback (750ms)', async () => {
    // Phase 1: render with selectedDialog=null so portal mounts and ref attaches
    mockStoreState = baseStoreState();
    const { rerender } = renderModal();

    // Phase 2: update selectedDialog → triggers Effect 3 re-run with containerRef populated
    await act(async () => {
      mockStoreState = { ...baseStoreState(), selectedDialog: mockDialog };
      rerender(<DialogDetailModal dialogId="dlg-1" open={true} onOpenChange={vi.fn()} />);
    });

    // Phase 3: dispatch timeupdate to trigger karaoke state
    const audioEl = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;
    await act(async () => {
      Object.defineProperty(audioEl, 'currentTime', { value: 0.75, configurable: true });
      audioEl.dispatchEvent(new Event('timeupdate'));
    });

    // The Radix Dialog renders via a portal to document.body.
    // Find the karaoke <p> (contains <span> children).
    const allParas = document.querySelectorAll('p.text-sm');
    const karaokeParas = Array.from(allParas).filter((p) => p.querySelectorAll('span').length > 0);
    expect(karaokeParas).toHaveLength(1);

    const karaokeP = karaokeParas[0];
    const spans = Array.from(karaokeP.querySelectorAll('span'));

    // There should be exactly 3 word spans
    expect(spans).toHaveLength(3);

    // 'Γεια': end_ms=500 <= 750ms → spoken → has text-foreground
    expect(spans[0].textContent).toContain('Γεια');
    expect(spans[0].className).toContain('text-foreground');
    expect(spans[0].className).not.toContain('text-muted-foreground');

    // 'σου': start_ms=500 <= 750ms, end_ms=1000 > 750ms → speaking → has bg-primary/20
    expect(spans[1].textContent).toContain('σου');
    expect(spans[1].className).toContain('bg-primary/20');

    // 'κόσμε': start_ms=1000 > 750ms → pending → has text-muted-foreground
    expect(spans[2].textContent).toContain('κόσμε');
    expect(spans[2].className).toContain('text-muted-foreground');
  });

  it('renders words separated by single spaces', async () => {
    // Phase 1: render with selectedDialog=null
    mockStoreState = baseStoreState();
    const { rerender } = renderModal();

    // Phase 2: update selectedDialog → Effect 3 re-runs, attaches timeupdate listener
    await act(async () => {
      mockStoreState = { ...baseStoreState(), selectedDialog: mockDialog };
      rerender(<DialogDetailModal dialogId="dlg-1" open={true} onOpenChange={vi.fn()} />);
    });

    // Phase 3: dispatch timeupdate
    const audioEl = screen.getByTestId('waveform-audio-element') as HTMLAudioElement;
    await act(async () => {
      Object.defineProperty(audioEl, 'currentTime', { value: 0.75, configurable: true });
      audioEl.dispatchEvent(new Event('timeupdate'));
    });

    // Find the karaoke <p>
    const allParas = document.querySelectorAll('p.text-sm');
    const karaokeParas = Array.from(allParas).filter((p) => p.querySelectorAll('span').length > 0);
    expect(karaokeParas).toHaveLength(1);

    const karaokeP = karaokeParas[0];
    const spans = Array.from(karaokeP.querySelectorAll('span'));
    expect(spans).toHaveLength(3);

    // The parent <p> textContent should be 'Γεια σου κόσμε'
    expect(karaokeP.textContent).toBe('Γεια σου κόσμε');
  });
});
