# FEATURE_BACKGROUND_TASKS

Controls whether the backend enqueues certain deferred work (SM-2 review persistence,
culture-answer persistence, cache invalidation, admin asset generation, announcement
notifications) via Starlette `BackgroundTasks`, and whether the standalone scheduler
service registers its cron jobs at all. Code default is **`False`**
(`src/config.py:374` — `feature_background_tasks: bool = Field(default=False, ...)`).
When unset in an environment, the effective value is this default.

**Two equivalent gate mechanisms read this one setting** — greps for consumers must
check both:
- Direct check: `if settings.feature_background_tasks:` (used by request-path gates #1–15 below).
- Wrapper: `if is_background_tasks_enabled():` (`src/tasks/background.py:41`, returns
  `settings.feature_background_tasks` verbatim) — used by request-path gate #16, and
  internally by most task bodies as a defensive re-check of the same setting.

## Current production values (verified read-only, 2026-07-04)

Read via Railway CLI (`railway variables`), read-only — no values were changed.

| Service | `FEATURE_BACKGROUND_TASKS` | Read date | How read |
|---------|---------------------------|-----------|----------|
| Backend (`d34e23f8-…`) | `true` (explicitly set) | 2026-07-04 | Railway CLI `railway variables`, project `Learn Greek` |
| scheduler (`1dadd3f1-…`) | `true` (explicitly set) | 2026-07-04 | Railway CLI `railway variables`, project `Learn Greek` |

Both services have the flag explicitly set to `true` — neither relies on the code
default. See "Out of scope" below for why flipping either value is not covered here.

## What it gates — request-path consumers

Each site below is a FastAPI handler branching on the flag (directly or via the
`is_background_tasks_enabled()` wrapper — see above). **True** → the listed
background task(s) are enqueued. **False** → the deferred work is skipped, except
#1 and #16, the two consumers with a full `else:` fallback (see next section).

| # | Site | Endpoint | Enqueues |
|---|------|----------|----------|
| 1 | `reviews_v2.py:62` | submit SM-2 review | `persist_deck_review_task` + `invalidate_cache_task(progress)` |
| 2 | `decks.py:337` | create deck | `invalidate_cache_task(deck)` |
| 3 | `decks.py:991` | add word to deck | `invalidate_cache_task(deck)` |
| 4 | `decks.py:1047` | unlink word from deck | `invalidate_cache_task(deck)` |
| 5 | `decks.py:1235` | update deck | `invalidate_cache_task(deck)` |
| 6 | `decks.py:1331` | soft-delete deck | `invalidate_cache_task(deck)` |
| 7 | `exercises.py:121` | submit exercise review | `invalidate_cache_task(progress, user_id)` |
| 8 | `culture/mock_exam.py:454` | submit-all mock exam | `invalidate_cache_task(progress, user_id)` |
| 9 | `admin.py:878` | admin upload deck cover | `invalidate_cache_task(deck)` |
| 10 | `admin.py:931` | admin remove deck cover | `invalidate_cache_task(deck)` |
| 11 | `admin.py:1952` | admin create news/situation | `generate_picture_task` + `generate_description_audio_task(b1)` + conditional `(a2)` |
| 12 | `admin.py:3442` | admin generate cards for word | `invalidate_cache_task(deck)` |
| 13 | `admin.py:3538` | admin create + link word entry | `invalidate_cache_task(deck)` |
| 14 | `admin.py:3646` | admin link existing word entry to deck | `invalidate_cache_task(deck)` |
| 15 | `admin.py:3700` | admin unlink word entry from deck | `invalidate_cache_task(deck)` |
| 16 | `culture/router.py:591` (wrapper) | submit culture-question answer | `persist_culture_answer_task` + `invalidate_cache_task(progress)` |

When `False`, sites #2–#15 simply skip cache busting / asset generation — stale
public caches and missing pictures/audio on those admin actions are the visible
symptom, not an error. Site #16 does not skip work silently — see next section.

## The two inline fallbacks: SM-2 review and culture-answer processing

Two consumers — not one — have a full synchronous `else:` branch instead of
simply skipping work:

- **`reviews_v2.py:62`** (deck SM-2 review):
  - `True` → `background_tasks.add_task(persist_deck_review_task, ...)` +
    `background_tasks.add_task(invalidate_cache_task, cache_type="progress", ...)`
  - `False` → `await service.persist_review(context)` runs **inline, in-request**
    (`reviews_v2.py:76-77`)
- **`culture/router.py:591`** (`submit_answer`, gated via the `is_background_tasks_enabled()`
  wrapper, not the direct `settings.` check):
  - `True` → `await service.compute_answer(...)` (sync SM-2/XP compute) then
    `background_tasks.add_task(persist_culture_answer_task, ...)` +
    `background_tasks.add_task(invalidate_cache_task, cache_type="progress", ...)`
  - `False` → `full_response = await service.process_answer(...)` runs **inline,
    in-request**, doing SM-2 + XP + persistence synchronously (`culture/router.py:629-634`,
    inside the `else:` at `:627`)

Both paths persist in both branches — the flag only decides whether persistence
happens in the request or is deferred. Both are SRS write paths referenced in
"Out of scope" below.

## Scheduler service gating

The standalone scheduler service (`python -m src.scheduler_main`, no HTTP port) is
gated by the same flag at two levels:

- `src/scheduler_main.py:55` — service entrypoint: `False` → logs `"Background
  tasks disabled (FEATURE_BACKGROUND_TASKS=false)"` and **exits immediately**.
- `src/tasks/scheduler.py:93` — `setup_scheduler()`: `False` → logs `"Background
  tasks disabled, skipping scheduler setup"` and returns without registering jobs.

When `True`, `setup_scheduler()` registers exactly 5 cron jobs (`src/tasks/scheduler.py`):
`streak_reset` (:124), `session_cleanup` (:132), `stats_aggregate` (:140),
`trial_expiration` (:147), `gamification_reconcile_active_users` (:156).

## A third pattern: call-site-ungated, internally-gated

`admin.py:2128` (`create_announcement` — admin creates an announcement campaign)
enqueues `create_announcement_notifications_task` **with no flag check at the call
site at all**:

```python
background_tasks.add_task(
    create_announcement_notifications_task,
    campaign_id=campaign.id, ...
)
```

The gate lives **inside the task body** instead: `src/tasks/background.py:1031` —
`if not is_background_tasks_enabled(): return` (logs `"Background tasks disabled,
skipping create_announcement_notifications_task"` and no-ops).

**Operational effect when `False`:** `POST` the announcement still returns `200`
with the campaign created — but zero `Notification` rows are ever generated, and
the campaign's `total_recipients` count stays `0`. This is silent: nothing in the
response or logs at the call site indicates the flag suppressed the work. Because
both production services currently read `true`, this is not presently observable —
but it is a distinct pattern from the 16 request-path gates above (which skip
*before* enqueueing) and from the two inline fallbacks (which do the work
synchronously instead). Worth knowing if a future story ever flips the flag.

Most other tasks (`invalidate_cache_task`, `persist_deck_review_task`,
`persist_culture_answer_task`, the picture/description-audio tasks) also re-check
`is_background_tasks_enabled()` internally, but this is defensive/redundant —
their call sites already gate before enqueueing via `BackgroundTasks.add_task`.
`award_flashcard_xp_task` / `check_achievements_task` have the same internal check
but are never enqueued via `BackgroundTasks` at all — `persist_deck_review_task`
(already gated) awaits them directly as plain function calls, so their check is
unreachable in a `False` state. `create_announcement_notifications_task`
(`admin.py:2128`) is the only task where the internal check is load-bearing —
its call site enqueues unconditionally.

## Non-gate references (reporting only)

These read the flag but don't branch behavior on it:

- `src/main.py:451` — `GET /api/v1/status` "features" dict.
- `src/main.py:501` — `GET /debug/settings` "features" dict.
- `src/tasks/picture_generation.py:19`, `src/tasks/description_audio.py:22` — docstrings.
- `src/scripts/perf10_diagnosis.py:197,284` — diagnostic print.

## Corrections

1. **No daily-goal-notification gate exists.** An earlier story summary claimed the
   flag gates daily-goal notifications — it does not. The full consumer set is the
   16 request-path gates + scheduler service + the call-site-ungated announcement
   task + the reporting refs above — reconciled by grepping both
   `settings.feature_background_tasks` and `is_background_tasks_enabled(` across `src/`.
2. **Starlette `BackgroundTasks` ≠ this flag.** The waitlist confirmation email
   (`src/services/waitlist_service.py:127`, PERF-19-03) is dispatched via
   `background_tasks.add_task` **unconditionally** — it is not gated by
   `FEATURE_BACKGROUND_TASKS`. Gating it would make the email send inline whenever
   the flag is off (its default), which defeats the point. This flag controls
   whether *we* enqueue the deferred work listed above; it does not control whether
   Starlette runs `BackgroundTasks` at all.

## Out of scope

Flipping `FEATURE_BACKGROUND_TASKS` (in either direction, on either service) is
**not** covered by this doc or by the story that produced it (PERF-19). Both
production services currently read `true`, so no flip is pending — but any future
change to either value needs its own verification story: turning the SM-2 review
path from background to inline (or vice versa) is a behavior change to the SRS
write path and gamification XP/streak accounting, and needs dedicated testing
before rollout.
