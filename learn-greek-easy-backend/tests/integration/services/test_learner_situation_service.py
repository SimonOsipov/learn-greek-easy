"""Mode A RED test for LearnerSituationService (PERF-15-02, AC-7).

LearnerSituationService.list_for_learner must reproduce, verbatim, the
behavior currently inlined in src.api.v1.situations.list_situations
(situations.py:49-160): READY-only filter, created_at DESC ordering, DRAFT
situations excluded, and per-situation exercise_total/exercise_completed
correlated subqueries scoped to the requesting user.

RED reason: LearnerSituationService.list_for_learner is currently a stub
(src/services/learner_situation_service.py) that always returns an empty
LearnerSituationListResponse — total will be 0, not 3.
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.learner_situation_service import LearnerSituationService
from tests.factories.exercise import ExerciseFactory, ExerciseRecordFactory
from tests.factories.situation import SituationFactory
from tests.factories.situation_description import (
    DescriptionExerciseFactory,
    SituationDescriptionFactory,
)

_T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)


@pytest.mark.integration
class TestLearnerSituationServiceListForLearner:
    """AC-7: list_for_learner matches the router logic it replaces."""

    @pytest.mark.asyncio
    async def test_learner_situation_service_matches_router(
        self, db_session: AsyncSession, test_user
    ) -> None:
        # ready1 has 2 exercises, 1 completed by test_user — exercises the
        # correlated subqueries, not just the READY filter.
        ready1 = await SituationFactory.create(session=db_session, ready=True, created_at=_T0)
        description = await SituationDescriptionFactory.create(
            session=db_session, situation_id=ready1.id
        )
        exercises = []
        for _ in range(2):
            de = await DescriptionExerciseFactory.create(
                session=db_session, description_id=description.id
            )
            ex = await ExerciseFactory.create(session=db_session, description_exercise_id=de.id)
            exercises.append(ex)
        await ExerciseRecordFactory.create(
            session=db_session,
            exercise_id=exercises[0].id,
            user_id=test_user.id,
            learning=True,
        )

        ready2 = await SituationFactory.create(
            session=db_session, ready=True, created_at=_T0 + timedelta(minutes=1)
        )
        ready3 = await SituationFactory.create(
            session=db_session, ready=True, created_at=_T0 + timedelta(minutes=2)
        )
        # DRAFT, most recently created — must be excluded even though it's newest.
        await SituationFactory.create(session=db_session, created_at=_T0 + timedelta(minutes=3))
        await db_session.flush()

        service = LearnerSituationService(db_session)
        result = await service.list_for_learner(test_user.id, page=1, page_size=6)

        assert result.total == 3
        assert result.page == 1
        assert result.page_size == 6

        returned_ids = [item.id for item in result.items]
        assert set(returned_ids) == {ready1.id, ready2.id, ready3.id}
        # created_at DESC — most-recently-created READY situation first.
        assert returned_ids == [ready3.id, ready2.id, ready1.id]

        by_id = {item.id: item for item in result.items}
        assert by_id[ready1.id].exercise_total == 2
        assert by_id[ready1.id].exercise_completed == 1
        assert by_id[ready2.id].exercise_total == 0
        assert by_id[ready2.id].exercise_completed == 0
