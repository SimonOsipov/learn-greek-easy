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
