# Learn Greek Easy

[![CI](https://github.com/SimonOsipov/learn-greek-easy/actions/workflows/test.yml/badge.svg)](https://github.com/SimonOsipov/learn-greek-easy/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/SimonOsipov/learn-greek-easy/branch/main/graph/badge.svg)](https://codecov.io/gh/SimonOsipov/learn-greek-easy)

Interactive Greek language learning platform for naturalization exam preparation.

## Testing

### Test Types

| Type | Command | Description |
|------|---------|-------------|
| Unit | `poetry run pytest tests/unit/` | Isolated function tests |
| Integration | `poetry run pytest tests/integration/` | Single endpoint + DB |
| E2E | `poetry run pytest tests/e2e/` | Complete user workflows |

### Quick Commands

```bash
# Run all tests
cd learn-greek-easy-backend && poetry run pytest

# Run with coverage
poetry run pytest --cov=src --cov-report=term-missing

# Run E2E tests only
poetry run pytest tests/e2e/ -m e2e -v
```

For detailed testing documentation, see:
- [Backend Testing Guide](learn-greek-easy-backend/TESTING.md)
