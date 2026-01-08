/// <reference types="vite/client" />

interface ImportMetaEnv {
  // API Configuration
  readonly VITE_API_URL: string;
  readonly VITE_API_TIMEOUT: string;

  // Authentication
  readonly VITE_GOOGLE_CLIENT_ID: string;

  // Auth0 Configuration
  readonly VITE_AUTH0_DOMAIN?: string;
  readonly VITE_AUTH0_CLIENT_ID?: string;
  readonly VITE_AUTH0_AUDIENCE?: string;
  readonly VITE_AUTH0_ENABLED?: string;

  // Application Configuration
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_APP_ENV: 'development' | 'staging' | 'production';

  // Feature Flags
  readonly VITE_ENABLE_MOCK_DATA: string;
  readonly VITE_ENABLE_DEVTOOLS: string;
  readonly VITE_ENABLE_DEBUG_MODE: string;
  readonly VITE_ENABLE_ANALYTICS: string;

  // API Retry Configuration (Optional)
  readonly VITE_API_RETRY_MAX?: string;
  readonly VITE_API_RETRY_BASE_DELAY?: string;
  readonly VITE_API_RETRY_MAX_DELAY?: string;

  // Development Settings (Optional)
  readonly VITE_PORT?: string;
  readonly VITE_HOST?: string;

  // Third-Party Services (Optional)
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_GA_ID?: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;

  // PostHog Analytics
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
  readonly VITE_ENVIRONMENT?: 'development' | 'staging' | 'production' | 'test';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// This export is required to avoid unused variable error
export type { ImportMeta };

// Declare global types for the app
declare global {
  // Extend Window for E2E testing
  interface Window {
    playwright?: boolean;
  }

  // App configuration type
  interface AppConfig {
    apiUrl: string;
    apiTimeout: number;
    googleClientId: string;
    appName: string;
    appVersion: string;
    appEnv: 'development' | 'staging' | 'production';
    features: {
      mockData: boolean;
      devTools: boolean;
      debugMode: boolean;
      analytics: boolean;
    };
    retry: {
      maxRetries: number;
      baseDelayMs: number;
      maxDelayMs: number;
    };
  }
}

export {};
