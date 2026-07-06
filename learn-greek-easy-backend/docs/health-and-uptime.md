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
prod-infra writes** — the click-for-click runbook is in **OPS-03-04** (same
guardrail as OPS-01's DSN flip). Continuous death detection = the Sentry uptime
monitor on `https://greeklish.eu/health/ready` (OPS-03-04) + the OPS-01 scheduler
heartbeat + the OPS-02 alert rules. The end-to-end kill-service fire drill that
proves it pages a human is **OPS-10**.
