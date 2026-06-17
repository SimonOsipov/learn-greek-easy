// src/components/admin/changelog/__tests__/ChangelogEditorDrawer.ruBundle.test.tsx
//
// ADMIN2-33-04: Regression guard for the RU bundle lazy-load fix.
//
// Root cause: init.ts only loads the RU bundle when the admin UI language is
// detected as RU at startup. When the admin UI is EN, i18n has no RU resources
// registered, so { lng: 'ru' } passed to tDynamic falls back to EN — making the
// preview badge show "New Feature" instead of "Новая функция".
//
// Fix: ChangelogEditorDrawer calls loadLanguageBundle('ru') on mount (guarded by
// i18n.hasResourceBundle) to ensure the RU changelog namespace is available
// whenever the drawer is used, regardless of the admin UI language.
//
// This test guards the fix by:
//  1. Mocking loadLanguageBundle so we can spy on it without hitting dynamic imports.
//  2. Removing the RU bundle from i18n (simulating the EN-admin-UI condition).
//  3. Asserting the drawer invokes loadLanguageBundle('ru') on mount.
//
// Without the fix this test fails because the component never imported or called
// loadLanguageBundle.

import { render, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChangelogEditorDrawer } from '../ChangelogEditorDrawer';

// ── Mock @/i18n/bundle-loader ─────────────────────────────────────────────────
// Provide a spy that resolves immediately with a minimal changelog bundle so
// addResourceBundle is called without actual dynamic imports.
const mockLoadLanguageBundle = vi.fn();
vi.mock('@/i18n/bundle-loader', () => ({
  loadLanguageBundle: (...args: unknown[]) => mockLoadLanguageBundle(...args),
}));

// ── Mock dependencies (mirrors the existing ChangelogEditorDrawer.test.tsx) ──
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('../ChangelogDeleteDialog', () => ({
  ChangelogDeleteDialog: () => null,
}));

const mockStoreState = {
  lang: 'en' as 'en' | 'ru',
  panelMode: 'form' as 'form' | 'json',
  isSaving: false,
  setLang: vi.fn(),
  setPanelMode: vi.fn(),
  createEntry: vi.fn(),
  updateEntry: vi.fn(),
};

vi.mock('@/stores/adminChangelogStore', () => ({
  useAdminChangelogStore: (selector?: (state: typeof mockStoreState) => unknown) =>
    selector ? selector(mockStoreState) : mockStoreState,
  selectAdminChangelogLang: (state: typeof mockStoreState) => state.lang,
  selectAdminChangelogPanelMode: (state: typeof mockStoreState) => state.panelMode,
  selectAdminChangelogIsSaving: (state: typeof mockStoreState) => state.isSaving,
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ChangelogEditorDrawer — RU bundle pre-load (ADMIN2-33-04 fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.lang = 'en';
    mockStoreState.panelMode = 'form';

    // Simulate the EN-admin-UI production condition: remove the RU changelog
    // bundle that test-setup registers synchronously, so the guard fires.
    i18n.removeResourceBundle('ru', 'changelog');

    // Resolve with a minimal bundle so addResourceBundle succeeds.
    mockLoadLanguageBundle.mockResolvedValue({
      ru: { changelog: { tag: { newFeature: 'Новая функция' } } },
    });
  });

  it('calls loadLanguageBundle("ru") on mount when RU changelog bundle is absent', async () => {
    // Pre-condition: RU changelog is NOT registered (simulates EN admin UI).
    expect(i18n.hasResourceBundle('ru', 'changelog')).toBe(false);

    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    // The effect fires asynchronously; wait for the spy to be called.
    await waitFor(() => {
      expect(mockLoadLanguageBundle).toHaveBeenCalledWith('ru');
    });
  });

  it('does NOT call loadLanguageBundle when RU changelog bundle is already present', async () => {
    // Restore the RU changelog bundle (simulates RU admin UI or second mount).
    i18n.addResourceBundle('ru', 'changelog', { tag: { newFeature: 'Новая функция' } }, true, true);

    render(<ChangelogEditorDrawer open={true} onClose={vi.fn()} />);

    // Give React one tick for effects to flush.
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Bundle already present — no load call needed.
    expect(mockLoadLanguageBundle).not.toHaveBeenCalled();
  });
});
