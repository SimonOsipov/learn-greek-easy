"""Unit tests for picture_match_exercise_service.

Covers:
- ensure_picture_match_exercises_for_situation: creates both exercise rows
  idempotently, only when both children are at readiness.
- reconcile_picture_match_exercises_for_situation: creates + restores when
  both children ready; drafts when not ready.

All DB calls are mocked — no real database required.

SIT-26 PMATCH-13
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.db.models import (
    DescriptionStatus,
    ExerciseStatus,
    ExerciseType,
    PictureStatus,
    SituationDescription,
    SituationPicture,
)
from src.services.picture_match_exercise_service import (
    ensure_picture_match_exercises_for_situation,
    reconcile_picture_match_exercises_for_situation,
)

# The two exercise types that must be created per situation.
_PICTURE_MATCH_TYPES = [
    ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION,
    ExerciseType.SELECT_DESCRIPTION_FROM_PICTURE,
]


# ---------------------------------------------------------------------------
# Mock helpers
# ---------------------------------------------------------------------------


def _make_picture_exercise_mock(
    exercise_type: ExerciseType,
    status: ExerciseStatus = ExerciseStatus.APPROVED,
) -> MagicMock:
    ex = MagicMock()
    ex.id = uuid4()
    ex.exercise_type = exercise_type
    ex.status = status
    return ex


def _make_situation_mock(
    picture: MagicMock | None,
    description: MagicMock | None,
) -> MagicMock:
    sit = MagicMock()
    sit.id = uuid4()
    sit.picture = picture
    sit.description = description
    return sit


def _make_picture_mock(
    status: PictureStatus = PictureStatus.GENERATED,
    exercises: list | None = None,
) -> MagicMock:
    pic = MagicMock(spec=SituationPicture)
    pic.id = uuid4()
    pic.status = status
    pic.exercises = exercises if exercises is not None else []
    return pic


def _make_description_mock(
    status: DescriptionStatus = DescriptionStatus.AUDIO_READY,
) -> MagicMock:
    desc = MagicMock(spec=SituationDescription)
    desc.id = uuid4()
    desc.status = status
    return desc


def _mock_session_for_situation(session: AsyncMock, situation) -> None:
    """Wire session.execute() so scalar_one_or_none() returns *situation*."""
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = situation
    session.execute = AsyncMock(return_value=result_mock)


# ---------------------------------------------------------------------------
# ensure_picture_match_exercises_for_situation
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestEnsurePictureMatchExercisesForSituation:
    """Tests for ensure_picture_match_exercises_for_situation."""

    @pytest.mark.asyncio
    async def test_returns_zero_when_situation_not_found(self) -> None:
        """Returns 0 when the Situation row doesn't exist."""
        session = AsyncMock()
        _mock_session_for_situation(session, None)

        result = await ensure_picture_match_exercises_for_situation(session, uuid4())
        assert result == 0

    @pytest.mark.asyncio
    async def test_returns_zero_when_no_picture(self) -> None:
        """Returns 0 when Situation has no SituationPicture."""
        desc = _make_description_mock()
        sit = _make_situation_mock(picture=None, description=desc)
        session = AsyncMock()
        _mock_session_for_situation(session, sit)

        result = await ensure_picture_match_exercises_for_situation(session, sit.id)
        assert result == 0

    @pytest.mark.asyncio
    async def test_returns_zero_when_no_description(self) -> None:
        """Returns 0 when Situation has no SituationDescription."""
        pic = _make_picture_mock(status=PictureStatus.GENERATED)
        sit = _make_situation_mock(picture=pic, description=None)
        session = AsyncMock()
        _mock_session_for_situation(session, sit)

        result = await ensure_picture_match_exercises_for_situation(session, sit.id)
        assert result == 0

    @pytest.mark.asyncio
    async def test_returns_zero_when_picture_not_generated(self) -> None:
        """Returns 0 when SituationPicture.status != GENERATED."""
        pic = _make_picture_mock(status=PictureStatus.DRAFT)
        desc = _make_description_mock(status=DescriptionStatus.AUDIO_READY)
        sit = _make_situation_mock(picture=pic, description=desc)
        session = AsyncMock()
        _mock_session_for_situation(session, sit)

        result = await ensure_picture_match_exercises_for_situation(session, sit.id)
        assert result == 0

    @pytest.mark.asyncio
    async def test_returns_zero_when_description_not_audio_ready(self) -> None:
        """Returns 0 when SituationDescription.status != AUDIO_READY."""
        pic = _make_picture_mock(status=PictureStatus.GENERATED)
        desc = _make_description_mock(status=DescriptionStatus.DRAFT)
        sit = _make_situation_mock(picture=pic, description=desc)
        session = AsyncMock()
        _mock_session_for_situation(session, sit)

        result = await ensure_picture_match_exercises_for_situation(session, sit.id)
        assert result == 0

    @pytest.mark.asyncio
    async def test_creates_two_exercises_when_both_children_ready(self) -> None:
        """Creates both SELECT_PICTURE_FROM_DESCRIPTION and SELECT_DESCRIPTION_FROM_PICTURE
        when picture is GENERATED and description is AUDIO_READY.
        """
        pic = _make_picture_mock(status=PictureStatus.GENERATED, exercises=[])
        desc = _make_description_mock(status=DescriptionStatus.AUDIO_READY)
        sit = _make_situation_mock(picture=pic, description=desc)
        session = AsyncMock()
        _mock_session_for_situation(session, sit)

        # Patch _insert_one_picture_exercise to avoid real DB savepoint logic
        with patch(
            "src.services.picture_match_exercise_service._insert_one_picture_exercise",
            new=AsyncMock(return_value=True),
        ):
            result = await ensure_picture_match_exercises_for_situation(session, sit.id)

        assert result == 2

    @pytest.mark.asyncio
    async def test_idempotent_skips_existing_exercise_types(self) -> None:
        """Returns 0 when both exercise types already exist on the picture."""
        existing = [_make_picture_exercise_mock(t) for t in _PICTURE_MATCH_TYPES]
        pic = _make_picture_mock(status=PictureStatus.GENERATED, exercises=existing)
        desc = _make_description_mock(status=DescriptionStatus.AUDIO_READY)
        sit = _make_situation_mock(picture=pic, description=desc)
        session = AsyncMock()
        _mock_session_for_situation(session, sit)

        result = await ensure_picture_match_exercises_for_situation(session, sit.id)
        assert result == 0

    @pytest.mark.asyncio
    async def test_creates_only_missing_exercise_type(self) -> None:
        """Returns 1 when one of the two exercise types is already present."""
        existing = [_make_picture_exercise_mock(ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION)]
        pic = _make_picture_mock(status=PictureStatus.GENERATED, exercises=existing)
        desc = _make_description_mock(status=DescriptionStatus.AUDIO_READY)
        sit = _make_situation_mock(picture=pic, description=desc)
        session = AsyncMock()
        _mock_session_for_situation(session, sit)

        with patch(
            "src.services.picture_match_exercise_service._insert_one_picture_exercise",
            new=AsyncMock(return_value=True),
        ):
            result = await ensure_picture_match_exercises_for_situation(session, sit.id)

        assert result == 1


# ---------------------------------------------------------------------------
# reconcile_picture_match_exercises_for_situation
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestReconcilePictureMatchExercisesForSituation:
    """Tests for reconcile_picture_match_exercises_for_situation."""

    @pytest.mark.asyncio
    async def test_returns_zeros_when_situation_not_found(self) -> None:
        session = AsyncMock()
        _mock_session_for_situation(session, None)

        result = await reconcile_picture_match_exercises_for_situation(session, uuid4())
        assert result == {"created": 0, "restored": 0, "drafted": 0}

    @pytest.mark.asyncio
    async def test_returns_zeros_when_no_picture(self) -> None:
        sit = _make_situation_mock(picture=None, description=_make_description_mock())
        session = AsyncMock()
        _mock_session_for_situation(session, sit)

        result = await reconcile_picture_match_exercises_for_situation(session, sit.id)
        assert result == {"created": 0, "restored": 0, "drafted": 0}

    @pytest.mark.asyncio
    async def test_creates_exercises_when_both_children_ready(self) -> None:
        """Creates 2 new exercises when both children are at readiness."""
        pic = _make_picture_mock(status=PictureStatus.GENERATED, exercises=[])
        desc = _make_description_mock(status=DescriptionStatus.AUDIO_READY)
        sit = _make_situation_mock(picture=pic, description=desc)
        session = AsyncMock()
        _mock_session_for_situation(session, sit)

        with patch(
            "src.services.picture_match_exercise_service._insert_one_picture_exercise",
            new=AsyncMock(return_value=True),
        ):
            result = await reconcile_picture_match_exercises_for_situation(session, sit.id)

        assert result["created"] == 2
        assert result["drafted"] == 0

    @pytest.mark.asyncio
    async def test_restores_draft_exercises_when_both_children_ready(self) -> None:
        """Restores DRAFT → APPROVED when both children become ready."""
        draft_exercises = [
            _make_picture_exercise_mock(t, status=ExerciseStatus.DRAFT)
            for t in _PICTURE_MATCH_TYPES
        ]
        pic = _make_picture_mock(status=PictureStatus.GENERATED, exercises=draft_exercises)
        desc = _make_description_mock(status=DescriptionStatus.AUDIO_READY)
        sit = _make_situation_mock(picture=pic, description=desc)
        session = AsyncMock()
        _mock_session_for_situation(session, sit)

        result = await reconcile_picture_match_exercises_for_situation(session, sit.id)

        assert result["restored"] == 2
        assert result["created"] == 0
        assert result["drafted"] == 0
        # All exercises should now be APPROVED
        for ex in draft_exercises:
            assert ex.status == ExerciseStatus.APPROVED

    @pytest.mark.asyncio
    async def test_drafts_approved_exercises_when_picture_not_ready(self) -> None:
        """APPROVED exercises → DRAFT when picture reverts to non-GENERATED status."""
        approved_exercises = [
            _make_picture_exercise_mock(t, status=ExerciseStatus.APPROVED)
            for t in _PICTURE_MATCH_TYPES
        ]
        # Picture is back to DRAFT
        pic = _make_picture_mock(status=PictureStatus.DRAFT, exercises=approved_exercises)
        desc = _make_description_mock(status=DescriptionStatus.AUDIO_READY)
        sit = _make_situation_mock(picture=pic, description=desc)
        session = AsyncMock()
        _mock_session_for_situation(session, sit)

        result = await reconcile_picture_match_exercises_for_situation(session, sit.id)

        assert result["drafted"] == 2
        assert result["created"] == 0
        assert result["restored"] == 0
        for ex in approved_exercises:
            assert ex.status == ExerciseStatus.DRAFT

    @pytest.mark.asyncio
    async def test_drafts_approved_exercises_when_description_not_ready(self) -> None:
        """APPROVED exercises → DRAFT when description reverts to non-AUDIO_READY."""
        approved_exercises = [
            _make_picture_exercise_mock(t, status=ExerciseStatus.APPROVED)
            for t in _PICTURE_MATCH_TYPES
        ]
        pic = _make_picture_mock(status=PictureStatus.GENERATED, exercises=approved_exercises)
        # Description is not ready
        desc = _make_description_mock(status=DescriptionStatus.DRAFT)
        sit = _make_situation_mock(picture=pic, description=desc)
        session = AsyncMock()
        _mock_session_for_situation(session, sit)

        result = await reconcile_picture_match_exercises_for_situation(session, sit.id)

        assert result["drafted"] == 2
        assert result["created"] == 0

    @pytest.mark.asyncio
    async def test_drafts_exercises_when_no_description(self) -> None:
        """APPROVED exercises → DRAFT when Situation has no description at all."""
        approved_exercises = [
            _make_picture_exercise_mock(t, status=ExerciseStatus.APPROVED)
            for t in _PICTURE_MATCH_TYPES
        ]
        pic = _make_picture_mock(status=PictureStatus.GENERATED, exercises=approved_exercises)
        sit = _make_situation_mock(picture=pic, description=None)
        session = AsyncMock()
        _mock_session_for_situation(session, sit)

        result = await reconcile_picture_match_exercises_for_situation(session, sit.id)

        assert result["drafted"] == 2

    @pytest.mark.asyncio
    async def test_idempotent_when_all_exercises_already_approved(self) -> None:
        """No changes when both children ready and all exercises already APPROVED."""
        approved_exercises = [
            _make_picture_exercise_mock(t, status=ExerciseStatus.APPROVED)
            for t in _PICTURE_MATCH_TYPES
        ]
        pic = _make_picture_mock(status=PictureStatus.GENERATED, exercises=approved_exercises)
        desc = _make_description_mock(status=DescriptionStatus.AUDIO_READY)
        sit = _make_situation_mock(picture=pic, description=desc)
        session = AsyncMock()
        _mock_session_for_situation(session, sit)

        result = await reconcile_picture_match_exercises_for_situation(session, sit.id)

        assert result == {"created": 0, "restored": 0, "drafted": 0}
