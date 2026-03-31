"""Alembic environment configuration for SQLAlchemy 2.0."""

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from sqlalchemy.engine import Connection

from alembic import context

# Import settings to get database URL
from src.config import settings

# Import Base for metadata
from src.db.base import Base

# CRITICAL: Import all models for Alembic to detect them
# These imports are required for Alembic autogenerate to work properly
from src.db.models import (  # noqa: F401
    Achievement,
    AchievementCategory,
    AnnouncementCampaign,
    BillingCycle,
    CardRecord,
    CardRecordReview,
    CardRecordStatistics,
    CardStatus,
    CardType,
    CultureAnswerHistory,
    CultureDeck,
    CultureQuestion,
    CultureQuestionStats,
    Deck,
    DeckLevel,
    DeckWordEntry,
    DescriptionExercise,
    DescriptionExerciseItem,
    DescriptionSourceType,
    DescriptionStatus,
    DialogExercise,
    DialogLine,
    DialogSpeaker,
    DialogStatus,
    Exercise,
    ExerciseItem,
    ExerciseRecord,
    ExerciseReview,
    ExerciseSourceType,
    ExerciseStatus,
    ExerciseType,
    Feedback,
    FeedbackCategory,
    FeedbackStatus,
    FeedbackVote,
    GreekLexicon,
    ListeningDialog,
    MockExamAnswer,
    MockExamSession,
    MockExamStatus,
    NewsItem,
    Notification,
    NotificationType,
    PartOfSpeech,
    PictureExercise,
    PictureExerciseItem,
    PictureStatus,
    ReviewRating,
    Situation,
    SituationDescription,
    SituationPicture,
    SubscriptionStatus,
    SubscriptionTier,
    User,
    UserAchievement,
    UserSettings,
    UserXP,
    Visibility,
    VoteType,
    WebhookEvent,
    WebhookProcessingStatus,
    WordEntry,
    XPTransaction,
)

# Alembic Config object
config = context.config

# Set database URL from settings
config.set_main_option("sqlalchemy.url", settings.database_url_sync)

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata for autogenerate
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well. By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,  # Enable type comparison (for enums)
        compare_server_default=True,  # Compare server defaults
        include_name=include_name,  # Filter out pgvector indexes and reference schema
        include_object=include_object,  # Filter reference schema from metadata side
    )

    with context.begin_transaction():
        context.run_migrations()


def include_object(
    object: object, _name: str | None, type_: str, _reflected: bool, _compare_to: object
) -> bool:
    """Filter metadata-side objects from the reference schema.

    include_name filters DB-reflected objects; include_object filters
    metadata-registered objects (e.g. GreekLexicon in Base.metadata).
    Without this, Alembic detects reference.greek_lexicon as a new
    table and reports it as an unmigrated upgrade operation.
    """
    if type_ == "table" and getattr(object, "schema", None) == "reference":
        return False
    return True


def include_name(name: str | None, type_: str, parent_names: dict) -> bool:
    """Filter to exclude certain indexes and schemas from Alembic comparison.

    Some indexes cannot be represented in SQLAlchemy model metadata:
    - pgvector IVFFlat indexes (created via raw SQL)
    - PostgreSQL partial indexes (use WHERE clause)
    - Indexes with expression ordering (DESC/ASC expressions)

    The reference schema is managed by hand-written migrations and excluded
    from autogenerate to prevent false positives.
    """
    # Exclude the reference schema from autogenerate comparison
    if type_ == "schema" and name == "reference":
        return False
    if type_ == "table" and parent_names.get("schema_name") == "reference":
        return False
    if type_ == "index" and name is not None:
        # Exclude pgvector embedding indexes (created via raw SQL in migration)
        if name.startswith("idx_") and "embedding" in name:
            return False
        # Exclude partial index on culture_questions.original_article_url
        if name == "ix_culture_questions_original_article_url":
            return False
        # Exclude announcement_campaigns created_at DESC index
        if name == "ix_announcement_campaigns_created_at":
            return False
    return True


def do_run_migrations(connection: Connection) -> None:
    """Run migrations with the given connection."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,  # Enable type comparison (critical for enums)
        compare_server_default=True,
        include_name=include_name,  # Filter out pgvector indexes and reference schema
        include_object=include_object,  # Filter reference schema from metadata side
        transaction_per_migration=True,  # Each migration in its own transaction (required for ALTER TYPE ADD VALUE)
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # No pooling for migrations
    )

    with connectable.connect() as connection:
        do_run_migrations(connection)

    connectable.dispose()


# Determine which mode to run
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
