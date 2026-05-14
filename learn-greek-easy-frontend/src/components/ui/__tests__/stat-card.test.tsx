/**
 * StatCard Component Tests
 * Covers: render structure, bars formula, click affordance,
 * keyboard handlers, tone classes, aria-hidden, and className merging.
 */

import { describe, it, expect, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';

import { StatCard, type StatCardTone } from '@/components/ui/stat-card';
import { render } from '@/lib/test-utils';

const defaultProps = {
  title: 'Decks',
  sub: 'Active',
  n: 42,
  icon: <svg data-testid="icon" />,
  tone: 'blue' as StatCardTone,
};

describe('StatCard', () => {
  it('renders head, number, and footer', () => {
    const { container } = render(<StatCard {...defaultProps} />);

    expect(container.querySelector('.stat-label')?.textContent).toBe('Decks');
    expect(container.querySelector('.stat-sub')?.textContent).toBe('Active');
    expect(container.querySelector('.stat-n')?.textContent).toBe('42');
    expect(container.querySelector('.stat-foot span')?.textContent).toBe('Last 30 days');
  });

  it('renders bars with correct heights', () => {
    const { container } = render(<StatCard {...defaultProps} bars={[5, 3, 8]} />);

    const spans = container.querySelectorAll('.stat-bars span');
    expect(spans).toHaveLength(3);
    expect((spans[0] as HTMLElement).style.height).toBe('14px');
    expect((spans[1] as HTMLElement).style.height).toBe('10.8px');
    expect((spans[2] as HTMLElement).style.height).toBe('18.8px');
  });

  it('hides bars row when bars is empty', () => {
    const { container } = render(<StatCard {...defaultProps} bars={[]} />);
    expect(container.querySelector('.stat-bars')).toBeNull();
  });

  it('hides bars row when bars is undefined', () => {
    const { container } = render(<StatCard {...defaultProps} />);
    expect(container.querySelector('.stat-bars')).toBeNull();
  });

  it('uses default footerLabel when omitted', () => {
    const { container } = render(<StatCard {...defaultProps} />);
    expect(container.querySelector('.stat-foot span')?.textContent).toBe('Last 30 days');
  });

  it('respects custom footerLabel', () => {
    const { container } = render(<StatCard {...defaultProps} footerLabel="This week" />);
    expect(container.querySelector('.stat-foot span')?.textContent).toBe('This week');
  });

  it('does not render Open link when onClick is absent', () => {
    const { container } = render(<StatCard {...defaultProps} />);
    expect(container.querySelector('.stat-link')).toBeNull();
  });

  it('renders Open link with ArrowRight when onClick is set', () => {
    const { container } = render(<StatCard {...defaultProps} onClick={vi.fn()} />);
    const link = container.querySelector('.stat-link');
    expect(link).not.toBeNull();
    expect(link?.textContent).toContain('Open');
    expect(link?.querySelector('svg')).not.toBeNull();
  });

  it('is non-interactive when onClick is absent', () => {
    const { container } = render(<StatCard {...defaultProps} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('role')).toBeNull();
    expect(root.getAttribute('tabindex')).toBeNull();
    expect(root.className).not.toContain('is-clickable');
  });

  it('is interactive when onClick is set', () => {
    const { container } = render(<StatCard {...defaultProps} onClick={vi.fn()} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('role')).toBe('button');
    expect(root.getAttribute('tabindex')).toBe('0');
    expect(root.className).toContain('is-clickable');
  });

  it('invokes onClick on mouse click', () => {
    const handleClick = vi.fn();
    const { container } = render(<StatCard {...defaultProps} onClick={handleClick} />);
    fireEvent.click(container.firstElementChild!);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('invokes onClick on Enter keydown', () => {
    const handleClick = vi.fn();
    const { container } = render(<StatCard {...defaultProps} onClick={handleClick} />);
    fireEvent.keyDown(container.firstElementChild!, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('invokes onClick on Space keydown', () => {
    const handleClick = vi.fn();
    const { container } = render(<StatCard {...defaultProps} onClick={handleClick} />);
    fireEvent.keyDown(container.firstElementChild!, { key: ' ' });
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not invoke onClick on other keys', () => {
    const handleClick = vi.fn();
    const { container } = render(<StatCard {...defaultProps} onClick={handleClick} />);
    fireEvent.keyDown(container.firstElementChild!, { key: 'a' });
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies tone class for each tone', () => {
    const tones: StatCardTone[] = ['blue', 'violet', 'amber', 'cyan', 'green'];
    tones.forEach((tone) => {
      const { container } = render(<StatCard {...defaultProps} tone={tone} />);
      const root = container.firstElementChild as HTMLElement;
      expect(root.className).toContain(`tone-${tone}`);
    });
  });

  it('decorative icon gets aria-hidden', () => {
    const { container } = render(<StatCard {...defaultProps} />);
    const iconWrapper = container.querySelector('.stat-icon');
    expect(iconWrapper?.getAttribute('aria-hidden')).toBe('true');
  });

  it('merges className prop', () => {
    const { container } = render(<StatCard {...defaultProps} className="custom" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('stat-card');
    expect(root.className).toContain('custom');
  });
});
