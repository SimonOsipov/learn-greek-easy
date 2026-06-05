/**
 * pf/questions/Sentence.tsx — unit tests (PRACT2-1-04, PRACT2-3-10, PRACT2-3-09)
 *
 * Covers:
 * - Sentence (el_to_en): renders Greek sentence with pf-sentence-text class
 * - Sentence (el_to_en): lang="el" on the Greek sentence element
 * - Sentence (el_to_en): never italic (no inline font-style italic)
 * - Sentence (el_to_en): curly-quote class applied (.pf-sentence-text)
 * - Sentence (el_to_en): AudioChip renders when audioState has url
 * - Sentence (el_to_en): AudioChip absent when audioState is null
 * - Sentence (el_to_en): IPA renders when ipa prop is present (PRACT2-3-10)
 * - Sentence (el_to_en): IPA absent when ipa prop is not provided (PRACT2-3-10)
 * - Sentence (el_to_en): grammar-tag chip renders label when grammarTag present (PRACT2-3-09)
 * - Sentence (el_to_en): grammar-tag chip absent when grammarTag not present (PRACT2-3-09)
 * - Sentence (el_to_en): no UnwiredDot red dot (PRACT2-3-09)
 * - Sentence (en_to_el): renders English text with pf-sentence-en-text class
 * - Sentence (en_to_el): no lang="el" on the English element
 * - Sentence (en_to_el): IPA renders when ipa prop is present (PRACT2-3-10)
 * - Sentence (en_to_el): IPA absent when ipa prop is not provided (PRACT2-3-10)
 * - Sentence (en_to_el): grammar-tag chip renders label when grammarTag present (PRACT2-3-09)
 * - Sentence (en_to_el): grammar-tag chip absent when grammarTag not present (PRACT2-3-09)
 * - Direction: 'Translate this sentence' → el_to_en container
 * - Direction: 'Translate to Greek' → en_to_el container
 * - Direction: undefined/null prompt defaults to el_to_en
 */

import React from 'react';

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Sentence, SentenceElToEn, SentenceEnToEl } from '../questions/Sentence';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/components/ui/SpeakerButton', () => ({
  SpeakerButton: ({ audioUrl }: { audioUrl: string | null }) =>
    audioUrl ? <button data-testid="speaker-btn">play</button> : null,
}));

vi.mock('@/components/ui/AudioSpeedToggle', () => ({
  AudioSpeedToggle: () => <div data-testid="speed-toggle">speed</div>,
}));

// ─── Test helpers ─────────────────────────────────────────────────────────────

const mockAudioState = {
  audioUrl: 'https://example.com/audio.mp3',
  isPlaying: false,
  isLoading: false,
  error: null,
  onToggle: vi.fn(),
  speed: 1 as const,
  setSpeed: vi.fn(),
};

// ─── SentenceElToEn tests ─────────────────────────────────────────────────────

describe('SentenceElToEn', () => {
  it('renders the el-to-en container', () => {
    const { container } = render(
      <SentenceElToEn prompt="Translate this sentence" main="Ο άντρας τρέχει." />
    );
    expect(container.querySelector('[data-testid="pf-sentence-el-en"]')).not.toBeNull();
  });

  it('renders the Greek sentence text', () => {
    render(<SentenceElToEn prompt="Translate this sentence" main="Ο άντρας τρέχει." />);
    expect(screen.getByText('Ο άντρας τρέχει.')).not.toBeNull();
  });

  it('applies pf-sentence-text class to the Greek sentence element', () => {
    const { container } = render(
      <SentenceElToEn prompt="Translate this sentence" main="Ο άντρας τρέχει." />
    );
    expect(container.querySelector('.pf-sentence-text')).not.toBeNull();
  });

  it('Greek sentence element has lang="el"', () => {
    const { container } = render(
      <SentenceElToEn prompt="Translate this sentence" main="Ο άντρας τρέχει." />
    );
    const sentence = container.querySelector('.pf-sentence-text');
    expect(sentence?.getAttribute('lang')).toBe('el');
  });

  it('Greek sentence element does NOT have inline font-style italic', () => {
    const { container } = render(
      <SentenceElToEn prompt="Translate this sentence" main="Ο άντρας τρέχει." />
    );
    const sentence = container.querySelector('.pf-sentence-text') as HTMLElement | null;
    expect(sentence?.style?.fontStyle).not.toBe('italic');
  });

  it('renders AudioChip when audioState has a URL', () => {
    render(
      <SentenceElToEn
        prompt="Translate this sentence"
        main="Ο άντρας τρέχει."
        audioState={mockAudioState}
      />
    );
    expect(screen.getByTestId('pf-audio-chip')).not.toBeNull();
  });

  it('does NOT render AudioChip when audioState is null', () => {
    render(
      <SentenceElToEn prompt="Translate this sentence" main="Ο άντρας τρέχει." audioState={null} />
    );
    expect(screen.queryByTestId('pf-audio-chip')).toBeNull();
  });

  it('does NOT render AudioChip when audioState is undefined', () => {
    render(<SentenceElToEn prompt="Translate this sentence" main="Ο άντρας τρέχει." />);
    expect(screen.queryByTestId('pf-audio-chip')).toBeNull();
  });

  // PRACT2-3-10: IPA renders when ipa prop is present
  it('renders .pf-ipa when ipa prop is provided', () => {
    render(
      <SentenceElToEn
        prompt="Translate this sentence"
        main="Ο άντρας τρέχει."
        ipa="/o ˈan.dras ˈtre.xi/"
      />
    );
    expect(screen.getByTestId('pf-ipa')).not.toBeNull();
    expect(screen.getByTestId('pf-ipa').textContent).toBe('/o ˈan.dras ˈtre.xi/');
  });

  it('does NOT render .pf-ipa when ipa prop is absent', () => {
    render(<SentenceElToEn prompt="Translate this sentence" main="Ο άντρας τρέχει." />);
    expect(screen.queryByTestId('pf-ipa')).toBeNull();
  });

  it('does NOT render .pf-ipa when ipa prop is null', () => {
    render(<SentenceElToEn prompt="Translate this sentence" main="Ο άντρας τρέχει." ipa={null} />);
    expect(screen.queryByTestId('pf-ipa')).toBeNull();
  });

  // PRACT2-3-09: grammar-tag chip renders real label when grammarTag present
  it('renders .pf-sentence-tag with label text when grammarTag is provided', () => {
    render(
      <SentenceElToEn
        prompt="Translate this sentence"
        main="Ο άντρας τρέχει."
        grammarTag="Locative"
      />
    );
    expect(screen.getByTestId('pf-sentence-tag')).not.toBeNull();
    expect(screen.getByTestId('pf-sentence-tag').textContent).toBe('Locative');
  });

  // PRACT2-3-09: grammar-tag chip absent when no grammarTag (dominant case today)
  it('does NOT render .pf-sentence-tag when grammarTag is absent', () => {
    const { container } = render(
      <SentenceElToEn prompt="Translate this sentence" main="Ο άντρας τρέχει." />
    );
    expect(container.querySelector('[data-testid="pf-sentence-tag"]')).toBeNull();
  });

  it('does NOT render .pf-sentence-tag when grammarTag is null', () => {
    const { container } = render(
      <SentenceElToEn prompt="Translate this sentence" main="Ο άντρας τρέχει." grammarTag={null} />
    );
    expect(container.querySelector('[data-testid="pf-sentence-tag"]')).toBeNull();
  });

  // PRACT2-3-09: no red dot (UnwiredDot removed)
  it('does NOT render an UnwiredDot red dot', () => {
    const { container } = render(
      <SentenceElToEn prompt="Translate this sentence" main="Ο άντρας τρέχει." />
    );
    expect(container.querySelector('[data-testid="unwired-dot"]')).toBeNull();
  });

  it('shows the prompt label when prompt is provided', () => {
    render(<SentenceElToEn prompt="Translate this sentence" main="Ο άντρας τρέχει." />);
    expect(screen.getByTestId('pf-sentence-prompt')).not.toBeNull();
    expect(screen.getByText('Translate this sentence')).not.toBeNull();
  });
});

// ─── SentenceEnToEl tests ─────────────────────────────────────────────────────

describe('SentenceEnToEl', () => {
  it('renders the en-to-el container', () => {
    const { container } = render(
      <SentenceEnToEl prompt="Translate to Greek" main="The man runs." />
    );
    expect(container.querySelector('[data-testid="pf-sentence-en-el"]')).not.toBeNull();
  });

  it('renders the English text', () => {
    render(<SentenceEnToEl prompt="Translate to Greek" main="The man runs." />);
    expect(screen.getByText('The man runs.')).not.toBeNull();
  });

  it('applies pf-sentence-en-text class to the English element', () => {
    const { container } = render(
      <SentenceEnToEl prompt="Translate to Greek" main="The man runs." />
    );
    expect(container.querySelector('.pf-sentence-en-text')).not.toBeNull();
  });

  it('English element does NOT have lang="el"', () => {
    const { container } = render(
      <SentenceEnToEl prompt="Translate to Greek" main="The man runs." />
    );
    const el = container.querySelector('.pf-sentence-en-text');
    expect(el?.getAttribute('lang')).not.toBe('el');
  });

  // PRACT2-3-10: IPA renders when ipa prop is present
  it('renders .pf-ipa when ipa prop is provided', () => {
    render(
      <SentenceEnToEl prompt="Translate to Greek" main="The man runs." ipa="/o ˈan.dras ˈtre.xi/" />
    );
    expect(screen.getByTestId('pf-ipa')).not.toBeNull();
    expect(screen.getByTestId('pf-ipa').textContent).toBe('/o ˈan.dras ˈtre.xi/');
  });

  it('does NOT render .pf-ipa when ipa prop is absent', () => {
    render(<SentenceEnToEl prompt="Translate to Greek" main="The man runs." />);
    expect(screen.queryByTestId('pf-ipa')).toBeNull();
  });

  // PRACT2-3-09: grammar-tag chip renders real label when grammarTag present
  it('renders .pf-sentence-tag with label text when grammarTag is provided', () => {
    render(
      <SentenceEnToEl prompt="Translate to Greek" main="The man runs." grammarTag="Comparative" />
    );
    expect(screen.getByTestId('pf-sentence-tag')).not.toBeNull();
    expect(screen.getByTestId('pf-sentence-tag').textContent).toBe('Comparative');
  });

  // PRACT2-3-09: grammar-tag chip absent when no grammarTag
  it('does NOT render .pf-sentence-tag when grammarTag is absent', () => {
    const { container } = render(
      <SentenceEnToEl prompt="Translate to Greek" main="The man runs." />
    );
    expect(container.querySelector('[data-testid="pf-sentence-tag"]')).toBeNull();
  });

  // PRACT2-3-09: no red dot (UnwiredDot removed)
  it('does NOT render an UnwiredDot red dot', () => {
    const { container } = render(
      <SentenceEnToEl prompt="Translate to Greek" main="The man runs." />
    );
    expect(container.querySelector('[data-testid="unwired-dot"]')).toBeNull();
  });
});

// ─── Sentence (unified) direction routing tests ───────────────────────────────

describe('Sentence (direction routing)', () => {
  it('routes to el_to_en when prompt is "Translate this sentence"', () => {
    const { container } = render(
      <Sentence prompt="Translate this sentence" main="Ο άντρας τρέχει." audioState={null} />
    );
    expect(container.querySelector('[data-testid="pf-sentence-el-en"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="pf-sentence-en-el"]')).toBeNull();
  });

  it('routes to en_to_el when prompt is "Translate to Greek"', () => {
    const { container } = render(
      <Sentence prompt="Translate to Greek" main="The man runs." audioState={null} />
    );
    expect(container.querySelector('[data-testid="pf-sentence-en-el"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="pf-sentence-el-en"]')).toBeNull();
  });

  it('defaults to el_to_en when prompt is undefined', () => {
    const { container } = render(
      <Sentence prompt={undefined} main="Ο άντρας τρέχει." audioState={null} />
    );
    expect(container.querySelector('[data-testid="pf-sentence-el-en"]')).not.toBeNull();
  });

  it('defaults to el_to_en when prompt is null', () => {
    const { container } = render(
      <Sentence prompt={null} main="Ο άντρας τρέχει." audioState={null} />
    );
    expect(container.querySelector('[data-testid="pf-sentence-el-en"]')).not.toBeNull();
  });

  it('renders AudioChip in el_to_en when audioState has URL', () => {
    render(
      <Sentence
        prompt="Translate this sentence"
        main="Ο άντρας τρέχει."
        audioState={mockAudioState}
      />
    );
    expect(screen.getByTestId('pf-audio-chip')).not.toBeNull();
  });

  it('does not render AudioChip in en_to_el direction (audio not shown for EN prompt)', () => {
    const { container } = render(
      <Sentence prompt="Translate to Greek" main="The man runs." audioState={mockAudioState} />
    );
    // en_to_el renderer omits audioState prop
    expect(container.querySelector('[data-testid="pf-audio-chip"]')).toBeNull();
  });

  // Direction-integrity: rawPrompt overrides localized prompt for direction derivation (PRACT2-5)
  it('rawPrompt "Translate to Greek" + localized RU prompt → en_to_el (rawPrompt wins)', () => {
    const { container } = render(
      <Sentence
        rawPrompt="Translate to Greek"
        prompt="Переведите на греческий"
        main="The man runs."
        audioState={null}
      />
    );
    // Direction derives from rawPrompt, not the localized prompt
    expect(container.querySelector('[data-testid="pf-sentence-en-el"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="pf-sentence-el-en"]')).toBeNull();
  });

  it('rawPrompt "Translate this sentence" + localized RU prompt → el_to_en (rawPrompt wins)', () => {
    const { container } = render(
      <Sentence
        rawPrompt="Translate this sentence"
        prompt="Переведите предложение"
        main="Ο άντρας τρέχει."
        audioState={null}
      />
    );
    // Direction derives from rawPrompt (not 'Translate to Greek') → el_to_en
    expect(container.querySelector('[data-testid="pf-sentence-el-en"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="pf-sentence-en-el"]')).toBeNull();
  });

  // PRACT2-3-09: grammarTag threaded to both directions
  it('threads grammarTag to el_to_en and renders the chip', () => {
    render(
      <Sentence
        prompt="Translate this sentence"
        main="Ο άντρας τρέχει."
        audioState={null}
        grammarTag="Locative"
      />
    );
    expect(screen.getByTestId('pf-sentence-tag')).not.toBeNull();
    expect(screen.getByTestId('pf-sentence-tag').textContent).toBe('Locative');
  });

  it('threads grammarTag to en_to_el and renders the chip', () => {
    render(
      <Sentence
        prompt="Translate to Greek"
        main="The man runs."
        audioState={null}
        grammarTag="Comparative"
      />
    );
    expect(screen.getByTestId('pf-sentence-tag')).not.toBeNull();
    expect(screen.getByTestId('pf-sentence-tag').textContent).toBe('Comparative');
  });
});
