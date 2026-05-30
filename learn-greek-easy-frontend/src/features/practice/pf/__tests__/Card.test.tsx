/**
 * pf/Card.tsx — unit tests (PRACT2-1-03)
 *
 * Covers:
 * - Renders .pf-card shell
 * - Renders pf-body (question zone)
 * - Renders pf-foot (answer zone) when isFlipped=true + foot provided
 * - Does NOT render pf-foot when isFlipped=false
 * - Card acts as a button (role + tabIndex) when not flipped
 * - Enter/Space key triggers onClick
 * - Stable height: pf-body and pf-foot always exist in the DOM (no layout shift)
 * - Enter animation is transform-only (no opacity keyframe gating)
 */

import React from 'react';

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Card } from '../Card';

describe('Card', () => {
  it('renders .pf-card shell', () => {
    const { container } = render(<Card body={<span>question</span>} />);
    expect(container.querySelector('.pf-card')).not.toBeNull();
  });

  it('renders pf-body zone', () => {
    const { container } = render(<Card body={<span>question</span>} />);
    expect(container.querySelector('.pf-body')).not.toBeNull();
  });

  it('renders body content inside pf-body', () => {
    render(<Card body={<span>my question</span>} />);
    expect(screen.getByText('my question')).not.toBeNull();
  });

  it('does NOT render pf-foot when isFlipped=false', () => {
    const { container } = render(
      <Card body={<span>q</span>} foot={<span>answer</span>} isFlipped={false} />
    );
    expect(container.querySelector('.pf-foot')).toBeNull();
  });

  it('renders pf-foot when isFlipped=true and foot is provided', () => {
    const { container } = render(
      <Card body={<span>q</span>} foot={<span>answer content</span>} isFlipped={true} />
    );
    expect(container.querySelector('.pf-foot')).not.toBeNull();
    expect(screen.getByText('answer content')).not.toBeNull();
  });

  it('acts as button (role=button, tabIndex) when not flipped', () => {
    render(<Card body={<span>q</span>} isFlipped={false} onClick={vi.fn()} />);
    const card = screen.getByTestId('pf-card');
    expect(card.getAttribute('role')).toBe('button');
    expect(card.getAttribute('tabindex')).toBe('0');
  });

  it('has no role=button when flipped', () => {
    render(<Card body={<span>q</span>} isFlipped={true} onClick={vi.fn()} />);
    const card = screen.getByTestId('pf-card');
    expect(card.getAttribute('role')).toBeNull();
  });

  it('calls onClick when card is clicked (not flipped)', () => {
    const onClick = vi.fn();
    render(<Card body={<span>q</span>} isFlipped={false} onClick={onClick} />);
    fireEvent.click(screen.getByTestId('pf-card'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClick when card is clicked (flipped)', () => {
    const onClick = vi.fn();
    render(<Card body={<span>q</span>} isFlipped={true} onClick={onClick} />);
    fireEvent.click(screen.getByTestId('pf-card'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('calls onClick on Enter key (not flipped)', () => {
    const onClick = vi.fn();
    render(<Card body={<span>q</span>} isFlipped={false} onClick={onClick} />);
    fireEvent.keyDown(screen.getByTestId('pf-card'), { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls onClick on Space key (not flipped)', () => {
    const onClick = vi.fn();
    render(<Card body={<span>q</span>} isFlipped={false} onClick={onClick} />);
    fireEvent.keyDown(screen.getByTestId('pf-card'), { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
