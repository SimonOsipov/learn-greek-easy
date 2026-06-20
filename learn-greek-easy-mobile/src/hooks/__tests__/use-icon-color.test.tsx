/// <reference types="jest" />
/**
 * THEME-06 (MOB-17) — useIconColor.
 *
 * Guards the SHARED per-theme icon-color conversion used by all six App `--fg-3`
 * (and the `--fg`) bare-icon/text sites (you.tsx gear, settings-list chevron,
 * word-row chevron, word-detail back/flag, topic-drill chevron, exercise-step
 * disabled "Check" label). Without this, a regression reverting any of those
 * conversions back to a hardcoded light rgb would stay green.
 *
 * Asserts the hook returns the LIGHT token rgb under resolvedScheme 'light' and
 * the DARK token rgb under 'dark', re-rendering when the store flips.
 */
import { renderHook, act } from '@testing-library/react-native';

// nativewind is the globalThis-backed manual mock; expo-secure-store is the
// manual sync mock — both required for the theme store to import + drive cleanly.
jest.mock('nativewind');
jest.mock('expo-secure-store');

import { useIconColor } from '@/hooks/use-icon-color';
import { useThemeStore } from '@/stores/theme-store';

// Concrete rgb values mirror global.css :root / .dark for --fg and --fg-3.
const FG_LIGHT = 'rgb(22,30,52)';
const FG_DARK = 'rgb(242,245,248)';
const FG3_LIGHT = 'rgb(127,136,159)';
const FG3_DARK = 'rgb(115,123,140)';

const initial = useThemeStore.getState().resolvedScheme;

afterEach(() => {
  act(() => {
    useThemeStore.setState({ resolvedScheme: initial });
  });
});

describe('useIconColor', () => {
  it('returns the LIGHT --fg-3 rgb when resolvedScheme is "light"', () => {
    act(() => {
      useThemeStore.setState({ resolvedScheme: 'light' });
    });
    const { result } = renderHook(() => useIconColor('fg-3'));
    expect(result.current).toBe(FG3_LIGHT);
  });

  it('returns the DARK --fg-3 rgb when resolvedScheme is "dark"', () => {
    act(() => {
      useThemeStore.setState({ resolvedScheme: 'dark' });
    });
    const { result } = renderHook(() => useIconColor('fg-3'));
    expect(result.current).toBe(FG3_DARK);
  });

  it('resolves the --fg token per theme too', () => {
    act(() => {
      useThemeStore.setState({ resolvedScheme: 'light' });
    });
    const { result } = renderHook(() => useIconColor('fg'));
    expect(result.current).toBe(FG_LIGHT);
  });

  it('flips the resolved color live when the store scheme changes', () => {
    act(() => {
      useThemeStore.setState({ resolvedScheme: 'light' });
    });
    const { result } = renderHook(() => useIconColor('fg-3'));
    expect(result.current).toBe(FG3_LIGHT);

    act(() => {
      useThemeStore.setState({ resolvedScheme: 'dark' });
    });
    expect(result.current).toBe(FG3_DARK);
  });
});
