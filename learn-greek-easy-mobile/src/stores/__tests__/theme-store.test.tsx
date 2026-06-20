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

// ─────────────────────────────────────────────────────────────────────────────
// THEME-02 adversarial coverage (Mode-B QA). These do NOT re-author the 7 AC
// specs; they target the gaps those specs leave:
//   - transition SEQUENCES (system→dark→system re-tracks OS; rapid explicit flips)
//   - the INVERSE of spec #4: the bootstrap write-back must be GATED on
//     preference==='system' and must NOT clobber an explicit pref on an OS flip
//   - resolvedScheme is ALWAYS a concrete 'light'|'dark' — never 'system' /
//     undefined, including when the OS reports `undefined` under 'system'
//   - the setter fires colorScheme.set exactly ONCE (no bootstrap double-fire)
//   - ThemeBootstrap renders null with no setState-during-render warning
//
// Note on the harness: the manual mock's `colorScheme.set('light'|'dark')`
// MUTATES the OS-resolved snapshot. So after `setPreference('light')` the mock's
// `get()` would report 'light' too — which is why the explicit-pref-wins property
// is verified here through the BOOTSTRAP path (flip the OS *after* the pref is
// fixed, with NO intervening set()), where the gate is genuinely exercised,
// rather than relying on a post-set get() the mock can't isolate (spec #5 gap).
// ─────────────────────────────────────────────────────────────────────────────
describe('THEME-02 adversarial', () => {
  it('system → dark → system: after returning to system, resolvedScheme re-tracks the OS', () => {
    // Start under system, OS=dark.
    resetStore('system', 'dark');
    __setMockScheme('dark');

    const { rerender } = render(<ThemeBootstrap />);
    expect(useThemeStore.getState().resolvedScheme).toBe('dark');

    // Explicit dark (no OS dependence).
    act(() => {
      useThemeStore.getState().setPreference('dark');
    });
    expect(useThemeStore.getState().preference).toBe('dark');
    expect(useThemeStore.getState().resolvedScheme).toBe('dark');

    // Back to system; OS is now light. The bootstrap must re-track the OS — i.e.
    // resolvedScheme must NOT stay pinned to the last explicit value.
    act(() => {
      __setMockScheme('light');
      useThemeStore.getState().setPreference('system');
    });
    rerender(<ThemeBootstrap />);

    expect(useThemeStore.getState().preference).toBe('system');
    expect(useThemeStore.getState().resolvedScheme).toBe('light');
  });

  it('rapid explicit flips dark → light → dark: set() called each time; state stays consistent', () => {
    resetStore('dark', 'dark');
    colorSchemeSet.mockClear();

    act(() => {
      useThemeStore.getState().setPreference('dark');
    });
    act(() => {
      useThemeStore.getState().setPreference('light');
    });
    act(() => {
      useThemeStore.getState().setPreference('dark');
    });

    // colorScheme.set driven on every flip, with the right arg each time.
    expect(colorSchemeSet.mock.calls.map((c) => c[0])).toEqual(['dark', 'light', 'dark']);
    // Final state is internally consistent (explicit pref ⇒ resolvedScheme === pref).
    expect(useThemeStore.getState().preference).toBe('dark');
    expect(useThemeStore.getState().resolvedScheme).toBe('dark');
  });

  it('explicit pref ignores OS: under preference="dark", an OS flip to light leaves resolvedScheme="dark" (inverse of #4)', () => {
    // The bootstrap write-back must be gated on preference==='system'. With an
    // explicit 'dark' pref, flipping the OS to light must NOT clobber it.
    resetStore('dark', 'dark');
    __setMockScheme('dark');

    const { rerender } = render(<ThemeBootstrap />);
    expect(useThemeStore.getState().resolvedScheme).toBe('dark');

    // OS flips to light while the explicit 'dark' pref is in effect.
    act(() => {
      __setMockScheme('light');
    });
    rerender(<ThemeBootstrap />);

    // Explicit pref wins: resolvedScheme stays 'dark' (the gate held).
    expect(useThemeStore.getState().preference).toBe('dark');
    expect(useThemeStore.getState().resolvedScheme).toBe('dark');
  });

  it('explicit pref ignores OS: under preference="light", an OS flip to dark leaves resolvedScheme="light"', () => {
    resetStore('light', 'light');
    __setMockScheme('light');

    const { rerender } = render(<ThemeBootstrap />);
    expect(useThemeStore.getState().resolvedScheme).toBe('light');

    act(() => {
      __setMockScheme('dark');
    });
    rerender(<ThemeBootstrap />);

    expect(useThemeStore.getState().preference).toBe('light');
    expect(useThemeStore.getState().resolvedScheme).toBe('light');
  });

  it('setter fires colorScheme.set exactly once (no bootstrap double-fire on a normal setPreference)', () => {
    // Mount the bootstrap (its mount-once effect fires set() once), then clear
    // and drive the setter: only the setter should call set(), exactly once —
    // the mount-once effect must not re-fire on the resulting re-render.
    resetStore('dark', 'dark');
    render(<ThemeBootstrap />);
    colorSchemeSet.mockClear();

    act(() => {
      useThemeStore.getState().setPreference('light');
    });

    expect(colorSchemeSet).toHaveBeenCalledTimes(1);
    expect(colorSchemeSet).toHaveBeenCalledWith('light');
  });

  it('resolvedScheme stays a concrete value when the OS reports undefined under "system" (no undefined write)', () => {
    // Establish a known concrete resolvedScheme first (OS=dark, system).
    resetStore('system', 'dark');
    __setMockScheme('dark');
    const { rerender } = render(<ThemeBootstrap />);
    expect(useThemeStore.getState().resolvedScheme).toBe('dark');

    // OS now reports undefined (NativeWind wrapper can yield undefined). The
    // bootstrap must guard truthiness and NOT write undefined into the store.
    act(() => {
      __setMockScheme(undefined);
    });
    rerender(<ThemeBootstrap />);

    const resolved = useThemeStore.getState().resolvedScheme;
    expect(resolved).toBeDefined();
    expect(['light', 'dark']).toContain(resolved);
    // Specifically: retains the prior concrete value, not undefined / 'system'.
    expect(resolved).toBe('dark');
  });

  it('resolvedScheme is never "system" / undefined across every preference value', () => {
    for (const pref of ['light', 'dark', 'system'] as const) {
      resetStore('system', 'dark');
      __setMockScheme('dark');
      act(() => {
        useThemeStore.getState().setPreference(pref);
      });
      const resolved = useThemeStore.getState().resolvedScheme;
      expect(['light', 'dark']).toContain(resolved);
    }
  });

  it('ThemeBootstrap renders null and logs no "state update during render" console.error', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      resetStore('system', 'dark');
      __setMockScheme('dark');
      const { toJSON } = render(<ThemeBootstrap />);
      // Renders nothing.
      expect(toJSON()).toBeNull();
      // No React "Cannot update a component while rendering a different
      // component" / setState-during-render warning.
      const offending = errorSpy.mock.calls
        .map((c) => String(c[0]))
        .filter((m) => /update .*while rendering|state update during render/i.test(m));
      expect(offending).toEqual([]);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
