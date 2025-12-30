// Font imports - Inter for shadcn/ui Vega preset
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './index.css';

import { StrictMode } from 'react';

import { createRoot } from 'react-dom/client';

import { initI18n } from '@/i18n/init';
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

  // Hide LCP shell when React takes over
  const lcpShell = document.getElementById('lcp-shell');
  if (lcpShell) {
    lcpShell.classList.add('hidden');
  }

  // Render React app
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );

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
