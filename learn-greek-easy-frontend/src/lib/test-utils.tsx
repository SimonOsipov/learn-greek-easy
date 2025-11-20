/**
 * Custom Test Utilities
 * Provides helper functions for testing React components with providers
 */

import { render, RenderOptions } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';

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
  {
    initialRoute = '/',
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  // Set initial route if provided
  if (initialRoute !== '/') {
    window.history.pushState({}, 'Test page', initialRoute);
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <BrowserRouter>
        {children}
        <Toaster />
      </BrowserRouter>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';

// Export custom render as default render
export { renderWithProviders as render };
