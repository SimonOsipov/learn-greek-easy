# Auth Setup — OAuth Redirect Configuration

## App Scheme

The app uses the scheme `learngreekeasymobile` (defined in `app.config.ts`).

The OAuth flow (AUTH-07) builds its redirect URI via `expo-auth-session`'s `makeRedirectUri()`.
For a dev-client or standalone build this resolves to the scheme-based URL:

```text
learngreekeasymobile://
```

This value must be allow-listed in the Supabase dashboard for each project.

> **Note:** The Supabase URL and anon key are no longer committed in `app.config.ts`.
> They are provided via env vars (`SUPABASE_URL` / `SUPABASE_ANON_KEY`) — see
> [docs/mobile-app.md](../../docs/mobile-app.md) for setup instructions (EAS env vars
> for cloud builds; a local `.env` for dev).

---

## Manual Step 1 — Supabase Dashboard: Add Redirect URL

For **both** Supabase projects, navigate to:

**Auth → URL Configuration → Redirect URLs**

Add `learngreekeasymobile://` to the allow-list.

| Variant | Project ref | Supabase project |
|---------|-------------|-----------------|
| `development` + `preview` | `nyiyljmtbnvykbpdjfjq` | DEV |
| `production` | `qduwfsuybkqsginndguz` | PROD |

Dashboard URLs:
- DEV: `https://supabase.com/dashboard/project/nyiyljmtbnvykbpdjfjq/auth/url-configuration`
- PROD: `https://supabase.com/dashboard/project/qduwfsuybkqsginndguz/auth/url-configuration`

> **Note:** There is no MCP or API for Supabase Auth URL configuration — this must be done manually. Record completion in the PR description.

---

## Manual Step 2 — Google Cloud Console: OAuth Redirect URI Chain

Google redirects to Supabase's callback endpoint, which then redirects to the app scheme. The app scheme redirect is handled entirely in Supabase (step 1 above). What must be present in the **Google Cloud Console → OAuth client → Authorized redirect URIs** are Supabase's own callback URLs:

- `https://nyiyljmtbnvykbpdjfjq.supabase.co/auth/v1/callback` (DEV project)
- `https://qduwfsuybkqsginndguz.supabase.co/auth/v1/callback` (PROD project)

These should already be set from the web app OAuth setup. Verify they are present before testing mobile Google sign-in.

---

## Deferred: Scheme Rename to `greeklish`

Renaming the scheme from `learngreekeasymobile` to `greeklish` is **out of scope for MOB-03**. It requires an atomic change across:

1. `app.config.ts` — update `scheme`
2. Supabase Redirect URL allow-list (both projects) — replace `learngreekeasymobile://` with `greeklish://`
3. Google Cloud Console — no change needed (Google → Supabase flow is unaffected)

All three must be changed together; do not rename the scheme in isolation.
