/**
 * ThinCoverageMark (WEDGE-05-02) — RED as of this commit.
 *
 * `ThinCoverageMark.tsx` is currently a skeleton (`() => null`) — every
 * assertion below fails on `screen.getByLabelText(...)` / `getByTestId(...)`
 * throwing "unable to find an element", a clean assertion failure, not a
 * render crash or a missing-i18n-key error (the `mockExam:coverage.thinMark.*`
 * keys this component will read already exist in both `en/mockExam.json`
 * and `ru/mockExam.json`, added in this same commit). These tests go green
 * once the executor implements the real Tooltip + AlertTriangle render logic
 * described in `ThinCoverageMark.tsx`'s contract comment.
 *
 * Note: `hiddenWhenNotThin` cannot assert `container.firstChild === null` —
 * the shared `@/lib/test-utils` render wrapper always mounts `<Toaster />`
 * as a sibling, and its Radix `ToastViewport` renders a persistent
 * `role="region"` DOM node regardless of `ui`'s own output (verified
 * empirically against this test env), so `container.firstChild` is never
 * null through that wrapper. Scoped `queryByTestId` / `queryByLabelText`
 * absence checks are used instead — they target this component's own
 * output, not the wrapper's ambient DOM.
 *
 * Covers (architect Test Specs table):
 * - shownWhenThin: thin=true renders the mark with a localized aria-label
 * - hiddenWhenNotThin: thin=false renders nothing
 * - ruLabel: the aria-label is localized under RU
 */
import { fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import i18n from '@/i18n';
import { render, screen } from '@/lib/test-utils';

import { ThinCoverageMark } from '../ThinCoverageMark';

describe('ThinCoverageMark (WEDGE-05-02)', () => {
  it('shownWhenThin: renders the mark with a localized aria-label when thin', () => {
    render(<ThinCoverageMark topic="history" thin={true} />);

    expect(screen.getByTestId('thin-coverage-mark')).toBeInTheDocument();
    expect(screen.getByLabelText('Limited coverage')).toBeInTheDocument();
  });

  it('hiddenWhenNotThin: renders nothing when not thin', () => {
    render(<ThinCoverageMark topic="politics" thin={false} />);

    expect(screen.queryByTestId('thin-coverage-mark')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Limited coverage')).not.toBeInTheDocument();
  });

  it('ruLabel: renders the localized RU aria-label when thin', async () => {
    await i18n.changeLanguage('ru');
    render(<ThinCoverageMark topic="history" thin={true} />);

    expect(screen.getByLabelText('Ограниченный охват')).toBeInTheDocument();
    expect(screen.queryByLabelText('Limited coverage')).not.toBeInTheDocument();
  });

  // ---- QA adversarial: tooltip content wiring + a11y ----
  //
  // The pre-existing tests only assert the trigger's aria-label — they never
  // exercise `TooltipContent`, so a build that wired the wrong i18n key (or
  // no key at all) into `TooltipContent` would still pass. Radix's Tooltip
  // opens synchronously (no delay, no fake timers needed) on focus — this is
  // its built-in a11y behavior for keyboard/screen-reader users — so
  // `fireEvent.focus` on the trigger reveals `TooltipContent` in happy-dom
  // and its copy becomes directly assertable via `getByRole('tooltip')`.

  it('tooltipContentEN: focusing the trigger reveals the localized EN tooltip copy', () => {
    render(<ThinCoverageMark topic="history" thin={true} />);

    fireEvent.focus(screen.getByTestId('thin-coverage-mark'));

    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Fewer questions than other topics — treat this subject as less exam-ready.'
    );
  });

  it('tooltipContentRU: focusing the trigger reveals the localized RU tooltip copy', async () => {
    await i18n.changeLanguage('ru');
    render(<ThinCoverageMark topic="history" thin={true} />);

    fireEvent.focus(screen.getByTestId('thin-coverage-mark'));

    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Вопросов меньше, чем по другим темам — эта тема хуже готовит к экзамену.'
    );
  });

  it('iconAriaHidden: the AlertTriangle glyph is aria-hidden (label lives on the wrapping span, not the icon)', () => {
    render(<ThinCoverageMark topic="history" thin={true} />);

    const icon = screen.getByTestId('thin-coverage-mark').querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});
