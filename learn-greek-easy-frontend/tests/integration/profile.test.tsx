/**
 * Profile Preferences Integration Tests
 *
 * Tests the PreferencesSection component functionality including:
 * - Daily goal slider rendering and interaction
 * - Debounced save functionality
 * - Toast notifications on success/error
 * - Intensity label display based on slider value
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@/lib/test-utils';
import userEvent from '@testing-library/user-event';
import { PreferencesSection } from '@/components/profile/PreferencesSection';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types/auth';

// Mock the toast hook - needs to return toasts array for Toaster component
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
    toasts: [],
    dismiss: vi.fn(),
  }),
  toast: vi.fn(),
}));

// Create a mock user for testing
const createMockUser = (dailyGoal: number = 20): User => ({
  id: 'test-user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'free',
  preferences: {
    language: 'en',
    dailyGoal,
    notifications: true,
    theme: 'light',
  },
  stats: {
    streak: 5,
    wordsLearned: 100,
    totalXP: 500,
    joinedDate: new Date('2025-01-01'),
  },
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
});

describe('PreferencesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Set up authenticated user in store
    const mockUser = createMockUser(20);
    useAuthStore.setState({
      user: mockUser,
      token: 'mock-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render PreferencesSection with daily goal slider', () => {
      const user = createMockUser(20);
      render(<PreferencesSection user={user} />);

      // Verify preferences section is rendered
      expect(screen.getByTestId('preferences-section')).toBeInTheDocument();

      // Verify daily goal card is rendered
      expect(screen.getByTestId('daily-goal-card')).toBeInTheDocument();

      // Verify slider container is rendered
      expect(screen.getByTestId('daily-goal-slider')).toBeInTheDocument();

      // Radix UI Slider renders a thumb with role="slider" — verify range bounds via aria attrs
      const thumb = screen.getByRole('slider');
      expect(thumb).toBeInTheDocument();
      expect(thumb).toHaveAttribute('aria-valuemin', '5');
      expect(thumb).toHaveAttribute('aria-valuemax', '120');
    });

    it('should show initial value from props', () => {
      const user = createMockUser(45);
      render(<PreferencesSection user={user} />);

      // Radix UI Slider reports current value via aria-valuenow on the thumb
      const thumb = screen.getByRole('slider');
      expect(thumb).toHaveAttribute('aria-valuenow', '45');

      // Verify value is displayed in label
      expect(screen.getByTestId('daily-goal-value')).toHaveTextContent('45');
    });
  });

  describe('Slider Interaction', () => {
    it('should update local state on slider change', async () => {
      const user = createMockUser(20);
      render(<PreferencesSection user={user} />);

      const thumb = screen.getByRole('slider');

      // Radix Slider responds to ArrowRight (step +5). Press twice: 20 → 25 → 30.
      fireEvent.keyDown(thumb, { key: 'ArrowRight', code: 'ArrowRight' });
      fireEvent.keyDown(thumb, { key: 'ArrowRight', code: 'ArrowRight' });

      // Verify slider value updated via aria-valuenow
      expect(thumb).toHaveAttribute('aria-valuenow', '30');

      // Verify label updated
      await waitFor(() => {
        expect(screen.getByTestId('daily-goal-value')).toHaveTextContent('30');
      });
    });

    it('should trigger debounced API call on change', async () => {
      const user = createMockUser(20);
      const updateProfileSpy = vi.spyOn(useAuthStore.getState(), 'updateProfile');

      render(<PreferencesSection user={user} />);

      const thumb = screen.getByRole('slider');

      // Press ArrowRight twice: 20 → 25 → 30
      fireEvent.keyDown(thumb, { key: 'ArrowRight', code: 'ArrowRight' });
      fireEvent.keyDown(thumb, { key: 'ArrowRight', code: 'ArrowRight' });

      // API should not be called immediately (debounced)
      expect(updateProfileSpy).not.toHaveBeenCalled();

      // Fast forward past debounce time (1000ms)
      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      // Now API should be called
      await waitFor(() => {
        expect(updateProfileSpy).toHaveBeenCalledWith({
          preferences: expect.objectContaining({
            dailyGoal: 30,
          }),
        });
      });

      updateProfileSpy.mockRestore();
    });
  });

  describe('Toast Notifications', () => {
    it('should show success toast on successful save', async () => {
      const user = createMockUser(20);

      // Mock successful updateProfile
      const updateProfileSpy = vi.spyOn(useAuthStore.getState(), 'updateProfile')
        .mockResolvedValue(undefined);

      render(<PreferencesSection user={user} />);

      const thumb = screen.getByRole('slider');

      // Press ArrowRight twice: 20 → 25 → 30
      fireEvent.keyDown(thumb, { key: 'ArrowRight', code: 'ArrowRight' });
      fireEvent.keyDown(thumb, { key: 'ArrowRight', code: 'ArrowRight' });

      // Fast forward past debounce time
      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      // Wait for toast to be called
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.any(String),
            description: expect.any(String),
          })
        );
      });

      updateProfileSpy.mockRestore();
    });

    it('should show error toast on failed save', async () => {
      const user = createMockUser(20);

      // Mock failed updateProfile
      const updateProfileSpy = vi.spyOn(useAuthStore.getState(), 'updateProfile')
        .mockRejectedValue(new Error('Network error'));

      render(<PreferencesSection user={user} />);

      const thumb = screen.getByRole('slider');

      // Press ArrowRight twice: 20 → 25 → 30
      fireEvent.keyDown(thumb, { key: 'ArrowRight', code: 'ArrowRight' });
      fireEvent.keyDown(thumb, { key: 'ArrowRight', code: 'ArrowRight' });

      // Fast forward past debounce time
      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      // Wait for error toast to be called
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
          })
        );
      });

      updateProfileSpy.mockRestore();
    });
  });

  describe('Intensity Labels', () => {
    it('should display Light intensity for values < 15', () => {
      const user = createMockUser(10);
      render(<PreferencesSection user={user} />);

      const intensityLabel = screen.getByTestId('daily-goal-intensity');
      expect(intensityLabel).toHaveTextContent(/light/i);
    });

    it('should display Moderate intensity for values 15-29', () => {
      const user = createMockUser(20);
      render(<PreferencesSection user={user} />);

      const intensityLabel = screen.getByTestId('daily-goal-intensity');
      expect(intensityLabel).toHaveTextContent(/moderate/i);
    });

    it('should display Regular intensity for values 30-59', () => {
      const user = createMockUser(45);
      render(<PreferencesSection user={user} />);

      const intensityLabel = screen.getByTestId('daily-goal-intensity');
      expect(intensityLabel).toHaveTextContent(/regular/i);
    });

    it('should display Intensive for values >= 60', () => {
      const user = createMockUser(90);
      render(<PreferencesSection user={user} />);

      const intensityLabel = screen.getByTestId('daily-goal-intensity');
      expect(intensityLabel).toHaveTextContent(/intensive/i);
    });

    it('should update intensity label when slider changes', async () => {
      const user = createMockUser(10); // Start with Light (10 min)
      render(<PreferencesSection user={user} />);

      const thumb = screen.getByRole('slider');
      let intensityLabel = screen.getByTestId('daily-goal-intensity');

      // Initial: Light (10)
      expect(intensityLabel).toHaveTextContent(/light/i);

      // Change to Moderate: press ArrowRight twice to reach 20 (10→15→20)
      fireEvent.keyDown(thumb, { key: 'ArrowRight', code: 'ArrowRight' });
      fireEvent.keyDown(thumb, { key: 'ArrowRight', code: 'ArrowRight' });
      await waitFor(() => {
        intensityLabel = screen.getByTestId('daily-goal-intensity');
        expect(intensityLabel).toHaveTextContent(/moderate/i);
      });

      // Change to Regular: press ArrowRight 5 more times to reach 45 (20→25→30→35→40→45)
      for (let i = 0; i < 5; i++) {
        fireEvent.keyDown(thumb, { key: 'ArrowRight', code: 'ArrowRight' });
      }
      await waitFor(() => {
        intensityLabel = screen.getByTestId('daily-goal-intensity');
        expect(intensityLabel).toHaveTextContent(/regular/i);
      });

      // Change to Intensive: press ArrowRight 9 more times to reach 90 (45→...→90)
      for (let i = 0; i < 9; i++) {
        fireEvent.keyDown(thumb, { key: 'ArrowRight', code: 'ArrowRight' });
      }
      await waitFor(() => {
        intensityLabel = screen.getByTestId('daily-goal-intensity');
        expect(intensityLabel).toHaveTextContent(/intensive/i);
      });
    });
  });

  describe('Slider Boundary Values', () => {
    it('should handle minimum value (5)', () => {
      const user = createMockUser(5);
      render(<PreferencesSection user={user} />);

      // Radix Slider reports value via aria-valuenow on the thumb
      const thumb = screen.getByRole('slider');
      expect(thumb).toHaveAttribute('aria-valuenow', '5');
      expect(screen.getByTestId('daily-goal-value')).toHaveTextContent('5');
    });

    it('should handle maximum value (120)', () => {
      const user = createMockUser(120);
      render(<PreferencesSection user={user} />);

      const thumb = screen.getByRole('slider');
      expect(thumb).toHaveAttribute('aria-valuenow', '120');
      expect(screen.getByTestId('daily-goal-value')).toHaveTextContent('120');
    });
  });

  describe('Saving Indicator', () => {
    it('should show saving indicator during save', async () => {
      const user = createMockUser(20);

      // Create a delayed promise to simulate slow API
      let resolvePromise: () => void;
      const delayedPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      const updateProfileSpy = vi.spyOn(useAuthStore.getState(), 'updateProfile')
        .mockReturnValue(delayedPromise);

      render(<PreferencesSection user={user} />);

      const thumb = screen.getByRole('slider');

      // Press ArrowRight twice: 20 → 25 → 30
      fireEvent.keyDown(thumb, { key: 'ArrowRight', code: 'ArrowRight' });
      fireEvent.keyDown(thumb, { key: 'ArrowRight', code: 'ArrowRight' });

      // Fast forward past debounce time
      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      // Saving indicator should appear
      await waitFor(() => {
        expect(screen.getByTestId('preferences-saving')).toBeInTheDocument();
      });

      // Resolve the promise
      await act(async () => {
        resolvePromise!();
      });

      // Saving indicator should disappear
      await waitFor(() => {
        expect(screen.queryByTestId('preferences-saving')).not.toBeInTheDocument();
      });

      updateProfileSpy.mockRestore();
    });
  });
});
