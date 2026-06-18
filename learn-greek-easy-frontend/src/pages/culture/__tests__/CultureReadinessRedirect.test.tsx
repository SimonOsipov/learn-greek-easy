/**
 * Culture readiness redirect (AC-2)
 *
 * PRACT2-11 merged the standalone readiness page into the mock-exam hub and
 * removed CultureReadinessPage. App.tsx keeps a `<Navigate replace>` at
 * `/culture/readiness` so old deep links / bookmarks don't 404 — they land on
 * `/practice/culture-exam` instead.
 *
 * This is the FAST unit-level guard: it mirrors the App route in a MemoryRouter
 * so the redirect SEMANTICS (replace, correct destination) are exercised in the
 * vitest gate without standing up the full app shell. It deliberately re-declares
 * the rule, so it cannot catch the rule being DELETED from App.tsx — that
 * source-bound check lives in the e2e suite (tests/e2e/mock-exam.spec.ts,
 * MOCKEXAM-E2E-04b), which drives the real App route in a browser.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate, useNavigationType } from 'react-router-dom';
import { describe, it, expect } from 'vitest';

// A probe at the destination so we can assert the redirect resolved AND that it
// arrived via REPLACE (not PUSH). useNavigationType() reports how the current
// location was reached — a `<Navigate replace>` yields 'REPLACE', so the legacy
// bookmark/deep link does NOT push a history entry (AC-2 guard).
function MockExamProbe() {
  const navType = useNavigationType();
  return (
    <div data-testid="mock-exam-destination" data-nav-type={navType}>
      Mock exam hub
    </div>
  );
}

/**
 * Renders just the two routes that matter for the redirect: the legacy
 * `/culture/readiness` Navigate (copied verbatim from App.tsx:270-273) and the
 * destination it points at.
 */
function renderRoutesAt(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/culture/readiness"
          element={<Navigate to="/practice/culture-exam" replace />}
        />
        <Route path="/practice/culture-exam" element={<MockExamProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('/culture/readiness redirect (AC-2)', () => {
  it('redirects a /culture/readiness deep link to /practice/culture-exam via REPLACE', () => {
    renderRoutesAt('/culture/readiness');

    // The Navigate resolves synchronously on render, so the destination renders.
    const destination = screen.getByTestId('mock-exam-destination');
    expect(destination).toBeInTheDocument();
    // AC-2: the redirect must REPLACE (not push) so the bookmarked
    // /culture/readiness URL does not add a history entry — Back from the hub
    // must not bounce the user back through the dead route.
    expect(destination).toHaveAttribute('data-nav-type', 'REPLACE');
  });

  it('renders the destination directly when navigating to /practice/culture-exam', () => {
    renderRoutesAt('/practice/culture-exam');

    expect(screen.getByTestId('mock-exam-destination')).toBeInTheDocument();
  });
});
