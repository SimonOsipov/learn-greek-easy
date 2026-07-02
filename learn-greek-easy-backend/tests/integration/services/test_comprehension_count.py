"""Mode A RED test for SituationComprehensionService.count_whats_new (PERF-15-02, AC-2).

count_whats_new must match get_overview().whats_new_count exactly: the
account-wide count of READY situations created within the last 7 days
(not per-user).

RED reason: count_whats_new is currently a stub
(src/services/situation_comprehension_service.py) that always returns 0.
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.situation_comprehension_service import SituationComprehensionService
from tests.factories.situation import SituationFactory
from tests.helpers.time import freeze_time


@pytest.mark.integration
class TestCountWhatsNew:
    """AC-2: count_whats_new mirrors get_overview's whats_new_count."""

    @pytest.mark.asyncio
    async def test_count_whats_new_matches_overview(
        self, db_session: AsyncSession, test_user
    ) -> None:
        now = datetime.now(timezone.utc)

        # Recent READY (within 7d) — counted.
        await SituationFactory.create(
            session=db_session, ready=True, created_at=now - timedelta(days=1)
        )
        await SituationFactory.create(
            session=db_session, ready=True, created_at=now - timedelta(days=3)
        )
        # Old READY (outside the 7d window) — not counted.
        await SituationFactory.create(
            session=db_session, ready=True, created_at=now - timedelta(days=10)
        )
        # Recent DRAFT (within 7d, but not READY) — not counted.
        await SituationFactory.create(session=db_session, created_at=now - timedelta(days=1))
        await db_session.flush()

        service = SituationComprehensionService(db_session)
        overview = await service.get_overview(user_id=test_user.id)
        actual = await service.count_whats_new()

        # Sanity check on the seeding: exactly the 2 recent READY situations count.
        assert overview.whats_new_count == 2
        assert actual == overview.whats_new_count

    @pytest.mark.asyncio
    async def test_count_whats_new_boundary_is_inclusive(
        self, db_session: AsyncSession, test_user
    ) -> None:
        """QA Mode B adversarial: the cutoff filter is ``created_at >= cutoff``
        (inclusive), so a situation created at exactly the 7-day mark counts —
        it must not be excluded by an off-by-one/strict-inequality regression.

        Time is frozen so the cutoff computed here and the cutoff the service
        computes internally (``datetime.now(tz=timezone.utc) - timedelta(days=7)``)
        are byte-identical — a wall-clock-derived cutoff would race the service's
        own ``now()`` call and make this assertion flaky.
        """
        frozen_now = datetime(2026, 6, 1, 12, 0, 0, tzinfo=timezone.utc)
        with freeze_time(frozen_now):
            cutoff = frozen_now - timedelta(days=7)

            # Exactly at the cutoff — must be INCLUDED (>=, not >).
            await SituationFactory.create(session=db_session, ready=True, created_at=cutoff)
            # One second older than the cutoff — must be EXCLUDED.
            await SituationFactory.create(
                session=db_session, ready=True, created_at=cutoff - timedelta(seconds=1)
            )
            await db_session.flush()

            service = SituationComprehensionService(db_session)
            actual = await service.count_whats_new()

        assert actual == 1
