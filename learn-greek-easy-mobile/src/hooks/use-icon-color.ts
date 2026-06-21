/**
 * useIconColor — THEME-06 (MOB-17).
 *
 * Resolves an App-palette content-color TOKEN to its concrete rgb for the live
 * theme, for use on bare props that cannot take a className token (e.g. a lucide
 * icon's `color=`, or an inline `style.color`). Driven by the global theme store
 * (`useThemeStore.resolvedScheme`), so the icon switches with light/dark exactly
 * like a `text-fg` / `text-fg-3` className would.
 *
 * Why this exists: lucide-react-native icons take a string `color` value, not a
 * NativeWind className, so the App `--fg` / `--fg-3` tokens (which DO flip between
 * light and dark in global.css) cannot be applied via class. Hardcoding one
 * scheme's rgb (the prior pattern: `const ICON_FG3 = 'rgb(127,136,159)'`) pins the
 * icon to that scheme — it never switches. This hook centralises the per-theme
 * resolution so the App `--fg`/`--fg-3` bare-icon defect class has ONE source of
 * truth instead of N drifting copies.
 *
 * Scope: App-palette content tokens only. The Practice/review tree's slate
 * `--practice-text-muted` icons are a SEPARATE, `isDark`-keyed family (driven by
 * the review screen's own `isDark` prop) and are intentionally NOT handled here.
 *
 * MOB-13: returns full explicit rgb values (no `/NN` opacity modifier on a
 * var-backed token).
 */
import { useThemeStore } from '@/stores/theme-store';

/** App content-color tokens that flip between light and dark in global.css. */
export type IconColorToken = 'fg' | 'fg-3';

// Concrete rgb per token, per scheme — mirrors the global.css :root / .dark values.
//   --fg   light hsl(222 32% 12%) ≈ rgb(22,30,52)    dark hsl(210 30% 96%) = rgb(242,245,248)
//   --fg-3 light hsl(222 14% 56%) = rgb(127,136,159)  dark hsl(220 10% 50%) = rgb(115,123,140)
const ICON_COLORS: Record<IconColorToken, { light: string; dark: string }> = {
  fg: { light: 'rgb(22,30,52)', dark: 'rgb(242,245,248)' },
  'fg-3': { light: 'rgb(127,136,159)', dark: 'rgb(115,123,140)' },
};

/**
 * Resolve an App content-color token to its concrete rgb for the current theme.
 * Re-renders the caller when `resolvedScheme` flips.
 */
export function useIconColor(token: IconColorToken): string {
  return useThemeStore((s) =>
    s.resolvedScheme === 'dark' ? ICON_COLORS[token].dark : ICON_COLORS[token].light,
  );
}
