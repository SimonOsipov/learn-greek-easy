/**
 * PERF-24-01: QA adversarial coverage for the EN critical-namespace split.
 *
 * The RED specs (init.namespaceSplit.test.ts, i18n.test.ts) already prove the
 * headline behavior: the critical trio (common/auth/landing) loads
 * synchronously and a sampled non-critical namespace ('deck') is deferred.
 * These tests close gaps those specs leave open:
 *
 *   1. "exactly the 14" — the deferred loader must inject ALL 17 NAMESPACES
 *      (not a subset that happens to include 'deck'), verified against the
 *      real `NAMESPACES` source of truth from constants.ts, not a hand-copied
 *      list — so a future edit that adds/renames a namespace in constants.ts
 *      without updating init.ts's import list fails loudly here.
 *   2. loadDeferredEnglishNamespaces() must NEVER reject, even when one of the
 *      underlying dynamic imports throws — the `void` call site in main.tsx
 *      has no .catch(), so an unswallowed rejection would be an unhandled
 *      promise rejection in production.
 *   2b. Partial success (CodeRabbit fix, PERF-24 Phase 3): loadDeferredEnglish
 *      Namespaces() uses Promise.allSettled, so the ONE rejected import above
 *      must not take the other 13 namespaces down with it — they still get
 *      added even though 'deck' didn't.
 *   3. FOUC-safety: a representative key from EACH of the 3 critical
 *      namespaces (not just auth+landing, as the RED spec covers) resolves to
 *      a real string synchronously after initI18n() resolves.
 *
 * Same fresh-instance technique as init.namespaceSplit.test.ts (see that
 * file's header comment for why: the shared singleton is pre-seeded with all
 * 17 EN namespaces by src/lib/test-setup.ts, which would mask the split).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { NAMESPACES } from '../constants';

const CRITICAL_EN_NAMESPACES = ['common', 'auth', 'landing'] as const;

describe('PERF-24-01: QA adversarial coverage (fresh instance)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('@/lib/logger');
    vi.doUnmock('../locales/en/deck.json');
    vi.resetModules();
    localStorage.removeItem('i18nextLng');
  });

  // ---------------------------------------------------------------------------
  // 1. Exact-partition invariant, derived from the real NAMESPACES constant.
  //
  // Before the deferred load: exactly the critical trio is present; every
  // OTHER namespace in NAMESPACES (all 14, read from the constant — not a
  // hardcoded duplicate) is absent. After the deferred load: every single
  // namespace in NAMESPACES (all 17) is present. This guards against a
  // partial deferred-import list (e.g. a forgotten `import('./locales/en/
  // waitlist.json')`) that a hardcoded 14-item test list could miss if the
  // same omission were copy-pasted into both places.
  // ---------------------------------------------------------------------------
  it('deferred loader injects the full NAMESPACES set — no subset, no critical crossover', async () => {
    localStorage.setItem('i18nextLng', 'en');
    vi.resetModules();

    const freshInit = await import('../init');
    freshInit.resetI18nInit();
    const { default: freshI18n } = await import('i18next');

    await freshInit.initI18n();

    const nonCritical = NAMESPACES.filter(
      (ns) => !(CRITICAL_EN_NAMESPACES as readonly string[]).includes(ns)
    );
    expect(nonCritical).toHaveLength(14);

    // Pre-deferred: critical trio present, every other namespace absent.
    CRITICAL_EN_NAMESPACES.forEach((ns) => {
      expect(freshI18n.hasResourceBundle('en', ns)).toBe(true);
    });
    nonCritical.forEach((ns) => {
      expect(freshI18n.hasResourceBundle('en', ns)).toBe(false);
    });

    await freshInit.loadDeferredEnglishNamespaces();

    // Post-deferred: the ENTIRE NAMESPACES set (all 17, from the real
    // constant) is present — not just the 'deck' sample the RED spec checks.
    NAMESPACES.forEach((ns) => {
      expect(freshI18n.hasResourceBundle('en', ns)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. loadDeferredEnglishNamespaces() never rejects, even when an underlying
  //    dynamic import throws.
  //
  // main.tsx calls this fire-and-forget (`void loadDeferredEnglishNamespaces()`)
  // with no .catch() at the call site — the safety net MUST live inside the
  // function itself. We force one of the 14 dynamic imports (deck.json) to
  // throw and confirm: (a) the returned promise still resolves (never
  // rejects), and (b) the failure is logged via log.warn so it's observable,
  // not silently dropped.
  // ---------------------------------------------------------------------------
  it('never rejects when an underlying deferred-namespace import throws', async () => {
    vi.resetModules();

    const warnSpy = vi.fn();
    vi.doMock('@/lib/logger', () => ({
      default: { warn: warnSpy, error: vi.fn(), info: vi.fn(), debug: vi.fn() },
    }));
    vi.doMock('../locales/en/deck.json', () => {
      throw new Error('Simulated deck.json chunk load failure');
    });

    const freshInit = await import('../init');
    freshInit.resetI18nInit();

    let rejected = false;
    let thrown: unknown = null;
    await freshInit.loadDeferredEnglishNamespaces().catch((err: unknown) => {
      rejected = true;
      thrown = err;
    });

    expect(rejected).toBe(false);
    expect(thrown).toBeNull();

    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toContain('deferred English namespaces');
  });

  // ---------------------------------------------------------------------------
  // 2b. Partial success (CodeRabbit fix, PERF-24 Phase 3): Promise.allSettled
  //     means one rejected import must NOT take the other 13 namespaces down
  //     with it. Before the fix (Promise.all), a single rejection short-
  //     circuited the whole batch and NONE of the 14 namespaces were added —
  //     this test would fail on the "present" assertions below without the
  //     fix, since 'achievements'/'admin' would also be absent.
  // ---------------------------------------------------------------------------
  it('partial failure: the other 13 namespaces are still added when one deferred import rejects', async () => {
    // initI18n() must run first: it's what actually resets the fresh
    // instance's resourceStore to just the critical trio via i18next's own
    // .init() (addResourceBundle alone does not reset prior state, and this
    // suite's shared-singleton pre-seed — see file header — would otherwise
    // leave a stale 'deck' bundle in place from before this test ran).
    localStorage.setItem('i18nextLng', 'en');
    vi.resetModules();

    vi.doMock('@/lib/logger', () => ({
      default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
    }));
    vi.doMock('../locales/en/deck.json', () => {
      throw new Error('Simulated deck.json chunk load failure');
    });

    const freshInit = await import('../init');
    freshInit.resetI18nInit();
    const { default: freshI18n } = await import('i18next');

    await freshInit.initI18n();

    // Pre-deferred: every non-critical namespace, including 'deck', starts absent.
    expect(freshI18n.hasResourceBundle('en', 'deck')).toBe(false);
    expect(freshI18n.hasResourceBundle('en', 'achievements')).toBe(false);

    await freshInit.loadDeferredEnglishNamespaces();

    // The failing namespace never gets added...
    expect(freshI18n.hasResourceBundle('en', 'deck')).toBe(false);
    // ...but every other namespace still is (sampling a couple, not the whole
    // set — the "exactly the 14 on all-success" case is covered above).
    expect(freshI18n.hasResourceBundle('en', 'achievements')).toBe(true);
    expect(freshI18n.hasResourceBundle('en', 'admin')).toBe(true);
    expect(freshI18n.hasResourceBundle('en', 'waitlist')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 3. FOUC-safety: a representative key from EACH critical namespace
  //    (common/auth/landing) resolves to a real string synchronously after
  //    init — extending the RED spec's auth+landing-only check to include
  //    'common', the namespace every screen depends on (nav, buttons, loading
  //    states, errors).
  // ---------------------------------------------------------------------------
  it('FOUC-safety: a common-namespace key resolves to a real string synchronously after init', async () => {
    localStorage.setItem('i18nextLng', 'en');
    vi.resetModules();

    const freshInit = await import('../init');
    freshInit.resetI18nInit();
    const { default: freshI18n } = await import('i18next');

    await freshInit.initI18n();

    expect(freshI18n.t('common:loading')).toBe('Loading...');
    expect(freshI18n.t('common:loading')).not.toBe('common:loading');
  });
});
