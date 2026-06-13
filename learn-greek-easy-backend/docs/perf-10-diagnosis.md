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

> **Correction (PERF-10-02):** the ~57 figure is a Sentry `span.op:db` count,
> which the SqlAlchemy integration inflates with transaction-control spans
> (BEGIN/COMMIT) and the per-request auth user-load on top of each real
> statement. The `before_cursor_execute` hook (which fires only on real SQL)
> counts **20 actual SQL statements** per dashboard request. PERF-10-02
> consolidates these to **11**. The dominant-lever conclusion above is
> unchanged — the lever is just measured at 20→11 real statements, not 57.

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
| **PERF-10-04** transaction-mode migration (6543) | **NO-OP (documented) — stays REJECTED on correctness** | **Primary (load-bearing):** tx-mode breaks asyncpg prepared statements — already REJECTED in `docs/supabase-database.md`; this is a *correctness* blocker that holds **independent of** the (locally unmeasured) direct-vs-Supavisor proxy delta. **Corroborating (not load-bearing):** the session-mode-pooled per-query median is fast (~9–17ms, prod Sentry — **not** a direct-asyncpg number) and the slowness is count + tail, so even the perf case doesn't point at proxy overhead. The missing direct-vs-pooled delta could only *strengthen* a reject, never overturn the correctness blocker |
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
  (session-mode-pooled median fast; slowness is count + tail). Transaction-mode
  **not warranted** — keep session mode. Note the gating logic: tx-mode is rejected
  on a **correctness** fact (it breaks asyncpg prepared statements; see
  `docs/supabase-database.md`), independent of the unmeasured proxy delta — so the
  door is legitimately closed even though the harness could not produce the
  direct-vs-pooled number locally.

  **Falsifier (to keep this conditional auditable):** re-run the harness against a
  prod-like DB (`measure_query_baseline` from a Railway shell / dev env on the
  Supavisor DSN); **if** the direct-asyncpg-vs-Supavisor-pooled delta is large
  (e.g. > ~30ms) **and** PERF-10-02's round-trip reduction misses the dashboard p50
  target, **then** re-open transaction mode — but only after first solving the
  asyncpg prepared-statement break (`statement_cache_size=0` + a load-test gate, per
  the story constraint). The harness is left in-repo precisely as the re-run vehicle
  for this falsifier.
- **review-submit slow because `feature_background_tasks=False`?** → **NO**
  (already p50 10ms). Flag flip is a no-op.

---

## PERF-10-04 — Lever Outcomes

PERF-10-04 acts on the per-lever verdict above. **All four levers + `pool_pre_ping`
resolve to documented no-ops** — there is **no request-path code change and no config
flip** in this subtask. Each outcome is recorded below with its cited evidence (AC #1:
"each lever has a recorded outcome — applied or documented no-op with why"). The only
artifact shipped is a born-GREEN **regression-lock** test
(`tests/unit/db/test_session_txmode.py`, F1 NOT-WARRANTED branch) that pins the current
session-mode engine config so a future silent flip is caught by CI.

| Lever | Outcome | Evidence (cited) |
|-------|---------|------------------|
| **`redis_url` config flip** | **NO-OP — cache already live in prod** | Sentry `span.op:db.redis` shows **1920 spans / 7d @ p50 1.8ms** (org `greekly-backend`). `get_redis()` is non-None and the PERF-05 read-through cache + PERF-05-05 identity cache are engaged in prod. No `redis_url` change needed; no Railway env edit. (The local harness printed `cache_live=False`, but a bare script never calls `init_redis()` and the local env has no Redis — not evidence about prod.) |
| **`feature_background_tasks` flip** | **NO-OP — nothing slow to defer** | review-submit (`reviews_v2.submit_v2_review`) is already **p50 10ms / p95 32ms** (608 samples / 14d, a solid sample). The synchronous persist/XP/achievement path is fast; deferring it to `persist_deck_review_task` / `invalidate_cache_task` would add eventual-consistency complexity for **no latency benefit**. The flag stays `False` (config.py:352). |
| **transaction-mode migration (port 6543)** | **NO-OP — stays REJECTED** | **Correctness (load-bearing):** tx-mode breaks asyncpg prepared statements — already REJECTED in `docs/supabase-database.md`; this blocker holds independent of any proxy-delta measurement. **Corroborating:** per-query DB exec is fast — `span.op:db` **p50 9.3ms / p95 39.8ms / p99 152ms** (5597 spans / 7d); the slowness was query **count** (dashboard, addressed by PERF-10-02), not Supavisor session-mode proxy overhead per query. The diagnosis did **not** prove proxy overhead is the floor, so the door stays closed. No engine change; `docs/supabase-database.md` unchanged (tx-mode remains REJECTED). |
| **`pool_pre_ping` drop** | **NO-OP — KEEP (conservative default)** | The harness **could not measure** the pre-ping-vs-no-pre-ping per-checkout delta against a live DB (local `DATABASE_URL` → unreachable `localhost:5433`, not the Supavisor cross-region path). Per the story Decision, dropping `pool_pre_ping` requires keepalive-liveness evidence that it is safe to remove — **none was obtained** — so `pool_pre_ping=True` is **kept** (`src/db/session.py`). |

### What shipped in PERF-10-04

- **Docs:** this section (the per-lever no-op record with cited evidence).
- **Regression-lock test** (`tests/unit/db/test_session_txmode.py`,
  `test_session_mode_engine_config_unchanged`, `@pytest.mark.unit`): a born-GREEN F1
  lock — **not** a test-first RED. It asserts the engine stays Supavisor session-mode:
  budgeted pool default **15 + 5** (env-independent `Settings` field default — the ≤30
  Supavisor budget, the recorded outcome of the pool-budget lever: **KEEP, no evidence
  to change**), `pool_pre_ping is True`, **no** asyncpg statement-cache override in
  `connect_args` (forbids **both** spellings — `statement_cache_size` and
  `prepared_statement_cache_size`), and DB URL port **5432** (not tx-mode 6543).
  Verified to go RED on a simulated tx-mode flip (injecting `statement_cache_size=0`
  into `connect_args`), so the lock is not a vacuous green.
- **No change** to `src/db/session.py`, `src/config.py`, request-path code, pool
  sizing, or any engine kwargs.

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

---

## PERF-10-05 — Post-Deploy Re-Measure

**This is the FINAL subtask and the backend substitute for the RALPH visual gate.**
It (1) locks the real, already-measured prod BEFORE baselines, (2) states the AFTER
as a **post-merge obligation** with the exact methodology to run it and the expected
*directional* improvement per path (no invented "after" numbers — a true before/after
needs the merged change live in prod with ≥7d of real traffic, which only exists
**after** this PR merges), and (3) records the Supavisor budget-preservation result
(verifiable now by code inspection of the whole branch).

> **Honesty caveat (read first).** No "after" latency below is measured. Pre-merge,
> prod is still running `origin/main` code; the branch is not deployed, so the only
> honest "after" is an *expectation* plus the query to confirm it post-merge. Any
> table cell labelled "expected" is a hypothesis to be validated, not a result.

### BEFORE baselines (LOCKED — real prod Sentry, `greekly-backend`, de.sentry.io)

These are the authoritative anchor. They are the prod-measured numbers captured at
diagnosis/now; the story-header figures are retained only for traceability.

| Path | Transaction | Prod measured (window) | Story-header baseline |
|------|-------------|------------------------|-----------------------|
| **dashboard** | `src.api.v1.progress.get_dashboard_stats` | p50 **762ms** / p95 **2484ms** (31 samples, 14d); p50 597ms / p95 3040ms (13 samples, 7d) | p50 750ms / p95 3.0s |
| **get_me** | `src.api.v1.auth.get_me` | p50 **190ms** / p95 **2165ms** (17 samples, 7d — noisy / low-N) | p50 681ms |
| **review-submit** | `src.api.v1.reviews_v2.submit_v2_review` | p50 **10ms** / p95 **32ms** (608 samples, 14d) | p50 872ms (**STALE** — already fast) |

Supporting span baselines (for tail/cache context):
- `span.op:db` — p50 **9.3ms** / p95 **39.8ms** / p99 **152ms** / max **1753ms** (5597 spans / 7d). Per-query DB is fast; the dashboard cost is **count + tail**, not per-query latency.
- `span.op:db.redis` — 1920 spans @ p50 **1.8ms** (cache is live in prod — corroborates PERF-10-04's "cache already engaged" no-op finding).

### AFTER — expectations (to CONFIRM post-merge; NOT measured)

| Path | Expectation (directional) | Absolute gate | Attributable to |
|------|---------------------------|---------------|-----------------|
| **dashboard** | p50 drops **materially** from 762ms. PERF-10-02 cut the uncached compute from **20→11** SQL round-trips (−9); at the prod `span.op:db` p50 ≈16ms/query that removes ~**145ms** of sequential DB time at the median, plus tail compression (each removed query is one fewer chance to hit the long tail). Directional aspiration: toward the diagnosis's ~300–450ms target; realistically a *clear* reduction from 762ms — confirm post-merge. | **p95 ≤ 1800ms** (post-merge gate, per the PERF-10-01 QA advisory: fewer serial round-trips ⇒ fewer tail-exposure points; 1800ms is a conservative, justifiable ceiling below the 2484ms baseline that a 9-of-20 round-trip cut should comfortably clear). | **PERF-10-02** (dashboard 20→11 round-trip consolidation) |
| **get_me** | p50 shaved by ~**one round-trip** on the happy path: PERF-10-03 removed 1 of 2 user/settings reloads (the redundant `select(User).selectinload(settings)`). Bounded — the cache is live, so the win is one serial round-trip on a ~190ms-p50 path; the warm identity-map hit must **not** regress (sentinel check `'settings' in __dict__` keeps it 0-round-trip). | No absolute p50 gate — **17-sample N makes absolute targeting noisy/unreliable**; assert *direction only* (p50 not worse; no warm-hit regression) over a ≥7d window with more samples. | **PERF-10-03** (get_me 2→1 settings reload) |
| **review-submit** | **NO change expected.** PERF-10-04's `feature_background_tasks` flip is a documented no-op (path is already p50 10ms / p95 32ms — nothing slow to defer). | An **expected-flat path is NOT a regression** — flat p50/p95 here is a PASS, not a miss. | none (PERF-10-04 documented no-op) |

### Methodology — exact Sentry MCP `search_events` re-run (run post-merge)

Run each query once prod has accrued **≥7d of real traffic on the merged change**.
Use the Sentry MCP `search_events` tool against org `greekly-backend` (de.sentry.io):

- **Dataset:** `spans` (the transaction/http-server spans), filtered to server spans:
  `span.op:http.server`.
- **Per-path filter:** the transaction name, one query each:
  - dashboard → `span.op:http.server transaction:"src.api.v1.progress.get_dashboard_stats"`
  - get_me → `span.op:http.server transaction:"src.api.v1.auth.get_me"`
  - review-submit → `span.op:http.server transaction:"src.api.v1.reviews_v2.submit_v2_review"`
- **Aggregates:** request `p50(span.duration)` and `p95(span.duration)` (plus `count()` so the sample-N is visible and low-N noise is flagged).
- **Window:** `statsPeriod` of **≥7d** post-merge (14d preferred for dashboard/get_me given their low daily sample counts). Mirror the BEFORE windows above so the comparison is apples-to-apples.
- **Supporting re-checks (optional, for attribution):** `span.op:db count()` grouped by the dashboard transaction to confirm the per-request round-trip count dropped (≈20→≈11); `span.op:db.redis` to confirm cache still live.

Compare each path's post-merge p50/p95 against the **LOCKED BEFORE** table above.
Pass criteria: dashboard p50 materially down **and** p95 ≤ 1800ms; get_me direction
not worse (no warm-hit regression); review-submit flat.

> **AFTER numbers are a post-merge obligation.** Run this section's queries once prod
> has accrued ≥7d of traffic on the merged change, then fill the AFTER table with the
> measured p50/p95 and record PASS/MISS against the gates. Do not backfill these cells
> pre-merge — there is no honest "after" until the change is live.

### Supavisor budget-preservation check (AC3 / AC5) — verified across the whole branch

Method: `git diff origin/main -- learn-greek-easy-backend/src`, inspected for any
pool-sizing, engine, session, or connection-adding change. Result: **PASS — no
connection-adding change anywhere in the branch.**

Evidence:
- **Pool config unchanged.** `src/config.py` `database_pool_size` = **15** and
  `database_max_overflow` = **5** are byte-identical between `origin/main` and the
  branch (diff on `src/config.py` is **empty**). `src/db/session.py` (the only file
  that reads those into engine kwargs) is **untouched** (empty diff).
- **No new engine / session / connection in any runtime path.** A grep of all added
  (`^+`) lines across the branch for `create_async_engine` / `sessionmaker` /
  `async_sessionmaker` / `AsyncSession(` / `.connect()` / `Redis(` / `ConnectionPool`
  matches **only inside `src/scripts/perf10_diagnosis.py`** — a standalone diagnostic
  CLI (`_time_pooled` builds a throwaway `create_async_engine(pool_size=2,
  max_overflow=2)` that is `await engine.dispose()`-d in a `finally`, and is **never
  imported by the API runtime**). Zero matches in any request-path module.
- **Dashboard consolidation is single-session sequential, no fan-out.**
  `ProgressService._compute_dashboard_stats` issues every read as
  `await self.<repo>.<method>(...)` on the **single shared `self.db` AsyncSession**
  (INFRA-01) — no `asyncio.gather`, no parallel checkout, no new session. The three
  new aggregate repo methods (`get_dashboard_review_aggregates`,
  `get_dashboard_answer_aggregates`, `get_dashboard_mock_aggregates`) execute on
  `self.db` and **fewer** queries than before (20→11), so the change **reduces**
  concurrent pool demand rather than adding to it.
- **get_me adds no connection.** PERF-10-03 swapped `get_me` onto the new
  `get_current_user_with_settings` dependency, which reuses the **already-injected
  `get_db` session** (`await db.refresh(current_user, ["settings"])`, and only when
  settings are absent) and **removed** the endpoint's own redundant
  `select(User).selectinload(settings)` reload — a net **−1 round-trip**, **0** new
  connections, on the same session.

**Conclusion:** the ≤30 Supavisor connection budget (API 15 + 5 overflow, scheduler
3 + 2) is **preserved — no pool/engine/connection change in the branch.** The only
engine instantiation introduced is in a non-runtime diagnostic script that disposes
its throwaway engine. AC3 (no budget regression) and AC5 (no pool/connection change)
hold.
