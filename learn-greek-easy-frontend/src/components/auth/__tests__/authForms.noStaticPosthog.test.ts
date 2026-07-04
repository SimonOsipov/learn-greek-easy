/**
 * PERF-24-02 (Mode A — RED): auth forms must not statically import posthog-js.
 *
 * LoginForm and RegisterForm currently do `import posthog from 'posthog-js'`
 * at module scope, which pulls the ~40KB posthog-js chunk into the pre-auth
 * bundle (LCP-critical route). AC-1 requires the executor to remove the
 * static import and route all PostHog access through the deferred
 * `@/lib/analytics` seam (`track()` / `getPosthogInstance()`), which is only
 * populated once PostHogProvider's dynamic `import('posthog-js')` resolves
 * post-paint.
 *
 * This is a plain source-scan: read the two component files as text and
 * assert neither contains a static (or namespace) import from 'posthog-js'.
 * On the CURRENT implementation both files import it statically, so both
 * assertions FAIL.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

import { describe, expect, it } from 'vitest';

const STATIC_POSTHOG_IMPORT = /from ['"]posthog-js['"]/;

describe('auth forms have no static posthog-js import (PERF-24-02 AC-1)', () => {
  it('LoginForm.tsx does not statically import posthog-js', () => {
    const source = readFileSync(resolve(__dirname, '../LoginForm.tsx'), 'utf8');
    expect(source).not.toMatch(STATIC_POSTHOG_IMPORT);
  });

  it('RegisterForm.tsx does not statically import posthog-js', () => {
    const source = readFileSync(resolve(__dirname, '../RegisterForm.tsx'), 'utf8');
    expect(source).not.toMatch(STATIC_POSTHOG_IMPORT);
  });
});
