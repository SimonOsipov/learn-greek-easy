import { describe, it, expect, vi, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { waitFor } from '@testing-library/react';

import { NewsFilters } from '@/components/news/NewsFilters';
import { render, screen, within } from '@/lib/test-utils';

// Base props without search — search is opt-in per test.
// Keeping search out of defaultProps ensures the Layout/separator test is unambiguous:
// it will only find the difficulty-section aria-hidden separator, not the search icon.
const defaultProps = {
  countryFilter: 'all' as const,
  onCountryChange: vi.fn(),
  newsLevel: 'a2' as const,
  onLevelChange: vi.fn(),
  countryCounts: { cyprus: 10, greece: 5, world: 3 },
};

// Convenience spread for tests that need the search input rendered
const withSearch = {
  searchValue: '',
  onSearchChange: vi.fn(),
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
    it('renders difficulty label and A2/B1 buttons', () => {
      render(<NewsFilters {...defaultProps} />);

      expect(screen.getByText('Level:')).toBeInTheDocument();

      const filters = screen.getByTestId('news-filters');
      expect(within(filters).getByRole('button', { name: /A2/ })).toBeInTheDocument();
      expect(within(filters).getByRole('button', { name: /B1/ })).toBeInTheDocument();
    });

    it('marks active level button with aria-pressed=true', () => {
      render(<NewsFilters {...defaultProps} newsLevel="b1" />);

      const filters = screen.getByTestId('news-filters');
      expect(within(filters).getByRole('button', { name: /A2/ })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
      expect(within(filters).getByRole('button', { name: /B1/ })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });

    it('calls onLevelChange when clicking a level button', async () => {
      const user = userEvent.setup();
      const onLevelChange = vi.fn();
      render(<NewsFilters {...defaultProps} onLevelChange={onLevelChange} />);

      const filters = screen.getByTestId('news-filters');
      await user.click(within(filters).getByRole('button', { name: /B1/ }));

      expect(onLevelChange).toHaveBeenCalledWith('b1');
    });
  });

  describe('Layout', () => {
    it('applies custom className', () => {
      render(<NewsFilters {...defaultProps} className="mb-4" />);

      expect(screen.getByTestId('news-filters')).toHaveClass('mb-4');
    });
  });

  // NWS8-02: Search Input — AC #1 render, AC #2 debounce, AC #3 clear, dashboard guard
  describe('Search Input (NWS8-02)', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('renders the search input when onSearchChange is provided', () => {
      render(<NewsFilters {...defaultProps} {...withSearch} />);
      expect(screen.getByTestId('news-search-input')).toBeInTheDocument();
    });

    it('does NOT render the search input when onSearchChange is omitted (dashboard guard)', () => {
      render(<NewsFilters {...defaultProps} />);
      expect(screen.queryByTestId('news-search-input')).not.toBeInTheDocument();
    });

    it('search input has data-testid="news-search-input"', () => {
      render(<NewsFilters {...defaultProps} {...withSearch} />);
      const input = screen.getByTestId('news-search-input');
      expect(input).toHaveAttribute('data-testid', 'news-search-input');
    });

    it('is controlled by searchValue prop — reflects external value', () => {
      render(<NewsFilters {...defaultProps} {...withSearch} searchValue="Cyprus" />);
      const input = screen.getByTestId('news-search-input') as HTMLInputElement;
      expect(input.value).toBe('Cyprus');
    });

    it('external reset (searchValue → "") clears the displayed input', () => {
      const onSearchChange = vi.fn();
      const { rerender } = render(
        <NewsFilters {...defaultProps} searchValue="hello" onSearchChange={onSearchChange} />
      );
      const input = screen.getByTestId('news-search-input') as HTMLInputElement;
      expect(input.value).toBe('hello');

      rerender(<NewsFilters {...defaultProps} searchValue="" onSearchChange={onSearchChange} />);
      expect(input.value).toBe('');
    });

    it('calls onSearchChange debounced ~300ms after typing (real timers, waitFor)', async () => {
      const user = userEvent.setup();
      const onSearchChange = vi.fn();
      render(<NewsFilters {...defaultProps} searchValue="" onSearchChange={onSearchChange} />);
      const input = screen.getByTestId('news-search-input');

      await user.type(input, 'hello');

      // With real timers, waitFor will poll until the 300ms debounce fires naturally
      await waitFor(
        () => {
          expect(onSearchChange).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );

      // Final call should have the complete word (debounce collapses rapid keystrokes)
      const lastCall = onSearchChange.mock.calls[onSearchChange.mock.calls.length - 1];
      expect(lastCall[0]).toBe('hello');
    });

    it('shows the clear button only when input has a value', () => {
      render(<NewsFilters {...defaultProps} {...withSearch} searchValue="test" />);
      // Clear button should be present when input has value
      expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
    });

    it('hides the clear button when input is empty', () => {
      render(<NewsFilters {...defaultProps} {...withSearch} searchValue="" />);
      expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();
    });

    it('clicking clear calls onSearchChange with empty string immediately', async () => {
      const user = userEvent.setup();
      const onSearchChange = vi.fn();
      render(<NewsFilters {...defaultProps} searchValue="test" onSearchChange={onSearchChange} />);

      const clearBtn = screen.getByRole('button', { name: /clear search/i });
      await user.click(clearBtn);

      // Clear fires immediately (not debounced — clears cancel the pending timer)
      expect(onSearchChange).toHaveBeenCalledWith('');
    });

    it('country pills and A2/B1 segment are still rendered when search input is present', () => {
      render(<NewsFilters {...defaultProps} {...withSearch} />);
      expect(screen.getByTestId('news-country-filters')).toBeInTheDocument();
      expect(screen.getByTestId('news-difficulty-selector')).toBeInTheDocument();
    });
  });
});
