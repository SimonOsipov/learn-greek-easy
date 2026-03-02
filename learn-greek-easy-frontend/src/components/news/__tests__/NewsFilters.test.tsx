import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import { NewsFilters } from '@/components/news/NewsFilters';
import { render, screen, within } from '@/lib/test-utils';

const defaultProps = {
  countryFilter: 'all' as const,
  onCountryChange: vi.fn(),
  newsLevel: 'a2' as const,
  onLevelChange: vi.fn(),
  countryCounts: { cyprus: 10, greece: 5, world: 3 },
};

describe('NewsFilters', () => {
  describe('Country Buttons', () => {
    it('renders all 4 country buttons with counts', () => {
      render(<NewsFilters {...defaultProps} />);

      const filters = screen.getByTestId('news-filters');
      expect(within(filters).getByRole('button', { name: /All/ })).toBeInTheDocument();
      expect(within(filters).getByRole('button', { name: /Cyprus/ })).toBeInTheDocument();
      expect(within(filters).getByRole('button', { name: /Greece/ })).toBeInTheDocument();
      expect(within(filters).getByRole('button', { name: /World/ })).toBeInTheDocument();

      // Counts displayed
      expect(screen.getByText('18')).toBeInTheDocument(); // 10+5+3
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('marks active country button with aria-pressed=true', () => {
      render(<NewsFilters {...defaultProps} countryFilter="cyprus" />);

      const filters = screen.getByTestId('news-filters');
      expect(within(filters).getByRole('button', { name: /All/ })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
      expect(within(filters).getByRole('button', { name: /Cyprus/ })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(within(filters).getByRole('button', { name: /Greece/ })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });

    it('calls onCountryChange when clicking a country button', async () => {
      const user = userEvent.setup();
      const onCountryChange = vi.fn();
      render(<NewsFilters {...defaultProps} onCountryChange={onCountryChange} />);

      const filters = screen.getByTestId('news-filters');
      await user.click(within(filters).getByRole('button', { name: /Greece/ }));

      expect(onCountryChange).toHaveBeenCalledWith('greece');
    });

    it('calls onCountryChange with "all" when clicking All button', async () => {
      const user = userEvent.setup();
      const onCountryChange = vi.fn();
      render(
        <NewsFilters {...defaultProps} countryFilter="cyprus" onCountryChange={onCountryChange} />
      );

      const filters = screen.getByTestId('news-filters');
      await user.click(within(filters).getByRole('button', { name: /All/ }));

      expect(onCountryChange).toHaveBeenCalledWith('all');
    });
  });

  describe('Level Buttons', () => {
    it('renders difficulty label and A2/B2 buttons', () => {
      render(<NewsFilters {...defaultProps} />);

      expect(screen.getByText('Difficulty:')).toBeInTheDocument();

      const filters = screen.getByTestId('news-filters');
      expect(within(filters).getByRole('button', { name: /A2/ })).toBeInTheDocument();
      expect(within(filters).getByRole('button', { name: /B2/ })).toBeInTheDocument();
    });

    it('marks active level button with aria-pressed=true', () => {
      render(<NewsFilters {...defaultProps} newsLevel="b2" />);

      const filters = screen.getByTestId('news-filters');
      expect(within(filters).getByRole('button', { name: /A2/ })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
      expect(within(filters).getByRole('button', { name: /B2/ })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });

    it('calls onLevelChange when clicking a level button', async () => {
      const user = userEvent.setup();
      const onLevelChange = vi.fn();
      render(<NewsFilters {...defaultProps} onLevelChange={onLevelChange} />);

      const filters = screen.getByTestId('news-filters');
      await user.click(within(filters).getByRole('button', { name: /B2/ }));

      expect(onLevelChange).toHaveBeenCalledWith('b2');
    });
  });

  describe('Layout', () => {
    it('has a separator between country and level groups', () => {
      render(<NewsFilters {...defaultProps} />);

      const separator = screen.getByTestId('news-filters').querySelector('[aria-hidden="true"]');
      expect(separator).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<NewsFilters {...defaultProps} className="mb-4" />);

      expect(screen.getByTestId('news-filters')).toHaveClass('mb-4');
    });
  });
});
