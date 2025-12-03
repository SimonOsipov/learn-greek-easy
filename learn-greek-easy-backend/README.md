# Learn Greek Easy - Backend API

Backend API for the Learn Greek Easy Greek language learning application.

## Tech Stack

- **FastAPI 0.115+** - Modern async web framework
- **Python 3.14+** - Latest stable Python
- **PostgreSQL** - Primary database
- **Redis** - Caching and sessions
- **SQLAlchemy 2.0** - ORM
- **Alembic** - Database migrations
- **Celery** - Background tasks
- **JWT** - Authentication

## Quick Start

### Prerequisites

- Python 3.14+
- Poetry 2.2+
- PostgreSQL 16+
- Redis 7+

### Installation

1. Install dependencies with Poetry:
```bash
poetry install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Edit `.env` with your configuration

### Running Development Server

```bash
poetry run python run.py
# Or:
poetry run uvicorn src.main:app --reload
```

API will be available at:
- **API**: http://localhost:8000
- **Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Project Structure

```
learn-greek-easy-backend/
├── src/
│   ├── main.py           # FastAPI application
│   ├── config.py         # Configuration
│   ├── constants.py      # Constants
│   ├── api/              # API routes
│   ├── core/             # Core functionality
│   ├── db/               # Database
│   ├── models/           # SQLAlchemy models
│   ├── schemas/          # Pydantic schemas
│   ├── services/         # Business logic
│   └── utils/            # Utilities
├── tests/                # Test suite
└── alembic/              # Database migrations
```

## API Documentation

Interactive API documentation available at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Development

### Code Quality

```bash
# Run all linters
poetry run flake8 src tests
poetry run mypy src
poetry run black --check src tests
poetry run isort --check-only src tests

# Format code
poetry run black src tests
poetry run isort src tests
```

### Testing

```bash
# Run all tests
poetry run pytest

# Run with coverage
poetry run pytest --cov=src --cov-report=html --cov-report=term
```

### Database Migrations

```bash
# Create migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```

## Authentication

The API uses JWT tokens for authentication.

### Register
```bash
POST /api/v1/auth/register
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "full_name": "John Doe"
}
```

### Login
```bash
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

Returns:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

### Authenticated Requests
```bash
GET /api/v1/decks
Authorization: Bearer eyJ...
```

## Environment Variables

See `.env.example` for all available configuration options.

Key variables:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `JWT_SECRET_KEY` - JWT signing key
- `CORS_ORIGINS` - Allowed frontend origins

## Deployment

### Production Checklist

- [ ] Set `APP_ENV=production`
- [ ] Set strong `JWT_SECRET_KEY`
- [ ] Configure production database
- [ ] Set up Redis instance
- [ ] Configure CORS origins
- [ ] Enable Sentry error tracking
- [ ] Set up SSL/TLS
- [ ] Configure backup strategy
- [ ] Set up monitoring

### Docker

```bash
docker build -t learn-greek-easy-backend .
docker run -p 8000:8000 learn-greek-easy-backend
```

## Contributing

1. Create feature branch
2. Make changes
3. Run tests and linters
4. Submit pull request

## License

MIT
