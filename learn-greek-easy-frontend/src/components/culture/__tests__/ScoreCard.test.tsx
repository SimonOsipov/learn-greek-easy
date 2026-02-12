import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@/lib/test-utils';
import userEvent from '@testing-library/user-event';
import { ScoreCard } from '../ScoreCard';

describe('ScoreCard', () => {
  const defaultProps = {
    correct: 3,
    incorrect: 2,
    total: 5,
    onTryAgain: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders with correct data-testid', () => {
      render(<ScoreCard {...defaultProps} />);

      expect(screen.getByTestId('score-card')).toBeInTheDocument();
    });

    it('displays percentage value correctly', () => {
      render(<ScoreCard {...defaultProps} />);

      const percentage = screen.getByTestId('score-percentage');
      expect(percentage).toHaveTextContent('60%');
    });

    it('displays fraction string correctly', () => {
      render(<ScoreCard {...defaultProps} />);

      const fraction = screen.getByTestId('score-fraction');
      expect(fraction).toHaveTextContent('3/5');
    });
  });

  describe('Pass/Fail States', () => {
    it('shows pass title when score >= 60%', () => {
      render(<ScoreCard correct={15} incorrect={5} total={20} onTryAgain={vi.fn()} />);

      const title = screen.getByTestId('score-card-title');
      expect(title).toHaveTextContent('Well done, warrior!');
    });

    it('shows fail title when score < 60%', () => {
      render(<ScoreCard correct={5} incorrect={15} total={20} onTryAgain={vi.fn()} />);

      const title = screen.getByTestId('score-card-title');
      expect(title).toHaveTextContent('Keep training!');
    });

    it('shows pass subtitle for passing score', () => {
      render(<ScoreCard correct={18} incorrect={2} total={20} onTryAgain={vi.fn()} />);

      const subtitle = screen.getByTestId('score-card-subtitle');
      expect(subtitle).toHaveTextContent(
        'You crushed it! Your knowledge of Greek culture is growing.'
      );
    });

    it('shows fail subtitle for failing score', () => {
      render(<ScoreCard correct={10} incorrect={10} total={20} onTryAgain={vi.fn()} />);

      const subtitle = screen.getByTestId('score-card-subtitle');
      expect(subtitle).toHaveTextContent('Every attempt makes you stronger. Review and try again!');
    });

    it('exactly 60% is treated as passing', () => {
      render(<ScoreCard correct={12} incorrect={8} total={20} onTryAgain={vi.fn()} />);

      const title = screen.getByTestId('score-card-title');
      expect(title).toHaveTextContent('Well done, warrior!');

      const subtitle = screen.getByTestId('score-card-subtitle');
      expect(subtitle).toHaveTextContent(
        'You crushed it! Your knowledge of Greek culture is growing.'
      );
    });
  });

  describe('Stats Row', () => {
    it('renders correct count', () => {
      render(<ScoreCard {...defaultProps} />);

      const correctStat = screen.getByTestId('stat-correct');
      expect(correctStat).toHaveTextContent('3');
      expect(correctStat).toHaveTextContent('Correct');
    });

    it('renders incorrect count', () => {
      render(<ScoreCard {...defaultProps} />);

      const incorrectStat = screen.getByTestId('stat-incorrect');
      expect(incorrectStat).toHaveTextContent('2');
      expect(incorrectStat).toHaveTextContent('Incorrect');
    });

    it('renders total count', () => {
      render(<ScoreCard {...defaultProps} />);

      const totalStat = screen.getByTestId('stat-total');
      expect(totalStat).toHaveTextContent('5');
      expect(totalStat).toHaveTextContent('Total');
    });
  });

  describe('SVG Ring', () => {
    it('renders background and progress circles', () => {
      render(<ScoreCard {...defaultProps} />);

      expect(screen.getByTestId('score-ring-bg')).toBeInTheDocument();
      expect(screen.getByTestId('score-ring-progress')).toBeInTheDocument();
    });

    it('calculates stroke-dasharray for given percentage', () => {
      render(<ScoreCard {...defaultProps} />);

      const progressCircle = screen.getByTestId('score-ring-progress');
      const RADIUS = 60;
      const circumference = 2 * Math.PI * RADIUS;
      const percentage = 60; // 3/5 = 60%
      const expectedDash = `${(percentage / 100) * circumference} ${circumference}`;

      expect(progressCircle).toHaveAttribute('stroke-dasharray', expectedDash);
    });

    it('uses emerald stroke color for passing scores', () => {
      render(<ScoreCard correct={15} incorrect={5} total={20} onTryAgain={vi.fn()} />);

      const progressCircle = screen.getByTestId('score-ring-progress');
      expect(progressCircle).toHaveAttribute('stroke', '#10b981');
    });

    it('uses amber stroke color for failing scores', () => {
      render(<ScoreCard correct={5} incorrect={15} total={20} onTryAgain={vi.fn()} />);

      const progressCircle = screen.getByTestId('score-ring-progress');
      expect(progressCircle).toHaveAttribute('stroke', '#f59e0b');
    });
  });

  describe('Try Again Button', () => {
    it('renders with correct text', () => {
      render(<ScoreCard {...defaultProps} />);

      const button = screen.getByTestId('score-card-try-again');
      expect(button).toHaveTextContent('Try Again');
    });

    it('calls onTryAgain callback when clicked', async () => {
      const user = userEvent.setup();
      const onTryAgain = vi.fn();
      render(<ScoreCard {...defaultProps} onTryAgain={onTryAgain} />);

      const button = screen.getByTestId('score-card-try-again');
      await user.click(button);

      expect(onTryAgain).toHaveBeenCalledTimes(1);
    });
  });

  describe('Animation', () => {
    it('applies animate-cult-fade-in class by default', () => {
      render(<ScoreCard {...defaultProps} />);

      const wrapper = screen.getByTestId('score-card');
      expect(wrapper.className).toContain('animate-cult-fade-in');
    });

    it('suppresses animation when prefers-reduced-motion is set', () => {
      const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: matchMediaMock,
      });

      render(<ScoreCard {...defaultProps} />);
      const wrapper = screen.getByTestId('score-card');
      expect(wrapper.className).not.toContain('animate-cult-fade-in');
    });
  });

  describe('Edge Cases', () => {
    it('handles 0/0 without crashing (shows 0%)', () => {
      render(<ScoreCard correct={0} incorrect={0} total={0} onTryAgain={vi.fn()} />);

      const percentage = screen.getByTestId('score-percentage');
      expect(percentage).toHaveTextContent('0%');

      const fraction = screen.getByTestId('score-fraction');
      expect(fraction).toHaveTextContent('0/0');
    });

    it('handles 10/10 (100%)', () => {
      render(<ScoreCard correct={10} incorrect={0} total={10} onTryAgain={vi.fn()} />);

      const percentage = screen.getByTestId('score-percentage');
      expect(percentage).toHaveTextContent('100%');

      const fraction = screen.getByTestId('score-fraction');
      expect(fraction).toHaveTextContent('10/10');

      // Should be passing
      const title = screen.getByTestId('score-card-title');
      expect(title).toHaveTextContent('Well done, warrior!');
    });

    it('handles 0/10 (0%)', () => {
      render(<ScoreCard correct={0} incorrect={10} total={10} onTryAgain={vi.fn()} />);

      const percentage = screen.getByTestId('score-percentage');
      expect(percentage).toHaveTextContent('0%');

      const fraction = screen.getByTestId('score-fraction');
      expect(fraction).toHaveTextContent('0/10');

      // Should be failing
      const title = screen.getByTestId('score-card-title');
      expect(title).toHaveTextContent('Keep training!');
    });

    it('clamps percentage when correct > total', () => {
      render(<ScoreCard correct={15} incorrect={0} total={10} onTryAgain={vi.fn()} />);

      const percentage = screen.getByTestId('score-percentage');
      expect(percentage).toHaveTextContent('100%');

      // Fraction should show actual values
      const fraction = screen.getByTestId('score-fraction');
      expect(fraction).toHaveTextContent('15/10');
    });
  });

  describe('Accessibility', () => {
    it('renders sr-only text with score information', () => {
      render(<ScoreCard {...defaultProps} />);

      const srText = screen.getByText(/Score: 3 out of 5, 60 percent/i);
      expect(srText).toBeInTheDocument();
      expect(srText.className).toContain('sr-only');
    });

    it('SVG has aria-hidden attribute', () => {
      render(<ScoreCard {...defaultProps} />);

      const svg = screen.getByTestId('score-ring-bg').closest('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
