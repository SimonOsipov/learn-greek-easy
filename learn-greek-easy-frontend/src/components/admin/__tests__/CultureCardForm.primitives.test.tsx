/**
 * CultureCardForm — Primitive-replacement RED tests (ADMIN2-38-06 / AC-4g)
 *
 * Mode A (Test-Spec): these tests are authored BEFORE implementation and must
 * fail (assertion-level) against the current bespoke-pill switcher source.
 *
 * Tests:
 *  (1) Language switcher uses the Tabs primitive (role="tablist" / role="tab")
 *  (2) Switching a tab changes active language content
 *  (3) Incomplete-language indicator is NOT bg-destructive (uses completion-chip token)
 *  (4) Delete-answer icon button is h-6 w-6 (not h-10 w-10) — D8: RED currently
 *  (D8) Correct-answer control is the native <input type="radio"> — regression guard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import { CultureCardForm, type CultureCardFormProps } from '../CultureCardForm';
import i18n from '@/i18n';

// ============================================
// Test Utilities (mirrors CultureCardForm.test.tsx)
// ============================================

const renderForm = (props: Partial<CultureCardFormProps> = {}) => {
  const defaultProps: CultureCardFormProps = {
    onSubmit: vi.fn().mockResolvedValue(undefined),
    deckId: 'test-deck-primitives',
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

// ============================================
// Tests
// ============================================

describe('CultureCardForm — primitive replacements (ADMIN2-38-06 / AC-4g)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ----------------------------------------------------------
  // (1) Language tabs → Tabs primitive (RED against bespoke pills)
  // ----------------------------------------------------------

  describe('Language switcher uses the Tabs primitive', () => {
    it('renders a tablist container (role="tablist")', () => {
      // After implementation: the Radix Tabs/TabsList primitive renders
      // role="tablist". Currently the bespoke pill switcher is a plain
      // <div> with <button>s — no tablist role → RED.
      renderForm();
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('renders three tab triggers with role="tab"', () => {
      // Radix TabsTrigger renders role="tab". Currently plain <button>
      // elements without the "tab" role → RED.
      renderForm();
      const tabs = screen.getAllByRole('tab');
      // Expect exactly the three language tabs (RU, EL, EN)
      expect(tabs).toHaveLength(3);
    });

    it('switching from RU to EL tab shows EL content and preserves RU input', async () => {
      // Behavior contract: tab switch changes visible content.
      // After implementation the Tabs primitive controls visibility via
      // TabsContent (Radix hides non-active panels); currently the bespoke
      // implementation uses a CSS `hidden` class.  We assert on the
      // Radix-tab role click path — the test will fail if role="tab"
      // triggers don't exist (which is the RED state).
      const user = userEvent.setup();
      renderForm();

      // Type in RU question input
      await user.type(screen.getByTestId('question-input-ru'), 'Вопрос на русском');

      // Click EL tab — must be found by role="tab" (RED until Tabs primitive exists)
      const tabs = screen.getAllByRole('tab');
      const elTab = tabs.find((t) => t.textContent?.includes('EL'));
      expect(elTab).toBeDefined();
      await user.click(elTab!);

      // EL content visible after switch
      await waitFor(() => {
        expect(screen.getByTestId('question-input-el')).toBeVisible();
      });

      // RU input value preserved
      const ruTab = screen.getAllByRole('tab').find((t) => t.textContent?.includes('RU'));
      expect(ruTab).toBeDefined();
      await user.click(ruTab!);
      expect(screen.getByTestId('question-input-ru')).toHaveValue('Вопрос на русском');
    });
  });

  // ----------------------------------------------------------
  // (3) Incomplete-language indicator — NOT bg-destructive (RED currently)
  // ----------------------------------------------------------

  describe('Incomplete-language indicator uses completion-chip colors, not bg-destructive', () => {
    it('incomplete tab indicator does not have bg-destructive class', () => {
      // Currently: the <span> indicator has className="... bg-destructive".
      // After implementation: it must use a non-error completion-chip token
      // (e.g. bg-amber-400/70, bg-muted-foreground/50, or a named utility —
      // anything that is NOT bg-destructive).
      // This assertion is RED against the current source.
      renderForm();

      // At least the RU indicator must be present (form starts empty)
      const incompleteIndicator = screen.getByTestId('lang-tab-ru-incomplete');
      expect(incompleteIndicator).toBeInTheDocument();

      // Must NOT carry the error token
      expect(incompleteIndicator.className).not.toContain('bg-destructive');
    });

    it('all three incomplete indicators avoid bg-destructive', () => {
      // RED: all three currently render bg-destructive
      renderForm();

      for (const lang of ['ru', 'el', 'en']) {
        const indicator = screen.getByTestId(`lang-tab-${lang}-incomplete`);
        expect(indicator.className).not.toContain('bg-destructive');
      }
    });
  });

  // ----------------------------------------------------------
  // (2) Delete-answer icon button → h-6 w-6 (RED: currently h-10 w-10)
  // ----------------------------------------------------------

  describe('Delete-answer icon button is h-6 w-6', () => {
    it('delete-answer-A button does not have h-10 or w-10 classes', () => {
      // Currently: className includes "h-10 w-10".
      // After implementation: "h-6 w-6" (ghost icon convention).
      // RED against current source.
      renderForm();

      // There may be multiple delete-answer-A buttons (one per hidden tab);
      // take the first one (the visible RU tab).
      const deleteBtn = screen.getAllByTestId('delete-answer-A')[0];
      expect(deleteBtn.className).not.toContain('h-10');
      expect(deleteBtn.className).not.toContain('w-10');
    });

    it('delete-answer-A button has h-6 and w-6 classes', () => {
      // Positive assertion: must have h-6 w-6 after implementation.
      // RED now (source has h-10 w-10).
      renderForm();

      const deleteBtn = screen.getAllByTestId('delete-answer-A')[0];
      expect(deleteBtn.className).toContain('h-6');
      expect(deleteBtn.className).toContain('w-6');
    });

    it('delete-answer-B button is also h-6 w-6 (not h-10 w-10)', () => {
      renderForm();
      const deleteBtn = screen.getAllByTestId('delete-answer-B')[0];
      expect(deleteBtn.className).not.toContain('h-10');
      expect(deleteBtn.className).toContain('h-6');
      expect(deleteBtn.className).toContain('w-6');
    });
  });

  // ----------------------------------------------------------
  // (D8) Correct-answer control stays native <input type="radio">
  //      This is expected to be GREEN now; kept as a regression guard.
  // ----------------------------------------------------------

  describe('D8 regression guard — correct-answer uses native radio (not RadioGroup primitive)', () => {
    it('correct-radio-A-ru is a native <input type="radio">', () => {
      // D8: no @radix-ui/react-radio-group in the project; keep native radio.
      // This must be green now and remain green after implementation.
      renderForm();

      const radio = screen.getByTestId('correct-radio-A-ru') as HTMLInputElement;
      expect(radio.tagName).toBe('INPUT');
      expect(radio.type).toBe('radio');
    });

    it('correct-radio has accent-primary class (token-backed styling)', () => {
      // D8: the native radio must retain accent-primary (token, not raw hex).
      renderForm();

      const radio = screen.getByTestId('correct-radio-A-ru') as HTMLInputElement;
      expect(radio.className).toContain('accent-primary');
    });

    it('correct-radio has a localized aria-label via markCorrect key', () => {
      // ADMIN2-38-04 already added the localized aria-label; verify it
      // survived subtask 05 and will survive 06.
      renderForm();

      // The aria-label is set via t('decks.culture.form.markCorrect', { key: 'A' })
      // In tests i18n may return the key itself or the translation.
      const radio = screen.getByTestId('correct-radio-A-ru');
      expect(radio).toHaveAttribute('aria-label');
      // Must be non-empty
      const label = radio.getAttribute('aria-label') ?? '';
      expect(label.length).toBeGreaterThan(0);
    });

    it('selecting answer B updates correct_option via the native radio onChange', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByTestId('correct-radio-B-ru'));

      const radioB = screen.getByTestId('correct-radio-B-ru') as HTMLInputElement;
      expect(radioB.checked).toBe(true);

      const radioA = screen.getByTestId('correct-radio-A-ru') as HTMLInputElement;
      expect(radioA.checked).toBe(false);
    });
  });
});
