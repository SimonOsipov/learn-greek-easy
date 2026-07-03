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

### Auth-path caching (PERF-16)

Two Redis-backed caches sit on the hot path, both prefixed `cache:` at rest and both routed through `CacheService.get_or_set`'s single-flight guard (an atomic `SET NX PX` lock, `cache_single_flight_lock_ttl_ms`=5000 / `cache_single_flight_poll_ms`=50) so N concurrent cold misses run the loader once each — followers poll briefly, then self-serve if the lock holder doesn't finish in time. Degrades to a direct (uncached) load if Redis is unreachable.

| Key | Contents | TTL (config field) |
|-----|----------|---------------------|
| `user:identity:{supabase_id}` | Identity projection `{id, is_active, is_superuser}` used by `get_or_create_user` to skip the `supabase_id` SELECT | `cache_user_identity_ttl` = 900s |
| `user:me:{user_id}` | Full `GET /auth/me` response body (`model_dump(mode="json")`) | `cache_auth_me_body_ttl` = 120s |

**Invalidation** — one helper, `CacheService.invalidate_user_identity(supabase_id, user_id)`, busts both keys (never raises; each delete is individually guarded/logged). Called from every write path that can change a user's identity projection or `/auth/me` body:

- Profile `PATCH /auth/me` and avatar delete (`auth.py`)
- JWT-driven email reconciliation on login (`dependencies.py`)
- The 3 in-request billing endpoints — change-plan, cancel, reactivate (`billing.py`)
- The 6 Stripe webhook handlers, via the `WebhookService.process_event` choke point — fires once per event on **both** the handler-success path and the handler-raised path (the `except` block doesn't re-raise; a partially-committed mutation must still bust the cache)
- Account deletion (`user_deletion_service.py`) and `UserRepository.deactivate` (soft-delete)

**Correctness notes:**
- A warm `user:identity` hit still re-reads the row via `db.get()` in `get_or_create_user`, so `is_active` and subscription state are re-checked on every request — the cache only skips the `supabase_id` lookup SELECT, it never drives an access decision. Deactivation is enforced per-request and is **not** TTL-dependent.
- The `/auth/me` body cache is display-only.
- One out-of-band writer is intentionally **not** hooked: the daily `trial_expiration_task` cron bulk-updates `subscription_status` (TRIALING→NONE) via a raw SQL UPDATE that bypasses the ORM. Its cache impact is nil — `effective_role` is already computed from the live `trial_end_date` (not the cached status), so a post-expiry request already resolves to FREE. This accepts a bounded ≤120s display-only `effective_role` staleness at the wall-clock trial boundary (D-16).

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
