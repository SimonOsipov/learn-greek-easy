"""Mode A RED test for the DashboardSummaryService gather layer (PERF-15-02, AC-1).

The gather layer's queue_count must equal
ExerciseSM2Service.get_study_queue(user_id, limit=20, include_new=True,
new_limit=10, include_early_practice=False).total_in_queue — the same
canonical queue params the dashboard uses today across its separate calls.

RED reason: DashboardSummaryService.gather is currently a stub
(src/services/dashboard_summary_service.py) that always reports
queue_count=0, regardless of the seeded queue.
"""

from datetime import date, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.dashboard_summary_service import DashboardSummaryService
from src.services.exercise_sm2_service import ExerciseSM2Service
from tests.factories.exercise import ExerciseFactory, ExerciseRecordFactory


@pytest.mark.integration
class TestDashboardSummaryGatherQueueCount:
    """AC-1: gather's queue_count matches ExerciseSM2Service.get_study_queue."""

    @pytest.mark.asyncio
    async def test_queue_count_uses_total_in_queue(
        self, db_session: AsyncSession, test_user
    ) -> None:
        # Due exercise (past next_review_date).
        await ExerciseRecordFactory.create(
            session=db_session,
            user_id=test_user.id,
            learning=True,
            next_review_date=date.today() - timedelta(days=1),
        )
        # New exercise (no record for this user yet).
        await ExerciseFactory.create(session=db_session)
        await db_session.flush()

        expected = (
            await ExerciseSM2Service(db_session).get_study_queue(
                test_user.id,
                limit=20,
                include_new=True,
                new_limit=10,
                include_early_practice=False,
            )
        ).total_in_queue
        # Sanity check on the seeding: the queue should actually be non-empty,
        # otherwise this test can't distinguish the stub's 0 from a real bug.
        assert expected > 0

        result = await DashboardSummaryService(db_session).gather(test_user.id)

        assert result["queue_count"] == expected
