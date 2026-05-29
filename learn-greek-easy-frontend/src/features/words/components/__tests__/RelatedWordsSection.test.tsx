/**
 * RelatedWordsSection Component Tests
 *
 * DX-10 (R7): inert chip row — clicking does NOT navigate + exactly one danger
 * UnwiredDot.
 */

import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock react-router-dom so tests don't need a Router
vi.mock('react-router-dom', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    useNavigate: () => vi.fn(),
    Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

// Mock UnwiredDot
vi.mock('@/features/decks/dx', () => ({
  UnwiredDot: ({ tone, 'aria-label': ariaLabel }: { tone?: string; 'aria-label'?: string }) => (
    <span data-testid="unwired-dot" data-tone={tone} aria-label={ariaLabel} />
  ),
}));

import { RelatedWordsSection } from '../RelatedWordsSection';

describe('RelatedWordsSection', () => {
  it('renders .dx-section container', () => {
    render(<RelatedWordsSection lemma="σπίτι" />);
    expect(screen.getByTestId('related-words-section')).toHaveClass('dx-section');
  });

  it('renders exactly one danger UnwiredDot (R7)', () => {
    render(<RelatedWordsSection lemma="σπίτι" />);
    const dots = screen.getAllByTestId('unwired-dot');
    expect(dots).toHaveLength(1);
    expect(dots[0]).toHaveAttribute('data-tone', 'danger');
  });

  it('danger dot has a meaningful aria-label', () => {
    render(<RelatedWordsSection lemma="σπίτι" />);
    const dot = screen.getByTestId('unwired-dot');
    const label = dot.getAttribute('aria-label') ?? '';
    expect(label.length).toBeGreaterThan(0);
    expect(label).not.toBe('Placeholder — not yet connected to backend data.');
  });

  it('renders the chip row', () => {
    render(<RelatedWordsSection lemma="σπίτι" />);
    expect(screen.getByTestId('related-words-chips')).toBeInTheDocument();
  });

  it('renders chip elements', () => {
    render(<RelatedWordsSection lemma="σπίτι" />);
    const chips = screen.getAllByTestId('related-word-chip');
    expect(chips.length).toBeGreaterThan(0);
  });

  it('chips are inert — clicking does NOT navigate', async () => {
    const user = userEvent.setup();
    render(<RelatedWordsSection lemma="σπίτι" />);
    const chips = screen.getAllByTestId('related-word-chip');
    // Chips are <span> elements with no onClick/href — userEvent click should not throw
    await user.click(chips[0]);
    // No navigation should have occurred (chips are <span>, not <a> or <button>)
    expect(chips[0].tagName).toBe('SPAN');
    expect(chips[0]).not.toHaveAttribute('href');
  });

  it('Greek chip text carries lang="el"', () => {
    render(<RelatedWordsSection lemma="σπίτι" />);
    const greekEls = screen
      .getAllByRole('generic')
      .filter((el) => el.getAttribute('lang') === 'el');
    expect(greekEls.length).toBeGreaterThan(0);
  });
});
