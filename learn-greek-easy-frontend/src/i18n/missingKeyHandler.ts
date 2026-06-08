/**
 * Missing-key handler factory for i18next — I18NG-03 (INFRA-06).
 *
 * Three modes:
 *   'throw'  — throws in tests so missing keys surface immediately.
 *   'report' — sends a deduplicated warn log to Sentry Logs (production).
 *   'warn'   — logs to console.warn (local dev).
 *
 * Mode is constructor-injected; no env-sniffing inside the handler.
 * The dedup Set (`reported`) is module-level and shared across all handler
 * instances.  Use __resetMissingKeyReportCache() to clear it between tests.
 */

import { queueLog } from '@/lib/sentry-queue';

export type MissingKeyMode = 'throw' | 'report' | 'warn';

type MissingKeyHandler = (
  lngs: readonly string[],
  ns: string,
  key: string,
  fallbackValue: string,
  ...rest: unknown[]
) => void;

/**
 * Module-level dedup Set — persists across calls within the same page load /
 * test run.  Keeps 'report' and 'warn' modes quiet after the first occurrence.
 */
const reported = new Set<string>();

/**
 * Create an i18next-compatible missingKeyHandler function.
 *
 * The handler fires only when `saveMissing: true` is set in i18n init options.
 *
 * Escape hatch: if the caller passes a `defaultValue` option, i18next sets
 * `fallbackValue` to that string (different from `key`), so the handler treats
 * the lookup as intentional and does NOT throw / log.
 *
 * Implementation note: 'warn' mode calls console.warn directly (not via
 * loglevel) so that vi.spyOn(console, 'warn') in unit tests captures the call
 * reliably without loglevel's pre-captured method-factory reference interfering.
 * The 'report' mode unit tests use vi.resetModules() + dynamic import to load
 * a fresh copy of this module after the vi.mock('@/lib/sentry-queue') factory
 * has been registered, ensuring queueLog resolves to the mock spy.
 */
export function makeMissingKeyHandler(mode: MissingKeyMode): MissingKeyHandler {
  return (_lngs, ns, key, fallbackValue) => {
    const id = `${ns}:${key}`;

    if (mode === 'throw') {
      // fallbackValue === key means no translation found AND no defaultValue supplied.
      if (fallbackValue === key) {
        throw new Error(`[i18n] missing key ${id} (no translation, no defaultValue)`);
      }
      return;
    }

    // 'report' and 'warn' modes: deduplicate to log each missing key once.
    if (reported.has(id)) return;
    reported.add(id);

    if (mode === 'report') {
      queueLog('warn', `[i18n] missing key ${id}`);
    } else {
      // 'warn' mode — call console.warn directly so vi.spyOn(console, 'warn')
      // captures the call without loglevel's pre-captured method reference interfering.
      // eslint-disable-next-line no-console
      console.warn(`[i18n] missing key ${id}`);
    }
  };
}

/**
 * Reset the module-level dedup cache.
 * Exported for test use only — call in beforeEach to isolate test runs.
 */
export function __resetMissingKeyReportCache(): void {
  reported.clear();
}
