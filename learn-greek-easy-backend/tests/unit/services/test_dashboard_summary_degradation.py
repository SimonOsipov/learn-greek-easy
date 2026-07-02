"""Unit tests: graceful degradation of non-critical dashboard feed sources
(CodeRabbit fix on PERF-15's ``DashboardSummaryService``).

Consolidating the dashboard's eight endpoints into one means a transient
failure in ANY subsystem would 500 the whole summary if left unguarded --
including the core progress/decks payload the dashboard actually needs to
render. ``_gather_news`` / ``_gather_situation`` / ``_gather_whats_new_count``
/ ``_gather_queue_count`` are the NON-CRITICAL feed-augmenting sources; each
must degrade to its safe default (``[]`` / ``None`` / ``0`` / ``0``) on
failure rather than propagating the exception, so the rest of the payload
still renders. Core sources (stats/decks, exercised in
``DashboardSummaryService.build()``) are deliberately NOT covered here --
they stay hard-failing (see the module's own docstring and
tests/integration/services/test_dashboard_build.py for the end-to-end
``build()``-level degradation coverage).

Pure unit tests: ``db`` is a bare ``MagicMock`` (never touched -- the
mocked sub-services never issue real queries), so no DB/AsyncSession is
required.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.services.dashboard_summary_service import DashboardSummaryService


@pytest.mark.unit
class TestDashboardSummaryGatherDegradation:
    """Each non-critical gather source degrades independently on failure."""

    async def test_news_gather_failure_degrades_to_empty_list(self) -> None:
        service = DashboardSummaryService(MagicMock())
        mock_news_service = MagicMock()
        mock_news_service.get_list = AsyncMock(side_effect=RuntimeError("news db blip"))

        with patch(
            "src.services.dashboard_summary_service.NewsItemService",
            return_value=mock_news_service,
        ):
            result = await service._gather_news()

        assert result == []

    async def test_situation_gather_failure_degrades_to_none(self) -> None:
        service = DashboardSummaryService(MagicMock())
        mock_situation_service = MagicMock()
        mock_situation_service.list_for_learner = AsyncMock(
            side_effect=RuntimeError("situation db blip")
        )

        with patch(
            "src.services.dashboard_summary_service.LearnerSituationService",
            return_value=mock_situation_service,
        ):
            result = await service._gather_situation(uuid4())

        assert result is None

    async def test_whats_new_count_gather_failure_degrades_to_zero(self) -> None:
        service = DashboardSummaryService(MagicMock())
        mock_comprehension_service = MagicMock()
        mock_comprehension_service.count_whats_new = AsyncMock(
            side_effect=RuntimeError("whats-new db blip")
        )

        with patch(
            "src.services.dashboard_summary_service.SituationComprehensionService",
            return_value=mock_comprehension_service,
        ):
            result = await service._gather_whats_new_count()

        assert result == 0

    async def test_queue_count_gather_failure_degrades_to_zero(self) -> None:
        service = DashboardSummaryService(MagicMock())
        mock_sm2_service = MagicMock()
        mock_sm2_service.get_study_queue = AsyncMock(side_effect=RuntimeError("queue db blip"))

        with patch(
            "src.services.dashboard_summary_service.ExerciseSM2Service",
            return_value=mock_sm2_service,
        ):
            result = await service._gather_queue_count(uuid4())

        assert result == 0

    async def test_gather_degrades_all_sources_together_without_raising(self) -> None:
        """End-to-end at the ``gather()`` level: every source failing at once
        still returns the full safe-default dict, not an exception."""
        service = DashboardSummaryService(MagicMock())

        mock_news_service = MagicMock()
        mock_news_service.get_list = AsyncMock(side_effect=RuntimeError("news db blip"))
        mock_situation_service = MagicMock()
        mock_situation_service.list_for_learner = AsyncMock(
            side_effect=RuntimeError("situation db blip")
        )
        mock_comprehension_service = MagicMock()
        mock_comprehension_service.count_whats_new = AsyncMock(
            side_effect=RuntimeError("whats-new db blip")
        )
        mock_sm2_service = MagicMock()
        mock_sm2_service.get_study_queue = AsyncMock(side_effect=RuntimeError("queue db blip"))

        with (
            patch(
                "src.services.dashboard_summary_service.NewsItemService",
                return_value=mock_news_service,
            ),
            patch(
                "src.services.dashboard_summary_service.LearnerSituationService",
                return_value=mock_situation_service,
            ),
            patch(
                "src.services.dashboard_summary_service.SituationComprehensionService",
                return_value=mock_comprehension_service,
            ),
            patch(
                "src.services.dashboard_summary_service.ExerciseSM2Service",
                return_value=mock_sm2_service,
            ),
        ):
            result = await service.gather(uuid4())

        assert result == {
            "news": [],
            "situation": None,
            "whats_new_count": 0,
            "queue_count": 0,
        }
