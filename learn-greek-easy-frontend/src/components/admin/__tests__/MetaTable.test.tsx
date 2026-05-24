import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MetaTable } from '../MetaTable';

describe('MetaTable', () => {
  it('renders every row label and value', () => {
    render(
      <MetaTable
        rows={[
          { label: 'Reporter', value: 'simon@x' },
          { label: 'Type', value: 'bug' },
        ]}
      />
    );
    expect(screen.getByText('Reporter')).toBeInTheDocument();
    expect(screen.getByText('simon@x')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('bug')).toBeInTheDocument();
  });

  it('accepts ReactNode values (badges, links)', () => {
    render(
      <MetaTable rows={[{ label: 'Status', value: <span data-testid="badge">open</span> }]} />
    );
    expect(screen.getByTestId('badge')).toHaveTextContent('open');
  });

  it('applies optional ariaLabel to the container', () => {
    render(<MetaTable rows={[{ label: 'X', value: 'y' }]} ariaLabel="Card errors metadata" />);
    expect(screen.getByLabelText('Card errors metadata')).toBeInTheDocument();
  });
});
