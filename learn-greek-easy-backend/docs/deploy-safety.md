# Deploy Safety

How Greeklish deploys a new backend version without dropping in-flight
requests, without corrupting the database, and how to roll back cleanly when
a deploy goes bad.

Shipped by **OPS-08** (graceful drain, `RUN_MIGRATIONS` documentation,
rollback runbook), building on **OPS-01** (scheduler heartbeat), **OPS-02**
(Sentry alert rules), and **OPS-03** (health & uptime hardening — see
[health-and-uptime.md](health-and-uptime.md)).

## Overview

Greeklish runs the Backend at **1 replica** (D13 — the deploy-cost budget
does not cover a second warm instance). At 1 replica, every deploy has an
**overlap window**: Railway starts the *new* container, waits for it to pass
its health check, and only then makes it active and stops the *old* one
(`docs.railway.com/deployments/healthchecks`). For a few seconds, the old SHA
and the new SHA both run against **the same database**. This is
**health-check-driven**, not a fixed timer — it is *not*
`RAILWAY_DEPLOYMENT_OVERLAP_SECONDS` (a separate, default-`0`, currently
unused knob for extra overlap *after* the healthcheck passes — see
"`RAILWAY_DEPLOYMENT_OVERLAP_SECONDS` vs `RAILWAY_DEPLOYMENT_DRAINING_SECONDS`"
below).

The overlap window is the reason this doc exists — it drives all four
pieces below:

1. **Graceful drain on SIGTERM** — so the *old* container's in-flight
   requests finish (and its DB pool/Sentry/PostHog close cleanly) instead of
   being SIGKILLed mid-request.
2. **`RUN_MIGRATIONS` behavior** — because the migration that boots with the
   *new* container also has to coexist with the *old* container's queries
   during the overlap.
3. **The expand/contract migration rule** (OPS-08-03) — the schema-change
   discipline the overlap window and rollback both require. See
   [Expand/contract migrations](#expandcontract-migrations) below and
   `CLAUDE.md` Critical Rules #1.
4. **The rollback runbook** — undoing a bad deploy without re-triggering the
   same overlap hazard in reverse.

The **proxy-side** complement to this doc's **app-side** drain is documented
in [docs/railway-backend-privacy.md](../../docs/railway-backend-privacy.md)
("Resilience Features"): the frontend Caddy proxy re-resolves the backend's
internal DNS every 1 second and retries aggressively (100 retries over 10s),
which is what lets in-flight *proxied* requests survive the backend
container swap instead of hard-failing the moment the old IP disappears.
This doc's drain (below) is what happens *inside* that swap window on the
backend container itself.

## Graceful drain on SIGTERM

**The two-sided fix**, split across a repo-side flag and an owner-side
Railway variable:

| Side | Setting | Value | Owner |
|---|---|---|---|
| App (repo) | uvicorn `--timeout-graceful-shutdown` | `25` (seconds) — `learn-greek-easy-backend/Dockerfile:117` | shipped in OPS-08-01 |
| Infra (Railway) | `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` | `30` (seconds) — Backend service Variables | **owner action**, see [Drain drill & owner residuals](#drain-drill--owner-residuals) |

**Invariant: `25 < 30`.** Railway's kill-grace — how long it waits between
sending SIGTERM and sending SIGKILL to the old container — defaults to
**`0` seconds** (`docs.railway.com/variables/reference`,
`RAILWAY_DEPLOYMENT_DRAINING_SECONDS`). At the default, uvicorn's 25s
graceful-shutdown window is **inert**: Railway kills the process before
uvicorn even starts draining. The Railway variable must be raised to at
least the uvicorn value, with headroom — `30` gives 5s of slack.

### The SIGTERM sequence

Once both sides are set, a deploy's old container sees, in order:

1. Railway sends **SIGTERM** to the old container (up to `30`s before
   SIGKILL).
2. uvicorn stops accepting new connections; in-flight non-SSE requests are
   allowed to finish.
3. The always-open `/notifications/stream` SSE connection
   (`src/api/v1/notifications.py:119-164`) is blocked on `await queue.get()`
   — it does not finish on its own. uvicorn force-closes it once the
   `timeout_graceful_shutdown` window (`25`s) elapses.
4. uvicorn then unconditionally runs the FastAPI **lifespan shutdown**
   (`src/main.py:169-187`, single `lifespan` context manager registered at
   `src/main.py:191-199` — no legacy `@app.on_event` handlers): logs
   `"Shutting down Greeklish API"`, flushes Sentry, flushes PostHog, closes
   the OpenRouter/ElevenLabs HTTP client pools, closes the Redis connection
   (`close_redis()`), and disposes the database connection pool
   (`close_db()`).

**A cut SSE stream is expected and acceptable.** The stream emits
`retry: 3000` (`src/utils/sse.py:148`) as its first line, so the browser
`EventSource` auto-reconnects after 3s — against the *new* container, which
is already healthy by the time the old one is draining. No user-visible
notification is lost: the client re-fetches the unread count on reconnect
(`src/api/v1/notifications.py:147-157`).

### `RAILWAY_DEPLOYMENT_OVERLAP_SECONDS` vs `RAILWAY_DEPLOYMENT_DRAINING_SECONDS`

Do not confuse these two Railway variables — they control opposite ends of
the deploy:

| Variable | Controls | Default | Used here? |
|---|---|---|---|
| `RAILWAY_DEPLOYMENT_OVERLAP_SECONDS` | Extra time the **old** container keeps serving *after* the new one passes its health check (before Railway stops routing to it) | `0` | **No** — not needed for this story; the overlap that matters for OPS-08 is the health-check-driven window described above, which exists independent of this variable |
| `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` | SIGTERM→SIGKILL grace period given to the **old** container once Railway decides to stop it | `0` | **Yes** — this is the variable OPS-08 raises to `30` |

### Frontend/Caddy drain (optional parallel hardening)

The Frontend service (Caddy) is SIGTERMed on its own redeploys with the same
`0`s default kill-grace. The SSE stream is *proxied* through Caddy, so a
hard-killed Caddy mid-redeploy could, in principle, sever the proxied hop a
moment earlier than a graceful one would. Optionally, the owner could also
set `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` on the **Frontend** service to
harden that hop.

This is **lower-risk and out of this story's (backend-scoped) Done gate**:
Caddy holds no DB connection and no application state — a hard kill can't
interrupt a transaction or leave a dangling DB session the way killing the
Backend mid-request could. See
[docs/railway-backend-privacy.md](../../docs/railway-backend-privacy.md) for
Caddy's zero-downtime DNS-retry behavior, which already absorbs most of a
backend-container swap without needing Caddy itself to drain slowly.

## RUN_MIGRATIONS behavior

`RUN_MIGRATIONS` gates whether the container runs `alembic upgrade head` at
boot. It is read in exactly one place in the repo,
`docker-entrypoint.sh:52-58`:

```bash
run_migrations() {
    if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
        echo "Running database migrations..."
        alembic upgrade head
        echo "Migrations completed!"
    fi
}
```

Called synchronously at `docker-entrypoint.sh:70` — **before** `exec "$@"`
at `:74` hands off to uvicorn. This means:

- Migrations run **before the health check can pass** — a slow or failing
  migration delays (or blocks) the new container from ever becoming healthy,
  which in turn blocks the deploy from completing (the old container keeps
  serving until the new one is healthy).
- The migration lands on the database **while the old container is still
  serving traffic** against the pre-migration schema — this is the overlap
  window from the Overview, and it is why schema changes must follow the
  [expand/contract rule](#expandcontract-migrations): the old code has to
  keep working against the *migrated* schema for the length of the overlap.

`RUN_MIGRATIONS` is **dashboard-set only** — it is not present in
`.railway/variables.json` (a stale, non-consumed reference file) and not set
anywhere in CI. **Confirmed production value: `RUN_MIGRATIONS=true`** on the
Backend service, i.e. every production deploy auto-applies pending Alembic
revisions. This was read read-only during shaping; no secret was reproduced
here (this is the one non-secret key/value on that service worth recording).
The owner re-confirms it is still `true` via a single-key dashboard glance —
see [Drain drill & owner residuals](#drain-drill--owner-residuals) — never
via a full `list_variables` dump, which returns every secret on the service.

## Rollback runbook

**Never run `alembic downgrade`.** Per [expand/contract](#expandcontract-migrations)
above, migrations are additive-or-split specifically so that an older code
SHA keeps working against the current (never-downgraded) schema. Downgrading
the schema on rollback would strand any deploy that shipped *after* the bad
one and re-introduce the very hazard expand/contract exists to avoid.

**Canonical path — GitHub Actions, pinned to the last-good SHA.** This is
the project's standard deploy path
([docs/deployment-guide.md](../../docs/deployment-guide.md) — "Deployment"),
so a rollback should use it too rather than a different code path:

```bash
git log --oneline -10          # find the last-good commit SHA
git checkout <good-commit-sha>

cd learn-greek-easy-backend
railway up --ci --service Backend    # backend first — preserves BE→FE order
cd ../learn-greek-easy-frontend
railway up --ci --service Frontend
```

Deploy **Backend first, then Frontend** — same ordering `deploy-production.yml`
uses for a forward deploy, and for the same reason: the frontend Caddy proxy
should never be pointed at API contours the backend hasn't rolled back to
yet.

**Break-glass — Railway dashboard.** Faster, but skips the GitHub Actions
ordering/DNS-wait automation, so re-apply Backend-first manually:

1. Railway Dashboard → **Backend** service → Deployments → find the last
   good deployment → **Redeploy**.
2. Repeat for **Frontend** (after the Backend redeploy is healthy).

See [docs/deployment-guide.md](../../docs/deployment-guide.md) "Rollback
Procedure" for the fuller day-to-day rollback options (including "revert and
push"); this section adds the *why* — the never-downgrade rule and the
BE-first ordering — on top of what's already documented there.

**Trigger signal.** `deploy-production.yml`'s `summary` job already detects
a version-skew state (backend succeeded, frontend failed) and fails loudly
with `::error::` — that is the alarm that should send you to this runbook,
whether the skew came from a transient failure or from a deploy you need to
undo.
