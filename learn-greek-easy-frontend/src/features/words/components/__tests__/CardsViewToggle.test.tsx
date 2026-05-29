import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { CardsViewToggle } from '../CardsViewToggle';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: Record<string, unknown>) => {
      if (opts?.defaultValue) return opts.defaultValue as string;
      return _key;
    },
  }),
}));

describe('CardsViewToggle', () => {
  it('renders with grid button active by default', () => {
    render(<CardsViewToggle value="grid" onChange={vi.fn()} />);
    const gridBtn = screen.getByTestId('cards-view-grid-btn');
    const listBtn = screen.getByTestId('cards-view-list-btn');
    expect(gridBtn).toHaveAttribute('aria-pressed', 'true');
    expect(listBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders with list button active when value="list"', () => {
    render(<CardsViewToggle value="list" onChange={vi.fn()} />);
    const gridBtn = screen.getByTestId('cards-view-grid-btn');
    const listBtn = screen.getByTestId('cards-view-list-btn');
    expect(gridBtn).toHaveAttribute('aria-pressed', 'false');
    expect(listBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('active grid option has is-active class', () => {
    render(<CardsViewToggle value="grid" onChange={vi.fn()} />);
    const gridBtn = screen.getByTestId('cards-view-grid-btn');
    expect(gridBtn).toHaveClass('is-active');
  });

  it('active list option has is-active class', () => {
    render(<CardsViewToggle value="list" onChange={vi.fn()} />);
    const listBtn = screen.getByTestId('cards-view-list-btn');
    expect(listBtn).toHaveClass('is-active');
  });

  it('calls onChange with "list" when list button clicked', async () => {
    const onChange = vi.fn();
    render(<CardsViewToggle value="grid" onChange={onChange} />);
    await userEvent.click(screen.getByTestId('cards-view-list-btn'));
    expect(onChange).toHaveBeenCalledWith('list');
  });

  it('calls onChange with "grid" when grid button clicked', async () => {
    const onChange = vi.fn();
    render(<CardsViewToggle value="list" onChange={onChange} />);
    await userEvent.click(screen.getByTestId('cards-view-grid-btn'));
    expect(onChange).toHaveBeenCalledWith('grid');
  });

  it('renders the toggle container with correct testid', () => {
    render(<CardsViewToggle value="grid" onChange={vi.fn()} />);
    expect(screen.getByTestId('cards-view-toggle')).toBeInTheDocument();
  });
});
