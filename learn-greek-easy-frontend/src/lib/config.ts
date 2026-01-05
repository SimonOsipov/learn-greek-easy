/**
 * Application configuration loaded from environment variables
 */

import log from './logger';

// Parse boolean environment variables
const parseBoolean = (value: string | undefined): boolean => {
  return value === 'true';
};

// Parse number environment variables
const parseNumber = (value: string | undefined, defaultValue: number): number => {
  const parsed = parseInt(value || '', 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Create the application config object
// eslint-disable-next-line no-undef
export const config: AppConfig = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  apiTimeout: parseNumber(import.meta.env.VITE_API_TIMEOUT, 30000),
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  appName: import.meta.env.VITE_APP_NAME || 'Learn Greek Easy',
  appVersion: import.meta.env.VITE_APP_VERSION || '0.1.0',
  appEnv: (import.meta.env.VITE_APP_ENV || 'development') as
    | 'development'
    | 'staging'
    | 'production',
  features: {
    mockData: parseBoolean(import.meta.env.VITE_ENABLE_MOCK_DATA),
    devTools: parseBoolean(import.meta.env.VITE_ENABLE_DEVTOOLS),
    debugMode: parseBoolean(import.meta.env.VITE_ENABLE_DEBUG_MODE),
    analytics: parseBoolean(import.meta.env.VITE_ENABLE_ANALYTICS),
  },
  retry: {
    maxRetries: parseNumber(import.meta.env.VITE_API_RETRY_MAX, 3),
    baseDelayMs: parseNumber(import.meta.env.VITE_API_RETRY_BASE_DELAY, 1000),
    maxDelayMs: parseNumber(import.meta.env.VITE_API_RETRY_MAX_DELAY, 10000),
  },
};

// Development environment check
export const isDevelopment = config.appEnv === 'development';
export const isStaging = config.appEnv === 'staging';
export const isProduction = config.appEnv === 'production';

// Feature flag helpers
export const isDebugMode = config.features.debugMode;
export const isMockDataEnabled = config.features.mockData;
export const isDevToolsEnabled = config.features.devTools;
export const isAnalyticsEnabled = config.features.analytics;

// Validate required configuration in production
if (isProduction) {
  const requiredFields = [
    { key: 'apiUrl', value: config.apiUrl },
    { key: 'googleClientId', value: config.googleClientId },
  ];

  const missingFields = requiredFields.filter((field) => !field.value).map((field) => field.key);

  if (missingFields.length > 0) {
    log.error(`Missing required configuration fields: ${missingFields.join(', ')}`);
  }
}

// Debug logging
if (isDebugMode) {
  log.debug('App Configuration:', config);
  log.debug('Environment:', config.appEnv);
  log.debug('Feature Flags:', config.features);
}

// Export a function to get config values with type safety
// eslint-disable-next-line no-undef
export function getConfig<K extends keyof AppConfig>(key: K): AppConfig[K] {
  return config[key];
}
