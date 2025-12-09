# Making Backend Private in Production Railway Environment

## Overview

This document describes the process of securing the backend service in the production Railway environment by removing its public domain and making it accessible only through Railway's private network.

## Problem Statement

Both Frontend and Backend services are currently publicly exposed in production. The backend should only be accessible via Railway's private network through the frontend nginx proxy.

**Current State**:
- Frontend: `https://learn-greek-frontend.up.railway.app` (PUBLIC ✓)
- Backend: `https://learn-greek-backend.up.railway.app` (PUBLIC ✗ - SECURITY ISSUE)

**Target State**:
- Frontend: `https://learn-greek-frontend.up.railway.app` (PUBLIC ✓)
- Backend: PRIVATE - accessible only as `http://backend:8000` via Railway internal network

## Implementation Steps

### Step 1: Document Current Configuration

Before making changes, document the current state for rollback if needed:

1. Log into [Railway Dashboard](https://railway.app/dashboard)
2. Navigate to **Production** environment
3. Document the current backend public domain URL
4. Take a screenshot of the "Public Networking" section
5. Verify frontend `BACKEND_URL` is set to `http://backend:8000` (internal)

**Configuration to verify**:
- Frontend service: `BACKEND_URL=http://backend:8000`
- Backend service: Current `CORS_ORIGINS` value

### Step 2: Update Backend CORS Configuration

Configure the backend to accept only the production frontend origin:

1. Navigate to: **Railway Dashboard** → **Production Environment** → **Backend Service** → **Variables**
2. Update or add environment variable:
   - **Variable**: `CORS_ORIGINS`
   - **Value**: `https://learn-greek-frontend.up.railway.app`
3. Save changes (this will trigger a redeployment)
4. Wait for backend service to redeploy successfully

**Note**: The backend CORS configuration in `src/config.py` supports both JSON array format and comma-separated values. For a single origin, the simple string format works.

### Step 3: Remove Backend Public Domain (Production Only)

Make the backend accessible only via Railway private network:

#### Option A: Railway Dashboard (Recommended)

1. Navigate to: **Railway Dashboard** → **Production Environment** → **Backend Service** → **Settings**
2. Scroll to the **Public Networking** section
3. Click **Remove Domain** button
4. Confirm the removal

#### Option B: Railway CLI (Alternative)

```bash
# Link to production backend
railway link --environment production --service Backend

# Remove the public domain
railway domain --remove
```

**Important**: Only remove the domain from the **production** environment. Leave dev/preview environments unchanged.

### Step 4: Verify Configuration

After removing the backend public domain, verify the setup:

#### Test Frontend-to-Backend Communication

Frontend proxy should work:
```bash
curl https://learn-greek-frontend.up.railway.app/api/health
# Expected: 200 OK with health status JSON
```

Direct backend access should fail:
```bash
curl https://learn-greek-backend.up.railway.app/health
# Expected: Connection refused or 404 error
```

API documentation should work through frontend:
```bash
# Open in browser:
https://learn-greek-frontend.up.railway.app/docs
# Expected: Swagger UI loads successfully
```

#### End-to-End Testing

1. Open browser to `https://learn-greek-frontend.up.railway.app`
2. Open browser DevTools → **Network** tab
3. Test user flows:
   - Register/Login functionality
   - Load decks list
   - Load cards
   - Complete a quiz session
4. Monitor Network tab for any CORS errors
5. Verify all `/api/*` requests return successfully

**Success criteria**:
- No CORS errors in browser console
- All API calls succeed with 2xx status codes
- API documentation accessible via frontend

### Step 5: Verify Preview Environments Unchanged

Confirm dev/preview environments still have public backends for testing:

1. Create a test PR or check existing PR preview environment
2. Verify backend service has a public domain in the preview environment
3. Test direct backend access in preview (should work):
```bash
curl https://[preview-backend-url]/health
# Expected: 200 OK
```

### Step 6: Monitor Production

Watch for any errors after configuration change:

1. Monitor backend logs in Railway Dashboard for 5-10 minutes
2. Watch for connection errors or CORS violations
3. Check Railway deployment status remains "Active"
4. Verify no spike in error rates

**Railway Dashboard Path**: Production Environment → Backend Service → Logs

## Rollback Procedure

If issues occur, restore the public backend domain:

### Using Railway Dashboard

1. Navigate to: **Railway Dashboard** → **Production** → **Backend Service** → **Settings** → **Public Networking**
2. Click **Generate Domain**
3. Copy the generated domain URL
4. If needed, update frontend temporarily:
   - Navigate to Frontend Service → Variables
   - Update `BACKEND_URL` to the new public backend domain
5. Verify health check: `curl https://[frontend-url]/api/health`

### Using Railway CLI

```bash
# Link to production backend
railway link --environment production --service Backend

# Generate new public domain
railway domain

# If needed, update frontend BACKEND_URL
railway link --environment production --service Frontend
railway variables --set "BACKEND_URL=https://[new-backend-domain]"
```

## Security Benefits

1. **Eliminates direct backend access** in production
2. **Reduces attack surface** - backend not publicly discoverable
3. **Enforces gateway pattern** - all requests via frontend
4. **CORS defense-in-depth** - blocks unauthorized origins even if accessible
5. **Maintains dev flexibility** - preview environments unchanged

## Technical Details

### Existing Configuration (Already Correct)

The following configurations are already in place and require no changes:

**Frontend nginx proxy** (`learn-greek-easy-frontend/nginx.conf.template`):
```nginx
location /api {
    proxy_pass ${BACKEND_URL};  # Set to http://backend:8000
}
```

**Frontend Dockerfile** (sets internal URL):
```dockerfile
ENV BACKEND_URL=http://backend:8000
```

**Backend CORS** (`src/config.py`):
- Validates origins via `cors_origins` configuration
- Supports both JSON array and comma-separated string formats
- Includes production validation warnings

### Railway Private Networking

Railway services can reference each other by service name (e.g., `http://backend:8000`) without public domains. This is Railway's built-in private networking feature.

**Network Flow After Implementation**:
```
Production:
User → Frontend (public) → nginx proxy /api → Backend (private via http://backend:8000)

Dev/PR Preview (unchanged):
User → Frontend (public)
User → Backend (public) ✓ OK for testing
```

## Verification Checklist

Before considering the task complete, verify:

- [ ] Backend has no public domain in production (Railway Dashboard shows "No public domain")
- [ ] Frontend → Backend communication works via private network
- [ ] Direct backend access fails (connection refused)
- [ ] All API endpoints work through `/api/*` proxy
- [ ] API docs accessible at `/docs` and `/redoc`
- [ ] CORS configured for production frontend only
- [ ] No CORS errors in browser console
- [ ] Preview environments unchanged (still have public backends)
- [ ] Rollback procedure documented and accessible
- [ ] Production logs show no errors

## References

- [Railway Private Networking Documentation](https://docs.railway.app/reference/private-networking)
- [Railway Public Networking Documentation](https://docs.railway.app/reference/public-networking)
- [Backend CORS Configuration](../learn-greek-easy-backend/src/config.py)
- [Frontend nginx Configuration](../learn-greek-easy-frontend/nginx.conf.template)

## Risk Assessment

- **Risk Level**: Low
- **Reversibility**: High (can regenerate public domain anytime)
- **Code Changes**: None (Railway configuration only)
- **Impact**: Production only (dev/preview environments unchanged)

## Notes

- This is a Railway configuration-only task (no code deployment required)
- Frontend nginx proxy already configured correctly
- Backend CORS validation already implemented
- Changes are easily reversible - can regenerate domain anytime
- Only affects production environment - dev/preview unchanged
- The `CORS_ORIGINS` environment variable must be set before removing the public domain
