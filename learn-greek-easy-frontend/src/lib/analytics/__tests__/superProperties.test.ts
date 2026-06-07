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
