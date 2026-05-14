import React from 'react';

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { PageHead } from '../PageHead';

describe('PageHead', () => {
  it('renders title and sub when provided', () => {
    render(<PageHead title="Decks" sub="Manage decks" />);
    expect(screen.getByText('Decks')).toBeInTheDocument();
    expect(screen.getByText('Manage decks')).toBeInTheDocument();
  });

  it('does not render sub when omitted', () => {
    const { container } = render(<PageHead title="x" />);
    expect(container.querySelector('.va-sub')).toBeNull();
  });

  it('does not render breadcrumb when not provided', () => {
    const { container } = render(<PageHead title="x" />);
    expect(container.querySelector('.va-bcrumb')).toBeNull();
  });

  it('does not render breadcrumb when array is empty', () => {
    const { container } = render(<PageHead title="x" breadcrumb={[]} />);
    expect(container.querySelector('.va-bcrumb')).toBeNull();
  });

  it('renders breadcrumb and marks last segment with aria-current=page', () => {
    render(
      <PageHead
        title="x"
        breadcrumb={[
          { label: 'Admin', onClick: () => {} },
          { label: 'Decks', onClick: () => {} },
          { label: 'Word' },
        ]}
      />
    );
    // Last segment is "Word", non-clickable, has aria-current="page"
    const last = screen.getByText('Word');
    expect(last.tagName).toBe('SPAN');
    expect(last).toHaveAttribute('aria-current', 'page');
  });

  it('earlier breadcrumb segments are clickable and fire their onClick', () => {
    const onClick = vi.fn();
    render(<PageHead title="x" breadcrumb={[{ label: 'Admin', onClick }, { label: 'Decks' }]} />);
    fireEvent.click(screen.getByText('Admin'));
    expect(onClick).toHaveBeenCalled();
  });

  it('does not render actions area when omitted', () => {
    const { container } = render(<PageHead title="x" />);
    expect(container.querySelector('.va-page-actions')).toBeNull();
  });

  it('renders actions when provided', () => {
    render(<PageHead title="x" actions={<button>Save</button>} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('renders kicker when provided', () => {
    render(<PageHead title="x" kicker={<span data-testid="kicker">eyebrow</span>} />);
    expect(screen.getByTestId('kicker')).toBeInTheDocument();
  });
});
