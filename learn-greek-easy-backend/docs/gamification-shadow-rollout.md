# Gamification Shadow-Mode Rollout

Phase 2 of the gamification migration: shadow mode runs `GamificationProjection.compute()` alongside the legacy path on `GET /xp/achievements` and `GET /xp/stats`, diffs the outputs, and emits structured logs. No writes, no response change, no user-visible effect.

## Enable shadow mode

On Railway `dev` environment, set one variable:

| Variable | Value | Default in `src/config.py` |
|----------|-------|---------------------------|
| `GAMIFICATION_SHADOW_MODE` | `true` | `False` |

Production remains at `False` until Phase 4. Preview environments inherit whatever the PR branch deploys with; override per-service as needed.

## Query diffs in Sentry

**Sentry Logs UI** — navigate to Logs, select environment `dev`, and search:

```
message:gamification.shadow.diff
```

To narrow to a specific endpoint:

```
message:gamification.shadow.diff endpoint:/api/v1/xp/achievements
```

**Sentry MCP** (`search_events` tool) — natural-language equivalent:

```
search_events("gamification.shadow.diff in dev environment last 24 hours")
```

Each diff log carries: `endpoint`, `user_id`, `legacy_only`, `projection_only`, `xp_delta`, `level_delta`, `per_metric_mismatches`, `projection_version`, `cache_hit`.

## Diff-class taxonomy

| Class | Field | Expected? | Example |
|-------|-------|-----------|---------|
| `legacy_only` | Achievement in legacy but not projection | Expected — streak achievements: legacy fires them, projection not yet wired | `legacy_only: ["streak_7"]` |
| `projection_only` | Achievement in projection but not legacy | Expected — new achievements added only to projection schema | `projection_only: ["vocab_100"]` |
| `xp_delta` | XP total differs between paths | Unexpected — same events should produce same XP | `xp_delta: 50` |
| `level_delta` | Level differs between paths | Unexpected — derived from XP; if XP matches, level must match | `level_delta: 1` |

**Expected** = known divergence from scope difference between legacy and projection. **Unexpected** = logic bug requiring investigation.

## Triage decision tree

```
diff log received
    │
    ├── legacy_only or projection_only only?
    │       └── Check taxonomy table above
    │               ├── Matches known expected class → no action
    │               └── Unexpected achievement name → file follow-up under story:gamif-01
    │
    └── xp_delta or level_delta non-zero?
            └── Always unexpected → file follow-up under story:gamif-01
                                    with user_id, endpoint, projection_version from log
```

## Observation window

| Environment | Minimum | Target |
|-------------|---------|--------|
| `dev` | 24 h | 48 h |
| `preview` | 24 h | 48 h |
| `production` | Out of scope | Phase 4 |

Advance to Phase 3 (schema migration) only after diffs in dev/preview are either zero or fully classified as expected.

## Sentry alert configuration

Manual setup via Sentry web UI (Alerts → Create Alert → Logs):

| Field | Value |
|-------|-------|
| Rule name | `gamification-shadow-diff-spike` |
| Query | `message:gamification.shadow.diff` |
| Threshold | 5× rolling-7d hourly baseline |
| Group by | `endpoint` |
| Environment filter | `dev` |
| Recipients | TBD per ops |

**Setup steps:**

1. Sentry dashboard → **Alerts** → **Create Alert** → select **Logs**.
2. Set query to `message:gamification.shadow.diff`.
3. Choose **Dynamic (Anomaly)** or **Static** threshold — set to 5× the rolling-7d hourly average for the `dev` environment.
4. Group results by `endpoint` attribute.
5. Add notification recipients under **Actions** (Slack channel or email — TBD per ops).
6. Save as `gamification-shadow-diff-spike`.

## Out of scope

- Enabling on production (Phase 4).
- Removing the `GAMIFICATION_SHADOW_MODE` flag (Phase 6, after full cutover).
- Schema migration to persist projection data (Phase 3, separate story: gamif-03).
