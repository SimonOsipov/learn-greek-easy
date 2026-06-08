import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerInterfaceLanguage, registerTheme } from '../superProperties';
import { __setPosthogInstance } from '../track';

const mockRegister = vi.fn();

describe('superProperties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __setPosthogInstance({ register: mockRegister } as unknown as import('posthog-js').PostHog);
  });

  afterEach(() => {
    __setPosthogInstance(null);
  });

  it('registerTheme calls posthog.register with { theme }', () => {
    registerTheme('dark');
    expect(mockRegister).toHaveBeenCalledWith({ theme: 'dark' });
  });

  it('registerInterfaceLanguage calls posthog.register with { interface_language }', () => {
    registerInterfaceLanguage('en');
    expect(mockRegister).toHaveBeenCalledWith({ interface_language: 'en' });
  });

  it('registerTheme does not throw and does not call register when instance is null', () => {
    __setPosthogInstance(null);
    expect(() => registerTheme('dark')).not.toThrow();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('registerInterfaceLanguage does not throw and does not call register when instance is null', () => {
    __setPosthogInstance(null);
    expect(() => registerInterfaceLanguage('en')).not.toThrow();
    expect(mockRegister).not.toHaveBeenCalled();
  });
});

describe('superProperties — adversarial / edge coverage', () => {
  afterEach(() => {
    __setPosthogInstance(null);
  });

  it('registerTheme no-ops without throwing when instance has capture but no register (partial instance)', () => {
    // Exercises the typeof ?.register === 'function' guard specifically — not just null guard
    const captureOnlyInstance = {
      capture: vi.fn(),
    } as unknown as import('posthog-js').PostHog;
    __setPosthogInstance(captureOnlyInstance);
    expect(() => registerTheme('light')).not.toThrow();
    // register was never present on this stub — no call should have happened
  });

  it('registerInterfaceLanguage no-ops without throwing when instance has capture but no register (partial instance)', () => {
    const captureOnlyInstance = {
      capture: vi.fn(),
    } as unknown as import('posthog-js').PostHog;
    __setPosthogInstance(captureOnlyInstance);
    expect(() => registerInterfaceLanguage('ru')).not.toThrow();
  });

  it('registerTheme no-ops when register field exists but is not a function', () => {
    const brokenInstance = {
      register: 'not-a-function',
    } as unknown as import('posthog-js').PostHog;
    __setPosthogInstance(brokenInstance);
    expect(() => registerTheme('dark')).not.toThrow();
  });

  it('registerTheme passes the theme value through unmodified', () => {
    const mockReg = vi.fn();
    __setPosthogInstance({ register: mockReg } as unknown as import('posthog-js').PostHog);
    registerTheme('light');
    expect(mockReg).toHaveBeenCalledWith({ theme: 'light' });
    expect(mockReg.mock.calls[0][0]).toStrictEqual({ theme: 'light' });
  });

  it('registerInterfaceLanguage passes the language value through unmodified', () => {
    const mockReg = vi.fn();
    __setPosthogInstance({ register: mockReg } as unknown as import('posthog-js').PostHog);
    registerInterfaceLanguage('ru');
    expect(mockReg).toHaveBeenCalledWith({ interface_language: 'ru' });
    expect(mockReg.mock.calls[0][0]).toStrictEqual({ interface_language: 'ru' });
  });

  it('register is called exactly once per registerTheme call (no batching or debouncing)', () => {
    const mockReg = vi.fn();
    __setPosthogInstance({ register: mockReg } as unknown as import('posthog-js').PostHog);
    registerTheme('dark');
    registerTheme('light');
    expect(mockReg).toHaveBeenCalledTimes(2);
  });
});
