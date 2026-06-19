/**
 * Version Check Utility
 *
 * Detects stale clients by comparing the frontend's build-time commit SHA
 * with the backend's X-App-Version response header.
 *
 * When versions mismatch, the client is running outdated code (e.g., user
 * left a tab open overnight while a deployment occurred) and needs to refresh.
 *
 * Features:
 * - Compares VITE_COMMIT_SHA with X-App-Version header
 * - Skips check in development mode (either side is "dev")
 * - 60-second cooldown prevents refresh loops
 * - Per-pair refresh cap (CAP_MAX) stops reload loops on persistent skew
 * - Clears service worker caches before refresh
 */

import log from '@/lib/logger';

/** Storage key for tracking last refresh timestamp */
const LAST_REFRESH_KEY = 'learn-greek-easy:last-version-refresh';

/** Storage key prefix for per-pair refresh count */
const CAP_COUNT_KEY_PREFIX = 'learn-greek-easy:version-refresh-cap:';

/** Storage key prefix for per-pair "already warned" flag */
const CAP_WARNED_KEY_PREFIX = 'learn-greek-easy:version-refresh-cap-warned:';

/** Maximum refreshes allowed for a single (frontend, backend) SHA pair */
const CAP_MAX = 3;

/** Minimum seconds between version-triggered refreshes */
const REFRESH_COOLDOWN_SECONDS = 60;

/** Frontend commit SHA from build time */
const FRONTEND_VERSION = import.meta.env.VITE_COMMIT_SHA || 'dev';

/**
 * Check if the response indicates a version mismatch and refresh if needed.
 *
 * Should be called after every successful API response. Compares the
 * X-App-Version header with the frontend's build-time version.
 *
 * @param response - The fetch Response object from an API call
 * @returns true if versions match (or check was skipped), false if refresh was triggered
 *
 * @example
 * ```ts
 * const response = await fetch('/api/v1/data');
 * checkVersionAndRefreshIfNeeded(response);
 * return response.json();
 * ```
 */
export function checkVersionAndRefreshIfNeeded(response: Response): boolean {
  // Safely get the header - handle mock responses that may not have headers
  let backendVersion: string | null = null;
  try {
    backendVersion = response.headers?.get?.('X-App-Version') ?? null;
  } catch {
    // Mock responses or malformed Response objects - skip check
    return true;
  }

  // Skip if header is missing (older backend, or non-API response)
  if (!backendVersion) {
    return true;
  }

  // Skip the check when either side is a 'dev' build — a 'dev' version can never
  // be meaningfully compared to a real commit SHA (would loop forever otherwise).
  if (FRONTEND_VERSION === 'dev' || backendVersion === 'dev') {
    return true;
  }

  // Check for version mismatch
  if (FRONTEND_VERSION !== backendVersion) {
    log.info('Version mismatch detected', {
      frontendVersion: FRONTEND_VERSION,
      backendVersion,
    });

    // Check per-pair refresh cap — hard stop for persistent skew.
    // Must be checked before cooldown so the cap fires even when cooldown is reset.
    //
    // sessionStorage access is wrapped in try/catch: in private-browsing mode
    // (or when storage quota is exceeded) sessionStorage can throw SecurityError.
    // On storage failure we degrade safely — skip the refresh (can't track state)
    // to avoid an unguarded reload loop.
    try {
      const capKey = `${CAP_COUNT_KEY_PREFIX}${FRONTEND_VERSION}:${backendVersion}`;
      const warnedKey = `${CAP_WARNED_KEY_PREFIX}${FRONTEND_VERSION}:${backendVersion}`;
      const currentCount = parseInt(sessionStorage.getItem(capKey) ?? '0', 10);

      if (currentCount >= CAP_MAX) {
        // Already hit the cap for this pair. Warn once, then give up.
        if (!sessionStorage.getItem(warnedKey)) {
          log.warn(
            'Version mismatch persists after max refreshes — giving up to avoid reload loop',
            {
              frontendVersion: FRONTEND_VERSION,
              backendVersion,
              refreshCount: currentCount,
            }
          );
          sessionStorage.setItem(warnedKey, '1');
        }
        return false;
      }

      // Check cooldown to prevent refresh loops
      if (!isRefreshAllowed()) {
        log.warn('Version mismatch but refresh cooldown active, skipping refresh');
        return false;
      }

      // Increment per-pair count before triggering refresh
      sessionStorage.setItem(capKey, (currentCount + 1).toString());
    } catch {
      // sessionStorage unavailable (private-mode, quota exceeded).
      // Skip the refresh — we cannot track cooldown or cap state, so reloading
      // would risk an unguarded loop.
      log.warn('Version check storage unavailable, skipping refresh to avoid reload loop');
      return false;
    }

    // Trigger refresh
    triggerVersionRefresh();
    return false;
  }

  return true;
}

/**
 * Check if enough time has passed since the last version-triggered refresh.
 *
 * Prevents refresh loops where the cache isn't properly cleared or the
 * version header is stale.
 *
 * @returns true if refresh is allowed, false if within cooldown period
 */
export function isRefreshAllowed(): boolean {
  const lastRefresh = sessionStorage.getItem(LAST_REFRESH_KEY);

  if (!lastRefresh) {
    return true;
  }

  const lastRefreshTime = parseInt(lastRefresh, 10);
  const now = Date.now();
  const elapsedSeconds = (now - lastRefreshTime) / 1000;

  return elapsedSeconds >= REFRESH_COOLDOWN_SECONDS;
}

/**
 * Clear caches and trigger a page refresh.
 *
 * Records the refresh timestamp to enable cooldown tracking, clears
 * service worker caches if available, then reloads the page.
 */
export function triggerVersionRefresh(): void {
  log.info('Triggering version refresh');

  // Record refresh timestamp before clearing anything
  sessionStorage.setItem(LAST_REFRESH_KEY, Date.now().toString());

  // Clear service worker caches if available
  if (typeof caches !== 'undefined') {
    caches
      .keys()
      .then((names) => {
        return Promise.all(names.map((name) => caches.delete(name)));
      })
      .then(() => {
        log.info('Cleared service worker caches');
        window.location.reload();
      })
      .catch((error) => {
        log.error('Failed to clear caches', { error });
        // Reload anyway
        window.location.reload();
      });
  } else {
    // No service worker caches, just reload
    window.location.reload();
  }
}

/**
 * Get the current frontend version.
 *
 * Useful for logging and debugging.
 *
 * @returns The frontend commit SHA or "dev" for local development
 */
export function getFrontendVersion(): string {
  return FRONTEND_VERSION;
}

/**
 * Reset the refresh cooldown.
 *
 * FOR TESTING ONLY. Clears the last refresh timestamp from sessionStorage.
 */
export function _resetRefreshCooldown_forTesting(): void {
  sessionStorage.removeItem(LAST_REFRESH_KEY);
}
