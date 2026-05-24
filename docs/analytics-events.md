# Analytics Events Convention

This document defines the standard for PostHog analytics events in Learn Greek Easy.

## When to Create Events

**DO create events for:**
- User-facing actions that indicate engagement (session start/complete, content viewed, feature used)
- Conversion-critical flows (checkout, subscription changes, trial lifecycle)
- Feature adoption signals (first use, repeated use)
- User content creation/modification (deck created, card edited)
- Premium gating (blocked access attempts)

**DO NOT create events for:**
- Admin panel actions — admin behavior is not product analytics
- Error tracking — use Sentry, not PostHog
- Granular UI interactions (button hover, modal open/close, filter applied) — unless directly tied to a product question
- Cancelled/abandoned actions that have no analytical value on their own
- Duplicate events for the same user intent (one event per meaningful moment)

**Rule of thumb:** Before adding an event, answer: "What product decision will this data inform?" If you can't answer, don't create the event.

## Naming Convention

Pattern: `{domain}_{entity}_{action}`

```
culture_session_started
news_article_clicked
user_deck_create_completed
checkout_session_created
premium_gate_blocked
```

### Rules

1. **snake_case** — always lowercase with underscores
2. **Domain first** — group by feature area (`culture_`, `news_`, `user_deck_`, `checkout_`)
3. **Entity in the middle** — what is being acted on (`session`, `article`, `deck`, `card`)
4. **Action last** — past tense verb (`started`, `completed`, `clicked`, `viewed`)
5. **No `my_`, `admin_`, or `page_` prefixes** — the domain is sufficient context
6. **Be specific** — `user_deck_create_completed` not `deck_action`

## How to Create Events

### Frontend — `track()` wrapper

All frontend events go through a single `track()` function:

```typescript
// lib/analytics/track.ts
import posthog from 'posthog-js';

export function track(event: string, properties?: Record<string, unknown>): void {
  if (typeof posthog?.capture === 'function') {
    posthog.capture(event, properties);
  }
}
```

Usage in components, stores, or utility functions:

```typescript
import { track } from '@/lib/analytics/track';

track('culture_session_started', { deck_id, question_count });
track('news_article_clicked', { item_id, article_domain });
```

**No per-domain analytics files.** No wrapper functions per event. Just `track(eventName, properties)`.

### Super Properties

Global context set once via `posthog.register()`:

- `theme` — current theme (`light`, `dark`, `system`)
- `interface_language` — current language (`el`, `en`, `ru`)
- `environment` — `development`, `staging`, `production`
- `app_version` — current app version

These are automatically attached to every event. Do not pass them as event properties.

### Backend — `capture_event()`

All backend events go through `capture_event()` in `src/core/posthog.py`:

```python
from src.core.posthog import capture_event

capture_event(
    user_id=str(user.id),
    event="checkout_completed",
    properties={"plan_id": plan_id, "billing_cycle": cycle},
)
```

This wrapper handles test user filtering and default property injection.

## Property Guidelines

1. **Use IDs, not names** — `deck_id` not `deck_name` (names change, IDs don't)
2. **Include only actionable properties** — if you won't filter/group by it, don't send it
3. **Use consistent types** — UUIDs as strings, timestamps as ISO 8601, enums as lowercase strings
4. **No PII** — never send emails, passwords, or personal data as properties

## File Locations

| Layer | File | Purpose |
|-------|------|---------|
| Frontend | `src/lib/analytics/track.ts` | Single `track()` function |
| Backend | `src/core/posthog.py` | `capture_event()` wrapper |

## Exercise Events

### `exercise_answered`

Fired each time a user submits an answer during an exercise practice session.

**Properties:**

- `exercise_id` (string) — UUID of the exercise.
- `exercise_type` (string) — the task type. Values:
  - `'select_picture'` — description→picture matching (`SELECT_PICTURE_FROM_DESCRIPTION`, Type A)
  - `'select_description'` — picture→description matching (`SELECT_DESCRIPTION_FROM_PICTURE`, Type B)
  - `'fill_gaps'` — fill-in-the-gap exercise
  - `'select_heard'` — select what you heard (listening comprehension)
  - `'true_false'` — true/false exercise
  - `'select_correct_answer'` — general multiple-choice exercise
- `modality` (string) — audio I/O channel: `'listening'`, `'reading'`, or `'all'`. **Separate from `exercise_type`** — modality describes the audio presentation channel, not the task format.
- `is_correct` (boolean) — whether the user's answer was correct.
- `response_time_ms` (number) — milliseconds from exercise render to answer submission.

## Admin Card Error Events (CER-59)

> **Note:** These admin-only events are an exception to the "DO NOT create events for admin panel actions" rule. They are scoped to the `admin_card_error_` prefix and are used to track admin review workflows.

### `admin_card_error_opened`

Fired when the CardErrorDrawer opens for a specific report.

**Properties:**

- `report_id` (string) — UUID of the card error report.
- `card_type` (string) — `'WORD'` or `'CULTURE'`.
- `status` (string) — current status at time of opening: `'PENDING'`, `'REVIEWED'`, `'FIXED'`, or `'DISMISSED'`.
- `has_admin_notes` (boolean) — whether the report already has admin notes.

### `admin_card_error_status_changed`

Fired when the admin selects a new status in the StatusGrid (pre-save, on change).

**Properties:**

- `report_id` (string) — UUID of the card error report.
- `from_status` (string) — status before the change.
- `to_status` (string) — status after the change.

### `admin_card_error_canned_reply_used`

Fired when the admin clicks a canned reply pill to populate the admin notes textarea.

**Properties:**

- `report_id` (string) — UUID of the card error report.
- `pill_key` (string) — key of the canned reply pill (e.g. `'confirmedFixed'`, `'needMoreInfo'`).

### `admin_card_error_saved`

Fired after a successful PATCH (status/notes update).

**Properties:**

- `report_id` (string) — UUID of the card error report.
- `final_status` (string) — status value sent in the PATCH.
- `notes_length` (number) — character count of admin notes (trimmed).
- `used_canned_reply` (boolean) — whether a canned reply pill was used in this session before saving.

### `admin_card_error_deleted`

Fired after a successful DELETE of a card error report.

**Properties:**

- `report_id` (string) — UUID of the card error report.
- `status_at_delete` (string) — the report's status at the time of deletion.
