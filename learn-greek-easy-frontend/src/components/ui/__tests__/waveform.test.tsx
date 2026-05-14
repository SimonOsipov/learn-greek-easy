import { describe, it, expect } from 'vitest';

import { Waveform } from '@/components/ui/waveform';
import { render } from '@/lib/test-utils';

describe('Waveform — 24-bar layout', () => {
  it('renders exactly 24 .audio-wave spans inside .audio-track', () => {
    const { container } = render(<Waveform bars={24} />);
    const spans = container.querySelectorAll('.audio-track > .audio-wave');
    expect(spans.length).toBe(24);
  });

  it('span heights match formula 4 + (k * 5) % 12 at k=0, k=7, k=23', () => {
    const { container } = render(<Waveform bars={24} />);
    const spans = container.querySelectorAll<HTMLElement>('.audio-track > .audio-wave');

    // k=0: 4 + (0*5)%12 = 4 + 0 = 4px
    expect(spans[0].style.height).toBe('4px');
    // k=7: 4 + (7*5)%12 = 4 + 35%12 = 4 + 11 = 15px
    expect(spans[7].style.height).toBe('15px');
    // k=23: 4 + (23*5)%12 = 4 + 115%12 = 4 + 7 = 11px
    expect(spans[23].style.height).toBe('11px');
  });
});

describe('Waveform — 60-bar layout', () => {
  it('renders exactly 60 .audio-wave spans inside .audio-track', () => {
    const { container } = render(<Waveform bars={60} />);
    const spans = container.querySelectorAll('.audio-track > .audio-wave');
    expect(spans.length).toBe(60);
  });

  it('span heights match formula 6 + (k * 7) % 18 at k=0, k=13, k=59', () => {
    const { container } = render(<Waveform bars={60} />);
    const spans = container.querySelectorAll<HTMLElement>('.audio-track > .audio-wave');

    // k=0: 6 + (0*7)%18 = 6 + 0 = 6px
    expect(spans[0].style.height).toBe('6px');
    // k=13: 6 + (13*7)%18 = 6 + 91%18 = 6 + 1 = 7px
    expect(spans[13].style.height).toBe('7px');
    // k=59: 6 + (59*7)%18 = 6 + 413%18 = 6 + 17 = 23px
    expect(spans[59].style.height).toBe('23px');
  });
});

describe('Waveform — progress overlay', () => {
  it('progressPct=42 renders .audio-progress with width 42%', () => {
    const { container } = render(<Waveform bars={24} progressPct={42} />);
    const progress = container.querySelector<HTMLElement>('.audio-progress');
    expect(progress).not.toBeNull();
    expect(progress!.style.width).toBe('42%');
  });

  it('progressPct omitted does not render .audio-progress', () => {
    const { container } = render(<Waveform bars={24} />);
    expect(container.querySelector('.audio-progress')).toBeNull();
  });

  it('progressPct=-10 clamps to 0%', () => {
    const { container } = render(<Waveform bars={24} progressPct={-10} />);
    const progress = container.querySelector<HTMLElement>('.audio-progress');
    expect(progress!.style.width).toBe('0%');
  });

  it('progressPct=150 clamps to 100%', () => {
    const { container } = render(<Waveform bars={24} progressPct={150} />);
    const progress = container.querySelector<HTMLElement>('.audio-progress');
    expect(progress!.style.width).toBe('100%');
  });
});

describe('Waveform — accessibility', () => {
  it('root .audio-track has aria-hidden="true"', () => {
    const { container } = render(<Waveform bars={24} />);
    const root = container.querySelector('.audio-track');
    expect(root?.getAttribute('aria-hidden')).toBe('true');
  });
});
