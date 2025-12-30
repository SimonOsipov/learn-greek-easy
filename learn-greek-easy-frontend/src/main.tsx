// Font imports - Inter for shadcn/ui Vega preset
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './i18n'; // i18n initialization - MUST be imported before App
import './index.css';

import { StrictMode } from 'react';

import { createRoot } from 'react-dom/client';

import { initSentryAsync } from '@/lib/sentry-queue';

import App from './App.tsx';

// Hide LCP shell when React takes over
const lcpShell = document.getElementById('lcp-shell');
if (lcpShell) {
  lcpShell.classList.add('hidden');
}

// Render React app first for faster LCP
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
