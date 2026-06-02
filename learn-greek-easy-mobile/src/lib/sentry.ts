import * as Sentry from '@sentry/react-native';
import { getSentryConfig } from '@/lib/config';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  let dsn: string | undefined;
  let environment: string | undefined;
  try {
    const cfg = getSentryConfig();
    dsn = cfg?.dsn;
    environment = cfg?.environment;
  } catch {
    return; // no config available -> silent no-op
  }
  if (!dsn) return; // Expo Go / missing DSN -> silent no-op

  Sentry.init({
    dsn,
    environment,
    sendDefaultPii: false,
    enableNative: true,
    tracesSampleRate: 0.2,
    // release/dist intentionally omitted: the native SDK auto-detects them
    // from the native app version/build, and the @sentry/react-native/expo
    // config plugin uploads source maps keyed to those same auto-detected
    // values. Setting them manually in JS risks a release mismatch that makes
    // source-mapped stack traces fail — the core deliverable of this task.
  });
  initialized = true;
}

export function captureException(error: unknown): void {
  Sentry.captureException(error);
}

export function setSentryUser(userId: string | null): void {
  Sentry.setUser(userId ? { id: userId } : null); // id only, never email/username/PII
}
