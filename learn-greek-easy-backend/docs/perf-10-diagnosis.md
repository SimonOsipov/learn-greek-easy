# PERF-10 Per-Query Baseline Diagnosis & Hot-Path Findings

**Status:** Diagnosis complete (PERF-10-01). This document gates the conditional
subtasks PERF-10-02 / 03 / 04 — each reads the per-lever verdict below.

**Harness:** `src/scripts/perf10_diagnosis.py` (run: `poetry run python -m
src.scripts.perf10_diagnosis`). Standalone, **not** wired into request handling.

---

## TL;DR — the premise was half right

The PERF-10 story opened on the premise that a **50–140ms per-query baseline**
(cross-region Railway europe-west4 → Supabase eu-central-1 via Supavisor session
mode) is the dominant cost on the three hot paths. The prod evidence shows that
premise describes the **p95–p99 tail, not the warm median** — and that the real
dominant cost on the slowest path (dashboard) is the **number of sequential DB
round-trips**, not the per-query latency.

Net result: **the diagnosis is mostly "no-ops"** — the cache is already live, the
background-tasks deferral is moot (review-submit is already fast), and a
transaction-mode migration is **not** warranted. The one clearly-warranted lever
is **dashboard round-trip reduction** (PERF-10-02), with a modest secondary win
from **removing get_me's redundant settings reload** (PERF-10-03).

---

## Measurement provenance & honesty caveat

### Local harness run — DB unreachable, no live numbers

The harness was run locally but **could not measure live per-query latency**:

```
Per-query baseline (mean ms over 20 iterations; 0.0 = mode unreachable):
  direct asyncpg .............. 0.00 ms
  pooled WITH pool_pre_ping ... 0.00 ms
  pooled WITHOUT pre_ping ..... 0.00 ms
```

Why local is blind here:

- The worktree's `.env` `DATABASE_URL` points at `localhost:5433` (a local
  Postgres that is not running and, regardless, is **not** the dev Supabase /
  Supavisor cross-region path the story is about). So direct-vs-pooled-vs-pre-ping
  deltas cannot be observed from this machine — the `0.0` values are the harness's
  documented "mode unreachable" sentinel, **not** a measured zero.
- The local Poetry env is Python 3.14; the spaCy-bound and `pydantic.v1`-bound
  import chains don't load locally (they run in CI on 3.13). The unit tests for the
  harness pass locally (mock-only); the DB-backed integration replay
  (`tests/integration/scripts/test_perf10_diagnosis_replay.py`) collects/runs in CI.

**No per-query latency numbers in this document are fabricated.** Where the harness
could not measure, the attribution below leans on **production Sentry evidence**
(real, citable, with sample-count caveats stated), and the harness remains in-repo
so PERF-10-05 (and any re-run with prod-like DB access) can produce live deltas.

### Production Sentry evidence (primary attribution)

Source: Sentry org `greekly-backend`, region `de.sentry.io`, 7–14 day windows
(queried 2026-06-13). Sample counts are low for the rarer endpoints — treated as a
**directional** signal, with the caveat stated per row.

| Signal | Measurement | Window / samples |
|---|---|---|
| **Per-query DB exec distribution** (`span.op:db`) | p50 **9.3ms**, p75 17.6ms, p95 **39.8ms**, p99 **152ms**, max 1753ms | 5597 spans / 7d |
| **Redis op distribution** (`span.op:db.redis`) | p50 **1.8ms**; **1920 spans / 7d** → cache IS live | 7d |
| **Dashboard** `progress.get_dashboard_stats` | http.server p50 **762ms** / p95 **2484ms**; **1757 db spans / 31 reqs ≈ 57 db queries/req** @ p50 16.7ms / p95 126.7ms; ~34 redis ops total (mostly MISS) | 31 reqs / 14d |
| **review-submit** `reviews_v2.submit_v2_review` | p50 **10ms** / p95 **32ms** | 608 samples / 14d |
| **get_me** `auth.get_me` | p50 **190ms** / p95 **2165ms** (noisy) | 17 samples / 14d |

---

## Root-cause attribution

### 1. The "50–140ms per query" floor is a TAIL, not the median

The DB-span distribution puts the **warm median per query at ~9–17ms**, with the
**50–140ms band landing at p95–p99**. So:

- The per-query floor is **real at the tail** (p95 ~40ms, p99 ~152ms) — consistent
  with cross-region RTT + Supavisor proxy hops on cold/contended checkouts.
- It is **not** the warm-path median. A path that is slow at p50 is slow because of
  **how many** sequential queries it issues, not because each query is intrinsically
  50–140ms.

This reframes the whole story: **count-bound, not latency-bound**, on the warm path.

### 2. Cache IS engaged in prod — the "cache-not-engaged" suspicion is REFUTED

The story's prime suspicion (Core AC #2, and the get_me hypothesis) was that
`redis_url` might be unset in prod, silently no-op'ing PERF-05 caching
(`init_redis()` swallows failures → `get_redis()` None → `CacheService.enabled`
False). The prod data **refutes** this: **1920 redis spans / 7d @ p50 1.8ms** means
`get_redis()` is non-None and the cache is doing real work in prod.

> Note: the local harness printed `cache_live=False`, but that is **not** evidence
> about prod — a bare script run never calls `init_redis()`, and the local env has
> no Redis. The prod redis-span volume is the authoritative signal. Run
> `probe_config_engagement()` inside a prod-like process (after `init_redis()`) to
> corroborate `cache_live=True` there.

### 3. Dashboard — root cause is the sequential round-trip COUNT

Prod shows **~57 sequential DB queries per dashboard request** (1757 spans / 31
reqs) at p50 16.7ms each. `57 × 16.7ms ≈ 950ms`, which **≈ the entire endpoint p50
of 762ms** (the difference is overlap/measurement window). Redis ops on this path
are mostly cache-**miss** (~34 total), so the read-through cache is not absorbing
these.

This is more than the ~17 round-trips the static code read (`_compute_dashboard
_stats`, `progress_service.py:97–126` + `_fetch_streak_union_rows`:178) suggested —
the per-request span count of ~57 includes the repository-internal fan-out
(per-status / per-source sub-queries) on top of the 15 visible awaits. Either way
the conclusion is the same and **stronger**: dashboard latency is dominated by
**sequential round-trip count on the shared single AsyncSession** (INFRA-01: one
in-flight query per session). **This is the dominant, clearly-actionable lever.**

### 4. review-submit — already fast; the 872ms baseline is STALE

Prod review-submit is **p50 10ms / p95 32ms** (608 samples — a solid sample). The
872ms baseline in the story header is stale (pre-PERF-03/05/07, or a different
measurement). The synchronous pre-persist sequence (`reviews_v2.py:34/54` →
`v2_sm2_service.py:418` `get_or_create` → persist, ≥3 round-trips) is **not** a
latency problem in practice. The `feature_background_tasks` deferral is therefore a
**documented no-op** — there is nothing slow to defer.

### 5. get_me — redundant second settings reload is real but bounded

Prod get_me is **p50 190ms / p95 2165ms** (only 17 samples — noisy; treat
directionally). The cache is live, so the identity cache (PERF-05-05) is engaged.
But the handler **unconditionally** re-queries `select(User).selectinload(settings)`
at `auth.py:322` after `get_current_user` already resolved the user — a second
serial round-trip the identity cache does **not** eliminate. With the cache live,
this redundant reload is a **real, removable round-trip**, but the win is **bounded**
(one round-trip on a path whose p50 is ~190ms). → PERF-10-03 warranted, modest.

---

## Per-lever verdict (gates PERF-10-02 / 03 / 04)

| Lever | Verdict | Evidence |
|-------|---------|----------|
| **PERF-10-02** dashboard round-trip reduction | **WARRANTED (dominant)** | ~57 sequential queries/request ≈ 950ms p50 ≈ the whole endpoint; count-bound, cache-miss-heavy |
| **PERF-10-03** get_me redundant settings reload | **WARRANTED (modest)** | `auth.py:322` unconditional 2nd reload; cache live ⇒ removable but bounded (~1 round-trip on a ~190ms p50 path) |
| **PERF-10-04** `redis_url` config flip | **NO-OP (documented)** | cache already live in prod: 1920 redis spans/7d @ p50 1.8ms |
| **PERF-10-04** `feature_background_tasks` flip | **NO-OP (documented)** | review-submit already p50 10ms / p95 32ms; nothing slow to defer |
| **PERF-10-04** transaction-mode migration (6543) | **NO-OP (documented) — stays REJECTED** | per-query **median** fast (9–17ms); slowness is **count + tail**, not Supavisor proxy overhead. `docs/supabase-database.md` records tx-mode REJECTED (breaks asyncpg prepared statements); the diagnosis does not re-open it |
| **`pool_pre_ping` drop** | **INVESTIGATE → default KEEP** | harness could not measure the pre-ping vs no-pre-ping delta locally (DB unreachable). Conservative default: **keep** `pool_pre_ping=True`; drop only if a prod-like harness run shows a material per-checkout delta AND the PERF-07 keepalive is proven to hold connections live |

### Decision-tree mapping (from the story's conditional tree)

- **Cache/warm-pool engaged in prod?** → **YES** (cache live). PERF-10-04 records
  "config live, fix is code-side." No `redis_url` change.
- **Dashboard wall-time dominated by N serial round-trips?** → **YES** (~57/req).
  PERF-10-02 proceeds. **Conservative default: prefer query consolidation** (fold
  independent COUNT/status/study-time reads into fewer SQL statements on the existing
  single session) over multi-session `asyncio.gather` fan-out; fan-out only if
  consolidation can't hit target AND the ≤30 Supavisor budget (INFRA-03: API 15+5,
  scheduler 3+2) is shown to hold with a documented concurrency cap.
- **get_me second settings reload a measurable serial round-trip?** → **YES**
  (`auth.py:322`). PERF-10-03 proceeds with the **sentinel-check** technique
  (`'settings' in user.__dict__`, async-safe) so the warm 0-round-trip identity-map
  hit at `dependencies.py:112` is **not** regressed into a guaranteed SELECT.
- **Baseline floor = Supavisor session-mode proxy overhead specifically?** → **NO**
  (median fast; slowness is count + tail). Transaction-mode **not warranted** — keep
  session mode (conservative default).
- **review-submit slow because `feature_background_tasks=False`?** → **NO**
  (already p50 10ms). Flag flip is a no-op.

---

## Per-path latency targets (for PERF-10-05 before/after)

Baselines below are the **prod Sentry** numbers (the story-header 750/872/681ms
figures are superseded where prod tells a different story — noted inline).

| Path | Baseline (prod) | Target | Lever |
|------|-----------------|--------|-------|
| **dashboard** `GET /dashboard` | p50 **762ms** / p95 **2484ms** | p50 **≤ ~300–400ms** / p95 materially down | PERF-10-02 query consolidation (cut ~57 → far fewer round-trips) |
| **get_me** `GET /auth/me` | p50 **190ms** / p95 2165ms (17 samples, noisy) | p50 shaved by ~1 round-trip; **no warm-hit regression** | PERF-10-03 remove redundant settings reload |
| **review-submit** `POST /reviews/v2` | p50 **10ms** / p95 **32ms** | **no change expected** (already fast) | none — documented no-op |

> Story-header baselines (dashboard p50 750ms / p95 3.0s; review-submit p50 872ms;
> get_me p50 681ms) are retained here for traceability, but the **prod-measured**
> numbers above are the authoritative before/after anchor for PERF-10-05.

---

## What the harness measures (for re-runs)

`src/scripts/perf10_diagnosis.py` exposes three functions; run the module to print a
combined report:

1. **`measure_query_baseline(engine)`** → `{direct_ms, pooled_preping_ms,
   pooled_no_preping_ms}`. Times `SELECT 1` over (a) raw-asyncpg direct, (b)
   Supavisor pooled checkout **with** `pool_pre_ping`, (c) **without**. `(b)−(a)`
   isolates the Supavisor proxy delta; `(b)−(c)` isolates the per-checkout pre-ping
   round-trip. Unreachable mode → `0.0` sentinel. **Run this from a prod-like host
   (Railway shell / dev env with the Supavisor DSN) to fill in the live deltas this
   doc could not measure locally.**
2. **`probe_config_engagement()`** → `{cache_live, feature_background_tasks,
   database_pool_warm_min}`. `cache_live = get_redis() is not None` — run inside a
   process that has called `init_redis()` (i.e. the running API), not a bare script,
   to get the true prod value.
3. **`replay_dashboard_roundtrips(session)`** → `{roundtrip_count, wall_time_ms}`.
   Attaches a `before_cursor_execute` counting hook (the PERF-08 `capture_sql`
   pattern) and replays `ProgressService._compute_dashboard_stats` to count the
   dashboard's sequential round-trips against a real session.

---

## Guardrails honored

- **Diagnosis only** — PERF-10-01 changed no request-path code, pool sizing,
  PERF-03/05/07 surfaces, or endpoint behavior. The harness is a standalone script.
- **Conservative-default lever ordering** — config-engagement checked first
  (cheapest/lowest-risk); transaction-mode evaluated last and **rejected** (stays as
  `docs/supabase-database.md` records it).
- **No fabricated numbers** — local DB was unreachable; all latency attribution
  cites prod Sentry (with sample-count caveats), and the harness stays in-repo to
  produce live deltas on a prod-like re-run.
