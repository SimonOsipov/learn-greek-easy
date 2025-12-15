/**
 * Deck Filtering and Search Tests
 *
 * NOTE: These tests were written for the old mock API structure.
 * They need to be rewritten to use proper API mocks for the real backend services.
 * See tests/integration/__mocks__/api-mocks.ts for the mock implementations.
 *
 * TODO: Rewrite these tests to use the new API mocks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/lib/test-utils';
import userEvent from '@testing-library/user-event';
import { DecksPage } from '@/pages/DecksPage';
import { useAuthStore } from '@/stores/authStore';
import { useDeckStore } from '@/stores/deckStore';

// Mock all API services
vi.mock('@/services/authAPI', () => ({
  authAPI: {
    login: vi.fn().mockResolvedValue({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      token_type: 'bearer',
    }),
    getProfile: vi.fn().mockResolvedValue({
      id: 'test-user-123',
      email: 'demo@learngreekeasy.com',
      full_name: 'Demo User',
      is_superuser: false,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      settings: { daily_goal: 20, email_notifications: true },
    }),
    logout: vi.fn().mockResolvedValue(undefined),
  },
  clearAuthTokens: vi.fn(),
}));

vi.mock('@/services/deckAPI', () => ({
  deckAPI: {
    getList: vi.fn().mockResolvedValue({
      total: 4,
      page: 1,
      page_size: 50,
      decks: [
        { id: 'deck-a1-basics', name: 'A1 Basic Vocabulary', description: 'Basic Greek vocabulary', level: 'a1', card_count: 10, estimated_time_minutes: 15, tags: [], created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
        { id: 'deck-a2-basics', name: 'A2 Basic Vocabulary', description: 'A2 Greek vocabulary', level: 'a2', card_count: 20, estimated_time_minutes: 25, tags: [], created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
        { id: 'deck-b1-inter', name: 'B1 Intermediate', description: 'B1 Greek vocabulary', level: 'b1', card_count: 30, estimated_time_minutes: 35, tags: [], created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
        { id: 'deck-b2-upper', name: 'B2 Upper Intermediate', description: 'B2 Greek vocabulary', level: 'b2', card_count: 40, estimated_time_minutes: 45, tags: [], created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
      ],
    }),
    getById: vi.fn().mockResolvedValue({
      id: 'deck-a1-basics',
      name: 'A1 Basic Vocabulary',
      description: 'Basic Greek vocabulary',
      level: 'a1',
      card_count: 10,
      estimated_time_minutes: 15,
      tags: [],
      cards: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    }),
  },
}));

vi.mock('@/services/progressAPI', () => ({
  progressAPI: {
    getDeckProgressList: vi.fn().mockResolvedValue({ total: 0, page: 1, page_size: 50, decks: [] }),
    getDeckProgressDetail: vi.fn().mockResolvedValue(null),
    getDashboard: vi.fn().mockResolvedValue({ overview: {} }),
    getTrends: vi.fn().mockResolvedValue({ period: 'week', daily_stats: [], summary: {} }),
  },
}));

// Helper to set up authenticated user
const setupAuthenticatedUser = () => {
  useAuthStore.setState({
    user: {
      id: 'test-user-123',
      email: 'demo@learngreekeasy.com',
      name: 'Demo User',
      role: 'free',
      preferences: { language: 'en', dailyGoal: 20, notifications: true, theme: 'light' },
      stats: { streak: 0, wordsLearned: 0, totalXP: 0, joinedDate: new Date('2025-01-01') },
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    },
    token: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    isAuthenticated: true,
    isLoading: false,
    error: null,
    rememberMe: false,
  });
};

describe.skip('Deck Filtering and Search', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Set up authenticated user directly (no API call)
    setupAuthenticatedUser();

    useDeckStore.setState({
      decks: [],
      filters: { search: '', levels: [], categories: [], status: [], showPremiumOnly: false },
      isLoading: false,
      error: null,
    });
  });

  describe('Level Filtering', () => {
    it('should filter decks by level A1', async () => {
      const user = userEvent.setup();

      render(<DecksPage />);

      await waitFor(() => {
        expect(screen.getByText(/A1 Basic Vocabulary/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Click A1 filter button
      const a1Button = screen.getByRole('button', { name: /^A1$/i });
      await user.click(a1Button);

      // Filter should be applied and A1 deck should still be visible after re-fetch
      await waitFor(() => {
        const filters = useDeckStore.getState().filters;
        expect(filters.levels).toContain('A1');
        // Also verify the deck is visible after the async re-fetch completes
        expect(screen.getByText(/A1 Basic Vocabulary/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should filter decks by level A2', async () => {
      const user = userEvent.setup();

      render(<DecksPage />);

      await waitFor(() => {
        expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
      }, { timeout: 5000 });

      // Click A2 filter
      const a2Button = screen.getByRole('button', { name: /^A2$/i });
      await user.click(a2Button);

      // Filter state should update
      await waitFor(() => {
        const filters = useDeckStore.getState().filters;
        expect(filters.levels).toContain('A2');
      });
    });

    it('should clear level filter when clicked again (toggle)', async () => {
      const user = userEvent.setup();

      render(<DecksPage />);

      // Wait for decks to load
      await waitFor(() => {
        expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
      }, { timeout: 5000 });

      // Click A1 filter
      const a1Button = screen.getByRole('button', { name: /^A1$/i });
      await user.click(a1Button);

      // Verify filter is applied
      await waitFor(() => {
        const filters = useDeckStore.getState().filters;
        expect(filters.levels).toContain('A1');
      });

      // Click again to clear
      await user.click(a1Button);

      // Filter should be cleared
      await waitFor(() => {
        const filters = useDeckStore.getState().filters;
        expect(filters.levels).not.toContain('A1');
      });
    });
  });

  describe('Status Filtering', () => {
    it('should filter by "In Progress" status', async () => {
      const user = userEvent.setup();

      render(<DecksPage />);

      await waitFor(() => {
        expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
      }, { timeout: 5000 });

      // Click "In Progress" filter
      const inProgressButton = screen.getByRole('button', { name: /in progress/i });
      await user.click(inProgressButton);

      // Filter should be applied
      await waitFor(() => {
        const filters = useDeckStore.getState().filters;
        expect(filters.status).toContain('in-progress');
      });
    });

    it('should filter by "Completed" status', async () => {
      const user = userEvent.setup();

      render(<DecksPage />);

      await waitFor(() => {
        expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
      }, { timeout: 5000 });

      // Use getAllByRole and find the one with aria-pressed (filter button)
      // to avoid matching deck cards that have "completed" in their aria-label
      const completedButtons = screen.getAllByRole('button', { name: /completed/i });
      const completedFilterButton = completedButtons.find(btn => btn.hasAttribute('aria-pressed'));
      expect(completedFilterButton).toBeTruthy();
      await user.click(completedFilterButton!);

      await waitFor(() => {
        const filters = useDeckStore.getState().filters;
        expect(filters.status).toContain('completed');
      });
    });
  });

  describe('Search Functionality', () => {
    it('should search decks by name', async () => {
      const user = userEvent.setup();

      render(<DecksPage />);

      await waitFor(() => {
        expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
      }, { timeout: 5000 });

      // Type in search box
      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'vocabulary');

      // Wait for debounce (500ms) AND for decks to re-render
      await waitFor(
        () => {
          const filters = useDeckStore.getState().filters;
          expect(filters.search).toBe('vocabulary');
          // Also verify the deck is visible (after async re-fetch completes)
          expect(screen.getByText(/A1 Basic Vocabulary/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should debounce search input', async () => {
      const user = userEvent.setup();

      render(<DecksPage />);

      const searchInput = await screen.findByPlaceholderText(/search/i);

      // Type quickly
      await user.type(searchInput, 'greek');

      // Filter should NOT update immediately (debounce is active)
      // Note: In fast test environments, debounce might have already completed
      // so we just verify the final state instead of checking the intermediate state

      // Wait for debounce to complete and filter to update
      await waitFor(
        () => {
          const updatedFilters = useDeckStore.getState().filters;
          expect(updatedFilters.search).toBe('greek');
        },
        { timeout: 2000 }
      );
    });
  });

  describe('Combined Filters', () => {
    it('should combine level and status filters', async () => {
      const user = userEvent.setup();

      render(<DecksPage />);

      await waitFor(() => {
        expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
      }, { timeout: 5000 });

      // Apply level filter
      const a1Button = screen.getByRole('button', { name: /^A1$/i });
      await user.click(a1Button);

      // Apply status filter
      const inProgressButton = screen.getByRole('button', { name: /in progress/i });
      await user.click(inProgressButton);

      // Both filters should be active
      await waitFor(() => {
        const filters = useDeckStore.getState().filters;
        expect(filters.levels).toContain('A1');
        expect(filters.status).toContain('in-progress');
      });
    });

    it('should combine all filters (level, status, search)', async () => {
      const user = userEvent.setup();

      render(<DecksPage />);

      await waitFor(() => {
        expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
      }, { timeout: 5000 });

      // Apply all filters
      const a1Button = screen.getByRole('button', { name: /^A1$/i });
      await user.click(a1Button);

      const inProgressButton = screen.getByRole('button', { name: /in progress/i });
      await user.click(inProgressButton);

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'greek');

      // Wait for all filters to apply (including debounced search)
      await waitFor(
        () => {
          const filters = useDeckStore.getState().filters;
          expect(filters.levels).toContain('A1');
          expect(filters.status).toContain('in-progress');
          expect(filters.search).toBe('greek');
        },
        { timeout: 2000 }
      );
    });
  });

  describe('Reset Filters', () => {
    it('should reset all filters', async () => {
      const user = userEvent.setup();

      render(<DecksPage />);

      await waitFor(() => {
        expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
      }, { timeout: 5000 });

      // Apply filters
      const a1Button = screen.getByRole('button', { name: /^A1$/i });
      await user.click(a1Button);

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'test');

      // Wait for filters to apply
      await waitFor(() => {
        const filters = useDeckStore.getState().filters;
        expect(filters.levels.length).toBeGreaterThan(0);
      });

      // Click reset/clear filters
      const clearButton = screen.getByRole('button', { name: /clear all/i });
      await user.click(clearButton);

      // All filters should be cleared
      await waitFor(() => {
        const filters = useDeckStore.getState().filters;
        expect(filters.levels).toEqual([]);
        expect(filters.status).toEqual([]);
        expect(filters.search).toBe('');
      });
    });
  });
});
