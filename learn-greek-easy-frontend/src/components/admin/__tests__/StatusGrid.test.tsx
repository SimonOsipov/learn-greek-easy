import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { StatusGrid, type StatusOption } from '../StatusGrid';

type TestStatus = 'open' | 'closed';

const OPTIONS: StatusOption<TestStatus>[] = [
  { key: 'open', label: 'Open', dotTone: 'tone-warning' },
  { key: 'closed', label: 'Closed', dotTone: 'tone-success' },
];

describe('StatusGrid', () => {
  it('renders all options with their labels', () => {
    render(<StatusGrid options={OPTIONS} value="open" onChange={() => {}} />);
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('marks the active option via aria-checked and data-active', () => {
    render(<StatusGrid options={OPTIONS} value="closed" onChange={() => {}} />);
    const radios = screen.getAllByRole('radio');
    const activeRadio = radios.find((r) => r.getAttribute('aria-checked') === 'true');
    expect(activeRadio).toBeDefined();
    expect(activeRadio).toHaveTextContent('Closed');
    expect(activeRadio).toHaveAttribute('data-active');
  });

  it('invokes onChange with the clicked option key', async () => {
    const onChange = vi.fn();
    render(<StatusGrid options={OPTIONS} value="open" onChange={onChange} />);
    await userEvent.click(screen.getByText('Closed'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('closed');
  });

  it('uses the admin-status-grid class (not the legacy fb-status-grid)', () => {
    const { container } = render(<StatusGrid options={OPTIONS} value="open" onChange={() => {}} />);
    expect(container.querySelector('.admin-status-grid')).toBeTruthy();
    expect(container.querySelector('.fb-status-grid')).toBeNull();
  });
});
