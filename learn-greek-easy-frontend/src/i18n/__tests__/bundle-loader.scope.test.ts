/**
 * WEDGE-13-03 — QA adversarial coverage for bundle-loader.ts's `scope` param.
 *
 * init.routeLocale.test.ts exercises the scope param only indirectly, through
 * initI18n(). These specs hit loadLanguageBundle() directly to pin its own
 * contract: the exact namespace membership of each slice, that 'en' is a
 * pass-through no-op regardless of scope, and that an unexpected runtime
 * scope value (unreachable from TypeScript, but not from a JS caller or a
 * future typo) degrades to the full/'all' bundle rather than silently
 * returning nothing or throwing.
 *
 * Not a re-authoring of the 13 Test-Spec-table specs — those cover initI18n()
 * behavior; these cover bundle-loader.ts's own module contract in isolation.
 */

import { describe, it, expect } from 'vitest';

import { loadLanguageBundle } from '../bundle-loader';

const CRITICAL_NAMESPACES = ['auth', 'common', 'landing'] as const;

const DEFERRED_NAMESPACES = [
  'achievements',
  'admin',
  'changelog',
  'culture',
  'deck',
  'feedback',
  'mockExam',
  'profile',
  'review',
  'settings',
  'statistics',
  'upgrade',
  'subscription',
  'waitlist',
] as const;

describe('WEDGE-13-03: bundle-loader.ts scope param contract', () => {
  it('scope=critical returns EXACTLY the 3-namespace trio, nothing else', async () => {
    const result = await loadLanguageBundle('ru', 'critical');
    const keys = Object.keys(result?.ru ?? {}).sort();
    expect(keys).toEqual([...CRITICAL_NAMESPACES].sort());
  });

  it('scope=deferred returns EXACTLY the other 14 namespaces, none of the trio', async () => {
    const result = await loadLanguageBundle('ru', 'deferred');
    const keys = Object.keys(result?.ru ?? {}).sort();
    expect(keys).toEqual([...DEFERRED_NAMESPACES].sort());
    CRITICAL_NAMESPACES.forEach((ns) => {
      expect(keys).not.toContain(ns);
    });
  });

  it('scope=all (explicit) returns the union of critical + deferred — all 17, no overlap', async () => {
    const result = await loadLanguageBundle('ru', 'all');
    const keys = Object.keys(result?.ru ?? {}).sort();
    const expected = [...CRITICAL_NAMESPACES, ...DEFERRED_NAMESPACES].sort();
    expect(keys).toEqual(expected);
    expect(keys.length).toBe(17);
  });

  it('scope omitted defaults to the same 17-namespace union as explicit "all" (no caller churn)', async () => {
    const implicit = await loadLanguageBundle('ru');
    const explicit = await loadLanguageBundle('ru', 'all');
    expect(Object.keys(implicit?.ru ?? {}).sort()).toEqual(Object.keys(explicit?.ru ?? {}).sort());
  });

  it('lang=en is a no-op regardless of scope — critical/deferred/all all return undefined', async () => {
    await expect(loadLanguageBundle('en', 'critical')).resolves.toBeUndefined();
    await expect(loadLanguageBundle('en', 'deferred')).resolves.toBeUndefined();
    await expect(loadLanguageBundle('en', 'all')).resolves.toBeUndefined();
    await expect(loadLanguageBundle('en')).resolves.toBeUndefined();
  });

  it('an unexpected runtime scope value degrades to the full bundle rather than throwing or returning empty', async () => {
    // Not reachable from TypeScript (BundleScope is a closed union), but any
    // JS caller (or a future typo past a refactor) can still pass an
    // arbitrary string at runtime. The implementation's if/if/else falls
    // through to loadRussianBundle() for anything that isn't literally
    // 'critical' or 'deferred' — document that as the actual contract rather
    // than let it silently regress to an empty/throwing result.
    const result = await loadLanguageBundle(
      'ru',
      'bogus-scope' as unknown as 'all' | 'critical' | 'deferred'
    );
    const keys = Object.keys(result?.ru ?? {}).sort();
    expect(keys.length).toBe(17);
  });
});
