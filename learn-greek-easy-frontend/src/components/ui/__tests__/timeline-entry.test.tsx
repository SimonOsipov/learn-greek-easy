import React from 'react';

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { TimelineEntry } from '../timeline-entry';

describe('TimelineEntry', () => {
  const baseProps = {
    tone: 'blue' as const,
    header: <span>Tag · v0.4.1</span>,
    title: 'Picture matching improved',
    body: 'Plain text body',
  };

  it('renders header, title, and body', () => {
    render(<TimelineEntry {...baseProps} />);
    expect(screen.getByText(/Tag · v0\.4\.1/)).toBeInTheDocument();
    expect(screen.getByText(/Picture matching improved/)).toBeInTheDocument();
    expect(screen.getByText(/Plain text body/)).toBeInTheDocument();
  });

  it('applies dot tone class', () => {
    const { container } = render(<TimelineEntry {...baseProps} tone="violet" />);
    expect(container.querySelector('.cl-entry-dot')).toHaveClass('tone-violet');
  });

  it('renders **bold** as <b>', () => {
    const { container } = render(<TimelineEntry {...baseProps} body="hello **world** here" />);
    const bold = container.querySelector('.cl-entry-content b');
    expect(bold).not.toBeNull();
    expect(bold?.textContent).toBe('world');
  });

  it('renders *italic* as <i>', () => {
    const { container } = render(<TimelineEntry {...baseProps} body="hello *world* here" />);
    const italic = container.querySelector('.cl-entry-content i');
    expect(italic).not.toBeNull();
    expect(italic?.textContent).toBe('world');
  });

  it('renders optional subtitle', () => {
    render(<TimelineEntry {...baseProps} subtitle="Russian translation" />);
    expect(screen.getByText('Russian translation')).toBeInTheDocument();
  });

  it('hides actions area when actions prop is absent', () => {
    const { container } = render(<TimelineEntry {...baseProps} />);
    expect(container.querySelector('.cl-entry-actions')).toBeNull();
  });
});
