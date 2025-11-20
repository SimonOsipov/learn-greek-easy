# Backend Task 02: Database Design & Schema Creation

## Overview

This task establishes the database foundation for the Learn Greek Easy application by designing and implementing SQLAlchemy 2.0 models with async support, PostgreSQL schema with optimized indexes, Alembic migrations, and Pydantic schemas for API validation.

### Goals

1. Design a normalized PostgreSQL database schema aligned with frontend data structures
2. Implement SQLAlchemy 2.0 async models with proper relationships
3. Create Alembic migration system for version-controlled schema changes
4. Develop Pydantic schemas for request/response validation
5. Establish database session management with dependency injection
6. Optimize schema for spaced repetition algorithm (SM-2) performance

### Dependencies

- Task 01 Complete: Python 3.14, FastAPI, Poetry, SQLAlchemy 2.0, Alembic
- Frontend TypeScript types (reference implementation)
- PostgreSQL 16+ database instance

### Estimated Duration

3-4 hours

---

## Database Schema Design

### Entity Relationship Diagram (Text Format)

```
┌─────────────────────┐
│       users         │
│─────────────────────│
│ id (PK)            │◄──────┐
│ email (UQ)         │       │
│ password_hash      │       │
│ name               │       │
│ avatar_url         │       │
│ is_active          │       │
│ is_premium         │       │
│ created_at         │       │
│ updated_at         │       │
│ last_login_at      │       │
└─────────────────────┘       │
                              │
                              │ FK: user_id
                              │
┌─────────────────────┐       │
│       decks         │       │
│─────────────────────│       │
│ id (PK)            │◄──────┼──────┐
│ title              │       │      │
│ title_greek        │       │      │
│ description        │       │      │
│ level (A1/A2/etc)  │       │      │
│ category           │       │      │
│ card_count         │       │      │
│ estimated_time     │       │      │
│ is_premium         │       │      │
│ thumbnail_url      │       │      │
│ created_by         │       │      │
│ created_at         │       │      │
│ updated_at         │       │      │
└─────────────────────┘       │      │
                              │      │ FK: deck_id
                              │      │
┌─────────────────────┐       │      │
│       cards         │       │      │
│─────────────────────│       │      │
│ id (PK)            │◄──────┼──────┼──────┐
│ deck_id (FK)       │───────┘      │      │
│ front (Greek)      │              │      │
│ back (English)     │              │      │
│ pronunciation      │              │      │
│ example            │              │      │
│ example_translation│              │      │
│ part_of_speech     │              │      │
│ metadata (JSON)    │              │      │
│ order_index        │              │      │
│ created_at         │              │      │
│ updated_at         │              │      │
└─────────────────────┘              │      │
                                     │      │ FK: card_id
                                     │      │
┌──────────────────────────┐         │      │
│  user_deck_progress      │         │      │
│──────────────────────────│         │      │
│ id (PK)                 │         │      │
│ user_id (FK)            │─────────┘      │
│ deck_id (FK)            │────────────────┘
│ status (enum)           │
│ cards_new               │
│ cards_learning          │
│ cards_review            │
│ cards_mastered          │
│ due_today               │
│ streak                  │
│ total_time_spent        │
│ accuracy                │
│ last_studied_at         │
│ started_at              │
│ completed_at            │
│ created_at              │
│ updated_at              │
└──────────────────────────┘
         │
         │ FK: progress_id (composite with user/deck)
         │
         ▼
┌──────────────────────────┐         ┌─────────────────────┐
│    card_statistics       │         │      reviews        │
│──────────────────────────│         │─────────────────────│
│ id (PK)                 │         │ id (PK)            │
│ user_id (FK)            │─────────┤ user_id (FK)       │
│ card_id (FK)            │─────────┤ card_id (FK)       │
│ deck_id (FK)            │─────────┤ deck_id (FK)       │
│                          │         │ session_id         │
│ --- SM-2 Algorithm ---  │         │ rating (enum)      │
│ state (enum)            │         │ time_spent         │
│ interval                │         │ ease_factor_after  │
│ ease_factor             │         │ interval_after     │
│ repetitions             │         │ state_after        │
│ step                    │         │ reviewed_at        │
│ due_date                │         │ created_at         │
│ last_reviewed_at        │         └─────────────────────┘
│                          │
│ --- Statistics ---      │
│ review_count            │
│ success_count           │
│ failure_count           │
│ success_rate            │
│                          │
│ created_at              │
│ updated_at              │
└──────────────────────────┘

┌─────────────────────────┐
│   refresh_tokens        │
│─────────────────────────│
│ id (PK)                │
│ user_id (FK)           │─────────┐
│ token_hash             │         │
│ expires_at             │         │
│ revoked                │         │
│ created_at             │         │
│ revoked_at             │         │
└─────────────────────────┘         │
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │    user_settings    │
                         │─────────────────────│
                         │ id (PK)            │
                         │ user_id (FK/UQ)    │
                         │ language           │
                         │ daily_goal         │
                         │ notifications      │
                         │ sound_enabled      │
                         │ theme              │
                         │ created_at         │
                         │ updated_at         │
                         └─────────────────────┘
```

### Key Design Decisions

1. **Normalized Schema**: Separate tables for each entity to ensure data integrity
2. **Soft Deletes**: Use `is_active` flags rather than hard deletes
3. **Audit Columns**: `created_at`, `updated_at` on all tables
4. **Composite Indexes**: Optimized for SM-2 algorithm queries (user_id + due_date)
5. **JSON Metadata**: Flexible storage for card-specific data (noun cases, verb conjugations)
6. **Enum Types**: PostgreSQL enums for type safety (deck_level, card_state, review_rating)

---

## Detailed Subtasks

### 02.01: Setup Database Connection & Session Management
**Duration**: 30 minutes

**Deliverables**:
- `src/db/session.py` - Async SQLAlchemy engine and session factory
- `src/db/base.py` - Base model class with common columns
- `src/db/dependencies.py` - FastAPI dependency for database sessions

**Implementation**:

```python
# src/db/session.py
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from src.config import settings

# Async engine with connection pooling
engine = create_async_engine(
    settings.database_url,
    pool_size=settings.database_pool_size,
    max_overflow=settings.database_max_overflow,
    pool_timeout=settings.database_pool_timeout,
    echo=settings.debug,
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Dependency for FastAPI routes
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

**Testing**:
- Verify connection to PostgreSQL
- Test session lifecycle (create, commit, rollback)
- Validate connection pooling

---

### 02.02: Create Base Model & Mixins
**Duration**: 20 minutes

**Deliverables**:
- `src/db/base.py` - Declarative base and common mixins

**Implementation**:

```python
# src/db/base.py
from datetime import datetime
from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.sql import func

class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass

class TimestampMixin:
    """Mixin for created_at and updated_at columns."""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
```

---

### 02.03: Define PostgreSQL Enums
**Duration**: 15 minutes

**Deliverables**:
- `src/models/enums.py` - Python enums mapped to PostgreSQL enums

**Implementation**:

```python
# src/models/enums.py
import enum

class DeckLevel(str, enum.Enum):
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"

class DeckCategory(str, enum.Enum):
    VOCABULARY = "vocabulary"
    GRAMMAR = "grammar"
    PHRASES = "phrases"
    CULTURE = "culture"

class DeckStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

class CardState(str, enum.Enum):
    NEW = "new"
    LEARNING = "learning"
    REVIEW = "review"
    RELEARNING = "relearning"
    MASTERED = "mastered"

class ReviewRating(str, enum.Enum):
    AGAIN = "again"
    HARD = "hard"
    GOOD = "good"
    EASY = "easy"

class PartOfSpeech(str, enum.Enum):
    NOUN = "noun"
    VERB = "verb"
    ADJECTIVE = "adjective"
    ADVERB = "adverb"
    PHRASE = "phrase"
```

---

### 02.04: Implement User Model
**Duration**: 25 minutes

**Deliverables**:
- `src/models/user.py` - User, UserSettings, RefreshToken models

**Implementation**:

```python
# src/models/user.py
from sqlalchemy import String, Boolean, DateTime, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.db.base import Base, TimestampMixin
from typing import Optional, List
from datetime import datetime

class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    settings: Mapped["UserSettings"] = relationship(back_populates="user", uselist=False)
    deck_progress: Mapped[List["UserDeckProgress"]] = relationship(back_populates="user")
    card_stats: Mapped[List["CardStatistics"]] = relationship(back_populates="user")
    reviews: Mapped[List["Review"]] = relationship(back_populates="user")
    refresh_tokens: Mapped[List["RefreshToken"]] = relationship(back_populates="user")

class UserSettings(Base, TimestampMixin):
    __tablename__ = "user_settings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)

    language: Mapped[str] = mapped_column(String(2), default="en", nullable=False)
    daily_goal: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sound_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    theme: Mapped[str] = mapped_column(String(10), default="system", nullable=False)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="settings")

class RefreshToken(Base, TimestampMixin):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    user: Mapped["User"] = relationship(back_populates="refresh_tokens")
```

**Indexes**:
- `users.email` (unique)
- `refresh_tokens.user_id`
- `refresh_tokens.token_hash` (unique)

---

### 02.05: Implement Deck & Card Models
**Duration**: 35 minutes

**Deliverables**:
- `src/models/deck.py` - Deck model
- `src/models/card.py` - Card model

**Implementation**:

```python
# src/models/deck.py
from sqlalchemy import String, Integer, Boolean, Text, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.db.base import Base, TimestampMixin
from src.models.enums import DeckLevel, DeckCategory
from typing import Optional, List

class Deck(Base, TimestampMixin):
    __tablename__ = "decks"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # e.g., "deck-a1-basics"
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    title_greek: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    level: Mapped[DeckLevel] = mapped_column(SQLEnum(DeckLevel), nullable=False, index=True)
    category: Mapped[DeckCategory] = mapped_column(SQLEnum(DeckCategory), nullable=False, index=True)

    card_count: Mapped[int] = mapped_column(Integer, nullable=False)
    estimated_time: Mapped[int] = mapped_column(Integer, nullable=False)  # minutes

    is_premium: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(500))
    created_by: Mapped[str] = mapped_column(String(100), default="Learn Greek Easy")

    # Relationships
    cards: Mapped[List["Card"]] = relationship(back_populates="deck", cascade="all, delete-orphan")
    user_progress: Mapped[List["UserDeckProgress"]] = relationship(back_populates="deck")

# src/models/card.py
from sqlalchemy import String, Integer, Text, ForeignKey, JSON, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.db.base import Base, TimestampMixin
from src.models.enums import PartOfSpeech
from typing import Optional, List, Dict, Any

class Card(Base, TimestampMixin):
    __tablename__ = "cards"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # e.g., "card-a1-001"
    deck_id: Mapped[str] = mapped_column(ForeignKey("decks.id", ondelete="CASCADE"), index=True)

    front: Mapped[str] = mapped_column(Text, nullable=False)  # Greek word/phrase
    back: Mapped[str] = mapped_column(Text, nullable=False)  # English translation
    pronunciation: Mapped[Optional[str]] = mapped_column(String(200))
    example: Mapped[Optional[str]] = mapped_column(Text)  # Greek example sentence
    example_translation: Mapped[Optional[str]] = mapped_column(Text)

    part_of_speech: Mapped[Optional[PartOfSpeech]] = mapped_column(SQLEnum(PartOfSpeech))
    metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)  # noun_data, verb_data

    order_index: Mapped[int] = mapped_column(Integer, nullable=False)  # Order in deck

    # Relationships
    deck: Mapped["Deck"] = relationship(back_populates="cards")
    statistics: Mapped[List["CardStatistics"]] = relationship(back_populates="card")
    reviews: Mapped[List["Review"]] = relationship(back_populates="card")
```

**Indexes**:
- `decks.level`
- `decks.category`
- `decks.is_premium`
- `cards.deck_id`
- Composite: `cards(deck_id, order_index)`

---

### 02.06: Implement Progress Tracking Models
**Duration**: 40 minutes

**Deliverables**:
- `src/models/progress.py` - UserDeckProgress, CardStatistics models

**Implementation**:

```python
# src/models/progress.py
from sqlalchemy import String, Integer, Float, ForeignKey, DateTime, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.db.base import Base, TimestampMixin
from src.models.enums import DeckStatus, CardState
from typing import Optional
from datetime import datetime

class UserDeckProgress(Base, TimestampMixin):
    __tablename__ = "user_deck_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "deck_id", name="uq_user_deck"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    deck_id: Mapped[str] = mapped_column(ForeignKey("decks.id", ondelete="CASCADE"), index=True)

    status: Mapped[DeckStatus] = mapped_column(
        SQLEnum(DeckStatus),
        default=DeckStatus.NOT_STARTED,
        nullable=False
    )

    # Card distribution
    cards_new: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cards_learning: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cards_review: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cards_mastered: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    due_today: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Progress metrics
    streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_time_spent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # seconds
    accuracy: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Timestamps
    last_studied_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    user: Mapped["User"] = relationship(back_populates="deck_progress")
    deck: Mapped["Deck"] = relationship(back_populates="user_progress")

class CardStatistics(Base, TimestampMixin):
    __tablename__ = "card_statistics"
    __table_args__ = (
        UniqueConstraint("user_id", "card_id", name="uq_user_card"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    card_id: Mapped[str] = mapped_column(ForeignKey("cards.id", ondelete="CASCADE"), index=True)
    deck_id: Mapped[str] = mapped_column(ForeignKey("decks.id", ondelete="CASCADE"), index=True)

    # SM-2 Algorithm Data
    state: Mapped[CardState] = mapped_column(
        SQLEnum(CardState),
        default=CardState.NEW,
        nullable=False,
        index=True
    )
    interval: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # days
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5, nullable=False)
    repetitions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    step: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    due_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        index=True
    )  # Critical for query performance
    last_reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Statistics
    review_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    success_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failure_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    success_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="card_stats")
    card: Mapped["Card"] = relationship(back_populates="statistics")
```

**Critical Indexes**:
- Composite: `card_statistics(user_id, due_date)` - For "due cards" query
- Composite: `card_statistics(user_id, deck_id, state)` - For deck progress queries
- `user_deck_progress(user_id, deck_id)` (unique)

---

### 02.07: Implement Review Model
**Duration**: 20 minutes

**Deliverables**:
- `src/models/review.py` - Review history model

**Implementation**:

```python
# src/models/review.py
from sqlalchemy import String, Integer, Float, ForeignKey, DateTime, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.db.base import Base, TimestampMixin
from src.models.enums import ReviewRating, CardState
from datetime import datetime

class Review(Base, TimestampMixin):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    card_id: Mapped[str] = mapped_column(ForeignKey("cards.id", ondelete="CASCADE"), index=True)
    deck_id: Mapped[str] = mapped_column(ForeignKey("decks.id", ondelete="CASCADE"), index=True)

    session_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    rating: Mapped[ReviewRating] = mapped_column(SQLEnum(ReviewRating), nullable=False)
    time_spent: Mapped[float] = mapped_column(Float, nullable=False)  # seconds

    # Snapshot of card state after review
    ease_factor_after: Mapped[float] = mapped_column(Float, nullable=False)
    interval_after: Mapped[int] = mapped_column(Integer, nullable=False)
    state_after: Mapped[CardState] = mapped_column(SQLEnum(CardState), nullable=False)

    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="reviews")
    card: Mapped["Card"] = relationship(back_populates="reviews")
```

**Indexes**:
- `reviews(user_id, reviewed_at)` - For history queries
- `reviews(session_id)` - For session analytics
- `reviews(deck_id)` - For deck-level statistics

---

### 02.08: Create Alembic Configuration
**Duration**: 20 minutes

**Deliverables**:
- `alembic/env.py` - Configured for async SQLAlchemy 2.0
- `alembic.ini` - Migration settings

**Implementation**:

```python
# alembic/env.py
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context
from src.config import settings
from src.db.base import Base

# Import all models for Alembic to detect
from src.models.user import User, UserSettings, RefreshToken
from src.models.deck import Deck
from src.models.card import Card
from src.models.progress import UserDeckProgress, CardStatistics
from src.models.review import Review

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url_sync)

fileConfig(config.config_file_name)
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    import asyncio
    asyncio.run(run_migrations_online())
```

---

### 02.09: Create Initial Migration
**Duration**: 15 minutes

**Deliverables**:
- `alembic/versions/001_initial_schema.py` - Initial database schema

**Commands**:

```bash
# Generate initial migration
alembic revision --autogenerate -m "Initial schema with users, decks, cards, progress, reviews"

# Review generated migration
# Manually add indexes and constraints if needed

# Apply migration
alembic upgrade head
```

**Verification**:

```sql
-- Verify all tables created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

---

### 02.10: Create Pydantic Schemas
**Duration**: 45 minutes

**Deliverables**:
- `src/schemas/user.py` - User request/response schemas
- `src/schemas/deck.py` - Deck schemas
- `src/schemas/card.py` - Card schemas
- `src/schemas/review.py` - Review schemas
- `src/schemas/progress.py` - Progress schemas

**Implementation**:

```python
# src/schemas/user.py
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=100)

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=100)

class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    avatar_url: Optional[str] = None

class UserSettingsUpdate(BaseModel):
    language: Optional[str] = Field(None, pattern="^(en|el)$")
    daily_goal: Optional[int] = Field(None, ge=1, le=200)
    notifications_enabled: Optional[bool] = None
    sound_enabled: Optional[bool] = None
    theme: Optional[str] = Field(None, pattern="^(light|dark|system)$")

class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    avatar_url: Optional[str]
    is_premium: bool
    created_at: datetime
    last_login_at: Optional[datetime]

class UserProfileResponse(UserResponse):
    settings: "UserSettingsResponse"

class UserSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    language: str
    daily_goal: int
    notifications_enabled: bool
    sound_enabled: bool
    theme: str

# src/schemas/deck.py
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from src.models.enums import DeckLevel, DeckCategory, DeckStatus

class DeckBase(BaseModel):
    title: str
    title_greek: str
    description: str
    level: DeckLevel
    category: DeckCategory

class DeckResponse(DeckBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    card_count: int
    estimated_time: int
    is_premium: bool
    thumbnail_url: Optional[str]
    created_by: str
    created_at: datetime
    updated_at: datetime

class DeckWithProgressResponse(DeckResponse):
    progress: Optional["DeckProgressResponse"]

# src/schemas/progress.py
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from src.models.enums import DeckStatus

class DeckProgressResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: DeckStatus
    cards_new: int
    cards_learning: int
    cards_review: int
    cards_mastered: int
    due_today: int
    streak: int
    total_time_spent: int
    accuracy: float
    last_studied_at: Optional[datetime]

# src/schemas/review.py
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from src.models.enums import ReviewRating, CardState

class ReviewSubmit(BaseModel):
    card_id: str
    deck_id: str
    rating: ReviewRating
    time_spent: float = Field(..., ge=0, le=300)  # Max 5 minutes per card
    session_id: str

class ReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    success: bool
    next_review_date: datetime
    new_state: CardState
    ease_factor: float
    interval: int

class CardStatisticsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    card_id: str
    state: CardState
    interval: int
    ease_factor: float
    due_date: Optional[datetime]
    review_count: int
    success_rate: float
```

**Validation Rules**:
- Email validation (Pydantic EmailStr)
- Password minimum 8 characters
- Rating values constrained to enum
- Time spent maximum 5 minutes per card
- Daily goal 1-200 cards

---

### 02.11: Database Helper Utilities
**Duration**: 15 minutes

**Deliverables**:
- `src/db/utils.py` - Database utility functions

**Implementation**:

```python
# src/db/utils.py
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.card import Card
from src.models.progress import CardStatistics
from typing import List
from datetime import datetime

async def get_due_cards(
    session: AsyncSession,
    user_id: int,
    deck_id: str,
    limit: int = 100
) -> List[Card]:
    """Get cards due for review."""
    stmt = (
        select(Card)
        .join(CardStatistics)
        .where(
            CardStatistics.user_id == user_id,
            CardStatistics.deck_id == deck_id,
            CardStatistics.due_date <= datetime.utcnow()
        )
        .limit(limit)
    )
    result = await session.execute(stmt)
    return result.scalars().all()

async def update_deck_progress_counts(
    session: AsyncSession,
    user_id: int,
    deck_id: str
) -> None:
    """Recalculate deck progress card counts from card statistics."""
    from src.models.progress import UserDeckProgress
    from src.models.enums import CardState

    # Count cards by state
    stmt = (
        select(
            CardStatistics.state,
            func.count(CardStatistics.id).label("count")
        )
        .where(
            CardStatistics.user_id == user_id,
            CardStatistics.deck_id == deck_id
        )
        .group_by(CardStatistics.state)
    )
    result = await session.execute(stmt)
    counts = {row.state: row.count for row in result}

    # Update progress
    progress_stmt = select(UserDeckProgress).where(
        UserDeckProgress.user_id == user_id,
        UserDeckProgress.deck_id == deck_id
    )
    progress = (await session.execute(progress_stmt)).scalar_one()

    progress.cards_new = counts.get(CardState.NEW, 0)
    progress.cards_learning = counts.get(CardState.LEARNING, 0) + counts.get(CardState.RELEARNING, 0)
    progress.cards_review = counts.get(CardState.REVIEW, 0)
    progress.cards_mastered = counts.get(CardState.MASTERED, 0)

    await session.commit()
```

---

## File Structure

```
learn-greek-easy-backend/
├── alembic/
│   ├── versions/
│   │   └── 001_initial_schema.py
│   ├── env.py (configured for async)
│   └── script.py.mako
├── src/
│   ├── db/
│   │   ├── __init__.py
│   │   ├── base.py (Base, mixins)
│   │   ├── session.py (engine, session factory)
│   │   ├── dependencies.py (FastAPI deps)
│   │   └── utils.py (helper functions)
│   ├── models/
│   │   ├── __init__.py
│   │   ├── enums.py (PostgreSQL enums)
│   │   ├── user.py (User, UserSettings, RefreshToken)
│   │   ├── deck.py (Deck)
│   │   ├── card.py (Card)
│   │   ├── progress.py (UserDeckProgress, CardStatistics)
│   │   └── review.py (Review)
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── deck.py
│   │   ├── card.py
│   │   ├── progress.py
│   │   └── review.py
│   └── config.py (existing)
├── tests/
│   ├── unit/
│   │   └── test_models.py (new)
│   └── fixtures/
│       └── database.py (new)
└── alembic.ini
```

---

## Testing Strategy

### Unit Tests (`tests/unit/test_models.py`)

```python
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.user import User, UserSettings
from src.models.deck import Deck
from src.models.card import Card
from src.models.progress import CardStatistics
from src.models.enums import CardState, DeckLevel

@pytest.mark.asyncio
async def test_create_user(async_session: AsyncSession):
    """Test user creation with default settings."""
    user = User(
        email="test@example.com",
        password_hash="hashed_password",
        name="Test User"
    )
    async_session.add(user)
    await async_session.commit()
    assert user.id is not None
    assert user.is_active is True

@pytest.mark.asyncio
async def test_user_deck_relationship(async_session: AsyncSession):
    """Test User -> Deck progress relationship."""
    user = User(email="test@example.com", password_hash="hash", name="Test")
    deck = Deck(
        id="deck-test",
        title="Test Deck",
        title_greek="Τεστ",
        description="Test",
        level=DeckLevel.A1,
        card_count=10,
        estimated_time=15
    )
    async_session.add_all([user, deck])
    await async_session.commit()

    # Test relationship loading
    assert user.deck_progress == []

@pytest.mark.asyncio
async def test_card_statistics_sm2_defaults(async_session: AsyncSession):
    """Test CardStatistics initializes with correct SM-2 defaults."""
    stats = CardStatistics(
        user_id=1,
        card_id="card-1",
        deck_id="deck-1"
    )
    assert stats.state == CardState.NEW
    assert stats.ease_factor == 2.5
    assert stats.interval == 0
    assert stats.repetitions == 0
    assert stats.success_rate == 0.0
```

### Integration Tests

1. Test database connection and session lifecycle
2. Test cascading deletes (User -> UserSettings, Deck -> Cards)
3. Test unique constraints (user_id + card_id)
4. Test composite indexes (verify query plans)
5. Test enum validation

### Database Migration Tests

```bash
# Test migration up
alembic upgrade head

# Test migration down
alembic downgrade -1

# Test migration idempotency
alembic upgrade head
alembic downgrade -1
alembic upgrade head
```

---

## Success Criteria

### Functional Requirements

- [ ] All 8 models implemented with proper relationships
- [ ] PostgreSQL enums created for type safety
- [ ] Alembic migrations generate and apply successfully
- [ ] Database session dependency injection works in FastAPI
- [ ] Pydantic schemas validate request/response data
- [ ] Foreign key constraints enforce referential integrity
- [ ] Cascade deletes configured correctly

### Performance Requirements

- [ ] Composite indexes created for SM-2 queries:
  - `card_statistics(user_id, due_date)` for "cards due today"
  - `card_statistics(user_id, deck_id, state)` for progress queries
- [ ] Query plan verification for critical queries (<50ms)
- [ ] Connection pooling configured (20 connections, 10 overflow)

### Code Quality

- [ ] All models have type hints (SQLAlchemy 2.0 style)
- [ ] Pydantic schemas use `ConfigDict(from_attributes=True)`
- [ ] Async session management follows best practices
- [ ] Unit tests cover model creation and relationships
- [ ] Database utilities follow DRY principles

### Documentation

- [ ] ERD diagram documented (text or visual)
- [ ] Model relationships explained
- [ ] Index strategy documented
- [ ] Migration workflow documented
- [ ] Enum mappings documented (Python ↔ PostgreSQL)

---

## Performance Optimization Notes

### Critical Query Patterns

1. **Get due cards for user + deck**:
```sql
SELECT cards.*
FROM cards
JOIN card_statistics ON cards.id = card_statistics.card_id
WHERE card_statistics.user_id = ?
  AND card_statistics.deck_id = ?
  AND card_statistics.due_date <= NOW()
LIMIT 100;
```
**Index**: `card_statistics(user_id, deck_id, due_date)`

2. **Get deck progress**:
```sql
SELECT state, COUNT(*)
FROM card_statistics
WHERE user_id = ? AND deck_id = ?
GROUP BY state;
```
**Index**: `card_statistics(user_id, deck_id, state)`

3. **Get user's all decks with progress**:
```sql
SELECT decks.*, user_deck_progress.*
FROM decks
LEFT JOIN user_deck_progress ON decks.id = user_deck_progress.deck_id
WHERE user_deck_progress.user_id = ?;
```
**Index**: `user_deck_progress(user_id)`

---

## Migration Commands Reference

```bash
# Create new migration
alembic revision --autogenerate -m "Description"

# Apply all migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# Show current migration version
alembic current

# Show migration history
alembic history

# Generate SQL without applying
alembic upgrade head --sql
```

---

## Dependencies Checklist

**From Task 01** (already installed):
- ✅ Python 3.14
- ✅ FastAPI
- ✅ SQLAlchemy 2.0.35+
- ✅ Alembic 1.13.2+
- ✅ asyncpg 0.30.0+
- ✅ Pydantic 2.9.0+
- ✅ psycopg2-binary (for Alembic sync migrations)

**PostgreSQL**:
- PostgreSQL 16+ running (localhost:5432 or Docker)
- Database created: `learn_greek_easy`
- User credentials configured in `.env`

---

## Risk Mitigation

### Potential Issues

1. **Alembic async compatibility**: SQLAlchemy 2.0 async requires custom `env.py`
   - **Mitigation**: Use provided async-compatible `env.py` template

2. **Enum sync issues**: Python enums must match PostgreSQL enums
   - **Mitigation**: Use SQLAlchemy `Enum` with `native_enum=True`

3. **Cascade delete accidents**: Deleting user deletes all progress
   - **Mitigation**: Add `ondelete="CASCADE"` explicitly, test thoroughly

4. **Index bloat**: Too many indexes slow down writes
   - **Mitigation**: Only index frequently queried columns, verify query plans

5. **Migration conflicts**: Multiple developers creating migrations
   - **Mitigation**: Linear migration history, coordinate via Git

---

## Next Steps (Task 03)

After completing database design:

1. Implement authentication system (password hashing, JWT)
2. Create user registration/login endpoints
3. Use database models in authentication flow
4. Test end-to-end user creation → login → token generation

---

**Estimated Total Duration**: 3-4 hours

**Recommended Execution Order**:
1. Sessions & Base (02.01-02.02) - 50 min
2. Enums (02.03) - 15 min
3. User models (02.04) - 25 min
4. Deck & Card models (02.05) - 35 min
5. Progress models (02.06) - 40 min
6. Review model (02.07) - 20 min
7. Alembic setup (02.08-02.09) - 35 min
8. Pydantic schemas (02.10) - 45 min
9. Utilities & testing (02.11) - 15 min

---

**Document Version**: 1.0
**Created**: 2025-11-20
**Last Updated**: 2025-11-20
**Status**: Ready for implementation
**Dependencies**: Task 01 Complete ✅
