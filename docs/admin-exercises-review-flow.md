# Admin Exercises Review Flow — Rollout Notes

Operational reference for ADMIN2-23 (Exercises Tab Rebuild).

## Deploy order

The following Alembic migrations must run before frontend cut-over:

- `exr57` — `ALTER TYPE exercisestatus ADD VALUE 'pending'`
- `exr54` — `question_el` + `question_en` columns on all sibling exercise tables
- `exr53` — `word_order_exercises` + `word_order_exercise_items` tables + `ALTER TYPE exercisetype ADD VALUE 'word_order'` + `exercises.word_order_exercise_id` FK
- `exr63` — Backfill `question_en` from `Situation.scenario_en`

Production deploy via `deploy-production.yml` runs Backend → Frontend sequentially, so the natural order satisfies this.

## Backwards compatibility

- The `modality` (Listening/Reading) SegControl is retained from the legacy view; existing URL bookmarks like `/admin?tab=exercises` continue to work.
- The new `source` filter is a parallel axis (description/dialog/picture), not a replacement for `modality`.
- The list endpoint now accepts new query params (`source`, `level`, `sort`) — all optional with sensible defaults, so existing clients ignore them safely.
- `AdminExerciseListItem` adds new fields (`question_el`, `question_en`, `correct_idx`, `correct_order`, `answer_el`) but does not remove any — additive only.

## Monitoring

- PostHog dashboard tile: track `admin_exercise_regenerated` daily volume + success rate. This is the cost-bearing event (OpenRouter call).
- Sentry alert: trigger on `POST /api/v1/admin/exercises/{id}/regenerate` 5xx error rate > 1 per hour.
- Loguru audit: every regenerate emits an `admin_exercise_regenerate` event with `admin_user_id`, `exercise_id`, `exercise_type`, `source_type` — searchable via Sentry MCP `search_events`.

## Feature flag decision

**No PostHog flag.** Admin audience is small (< 10 users); a gradual rollout adds complexity without value. Matches the precedent set by ADMIN2-22 (CER-59).

## Cross-references

- Analytics events: see `docs/analytics-events.md` § Admin Exercise Events (EXR-73 + EXR-81).
- Story spec: `Simon Vault/Projects/Greekly/User Stories/ADMIN2/ADMIN2-23 Exercises Tab Rebuild.md`.
