"""Integration tests for picture-match exercises (SIT-26).

Tests the full API flow:
  queue → GET /exercises/{id} → POST /exercises/review → SM-2 update

Also covers:
  - 409 path: insufficient distractor pool
  - Soft-delete: DRAFT exercises absent from queue; ExerciseRecord preserved
  - Independent SM-2 records per exercise type per user
  - Premium gating: documents current no-gating behaviour (xfail)

SIT-26 PMATCH-13
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    Exercise,
    ExerciseRecord,
    ExerciseSourceType,
    ExerciseStatus,
    ExerciseType,
    PictureExercise,
    PictureExerciseItem,
    SituationPicture,
)
from tests.factories import SituationDescriptionFactory, SituationFactory, SituationPictureFactory

QUEUE_URL = "/api/v1/exercises/queue"
REVIEW_URL = "/api/v1/exercises/review"
EXERCISE_URL = "/api/v1/exercises/{exercise_id}"


# ---------------------------------------------------------------------------
# Fixture helpers
# ---------------------------------------------------------------------------


async def _create_ready_situation(db_session: AsyncSession) -> tuple:
    """Create a Situation with GENERATED picture and AUDIO_READY description.

    Returns (situation, picture, description).
    """
    situation = await SituationFactory.create(session=db_session, ready=True)
    picture = await SituationPictureFactory.create(
        session=db_session,
        situation_id=situation.id,
        generated=True,
    )
    description = await SituationDescriptionFactory.create(
        session=db_session,
        situation_id=situation.id,
        audio_ready=True,
    )
    return situation, picture, description


async def _create_picture_exercise(
    db_session: AsyncSession,
    picture: SituationPicture,
    description,
    exercise_type: ExerciseType = ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION,
    status: ExerciseStatus = ExerciseStatus.APPROVED,
) -> tuple[PictureExercise, Exercise]:
    """Create a PictureExercise + PictureExerciseItem + supertable Exercise row.

    Returns (picture_exercise, exercise).
    """
    pic_ex = PictureExercise(
        picture_id=picture.id,
        exercise_type=exercise_type,
        status=status,
    )
    db_session.add(pic_ex)
    await db_session.flush()

    item = PictureExerciseItem(
        picture_exercise_id=pic_ex.id,
        item_index=0,
        payload={
            "type": "matching",
            "anchor_picture_id": str(picture.id),
            "anchor_description_id": str(description.id),
        },
    )
    db_session.add(item)

    exercise = Exercise(
        source_type=ExerciseSourceType.PICTURE,
        picture_exercise_id=pic_ex.id,
    )
    db_session.add(exercise)
    await db_session.flush()

    return pic_ex, exercise


async def _create_four_ready_situations(
    db_session: AsyncSession,
) -> list[tuple]:
    """Create 4 independent ready situations for a 4-option pool.

    Returns list of (situation, picture, description) tuples.
    """
    result = []
    for _ in range(4):
        tup = await _create_ready_situation(db_session)
        result.append(tup)
    return result


async def _create_picture_exercises_for_situations(
    db_session: AsyncSession,
    situations: list[tuple],
    exercise_type: ExerciseType = ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION,
    status: ExerciseStatus = ExerciseStatus.APPROVED,
) -> list[tuple[PictureExercise, Exercise]]:
    """Create PictureExercise + Exercise rows for each situation."""
    exercises = []
    for _sit, pic, desc in situations:
        pair = await _create_picture_exercise(
            db_session, pic, desc, exercise_type=exercise_type, status=status
        )
        exercises.append(pair)
    return exercises


def _mock_s3_presign(url: str = "https://cdn.example.com/test.jpg"):
    """Return a context manager that patches get_s3_service with a presign mock."""
    mock_s3 = MagicMock()
    mock_s3.generate_presigned_url.return_value = url
    return patch("src.services.picture_match_service.get_s3_service", return_value=mock_s3)


# ---------------------------------------------------------------------------
# Full flow: queue → get single → review → SM-2 updated
# ---------------------------------------------------------------------------


@pytest.mark.integration
class TestPictureMatchFullFlow:
    """Full happy-path flow for picture-match exercises."""

    @pytest.mark.asyncio
    async def test_queue_returns_picture_exercise(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """APPROVED picture exercises appear in the exercise queue."""
        situations = await _create_four_ready_situations(db_session)
        exercises = await _create_picture_exercises_for_situations(db_session, situations)
        await db_session.commit()

        response = await client.get(
            QUEUE_URL,
            params={"source_type": "picture"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_in_queue"] >= 1

        exercise_ids = {ex["exercise_id"] for ex in data["exercises"]}
        expected_ids = {str(ex.id) for _pic_ex, ex in exercises}
        assert (
            exercise_ids & expected_ids
        ), f"None of the created exercises appear in the queue: {exercise_ids!r}"

    @pytest.mark.asyncio
    async def test_get_single_exercise_returns_4_options(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """GET /exercises/{id} returns a payload with 4 options for picture-match."""
        situations = await _create_four_ready_situations(db_session)
        exercises = await _create_picture_exercises_for_situations(db_session, situations)
        anchor_pic_ex, anchor_exercise = exercises[0]
        await db_session.commit()

        with _mock_s3_presign():
            response = await client.get(
                EXERCISE_URL.format(exercise_id=str(anchor_exercise.id)),
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["source_type"] == "picture"
        assert len(data["items"]) == 1
        payload = data["items"][0]["payload"]
        assert len(payload["options"]) == 4

    @pytest.mark.asyncio
    async def test_submit_review_updates_sm2_record(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """POST /exercises/review updates the SM-2 ExerciseRecord for the user."""
        situations = await _create_four_ready_situations(db_session)
        exercises = await _create_picture_exercises_for_situations(db_session, situations)
        _anchor_pic_ex, anchor_exercise = exercises[0]
        await db_session.commit()

        body = {
            "exercise_id": str(anchor_exercise.id),
            "score": 1,
            "max_score": 1,
        }
        response = await client.post(REVIEW_URL, json=body, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["exercise_id"] == str(anchor_exercise.id)
        assert data["score"] == 1
        assert "new_status" in data
        assert "next_review_date" in data

    @pytest.mark.asyncio
    async def test_second_review_increments_repetitions(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """Second review increments SM-2 repetitions count."""
        situations = await _create_four_ready_situations(db_session)
        exercises = await _create_picture_exercises_for_situations(db_session, situations)
        _anchor_pic_ex, anchor_exercise = exercises[0]
        await db_session.commit()

        body = {"exercise_id": str(anchor_exercise.id), "score": 1, "max_score": 1}
        r1 = await client.post(REVIEW_URL, json=body, headers=auth_headers)
        assert r1.status_code == 200

        r2 = await client.post(REVIEW_URL, json=body, headers=auth_headers)
        assert r2.status_code == 200

        assert r2.json()["repetitions"] > r1.json()["repetitions"]


# ---------------------------------------------------------------------------
# 409 path: insufficient distractor pool
# ---------------------------------------------------------------------------


@pytest.mark.integration
class TestPictureMatchInsufficientPool:
    """Insufficient distractor pool → 409 with INSUFFICIENT_DISTRACTOR_POOL code."""

    @pytest.mark.asyncio
    async def test_409_when_fewer_than_3_other_approved_situations(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """GET /exercises/{id} returns 409 when the distractor pool is too small.

        We create only the anchor situation's exercise — no other approved
        picture exercises exist — so fetching its payload must fail with 409.
        """
        # Only one situation — no distractors available
        _anchor_sit, anchor_pic, anchor_desc = await _create_ready_situation(db_session)
        _pic_ex, anchor_exercise = await _create_picture_exercise(
            db_session, anchor_pic, anchor_desc
        )
        await db_session.commit()

        with _mock_s3_presign():
            response = await client.get(
                EXERCISE_URL.format(exercise_id=str(anchor_exercise.id)),
                headers=auth_headers,
            )

        assert response.status_code == 409
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "INSUFFICIENT_DISTRACTOR_POOL"


# ---------------------------------------------------------------------------
# Soft-delete: DRAFT exercises absent from queue; ExerciseRecord preserved
# ---------------------------------------------------------------------------


@pytest.mark.integration
class TestPictureMatchSoftDelete:
    """DRAFT picture exercises excluded from queue; ExerciseRecord history preserved."""

    @pytest.mark.asyncio
    async def test_draft_exercise_excluded_from_queue(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """An APPROVED exercise that is flipped to DRAFT disappears from the new-exercises queue."""
        situations = await _create_four_ready_situations(db_session)
        exercises = await _create_picture_exercises_for_situations(db_session, situations)
        # Flip all to DRAFT to simulate soft-delete
        for pic_ex, _exercise in exercises:
            pic_ex.status = ExerciseStatus.DRAFT
        await db_session.commit()

        response = await client.get(
            QUEUE_URL,
            params={"source_type": "picture"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        created_exercise_ids = {str(ex.id) for _pic_ex, ex in exercises}
        queued_ids = {item["exercise_id"] for item in data["exercises"]}
        assert not (
            created_exercise_ids & queued_ids
        ), "DRAFT exercises must not appear in the queue"

    @pytest.mark.asyncio
    async def test_exercise_record_preserved_after_draft(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ) -> None:
        """ExerciseRecord (SM-2 history) row survives when PictureExercise is soft-deleted."""
        situations = await _create_four_ready_situations(db_session)
        exercises = await _create_picture_exercises_for_situations(db_session, situations)
        anchor_pic_ex, anchor_exercise = exercises[0]
        await db_session.commit()

        # Submit a review to create an ExerciseRecord
        body = {"exercise_id": str(anchor_exercise.id), "score": 1, "max_score": 1}
        response = await client.post(REVIEW_URL, json=body, headers=auth_headers)
        assert response.status_code == 200

        # Soft-delete: flip the PictureExercise to DRAFT
        anchor_pic_ex.status = ExerciseStatus.DRAFT
        await db_session.commit()

        # ExerciseRecord must still exist
        result = await db_session.execute(
            select(ExerciseRecord).where(
                ExerciseRecord.user_id == test_user.id,
                ExerciseRecord.exercise_id == anchor_exercise.id,
            )
        )
        record = result.scalar_one_or_none()
        assert record is not None, "ExerciseRecord must be preserved after soft-delete"


# ---------------------------------------------------------------------------
# Independent SM-2 records per exercise type per user
# ---------------------------------------------------------------------------


@pytest.mark.integration
class TestPictureMatchIndependentSM2Records:
    """Each exercise type (A and B) creates a distinct ExerciseRecord per user."""

    @pytest.mark.asyncio
    async def test_type_a_and_type_b_create_two_exercise_records(
        self,
        client: AsyncClient,
        auth_headers: dict,
        test_user,
        db_session: AsyncSession,
    ) -> None:
        """Submitting reviews for both SELECT_PICTURE_FROM_DESCRIPTION and
        SELECT_DESCRIPTION_FROM_PICTURE for the same picture creates two distinct
        ExerciseRecord rows.
        """
        situations = await _create_four_ready_situations(db_session)
        # Create Type A exercises for all situations
        type_a_exercises = await _create_picture_exercises_for_situations(
            db_session,
            situations,
            exercise_type=ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION,
        )
        # Create Type B exercises for all situations
        type_b_exercises = await _create_picture_exercises_for_situations(
            db_session,
            situations,
            exercise_type=ExerciseType.SELECT_DESCRIPTION_FROM_PICTURE,
        )
        _type_a_pic_ex, type_a_exercise = type_a_exercises[0]
        _type_b_pic_ex, type_b_exercise = type_b_exercises[0]
        await db_session.commit()

        # Submit review for Type A
        body_a = {"exercise_id": str(type_a_exercise.id), "score": 1, "max_score": 1}
        r_a = await client.post(REVIEW_URL, json=body_a, headers=auth_headers)
        assert r_a.status_code == 200

        # Submit review for Type B
        body_b = {"exercise_id": str(type_b_exercise.id), "score": 1, "max_score": 1}
        r_b = await client.post(REVIEW_URL, json=body_b, headers=auth_headers)
        assert r_b.status_code == 200

        # Both records must exist as distinct rows
        result = await db_session.execute(
            select(ExerciseRecord).where(
                ExerciseRecord.user_id == test_user.id,
                ExerciseRecord.exercise_id.in_([type_a_exercise.id, type_b_exercise.id]),
            )
        )
        records = list(result.scalars().all())
        assert len(records) == 2, f"Expected 2 distinct ExerciseRecord rows, got {len(records)}"
        record_exercise_ids = {r.exercise_id for r in records}
        assert type_a_exercise.id in record_exercise_ids
        assert type_b_exercise.id in record_exercise_ids


# ---------------------------------------------------------------------------
# Premium gating: documents current no-gating behaviour
# ---------------------------------------------------------------------------


@pytest.mark.integration
class TestPictureMatchPremiumGating:
    """Documents that picture-match exercises currently have NO premium gating.

    Situations have no deck_id, so the standard deck-based premium check
    does not apply. This test documents the current posture: a user with
    NONE subscription can access picture-match exercises without restriction.

    When SIT-26 follow-up adds gating for Situations, this test should be
    converted to assert 403 and the xfail marker removed.
    """

    @pytest.mark.asyncio
    @pytest.mark.xfail(
        strict=False,
        reason=(
            "SIT-26 follow-up: Situations have no deck_id; "
            "premium gating is NOT enforced today. "
            "This test documents the current no-gating posture. "
            "When gating is added, convert to assert 403 and remove xfail."
        ),
    )
    async def test_none_subscription_user_can_access_picture_match_queue(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """A user with NONE subscription can fetch picture-match exercises from the queue.

        Current behaviour: no 403 is raised (no gating). This test will XFAIL
        (i.e., pass) under the current no-gating implementation. When proper
        gating is implemented, it should return 403 and this test should be
        updated accordingly.

        Note: xfail(strict=False) means:
          - If the test passes (no 403) → reported as XPASS (expected)
          - If the test fails unexpectedly → reported as XFAIL
        The intent is to keep this on the test suite as a gap marker.
        """
        situations = await _create_four_ready_situations(db_session)
        await _create_picture_exercises_for_situations(db_session, situations)
        await db_session.commit()

        response = await client.get(
            QUEUE_URL,
            params={"source_type": "picture"},
            headers=auth_headers,
        )
        # Current behaviour: no 403 — gating not implemented for Situations
        # When gating is added, this should be assert response.status_code == 403
        assert response.status_code != 403, (
            "Unexpected 403: premium gating should not yet be enforced for Situations "
            "(no deck_id). Update this test when gating is implemented."
        )
