import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import CannedReplyPills, { type Pill } from '../CannedReplyPills';

const pills: Pill[] = [
  { key: 'thanks', label: 'Thanks', body: 'Thanks for reporting this.' },
  { key: 'fixed', label: 'Fixed', body: 'This is now fixed in production.' },
];

describe('CannedReplyPills', () => {
  it('calls onSelect with the pill body and key when clicked', async () => {
    const onSelect = vi.fn();
    render(<CannedReplyPills pills={pills} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: 'Thanks' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('Thanks for reporting this.', 'thanks');
  });

  it('emits each body and key independently on successive clicks (stateless, no concatenation)', async () => {
    const onSelect = vi.fn();
    render(<CannedReplyPills pills={pills} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: 'Thanks' }));
    await userEvent.click(screen.getByRole('button', { name: 'Fixed' }));
    expect(onSelect).toHaveBeenNthCalledWith(1, 'Thanks for reporting this.', 'thanks');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'This is now fixed in production.', 'fixed');
  });

  it('renders the default label "Quick responses" when none supplied', () => {
    render(<CannedReplyPills pills={pills} onSelect={() => {}} />);
    expect(screen.getByText('Quick responses')).toBeInTheDocument();
  });
});
