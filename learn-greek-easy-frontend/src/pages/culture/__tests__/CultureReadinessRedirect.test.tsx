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
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { describe, it, expect } from 'vitest';

// A trivial probe at the destination so we can assert the redirect resolved.
function MockExamProbe() {
  return <div data-testid="mock-exam-destination">Mock exam hub</div>;
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
  it('redirects a /culture/readiness deep link to /practice/culture-exam', () => {
    renderRoutesAt('/culture/readiness');

    // The Navigate resolves synchronously on render, so the destination renders.
    expect(screen.getByTestId('mock-exam-destination')).toBeInTheDocument();
  });

  it('renders the destination directly when navigating to /practice/culture-exam', () => {
    renderRoutesAt('/practice/culture-exam');

    expect(screen.getByTestId('mock-exam-destination')).toBeInTheDocument();
  });
});
