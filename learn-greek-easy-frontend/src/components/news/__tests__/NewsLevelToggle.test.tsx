import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { NewsLevelToggle } from '../NewsLevelToggle';

describe('NewsLevelToggle', () => {
  it('renders both A2 and B2 segments', () => {
    render(<NewsLevelToggle level="a2" onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'news.level.a2' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'news.level.b2' })).toBeInTheDocument();
  });

  it('marks A2 as active when level is a2', () => {
    render(<NewsLevelToggle level="a2" onChange={vi.fn()} />);
    const a2Tab = screen.getByRole('tab', { name: 'news.level.a2' });
    expect(a2Tab).toHaveAttribute('data-state', 'active');
  });

  it('marks B2 as active when level is b2', () => {
    render(<NewsLevelToggle level="b2" onChange={vi.fn()} />);
    const b2Tab = screen.getByRole('tab', { name: 'news.level.b2' });
    expect(b2Tab).toHaveAttribute('data-state', 'active');
  });

  it('calls onChange with b2 when B2 tab is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NewsLevelToggle level="a2" onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: 'news.level.b2' }));
    expect(onChange).toHaveBeenCalledWith('b2');
  });

  it('calls onChange with a2 when A2 tab is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NewsLevelToggle level="b2" onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: 'news.level.a2' }));
    expect(onChange).toHaveBeenCalledWith('a2');
  });

  it('has correct data-testid on root element', () => {
    render(<NewsLevelToggle level="a2" onChange={vi.fn()} />);
    expect(screen.getByTestId('news-level-toggle')).toBeInTheDocument();
  });

  it('has correct aria-label on tablist', () => {
    render(<NewsLevelToggle level="a2" onChange={vi.fn()} />);
    expect(screen.getByRole('tablist', { name: 'news.level.label' })).toBeInTheDocument();
  });
});
