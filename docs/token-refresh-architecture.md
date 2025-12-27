# Token Refresh Architecture

## Philosophy

> "401 is an error which should be investigated, not noise to be hidden"

Our authentication system uses **proactive token refresh** to prevent 401 errors, rather than hiding or suppressing them. When you see a 401 error after this fix, it indicates a real problem that needs investigation.

## The Problem (Before This Fix)

When users returned to an inactive browser tab after their access token expired, multiple concurrent API requests would be made simultaneously:
- Notifications fetch
- XP stats fetch
- Achievements check
- etc.

Each of these requests would receive a 401 error and attempt to refresh the token. With **token rotation** (refresh tokens are single-use), only the first refresh succeeded - subsequent attempts failed because the old refresh token was already consumed. This caused cascading auth failures and unexpected logouts.

## The Solution: Proactive Refresh

Instead of waiting for 401 errors and reacting to them, we now **proactively refresh** tokens BEFORE they expire:

1. **Before each API request**, check if the access token expires within 5 minutes
2. **If expiring soon**, refresh the token BEFORE making the request
3. **Use the fresh token** for the actual request
4. **Result**: 401s never happen in normal operation

## Key Components

| File | Purpose |
|------|---------|
| `src/lib/tokenUtils.ts` | Token expiry utilities (`decodeJWT`, `isTokenExpired`, `shouldRefreshToken`) |
| `src/services/api.ts` | Proactive refresh integration in API client |
| `src/stores/authStore.ts` | Token state management |

### tokenUtils.ts

```typescript
// Check if token should be proactively refreshed
export function shouldRefreshToken(token: string | null): boolean {
  if (!token) return false;
  return isTokenExpired(token, DEFAULT_REFRESH_BUFFER_SECONDS); // 300 seconds = 5 min
}
```

### api.ts (Request Function)

```typescript
// PROACTIVE REFRESH: Check if token is expired or expiring soon
if (accessToken && shouldRefreshToken(accessToken)) {
  log.debug('Token expiring soon, proactively refreshing');
  const newToken = await refreshAccessToken();
  if (newToken) {
    accessToken = newToken;
  }
}
```

## Token Expiry Buffer

The default refresh buffer is **5 minutes** (`DEFAULT_REFRESH_BUFFER_SECONDS = 300`).

This means:
- Token valid for 20 min? No refresh needed
- Token valid for 4 min? Proactive refresh triggered
- Token already expired? Proactive refresh triggered

## Mutex for Race Conditions

Even with proactive refresh, concurrent requests might still try to refresh simultaneously. We use a **singleton promise pattern** to ensure only ONE refresh request is ever in flight:

```typescript
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  // If a refresh is already in progress, wait for it
  if (refreshPromise) {
    return refreshPromise;
  }

  // Start a new refresh operation
  refreshPromise = performTokenRefresh();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}
```

## When 401s Should Occur

After this fix, a 401 error indicates a **real problem**:

| Scenario | What It Means |
|----------|---------------|
| Token revoked by server | User was logged out intentionally (password change, security) |
| Security breach detected | Backend invalidated all tokens for the user |
| Bug in refresh mechanism | Something failed that shouldn't have |
| Invalid token format | Token was corrupted or tampered with |

These should be logged as ERROR and investigated - they are no longer expected behavior.

## Testing

### Unit Tests

- `src/lib/__tests__/tokenUtils.test.ts` - 35+ tests for expiry logic
  - JWT decoding (valid, invalid, malformed)
  - Expiry detection with buffer
  - Edge cases (null, undefined, invalid format)

- `src/services/__tests__/api.test.ts` - Proactive refresh + mutex tests
  - Proactive refresh triggers before API call
  - Mutex prevents concurrent refresh attempts
  - Refresh failure handling

### E2E Tests

- `tests/e2e/auth-token-refresh.spec.ts` - Tab wake scenario verification
  - Expired token triggers proactive refresh with zero 401s
  - Invalid tokens still redirect to login
  - Fresh tokens don't trigger unnecessary refresh
  - Tab wake scenario produces zero 401s

## Debugging

If you're investigating authentication issues:

1. **Check browser console** for proactive refresh logs:
   ```
   Token expiring soon, proactively refreshing
   Proactive token refresh successful
   ```

2. **Check network tab** for refresh requests:
   - Should see `/api/v1/auth/refresh` BEFORE regular API calls
   - Should NOT see 401 responses followed by refresh

3. **If you see 401 errors**, something is actually wrong:
   - Check if refresh token was valid
   - Check if backend invalidated the token
   - Check for network issues during refresh

## Related

- [PR #113: Token Refresh Race Condition Fix](https://github.com/SimonOsipov/learn-greek-easy/pull/113)
