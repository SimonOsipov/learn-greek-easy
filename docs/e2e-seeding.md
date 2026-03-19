# E2E Test Database Seeding

The seeding infrastructure provides deterministic test data for E2E tests, enabling testing of features that require real data (flashcard reviews, analytics, spaced repetition states).

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `TEST_SEED_ENABLED` | `false` | Enable seeding endpoints |
| `TEST_SEED_SECRET` | (none) | Optional secret for `X-Test-Seed-Secret` header |
| `SEED_ON_DEPLOY` | `false` | Auto-seed on startup (local dev only) |

## API Endpoints

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/test/seed/status` | GET | Check seeding availability (no auth) |
| `/api/v1/test/seed/all` | POST | Full seed (truncate + create all) |
| `/api/v1/test/seed/truncate` | POST | Truncate all tables |

### Content Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/test/seed/content` | POST | Create decks/cards only |
| `/api/v1/test/seed/culture` | POST | Create culture decks/questions only |
| `/api/v1/test/seed/mock-exams` | POST | Create mock exam history for learner |
| `/api/v1/test/seed/pending-question` | POST | Create pending question for review testing |
| `/api/v1/test/seed/news-feed` | POST | Create 5 news items |
| `/api/v1/test/seed/news-feed-page` | POST | Create 25 news items (10 with questions, 15 without) |
| `/api/v1/test/seed/news-feed/clear` | POST | Clear news items only |
| `/api/v1/test/seed/news-questions` | POST | Seed news items with linked culture questions |
| `/api/v1/test/seed/changelog` | POST | Create 12 changelog entries |
| `/api/v1/test/seed/announcements` | POST | Create 4 announcement campaigns |

### User & Account Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/test/seed/create-user` | POST | Create a test user in Supabase Auth + app DB |
| `/api/v1/test/seed/danger-zone` | POST | Create danger zone test users (standalone, NOT in `/seed/all`) |
| `/api/v1/test/seed/admin-cards` | POST | Create vocabulary cards for admin E2E testing |
| `/api/v1/test/seed/subscription-users` | POST | Create/update subscription test users |

## Test Users

### Auto-Provisioned Users

Test users are **auto-provisioned on first login**, not created by seeding. Users persist across seed operations to match Supabase Auth behavior.

**Required Setup (One-time):**
1. Manually create users in Supabase Auth Dashboard or via first login
2. Users are auto-created in PostgreSQL on first authenticated request
3. Users persist across `/seed/all` operations

| Email | Password | Role | Notes |
|-------|----------|------|-------|
| e2e_learner@test.com | TestPassword123! | Regular user | Gets progress data from seeding |
| e2e_beginner@test.com | TestPassword123! | New user | No progress data |
| e2e_advanced@test.com | TestPassword123! | Advanced user | Gets advanced progress data |
| e2e_admin@test.com | TestPassword123! | Admin | `is_superuser: true` |

**Important:** If test users don't exist in Supabase Auth, they will be auto-created by seed_all() for test environments only.

## Data Created by `/seed/all`

The full seed executes 19 steps in order:

| Step | Data | Details |
|------|------|---------|
| 1 | Truncate | Clean slate (all tables) |
| 2 | Base users | 4 test users (get or create) |
| 3 | V1 content | 6 decks (A1-C2), 60 cards (10 per deck) |
| 3b | User decks | User-owned decks for learner + admin (My Decks) |
| 3c | V2 decks | V2 card system decks with word entries |
| 3d | V2 statistics | CardRecordStatistics for learner on V2 Nouns deck (60% progress) |
| 3e | V2 reviews | CardRecordReview history for mastered + learning cards |
| 4-5 | Progress | Card statistics + review history for learner (A1 deck, 60%) |
| 6 | Notifications | Notifications for learner user |
| 7 | Feedback | Feedback items and votes |
| 8 | Achievements | Achievement definitions |
| 9 | XP users | 3 XP test users (boundary 99 XP, mid 4100 XP, max 100K XP) |
| 10 | Culture | 5 culture decks, 50 questions (10 per deck) |
| 11 | Culture progress | 60% for learner (History), 80% for advanced (all decks) |
| 12 | Mock exams | 5 sessions for learner (3 pass, 2 fail) |
| 13 | News items | 5 news items for dashboard |
| 14 | News questions | News items with linked culture questions |
| 15 | Announcements | 4 announcement campaigns |
| 16 | Changelog | 12 changelog entries |
| 17 | Subscription users | 5 users with various subscription states |
| 18 | Lexicon | Reference lexicon data |
| 19 | Translations | Reference translation data |

> **Note:** Danger zone users are NOT included in `/seed/all`. Use `/seed/danger-zone` separately.

### Mock Exam History

Created for `e2e_learner@test.com`:

| Score | Percentage | Result | Time Taken | Age |
|-------|------------|--------|------------|-----|
| 23/25 | 92% | Pass | 20 min | 6 days ago |
| 21/25 | 84% | Pass | 25 min | 5 days ago |
| 12/25 | 48% | Fail | 15 min | 4 days ago |
| 20/25 | 80% | Pass | 22.5 min | 2 days ago |
| 15/25 | 60% | Fail | 18.3 min | 1 day ago |

Pass threshold: 80% (20/25).

### Pending Question

Seeds a pending culture question for testing the admin review workflow.

**Endpoint:** `POST /api/v1/test/seed/pending-question`

The seeded question asks "Who was the first president of the Republic of Cyprus?" with options for four Cypriot presidents. Correct answer: Makarios III (option B).

### News Questions

`POST /api/v1/test/seed/news-questions`

| News Item | Has Question | Description |
|-----------|--------------|-------------|
| Cypriot Culture: Traditions | Yes | Links to spring festival question |
| History of Cyprus | Yes | Links to independence question |
| Current News | No | No associated question |

Questions created in "E2E News Questions" culture deck (created if not exists). Also included in `/seed/all`.

## Danger Zone Test Users

**Endpoint:** `POST /api/v1/test/seed/danger-zone` (standalone, NOT part of `/seed/all`)

**Prerequisite:** `/seed/content` and `/seed/culture` must be called first (or use `/seed/all` before).

| Email | Password | Purpose |
|-------|----------|---------|
| e2e_danger_reset@test.com | TestPassword123! | User with full progress for reset testing |
| e2e_danger_delete@test.com | TestPassword123! | User with minimal data for deletion testing |

### Data Seeded for Reset User

- 2 UserDeckProgress records
- CardStatistics for studied cards (10 cards: 6 mastered, 2 learning, 2 new)
- Reviews with progression pattern (40 reviews total)
- 500 XP (Level 3)
- 5 XPTransaction records
- 3 UserAchievements (streak_first_flame, learning_first_word, session_quick_study)
- 2 MockExamSessions with answers (1 passed, 1 failed)
- 10 CultureQuestionStats with history
- 5 Notifications (2 unread, 3 read)

## Admin Vocabulary Cards

**Endpoint:** `POST /api/v1/test/seed/admin-cards`

Standalone and idempotent — existing E2E test decks are replaced on each call.

### Decks Created

| Deck Name | Cards | Purpose |
|-----------|-------|---------|
| E2E Vocabulary Cards Test Deck | 10 | Testing card display, edit, delete operations |
| E2E Empty Vocabulary Deck | 0 | Testing first card creation in empty deck |

### Cards in Main Deck

| # | Greek | Type | Grammar Data |
|---|-------|------|--------------|
| 1 | καλημέρα | Basic | None (front_text + back_text_en only) |
| 2 | καληνύχτα | Basic + RU | back_text_ru added |
| 3 | ευχαριστώ | Basic + pronunciation | All basic fields |
| 4 | σπίτι | Noun (partial) | gender + 3 declension fields |
| 5 | νερό | Noun (full) | gender + all 8 declension fields |
| 6 | τρώω | Verb (active) | voice + 6 present conjugations |
| 7 | διαβάζομαι | Verb (passive) | voice + 9 conjugation fields |
| 8 | καλός | Adjective | 9 declension + 2 comparison fields |
| 9 | γρήγορα | Adverb | comparative + superlative |
| 10 | βιβλίο | Noun + examples | noun_data + 3 structured examples |

## Subscription Test Users

**Endpoint:** `POST /api/v1/test/seed/subscription-users`

Idempotent: existing users have subscription fields updated, new users get `User` + `UserSettings` rows created. Also included in `/seed/all` as Step 17.

| Email | Tier | Status | Billing Cycle | Cancel at Period End | Trial Start | Trial End | Period End | Created At |
|-------|------|--------|---------------|----------------------|-------------|-----------|------------|------------|
| `e2e_trial@test.com` | FREE | TRIALING | — | No | NOW-7d | NOW+7d | — | — |
| `e2e_expired_trial@test.com` | FREE | NONE | — | No | NOW-21d | NOW-7d | — | — |
| `e2e_premium@test.com` | PREMIUM | ACTIVE | MONTHLY | No | — | — | NOW+30d | NOW-60d |
| `e2e_cancelled@test.com` | PREMIUM | ACTIVE | QUARTERLY | Yes | — | — | NOW+15d | NOW-75d |
| `e2e_past_due@test.com` | PREMIUM | PAST_DUE | MONTHLY | No | — | — | NOW+5d | NOW-30d |

## CLI Usage

```bash
# Full seed
cd learn-greek-easy-backend && \
TEST_SEED_ENABLED=true poetry run python scripts/seed_e2e_data.py

# Dry run (show what would be done)
TEST_SEED_ENABLED=true poetry run python scripts/seed_e2e_data.py --dry-run

# Truncate only (clear all data)
TEST_SEED_ENABLED=true poetry run python scripts/seed_e2e_data.py --truncate-only
```

## API Usage

```bash
# Check status (no auth required)
curl http://localhost:8000/api/v1/test/seed/status

# Full seed
curl -X POST http://localhost:8000/api/v1/test/seed/all

# With secret (if configured)
curl -X POST http://localhost:8000/api/v1/test/seed/all \
  -H "X-Test-Seed-Secret: your-secret"

# Skip truncation (additive seeding)
curl -X POST http://localhost:8000/api/v1/test/seed/all \
  -H "Content-Type: application/json" \
  -d '{"options": {"skip_truncate": true}}'
```

## Auto-Seeding on Startup

Set `SEED_ON_DEPLOY=true` to automatically seed the database when the application starts. Only works in non-production environments with `TEST_SEED_ENABLED=true`.

## Security

1. **Production blocked**: Returns 403 in production environment
2. **Feature flag**: Requires `TEST_SEED_ENABLED=true`
3. **Optional secret**: Can require `X-Test-Seed-Secret` header
4. **Router not mounted**: Seed router is not even imported in production
