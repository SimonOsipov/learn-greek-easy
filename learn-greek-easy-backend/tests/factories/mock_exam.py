"""MockExamSession factory for tests.

Replaces inline MockExamSession construction found in unit/repository tests.
Mirrors the shape of CultureAnswerHistoryFactory (culture.py).

Usage:
    session = await MockExamSessionFactory.create(
        session=db_session, user_id=user.id
    )
    completed = await MockExamSessionFactory.create(
        session=db_session, user_id=user.id, completed=True, score=20
    )
    # Override started_at for UTC-boundary testing:
    boundary = await MockExamSessionFactory.create(
        session=db_session,
        user_id=user.id,
        started_at=datetime(2024, 3, 15, 23, 30, tzinfo=timezone.utc),
    )
"""

from datetime import datetime, timezone

import factory

from src.db.models import MockExamSession, MockExamStatus
from tests.factories.base import BaseFactory


class MockExamSessionFactory(BaseFactory):
    """Factory for MockExamSession model.

    Creates mock exam session records for analytics testing.

    Required:
        user_id: Must be set explicitly.

    Traits:
        completed: Status COMPLETED with a non-zero score and passed flag.
        abandoned: Status ABANDONED.
        passing: Status COMPLETED with a passing score (20/25, passed=True).
        failed: Status COMPLETED with a failing score (10/25).

    Example:
        session = await MockExamSessionFactory.create(
            session=db_session, user_id=user.id
        )
        done = await MockExamSessionFactory.create(
            session=db_session, user_id=user.id, completed=True, score=22
        )
    """

    class Meta:
        model = MockExamSession

    # Required: Must be provided
    user_id = None  # Must be set explicitly

    # Sensible defaults matching the model
    total_questions = 25
    score = 0
    passed = False
    time_taken_seconds = 0
    status = MockExamStatus.ACTIVE
    started_at = factory.LazyFunction(lambda: datetime.now(tz=timezone.utc))
    completed_at = None

    class Params:
        """Factory traits for common exam states.

        Note: trait ``passing`` sets ``passed=True``; trait name differs from the
        field name to avoid the factory-boy CyclicDefinitionError.
        """

        completed = factory.Trait(
            status=MockExamStatus.COMPLETED,
            score=15,
            time_taken_seconds=900,  # 15 minutes
            completed_at=factory.LazyFunction(lambda: datetime.now(tz=timezone.utc)),
        )

        abandoned = factory.Trait(
            status=MockExamStatus.ABANDONED,
        )

        # Named "passing" (not "passed") to avoid conflict with the field of the same name.
        passing = factory.Trait(
            status=MockExamStatus.COMPLETED,
            score=20,  # 80% = passing threshold
            passed=True,
            time_taken_seconds=720,
            completed_at=factory.LazyFunction(lambda: datetime.now(tz=timezone.utc)),
        )

        failed = factory.Trait(
            status=MockExamStatus.COMPLETED,
            score=10,  # 40% = failing
            passed=False,
            time_taken_seconds=1200,
            completed_at=factory.LazyFunction(lambda: datetime.now(tz=timezone.utc)),
        )


__all__ = ["MockExamSessionFactory"]
