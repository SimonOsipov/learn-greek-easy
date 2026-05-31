import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { KaraokeText } from '../KaraokeText';
import type { WordTimestamp } from '@/types/situation';

const makeTimestamps = (words: Array<[string, number, number]>): WordTimestamp[] =>
  words.map(([word, start_ms, end_ms]) => ({ word, start_ms, end_ms }));

describe('KaraokeText', () => {
  // ── empty timestamps / fallback ──────────────────────────────────────────
  it('renders fallbackText when wordTimestamps is empty', () => {
    render(
      <KaraokeText wordTimestamps={[]} currentTimeMs={500} fallbackText="No timestamps yet" />
    );
    expect(screen.getByText('No timestamps yet')).toBeInTheDocument();
  });

  it('does not render individual word spans when timestamps are empty', () => {
    const { container } = render(
      <KaraokeText wordTimestamps={[]} currentTimeMs={500} fallbackText="Fallback" />
    );
    expect(container.querySelectorAll('span')).toHaveLength(0);
  });

  // ── t=0 / currentTimeMs <= 0: all pending ────────────────────────────────
  it('renders all words as pending when currentTimeMs is 0', () => {
    const timestamps = makeTimestamps([
      ['Hello', 100, 400],
      ['world', 500, 800],
    ]);
    const { container } = render(
      <KaraokeText wordTimestamps={timestamps} currentTimeMs={0} fallbackText="" />
    );
    const spans = container.querySelectorAll('span');
    expect(spans).toHaveLength(2);
    spans.forEach((span) => {
      expect(span).toHaveClass('text-muted-foreground');
      expect(span).not.toHaveClass('text-foreground');
    });
  });

  it('renders all words as pending when currentTimeMs is negative', () => {
    const timestamps = makeTimestamps([['Word', 100, 400]]);
    const { container } = render(
      <KaraokeText wordTimestamps={timestamps} currentTimeMs={-1} fallbackText="" />
    );
    const span = container.querySelector('span')!;
    expect(span).toHaveClass('text-muted-foreground');
  });

  // ── word-state classification ─────────────────────────────────────────────

  // spoken: end_ms <= currentTimeMs
  it('classifies a word as spoken when its end_ms is before currentTimeMs', () => {
    const timestamps = makeTimestamps([['Done', 100, 400]]);
    const { container } = render(
      <KaraokeText wordTimestamps={timestamps} currentTimeMs={500} fallbackText="" />
    );
    const span = container.querySelector('span')!;
    expect(span).toHaveClass('text-foreground');
    expect(span).not.toHaveClass('text-muted-foreground');
    // spoken has no ring / highlight classes
    expect(span).not.toHaveClass('bg-primary/20');
  });

  it('classifies a word as spoken when its end_ms equals currentTimeMs (boundary)', () => {
    const timestamps = makeTimestamps([['Done', 100, 400]]);
    const { container } = render(
      <KaraokeText wordTimestamps={timestamps} currentTimeMs={400} fallbackText="" />
    );
    const span = container.querySelector('span')!;
    expect(span).toHaveClass('text-foreground');
    expect(span).not.toHaveClass('bg-primary/20');
  });

  // speaking: start_ms <= currentTimeMs && end_ms > currentTimeMs
  it('classifies a word as speaking when start_ms equals currentTimeMs (off-by-one boundary)', () => {
    const timestamps = makeTimestamps([['Active', 300, 700]]);
    const { container } = render(
      <KaraokeText wordTimestamps={timestamps} currentTimeMs={300} fallbackText="" />
    );
    const span = container.querySelector('span')!;
    expect(span).toHaveClass('bg-primary/20');
    expect(span).toHaveClass('font-medium');
    expect(span).toHaveClass('text-foreground');
  });

  it('classifies a word as speaking when currentTimeMs is between start_ms and end_ms', () => {
    const timestamps = makeTimestamps([['Active', 200, 600]]);
    const { container } = render(
      <KaraokeText wordTimestamps={timestamps} currentTimeMs={400} fallbackText="" />
    );
    const span = container.querySelector('span')!;
    expect(span).toHaveClass('bg-primary/20');
    expect(span).toHaveClass('font-medium');
  });

  // pending: start_ms > currentTimeMs
  it('classifies a word as pending when currentTimeMs is before its start_ms', () => {
    const timestamps = makeTimestamps([['Future', 800, 1200]]);
    const { container } = render(
      <KaraokeText wordTimestamps={timestamps} currentTimeMs={300} fallbackText="" />
    );
    const span = container.querySelector('span')!;
    expect(span).toHaveClass('text-muted-foreground');
    expect(span).not.toHaveClass('bg-primary/20');
    expect(span).not.toHaveClass('text-foreground');
  });

  // ── multi-word mixed states ───────────────────────────────────────────────
  it('correctly classifies spoken / speaking / pending across multiple words', () => {
    const timestamps = makeTimestamps([
      ['First', 0, 300], // spoken: end_ms(300) <= currentTimeMs(350)
      ['Second', 300, 700], // speaking: start_ms(300) <= 350 < end_ms(700)
      ['Third', 700, 1100], // pending: start_ms(700) > 350
    ]);
    const { container } = render(
      <KaraokeText wordTimestamps={timestamps} currentTimeMs={350} fallbackText="" />
    );
    const spans = container.querySelectorAll('span');
    expect(spans).toHaveLength(3);

    // spoken
    expect(spans[0]).toHaveClass('text-foreground');
    expect(spans[0]).not.toHaveClass('bg-primary/20');

    // speaking
    expect(spans[1]).toHaveClass('bg-primary/20');
    expect(spans[1]).toHaveClass('font-medium');

    // pending
    expect(spans[2]).toHaveClass('text-muted-foreground');
    expect(spans[2]).not.toHaveClass('bg-primary/20');
  });

  // ── space rendering ───────────────────────────────────────────────────────
  it('appends a space after each word except the last', () => {
    const timestamps = makeTimestamps([
      ['Hello', 0, 200],
      ['world', 200, 400],
    ]);
    const { container } = render(
      <KaraokeText wordTimestamps={timestamps} currentTimeMs={500} fallbackText="" />
    );
    const spans = container.querySelectorAll('span');
    expect(spans[0].textContent).toBe('Hello ');
    expect(spans[1].textContent).toBe('world');
  });

  // ── className passthrough ─────────────────────────────────────────────────
  it('applies a custom className to the paragraph container', () => {
    const { container } = render(
      <KaraokeText wordTimestamps={[]} currentTimeMs={0} fallbackText="X" className="custom-cls" />
    );
    expect(container.querySelector('p')).toHaveClass('custom-cls');
  });

  it('applies custom className even in the pending-all (t=0) branch', () => {
    const timestamps = makeTimestamps([['Word', 100, 400]]);
    const { container } = render(
      <KaraokeText
        wordTimestamps={timestamps}
        currentTimeMs={0}
        fallbackText=""
        className="special"
      />
    );
    expect(container.querySelector('p')).toHaveClass('special');
  });

  // ── single-word edge case ─────────────────────────────────────────────────
  it('handles a single-word list without trailing space', () => {
    const timestamps = makeTimestamps([['Solo', 0, 200]]);
    const { container } = render(
      <KaraokeText wordTimestamps={timestamps} currentTimeMs={300} fallbackText="" />
    );
    const span = container.querySelector('span')!;
    expect(span.textContent).toBe('Solo');
  });
});
