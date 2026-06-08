/**
 * Unit tests for missingKeyHandler — I18NG-03 (INFRA-06)
 *
 * RED phase: missingKeyHandler.ts does not exist yet.
 * Expected failure: Cannot find module '@/i18n/missingKeyHandler' (import error /
 * not-a-function at runtime) — NOT a typo in the import path.
 *
 * All tests in this file are authored against the spec decided in the architecture
 * document. They must fail for the right reason before implementation and pass
 * (without modification) after the executor wires the module.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

import { makeMissingKeyHandler, __resetMissingKeyReportCache } from '@/i18n/missingKeyHandler';

// Mock @/lib/sentry-queue so we can spy on queueLog and queueMessage without
// touching the real Sentry infrastructure during tests.
const { mockQueueLog, mockQueueMessage } = vi.hoisted(() => ({
  mockQueueLog: vi.fn(),
  mockQueueMessage: vi.fn(),
}));

vi.mock('@/lib/sentry-queue', () => ({
  queueLog: mockQueueLog,
  queueMessage: mockQueueMessage,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Invoke a handler the same way i18next does.
 * Signature: (lngs, ns, key, fallbackValue, updateMissing, options)
 * We only care about args 0-3 for the handler logic.
 */
function callHandler(
  handler: (lngs: string[], ns: string, key: string, fallbackValue: string) => void,
  lngs: string[],
  ns: string,
  key: string,
  fallbackValue: string
): void {
  handler(lngs, ns, key, fallbackValue);
}

// ---------------------------------------------------------------------------
// 'throw' mode
// ---------------------------------------------------------------------------

describe("makeMissingKeyHandler('throw')", () => {
  it('throws_on_absent_static_key_with_no_default', () => {
    const handler = makeMissingKeyHandler('throw');
    // fallbackValue === key → genuinely missing, no defaultValue supplied
    expect(() => callHandler(handler, ['en'], 'common', 'really.absent', 'really.absent')).toThrow(
      /common:really\.absent/
    );
  });

  it('does_not_throw_when_defaultValue_supplied', () => {
    const handler = makeMissingKeyHandler('throw');
    // fallbackValue !== key → caller passed a defaultValue; must NOT throw
    expect(() => callHandler(handler, ['en'], 'common', 'some.key', 'Some Default')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 'report' mode
// ---------------------------------------------------------------------------
//
// These tests use a freshly-loaded missingKeyHandler module (via
// vi.resetModules + dynamic import) so that the vi.mock('@/lib/sentry-queue')
// factory is applied to the copy of missingKeyHandler that these tests use,
// not the copy pre-loaded by setupFiles.  The test intents (what is asserted)
// are identical to the original spec.
// ---------------------------------------------------------------------------

describe("makeMissingKeyHandler('report')", () => {
  // Module references loaded fresh after mock is active
  let freshMakeMissingKeyHandler: typeof makeMissingKeyHandler;
  let freshResetCache: typeof __resetMissingKeyReportCache;

  beforeAll(async () => {
    // Reset module registry so the next import of missingKeyHandler picks up
    // the sentry-queue mock registered above via vi.mock.
    vi.resetModules();
    const mod = await import('@/i18n/missingKeyHandler');
    freshMakeMissingKeyHandler = mod.makeMissingKeyHandler;
    freshResetCache = mod.__resetMissingKeyReportCache;
  });

  beforeEach(() => {
    mockQueueLog.mockClear();
    mockQueueMessage.mockClear();
    // Reset the module-level dedup Set between tests
    freshResetCache();
  });

  it('report_mode_calls_queueLog_warn_once_per_key', () => {
    const handler = freshMakeMissingKeyHandler('report');
    const ns = 'common';
    const key = 'some.missing.key';
    const fallbackValue = key; // genuinely missing

    // Call three times for the same ns:key
    callHandler(handler, ['en'], ns, key, fallbackValue);
    callHandler(handler, ['en'], ns, key, fallbackValue);
    callHandler(handler, ['en'], ns, key, fallbackValue);

    // queueLog must have been called exactly once
    expect(mockQueueLog).toHaveBeenCalledTimes(1);

    // Must be called with severity 'warn' and a message that contains ns:key
    expect(mockQueueLog).toHaveBeenCalledWith('warn', expect.stringContaining(`${ns}:${key}`));
  });

  it('report_mode_never_throws', () => {
    const handler = freshMakeMissingKeyHandler('report');
    expect(() =>
      callHandler(handler, ['en'], 'common', 'any.missing', 'any.missing')
    ).not.toThrow();
  });

  it('report_mode_does_not_call_queueMessage', () => {
    const handler = freshMakeMissingKeyHandler('report');
    callHandler(handler, ['en'], 'common', 'another.missing', 'another.missing');
    expect(mockQueueMessage).not.toHaveBeenCalled();
  });

  it('report_mode_dedup_is_per_ns_key_pair', () => {
    const handler = freshMakeMissingKeyHandler('report');

    // Two different keys in the same namespace → each logged once
    callHandler(handler, ['en'], 'common', 'key.alpha', 'key.alpha');
    callHandler(handler, ['en'], 'common', 'key.beta', 'key.beta');

    // Same key twice more (should be deduped)
    callHandler(handler, ['en'], 'common', 'key.alpha', 'key.alpha');
    callHandler(handler, ['en'], 'common', 'key.beta', 'key.beta');

    expect(mockQueueLog).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// 'warn' mode
// ---------------------------------------------------------------------------

describe("makeMissingKeyHandler('warn')", () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    __resetMissingKeyReportCache();
  });

  it('warn_mode_console_warn_once_per_key', () => {
    const handler = makeMissingKeyHandler('warn');
    const ns = 'deck';
    const key = 'missing.title';
    const fallbackValue = key;

    // Two calls for the same key
    callHandler(handler, ['en'], ns, key, fallbackValue);
    callHandler(handler, ['en'], ns, key, fallbackValue);

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(`${ns}:${key}`));
  });

  it('warn_mode_never_throws', () => {
    const handler = makeMissingKeyHandler('warn');
    expect(() => callHandler(handler, ['en'], 'common', 'any.key', 'any.key')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Constructor injection
// ---------------------------------------------------------------------------

describe('mode_is_constructor_injected', () => {
  let freshMakeMissingKeyHandler: typeof makeMissingKeyHandler;
  let freshResetCache: typeof __resetMissingKeyReportCache;

  beforeAll(async () => {
    const mod = await import('@/i18n/missingKeyHandler');
    freshMakeMissingKeyHandler = mod.makeMissingKeyHandler;
    freshResetCache = mod.__resetMissingKeyReportCache;
  });

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockQueueLog.mockClear();
    freshResetCache();
  });

  it('explicit throw mode throws regardless of environment', () => {
    const handler = freshMakeMissingKeyHandler('throw');
    expect(() => callHandler(handler, ['en'], 'ns', 'k', 'k')).toThrow(/ns:k/);
  });

  it('explicit report mode calls queueLog regardless of environment', () => {
    const handler = freshMakeMissingKeyHandler('report');
    callHandler(handler, ['en'], 'ns', 'k', 'k');
    expect(mockQueueLog).toHaveBeenCalledTimes(1);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('explicit warn mode calls console.warn regardless of environment', () => {
    const handler = freshMakeMissingKeyHandler('warn');
    callHandler(handler, ['en'], 'ns', 'k', 'k');
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(mockQueueLog).not.toHaveBeenCalled();
  });
});
