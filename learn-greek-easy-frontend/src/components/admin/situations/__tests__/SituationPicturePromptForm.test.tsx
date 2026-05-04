/**
 * SituationPicturePromptForm Component Tests
 *
 * Covers:
 * - hydration: all four textareas show loaded values, Save disabled when pristine
 * - trio guard: typing only scene_en keeps Save disabled and shows trio hint;
 *   clearing returns to pristine
 * - cancel: edits + Cancel resets all four and disables Save
 * - Cmd/Ctrl+Enter: shortcut on a textarea calls adminAPI.updateSituationPicture once
 * - payload shape: API body has all four keys (null for cleared, trimmed for populated)
 * - success: toast fires, store fetchSituationDetail invoked
 * - error: 422 rejection → destructive alert visible, Save re-enabled
 */

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import type { ReactNode } from 'react';

import i18n from '@/i18n';
import { adminAPI } from '@/services/adminAPI';
import { useAdminSituationStore } from '@/stores/adminSituationStore';
import type { PictureNested } from '@/types/situation';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/services/adminAPI', () => ({
  GENERATE_WORD_ENTRY_STREAM_URL: '/api/v1/admin/word-entries/generate/stream',
  adminAPI: {
    updateSituationPicture: vi.fn(),
  },
  getDialogAudioStreamUrl: vi.fn((id: string) => `/api/v1/admin/dialogs/${id}/audio/stream`),
  getDescriptionAudioStreamUrl: vi.fn(
    (id: string, level: string) =>
      `/api/v1/admin/situations/${id}/description-audio/${level}/stream`
  ),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (args: unknown) => mockToast(args),
}));

// ── Imports after mocks ────────────────────────────────────────────────────

import { PicturePromptForm } from '../SituationPicturePromptForm';

// ── Helpers ────────────────────────────────────────────────────────────────

const initialStoreState = useAdminSituationStore.getState();

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

const makePicture = (overrides: Partial<PictureNested> = {}): PictureNested => ({
  id: 'pic-111',
  image_prompt: '',
  status: 'draft',
  created_at: '2026-01-01T00:00:00Z',
  scene_en: 'A sunny beach',
  scene_el: 'Μια ηλιόλουστη παραλία',
  scene_ru: 'Солнечный пляж',
  style_en: 'Photorealistic',
  ...overrides,
});

const SITUATION_ID = 'sit-aaa';

const renderForm = (picture: PictureNested = makePicture()) =>
  render(<PicturePromptForm situationId={SITUATION_ID} picture={picture} />, { wrapper });

// ── Setup / teardown ───────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Seed fetchSituationDetail as a mock so it can be verified
  useAdminSituationStore.setState({
    ...initialStoreState,
    fetchSituationDetail: vi.fn().mockResolvedValue(undefined),
  });
});

afterEach(() => {
  cleanup();
  useAdminSituationStore.setState(initialStoreState, true);
});

// ── Test suite ─────────────────────────────────────────────────────────────

describe('SituationPicturePromptForm', () => {
  // ── Hydration ─────────────────────────────────────────────────────────

  describe('hydration', () => {
    it('renders the form root with correct testid', () => {
      renderForm();
      expect(screen.getByTestId('picture-prompt-form')).toBeInTheDocument();
    });

    it('shows loaded values in all four textareas', () => {
      const pic = makePicture();
      renderForm(pic);

      expect(screen.getByTestId('picture-prompt-scene-en')).toHaveValue(pic.scene_en!);
      expect(screen.getByTestId('picture-prompt-scene-el')).toHaveValue(pic.scene_el!);
      expect(screen.getByTestId('picture-prompt-scene-ru')).toHaveValue(pic.scene_ru!);
      expect(screen.getByTestId('picture-prompt-style-en')).toHaveValue(pic.style_en!);
    });

    it('Save is disabled when form is pristine', () => {
      renderForm();
      expect(screen.getByTestId('picture-prompt-save')).toBeDisabled();
    });

    it('Cancel is disabled when form is pristine', () => {
      renderForm();
      expect(screen.getByTestId('picture-prompt-cancel')).toBeDisabled();
    });
  });

  // ── Trio guard ────────────────────────────────────────────────────────

  describe('trio guard', () => {
    it('keeps Save disabled and shows trio hint when only scene_en is typed', async () => {
      const user = userEvent.setup();
      renderForm();

      // Clear scene_el and scene_ru so only scene_en has content
      const elTextarea = screen.getByTestId('picture-prompt-scene-el');
      const ruTextarea = screen.getByTestId('picture-prompt-scene-ru');
      await user.clear(elTextarea);
      await user.clear(ruTextarea);

      // Verify Save is disabled and trio hint is visible
      expect(screen.getByTestId('picture-prompt-save')).toBeDisabled();
      // Trio hint alert should appear (trioPartial = true)
      // The alert contains the trioRuleHint i18n key text — just check Alert is present
      const alerts = document.querySelectorAll('[role="alert"]');
      expect(alerts.length).toBeGreaterThan(0);
    });

    it('re-enables Save after filling all three scene fields', async () => {
      const user = userEvent.setup();
      // Start with empty picture so trio starts at all-empty (not partial)
      renderForm(makePicture({ scene_en: '', scene_el: '', scene_ru: '', style_en: '' }));

      // All empty → pristine → Save disabled but no trio alert yet
      expect(screen.getByTestId('picture-prompt-save')).toBeDisabled();

      // Type all three
      await user.type(screen.getByTestId('picture-prompt-scene-en'), 'Beach');
      await user.type(screen.getByTestId('picture-prompt-scene-el'), 'Παραλία');
      await user.type(screen.getByTestId('picture-prompt-scene-ru'), 'Пляж');

      // Now all three have content → no trio partial → Save enabled
      await waitFor(() => {
        expect(screen.getByTestId('picture-prompt-save')).not.toBeDisabled();
      });
    });
  });

  // ── Cancel ────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('resets all four fields and disables Save after Cancel', async () => {
      const user = userEvent.setup();
      const pic = makePicture();
      renderForm(pic);

      // Edit all four fields
      const enTA = screen.getByTestId('picture-prompt-scene-en');
      const elTA = screen.getByTestId('picture-prompt-scene-el');
      const ruTA = screen.getByTestId('picture-prompt-scene-ru');
      const styleTA = screen.getByTestId('picture-prompt-style-en');

      await user.clear(enTA);
      await user.type(enTA, 'New scene EN');
      await user.clear(elTA);
      await user.type(elTA, 'New scene EL');
      await user.clear(ruTA);
      await user.type(ruTA, 'New scene RU');
      await user.clear(styleTA);
      await user.type(styleTA, 'New style');

      // Cancel
      await user.click(screen.getByTestId('picture-prompt-cancel'));

      // All fields back to original values
      expect(screen.getByTestId('picture-prompt-scene-en')).toHaveValue(pic.scene_en!);
      expect(screen.getByTestId('picture-prompt-scene-el')).toHaveValue(pic.scene_el!);
      expect(screen.getByTestId('picture-prompt-scene-ru')).toHaveValue(pic.scene_ru!);
      expect(screen.getByTestId('picture-prompt-style-en')).toHaveValue(pic.style_en!);

      // Save and Cancel disabled again
      expect(screen.getByTestId('picture-prompt-save')).toBeDisabled();
      expect(screen.getByTestId('picture-prompt-cancel')).toBeDisabled();
    });
  });

  // ── Cmd/Ctrl+Enter ────────────────────────────────────────────────────

  describe('keyboard shortcut Cmd/Ctrl+Enter', () => {
    it('calls adminAPI.updateSituationPicture once when focused on a textarea with edits', async () => {
      const user = userEvent.setup();
      (adminAPI.updateSituationPicture as Mock).mockResolvedValue(makePicture());

      renderForm();

      // Make an edit so save is enabled
      const styleTA = screen.getByTestId('picture-prompt-style-en');
      await user.clear(styleTA);
      await user.type(styleTA, 'Updated style');

      // Focus and press Ctrl+Enter
      styleTA.focus();
      await user.keyboard('{Control>}{Enter}{/Control}');

      await waitFor(() => {
        expect(adminAPI.updateSituationPicture).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ── Payload shape ─────────────────────────────────────────────────────

  describe('payload shape', () => {
    it('sends all four keys; cleared fields become null, populated are trimmed', async () => {
      const user = userEvent.setup();
      (adminAPI.updateSituationPicture as Mock).mockResolvedValue(makePicture());

      renderForm(makePicture({ style_en: '  Old style  ' }));

      // Clear scene_el and scene_ru (these will be null)
      // Keep scene_en unchanged ("A sunny beach") and update style_en
      const elTA = screen.getByTestId('picture-prompt-scene-el');
      const ruTA = screen.getByTestId('picture-prompt-scene-ru');
      const styleTA = screen.getByTestId('picture-prompt-style-en');

      await user.clear(elTA);
      await user.clear(ruTA);
      await user.clear(styleTA);

      // Now only scene_en has content → trio partial → Save still disabled
      // We need all three or none. Let's also clear scene_en so none have content.
      const enTA = screen.getByTestId('picture-prompt-scene-en');
      await user.clear(enTA);

      // All scene fields empty → not trio partial → form is dirty (differs from initial)
      // Save should be enabled now
      await waitFor(() => {
        expect(screen.getByTestId('picture-prompt-save')).not.toBeDisabled();
      });

      await user.click(screen.getByTestId('picture-prompt-save'));

      await waitFor(() => {
        expect(adminAPI.updateSituationPicture).toHaveBeenCalledWith(SITUATION_ID, {
          scene_en: null,
          scene_el: null,
          scene_ru: null,
          style_en: null,
        });
      });
    });

    it('trims whitespace from non-empty values', async () => {
      const user = userEvent.setup();
      (adminAPI.updateSituationPicture as Mock).mockResolvedValue(makePicture());

      renderForm(makePicture({ scene_en: '', scene_el: '', scene_ru: '', style_en: '' }));

      // Type values with surrounding spaces
      await user.type(screen.getByTestId('picture-prompt-scene-en'), '  Beach  ');
      await user.type(screen.getByTestId('picture-prompt-scene-el'), '  Παραλία  ');
      await user.type(screen.getByTestId('picture-prompt-scene-ru'), '  Пляж  ');
      await user.type(screen.getByTestId('picture-prompt-style-en'), '  Photo  ');

      await user.click(screen.getByTestId('picture-prompt-save'));

      await waitFor(() => {
        expect(adminAPI.updateSituationPicture).toHaveBeenCalledWith(SITUATION_ID, {
          scene_en: 'Beach',
          scene_el: 'Παραλία',
          scene_ru: 'Пляж',
          style_en: 'Photo',
        });
      });
    });
  });

  // ── Success path ──────────────────────────────────────────────────────

  describe('success', () => {
    it('fires a success toast after save', async () => {
      const user = userEvent.setup();
      (adminAPI.updateSituationPicture as Mock).mockResolvedValue(makePicture());

      renderForm();

      // Edit style_en to make form dirty (all trio fields still complete)
      const styleTA = screen.getByTestId('picture-prompt-style-en');
      await user.clear(styleTA);
      await user.type(styleTA, 'Updated style');

      await user.click(screen.getByTestId('picture-prompt-save'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledTimes(1);
      });
      // Toast should not be destructive
      const toastArg = mockToast.mock.calls[0][0] as Record<string, unknown>;
      expect(toastArg.variant).not.toBe('destructive');
    });

    it('calls store fetchSituationDetail with the situationId after save', async () => {
      const user = userEvent.setup();
      (adminAPI.updateSituationPicture as Mock).mockResolvedValue(makePicture());

      renderForm();

      const styleTA = screen.getByTestId('picture-prompt-style-en');
      await user.clear(styleTA);
      await user.type(styleTA, 'Updated');

      await user.click(screen.getByTestId('picture-prompt-save'));

      await waitFor(() => {
        const { fetchSituationDetail } = useAdminSituationStore.getState();
        expect(fetchSituationDetail).toHaveBeenCalledWith(SITUATION_ID);
      });
    });

    it('disables Save again (back to pristine) after successful save', async () => {
      const user = userEvent.setup();
      (adminAPI.updateSituationPicture as Mock).mockResolvedValue(makePicture());

      renderForm();

      const styleTA = screen.getByTestId('picture-prompt-style-en');
      await user.clear(styleTA);
      await user.type(styleTA, 'Updated style');

      await user.click(screen.getByTestId('picture-prompt-save'));

      await waitFor(() => {
        expect(screen.getByTestId('picture-prompt-save')).toBeDisabled();
      });
    });
  });

  // ── Error path ────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('shows destructive alert and re-enables Save on API rejection', async () => {
      const user = userEvent.setup();
      (adminAPI.updateSituationPicture as Mock).mockRejectedValue(new Error('Validation failed'));

      renderForm();

      const styleTA = screen.getByTestId('picture-prompt-style-en');
      await user.clear(styleTA);
      await user.type(styleTA, 'Something');

      await user.click(screen.getByTestId('picture-prompt-save'));

      await waitFor(() => {
        // A destructive alert should appear
        const alerts = document.querySelectorAll('[role="alert"]');
        expect(alerts.length).toBeGreaterThan(0);
      });

      // Save should be re-enabled after the error
      expect(screen.getByTestId('picture-prompt-save')).not.toBeDisabled();
    });

    it('does not fire toast on error', async () => {
      const user = userEvent.setup();
      (adminAPI.updateSituationPicture as Mock).mockRejectedValue(new Error('Server error'));

      renderForm();

      const styleTA = screen.getByTestId('picture-prompt-style-en');
      await user.clear(styleTA);
      await user.type(styleTA, 'Something');

      await user.click(screen.getByTestId('picture-prompt-save'));

      await waitFor(() => {
        const alerts = document.querySelectorAll('[role="alert"]');
        expect(alerts.length).toBeGreaterThan(0);
      });

      expect(mockToast).not.toHaveBeenCalled();
    });
  });
});
