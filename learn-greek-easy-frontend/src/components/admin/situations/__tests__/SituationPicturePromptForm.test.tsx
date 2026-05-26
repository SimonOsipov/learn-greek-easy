/**
 * SituationPicturePromptForm Component Tests (SAR2-26-14 — Option A)
 *
 * After folding picture fields into the drawer's RHF form, PicturePromptForm
 * renders four read/write textareas wired via useFormContext. Lifecycle
 * (save, cancel, trio validation) is now owned by SituationDrawer.tsx.
 *
 * This suite verifies:
 * - form renders with correct testids
 * - textareas are populated from RHF default values
 * - the style_en hint text is rendered (SAR2-26-12c)
 * - no standalone Save / Cancel buttons remain in the form
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { I18nextProvider } from 'react-i18next';
import type { ReactNode } from 'react';

import i18n from '@/i18n';
import type { PictureNested } from '@/types/situation';
import type { SituationDrawerFormData } from '../SituationDrawer';

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

// ── Imports after mocks ────────────────────────────────────────────────────

import { PicturePromptForm } from '../SituationPicturePromptForm';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeDefaultValues(
  overrides: Partial<SituationDrawerFormData['picture']> = {}
): SituationDrawerFormData {
  return {
    scenario_el: '',
    scenario_en: '',
    scenario_ru: '',
    description: { text_el: '', text_el_a2: '', text_en: '' },
    picture: {
      scene_en: 'A sunny beach',
      scene_el: 'Μια ηλιόλουστη παραλία',
      scene_ru: 'Солнечный пляж',
      style_en: 'Photorealistic',
      ...overrides,
    },
  };
}

const basePicture: PictureNested = {
  id: 'pic-111',
  image_prompt: '',
  status: 'draft',
  created_at: '2026-01-01T00:00:00Z',
  scene_en: 'A sunny beach',
  scene_el: 'Μια ηλιόλουστη παραλία',
  scene_ru: 'Солнечный пляж',
  style_en: 'Photorealistic',
  image_url: null,
};

const SITUATION_ID = 'sit-aaa';

function Wrapper({
  children,
  defaultValues,
}: {
  children: ReactNode;
  defaultValues?: SituationDrawerFormData;
}) {
  const methods = useForm<SituationDrawerFormData>({
    defaultValues: defaultValues ?? makeDefaultValues(),
  });
  return (
    <I18nextProvider i18n={i18n}>
      <FormProvider {...methods}>{children}</FormProvider>
    </I18nextProvider>
  );
}

function renderForm(picture: PictureNested = basePicture, defaultValues?: SituationDrawerFormData) {
  return render(
    <Wrapper defaultValues={defaultValues}>
      <PicturePromptForm situationId={SITUATION_ID} picture={picture} />
    </Wrapper>
  );
}

// ── Setup / teardown ───────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

// ── Test suite ─────────────────────────────────────────────────────────────

describe('SituationPicturePromptForm (Option A — drawer RHF)', () => {
  describe('rendering', () => {
    it('renders the form root with correct testid', () => {
      renderForm();
      expect(screen.getByTestId('picture-prompt-form')).toBeInTheDocument();
    });

    it('shows loaded values in all four textareas from RHF defaults', () => {
      renderForm();
      expect(screen.getByTestId('picture-prompt-scene-en')).toHaveValue('A sunny beach');
      expect(screen.getByTestId('picture-prompt-scene-el')).toHaveValue('Μια ηλιόλουστη παραλία');
      expect(screen.getByTestId('picture-prompt-scene-ru')).toHaveValue('Солнечный пляж');
      expect(screen.getByTestId('picture-prompt-style-en')).toHaveValue('Photorealistic');
    });

    it('renders four textareas with correct testids', () => {
      renderForm();
      expect(screen.getByTestId('picture-prompt-scene-en')).toBeInTheDocument();
      expect(screen.getByTestId('picture-prompt-scene-el')).toBeInTheDocument();
      expect(screen.getByTestId('picture-prompt-scene-ru')).toBeInTheDocument();
      expect(screen.getByTestId('picture-prompt-style-en')).toBeInTheDocument();
    });
  });

  describe('SAR2-26-12c — style prompt hint', () => {
    it('renders hint for style_en field', () => {
      renderForm();
      const hint = screen.getByTestId('picture-prompt-hint-style-en');
      expect(hint).toBeInTheDocument();
      // Hint should mention catalog-lock guidance
      expect(hint.textContent).toBeTruthy();
    });

    it('does not render hints for scene fields', () => {
      renderForm();
      expect(screen.queryByTestId('picture-prompt-hint-scene-en')).toBeNull();
      expect(screen.queryByTestId('picture-prompt-hint-scene-el')).toBeNull();
      expect(screen.queryByTestId('picture-prompt-hint-scene-ru')).toBeNull();
    });
  });

  describe('SAR2-26-14 — no standalone save/cancel buttons', () => {
    it('does not render a Save button', () => {
      renderForm();
      expect(screen.queryByTestId('picture-prompt-save')).toBeNull();
    });

    it('does not render a Cancel button', () => {
      renderForm();
      expect(screen.queryByTestId('picture-prompt-cancel')).toBeNull();
    });
  });
});
