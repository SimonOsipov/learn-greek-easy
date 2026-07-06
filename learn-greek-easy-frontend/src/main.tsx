// Font imports - Inter for shadcn/ui Vega preset
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './index.css';

import { StrictMode } from 'react';

import { HelmetProvider } from '@dr.pogodin/react-helmet';
import { createRoot } from 'react-dom/client';

import { initI18n, loadDeferredEnglishNamespaces } from '@/i18n/init';
import { initSentryAsync } from '@/lib/sentry-queue';

import App from './App.tsx';

/**
 * Async bootstrap function that initializes i18n before rendering.
 *
 * This ensures that:
 * 1. Language detection happens BEFORE React renders
 * 2. Non-English resources are pre-loaded if detected
 * 3. No flash of English text for Greek/Russian users
 */
async function bootstrap() {
  // Initialize i18n BEFORE rendering - ensures correct language resources are loaded
  await initI18n();

  // Remove the pre-React LCP shell now that React owns the screen. Merely hiding
  // it (display:none) leaves its role="status" live-region in the DOM, where it
  // shadows app toast queries like page.locator('[role="status"]').first() — the
  // hidden shell is the first match, so the real toast is never asserted.
  document.getElementById('lcp-shell')?.remove();

  // Render React app
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </StrictMode>
  );

  // Fire-and-forget the 14 non-critical EN namespaces now that React owns the
  // screen. Pre-auth screens (/, /login, /register) use only the synchronous
  // critical trio (common/auth/landing) already loaded behind `await
  // initI18n()`, so this post-paint load never blocks first paint. Deliberately
  // NOT behind requestIdleCallback — post-auth screens need these promptly, and
  // the load is cheap and off the critical path. (PERF-24-01)
  void loadDeferredEnglishNamespaces();

  // Defer Sentry initialization until after first paint
  // This reduces render-blocking time by ~200-300ms
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => initSentryAsync());
  } else {
    // Fallback for Safari (which doesn't support requestIdleCallback)
    setTimeout(() => initSentryAsync(), 100);
  }
}

bootstrap();
