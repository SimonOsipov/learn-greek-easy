import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ChunkErrorBoundary } from '../ChunkErrorBoundary';

// Mock the logger to prevent console noise
vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

// Component that throws an error
const ThrowingComponent = ({ error }: { error: Error }) => {
  throw error;
};

// Component that doesn't throw
const SafeComponent = () => <div data-testid="safe-content">Safe content</div>;

describe('ChunkErrorBoundary', () => {
  // Suppress React error boundary console errors during tests
  const originalError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  describe('happy path', () => {
    it('should render children when no error occurs', () => {
      render(
        <ChunkErrorBoundary>
          <SafeComponent />
        </ChunkErrorBoundary>
      );

      expect(screen.getByTestId('safe-content')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('re-throws non-chunk errors to parent error boundary', () => {
      const nonChunkError = new Error(
        'Google OAuth components must be used within GoogleOAuthProvider'
      );
      const ThrowingNonChunkComponent = () => {
        throw nonChunkError;
      };

      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(
          <ChunkErrorBoundary>
            <ThrowingNonChunkComponent />
          </ChunkErrorBoundary>
        );
      }).toThrow('Google OAuth components must be used within GoogleOAuthProvider');

      consoleSpy.mockRestore();
    });

    it('should catch chunk errors and show retry UI with maxRetries=0', async () => {
      const chunkError = new Error('Loading chunk abc failed');

      render(
        <ChunkErrorBoundary maxRetries={0}>
          <ThrowingComponent error={chunkError} />
        </ChunkErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to Load')).toBeInTheDocument();
      });
    });

    it('should show version mismatch UI for unexpected token errors', async () => {
      const versionError = new Error('Unexpected token < in JSON at position 0');

      render(
        <ChunkErrorBoundary maxRetries={0}>
          <ThrowingComponent error={versionError} />
        </ChunkErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText('App Updated')).toBeInTheDocument();
        expect(screen.getByText(/new version of the app is available/i)).toBeInTheDocument();
      });
    });

    it('should show Refresh App button for version mismatch', async () => {
      const versionError = new Error('Unexpected token');

      render(
        <ChunkErrorBoundary maxRetries={0}>
          <ThrowingComponent error={versionError} />
        </ChunkErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Refresh App/i })).toBeInTheDocument();
      });
    });

    it('should show Try Again and Refresh Page buttons after retries exhausted', async () => {
      // Use a chunk error since non-chunk errors are now re-thrown
      const chunkError = new Error('Failed to fetch dynamically imported module');

      render(
        <ChunkErrorBoundary maxRetries={0}>
          <ThrowingComponent error={chunkError} />
        </ChunkErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Refresh Page/i })).toBeInTheDocument();
      });
    });

    it('should disable Try Again button when max retries exceeded', async () => {
      // Use a chunk error since non-chunk errors are now re-thrown
      const chunkError = new Error('Loading chunk xyz failed');

      render(
        <ChunkErrorBoundary maxRetries={0}>
          <ThrowingComponent error={chunkError} />
        </ChunkErrorBoundary>
      );

      await waitFor(() => {
        const tryAgainButton = screen.getByRole('button', { name: /Try Again/i });
        expect(tryAgainButton).toBeDisabled();
      });
    });
  });

  describe('chunk error detection', () => {
    it('should recognize "loading chunk" in error message', () => {
      const boundary = new ChunkErrorBoundary({});
      expect(boundary.isChunkLoadError(new Error('Loading chunk abc failed'))).toBe(true);
    });

    it('should recognize "dynamically imported module" in error message', () => {
      const boundary = new ChunkErrorBoundary({});
      expect(
        boundary.isChunkLoadError(new Error('Failed to fetch dynamically imported module'))
      ).toBe(true);
    });

    it('should recognize "failed to fetch" in error message', () => {
      const boundary = new ChunkErrorBoundary({});
      expect(boundary.isChunkLoadError(new Error('Failed to fetch'))).toBe(true);
    });

    it('should recognize ChunkLoadError by name', () => {
      const boundary = new ChunkErrorBoundary({});
      const error = new Error('Some error');
      error.name = 'ChunkLoadError';
      expect(boundary.isChunkLoadError(error)).toBe(true);
    });

    it('should return false for non-chunk errors', () => {
      const boundary = new ChunkErrorBoundary({});
      expect(boundary.isChunkLoadError(new Error('Regular error'))).toBe(false);
    });
  });

  describe('version mismatch detection', () => {
    it('should detect unexpected token errors', () => {
      const boundary = new ChunkErrorBoundary({});
      expect(boundary.isVersionMismatch(new Error('Unexpected token <'))).toBe(true);
    });

    it('should detect invalid JSON errors', () => {
      const boundary = new ChunkErrorBoundary({});
      expect(boundary.isVersionMismatch(new Error('is not valid json'))).toBe(true);
    });

    it('should detect MIME type errors', () => {
      const boundary = new ChunkErrorBoundary({});
      expect(boundary.isVersionMismatch(new Error('MIME type mismatch'))).toBe(true);
    });

    it('should return false for non-version-mismatch errors', () => {
      const boundary = new ChunkErrorBoundary({});
      expect(boundary.isVersionMismatch(new Error('Network error'))).toBe(false);
    });
  });
});
