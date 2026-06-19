/**
 * Custom Test Utilities
 * Provides helper functions for testing React components with providers
 */

import { type ReactElement, type ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { BrowserRouter } from 'react-router-dom';

import { Toaster } from '@/components/ui/toaster';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import i18n from '@/i18n';

// Custom render function that wraps components with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  // Initial route for react-router tests
  initialRoute?: string;
}

/**
 * Custom render function that wraps components with necessary providers
 * @param ui - React component to render
 * @param options - Render options (initialRoute, etc.)
 */
export function renderWithProviders(
  ui: ReactElement,
  { initialRoute = '/', ...renderOptions }: CustomRenderOptions = {}
) {
  // Set initial route if provided
  if (initialRoute !== '/') {
    window.history.pushState({}, 'Test page', initialRoute);
  }

  // Fresh client per render (retries off, no window-focus refetch) so pages
  // that call useQuery (e.g. MockExamPage) can mount. Tests that need to seed
  // their own cache may still nest their own <QueryClientProvider> inside the
  // rendered `ui` — the innermost provider wins, so this outer one is a
  // harmless default for the common case.
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <ThemeProvider>
              <BrowserRouter>
                {children}
                <Toaster />
              </BrowserRouter>
            </ThemeProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </I18nextProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Returns a fresh QueryClient per test with retries and window-focus
 * refetch disabled. Pass into `<QueryClientProvider>` in test render
 * helpers to avoid cross-test cache leaks.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        gcTime: Infinity,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';

// Export custom render as default render
export { renderWithProviders as render };
