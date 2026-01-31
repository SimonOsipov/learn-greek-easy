# E2E Test Database Seeding

The seeding infrastructure provides deterministic test data for E2E tests, enabling testing of features that require real data (flashcard reviews, analytics, spaced repetition states).

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `TEST_SEED_ENABLED` | `false` | Enable seeding endpoints |
| `TEST_SEED_SECRET` | (none) | Optional secret for `X-Test-Seed-Secret` header |
| `SEED_ON_DEPLOY` | `false` | Auto-seed on startup (local dev only) |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/test/seed/status` | GET | Check seeding availability (no auth) |
| `/api/v1/test/seed/all` | POST | Full seed (truncate + create all) |
| `/api/v1/test/seed/truncate` | POST | Truncate all tables |
| `/api/v1/test/seed/users` | POST | Create test users only |
| `/api/v1/test/seed/content` | POST | Create decks/cards only |
| `/api/v1/test/seed/culture` | POST | Create culture decks/questions only |
| `/api/v1/test/seed/mock-exams` | POST | Create mock exam history for learner |
| `/api/v1/test/seed/news-sources` | POST | Create news sources for admin testing |
| `/api/v1/test/seed/fetch-history` | POST | Create fetch history for news sources |
| `/api/v1/test/seed/pending-question` | POST | Create pending question for review testing |
| `/api/v1/test/seed/news-questions` | POST | Seed news items with linked culture questions |
| `/api/v1/test/seed/danger-zone` | POST | Create danger zone test users |
| `/api/v1/test/seed/admin-cards` | POST | Create vocabulary cards for admin E2E testing |

## Test Users Created

| Email | Password | Role |
|-------|----------|------|
| e2e_learner@test.com | TestPassword123! | Regular user with progress |
| e2e_beginner@test.com | TestPassword123! | New user, no progress |
| e2e_advanced@test.com | TestPassword123! | Advanced user |
| e2e_admin@test.com | TestPassword123! | Admin user |

## Data Created

- **4 Users**: Learner, Beginner, Advanced, Admin
- **6 Decks**: A1, A2, B1, B2, C1, C2 (CEFR levels)
- **60 Cards**: 10 Greek vocabulary cards per deck
- **Card Statistics**: SM-2 spaced repetition states for learner
- **Reviews**: Review history for learner user
- **5 Culture Decks**: History, Geography, Politics, Culture, Traditions
- **50 Culture Questions**: 10 trilingual questions per deck (el, en, ru)
- **5 Mock Exam Sessions**: 3 passed, 2 failed (for learner user)
- **125 Mock Exam Answers**: 25 answers per session
- **3 News Sources**: 2 active, 1 inactive (for admin testing)
- **4 Fetch History Entries**: 3 successful, 1 failed (for first news source)

### Mock Exam History

The seed data creates mock exam history for `e2e_learner@test.com` with the following sessions:

| Score | Percentage | Result | Time Taken | Age |
|-------|------------|--------|------------|-----|
| 23/25 | 92% | Pass | 20 min | 6 days ago |
| 21/25 | 84% | Pass | 25 min | 5 days ago |
| 12/25 | 48% | Fail | 15 min | 4 days ago |
| 20/25 | 80% | Pass | 22.5 min | 2 days ago |
| 15/25 | 60% | Fail | 18.3 min | 1 day ago |

**Note**: The pass threshold is 80% (20/25 correct answers).

### News Sources

The seed data creates news sources for admin panel testing:

| Name | URL | Status |
|------|-----|--------|
| Greek Reporter | https://greekreporter.com | Active |
| Kathimerini English | https://www.ekathimerini.com | Active |
| Inactive Test Source | https://inactive-test-source.example.com | Inactive |

### Fetch History

Seed endpoint: `POST /api/v1/test/seed/fetch-history`

**Note**: Requires `/seed/news-sources` to be called first (or use `/seed/all`).

The seed data creates fetch history entries for the first news source (Greek Reporter):

| Status | Trigger Type | Content | Age |
|--------|--------------|---------|-----|
| Success | scheduled | HTML test content | 1 day ago |
| Success | scheduled | HTML test content | 2 days ago |
| Success | manual | HTML test content | Today |
| Error | scheduled | Connection timeout error | 3 days ago |

This data is used for E2E testing of:
- Fetch history accordion display
- Success/error status badges
- HTML viewer modal

### Pending Question Seeding

Seeds a pending culture question for testing the admin review workflow.

**Endpoint:** `POST /api/v1/test/seed/pending-question`

**Response:**
```json
{
  "success": true,
  "message": "Created pending question {uuid}",
  "duration_ms": 15.5,
  "data": {
    "question_id": "uuid",
    "source_article_url": "https://example.com/..."
  }
}
```

**Use Cases:**
- Testing the QuestionReviewModal component
- Testing approve/reject workflows
- E2E tests for admin question management

The seeded question asks "Who was the first president of the Republic of Cyprus?" with options for four Cypriot presidents. The correct answer is Makarios III (option B).

### News Questions

Seed endpoint: `POST /api/v1/test/seed/news-questions`

Creates news items with associated culture questions for testing the news-to-practice flow:

| News Item | Has Question | Description |
|-----------|--------------|-------------|
| Cypriot Culture: Traditions | Yes | Links to spring festival question |
| History of Cyprus | Yes | Links to independence question |
| Current News | No | No associated question |

Questions are created in "E2E News Questions" culture deck (created if not exists).

This data is used for E2E testing of:
- Dashboard news card buttons (Questions button enabled when question exists)
- Questions button navigation to culture practice
- Source article link display during review

Note: This seeding is also included in `/seed/all`.

## Danger Zone Test Users

Seed endpoint: `POST /api/v1/test/seed/danger-zone`

**Note**: Requires `/seed/content` and `/seed/culture` to be called first (or use `/seed/all`).

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

Seed endpoint: `POST /api/v1/test/seed/admin-cards`

Creates vocabulary decks and cards for E2E testing of the admin vocabulary card management UI.

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

**Note**: This endpoint is standalone and does NOT depend on other seed endpoints. It is idempotent - existing E2E test decks are replaced on each call.

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
