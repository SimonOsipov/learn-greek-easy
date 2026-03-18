# Authentication Architecture

## Overview

Learn Greek Easy uses **Supabase Auth** for authentication. Token refresh is handled entirely by the Supabase JS SDK — there is no custom refresh logic.

```
User → Supabase Auth (login) → Access Token (JWT, ES256)
                                    ↓
Frontend (api.ts) → supabase.auth.getSession() → Bearer token → Backend
                                                                    ↓
                                                        JWKS verification (ES256)
                                                        Auto-provision user if new
```

## Frontend

### Token Acquisition

Every API request gets a fresh token from the Supabase session (`api.ts`):

```typescript
const { data: { session } } = await supabase.auth.getSession();
const accessToken = session?.access_token ?? null;

if (accessToken) {
  headers['Authorization'] = `Bearer ${accessToken}`;
}
```

The Supabase SDK handles token refresh transparently — when `getSession()` is called and the access token is expired, the SDK uses the refresh token (stored in localStorage) to obtain a new one silently.

### Supabase Client

Initialized in `src/lib/supabaseClient.ts` with project URL and anon key from environment variables. No custom configuration.

### Auth Store (`authStore.ts`)

Manages user profile state via Zustand (persisted to localStorage):
- `user` — cached user profile from backend `/api/v1/auth/me`
- `isAuthenticated` — boolean
- `isLoading` / `isProfileUpdating` — loading states
- `error` — auth error state

**Does NOT store tokens** — tokens are entirely managed by the Supabase SDK.

Key actions:
- `checkAuth()` — called on app load, fetches profile from `/api/v1/auth/me`
- `logout()` — calls `supabase.auth.signOut({ scope: 'local' })`, clears state
- `updatePassword()` — calls `supabase.auth.updateUser({ password })`

### 401 Handling

401 is treated as a permanent failure — no retry, no automatic refresh:

```typescript
if (response.status === 401 && !skipAuth) {
  throw new APIRequestError({
    status: 401,
    message: 'Session expired. Please log in again.',
  });
}
```

If the Supabase SDK's refresh also failed (expired refresh token, revoked session), the user must re-login.

### Transient Error Retry (`retryUtils.ts`)

Only **502, 503, 504** errors and network failures are retried:
- 3 attempts with exponential backoff
- Base delay: 1000ms, max delay: 10,000ms
- 0-25% jitter

### Stale Client Detection (`versionCheck.ts`)

On every successful API response:
1. Reads `X-App-Version` header from backend
2. Compares with `VITE_COMMIT_SHA` (set at build time)
3. On mismatch: clears service worker caches, reloads page (60-second cooldown)

## Backend

### Token Validation (`supabase_auth.py`)

Tokens are validated via JWKS with ES256 (ECDSA P-256):

1. **JWKS Fetch & Caching** — public keys fetched from Supabase's JWKS endpoint, cached for 1 hour
2. **Token Decode** — validates `iss` (issuer), `aud` ("authenticated"), `exp` (expiry), `sub` (user UUID)
3. **Key Rotation Retry** — if signature fails with cached keys, invalidates cache and retries once with fresh JWKS

Error mapping:
- Expired token → `TokenExpiredException` (401)
- Bad signature / invalid claims → `TokenInvalidException` (401)

### Auth Dependency (`dependencies.py`)

`get_current_user` dependency:
1. Extracts Bearer token from `Authorization` header
2. Verifies with `verify_supabase_token(token)`
3. Auto-provisions user via `get_or_create_user()` — creates `User` + `UserSettings` on first login
4. Sets Sentry + logging context
5. Returns `User` object

New users get a 14-day trial automatically.

### Auth Endpoints (`auth.py`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/auth/me` | GET | Fetch current user profile + settings |
| `/api/v1/auth/me` | PATCH | Update profile or settings |
| `/api/v1/auth/logout` | POST | Client-side logout acknowledgment |
| `/api/v1/auth/logout-all` | POST | Multi-session logout |
| `/api/v1/auth/avatar/upload-url` | POST | Generate presigned S3 URL for avatar |
| `/api/v1/auth/avatar` | DELETE | Remove avatar |

**No refresh endpoint** — all token refresh is delegated to the Supabase SDK client-side.

## Key Files

| File | Purpose |
|------|---------|
| `frontend/src/services/api.ts` | HTTP client, token injection, 401 handling, retry, version check |
| `frontend/src/lib/supabaseClient.ts` | Supabase SDK initialization |
| `frontend/src/stores/authStore.ts` | Auth state (user profile, not tokens) |
| `frontend/src/lib/retryUtils.ts` | Exponential backoff for transient errors |
| `frontend/src/lib/versionCheck.ts` | Stale client detection via X-App-Version |
| `backend/src/core/supabase_auth.py` | JWKS caching, JWT validation, ES256 verification |
| `backend/src/core/dependencies.py` | `get_current_user` dependency, auto-provisioning |
| `backend/src/api/v1/auth.py` | Auth routes (profile, logout, avatar) |

## Dead Code Note

`frontend/src/lib/tokenUtils.ts` contains `decodeJWT`, `isTokenExpired`, and `shouldRefreshToken` functions from the pre-Supabase custom auth system. These are **not imported by any production code** and should be removed.
