import { describe, it, expect } from 'vitest';

import { Kicker } from '@/components/ui/kicker';
import { render, screen } from '@/lib/test-utils';

describe('Kicker Component', () => {
  it('renders with default dot data-tone="primary"', () => {
    const { container } = render(<Kicker>Updates</Kicker>);

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('kicker-atom');
    expect(screen.getByText('Updates')).toBeInTheDocument();

    const dot = root.querySelector('.kicker-dot');
    expect(dot).not.toBeNull();
    expect(dot).toHaveAttribute('data-tone', 'primary');
  });

  it('renders dot="amber" with data-tone="amber"', () => {
    const { container } = render(<Kicker dot="amber">Recent</Kicker>);

    const root = container.firstChild as HTMLElement;
    const dot = root.querySelector('.kicker-dot');
    expect(dot).toHaveAttribute('data-tone', 'amber');
  });

  it('merges className with kicker-atom', () => {
    const { container } = render(<Kicker className="custom-cls">x</Kicker>);

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('kicker-atom');
    expect(root).toHaveClass('custom-cls');
  });
});
