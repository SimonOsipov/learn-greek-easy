# Mobile Observability

This document covers the Sentry (error tracking) and PostHog (analytics) integration
for the Greeklish mobile app.

---

## Sentry

- **Org slug**: `greekly` (region: `de.sentry.io`)
- **Project**: `greeklish-mobile` (platform: `react-native`)

> Note: the org slug stays `greekly` (legacy) while the project uses the current
> brand name `greeklish-`. This inconsistency is accepted — do not rename the org.

### DSN

**TODO (ops)**: Create the `greeklish-mobile` project manually in the `greekly` Sentry
org — there is no API/MCP path to create Sentry projects. Once created, copy the DSN
from *Project Settings → Client Keys (DSN)* and provision it as an EAS server-side
environment variable (see §EAS env vars below).

The DSN is intentionally absent from this file. Do NOT commit it.

### Environment tag

`APP_VARIANT` drives `variant` in `app.config.ts`, which is surfaced as `environment`
in `extra`. `getSentryConfig()` reads that value, so the Sentry `environment` tag is
automatically `development`, `preview`, or `production` per EAS build profile.

---

## PostHog

- **Org**: Learn Greek Easy
- **Project**: Greekly (id: `108020`)
- **Host**: `https://eu.i.posthog.com` (EU region — project 108020 ingests to EU; matches the web `VITE_POSTHOG_HOST`)

The default host is applied by `getPostHogConfig()` in `src/lib/config.ts` when
`POSTHOG_HOST` is not set. Pass `process.env.POSTHOG_HOST` through `app.config.ts`
raw so the default lives in one place (the helper), not two.

---

## EAS environment variables

Provision the following as **EAS server-side env vars** scoped per build profile
(development / preview / production). Do NOT put them in `eas.json` `env` — that
section is for `APP_VARIANT` only.

| Variable | Required | Notes |
|----------|----------|-------|
| `SENTRY_DSN` | Yes (builds) | From Sentry project settings. Blank locally = no-op. |
| `POSTHOG_API_KEY` | Yes (builds) | From PostHog project settings. Blank locally = no-op. |
| `POSTHOG_HOST` | Optional | Defaults to `https://eu.i.posthog.com` (EU) when unset. |

`app.config.ts` reads these via `process.env.*` and surfaces them under `extra`.
`src/lib/config.ts` helpers (`getSentryConfig`, `getPostHogConfig`) read them at
runtime and return `undefined` (no throw) when absent — observability degrades to a
no-op rather than crashing the app.

### SENTRY_AUTH_TOKEN

**TODO (ops)**: Provision `SENTRY_AUTH_TOKEN` as an **EAS secret** (not a plain env var)
for the source-map upload build step. This is handled in OBSRV-06 when the Sentry
build plugin is wired up.

---

## Local development

The `.env` file (gitignored) contains placeholder lines for all three vars.
Leave them blank to run without observability locally, or fill them in to test
the integration against your dev Sentry project / PostHog.
