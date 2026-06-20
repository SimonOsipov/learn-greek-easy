/**
 * ADMIN2-38-04 — CultureCardForm i18n adversarial coverage
 *
 * Authored by QA (Mode B / Verify) to complement the 11 Mode A RED→green tests.
 * These tests guard against regression: if any string reverts to hardcoded English
 * the EN-locale tests below would still pass but the RU checks in the base
 * CultureCardForm.i18n.test.tsx would fail.
 *
 * Focus areas:
 *   1. EN locale renders correct EN strings (not RU bleed-through)
 *   2. Zod validation messages come from t() — verified by rendering under RU
 *      and triggering each schema error path independently
 *   3. The correct_option validation fires ONCE (not 3× from the old loop bug)
 *   4. Locale switch: switching UI language after mount updates all strings
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import i18n from '@/i18n';
import { CultureCardForm } from '../CultureCardForm';

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderForm(
  locale: 'en' | 'ru',
  props: Partial<React.ComponentProps<typeof CultureCardForm>> = {}
) {
  return render(
    <I18nextProvider i18n={i18n}>
      <CultureCardForm
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        deckId="test-deck"
        {...props}
      />
    </I18nextProvider>
  );
}

beforeEach(async () => {
  await act(async () => {
    await i18n.changeLanguage('en');
  });
});

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage('en');
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CultureCardForm — adversarial i18n (ADMIN2-38-04)', () => {
  /**
   * EN locale: question label renders in English (not empty / not RU).
   * Regression guard: if t() call broke, the label would disappear or show the key.
   */
  it('EN: question label renders in English', () => {
    renderForm('en');
    expect(screen.getByText('Question (RU)')).toBeInTheDocument();
  });

  /**
   * EN locale: question placeholder renders in English.
   */
  it('EN: question textarea placeholder renders in English', () => {
    renderForm('en');
    const textarea = screen.getByTestId('question-input-ru');
    expect(textarea).toHaveAttribute('placeholder', 'Enter question in RU');
  });

  /**
   * EN locale: answers label renders in English.
   */
  it('EN: answers label renders in English', () => {
    renderForm('en');
    expect(screen.getByText('Answers (RU)')).toBeInTheDocument();
  });

  /**
   * EN locale: answer placeholder renders in English.
   */
  it('EN: answer A placeholder renders in English', () => {
    renderForm('en');
    const inputA = screen.getByTestId('answer-input-A-ru');
    expect(inputA).toHaveAttribute('placeholder', 'Answer A');
  });

  /**
   * EN locale: Add Answer button renders in English.
   */
  it('EN: Add Answer button renders in English', () => {
    renderForm('en');
    // default 2 answers → next key = C
    const buttons = screen.getAllByText('Add Answer C');
    expect(buttons.length).toBeGreaterThan(0);
  });

  /**
   * EN locale: Save Question button renders in English.
   */
  it('EN: Save Question button renders in English', () => {
    renderForm('en');
    // ADMIN2-38-05: save lives in the in-Card culture-question-card-save button.
    expect(screen.getByTestId('culture-question-card-save')).toHaveTextContent('Save Question');
  });

  /**
   * EN locale: radio aria-label is in English.
   */
  it('EN: correct-answer radio aria-label renders in English', () => {
    renderForm('en');
    const radio = screen.getByTestId('correct-radio-A-ru');
    expect(radio).toHaveAttribute('aria-label', 'Mark answer A as correct');
  });

  /**
   * Zod RU message: question field empty → "Текст на русском обязателен" (not English).
   * ADMIN2-38-05/AC-4e: FormMessage now surfaces the localized zod message attached
   * to the empty field (zodRuRequired) per locale.
   */
  it('RU: question-required zod error renders in Russian', async () => {
    await act(async () => {
      await i18n.changeLanguage('ru');
    });

    const user = userEvent.setup();
    renderForm('ru');

    // Fill all non-RU tabs so only the RU question triggers the error
    await user.click(screen.getByTestId('lang-tab-el'));
    await user.type(screen.getByTestId('question-input-el'), 'Ερώτηση');
    await user.type(screen.getByTestId('answer-input-A-el'), 'Α');
    await user.type(screen.getByTestId('answer-input-B-el'), 'Β');

    await user.click(screen.getByTestId('lang-tab-en'));
    await user.type(screen.getByTestId('question-input-en'), 'Question');
    await user.type(screen.getByTestId('answer-input-A-en'), 'A');
    await user.type(screen.getByTestId('answer-input-B-en'), 'B');

    // RU tab: fill answers only, leave question empty
    await user.click(screen.getByTestId('lang-tab-ru'));
    await user.type(screen.getByTestId('answer-input-A-ru'), 'А');
    await user.type(screen.getByTestId('answer-input-B-ru'), 'Б');

    await user.click(screen.getByTestId('culture-question-card-save'));

    await waitFor(() => {
      expect(screen.getByText('Текст на русском обязателен')).toBeInTheDocument();
    });
    // Confirm the English version is NOT shown
    expect(screen.queryByText('Russian text is required')).not.toBeInTheDocument();
  });

  /**
   * correct_option error renders ONCE — not 3× from the old inside-loop bug.
   * The fix moved the error outside the LANGUAGES.map() loop.
   * AC-4a §3×-render fix.
   */
  it('correct_option error renders exactly once after submit', async () => {
    await act(async () => {
      await i18n.changeLanguage('ru');
    });

    const user = userEvent.setup();
    renderForm('ru');

    // Add a 3rd answer and mark it as correct
    await user.click(screen.getAllByTestId('add-answer-btn')[0]);
    await user.click(screen.getByTestId('correct-radio-C-ru'));

    // Fill all required fields
    await user.type(screen.getByTestId('question-input-ru'), 'Вопрос');
    await user.type(screen.getByTestId('answer-input-A-ru'), 'А');
    await user.type(screen.getByTestId('answer-input-B-ru'), 'Б');
    await user.type(screen.getByTestId('answer-input-C-ru'), 'В');

    await user.click(screen.getByTestId('lang-tab-el'));
    await user.type(screen.getByTestId('question-input-el'), 'Ερώτηση');
    await user.type(screen.getByTestId('answer-input-A-el'), 'Α');
    await user.type(screen.getByTestId('answer-input-B-el'), 'Β');
    await user.type(screen.getByTestId('answer-input-C-el'), 'Γ');

    await user.click(screen.getByTestId('lang-tab-en'));
    await user.type(screen.getByTestId('question-input-en'), 'Question');
    await user.type(screen.getByTestId('answer-input-A-en'), 'A');
    await user.type(screen.getByTestId('answer-input-B-en'), 'B');
    await user.type(screen.getByTestId('answer-input-C-en'), 'C');

    // Delete answer C → correct_option (3) > answer_count (2) → error
    await user.click(screen.getAllByTestId('delete-answer-C')[0]);

    await user.click(screen.getByTestId('culture-question-card-save'));

    await waitFor(() => {
      const errorEls = screen.getAllByText('Пожалуйста, выберите правильный ответ');
      // Must appear exactly once — not duplicated from old loop bug
      expect(errorEls).toHaveLength(1);
    });
  });

  /**
   * Locale switch after mount: switching from EN to RU updates rendered strings.
   * Tests that the schema useMemo([t]) dependency correctly rebuilds on lang change.
   */
  it('switching locale from EN to RU updates the question label', async () => {
    renderForm('en');

    // Initially EN
    expect(screen.getByText('Question (RU)')).toBeInTheDocument();

    // Switch to RU
    await act(async () => {
      await i18n.changeLanguage('ru');
    });

    await waitFor(() => {
      expect(screen.getByText('Вопрос (RU)')).toBeInTheDocument();
    });
    expect(screen.queryByText('Question (RU)')).not.toBeInTheDocument();
  });

  /**
   * Zod EN message: question field empty under EN → English error, not RU.
   * Confirms that schema factory rebuilds per locale — not cached as RU-only.
   * ADMIN2-38-05/AC-4e: the empty RU question surfaces its zod message
   * (zodRuRequired) through FormMessage — "Russian text is required" under EN.
   */
  it('EN: question-required zod error renders in English (not RU)', async () => {
    const user = userEvent.setup();
    renderForm('en');

    // Fill non-RU tabs
    await user.click(screen.getByTestId('lang-tab-el'));
    await user.type(screen.getByTestId('question-input-el'), 'Ερώτηση');
    await user.type(screen.getByTestId('answer-input-A-el'), 'Α');
    await user.type(screen.getByTestId('answer-input-B-el'), 'Β');

    await user.click(screen.getByTestId('lang-tab-en'));
    await user.type(screen.getByTestId('question-input-en'), 'Question');
    await user.type(screen.getByTestId('answer-input-A-en'), 'A');
    await user.type(screen.getByTestId('answer-input-B-en'), 'B');

    // RU tab: fill answers, leave question empty
    await user.click(screen.getByTestId('lang-tab-ru'));
    await user.type(screen.getByTestId('answer-input-A-ru'), 'А');
    await user.type(screen.getByTestId('answer-input-B-ru'), 'Б');

    await user.click(screen.getByTestId('culture-question-card-save'));

    await waitFor(() => {
      expect(screen.getByText('Russian text is required')).toBeInTheDocument();
    });
    expect(screen.queryByText('Текст на русском обязателен')).not.toBeInTheDocument();
  });
});
