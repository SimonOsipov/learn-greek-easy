# Health & Uptime

How Greeklish detects that a service is up, that a new deploy is safe to take
traffic, and how the public health endpoints stay cheap and leak-free.

Shipped by **OPS-03** (external uptime ping, Railway healthchecks & readiness-probe
hardening), building on **OPS-01** (scheduler heartbeat) and **OPS-02** (Sentry
alert rules).

## Liveness matrix

Railway HTTP healthchecks are a **deploy-time gate only** — Railway queries the
endpoint until it returns 200, then makes the new deployment active, and does
**not** poll it afterwards. So "a dead service pages a human" is the uptime
monitor's job, not Railway's. Each service has a named continuous-death signal:

| Service | Kind | HTTP healthcheck? | Continuous-death signal |
|---|---|---|---|
| **Backend** | FastAPI (HTTP) | ✅ has one | Sentry uptime monitor on `/health/ready` (OPS-03); Railway deploy-gate on `/health/ready` |
| **Frontend** | Caddy (HTTP) | ✅ `/healthz` (OPS-03) | Caddy/DNS/edge death → the `/health/ready` ping (which routes through Caddy) fails; a broken SPA build is caught by the `/healthz` deploy gate + the frontend Sentry project |
| **Scheduler** | APScheduler worker | ❌ no HTTP server | **OPS-01** 5-min self-upserting `scheduler-heartbeat` cron → Sentry missed-check-in email |
| **Redis** | TCP service | ❌ not HTTP | `/health/ready` returns 503 if Redis is down → Sentry uptime monitor; plus **OPS-02** Redis-degraded alert |

Why not "a Railway healthcheck on all four": the scheduler has no HTTP surface
and Redis is TCP (an external check would require exposing it publicly — a
security regression). Only the **Frontend** gets a new deploy-gate healthcheck;
the scheduler and Redis are covered by OPS-01 / OPS-02 and the readiness 503.

## Endpoint contract (post-OPS-03)

All root endpoints are mirrored under `/api/v1/health*`, which is how they are
reachable through the frontend Caddy proxy while the backend stays private. A
cache at the service-function seam (`get_health_status` / `get_readiness_status`)
means both the root and `/api/v1` surfaces share one cache and one payload shape.

| Endpoint | Purpose | Cached | Public | Payload |
|---|---|---|---|---|
| `GET /health` | Comprehensive check | ~5 s | yes (via Caddy `/health*`) | `status`, `timestamp`, `uptime_seconds`, `checks.{database,redis,stripe}`. **Trimmed** (OPS-03): no `version`, no `environment`, no `checks.memory`. |
| `GET /health/live` | Liveness — process is alive, no dependency checks | no | yes | `status: "alive"`, `timestamp` |
| `GET /health/ready` | Readiness — minimal `database`/`redis` booleans; **the Sentry uptime target** | ~5 s | yes | `status: ready\|not_ready`, `timestamp`, `checks.{database,redis}` (booleans) |
| `GET /healthz` | Frontend deploy-gate | n/a (Caddy-local static 200) | yes | empty `200` — served by Caddy, **never proxied** to the backend |
| `GET /api/v1/health*` | Mirror of the three root health endpoints | (same cache) | yes | same as above |

HTTP semantics for `/health`: **200** when healthy or degraded (Redis down is
degraded-but-ok), **503** only when the database is down. `/health/ready` returns
**503** if **either** database or Redis is unhealthy (the strictest synthetic).

Version is intentionally **not** on `/health`; it lives at `GET /version`
(public: `commit_sha`, `branch`, `build_time`, `environment`). Trimming `version`
from `/health` does not hide it globally — `environment` and memory-% were the
genuinely-new leaks, and all three are trimmed for a clean minimal public payload.

### Why `/health` was trimmed

`/health` is publicly reachable through Caddy. The comprehensive payload used to
expose `version`, `environment`, and a memory-usage percentage — the last being a
resource-pressure signal. Memory pressure belongs in the Railway dashboard, not a
public endpoint. `check_memory_health()` still exists and is unit-tested; it is
simply no longer wired into the public payload.

## Cache behavior

`get_readiness_status()` and `get_health_status()` are wrapped in an async
single-flight TTL memo (`_AsyncSingleFlightTTL`, TTL `_HEALTH_CACHE_TTL_SECONDS =
5.0`) at the service seam in `src/services/health_service.py`:

- **Single round-trip per window.** A burst of health pings collapses onto at most
  **one** DB + Redis round-trip per ~5 s window, regardless of concurrency. N
  concurrent misses queue on one `asyncio.Lock`; only the first computes (with a
  double-check after acquiring the lock) while the rest await and read the freshly
  cached value — single-flight, not a thundering memo. This protects the D3 budget
  (1 worker, Supavisor session mode, **≤30 connections total**): a discovered
  public health URL cannot be used as a connection-exhaustion lever.
- **Healthy and unhealthy are cached identically** for the full window. The
  connection budget must hold *especially* during an outage, so a ping storm must
  not re-hammer a struggling DB/Redis with `SELECT 1` / `PING` per request
  (health-check amplification).
- **Failure flips within ≤1 TTL.** A just-died dependency surfaces 503 on the next
  compute after the previous entry expires (≤5 s); recovery is likewise ≤1 TTL.
  Uses `time.monotonic()` (not wall-clock) so a clock adjustment cannot extend the
  window. The cached `timestamp` reflects when dependencies were actually probed
  (up to ~5 s old) — acceptable for a health probe.

## Deploy gates

Railway healthchecks gate whether a **bad new deploy** takes traffic; they are not
continuous monitoring.

- **Frontend** Railway healthcheck path → `/healthz` (Caddy-local static 200). It
  must **not** point at the proxied `/health*` — otherwise a backend outage would
  fail the *frontend's* deploy gate and couple the two services. A broken Caddy
  config or SPA build can't take traffic.
- **Backend** Railway healthcheck path → `/health/ready` (strict both-deps 503
  gate — cleaner than the heavy comprehensive `/health`). The local-Docker
  `HEALTHCHECK` in `learn-greek-easy-backend/Dockerfile` also targets
  `/health/ready` for parity.

The Railway dashboard paths and the Sentry uptime monitor are **owner-gated
prod-infra writes** — the click-for-click runbook is the section below (same
guardrail as OPS-01's DSN flip). Continuous death detection = the Sentry uptime
monitor on `https://greeklish.eu/health/ready` + the OPS-01 scheduler
heartbeat + the OPS-02 alert rules. The end-to-end kill-service fire drill that
proves it pages a human is **OPS-10**.

## Runbook — Owner Actions (not done by CI)

> **These four steps are owner-gated production-infra writes** — the same
> guardrail that made OPS-01's DSN flip and OPS-02's alert rules no-PR console
> work. CI cannot perform them and the Sentry MCP is read-only for alerts/uptime,
> so they are documented here for the owner to execute by hand. Each step is
> flagged **OWNER ACTION**. Every value below is kept consistent with what
> OPS-03-03 shipped: the uptime target and the backend deploy-gate are
> `/health/ready`; the frontend deploy-gate is the Caddy-local `/healthz`.

### 1. Sentry Uptime monitor (AC-A) — OWNER ACTION

Create the org's **single free** uptime monitor, pointed at the deepest public
synthetic.

1. Sentry → left sidebar **Insights → Uptime Monitors** (on older UIs: **Alerts →
   Create Alert → Uptime Monitor**) → **Add Uptime Monitor** / **Create Monitor**.
2. **Name:** `greeklish-health-ready` (project: the backend/`greeklish` project).
3. **URL to monitor:** `https://greeklish.eu/health/ready` — pinged *through the
   public proxy* so one check exercises **DNS → Cloudflare → Caddy → backend → DB
   → Redis**. `/health/ready` returns **503 if the database OR Redis is down**, so
   this single URL is the deepest synthetic available. Do **not** point it at the
   raw backend URL (it is private, Railway-internal) or at the root SPA
   `https://greeklish.eu` (that layer is already covered by the frontend
   deploy-gate healthcheck + the frontend Sentry project — see step 2).
4. **Method:** `GET`. **Expected response:** **HTTP 200**. Any non-200 — including
   the `503` the readiness probe returns when a dependency is dead — is a failed
   check.
5. **Interval:** leave at the **Sentry default of 1 minute**. Both a **failed**
   check and a **missed** check must alert (configure the alert in step 6).
6. **Attach a missed/failed-check EMAIL alert, reusing the OPS-02 channel.** OPS-03
   adds no new alert vendor — route the uptime failure to the **same email
   notification action OPS-02's issue-alert rules already use** (delivered to the
   org owner's email — the address is configured there, so there is no need to
   re-enter it).
   - **Primary path:** in the monitor's **Notify / Owner / recipients** field, set
     the recipient to the owner (the same recipient OPS-02 routes to). Modern
     Sentry Uptime alerts notify the monitor's configured owner/team on downtime.
   - **Fallback (if the monitor exposes no direct recipient field):** add an
     **issue-alert rule** (Alerts → Create Alert → Issues) on the same project,
     condition = *a new issue is created* filtered to the **Uptime** issue
     category (an uptime failure raises an `uptime_domain_failure` issue), action
     = **Send an email notification** to the same address OPS-02 uses. This
     mirrors OPS-02's BE any-error rule, scoped to uptime issues.
7. **Do NOT create a second monitor.** The free Developer plan caps at **1 uptime
   monitor** with no PAYG. The root-SPA (`https://greeklish.eu`) monitor is
   **deferred** (needs a 2nd, paid monitor) — do not add it here.

### 2. Railway Frontend service — healthcheck path (AC-B) — OWNER ACTION

Railway dashboard → project → **Frontend** service → **Settings → Deploy →
Healthcheck Path** → set to **`/healthz`**.

- `/healthz` is the **Caddy-local static `200`** shipped in OPS-03-03 (a dedicated
  `handle /healthz { respond 200 }` block that **never proxies** to the backend).
- Do **not** use `/health` or `/health/ready` here — those proxy through to the
  backend, so a backend outage would fail the *frontend's* deploy gate and couple
  the two services. `/healthz` decouples them: it only proves Caddy itself is
  serving.
- **Effect:** a broken Caddy config or SPA build can't take traffic; a backend
  outage does not block an otherwise-healthy frontend deploy.

### 3. Railway Backend service — healthcheck path (AC-B) — OWNER ACTION

Railway dashboard → project → **Backend** service → **Settings → Deploy →
Healthcheck Path** → **confirm (or set)** to **`/health/ready`**.

- Reconciles with the Dockerfile `HEALTHCHECK` repointed to `/health/ready` in
  OPS-03-03. `/health/ready` is the strict both-deps gate (**503 if DB *or* Redis
  is down**) — a cleaner deploy gate than the heavy comprehensive `/health`.
- This is a **deploy-time gate only** — Railway queries it until it returns 200,
  then makes the deployment active and does **not** poll it afterwards.
  Continuous death detection is the Sentry uptime monitor from step 1.

### 4. End-to-end drill — deferred to OPS-10 — OWNER ACTION (later)

The end-to-end proof that a **stopped service actually pages an email** (kill a
service → watch the uptime monitor fail → confirm the email lands) is the
fire-drill deferred to **OPS-10**. It is **not** performed as part of OPS-03.
