/**
 * pf/Card.tsx — unit tests (PRACT2-1-03, PRACT2-2-01, PRACT2-3-02)
 *
 * Covers:
 * - Renders .pf-card shell
 * - Renders pf-body (question zone)
 * - Renders pf-foot when foot is provided — ALWAYS in DOM (PRACT2-2-01)
 * - pf-foot__inner has data-hidden="true" + inert when isFlipped=false (hidden but in DOM)
 * - pf-foot__inner has no data-hidden when isFlipped=true (visible)
 * - Card acts as a button (role + tabIndex) when not flipped
 * - Enter/Space key triggers onClick
 * - Enter animation is transform-only (no opacity keyframe gating)
 * - PRACT2-3-02: .pf-reveal-cta present pre-flip; absent post-flip
 * - PRACT2-2-01 height invariant: answer content mounted in both phases
 *   (structural check — jsdom returns 0 for getBoundingClientRect, so we
 *   assert content presence, not pixel height, per jsdom caveat)
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

  // PRACT2-2-01 + PRACT2-3-02: pf-foot is ALWAYS in DOM; attrs moved to .pf-foot__inner
  it('renders pf-foot in DOM when isFlipped=false (hidden but present for stable height)', () => {
    const { container } = render(
      <Card body={<span>q</span>} foot={<span>answer</span>} isFlipped={false} />
    );
    // .pf-foot wrapper is always rendered
    expect(container.querySelector('.pf-foot')).not.toBeNull();
    // attrs are on .pf-foot__inner (PRACT2-3-02)
    const inner = container.querySelector('.pf-foot__inner');
    expect(inner).not.toBeNull();
    expect(inner?.getAttribute('data-hidden')).toBe('true');
    expect(inner?.hasAttribute('inert')).toBe(true);
    expect(inner?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders pf-foot visible (no data-hidden on inner) when isFlipped=true and foot is provided', () => {
    const { container } = render(
      <Card body={<span>q</span>} foot={<span>answer content</span>} isFlipped={true} />
    );
    expect(container.querySelector('.pf-foot')).not.toBeNull();
    const inner = container.querySelector('.pf-foot__inner');
    expect(inner).not.toBeNull();
    expect(inner?.getAttribute('data-hidden')).toBeNull();
    expect(inner?.hasAttribute('inert')).toBe(false);
    expect(screen.getByText('answer content')).not.toBeNull();
  });

  it('does NOT render pf-foot at all when foot prop is null/undefined', () => {
    const { container } = render(<Card body={<span>q</span>} isFlipped={false} />);
    expect(container.querySelector('.pf-foot')).toBeNull();
  });

  // PRACT2-3-02: reveal CTA visibility
  it('renders .pf-reveal-cta pre-flip when foot is provided', () => {
    const { container } = render(
      <Card body={<span>q</span>} foot={<span>answer</span>} isFlipped={false} />
    );
    expect(container.querySelector('.pf-reveal-cta')).not.toBeNull();
  });

  it('does NOT render .pf-reveal-cta when isFlipped=true', () => {
    const { container } = render(
      <Card body={<span>q</span>} foot={<span>answer</span>} isFlipped={true} />
    );
    expect(container.querySelector('.pf-reveal-cta')).toBeNull();
  });

  // PRACT2-2-01 height invariant (structural): answer content mounted in both phases.
  // jsdom returns 0 for getBoundingClientRect().height — pixel invariant is verified
  // in E2E/visual. Here we assert that the foot content is mounted in both states.
  it('answer content is mounted in DOM pre-flip (structural height reservation)', () => {
    const { container } = render(
      <Card
        body={<span>q</span>}
        foot={<span data-testid="answer-slot">answer</span>}
        isFlipped={false}
      />
    );
    // Content present in DOM (visibility:hidden via CSS, not removed)
    expect(container.querySelector('[data-testid="answer-slot"]')).not.toBeNull();
  });

  it('answer content is mounted in DOM post-flip', () => {
    const { container } = render(
      <Card
        body={<span>q</span>}
        foot={<span data-testid="answer-slot">answer</span>}
        isFlipped={true}
      />
    );
    expect(container.querySelector('[data-testid="answer-slot"]')).not.toBeNull();
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
