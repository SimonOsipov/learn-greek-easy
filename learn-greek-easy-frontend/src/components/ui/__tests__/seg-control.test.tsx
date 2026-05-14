import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import { SegControl, type SegOption } from '@/components/ui/seg-control';
import { render, screen } from '@/lib/test-utils';

// Compile-only: verifies SegControl<'a' | 'b'> infers onChange as (v: 'a' | 'b') => void
const _typedOptions: SegOption<'a' | 'b'>[] = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
];
const _typedOnChange: (v: 'a' | 'b') => void = (_v) => {};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _typeProbe = (
  <SegControl<'a' | 'b'> options={_typedOptions} value="a" onChange={_typedOnChange} />
);

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
];

describe('SegControl', () => {
  it('renders one button per option', () => {
    render(<SegControl options={OPTIONS} value="a" onChange={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('active option has is-active class and aria-pressed="true"; others have aria-pressed="false"', () => {
    render(<SegControl options={OPTIONS} value="b" onChange={() => {}} />);

    const alpha = screen.getByRole('button', { name: /alpha/i });
    const beta = screen.getByRole('button', { name: /beta/i });
    const gamma = screen.getByRole('button', { name: /gamma/i });

    expect(beta).toHaveClass('is-active');
    expect(beta).toHaveAttribute('aria-pressed', 'true');

    expect(alpha).not.toHaveClass('is-active');
    expect(alpha).toHaveAttribute('aria-pressed', 'false');

    expect(gamma).not.toHaveClass('is-active');
    expect(gamma).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking an option fires onChange with that option value', async () => {
    const onChange = vi.fn();
    render(<SegControl options={OPTIONS} value="a" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /gamma/i }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('renders count badge when count is provided; omits it when not', () => {
    const opts = [
      { value: 'x', label: 'X', count: 7 },
      { value: 'y', label: 'Y' },
    ];
    const { container } = render(<SegControl options={opts} value="x" onChange={() => {}} />);

    const xBtn = screen.getByRole('button', { name: /x/i });
    const badge = xBtn.querySelector('.cl-tag-n');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe('7');

    const yBtn = screen.getByRole('button', { name: /y/i });
    expect(yBtn.querySelector('.cl-tag-n')).toBeNull();

    // Suppress unused warning for container usage
    void container;
  });

  it('all buttons have type="button"', () => {
    render(<SegControl options={OPTIONS} value="a" onChange={() => {}} />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn).toHaveAttribute('type', 'button');
    });
  });

  it('renders label span before buttons when label is provided; omits it when not', () => {
    const { container, rerender } = render(
      <SegControl options={OPTIONS} value="a" onChange={() => {}} label="Country" />
    );

    const labelSpan = container.querySelector('.news-seg-l');
    expect(labelSpan).not.toBeNull();
    expect(labelSpan?.textContent).toBe('Country');

    // Verify DOM order: label precedes buttons container
    const root = container.querySelector('.news-seg') as HTMLElement;
    const children = Array.from(root.children);
    expect(children[0]).toHaveClass('news-seg-l');
    expect(children[1]).toHaveClass('news-seg-btns');

    // Without label: no span
    rerender(<SegControl options={OPTIONS} value="a" onChange={() => {}} />);
    expect(container.querySelector('.news-seg-l')).toBeNull();
  });
});
