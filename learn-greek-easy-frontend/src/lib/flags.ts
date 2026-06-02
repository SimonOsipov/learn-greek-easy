export const FLAGS = { collocations: 'collocations-enabled' } as const;
export type FlagKey = (typeof FLAGS)[keyof typeof FLAGS]; // 'collocations-enabled'

// Read at CALL TIME so vi.stubEnv('VITE_ENVIRONMENT', ...) works. Do NOT cache in a module const.
// VITE_ENVIRONMENT is typed 'development'|'staging'|'production'|'test'|undefined in src/env.d.ts.
const env = () => import.meta.env.VITE_ENVIRONMENT ?? 'development';

const FF_LIVE_ENVS = new Set(['production', 'staging']);
export const isFlagLiveEnv = (): boolean => FF_LIVE_ENVS.has(env());

// Collocations: ON in dev, OFF everywhere else (test + prod-until-ramped). Other flags default false.
export const flagDefault = (flag: FlagKey): boolean =>
  flag === FLAGS.collocations ? env() === 'development' : false;

// Bootstrap seeds posthog-js so the first render has a value (no flicker). prod/staging start OFF.
export const FLAG_BOOTSTRAP: Record<FlagKey, boolean> = { 'collocations-enabled': false };

declare global {
  interface Window {
    __FF_OVERRIDES__?: Partial<Record<FlagKey, boolean>>;
  }
}
