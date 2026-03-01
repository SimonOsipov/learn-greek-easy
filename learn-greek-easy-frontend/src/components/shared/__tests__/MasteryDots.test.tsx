import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { MasteryDots } from '../MasteryDots';

describe('MasteryDots', () => {
  it('renders 4 dots by default', () => {
    render(<MasteryDots filled={0} />);

    const container = screen.getByTestId('mastery-dots');
    expect(container.children).toHaveLength(4);
  });

  it('renders correct number of dots when custom count given', () => {
    render(<MasteryDots count={6} filled={0} />);

    const container = screen.getByTestId('mastery-dots');
    expect(container.children).toHaveLength(6);
  });

  it('fills 0 dots when filled=0', () => {
    render(<MasteryDots filled={0} />);

    const container = screen.getByTestId('mastery-dots');
    const dots = Array.from(container.children);
    expect(dots.every((d) => d.classList.contains('bg-muted-foreground/30'))).toBe(true);
  });

  it('fills 1 dot when filled=1', () => {
    render(<MasteryDots filled={1} />);

    const container = screen.getByTestId('mastery-dots');
    const dots = Array.from(container.children);
    expect(dots[0]).toHaveClass('bg-primary');
    expect(dots[1]).toHaveClass('bg-muted-foreground/30');
  });

  it('fills 2 dots when filled=2', () => {
    render(<MasteryDots filled={2} />);

    const container = screen.getByTestId('mastery-dots');
    const dots = Array.from(container.children);
    expect(dots[0]).toHaveClass('bg-primary');
    expect(dots[1]).toHaveClass('bg-primary');
    expect(dots[2]).toHaveClass('bg-muted-foreground/30');
  });

  it('fills 3 dots when filled=3', () => {
    render(<MasteryDots filled={3} />);

    const container = screen.getByTestId('mastery-dots');
    const dots = Array.from(container.children);
    expect(dots[0]).toHaveClass('bg-primary');
    expect(dots[1]).toHaveClass('bg-primary');
    expect(dots[2]).toHaveClass('bg-primary');
    expect(dots[3]).toHaveClass('bg-muted-foreground/30');
  });

  it('fills all 4 dots when filled=4', () => {
    render(<MasteryDots filled={4} />);

    const container = screen.getByTestId('mastery-dots');
    const dots = Array.from(container.children);
    expect(dots.every((d) => d.classList.contains('bg-primary'))).toBe(true);
  });

  it('has correct aria-label showing progress', () => {
    render(<MasteryDots filled={2} />);

    const container = screen.getByTestId('mastery-dots');
    expect(container).toHaveAttribute('aria-label', 'Progress: 2 of 4');
  });

  it('aria-label reflects custom count', () => {
    render(<MasteryDots count={5} filled={3} />);

    const container = screen.getByTestId('mastery-dots');
    expect(container).toHaveAttribute('aria-label', 'Progress: 3 of 5');
  });

  it('applies custom className to container', () => {
    render(<MasteryDots filled={0} className="my-custom-class" />);

    const container = screen.getByTestId('mastery-dots');
    expect(container).toHaveClass('my-custom-class');
  });

  it('has data-testid mastery-dots', () => {
    render(<MasteryDots filled={0} />);

    expect(screen.getByTestId('mastery-dots')).toBeInTheDocument();
  });
});
