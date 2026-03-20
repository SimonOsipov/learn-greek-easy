import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders, screen } from '@/lib/test-utils';

import { SessionSummary } from '../SessionSummary';

describe('SessionSummary', () => {
  const defaultStats = [
    { label: 'Correct', value: '8' },
    { label: 'Wrong', value: '2' },
    { label: 'Score', value: '80%' },
  ];

  const defaultProps = {
    title: 'Session Complete',
    stats: defaultStats,
    actions: <button>Continue</button>,
  };

  describe('Rendering', () => {
    it('renders title text', () => {
      renderWithProviders(<SessionSummary {...defaultProps} />);
      expect(screen.getByTestId('session-summary-title')).toHaveTextContent('Session Complete');
    });

    it('renders stat items with label and value', () => {
      renderWithProviders(<SessionSummary {...defaultProps} />);
      expect(screen.getByText('Correct')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
      expect(screen.getByText('Wrong')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('Score')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });

    it('renders actions slot content', () => {
      renderWithProviders(<SessionSummary {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    });

    it('renders details slot content when provided', () => {
      renderWithProviders(<SessionSummary {...defaultProps} details={<p>Extra details here</p>} />);
      expect(screen.getByText('Extra details here')).toBeInTheDocument();
      expect(screen.getByTestId('session-summary-details')).toBeInTheDocument();
    });

    it('does not render details when not provided', () => {
      renderWithProviders(<SessionSummary {...defaultProps} />);
      expect(screen.queryByTestId('session-summary-details')).not.toBeInTheDocument();
    });

    it('renders stat icons when provided', () => {
      const IconMock = vi.fn(({ className }: { className?: string }) => (
        <svg data-testid="stat-icon" className={className} />
      ));
      const statsWithIcon = [{ label: 'Correct', value: '8', icon: IconMock }];
      renderWithProviders(<SessionSummary {...defaultProps} stats={statsWithIcon} />);
      expect(screen.getByTestId('stat-icon')).toBeInTheDocument();
    });
  });

  describe('data-testid attributes', () => {
    it('has data-testid="session-summary" on root', () => {
      renderWithProviders(<SessionSummary {...defaultProps} />);
      expect(screen.getByTestId('session-summary')).toBeInTheDocument();
    });

    it('has data-testid="session-summary-title" on title', () => {
      renderWithProviders(<SessionSummary {...defaultProps} />);
      expect(screen.getByTestId('session-summary-title')).toBeInTheDocument();
    });

    it('has data-testid="session-summary-stats" on stats grid', () => {
      renderWithProviders(<SessionSummary {...defaultProps} />);
      expect(screen.getByTestId('session-summary-stats')).toBeInTheDocument();
    });
  });

  describe('Grid layout', () => {
    it('grid columns match stats length', () => {
      renderWithProviders(<SessionSummary {...defaultProps} />);
      const statsGrid = screen.getByTestId('session-summary-stats');
      expect(statsGrid).toHaveStyle({ gridTemplateColumns: 'repeat(3, 1fr)' });
    });

    it('renders correct number of stat items', () => {
      renderWithProviders(<SessionSummary {...defaultProps} />);
      const statItems = screen.getAllByTestId('session-summary-stat');
      expect(statItems).toHaveLength(3);
    });
  });

  describe('className prop', () => {
    it('applies custom className to root element', () => {
      renderWithProviders(<SessionSummary {...defaultProps} className="custom-summary" />);
      expect(screen.getByTestId('session-summary')).toHaveClass('custom-summary');
    });
  });
});
