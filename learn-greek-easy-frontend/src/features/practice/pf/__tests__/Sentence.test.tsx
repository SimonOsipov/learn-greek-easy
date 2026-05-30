/**
 * pf/questions/Sentence.tsx — unit tests (PRACT2-1-04)
 *
 * Covers:
 * - Sentence (el_to_en): renders Greek sentence with pf-sentence-text class
 * - Sentence (el_to_en): lang="el" on the Greek sentence element
 * - Sentence (el_to_en): never italic (no inline font-style italic)
 * - Sentence (el_to_en): curly-quote class applied (.pf-sentence-text)
 * - Sentence (el_to_en): AudioChip renders when audioState has url
 * - Sentence (el_to_en): AudioChip absent when audioState is null
 * - Sentence (el_to_en): grammar-tag chip is present
 * - Sentence (el_to_en): grammar-tag chip contains an UnwiredDot (data-testid="unwired-dot")
 * - Sentence (el_to_en): grammar-tag chip does NOT contain fabricated text labels
 * - Sentence (en_to_el): renders English text with pf-sentence-en-text class
 * - Sentence (en_to_el): no lang="el" on the English element
 * - Sentence (en_to_el): grammar-tag chip present with UnwiredDot
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

// dx.css import in Sentence.tsx — mock to avoid JSDOM CSS errors
vi.mock('@/features/decks/dx/dx.css', () => ({}));

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

  it('renders the grammar-tag chip (.pf-sentence-tag)', () => {
    const { container } = render(
      <SentenceElToEn prompt="Translate this sentence" main="Ο άντρας τρέχει." />
    );
    expect(container.querySelector('[data-testid="pf-sentence-tag"]')).not.toBeNull();
  });

  it('grammar-tag chip contains an UnwiredDot (data-testid="unwired-dot")', () => {
    render(<SentenceElToEn prompt="Translate this sentence" main="Ο άντρας τρέχει." />);
    expect(screen.getByTestId('unwired-dot')).not.toBeNull();
  });

  it('grammar-tag chip does NOT contain a fabricated grammar label text', () => {
    const { container } = render(
      <SentenceElToEn prompt="Translate this sentence" main="Ο άντρας τρέχει." />
    );
    const tag = container.querySelector('[data-testid="pf-sentence-tag"]');
    // The tag should have no meaningful text content (only the UnwiredDot placeholder)
    // Text content of the dot wrapper itself is empty aside from the marker span
    const textContent = tag?.textContent ?? '';
    // Must not contain real grammar terms
    expect(textContent).not.toContain('Locative');
    expect(textContent).not.toContain('Comparative');
    expect(textContent).not.toContain('Accusative');
    expect(textContent).not.toContain('Genitive');
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

  it('renders the grammar-tag chip (.pf-sentence-tag)', () => {
    const { container } = render(
      <SentenceEnToEl prompt="Translate to Greek" main="The man runs." />
    );
    expect(container.querySelector('[data-testid="pf-sentence-tag"]')).not.toBeNull();
  });

  it('grammar-tag chip contains an UnwiredDot (data-testid="unwired-dot")', () => {
    render(<SentenceEnToEl prompt="Translate to Greek" main="The man runs." />);
    expect(screen.getByTestId('unwired-dot')).not.toBeNull();
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
});
