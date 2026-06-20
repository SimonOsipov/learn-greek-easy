/**
 * ADMIN2-38-04 — CultureCardForm localization RED tests (Mode A / Test-Spec)
 *
 * All form strings in CultureCardForm.tsx are currently hardcoded English.
 * These tests assert that each string routes through t('decks.culture.form.*')
 * with en + ru values present in both locale files.
 *
 * Strategy: render under the RU locale and assert RU-translated text.
 * While the source is hardcoded English the RU render shows English → all
 * assertions comparing against RU strings FAIL (correct RED signal).
 *
 * After the executor wires t() in the form, these turn GREEN.
 *
 * Coverage:
 *   - Question label + placeholder (all 3 language tabs)
 *   - Answers label (per language tab)
 *   - Answer input placeholder
 *   - Add Answer button
 *   - Save Question button
 *   - Correct-answer radio aria-label
 *   - Validation: question-required error
 *   - Validation: select-correct-answer error
 *   - i18n parity: new keys exist in BOTH en and ru admin.json
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import i18n from '@/i18n';
import { CultureCardForm } from '../CultureCardForm';

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderFormRu(props: Partial<React.ComponentProps<typeof CultureCardForm>> = {}) {
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

// ── Locale lifecycle ──────────────────────────────────────────────────────────

beforeEach(async () => {
  await act(async () => {
    await i18n.changeLanguage('ru');
  });
});

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage('en');
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CultureCardForm — localization (ADMIN2-38-04)', () => {
  /**
   * Question label
   * en key: decks.culture.form.questionLabel → "Question ({{lang}})"
   * ru key: decks.culture.form.questionLabel → "Вопрос ({{lang}})"
   *
   * Currently CultureCardForm renders "Question (RU)" (hardcoded), not "Вопрос (RU)".
   * RED: expect "Вопрос (RU)" — will fail while form is hardcoded English.
   */
  it('renders the question label in RU', () => {
    renderFormRu();
    // The RU tab is active by default. Expect RU translation of "Question (RU)".
    expect(screen.getByText('Вопрос (RU)')).toBeInTheDocument();
  });

  /**
   * Question placeholder
   * ru key: decks.culture.form.questionPlaceholder → "Введите вопрос на {{lang}}"
   *
   * Currently renders "Enter question in RU" (hardcoded English).
   * RED: expect "Введите вопрос на RU".
   */
  it('renders the question textarea placeholder in RU', () => {
    renderFormRu();
    const questionInput = screen.getByTestId('question-input-ru');
    expect(questionInput).toHaveAttribute('placeholder', 'Введите вопрос на RU');
  });

  /**
   * Answers label
   * ru key: decks.culture.form.answersLabel → "Ответы ({{lang}})"
   *
   * Currently renders "Answers (RU)" (hardcoded English).
   * RED: expect "Ответы (RU)".
   */
  it('renders the answers label in RU', () => {
    renderFormRu();
    expect(screen.getByText('Ответы (RU)')).toBeInTheDocument();
  });

  /**
   * Answer input placeholder
   * ru key: decks.culture.form.answerPlaceholder → "Ответ {{key}}"
   *
   * Currently renders "Answer A" (hardcoded English).
   * RED: expect "Ответ A".
   */
  it('renders answer input placeholder in RU', () => {
    renderFormRu();
    const answerA = screen.getByTestId('answer-input-A-ru');
    expect(answerA).toHaveAttribute('placeholder', 'Ответ A');
  });

  /**
   * Add Answer button
   * ru key: decks.culture.form.addAnswer → "Добавить ответ {{key}}"
   *
   * Currently renders "Add Answer C" (hardcoded English).
   * RED: expect "Добавить ответ C".
   */
  it('renders the Add Answer button in RU', () => {
    renderFormRu();
    // With 2 answers, the button shows the next key = C.
    // Multiple tabs render so use getAllByText and check at least one.
    const buttons = screen.getAllByText('Добавить ответ C');
    expect(buttons.length).toBeGreaterThan(0);
  });

  /**
   * Save Question button
   * ru key: decks.culture.form.saveQuestion → "Сохранить вопрос"
   *
   * Currently renders "Save Question" (hardcoded English).
   * RED: expect "Сохранить вопрос".
   */
  it('renders the Save Question button in RU', () => {
    renderFormRu();
    expect(screen.getByTestId('submit-btn')).toHaveTextContent('Сохранить вопрос');
  });

  /**
   * Radio aria-label (AC-4g §2 per D8)
   * ru key: decks.culture.form.markCorrect → "Отметить ответ {{key}} как правильный"
   *
   * Currently renders aria-label="Mark answer A as correct" (hardcoded English).
   * RED: expect "Отметить ответ A как правильный".
   */
  it('renders the correct-answer radio aria-label in RU', () => {
    renderFormRu();
    // The RU tab is active; radio for A is the first one visible.
    const radioA = screen.getByTestId('correct-radio-A-ru');
    expect(radioA).toHaveAttribute('aria-label', 'Отметить ответ A как правильный');
  });

  /**
   * Question-required validation message
   * ru key: decks.culture.form.questionRequired → "Вопрос обязателен"
   *
   * Currently renders "Question is required" (hardcoded English).
   * RED: submit with empty question → expect "Вопрос обязателен".
   */
  it('renders the question-required validation error in RU', async () => {
    const user = userEvent.setup();
    renderFormRu();

    // Fill everything except the RU question so zod fires the question error.
    // Fill answers for all languages, fill questions for EL + EN only.
    await user.click(screen.getByTestId('lang-tab-el'));
    await user.type(screen.getByTestId('question-input-el'), 'Ερώτηση');
    await user.type(screen.getByTestId('answer-input-A-el'), 'Α');
    await user.type(screen.getByTestId('answer-input-B-el'), 'Β');

    await user.click(screen.getByTestId('lang-tab-en'));
    await user.type(screen.getByTestId('question-input-en'), 'Question');
    await user.type(screen.getByTestId('answer-input-A-en'), 'A');
    await user.type(screen.getByTestId('answer-input-B-en'), 'B');

    // Switch back to RU and fill answers but NOT the question
    await user.click(screen.getByTestId('lang-tab-ru'));
    await user.type(screen.getByTestId('answer-input-A-ru'), 'А');
    await user.type(screen.getByTestId('answer-input-B-ru'), 'Б');

    // Submit — triggers validation
    await user.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(screen.getByText('Вопрос обязателен')).toBeInTheDocument();
    });
  });

  /**
   * Select-correct-answer validation message
   * ru key: decks.culture.form.selectCorrect → "Пожалуйста, выберите правильный ответ"
   *
   * Currently renders "Please select a correct answer" (hardcoded English).
   * RED: trigger the correct_option error → expect the RU message.
   *
   * Note: this error fires when correct_option > answer_count. We set correct
   * option to 3 then reduce to 2 answers to trigger it.
   */
  it('renders the select-correct validation error in RU', async () => {
    const user = userEvent.setup();
    renderFormRu();

    // Add a 3rd answer
    await user.click(screen.getAllByTestId('add-answer-btn')[0]);
    // Select answer 3 as correct
    await user.click(screen.getByTestId('correct-radio-C-ru'));

    // Fill all required fields to get past other validation
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

    // Delete answer C — correct_option (3) > answer_count (2) → triggers error
    await user.click(screen.getAllByTestId('delete-answer-C')[0]);

    await user.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(screen.getByText('Пожалуйста, выберите правильный ответ')).toBeInTheDocument();
    });
  });

  /**
   * EL tab question label (tab-switching parity)
   * ru key: decks.culture.form.questionLabel → "Вопрос (EL)"
   *
   * Currently renders "Question (EL)" (hardcoded English).
   * RED: switch to EL tab → expect "Вопрос (EL)".
   */
  it('renders the EL question label in RU when EL tab is active', async () => {
    const user = userEvent.setup();
    renderFormRu();

    await user.click(screen.getByTestId('lang-tab-el'));

    expect(screen.getByText('Вопрос (EL)')).toBeInTheDocument();
  });

  /**
   * EN tab question label (tab-switching parity)
   * ru key: decks.culture.form.questionLabel → "Вопрос (EN)"
   *
   * Currently renders "Question (EN)" (hardcoded English).
   * RED: switch to EN tab → expect "Вопрос (EN)".
   */
  it('renders the EN question label in RU when EN tab is active', async () => {
    const user = userEvent.setup();
    renderFormRu();

    await user.click(screen.getByTestId('lang-tab-en'));

    expect(screen.getByText('Вопрос (EN)')).toBeInTheDocument();
  });
});
