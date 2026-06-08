import type { Namespace, TFunction } from 'i18next';

/**
 * Escape hatch for genuinely-dynamic i18n keys (runtime-interpolated segments)
 * that cannot satisfy the literal-key union from the typed-keys gate (I18NG-01).
 * Use ONLY when the key is computed at runtime; static keys must stay literal so
 * the compile-time gate catches typos. The single documented escape hatch — do
 * not scatter `as never` / `@ts-ignore` at callsites.
 *
 * Implementation note: `t as never` widens away the strict key union; key is
 * runtime-dynamic by contract. The generic `Ns` param lets callers pass any
 * namespace-bound `TFunction` without TS2345 "not assignable to TFunction<common>".
 */
export function tDynamic<Ns extends Namespace>(
  t: TFunction<Ns>,
  key: string,
  options?: Record<string, unknown>
): string {
  // `t as never` widens away the strict key union; key is runtime-dynamic by contract.
  return (t as never as (k: string, o?: Record<string, unknown>) => string)(key, options);
}
