"""RED tests for SIT-27-03 API surface: exercise topic field + per-topic counts.

Mode A — authored RED before implementation (RALPH Stage 2.5 / QA Mode A).

Tests AC-2 and AC-3 of SIT-27-03:
  AC-2  Each exercise item in the situation exercises API carries its derived ``topic``.
  AC-3  The exercises API response includes per-topic counts.

These tests use the existing ``client`` + ``auth_headers`` + ``db_session`` fixtures
(defined in tests/conftest.py) and the situation/exercise factory helpers.
They are ``@pytest.mark.unit`` because they mock the DB dependency and test
the API layer in isolation.

WHY THEY ARE RED
----------------
The ``ExerciseQueueItem`` schema does not have a ``topic`` field today, and the
``ExerciseQueue`` response schema does not have a ``topic_counts`` field.  The
``get_situation_exercises`` endpoint does not compute topics.  So:

  - test_exercises_api_item_carries_topic: assertion on response["topic"] will
    FAIL (KeyError / field absent) because the schema does not include "topic".
  - test_exercises_api_returns_per_topic_counts: assertion on
    response["topic_counts"] will FAIL (KeyError) because the schema does not
    include "topic_counts".
  - test_topic_counts_all_four_keys_always_present: same — no "topic_counts".
  - test_topic_counts_sum_equals_total_exercises: same.

All failures are assertion / KeyError on the response body — NOT import/collection
errors — so they are RED for the right reason.

FIXTURE STRATEGY
----------------
These tests hit the real ASGI transport using the ``client`` fixture which
requires a live DB session.  Therefore they carry ``@pytest.mark.unit`` but
still use the ``db_session`` fixture (same as tests/unit/api/v1/test_billing.py,
which mixes AsyncClient + db_session within the "unit" suite).  This is the
established project pattern for "API unit tests".

The test seeds just enough data:
  - 1 READY situation with a SituationDescription
  - 3 exercises:
      DescriptionExercise + modality LISTENING → expected topic "Listening"
      DescriptionExercise + modality READING   → expected topic "Reading"
      (PictureExercise / DialogExercise are not fully wired in the exercises
       endpoint yet per the TODO comment at situations.py:323, so we only seed
       description-source exercises which the current endpoint *does* handle)

AC-3 counts are tested by asserting the counts map structure and key presence,
not exact totals, because the endpoint may not expose a separate picture topic
yet.  A dedicated assertion checks the counts once the endpoint is extended to
cover all source types.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import ExerciseModality, ExerciseSourceType, ExerciseType
from tests.factories import (
    DescriptionExerciseFactory,
    DescriptionExerciseItemFactory,
    ExerciseFactory,
    SituationDescriptionFactory,
    SituationFactory,
)

BASE_URL = "/api/v1/situations"


def _exercises_url(situation_id) -> str:
    return f"{BASE_URL}/{situation_id}/exercises"


# ---------------------------------------------------------------------------
# AC-2 — every exercise item carries a ``topic`` field
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestExerciseItemCarriesTopic:
    """AC-2: each item in the exercises API carries a derived ``topic`` field."""

    @pytest.mark.asyncio
    async def test_exercises_api_item_carries_topic(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """GIVEN a situation with a listening description exercise
        WHEN  GET /api/v1/situations/{id}/exercises
        THEN  that item carries ``topic == "Listening"``

        RED: ExerciseQueueItem has no ``topic`` field → KeyError on response.
        """
        # Seed
        situation = await SituationFactory.create(session=db_session, ready=True)
        desc = await SituationDescriptionFactory.create(
            session=db_session, situation_id=situation.id
        )
        de = await DescriptionExerciseFactory.create(
            session=db_session,
            description_id=desc.id,
            approved=True,
        )
        await DescriptionExerciseItemFactory.create(
            session=db_session, description_exercise_id=de.id
        )
        await ExerciseFactory.create(
            session=db_session,
            description_exercise_id=de.id,
            source_type=ExerciseSourceType.DESCRIPTION,
        )
        # Force the exercise modality to LISTENING to drive the expected topic.
        # ExerciseFactory seeds a DescriptionExercise which stores modality —
        # after creation we need to set modality to LISTENING on the underlying
        # DescriptionExercise.  The factory default may be READING; update it:
        de.modality = ExerciseModality.LISTENING
        await db_session.flush()

        response = await client.get(_exercises_url(situation.id), headers=auth_headers)
        assert response.status_code == 200

        data = response.json()
        exercises = data.get("exercises", [])
        assert len(exercises) > 0, "Expected at least one exercise in the response"

        first_item = exercises[0]
        # AC-2: the ``topic`` field must be present and correct.
        assert "topic" in first_item, (
            "ExerciseQueueItem is missing the ``topic`` field. "
            "Executor must add topic derivation to the exercises endpoint (SIT-27-03)."
        )
        assert (
            first_item["topic"] == "Listening"
        ), f"Expected topic='Listening' for a LISTENING modality exercise, got {first_item['topic']!r}"

    @pytest.mark.asyncio
    async def test_exercises_api_reading_exercise_carries_reading_topic(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """GIVEN a description-source READING exercise
        WHEN  GET exercises
        THEN  item carries ``topic == "Reading"``.

        RED: no ``topic`` field on ExerciseQueueItem.
        """
        situation = await SituationFactory.create(session=db_session, ready=True)
        desc = await SituationDescriptionFactory.create(
            session=db_session, situation_id=situation.id
        )
        de = await DescriptionExerciseFactory.create(
            session=db_session, description_id=desc.id, approved=True
        )
        await DescriptionExerciseItemFactory.create(
            session=db_session, description_exercise_id=de.id
        )
        await ExerciseFactory.create(
            session=db_session,
            description_exercise_id=de.id,
            source_type=ExerciseSourceType.DESCRIPTION,
        )
        # Ensure READING modality
        de.modality = ExerciseModality.READING
        await db_session.flush()

        response = await client.get(_exercises_url(situation.id), headers=auth_headers)
        assert response.status_code == 200

        data = response.json()
        exercises = data.get("exercises", [])
        assert len(exercises) > 0

        first_item = exercises[0]
        assert "topic" in first_item, "ExerciseQueueItem is missing the ``topic`` field."
        assert (
            first_item["topic"] == "Reading"
        ), f"Expected topic='Reading' for DESCRIPTION+READING exercise, got {first_item['topic']!r}"


# ---------------------------------------------------------------------------
# AC-3 — response includes per-topic counts
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestExercisesApiTopicCounts:
    """AC-3: exercises API response includes per-topic counts."""

    @pytest.mark.asyncio
    async def test_exercises_api_returns_per_topic_counts(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """GIVEN a situation with 2 READING + 1 LISTENING description exercises
        WHEN  GET exercises
        THEN  topic_counts == {"Listening": 1, "Reading": 2, "Dialogue": 0, "Visual": 0}
              (or equivalent numeric values for the description-source exercises seeded here)

        RED: ExerciseQueue schema has no ``topic_counts`` field.
        """
        situation = await SituationFactory.create(session=db_session, ready=True)
        desc = await SituationDescriptionFactory.create(
            session=db_session, situation_id=situation.id
        )

        # Create 2 READING exercises with distinct exercise_types.
        # The factory flushes immediately on create(), so modality must be passed
        # at construction time — a post-create attribute assignment would land after
        # the flush and the second DE would INSERT with the factory-default LISTENING,
        # colliding with the first on the uq_desc_exercise_type_level_modality constraint.
        for ex_type in [ExerciseType.FILL_GAPS, ExerciseType.SELECT_HEARD]:
            de = await DescriptionExerciseFactory.create(
                session=db_session,
                description_id=desc.id,
                approved=True,
                modality=ExerciseModality.READING,
                exercise_type=ex_type,
            )
            await DescriptionExerciseItemFactory.create(
                session=db_session, description_exercise_id=de.id
            )
            await ExerciseFactory.create(
                session=db_session,
                description_exercise_id=de.id,
                source_type=ExerciseSourceType.DESCRIPTION,
            )

        # Create 1 LISTENING exercise with a distinct exercise_type from the two
        # READING ones above — (SELECT_CORRECT_ANSWER, B2, LISTENING) is unique.
        de_listen = await DescriptionExerciseFactory.create(
            session=db_session,
            description_id=desc.id,
            approved=True,
            modality=ExerciseModality.LISTENING,
            exercise_type=ExerciseType.SELECT_CORRECT_ANSWER,
        )
        await DescriptionExerciseItemFactory.create(
            session=db_session, description_exercise_id=de_listen.id
        )
        await ExerciseFactory.create(
            session=db_session,
            description_exercise_id=de_listen.id,
            source_type=ExerciseSourceType.DESCRIPTION,
        )

        await db_session.flush()

        response = await client.get(_exercises_url(situation.id), headers=auth_headers)
        assert response.status_code == 200

        data = response.json()

        # AC-3: ``topic_counts`` must be present in the response root.
        assert "topic_counts" in data, (
            "ExerciseQueue response is missing ``topic_counts``. "
            "Executor must add per-topic counts to the exercises endpoint (SIT-27-03)."
        )

        counts = data["topic_counts"]
        # All four canonical topics must always be present (even with 0 count).
        for topic in ("Listening", "Reading", "Dialogue", "Visual"):
            assert (
                topic in counts
            ), f"topic_counts is missing the '{topic}' key — all four topics must always appear."

        # Specific counts for the seeded data
        assert counts["Reading"] == 2, f"Expected 2 Reading exercises, got {counts['Reading']}"
        assert counts["Listening"] == 1, f"Expected 1 Listening exercise, got {counts['Listening']}"
        assert counts["Dialogue"] == 0, f"Expected 0 Dialogue exercises, got {counts['Dialogue']}"
        assert counts["Visual"] == 0, f"Expected 0 Visual exercises, got {counts['Visual']}"

    @pytest.mark.asyncio
    async def test_topic_counts_all_four_keys_always_present_on_empty_situation(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """GIVEN a READY situation with no exercises
        WHEN  GET exercises
        THEN  topic_counts has all four topics = 0 (not missing keys).

        RED: no ``topic_counts`` field at all.
        """
        situation = await SituationFactory.create(session=db_session, ready=True)
        await db_session.flush()

        response = await client.get(_exercises_url(situation.id), headers=auth_headers)
        assert response.status_code == 200

        data = response.json()
        assert (
            "topic_counts" in data
        ), "topic_counts must be present even when there are zero exercises."
        counts = data["topic_counts"]
        for topic in ("Listening", "Reading", "Dialogue", "Visual"):
            assert topic in counts, f"topic_counts missing '{topic}' key even on empty situation"
            assert (
                counts[topic] == 0
            ), f"Expected 0 for '{topic}' on empty situation, got {counts[topic]}"

    @pytest.mark.asyncio
    async def test_topic_counts_sum_equals_total_exercises(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ) -> None:
        """GIVEN a situation with N exercises across topics
        WHEN  GET exercises
        THEN  sum(topic_counts.values()) == len(exercises).

        Invariant: no exercise is double-counted or missed by the topic map.

        RED: no ``topic_counts`` field.
        """
        situation = await SituationFactory.create(session=db_session, ready=True)
        desc = await SituationDescriptionFactory.create(
            session=db_session, situation_id=situation.id
        )

        # Seed 3 description exercises (mix of modalities).
        # Each must have a unique (description_id, exercise_type, audio_level, modality)
        # tuple — pass both modality and a distinct exercise_type at creation time.
        for modality, ex_type in [
            (ExerciseModality.LISTENING, ExerciseType.FILL_GAPS),
            (ExerciseModality.READING, ExerciseType.SELECT_HEARD),
            (ExerciseModality.LISTENING, ExerciseType.SELECT_CORRECT_ANSWER),
        ]:
            de = await DescriptionExerciseFactory.create(
                session=db_session,
                description_id=desc.id,
                approved=True,
                modality=modality,
                exercise_type=ex_type,
            )
            await DescriptionExerciseItemFactory.create(
                session=db_session, description_exercise_id=de.id
            )
            await ExerciseFactory.create(
                session=db_session,
                description_exercise_id=de.id,
                source_type=ExerciseSourceType.DESCRIPTION,
            )

        await db_session.flush()

        response = await client.get(_exercises_url(situation.id), headers=auth_headers)
        assert response.status_code == 200

        data = response.json()
        exercises = data.get("exercises", [])
        assert "topic_counts" in data, "topic_counts must be present"

        counts = data["topic_counts"]
        total_from_counts = sum(counts.values())
        total_from_list = len(exercises)

        assert total_from_counts == total_from_list, (
            f"sum(topic_counts) = {total_from_counts} but len(exercises) = {total_from_list}. "
            "Every exercise must appear in exactly one topic bucket."
        )
