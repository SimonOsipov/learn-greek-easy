/// <reference types="jest" />
import React from 'react';
import { render, act } from '@testing-library/react-native';

// Drive/assert NativeWind's colorScheme API through the manual mock
// (__mocks__/nativewind.js, extended for THEME-02/F2). `colorScheme.set` is the
// stable jest.fn the store's setter is expected to drive (the mock backs both
// `colorScheme.set` and the `useColorScheme()` hook setter, so the store's
// implementation choice does not force a mock rewrite; we assert on the stable
// `colorScheme.set` surface). `colorScheme` is a real NativeWind export, so the
// named import type-checks against the published types.
import { colorScheme } from 'nativewind';

import { useThemeStore, ThemeBootstrap } from '@/stores/theme-store';

// `__setMockScheme` is a TEST-ONLY helper that only exists on the manual mock
// (__mocks__/nativewind.js) and is NOT part of NativeWind's published types, so
// pull it from the resolved mock rather than a typed named import. It flips the
// OS-resolved value between renders for the system OS-flip spec (#4).
const { __setMockScheme } = jest.requireMock('nativewind') as {
  __setMockScheme: (v: 'light' | 'dark' | undefined) => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// THEME-02 (MOB-17) — RED tests authored in the Test-Spec (Mode-A) stage, BEFORE
// implementation. They transcribe task-1073's 7-row Test Specs table.
//
// SKELETON UNDER TEST — the executor must flesh these out:
//   - src/stores/theme-store.ts → `useThemeStore` (setPreference is a no-op stub)
//   - src/stores/theme-store.ts → `ThemeBootstrap` (renders null, no effect wired)
//
// These MUST fail on ASSERTION (not import). Specs #1–#3, #5 are plain-store
// unit tests; #4, #6, #7 are RNTL component tests against `ThemeBootstrap`.
// ─────────────────────────────────────────────────────────────────────────────

const colorSchemeSet = colorScheme.set as jest.Mock;

function resetStore(preference: 'light' | 'dark' | 'system', resolvedScheme: 'light' | 'dark') {
  // setState bypasses the (stubbed) setter so we can stage a known starting
  // state for each spec without depending on the behavior under test.
  useThemeStore.setState({ preference, resolvedScheme });
}

beforeEach(() => {
  colorSchemeSet.mockClear();
  // Default OS-resolved scheme back to 'dark' between tests.
  __setMockScheme('dark');
  // Fresh store defaults (initial: preference 'system', resolvedScheme 'dark').
  resetStore('system', 'dark');
});

describe('theme-store: setter drives colorScheme (plain store)', () => {
  it('#1 setPreference("dark") calls setColorScheme("dark") and sets preference="dark"', () => {
    act(() => {
      useThemeStore.getState().setPreference('dark');
    });

    expect(colorSchemeSet).toHaveBeenCalledTimes(1);
    expect(colorSchemeSet).toHaveBeenCalledWith('dark');
    expect(useThemeStore.getState().preference).toBe('dark');
  });

  it('#2 setPreference("light") calls setColorScheme("light") and sets preference="light"', () => {
    resetStore('dark', 'dark');

    act(() => {
      useThemeStore.getState().setPreference('light');
    });

    expect(colorSchemeSet).toHaveBeenCalledWith('light');
    expect(useThemeStore.getState().preference).toBe('light');
  });

  it('#3 setPreference("system") calls setColorScheme("system") and sets preference="system"', () => {
    resetStore('dark', 'dark');

    act(() => {
      useThemeStore.getState().setPreference('system');
    });

    expect(colorSchemeSet).toHaveBeenCalledWith('system');
    expect(useThemeStore.getState().preference).toBe('system');
  });

  it('#5 resolvedScheme equals the explicit preference (pref "light" wins over OS=dark)', () => {
    // OS resolves to dark; an explicit 'light' preference must still win.
    __setMockScheme('dark');
    resetStore('dark', 'dark');

    act(() => {
      useThemeStore.getState().setPreference('light');
    });

    expect(useThemeStore.getState().resolvedScheme).toBe('light');
  });
});

describe('theme-store: bootstrap component (RNTL)', () => {
  it('#4 under "system", an OS flip dark→light updates resolvedScheme', () => {
    // pref = 'system', OS currently 'dark'.
    resetStore('system', 'dark');
    __setMockScheme('dark');

    const { rerender } = render(<ThemeBootstrap />);
    // Sanity: bootstrap should have resolved to the current OS scheme.
    expect(useThemeStore.getState().resolvedScheme).toBe('dark');

    // OS flips to light; bootstrap re-renders and writes the new value back.
    act(() => {
      __setMockScheme('light');
    });
    rerender(<ThemeBootstrap />);

    expect(useThemeStore.getState().resolvedScheme).toBe('light');
  });

  it('#6 does NOT call setColorScheme during render — only from an effect (after mount)', () => {
    resetStore('dark', 'dark');

    let callsAfterRenderPass = 0;
    // React.createElement-based probe: capture how many times setColorScheme had
    // been called by the time the element tree was constructed (render pass),
    // before effects flush. A side-effect-free render must not have called it yet.
    function Probe() {
      callsAfterRenderPass = colorSchemeSet.mock.calls.length;
      return <ThemeBootstrap />;
    }

    render(<Probe />);

    // During the render pass, setColorScheme must NOT have been invoked.
    expect(callsAfterRenderPass).toBe(0);
    // After mount/effects, the bootstrap must have applied the stored pref.
    expect(colorSchemeSet).toHaveBeenCalledWith('dark');
  });

  it('#7 applies the stored preference exactly once on mount; not re-called on unrelated re-render', () => {
    resetStore('dark', 'dark');

    const { rerender } = render(<ThemeBootstrap />);
    expect(colorSchemeSet).toHaveBeenCalledTimes(1);
    expect(colorSchemeSet).toHaveBeenCalledWith('dark');

    // An unrelated re-render (no pref change, no OS change) must not re-apply.
    rerender(<ThemeBootstrap />);
    expect(colorSchemeSet).toHaveBeenCalledTimes(1);
  });
});
