/**
 * pf/questions/Grammar.tsx — unit tests (PRACT2-1-03)
 *
 * Covers:
 * - GrammarArticle: renders article blank "???" when leading article detected
 * - GrammarArticle: blank has pf-grammar-blank class
 * - GrammarArticle: stem without leading article → no blank rendered
 * - GrammarArticle: recognized article tokens (ο, η, το)
 * - GrammarPlural: renders stem with pf-grammar-stem + lang="el"
 * - GrammarPlural: shows IPA when present
 * - GrammarPlural: no IPA when absent
 * - GrammarPlural: renders AudioChip when audioState has url
 */

import React from 'react';

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { GrammarArticle, GrammarPlural } from '../questions/Grammar';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/components/ui/SpeakerButton', () => ({
  SpeakerButton: ({ audioUrl }: { audioUrl: string | null }) =>
    audioUrl ? <button data-testid="speaker-btn">play</button> : null,
}));

vi.mock('@/components/ui/AudioSpeedToggle', () => ({
  AudioSpeedToggle: () => <div data-testid="speed-toggle">speed</div>,
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GrammarArticle', () => {
  it('renders test container', () => {
    const { container } = render(<GrammarArticle wordWithArticle="ο άντρας" />);
    expect(container.querySelector('[data-testid="pf-grammar-article"]')).not.toBeNull();
  });

  it('renders article blank ??? for masculine article "ο"', () => {
    render(<GrammarArticle wordWithArticle="ο άντρας" />);
    expect(screen.getByTestId('pf-article-blank')).not.toBeNull();
    expect(screen.getByText('???')).not.toBeNull();
  });

  it('renders article blank for feminine article "η"', () => {
    render(<GrammarArticle wordWithArticle="η γυναίκα" />);
    expect(screen.getByTestId('pf-article-blank')).not.toBeNull();
  });

  it('renders article blank for neuter article "το"', () => {
    render(<GrammarArticle wordWithArticle="το παιδί" />);
    expect(screen.getByTestId('pf-article-blank')).not.toBeNull();
  });

  it('article blank has pf-grammar-blank class', () => {
    const { container } = render(<GrammarArticle wordWithArticle="ο άντρας" />);
    expect(container.querySelector('.pf-grammar-blank')).not.toBeNull();
  });

  it('renders the stem text (without article)', () => {
    render(<GrammarArticle wordWithArticle="ο άντρας" />);
    // The stem "άντρας" should appear
    const stem = screen.getByTestId('pf-grammar-article').querySelector('.pf-grammar-stem');
    expect(stem).not.toBeNull();
  });

  it('does NOT show blank when word has no recognisable article prefix', () => {
    render(<GrammarArticle wordWithArticle="άντρας" />);
    expect(screen.queryByTestId('pf-article-blank')).toBeNull();
  });

  it('shows prompt text when provided', () => {
    render(<GrammarArticle wordWithArticle="ο άντρας" prompt="What article?" />);
    expect(screen.getByText('What article?')).not.toBeNull();
  });
});

describe('GrammarPlural', () => {
  it('renders test container', () => {
    const { container } = render(<GrammarPlural stem="άντρας" />);
    expect(container.querySelector('[data-testid="pf-grammar-plural"]')).not.toBeNull();
  });

  it('renders stem with pf-grammar-stem class', () => {
    const { container } = render(<GrammarPlural stem="άντρας" />);
    expect(container.querySelector('.pf-grammar-stem')).not.toBeNull();
  });

  it('stem element has lang="el"', () => {
    const { container } = render(<GrammarPlural stem="άντρας" />);
    const stem = container.querySelector('.pf-grammar-stem');
    expect(stem?.getAttribute('lang')).toBe('el');
  });

  it('renders stem text', () => {
    render(<GrammarPlural stem="άντρας" />);
    expect(screen.getByText('άντρας')).not.toBeNull();
  });

  it('shows IPA when ipa is provided', () => {
    render(<GrammarPlural stem="άντρας" ipa="/ˈandras/" />);
    expect(screen.getByTestId('pf-ipa')).not.toBeNull();
  });

  it('does NOT show IPA when ipa is null', () => {
    render(<GrammarPlural stem="άντρας" ipa={null} />);
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
    render(<GrammarPlural stem="άντρας" audioState={audioState} />);
    expect(screen.getByTestId('pf-audio-chip')).not.toBeNull();
  });

  it('does NOT render AudioChip when audioState is null', () => {
    render(<GrammarPlural stem="άντρας" audioState={null} />);
    expect(screen.queryByTestId('pf-audio-chip')).toBeNull();
  });

  it('shows prompt text when provided', () => {
    render(<GrammarPlural stem="άντρας" prompt="What is the plural?" />);
    expect(screen.getByText('What is the plural?')).not.toBeNull();
  });
});
