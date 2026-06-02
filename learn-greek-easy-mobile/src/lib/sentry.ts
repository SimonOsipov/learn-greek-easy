import * as Sentry from '@sentry/react-native';
import type { ErrorEvent } from '@sentry/react-native';

import { getSentryConfig } from '@/lib/config';
import { scrubPii } from './analytics/scrub';

let initialized = false;

function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  // Scrub request headers and data
  if (event.request) {
    if (event.request.headers) {
      delete event.request.headers['Authorization'];
      delete event.request.headers['authorization'];
    }
    delete event.request.data;
    event.request = scrubPii(event.request) as typeof event.request;
  }

  // Scrub contexts
  if (event.contexts) {
    event.contexts = scrubPii(event.contexts) as typeof event.contexts;
  }

  // Scrub extra
  if (event.extra) {
    event.extra = scrubPii(event.extra) as typeof event.extra;
  }

  // Scrub tags
  if (event.tags) {
    event.tags = scrubPii(event.tags) as typeof event.tags;
  }

  // Scrub breadcrumbs
  if (event.breadcrumbs) {
    for (const breadcrumb of event.breadcrumbs) {
      if (breadcrumb.data) {
        delete breadcrumb.data['body'];
        delete breadcrumb.data['request_body'];
        breadcrumb.data = scrubPii(breadcrumb.data) as typeof breadcrumb.data;
      }
    }
  }

  return event;
}

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
    beforeSend: scrubSentryEvent,
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
