/**
 * Environment variable utilities
 */

/**
 * Get an environment variable with type safety
 */
// eslint-disable-next-line no-undef
export function getEnv(key: keyof ImportMetaEnv): string {
  return import.meta.env[key] || '';
}

/**
 * Check if a required environment variable is set
 */
// eslint-disable-next-line no-undef
export function requireEnv(key: keyof ImportMetaEnv): string {
  const value = getEnv(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get an environment variable as a boolean
 */
// eslint-disable-next-line no-undef
export function getEnvBoolean(key: keyof ImportMetaEnv, defaultValue = false): boolean {
  const value = getEnv(key);
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Get an environment variable as a number
 */
// eslint-disable-next-line no-undef
export function getEnvNumber(key: keyof ImportMetaEnv, defaultValue: number): number {
  const value = getEnv(key);
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Check if we're in a specific environment
 */
export function isEnvironment(env: 'development' | 'staging' | 'production'): boolean {
  return import.meta.env.VITE_APP_ENV === env;
}

/**
 * Get the current environment
 */
export function getEnvironment(): 'development' | 'staging' | 'production' {
  return (import.meta.env.VITE_APP_ENV || 'development') as
    | 'development'
    | 'staging'
    | 'production';
}

/**
 * Log only in development mode
 */
export function devLog(...args: unknown[]): void {
  if (isEnvironment('development') && getEnvBoolean('VITE_ENABLE_DEBUG_MODE')) {
    // eslint-disable-next-line no-console
    console.log('[DEV]', ...args);
  }
}

/**
 * Warn only in development mode
 */
export function devWarn(...args: unknown[]): void {
  if (isEnvironment('development')) {
    console.warn('[DEV WARNING]', ...args);
  }
}

/**
 * Error with context
 */
export function devError(message: string, error?: unknown): void {
  console.error(`[ERROR] ${message}`, error);

  // In production, you might want to send to error tracking service
  if (isEnvironment('production') && import.meta.env.VITE_SENTRY_DSN) {
    // Send to Sentry or other error tracking service
  }
}
