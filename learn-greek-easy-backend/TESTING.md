# Testing Guide for Learn Greek Easy Backend

This document describes the testing conventions, patterns, and commands for the Learn Greek Easy backend.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Test Structure](#test-structure)
3. [Running Tests](#running-tests)
4. [Writing Tests](#writing-tests)
5. [Fixtures](#fixtures)
6. [Factories](#factories)
7. [Helpers and Utilities](#helpers-and-utilities)
8. [Coverage](#coverage)
9. [CI/CD](#cicd)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)
12. [Unit vs Integration Testing Guide](#unit-vs-integration-testing-guide)
13. [Mocking Strategies](#mocking-strategies)
14. [Test Data Management](#test-data-management)
15. [Async Testing Patterns](#async-testing-patterns)
16. [Database Testing Patterns](#database-testing-patterns)
17. [Anti-Patterns (What NOT to Do)](#anti-patterns-what-not-to-do)
18. [Example Pattern Library](#example-pattern-library)

---

## Quick Start

```bash
# Run all tests
cd learn-greek-easy-backend && poetry run pytest

# Run with coverage
poetry run pytest --cov=src --cov-report=term-missing

# Run in parallel (faster)
poetry run pytest -n auto

# Run only unit tests
poetry run pytest -m unit

# Run only integration tests
poetry run pytest -m integration
```

---

## Test Structure

```
tests/
├── conftest.py               # Global fixtures (db_session, client, auth)
├── base.py                   # Base test classes
│
├── unit/                     # Fast, isolated tests with mocked dependencies
│   ├── conftest.py          # Unit-specific mock fixtures
│   ├── core/                # Core module tests (security, JWT, deps)
│   ├── services/            # Service layer tests
│   ├── middleware/          # Middleware tests
│   ├── repositories/        # Repository tests
│   └── infrastructure/      # Test framework tests
│
├── integration/              # Slower tests with real database
│   ├── conftest.py          # Integration-specific fixtures (URLs, test data)
│   └── api/                 # API endpoint tests
│
├── fixtures/                 # Pytest fixtures by domain
│   ├── auth.py              # User, token, header fixtures
│   ├── database.py          # Database session fixtures
│   ├── deck.py              # Deck and card fixtures
│   └── progress.py          # Progress and review fixtures
│
├── factories/                # Factory Boy factories for test data
│   ├── auth.py              # UserFactory, RefreshTokenFactory
│   ├── content.py           # DeckFactory, CardFactory
│   ├── progress.py          # ProgressFactory, ReviewFactory
│   └── providers/           # Custom Faker providers
│       └── greek.py         # Greek language provider
│
├── helpers/                  # Test utility functions
│   ├── api.py               # HTTP request helpers
│   ├── assertions.py        # Custom assertion helpers
│   ├── database.py          # Database utilities
│   ├── mocks.py             # Mock builders
│   └── time.py              # Time manipulation utilities
│
└── utils/                    # Complex test utilities
    └── builders.py          # Test data builders
```

---

## Running Tests

### Basic Commands

| Command | Description |
|---------|-------------|
| `poetry run pytest` | Run all tests |
| `poetry run pytest -v` | Verbose output |
| `poetry run pytest -vv` | Extra verbose (shows fixture values) |
| `poetry run pytest -x` | Stop on first failure |
| `poetry run pytest --lf` | Run last failed tests |
| `poetry run pytest --ff` | Run failed tests first, then rest |
| `poetry run pytest -k "test_login"` | Run tests matching pattern |

### By Marker

| Command | Description |
|---------|-------------|
| `poetry run pytest -m unit` | Unit tests only |
| `poetry run pytest -m integration` | Integration tests only |
| `poetry run pytest -m "not slow"` | Skip slow tests |
| `poetry run pytest -m auth` | Authentication tests |
| `poetry run pytest -m db` | Database tests |
| `poetry run pytest -m api` | API endpoint tests |
| `poetry run pytest -m "unit and auth"` | Unit auth tests |
| `poetry run pytest -m "not no_parallel"` | Parallelizable tests only |

### By Location

| Command | Description |
|---------|-------------|
| `poetry run pytest tests/unit/` | All unit tests |
| `poetry run pytest tests/unit/core/` | Core unit tests |
| `poetry run pytest tests/integration/api/` | API integration tests |
| `poetry run pytest tests/unit/test_security.py` | Single file |
| `poetry run pytest tests/unit/test_security.py::TestPasswordHashing` | Single class |
| `poetry run pytest tests/unit/test_security.py::TestPasswordHashing::test_hash_password` | Single test |

### Parallel Execution

```bash
# Auto-detect CPU count
poetry run pytest -n auto

# Specific worker count
poetry run pytest -n 4

# With loadscope distribution (group by module)
poetry run pytest -n auto --dist loadscope

# With loadfile distribution (group by file)
poetry run pytest -n auto --dist loadfile
```

### Useful Options

```bash
# Show print statements during tests
poetry run pytest -s

# Show local variables in tracebacks
poetry run pytest --tb=long

# Show only first failure traceback
poetry run pytest --tb=short

# Re-run failures up to 3 times
poetry run pytest --reruns 3

# Show slowest 10 tests
poetry run pytest --durations=10

# Generate JUnit XML report
poetry run pytest --junitxml=report.xml
```

---

## Writing Tests

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Test files | `test_<feature>.py` | `test_security.py` |
| Test classes | `Test<Feature><Aspect>` | `TestPasswordHashing` |
| Test methods | `test_<action>_<scenario>` | `test_login_invalid_password` |
| Test methods | `test_<action>_<expected_result>` | `test_hash_returns_bcrypt_hash` |

### Test Structure (AAA Pattern)

All tests should follow the Arrange-Act-Assert pattern:

```python
async def test_user_login_success(self, db_session, test_user):
    # Arrange - Set up test data and conditions
    credentials = {"email": test_user.email, "password": "TestPassword123!"}
    auth_service = AuthService(db_session)

    # Act - Execute the code being tested
    result = await auth_service.login(credentials["email"], credentials["password"])

    # Assert - Verify the expected outcome
    assert result is not None
    assert result.user.id == test_user.id
    assert result.access_token is not None
```

### Using Markers

```python
import pytest

@pytest.mark.unit
class TestPasswordHashing:
    """Unit tests for password hashing."""

    def test_hash_password_returns_string(self):
        result = hash_password("password")
        assert isinstance(result, str)

@pytest.mark.integration
@pytest.mark.db
class TestAuthAPI:
    """Integration tests for auth API."""

    async def test_register_endpoint(self, client):
        response = await client.post("/api/v1/auth/register", json={...})
        assert response.status_code == 201

@pytest.mark.slow
async def test_bulk_import(self, db_session):
    """This test takes > 1 second."""
    ...

@pytest.mark.no_parallel
async def test_global_state(self, db_session):
    """This test cannot run in parallel."""
    ...
```

### Async Tests

All async tests are automatically supported via `asyncio_mode = "auto"` in pytest config:

```python
# No @pytest.mark.asyncio needed!
async def test_async_operation(self, db_session):
    result = await some_async_function(db_session)
    assert result is not None
```

### Using Base Test Classes

```python
from tests.base import (
    BaseTestCase,
    AuthenticatedTestCase,
    DatabaseTestCase,
)

class TestMyFeature(BaseTestCase):
    """Tests that don't need database access."""

    def test_something(self):
        assert True

class TestWithDatabase(DatabaseTestCase):
    """Tests that need database but not auth."""

    async def test_db_operation(self, db_session):
        # db_session is available
        ...

class TestProtectedEndpoint(AuthenticatedTestCase):
    """Tests that need authentication."""

    async def test_protected(self, client, auth_headers):
        response = await client.get("/protected", headers=auth_headers)
        assert response.status_code == 200
```

---

## Fixtures

### Database Fixtures (`tests/fixtures/database.py`)

| Fixture | Scope | Description |
|---------|-------|-------------|
| `db_engine` | function | Async SQLAlchemy engine |
| `db_session` | function | Async session with rollback |
| `db_session_with_savepoint` | function | Session with savepoint support |
| `fast_db_session` | function | Optimized session for faster tests |
| `session_db_engine` | session | Shared engine across tests |
| `worker_id` | session | Pytest-xdist worker ID |
| `is_parallel_run` | session | Whether running in parallel |
| `clean_tables` | function | Clean specific tables |
| `verify_isolation` | function | Verify test isolation |

### Auth Fixtures (`tests/fixtures/auth.py`)

| Fixture | Scope | Description |
|---------|-------|-------------|
| `test_user` | function | Standard test user |
| `test_superuser` | function | Admin user |
| `test_verified_user` | function | User with verified email |
| `test_inactive_user` | function | Deactivated user |
| `two_users` | function | Tuple of two users |
| `test_user_tokens` | function | AuthTokens for test_user |
| `superuser_tokens` | function | AuthTokens for superuser |
| `access_token` | function | JWT access token string |
| `refresh_token_value` | function | JWT refresh token (in DB) |
| `auth_headers` | function | `{"Authorization": "Bearer ..."}` |
| `superuser_auth_headers` | function | Superuser auth headers |
| `expired_auth_headers` | function | Expired token headers |
| `authenticated_user` | function | Bundle: user + tokens + headers |
| `authenticated_superuser` | function | Superuser bundle |
| `expired_access_token` | function | Expired JWT token |
| `invalid_token` | function | Malformed token string |

### Content Fixtures (`tests/fixtures/deck.py`)

| Fixture | Scope | Description |
|---------|-------|-------------|
| `test_deck` | function | Single deck |
| `test_deck_a1` | function | A1 level deck |
| `test_deck_a2` | function | A2 level deck |
| `test_deck_b1` | function | B1 level deck |
| `inactive_deck` | function | Inactive deck |
| `empty_deck` | function | Deck with no cards |
| `test_card` | function | Single card |
| `test_cards` | function | List of cards |
| `cards_by_difficulty` | function | Cards grouped by difficulty |
| `deck_with_cards` | function | DeckWithCards namedtuple |
| `multi_level_decks` | function | MultiLevelDecks namedtuple |
| `two_decks` | function | Tuple of two decks |
| `deck_with_many_cards` | function | Deck with 50+ cards |

### Progress Fixtures (`tests/fixtures/progress.py`)

| Fixture | Scope | Description |
|---------|-------|-------------|
| `user_deck_progress` | function | UserDeckProgress record |
| `fresh_user_progress` | function | New user starting deck |
| `completed_deck_progress` | function | 100% completed deck |
| `new_card_statistics` | function | CardStatus.NEW stats |
| `learning_card_statistics` | function | CardStatus.LEARNING stats |
| `review_card_statistics` | function | CardStatus.REVIEW stats |
| `mastered_card_statistics` | function | CardStatus.MASTERED stats |
| `due_card_statistics` | function | Card due today |
| `overdue_card_statistics` | function | Card overdue |
| `cards_by_status` | function | Cards at each status |
| `multiple_due_cards` | function | Multiple due cards |
| `test_review` | function | Single review |
| `perfect_review` | function | Quality 5 review |
| `failed_review` | function | Quality 1 review |
| `review_history` | function | 7-day review history |

### Unit Test Fixtures (`tests/unit/conftest.py`)

| Fixture | Scope | Description |
|---------|-------|-------------|
| `mock_db_session` | function | Mock AsyncSession |
| `mock_auth` | function | Mock AuthService |
| `mock_email` | function | Mock EmailService |
| `mock_redis` | function | Mock Redis client |

### Integration Test Fixtures (`tests/integration/conftest.py`)

| Fixture | Scope | Description |
|---------|-------|-------------|
| `api_base_url` | function | "/api/v1" |
| `auth_url` | function | "/api/v1/auth" |
| `decks_url` | function | "/api/v1/decks" |
| `cards_url` | function | "/api/v1/cards" |
| `reviews_url` | function | "/api/v1/reviews" |
| `valid_registration_data` | function | Valid registration dict |
| `valid_login_data` | function | Valid login credentials |
| `invalid_login_data` | function | Invalid credentials |

### Using Fixtures

```python
class TestUserCreation:
    async def test_create_user(self, db_session):
        """db_session is automatically injected."""
        user = User(email="test@example.com", ...)
        db_session.add(user)
        await db_session.commit()

    async def test_with_existing_user(self, db_session, test_user):
        """test_user is already created and committed."""
        assert test_user.id is not None
        assert test_user.email is not None

    async def test_with_auth(self, client, auth_headers, test_user):
        """Authenticated request for the test_user."""
        response = await client.get("/api/v1/me", headers=auth_headers)
        assert response.json()["id"] == str(test_user.id)
```

---

## Factories

### Available Factories

```python
from tests.factories import (
    UserFactory,
    UserSettingsFactory,
    RefreshTokenFactory,
    DeckFactory,
    CardFactory,
    UserDeckProgressFactory,
    CardStatisticsFactory,
    ReviewFactory,
)
```

### Using Factories

```python
async def test_with_factory(self, db_session):
    # Create user with default values
    user = await UserFactory.create_async(db_session)

    # Create with specific values
    user = await UserFactory.create_async(
        db_session,
        email="custom@example.com",
        is_superuser=True,
    )

    # Use traits
    admin = await UserFactory.create_async(db_session, admin=True)
    inactive = await UserFactory.create_async(db_session, inactive=True)
    google_user = await UserFactory.create_async(db_session, oauth=True)

    # Create deck with cards
    deck = await DeckFactory.create_async(db_session, a1=True)
    cards = await CardFactory.create_batch_async(db_session, 10, deck=deck)
```

### Factory Traits

| Factory | Traits |
|---------|--------|
| `UserFactory` | `admin`, `inactive`, `oauth`, `verified`, `logged_in` |
| `DeckFactory` | `a1`, `a2`, `b1`, `b2`, `c1`, `c2` |
| `CardFactory` | `easy`, `medium`, `hard` |
| `CardStatisticsFactory` | `new`, `learning`, `review`, `mastered`, `due`, `overdue`, `struggling` |

### Greek Language Provider

```python
from tests.factories.providers.greek import GreekProvider

# Use in factories automatically, or directly:
fake = Faker()
fake.add_provider(GreekProvider)

word = fake.greek_word()
phrase = fake.greek_phrase()
```

---

## Helpers and Utilities

### Assertions (`tests/helpers/assertions.py`)

```python
from tests.helpers.assertions import (
    assert_valid_user_response,
    assert_valid_token_response,
    assert_api_error,
    assert_sm2_calculation,
    assert_pagination,
    assert_valid_deck_response,
    assert_valid_card_response,
    assert_card_due,
    assert_card_not_due,
)

# Example usage
response = await client.post("/api/v1/auth/login", json=credentials)
assert_valid_token_response(response.json())

response = await client.get("/api/v1/decks")
assert_pagination(response.json(), expected_total=10)
```

### Time Utilities (`tests/helpers/time.py`)

```python
from tests.helpers.time import (
    freeze_time,
    create_expired_token,
    create_due_date,
    past_time,
    advance_time,
)

# Freeze time for deterministic tests
with freeze_time("2025-01-15"):
    assert date.today() == date(2025, 1, 15)

# Create expired tokens for testing
expired = create_expired_token(user.id, hours_ago=2)

# Create dates for review testing
due_date = create_due_date(days_ahead=3)
overdue_date = create_due_date(days_ago=2)
```

### API Helpers (`tests/helpers/api.py`)

```python
from tests.helpers.api import (
    make_authenticated_request,
    extract_tokens_from_response,
    build_pagination_params,
    create_auth_headers,
    assert_status_code,
)

# Make authenticated request
response = await make_authenticated_request(
    client, "GET", "/api/v1/decks",
    auth_headers,
    params=build_pagination_params(page=1, page_size=10),
)

# Extract tokens from login response
tokens = extract_tokens_from_response(response.json())
```

### Mock Builders (`tests/helpers/mocks.py`)

```python
from tests.helpers.mocks import (
    mock_redis_client,
    mock_async_session,
    mock_auth_service,
    mock_email_service,
    configure_redis_cache,
)

# Create mocks for unit tests
redis = mock_redis_client()
redis.get.return_value = b'cached_value'

session = mock_async_session()
session.execute.return_value = mock_result

# Configure cache behavior
configure_redis_cache(redis, {
    "user:123": b'{"name": "Test"}',
})
```

### Test Data Builders (`tests/utils/builders.py`)

```python
from tests.utils import ReviewSessionBuilder, ProgressScenarioBuilder

# Build a review session
result = await (
    ReviewSessionBuilder(db_session)
    .for_user(test_user)
    .for_deck(deck)
    .with_cards(cards[:5])
    .with_ratings([5, 4, 4, 3, 5])
    .build()
)

# Build a progress scenario
scenario = await (
    ProgressScenarioBuilder(db_session)
    .for_user(test_user)
    .with_deck(deck)
    .with_cards_studied(10)
    .with_cards_mastered(3)
    .build()
)
```

---

## Coverage

### Running Coverage

```bash
# Terminal report
poetry run pytest --cov=src --cov-report=term-missing

# HTML report
poetry run pytest --cov=src --cov-report=html
open htmlcov/index.html

# XML report (for CI)
poetry run pytest --cov=src --cov-report=xml

# With fail threshold
poetry run pytest --cov=src --cov-fail-under=90

# Combined reports
poetry run pytest --cov=src --cov-report=term-missing --cov-report=html --cov-report=xml
```

### Coverage Configuration

Coverage is configured in `pyproject.toml`:

```toml
[tool.coverage.run]
source = ["src"]
branch = true
omit = ["*/migrations/*", "*/tests/*"]

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "raise AssertionError",
    "raise NotImplementedError",
]
```

### Coverage Targets

| Module | Target |
|--------|--------|
| Overall | >= 90% |
| Core (auth, security) | >= 95% |
| Services | >= 90% |
| API endpoints | >= 85% |
| Models | >= 80% |

---

## CI/CD

### GitHub Actions

Tests run automatically on:
- Push to `main` or `develop`
- Pull requests to `main`

The CI pipeline (`.github/workflows/test.yml`):
1. Starts PostgreSQL service
2. Installs dependencies with Poetry
3. Runs tests in parallel (`-n auto`)
4. Generates coverage report
5. Uploads to Codecov
6. Reports results

### Local CI Simulation

```bash
# Run tests as CI would
poetry run pytest -n auto --cov=src --cov-report=xml --cov-fail-under=90

# Run with PostgreSQL (ensure Docker is running)
docker-compose up -d postgres
poetry run pytest
```

### Pre-commit Hooks

Tests can be integrated with pre-commit:

```yaml
# .pre-commit-config.yaml
- repo: local
  hooks:
    - id: pytest
      name: pytest
      entry: poetry run pytest tests/unit/ -x
      language: system
      pass_filenames: false
      always_run: true
```

---

## Best Practices

### General Guidelines

1. **One assertion per test** (logically, not literally)
2. **Test behavior, not implementation** - focus on what code does, not how
3. **Use descriptive test names** - test name should describe the scenario
4. **Keep tests independent** - no shared mutable state between tests
5. **Use fixtures for setup, not test methods** - leverage pytest fixtures
6. **Mock external dependencies in unit tests** - isolate the unit under test
7. **Use real database in integration tests** - test actual behavior
8. **Mark slow tests with `@pytest.mark.slow`** - allow selective running

### Test Organization

```python
class TestFeatureName:
    """Tests for FeatureName."""

    class TestSuccessCases:
        """Happy path tests."""

        async def test_basic_success(self): ...
        async def test_with_optional_params(self): ...

    class TestErrorCases:
        """Error handling tests."""

        async def test_invalid_input(self): ...
        async def test_not_found(self): ...

    class TestEdgeCases:
        """Edge case tests."""

        async def test_empty_input(self): ...
        async def test_max_values(self): ...
```

### Assertion Best Practices

```python
# Good: Specific, clear assertions
assert user.email == "test@example.com"
assert response.status_code == 201
assert len(results) == 5

# Better: With messages for complex assertions
assert user.is_active, "User should be active after registration"
assert "access_token" in response.json(), "Response should contain access_token"

# Best: Use custom assertions for domain objects
assert_valid_user_response(response.json())
assert_sm2_calculation(stats, expected_interval=6)
```

### Fixture Best Practices

```python
# Good: Small, focused fixtures
@pytest.fixture
def test_user(db_session):
    return create_user(db_session)

# Better: Composable fixtures
@pytest.fixture
def user_with_progress(test_user, test_deck, db_session):
    return create_progress(db_session, test_user, test_deck)

# Best: Parametrized fixtures for variations
@pytest.fixture(params=["A1", "A2", "B1"])
def deck_at_level(request, db_session):
    return create_deck(db_session, level=request.param)
```

---

## Troubleshooting

### Common Issues

#### Tests fail with database errors

```bash
# Ensure PostgreSQL is running
docker-compose up -d postgres

# Check connection
docker exec -it learn-greek-postgres psql -U postgres -d test_learn_greek -c "SELECT 1"

# Reset test database
docker exec -it learn-greek-postgres psql -U postgres -c "DROP DATABASE IF EXISTS test_learn_greek"
docker exec -it learn-greek-postgres psql -U postgres -c "CREATE DATABASE test_learn_greek"
```

#### Parallel tests fail randomly

```bash
# Run without parallelism to debug
poetry run pytest tests/path/to/failing_test.py -v

# Check for shared state
poetry run pytest tests/path/to/failing_test.py -x --tb=long

# Run with isolation verification
poetry run pytest --forked  # Requires pytest-forked
```

#### Import errors

```bash
# Ensure you're in the right directory
cd learn-greek-easy-backend
poetry run pytest

# Check PYTHONPATH
poetry run python -c "import sys; print(sys.path)"

# Reinstall dependencies
poetry install
```

#### Fixture not found

```bash
# List available fixtures
poetry run pytest --fixtures

# Check fixture scope
poetry run pytest --fixtures | grep your_fixture_name

# Verify conftest.py is in correct location
ls -la tests/**/conftest.py
```

#### Async test issues

```python
# Ensure pytest-asyncio is configured
# In pyproject.toml:
[tool.pytest.ini_options]
asyncio_mode = "auto"

# Or mark individual tests:
@pytest.mark.asyncio
async def test_something():
    ...
```

### Debug Tools

```bash
# Drop into debugger on failure
poetry run pytest --pdb

# Drop into debugger at start of each test
poetry run pytest --trace

# Print output during test run
poetry run pytest -s

# Verbose failure information
poetry run pytest -vv --tb=long

# Show test collection without running
poetry run pytest --collect-only
```

### Performance Issues

```bash
# Profile test duration
poetry run pytest --durations=10

# Run only fast tests
poetry run pytest -m "not slow"

# Limit to specific tests during development
poetry run pytest tests/unit/test_specific.py -x
```

---

## 12. Unit vs Integration Testing Guide

### When to Write Unit Tests

Unit tests are appropriate when:

| Scenario | Example |
|----------|---------|
| Testing pure logic | SM-2 algorithm calculations |
| Testing validation | Password strength validation |
| Testing transformations | Data formatting functions |
| Testing error conditions | Exception handling |
| Testing business rules | Card difficulty calculation |

**Characteristics of good unit test candidates:**
- Function has clear inputs and outputs
- Logic doesn't depend on database state
- External dependencies can be easily mocked
- Fast execution (< 10ms per test)

### When to Write Integration Tests

Integration tests are appropriate when:

| Scenario | Example |
|----------|---------|
| Testing API endpoints | POST /api/v1/auth/login |
| Testing database operations | User creation with settings |
| Testing authentication flows | Token refresh cycle |
| Testing cross-service logic | Deck progress with reviews |
| Testing cascading operations | Delete deck with cards |

**Characteristics of integration test candidates:**
- Multiple components interact
- Database transactions matter
- Real HTTP request/response cycle needed
- Testing actual SQL queries

### Decision Flowchart

```
Is the code under test:
├── A pure function with no side effects?
│   └── → Unit test
├── A database operation (CRUD)?
│   └── → Integration test (real DB)
├── An API endpoint?
│   └── → Integration test (with TestClient)
├── A service method with complex logic?
│   ├── Logic portion → Unit test (mocked DB)
│   └── DB interaction → Integration test
└── A utility/helper function?
    └── → Unit test
```

### Hybrid Approach Example

For `AuthService.login()`:

```python
# Unit tests (mocked DB) - test business logic
class TestAuthServiceLoginLogic:
    async def test_login_rejects_inactive_user(self, mock_db_session):
        # Test the logic: inactive users can't login
        mock_db_session.execute.return_value.scalar_one_or_none.return_value = inactive_user
        with pytest.raises(AuthenticationError):
            await auth_service.login("email", "password")

# Integration tests (real DB) - test actual flow
class TestAuthServiceLoginIntegration:
    async def test_login_creates_refresh_token_in_database(self, db_session, test_user):
        # Test the integration: token actually stored
        result = await AuthService(db_session).login(test_user.email, "password")
        token = await db_session.execute(select(RefreshToken).where(...))
        assert token is not None
```

---

## 13. Mocking Strategies

### When to Mock

| Mock | Don't Mock |
|------|------------|
| External APIs (translation, email) | Your own code under test |
| Time-sensitive operations | Database in integration tests |
| Third-party services | Simple value objects |
| Expensive computations in unit tests | Core business logic |
| Random/UUID generation for determinism | Fixtures and factories |

### Mock Hierarchy

```
1. Fixture-level mocks (conftest.py)
   └── Shared across multiple tests in a scope

2. Test-level mocks (individual tests)
   └── Specific to one test scenario

3. Module-level patches (at import)
   └── Replace entire modules (rare)
```

### Mocking the Database in Unit Tests

```python
from tests.helpers.mocks import mock_async_session

class TestUserService:
    async def test_get_user_returns_user(self, mock_db_session):
        # Arrange
        expected_user = User(id=uuid4(), email="test@example.com")

        # Configure mock to return expected user
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = expected_user
        mock_db_session.execute.return_value = mock_result

        # Act
        service = UserService(mock_db_session)
        result = await service.get_user_by_email("test@example.com")

        # Assert
        assert result == expected_user
        mock_db_session.execute.assert_called_once()
```

### Mocking External Services

```python
from tests.helpers.mocks import mock_email_service, mock_redis_client

class TestRegistration:
    async def test_registration_sends_welcome_email(self, db_session, mocker):
        # Arrange
        email_mock = mock_email_service()
        mocker.patch("src.services.auth.email_service", email_mock)

        # Act
        await register_user(db_session, {"email": "new@example.com", ...})

        # Assert
        email_mock.send_welcome_email.assert_called_once_with("new@example.com")
```

### Mocking Time

```python
from tests.helpers.time import freeze_time, create_expired_token

class TestTokenExpiration:
    async def test_expired_token_rejected(self):
        with freeze_time("2025-01-15 12:00:00"):
            # Token created "now"
            token = create_access_token(user_id)

        with freeze_time("2025-01-16 12:00:00"):  # 24 hours later
            # Token should be expired
            with pytest.raises(ExpiredTokenError):
                verify_access_token(token)
```

### Partial Mocking

```python
async def test_service_with_partial_mock(self, db_session, mocker):
    """Mock only external call, use real DB."""
    # Only mock the external API call
    mocker.patch(
        "src.services.deck_service.fetch_word_definition",
        return_value={"definition": "hello"}
    )

    # Real database operations
    service = DeckService(db_session)
    result = await service.create_card_with_definition(deck_id, "word")

    # Verify DB state
    assert result.id is not None
    card = await db_session.get(Card, result.id)
    assert card is not None
```

---

## 14. Test Data Management

### Data Creation Hierarchy

Use the simplest approach that works:

```
1. Inline data (simplest)
   user_data = {"email": "test@example.com"}

2. Fixtures (shared across tests)
   @pytest.fixture
   def test_user(db_session): ...

3. Factories (customizable)
   user = await UserFactory.create_async(db_session, admin=True)

4. Builders (complex scenarios)
   result = await ReviewSessionBuilder(db_session).for_user(user).build()
```

### When to Use Each Approach

| Approach | Use When |
|----------|----------|
| Inline | Single-use data, test is self-contained |
| Fixtures | Standard scenarios, shared setup |
| Factories | Need variations, traits, multiple instances |
| Builders | Complex multi-entity scenarios |

### Test Data Isolation

```python
# GOOD: Each test creates its own data
async def test_user_creation(self, db_session):
    user = await UserFactory.create_async(db_session)
    # Test with this user

async def test_another_feature(self, db_session):
    user = await UserFactory.create_async(db_session)  # Fresh user
    # Test with fresh user

# BAD: Shared mutable state
class TestFeature:
    user = None  # DON'T DO THIS

    async def test_one(self, db_session):
        self.user = await UserFactory.create_async(db_session)

    async def test_two(self, db_session):
        # Depends on test_one running first - FRAGILE
        assert self.user is not None
```

### Managing Related Entities

```python
# Create a deck with cards using fixtures
@pytest.fixture
async def deck_with_cards(db_session, test_user):
    deck = await DeckFactory.create_async(db_session, created_by_id=test_user.id)
    cards = await CardFactory.create_batch_async(db_session, 5, deck=deck)
    return DeckWithCards(deck=deck, cards=cards)

# Or use the builder for complex scenarios
async def test_review_session(self, db_session, test_user):
    result = await (
        ReviewSessionBuilder(db_session)
        .for_user(test_user)
        .with_cards(cards)
        .with_ratings([5, 4, 3, 4, 5])
        .build()
    )
    assert len(result.reviews) == 5
```

### Cleanup Considerations

The test framework handles cleanup automatically via rollback:

```python
@pytest_asyncio.fixture
async def db_session(session_db_engine):
    """Session rolls back after each test - automatic cleanup."""
    async with session_factory() as session:
        try:
            yield session
        finally:
            await session.rollback()  # All changes undone
```

---

## 15. Async Testing Patterns

### Basic Async Test

```python
# No decorator needed with asyncio_mode = "auto"
async def test_async_operation(self, db_session):
    result = await some_async_function(db_session)
    assert result is not None
```

### Testing Async Generators

```python
async def test_streaming_response(self, db_session):
    results = []
    async for item in get_cards_stream(db_session, deck_id):
        results.append(item)

    assert len(results) == expected_count
```

### Testing Concurrent Operations

```python
import asyncio

async def test_concurrent_reviews(self, db_session, test_user, cards):
    """Test that concurrent review submissions don't conflict."""
    # Create review tasks
    tasks = [
        submit_review(db_session, test_user.id, card.id, quality=4)
        for card in cards[:5]
    ]

    # Execute concurrently
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Verify all succeeded
    assert all(not isinstance(r, Exception) for r in results)
```

### Testing Async Context Managers

```python
async def test_transaction_context(self, db_session):
    async with db_session.begin_nested():
        user = await UserFactory.create_async(db_session)
        assert user.id is not None
    # Savepoint committed

    # Verify user persisted
    result = await db_session.get(User, user.id)
    assert result is not None
```

### Testing Async Timeouts

```python
import asyncio

async def test_operation_completes_quickly(self, db_session):
    """Ensure operation doesn't hang."""
    async def timed_operation():
        return await slow_operation(db_session)

    # Should complete within 1 second
    result = await asyncio.wait_for(timed_operation(), timeout=1.0)
    assert result is not None
```

### Common Async Pitfalls

```python
# WRONG: Forgetting to await
async def test_bad_example(self, db_session):
    result = some_async_function(db_session)  # Missing await!
    assert result  # This asserts on coroutine object, not result

# CORRECT:
async def test_good_example(self, db_session):
    result = await some_async_function(db_session)
    assert result
```

---

## 16. Database Testing Patterns

### Transaction Isolation

Tests run in isolated transactions that rollback:

```python
async def test_user_creation_isolated(self, db_session):
    """Changes don't persist after test."""
    user = await UserFactory.create_async(db_session)
    await db_session.commit()  # Committed within test transaction

    # After test ends, rollback undoes this

async def test_next_test_clean_slate(self, db_session):
    """Previous test's data is not visible."""
    users = await db_session.execute(select(User))
    assert users.scalars().all() == []  # Clean slate
```

### Testing Unique Constraints

```python
async def test_duplicate_email_rejected(self, db_session):
    # Create first user
    await UserFactory.create_async(db_session, email="test@example.com")

    # Attempt duplicate
    with pytest.raises(IntegrityError):
        await UserFactory.create_async(db_session, email="test@example.com")
        await db_session.commit()
```

### Testing Cascading Deletes

```python
async def test_deck_deletion_removes_cards(self, db_session, deck_with_cards):
    deck = deck_with_cards.deck
    card_ids = [c.id for c in deck_with_cards.cards]

    # Delete deck
    await db_session.delete(deck)
    await db_session.commit()

    # Verify cards deleted (if CASCADE configured)
    for card_id in card_ids:
        card = await db_session.get(Card, card_id)
        assert card is None
```

### Testing Database Constraints

```python
async def test_foreign_key_constraint(self, db_session):
    """Card requires valid deck_id."""
    with pytest.raises(IntegrityError):
        card = Card(
            deck_id=uuid4(),  # Non-existent deck
            front_text="Hello",
            back_text="World"
        )
        db_session.add(card)
        await db_session.commit()
```

### Testing Enum Values

```python
async def test_card_difficulty_enum(self, db_session, test_deck):
    """Test PostgreSQL enum column."""
    # Valid enum value
    card = await CardFactory.create_async(
        db_session,
        deck=test_deck,
        difficulty=CardDifficulty.HARD
    )
    assert card.difficulty == CardDifficulty.HARD

    # Reload from DB
    await db_session.refresh(card)
    assert card.difficulty == CardDifficulty.HARD
```

### Testing Query Performance (Slow Tests)

```python
@pytest.mark.slow
async def test_large_dataset_query(self, db_session):
    """Test query performance with many records."""
    # Create 1000 cards
    deck = await DeckFactory.create_async(db_session)
    await CardFactory.create_batch_async(db_session, 1000, deck=deck)

    # Time the query
    import time
    start = time.time()
    result = await db_session.execute(
        select(Card).where(Card.deck_id == deck.id)
    )
    cards = result.scalars().all()
    elapsed = time.time() - start

    assert len(cards) == 1000
    assert elapsed < 1.0  # Should complete in under 1 second
```

---

## 17. Anti-Patterns (What NOT to Do)

### Anti-Pattern 1: Test Interdependency

```python
# BAD: Tests depend on execution order
class TestUserWorkflow:
    created_user_id = None

    async def test_1_create_user(self, db_session):
        user = await create_user(db_session, ...)
        self.__class__.created_user_id = user.id

    async def test_2_update_user(self, db_session):
        # FAILS if test_1 doesn't run first
        await update_user(db_session, self.created_user_id, ...)

# GOOD: Independent tests with fixtures
class TestUserWorkflow:
    async def test_create_user(self, db_session):
        user = await create_user(db_session, ...)
        assert user.id is not None

    async def test_update_user(self, db_session, test_user):
        # Uses fixture, doesn't depend on other tests
        await update_user(db_session, test_user.id, ...)
```

### Anti-Pattern 2: Over-Mocking

```python
# BAD: Mocking the system under test
async def test_auth_service_overmocked(self, mocker):
    mocker.patch("src.services.auth.AuthService.login")  # Mocking what we're testing!
    result = await AuthService().login("email", "password")
    # This tests nothing useful

# GOOD: Mock dependencies, not the subject
async def test_auth_service(self, db_session, mocker):
    mocker.patch("src.services.auth.send_login_notification")  # External side effect
    service = AuthService(db_session)  # Real service
    result = await service.login("email", "password")  # Real login logic
```

### Anti-Pattern 3: Brittle Assertions

```python
# BAD: Testing implementation details
async def test_brittle(self, db_session):
    result = await get_user_stats(db_session, user_id)
    # Fails if internal structure changes
    assert result["_internal_cache_key"] == "user_123_stats"
    assert result["_query_count"] == 3

# GOOD: Test behavior/output
async def test_robust(self, db_session):
    result = await get_user_stats(db_session, user_id)
    assert result["cards_studied"] >= 0
    assert result["streak_days"] >= 0
```

### Anti-Pattern 4: Flaky Time-Based Tests

```python
# BAD: Depends on execution timing
async def test_flaky_timing(self):
    start = datetime.utcnow()
    await some_operation()
    end = datetime.utcnow()
    assert (end - start).total_seconds() < 0.1  # Might fail randomly

# GOOD: Use frozen time or relaxed assertions
async def test_stable_timing(self):
    with freeze_time("2025-01-15 12:00:00"):
        result = create_token_with_expiry()
        assert result.expires_at == datetime(2025, 1, 15, 13, 0, 0)  # Deterministic
```

### Anti-Pattern 5: Missing Error Case Tests

```python
# BAD: Only testing happy path
class TestLogin:
    async def test_login_success(self, db_session, test_user):
        result = await login(test_user.email, "password")
        assert result.access_token

# GOOD: Test error cases too
class TestLogin:
    async def test_login_success(self, db_session, test_user):
        result = await login(test_user.email, "password")
        assert result.access_token

    async def test_login_wrong_password(self, db_session, test_user):
        with pytest.raises(AuthenticationError):
            await login(test_user.email, "wrong_password")

    async def test_login_nonexistent_user(self, db_session):
        with pytest.raises(UserNotFoundError):
            await login("nobody@example.com", "password")

    async def test_login_inactive_user(self, db_session, test_inactive_user):
        with pytest.raises(AccountDisabledError):
            await login(test_inactive_user.email, "password")
```

### Anti-Pattern 6: Hardcoded Test Data

```python
# BAD: Hardcoded UUIDs and values
async def test_hardcoded(self, db_session):
    user_id = "550e8400-e29b-41d4-a716-446655440000"  # Will conflict
    user = User(id=user_id, email="test@test.com")
    db_session.add(user)

# GOOD: Let factories/database generate IDs
async def test_generated_ids(self, db_session):
    user = await UserFactory.create_async(db_session)  # UUID generated
    assert user.id is not None  # Don't care what it is
```

### Anti-Pattern 7: Testing Framework Code

```python
# BAD: Testing pytest/SQLAlchemy internals
async def test_sqlalchemy_works(self, db_session):
    assert hasattr(db_session, 'execute')
    assert db_session.is_active

# GOOD: Test your application code
async def test_user_repository(self, db_session):
    repo = UserRepository(db_session)
    user = await repo.create(email="test@example.com", ...)
    assert user.email == "test@example.com"
```

### Anti-Pattern 8: Giant Test Methods

```python
# BAD: One test doing too much
async def test_everything(self, db_session, client):
    # Create user
    user = await create_user(db_session, ...)
    assert user.id
    # Create deck
    deck = await create_deck(db_session, user.id, ...)
    assert deck.id
    # Add cards
    for i in range(10):
        card = await create_card(db_session, deck.id, ...)
        assert card.id
    # Test API endpoint
    response = await client.get(f"/decks/{deck.id}")
    assert response.status_code == 200
    # Test another endpoint
    response = await client.get(f"/decks/{deck.id}/cards")
    assert len(response.json()) == 10
    # ...50 more assertions...

# GOOD: Focused tests with fixtures
async def test_deck_creation(self, db_session, test_user):
    deck = await create_deck(db_session, test_user.id, name="Test")
    assert deck.name == "Test"

async def test_get_deck_endpoint(self, client, auth_headers, test_deck):
    response = await client.get(f"/decks/{test_deck.id}", headers=auth_headers)
    assert response.status_code == 200
```

### Anti-Pattern Summary Table

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| Test interdependency | Fragile, order-dependent | Use fixtures, independent tests |
| Over-mocking | Tests nothing real | Mock dependencies, not subject |
| Brittle assertions | Break on refactoring | Test behavior, not implementation |
| Flaky timing | Random failures | Freeze time, relax constraints |
| Missing error cases | Incomplete coverage | Test all code paths |
| Hardcoded data | ID conflicts, fragility | Use factories, generated values |
| Testing framework | Wasted effort | Focus on application code |
| Giant tests | Hard to maintain, debug | Split into focused tests |

---

## 18. Example Pattern Library

Copy-paste ready examples for common testing scenarios in Learn Greek Easy.

### Example 1: Testing API Endpoints with Authentication

```python
"""Testing protected API endpoints."""

import pytest
from httpx import AsyncClient

class TestDeckAPI:
    """API tests for deck endpoints."""

    @pytest.mark.integration
    async def test_create_deck_authenticated(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Authenticated user can create a deck."""
        response = await client.post(
            "/api/v1/decks",
            headers=auth_headers,
            json={
                "name": "Greek Basics",
                "description": "Basic Greek vocabulary",
                "level": "A1",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Greek Basics"
        assert data["level"] == "A1"
        assert "id" in data

    @pytest.mark.integration
    async def test_create_deck_unauthenticated(
        self,
        client: AsyncClient,
    ):
        """Unauthenticated request returns 401."""
        response = await client.post(
            "/api/v1/decks",
            json={"name": "Test", "level": "A1"},
        )

        assert response.status_code == 401
        assert "detail" in response.json()

    @pytest.mark.integration
    async def test_get_own_decks(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session,
    ):
        """User sees only their own decks."""
        # Create deck for test_user
        my_deck = await DeckFactory.create_async(
            db_session,
            created_by_id=test_user.id,
        )

        # Create deck for another user
        other_user = await UserFactory.create_async(db_session)
        other_deck = await DeckFactory.create_async(
            db_session,
            created_by_id=other_user.id,
        )

        response = await client.get(
            "/api/v1/decks",
            headers=auth_headers,
        )

        assert response.status_code == 200
        deck_ids = [d["id"] for d in response.json()["items"]]
        assert str(my_deck.id) in deck_ids
        assert str(other_deck.id) not in deck_ids
```

### Example 2: Testing SM-2 Algorithm Calculations

```python
"""Testing the SM-2 spaced repetition algorithm."""

import pytest
from datetime import date, timedelta
from tests.helpers.assertions import assert_sm2_calculation

class TestSM2Algorithm:
    """Tests for SM-2 algorithm implementation."""

    @pytest.mark.unit
    def test_first_successful_review(self):
        """First successful review (quality >= 3) sets interval to 1."""
        result = calculate_sm2(
            quality=4,
            repetitions=0,
            easiness_factor=2.5,
            interval=0,
        )

        assert result.interval == 1
        assert result.repetitions == 1
        assert result.easiness_factor >= 2.5

    @pytest.mark.unit
    def test_second_successful_review(self):
        """Second successful review sets interval to 6."""
        result = calculate_sm2(
            quality=4,
            repetitions=1,
            easiness_factor=2.5,
            interval=1,
        )

        assert result.interval == 6
        assert result.repetitions == 2

    @pytest.mark.unit
    def test_failed_review_resets_progress(self):
        """Quality < 3 resets repetitions and interval."""
        result = calculate_sm2(
            quality=2,  # Failed
            repetitions=5,
            easiness_factor=2.5,
            interval=30,
        )

        assert result.interval == 1
        assert result.repetitions == 0

    @pytest.mark.unit
    @pytest.mark.parametrize("quality,expected_ef_change", [
        (5, 0.10),   # Perfect: EF increases
        (4, 0.00),   # Good: EF unchanged
        (3, -0.14),  # Hard: EF decreases
        (2, -0.32),  # Failed: EF decreases more
    ])
    def test_easiness_factor_adjustment(self, quality, expected_ef_change):
        """EF adjusts based on quality rating."""
        initial_ef = 2.5
        result = calculate_sm2(
            quality=quality,
            repetitions=3,
            easiness_factor=initial_ef,
            interval=10,
        )

        # EF should change by approximately the expected amount
        actual_change = result.easiness_factor - initial_ef
        assert abs(actual_change - expected_ef_change) < 0.01

    @pytest.mark.unit
    def test_easiness_factor_minimum(self):
        """EF never drops below 1.3."""
        result = calculate_sm2(
            quality=0,  # Complete blackout
            repetitions=1,
            easiness_factor=1.3,  # Already at minimum
            interval=1,
        )

        assert result.easiness_factor >= 1.3

    @pytest.mark.integration
    async def test_sm2_integration_with_review(
        self,
        db_session,
        test_user,
        test_card,
    ):
        """Full integration: review updates card statistics."""
        # Initial state
        stats = await CardStatisticsFactory.create_async(
            db_session,
            user_id=test_user.id,
            card_id=test_card.id,
            interval=0,
            repetitions=0,
            easiness_factor=2.5,
        )

        # Submit review
        review_service = ReviewService(db_session)
        result = await review_service.submit_review(
            user_id=test_user.id,
            card_id=test_card.id,
            quality=4,
        )

        # Verify statistics updated
        await db_session.refresh(stats)
        assert stats.repetitions == 1
        assert stats.interval == 1
        assert stats.next_review_date == date.today() + timedelta(days=1)
```

### Example 3: Testing Database Transactions

```python
"""Testing database transaction behavior."""

import pytest
from sqlalchemy.exc import IntegrityError

class TestDatabaseTransactions:
    """Tests for transactional behavior."""

    @pytest.mark.integration
    async def test_successful_transaction(self, db_session):
        """Successful operations commit together."""
        # Create related entities
        user = await UserFactory.create_async(db_session)
        deck = await DeckFactory.create_async(db_session, created_by_id=user.id)
        card = await CardFactory.create_async(db_session, deck=deck)

        await db_session.commit()

        # All entities persisted
        assert await db_session.get(User, user.id) is not None
        assert await db_session.get(Deck, deck.id) is not None
        assert await db_session.get(Card, card.id) is not None

    @pytest.mark.integration
    async def test_failed_transaction_rollback(self, db_session):
        """Failed operation rolls back entire transaction."""
        user = await UserFactory.create_async(db_session)

        try:
            # This will fail (duplicate email)
            await UserFactory.create_async(db_session, email=user.email)
            await db_session.commit()
        except IntegrityError:
            await db_session.rollback()

        # Original user still exists after rollback
        result = await db_session.execute(
            select(User).where(User.id == user.id)
        )
        assert result.scalar_one_or_none() is not None

    @pytest.mark.integration
    async def test_savepoint_nested_transaction(self, db_session):
        """Savepoints allow partial rollback."""
        user = await UserFactory.create_async(db_session)

        async with db_session.begin_nested():  # Savepoint
            deck1 = await DeckFactory.create_async(db_session, created_by_id=user.id)
            # Savepoint commits

        try:
            async with db_session.begin_nested():  # Another savepoint
                deck2 = await DeckFactory.create_async(db_session, created_by_id=user.id)
                raise ValueError("Simulated error")
        except ValueError:
            pass  # Savepoint rolled back

        await db_session.commit()

        # deck1 persisted, deck2 rolled back
        assert await db_session.get(Deck, deck1.id) is not None
        # deck2 was never committed due to rollback
```

### Example 4: Testing Error Handling and Exceptions

```python
"""Testing error handling in services."""

import pytest
from src.exceptions import (
    AuthenticationError,
    CardNotFoundError,
    DeckNotFoundError,
    PermissionDeniedError,
)

class TestAuthenticationErrors:
    """Tests for authentication error handling."""

    @pytest.mark.unit
    async def test_invalid_credentials_raises_error(
        self,
        db_session,
        test_user,
    ):
        """Wrong password raises AuthenticationError."""
        service = AuthService(db_session)

        with pytest.raises(AuthenticationError) as exc_info:
            await service.authenticate(
                email=test_user.email,
                password="wrong_password",
            )

        assert "Invalid credentials" in str(exc_info.value)

    @pytest.mark.unit
    async def test_expired_token_error(self):
        """Expired token raises specific error."""
        from tests.helpers.time import create_expired_token

        token = create_expired_token(uuid4(), hours_ago=2)

        with pytest.raises(ExpiredTokenError):
            verify_access_token(token)

    @pytest.mark.integration
    async def test_not_found_error(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Non-existent resource returns 404."""
        fake_id = str(uuid4())
        response = await client.get(
            f"/api/v1/decks/{fake_id}",
            headers=auth_headers,
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    @pytest.mark.integration
    async def test_permission_denied(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session,
    ):
        """Cannot access another user's private resource."""
        # Create another user's deck
        other_user = await UserFactory.create_async(db_session)
        other_deck = await DeckFactory.create_async(
            db_session,
            created_by_id=other_user.id,
            is_public=False,
        )

        response = await client.get(
            f"/api/v1/decks/{other_deck.id}",
            headers=auth_headers,  # Different user
        )

        assert response.status_code == 403
```

### Example 5: Testing Background Tasks / Async Operations

```python
"""Testing asynchronous and background operations."""

import pytest
import asyncio
from unittest.mock import AsyncMock

class TestAsyncOperations:
    """Tests for async background operations."""

    @pytest.mark.unit
    async def test_concurrent_access(self, db_session, test_deck):
        """Multiple concurrent reads don't conflict."""
        async def read_deck():
            return await db_session.get(Deck, test_deck.id)

        # 10 concurrent reads
        results = await asyncio.gather(*[read_deck() for _ in range(10)])

        assert all(d.id == test_deck.id for d in results)

    @pytest.mark.unit
    async def test_background_task_triggered(self, mocker, db_session, test_user):
        """Background task is queued after action."""
        # Mock the task queue
        mock_enqueue = mocker.patch(
            "src.tasks.send_notification.delay",
            return_value=AsyncMock(),
        )

        # Action that triggers background task
        await complete_user_registration(db_session, test_user)

        # Verify task was queued
        mock_enqueue.assert_called_once_with(
            user_id=str(test_user.id),
            notification_type="welcome",
        )

    @pytest.mark.slow
    async def test_long_running_operation_completes(self, db_session):
        """Long operation completes within timeout."""
        async def long_operation():
            # Simulate processing 100 cards
            for _ in range(100):
                await asyncio.sleep(0.01)
            return "completed"

        result = await asyncio.wait_for(
            long_operation(),
            timeout=5.0,
        )

        assert result == "completed"

    @pytest.mark.unit
    async def test_retry_on_failure(self, mocker):
        """Operation retries on transient failure."""
        # Mock function that fails twice, then succeeds
        call_count = 0

        async def flaky_function():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ConnectionError("Transient failure")
            return "success"

        result = await retry_async(flaky_function, max_retries=3)

        assert result == "success"
        assert call_count == 3
```

### Example 6: Testing with Complex Fixtures (Builders)

```python
"""Testing complex scenarios with data builders."""

import pytest
from tests.utils import (
    ReviewSessionBuilder,
    ProgressScenarioBuilder,
    StudyStreakBuilder,
)

class TestComplexScenarios:
    """Tests using data builders for complex scenarios."""

    @pytest.mark.integration
    async def test_review_session_updates_progress(
        self,
        db_session,
        test_user,
        deck_with_cards,
    ):
        """Complete review session updates all statistics."""
        # Build a review session
        session_result = await (
            ReviewSessionBuilder(db_session)
            .for_user(test_user)
            .for_deck(deck_with_cards.deck)
            .with_cards(deck_with_cards.cards[:5])
            .with_ratings([5, 4, 4, 3, 5])  # Average: 4.2
            .build()
        )

        # Verify session data
        assert len(session_result.reviews) == 5
        assert session_result.average_quality == 4.2

        # Verify statistics created
        for stats in session_result.statistics:
            assert stats.repetitions == 1
            assert stats.next_review_date is not None

    @pytest.mark.integration
    async def test_user_progress_scenario(
        self,
        db_session,
        test_user,
        deck_with_cards,
    ):
        """Build and verify user progress state."""
        result = await (
            ProgressScenarioBuilder(db_session)
            .for_user(test_user)
            .with_deck(
                deck_with_cards.deck,
                cards=deck_with_cards.cards,
                studied=10,
                mastered=5,
            )
            .as_intermediate()
            .build()
        )

        assert result.total_cards_studied >= 10
        assert result.total_cards_mastered >= 5

        # Verify in database
        progress = result.progress_records[0]
        assert progress.cards_studied == 10
        assert progress.cards_mastered == 5

    @pytest.mark.integration
    async def test_study_streak_calculation(
        self,
        db_session,
        test_user,
        deck_with_cards,
    ):
        """Verify streak calculation from review history."""
        result = await (
            StudyStreakBuilder(db_session)
            .for_user(test_user)
            .with_cards(deck_with_cards.cards)
            .with_streak(days=7)
            .ending_today()
            .with_cards_per_day(10)
            .build()
        )

        assert result.streak_days == 7
        assert len(result.study_dates) == 7

        # Verify streak calculation service
        streak_service = StreakService(db_session)
        calculated_streak = await streak_service.get_current_streak(test_user.id)
        assert calculated_streak == 7
```

---

**Last Updated**: 2025-12-01
**Version**: 2.0
**Maintained By**: Development Team
