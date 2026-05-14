import React from 'react';

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { SegControl } from '../seg-control';

describe('SegControl', () => {
  const opts = [
    { value: 'all', label: 'All' },
    { value: 'open', label: 'Open', count: 3 },
    { value: 'done', label: 'Done' },
  ] as const;

  it('renders label and all options', () => {
    render(<SegControl label="Status" options={[...opts]} value="all" onChange={() => {}} />);
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('marks the active option with .is-active and aria-selected=true', () => {
    render(<SegControl options={[...opts]} value="open" onChange={() => {}} />);
    const openBtn = screen.getByRole('tab', { name: /open/i });
    expect(openBtn).toHaveClass('is-active');
    expect(openBtn).toHaveAttribute('aria-selected', 'true');
  });

  it('fires onChange with the value when an option is clicked', () => {
    const onChange = vi.fn();
    render(<SegControl options={[...opts]} value="all" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: /done/i }));
    expect(onChange).toHaveBeenCalledWith('done');
  });

  it('renders count when provided', () => {
    render(<SegControl options={[...opts]} value="all" onChange={() => {}} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
