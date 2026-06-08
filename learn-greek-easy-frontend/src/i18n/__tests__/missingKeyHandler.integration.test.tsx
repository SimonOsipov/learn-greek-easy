/**
 * Integration tests for the missing-key handler wired into the real test-setup
 * i18n instance — I18NG-03 (INFRA-06).
 *
 * RED state for `real_render_with_missing_static_key_throws`:
 *   The handler is NOT yet wired into test-setup.ts (that's the executor's job).
 *   The test expects calling t('__definitely_missing_key__') to throw, but the
 *   current test-setup i18n has no missingKeyHandler, so the key lookup silently
 *   returns the key string.  Result: "expected to throw but did not" — the correct
 *   RED failure signal.
 *
 * `real_render_with_present_key_does_not_throw`:
 *   Uses a key that verifiably exists in en/common.json ('loading').
 *   This test should pass both before and after implementation — it is the
 *   "stays-green" guard ensuring the handler never breaks present-key lookups.
 */

import React from 'react';

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Tiny inline components used only within this test file
// ---------------------------------------------------------------------------

/**
 * Renders a component that translates a key known to be absent from all
 * loaded namespaces.  When the missing-key handler is wired in throw mode the
 * render call will throw, causing the test's expect().toThrow() to pass.
 */
function MissingKeyComponent(): React.ReactElement {
  const { t } = useTranslation('common');
  // __definitely_missing_key__ does not exist in any locale file.
  const value = t('__definitely_missing_key__');
  return <span>{value}</span>;
}

/**
 * Renders a component that translates 'loading', which is the first key in
 * en/common.json → 'Loading...'.  Must never throw regardless of handler mode.
 */
function PresentKeyComponent(): React.ReactElement {
  const { t } = useTranslation('common');
  // 'loading' exists in en/common.json as "Loading..."
  const value = t('loading');
  return <span data-testid="value">{value}</span>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('missingKeyHandler integration (real test-setup i18n instance)', () => {
  it('real_render_with_missing_static_key_throws', () => {
    // RED: The handler is not yet wired into test-setup.ts.
    // When wired (executor's job), t('__definitely_missing_key__') will invoke
    // the throw-mode handler and throw; render() will propagate the error.
    //
    // Currently (RED): no handler → silently returns the key string → render
    // succeeds → this assertion fails with "Received function did not throw".
    expect(() => {
      render(<MissingKeyComponent />);
    }).toThrow();
  });

  it('real_render_with_present_key_does_not_throw', () => {
    // Should pass both before and after implementation.
    // 'loading' is a real key in en/common.json; the handler must not fire.
    expect(() => {
      render(<PresentKeyComponent />);
    }).not.toThrow();
  });
});
