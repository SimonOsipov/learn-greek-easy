// src/components/admin/__tests__/CultureCardForm.migration.unit.test.tsx
//
// RED tests for ADMIN2-38-05 — AC-4e Form primitive migration and
// C13 unit contract for the CultureCardForm create/always-edit variant.
//
// These tests use the REAL CultureCardForm (no mock) so they verify the
// actual form structure and submission path.
//
// AC-4e: fields must use shadcn Form/FormField/FormItem/FormMessage wiring.
//   Currently: bare register() + hand-rolled <p class="text-destructive"> → RED.
//   After migration: FormField wiring with aria-describedby + data-slot=form-message → GREEN.
//
// C13 unit: CultureCardForm with no initialData (create/always-edit variant)
//   must render culture-question-card-save as the single in-Card save button.
//   Currently: old submit-btn testid (conditional on deckId && !isSubmitting) → RED.
//   After migration: culture-question-card-save always present in create mode → GREEN.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import { CultureCardForm, type CultureCardFormProps } from '../CultureCardForm';
import type { CultureQuestionCreatePayload } from '@/services/adminAPI';
import i18n from '@/i18n';

// ── No vi.mock for CultureCardForm — we test the REAL component ───────────────

// We DO mock adminAPI to confirm the form never calls it directly.
vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    createCultureQuestion: vi.fn(),
    updateCultureQuestion: vi.fn(),
    listCultureQuestions: vi.fn(),
  },
}));

import { adminAPI } from '@/services/adminAPI';

// ── Render helper ─────────────────────────────────────────────────────────────

const renderForm = (props: Partial<CultureCardFormProps> = {}) => {
  const defaultProps: CultureCardFormProps = {
    onSubmit: vi.fn().mockResolvedValue(undefined),
    ...props,
  };

  return {
    ...render(
      <I18nextProvider i18n={i18n}>
        <CultureCardForm {...defaultProps} />
      </I18nextProvider>
    ),
    props: defaultProps,
  };
};

/** Fill the minimum required fields across all 3 language tabs */
async function fillAllLanguages(user: ReturnType<typeof userEvent.setup>) {
  // RU (default tab)
  await user.type(screen.getByTestId('question-input-ru'), 'Вопрос');
  await user.type(screen.getByTestId('answer-input-A-ru'), 'А');
  await user.type(screen.getByTestId('answer-input-B-ru'), 'Б');

  // EL
  await user.click(screen.getByTestId('lang-tab-el'));
  await user.type(screen.getByTestId('question-input-el'), 'Ερώτηση');
  await user.type(screen.getByTestId('answer-input-A-el'), 'Α');
  await user.type(screen.getByTestId('answer-input-B-el'), 'Β');

  // EN
  await user.click(screen.getByTestId('lang-tab-en'));
  await user.type(screen.getByTestId('question-input-en'), 'Question');
  await user.type(screen.getByTestId('answer-input-A-en'), 'A');
  await user.type(screen.getByTestId('answer-input-B-en'), 'B');
}

// ── AC-4e tests ───────────────────────────────────────────────────────────────

describe('CultureCardForm — AC-4e Form primitive migration (RED)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AC-4e: form inputs have aria-describedby (shadcn FormField/FormControl wiring)', () => {
    // After migration: FormField wraps each input via FormControl, which sets
    // aria-describedby to the FormMessage id (shadcn form.tsx useFormField).
    // Currently: bare register() — no aria-describedby → RED.
    renderForm({ deckId: 'test-deck' });

    const questionInput = screen.getByTestId('question-input-ru');
    // Migrated form: aria-describedby is set by FormControl
    expect(questionInput).toHaveAttribute('aria-describedby');
  });

  it('AC-4e: validation errors render via FormMessage (data-slot="form-message"), not hand-rolled <p>', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm({ deckId: 'test-deck', onSubmit });

    // Trigger validation by clicking the new in-Card save (empty form)
    const saveBtn = screen.getByTestId('culture-question-card-save');
    await user.click(saveBtn);

    await waitFor(() => {
      // shadcn FormMessage renders with data-slot="form-message"
      const formMessages = document.querySelectorAll('[data-slot="form-message"]');
      expect(formMessages.length).toBeGreaterThan(0);
    });

    // Hand-rolled error pattern (CultureCardForm.tsx:381-383) must be gone:
    // currently renders <p className="text-sm text-destructive"> outside FormItem.
    // After migration, all error rendering goes through FormMessage.
    // We verify: no bare <p> with text-destructive OUTSIDE a [data-slot] ancestor.
    const bareErrors = document.querySelectorAll('p.text-destructive:not([data-slot])');
    // After migration, bare error <p> elements are replaced by FormMessage
    expect(bareErrors.length).toBe(0);
  });
});

// ── C13 unit tests ────────────────────────────────────────────────────────────

describe('CultureCardForm — C13 unit: create/always-edit variant (RED)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('C13 unit: create variant (no initialData) renders culture-question-card-save immediately', () => {
    // After migration: CultureCardForm with no initialData is always in edit/create
    // mode and renders the new in-Card Save button (single save path, AC-4c/D5).
    // Currently: renders submit-btn (when deckId provided) NOT culture-question-card-save → RED.
    renderForm({ deckId: 'create-deck-id' });

    expect(screen.getByTestId('culture-question-card-save')).toBeInTheDocument();
    // No Pencil edit button in create mode (nothing to "read" yet)
    expect(screen.queryByTestId('culture-question-edit-btn')).not.toBeInTheDocument();
  });

  it('C13 unit: fill + submit → injected onSubmit called once with correct CultureQuestionCreatePayload', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    renderForm({ deckId: 'create-deck-id', onSubmit });

    await fillAllLanguages(user);

    // Submit via the single in-Card save button
    await user.click(screen.getByTestId('culture-question-card-save'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const payload = onSubmit.mock.calls[0][0] as CultureQuestionCreatePayload;

    expect(payload.deck_id).toBe('create-deck-id');
    expect(payload.question_text).toEqual(
      expect.objectContaining({ ru: 'Вопрос', el: 'Ερώτηση', en: 'Question' })
    );
    expect(payload.option_a).toEqual(expect.objectContaining({ ru: 'А', el: 'Α', en: 'A' }));
    expect(payload.option_b).toEqual(expect.objectContaining({ ru: 'Б', el: 'Β', en: 'B' }));
    expect(payload.option_c).toBeNull();
    expect(payload.option_d).toBeNull();
    expect(typeof payload.correct_option).toBe('number');
  });

  it('C13 unit: form does NOT call adminAPI.createCultureQuestion (only calls injected onSubmit)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    renderForm({ deckId: 'no-api-deck', onSubmit });

    await fillAllLanguages(user);
    await user.click(screen.getByTestId('culture-question-card-save'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    // The form must not call adminAPI directly — only the injected onSubmit prop
    expect(adminAPI.createCultureQuestion).not.toHaveBeenCalled();
  });
});
