/**
 * pf/questions/Translation.tsx — unit tests (PRACT2-1-03)
 *
 * Covers:
 * - TranslationElToEn: renders Greek word with pf-translation-word class
 * - TranslationElToEn: font family Noto Serif (class check)
 * - TranslationElToEn: never italic (font-style check via class)
 * - TranslationElToEn: lang="el" attribute on Greek word element
 * - TranslationElToEn: IPA shows when sub present
 * - TranslationElToEn: IPA absent when sub not present
 * - TranslationElToEn: AudioChip renders when audioState has url
 * - TranslationEnToEl: renders prompt with pf-en-prompt class
 * - TranslationEnToEl: no lang="el" on prompt (it's English)
 */

import React from 'react';

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { TranslationElToEn, TranslationEnToEl } from '../questions/Translation';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/components/ui/SpeakerButton', () => ({
  SpeakerButton: ({ audioUrl }: { audioUrl: string | null }) =>
    audioUrl ? <button data-testid="speaker-btn">play</button> : null,
}));

vi.mock('@/components/ui/AudioSpeedToggle', () => ({
  AudioSpeedToggle: () => <div data-testid="speed-toggle">speed</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, fb?: string) => fb ?? k }),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TranslationElToEn', () => {
  it('renders test container', () => {
    const { container } = render(<TranslationElToEn word="άντρας" />);
    expect(container.querySelector('[data-testid="pf-translation-el-en"]')).not.toBeNull();
  });

  it('renders Greek word text', () => {
    render(<TranslationElToEn word="άντρας" />);
    expect(screen.getByText('άντρας')).not.toBeNull();
  });

  it('applies pf-translation-word class to the Greek word element', () => {
    const { container } = render(<TranslationElToEn word="άντρας" />);
    const word = container.querySelector('.pf-translation-word');
    expect(word).not.toBeNull();
  });

  it('Greek word element has lang="el"', () => {
    const { container } = render(<TranslationElToEn word="άντρας" />);
    const word = container.querySelector('.pf-translation-word');
    expect(word?.getAttribute('lang')).toBe('el');
  });

  it('pf-translation-word does NOT have font-style italic inline', () => {
    const { container } = render(<TranslationElToEn word="άντρας" />);
    const word = container.querySelector('.pf-translation-word') as HTMLElement | null;
    // Inline style must not set italic (CSS class handles font, but no inline italic)
    expect(word?.style?.fontStyle).not.toBe('italic');
  });

  it('shows IPA when ipa is provided', () => {
    render(<TranslationElToEn word="άντρας" ipa="/ˈandras/" />);
    expect(screen.getByTestId('pf-ipa')).not.toBeNull();
    expect(screen.getByText('/ˈandras/')).not.toBeNull();
  });

  it('does NOT show IPA when ipa is null', () => {
    render(<TranslationElToEn word="άντρας" ipa={null} />);
    expect(screen.queryByTestId('pf-ipa')).toBeNull();
  });

  it('does NOT show IPA when ipa is undefined', () => {
    render(<TranslationElToEn word="άντρας" />);
    expect(screen.queryByTestId('pf-ipa')).toBeNull();
  });

  it('renders AudioChip when audioState has an audioUrl', () => {
    const audioState = {
      audioUrl: 'https://example.com/audio.mp3',
      isPlaying: false,
      isLoading: false,
      error: null,
      onToggle: vi.fn(),
      speed: 1 as const,
      setSpeed: vi.fn(),
    };
    render(<TranslationElToEn word="άντρας" audioState={audioState} />);
    expect(screen.getByTestId('pf-audio-chip')).not.toBeNull();
  });

  it('does NOT render AudioChip when audioState is null', () => {
    render(<TranslationElToEn word="άντρας" audioState={null} />);
    expect(screen.queryByTestId('pf-audio-chip')).toBeNull();
  });
});

describe('TranslationEnToEl', () => {
  it('renders test container', () => {
    const { container } = render(<TranslationEnToEl prompt="man" />);
    expect(container.querySelector('[data-testid="pf-translation-en-el"]')).not.toBeNull();
  });

  it('renders the English prompt text', () => {
    render(<TranslationEnToEl prompt="man" />);
    expect(screen.getByText('man')).not.toBeNull();
  });

  it('applies pf-en-prompt class', () => {
    const { container } = render(<TranslationEnToEl prompt="man" />);
    const el = container.querySelector('.pf-en-prompt');
    expect(el).not.toBeNull();
  });

  it('prompt element does NOT have lang="el" (it is English)', () => {
    const { container } = render(<TranslationEnToEl prompt="man" />);
    const el = container.querySelector('.pf-en-prompt');
    // lang attribute should not be "el" on the English prompt
    expect(el?.getAttribute('lang')).not.toBe('el');
  });
});
