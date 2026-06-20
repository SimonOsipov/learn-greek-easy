/**
 * CultureCardForm — Adversarial coverage for primitive replacements (ADMIN2-38-06)
 *
 * Gaps filled here (not covered by CultureCardForm.primitives.test.tsx):
 *
 * (A) Keyboard arrow-key navigation across Tabs — Radix Tabs renders
 *     role="tablist" / role="tab" and supports ArrowRight/ArrowLeft for
 *     roving focus. A regression that broke the Radix integration would
 *     silently break keyboard UX but pass the click-based primitives tests.
 *
 * (B) bg-warning indicator clears when a tab becomes complete and reappears
 *     when it becomes incomplete again — verifies the reactive isTabIncomplete
 *     logic works with the Tabs primitive (not just with the old bespoke pills).
 *
 * These tests remain green and would fail if:
 *   - The Tabs primitive was swapped back to a bespoke <div>/<button> switcher
 *     that doesn't honour the tablist/tab role (A)
 *   - isTabIncomplete stopped being reactive / bg-warning was replaced with
 *     a class that is always present (B)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import { CultureCardForm, type CultureCardFormProps } from '../CultureCardForm';
import i18n from '@/i18n';

// ============================================
// Helpers
// ============================================

const renderForm = (props: Partial<CultureCardFormProps> = {}) => {
  const defaultProps: CultureCardFormProps = {
    onSubmit: vi.fn().mockResolvedValue(undefined),
    deckId: 'test-deck-adversarial',
    ...props,
  };

  return render(
    <I18nextProvider i18n={i18n}>
      <CultureCardForm {...defaultProps} />
    </I18nextProvider>
  );
};

// ============================================
// (A) Keyboard arrow-key navigation via Radix Tabs
// ============================================

describe('CultureCardForm — adversarial: Tabs keyboard navigation (ADMIN2-38-06)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ArrowRight from RU tab moves focus to EL tab', async () => {
    // Radix Tabs uses roving-focus with ArrowRight/ArrowLeft.
    // This test would fail if the Tabs primitive was replaced with a bespoke
    // implementation that doesn't wire up roving-focus keyboard events.
    const user = userEvent.setup();
    renderForm();

    const tabs = screen.getAllByRole('tab');
    const ruTab = tabs.find((t) => t.textContent?.includes('RU'));
    const elTab = tabs.find((t) => t.textContent?.includes('EL'));
    expect(ruTab).toBeDefined();
    expect(elTab).toBeDefined();

    // Focus the RU tab
    ruTab!.focus();
    expect(document.activeElement).toBe(ruTab);

    // Press ArrowRight — Radix moves focus to next tab
    await user.keyboard('{ArrowRight}');

    // EL tab must now be focused
    expect(document.activeElement).toBe(elTab);
  });

  it('ArrowLeft from EL tab wraps back to RU tab', async () => {
    // Regression guard: roving-focus must go both directions.
    const user = userEvent.setup();
    renderForm();

    const tabs = screen.getAllByRole('tab');
    const ruTab = tabs.find((t) => t.textContent?.includes('RU'));
    const elTab = tabs.find((t) => t.textContent?.includes('EL'));
    expect(ruTab).toBeDefined();
    expect(elTab).toBeDefined();

    // Focus the EL tab
    elTab!.focus();
    expect(document.activeElement).toBe(elTab);

    // Press ArrowLeft — Radix moves focus back to previous tab
    await user.keyboard('{ArrowLeft}');

    expect(document.activeElement).toBe(ruTab);
  });

  it('all three tabs are reachable by ArrowRight cycling', async () => {
    // Verifies a three-tab cycle: RU → EL → EN → (wrap) RU
    const user = userEvent.setup();
    renderForm();

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);

    const ruTab = tabs.find((t) => t.textContent?.includes('RU'))!;
    const elTab = tabs.find((t) => t.textContent?.includes('EL'))!;
    const enTab = tabs.find((t) => t.textContent?.includes('EN'))!;

    ruTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(elTab);

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(enTab);

    // ArrowRight from the last tab wraps back to RU (Radix default)
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(ruTab);
  });
});

// ============================================
// (B) bg-warning indicator reactivity with Tabs primitive
// ============================================

describe('CultureCardForm — adversarial: incomplete indicator reactivity (ADMIN2-38-06)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bg-warning indicator on RU clears when RU becomes complete', async () => {
    // Verifies isTabIncomplete() reacts to typed values and the DOM indicator
    // disappears (not just loses its class while the element remains).
    const user = userEvent.setup();
    renderForm();

    // Initially incomplete
    expect(screen.getByTestId('lang-tab-ru-incomplete')).toBeInTheDocument();
    expect(screen.getByTestId('lang-tab-ru-incomplete').className).toContain('bg-warning');

    // Fill all RU fields
    await user.type(screen.getByTestId('question-input-ru'), 'Вопрос');
    await user.type(screen.getByTestId('answer-input-A-ru'), 'А');
    await user.type(screen.getByTestId('answer-input-B-ru'), 'Б');

    // Indicator element must be GONE (not still present with different class)
    await waitFor(() => {
      expect(screen.queryByTestId('lang-tab-ru-incomplete')).not.toBeInTheDocument();
    });
  });

  it('bg-warning indicator reappears on RU after a filled field is cleared', async () => {
    // Verifies reactive clearing works in reverse: completing then un-completing a field
    // causes the indicator to reappear.
    const user = userEvent.setup();
    renderForm();

    const questionInput = screen.getByTestId('question-input-ru');

    // Fill RU question + answers
    await user.type(questionInput, 'Вопрос');
    await user.type(screen.getByTestId('answer-input-A-ru'), 'А');
    await user.type(screen.getByTestId('answer-input-B-ru'), 'Б');

    // Indicator gone after completion
    await waitFor(() => {
      expect(screen.queryByTestId('lang-tab-ru-incomplete')).not.toBeInTheDocument();
    });

    // Clear the question input
    await user.clear(questionInput);

    // Indicator must reappear
    await waitFor(() => {
      const indicator = screen.queryByTestId('lang-tab-ru-incomplete');
      expect(indicator).toBeInTheDocument();
      expect(indicator!.className).toContain('bg-warning');
      expect(indicator!.className).not.toContain('bg-destructive');
    });
  });

  it('bg-warning token (not bg-destructive) is used on all three incomplete indicators', () => {
    // Belt-and-suspenders: all three language indicators must consistently use
    // bg-warning. A partial fix that only changes RU would pass the primitives
    // tests but fail here.
    renderForm();

    for (const lang of ['ru', 'el', 'en']) {
      const indicator = screen.getByTestId(`lang-tab-${lang}-incomplete`);
      expect(indicator.className).toContain('bg-warning');
      expect(indicator.className).not.toContain('bg-destructive');
    }
  });
});
